"""
SafetyHub Cloud Backend  —  main.py
════════════════════════════════════════════════════════════════
FastAPI backend that:
  • receives sensor data pushed by the laptop gateway
  • stores every reading in PostgreSQL
  • serves a realtime SSE stream to the public dashboard
  • exposes a full REST API for historical queries

Endpoints:
  POST /sensor-data          ← gateway pushes data here
  GET  /latest               ← latest reading
  GET  /history              ← paginated historical data
  GET  /alerts               ← alert event log
  GET  /health               ← system health
  GET  /stream               ← Server-Sent Events realtime feed
  GET  /stats                ← aggregate stats
════════════════════════════════════════════════════════════════
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import AsyncGenerator, Optional

import uvicorn
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, init_db
from models import SensorReading
from schemas import SensorDataIn, SensorDataOut, HealthResponse, StatsResponse
from sqlalchemy import select, desc, func, and_

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("safetyhub.backend")

# ── Config ───────────────────────────────────────────────────
API_KEY      = os.getenv("GATEWAY_API_KEY", "safetyhub-secret-key-change-me")
PORT         = int(os.getenv("PORT", 8000))

# ── SSE broadcast queue ──────────────────────────────────────
# All connected SSE clients share this queue
sse_clients: list[asyncio.Queue] = []

def broadcast(data: dict):
    """Push a reading to every connected SSE client."""
    dead = []
    for q in sse_clients:
        try:
            q.put_nowait(data)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        try:
            sse_clients.remove(q)
        except ValueError:
            pass

# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="SafetyHub Cloud API",
    description="Campus Emergency & Multi-Hazard Alert System — Cloud Backend",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # public dashboard can be on any domain
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup ───────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    await init_db()
    log.info("SafetyHub backend started on port %d", PORT)
    log.info("Database initialised — ready to receive sensor data")

# ══════════════════════════════════════════════════════════════
#  POST /sensor-data  — gateway pushes readings here
# ══════════════════════════════════════════════════════════════
@app.post("/sensor-data", response_model=SensorDataOut, status_code=201)
async def receive_sensor_data(
    payload: SensorDataIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Called by the laptop gateway every 2 seconds.
    Stores the reading and broadcasts it to SSE subscribers.
    """
    row = SensorReading(
        temperature = payload.temperature,
        humidity    = payload.humidity,
        gas_level   = payload.gasLevel,
        vibration   = payload.vibration,
        alert       = payload.alert,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    # Broadcast to all SSE clients immediately
    out = _row_to_dict(row)
    broadcast(out)

    log.debug(
        "Stored | temp=%.1f  hum=%.1f  gas=%d  vib=%.3f  alert=%s",
        row.temperature, row.humidity, row.gas_level, row.vibration, row.alert,
    )
    return out


# ══════════════════════════════════════════════════════════════
#  GET /latest  — single latest reading
# ══════════════════════════════════════════════════════════════
@app.get("/latest", response_model=Optional[SensorDataOut])
async def get_latest(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SensorReading).order_by(desc(SensorReading.timestamp)).limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="No data yet")
    return _row_to_dict(row)


# ══════════════════════════════════════════════════════════════
#  GET /history  — paginated history
# ══════════════════════════════════════════════════════════════
@app.get("/history")
async def get_history(
    limit:  int = Query(default=50,  ge=1, le=1000),
    offset: int = Query(default=0,   ge=0),
    hours:  int = Query(default=24,  ge=1, le=168),  # last N hours
    db: AsyncSession = Depends(get_db),
):
    """
    Returns paginated sensor history.
    - limit: rows per page (max 1000)
    - offset: skip rows
    - hours: only return data from last N hours (default 24h)
    """
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    q = (
        select(SensorReading)
        .where(SensorReading.timestamp >= since)
        .order_by(desc(SensorReading.timestamp))
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(q)
    rows = result.scalars().all()

    # Total count for pagination
    count_q = select(func.count()).where(
        SensorReading.timestamp >= since,
        select(SensorReading).where(SensorReading.timestamp >= since).exists()
    )
    total_q = await db.execute(
        select(func.count(SensorReading.id)).where(SensorReading.timestamp >= since)
    )
    total = total_q.scalar()

    return {
        "total":   total,
        "limit":   limit,
        "offset":  offset,
        "hours":   hours,
        "readings": [_row_to_dict(r) for r in rows],
    }


# ══════════════════════════════════════════════════════════════
#  GET /alerts  — only rows where alert != "System Normal"
# ══════════════════════════════════════════════════════════════
@app.get("/alerts")
async def get_alerts(
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SensorReading)
        .where(SensorReading.alert != "System Normal")
        .order_by(desc(SensorReading.timestamp))
        .limit(limit)
    )
    rows = result.scalars().all()
    return {
        "count":  len(rows),
        "alerts": [_row_to_dict(r) for r in rows],
    }


# ══════════════════════════════════════════════════════════════
#  GET /stats  — aggregate statistics
# ══════════════════════════════════════════════════════════════
@app.get("/stats", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            func.count(SensorReading.id).label("total_readings"),
            func.avg(SensorReading.temperature).label("avg_temp"),
            func.max(SensorReading.temperature).label("max_temp"),
            func.min(SensorReading.temperature).label("min_temp"),
            func.avg(SensorReading.humidity).label("avg_humidity"),
            func.max(SensorReading.gas_level).label("max_gas"),
            func.avg(SensorReading.gas_level).label("avg_gas"),
            func.max(SensorReading.vibration).label("max_vibration"),
        )
    )
    row = result.one()

    alert_count = await db.execute(
        select(func.count(SensorReading.id)).where(
            SensorReading.alert != "System Normal"
        )
    )

    latest_result = await db.execute(
        select(SensorReading).order_by(desc(SensorReading.timestamp)).limit(1)
    )
    latest = latest_result.scalar_one_or_none()

    return {
        "total_readings":  row.total_readings or 0,
        "alert_count":     alert_count.scalar() or 0,
        "avg_temperature": round(row.avg_temp or 0, 1),
        "max_temperature": round(row.max_temp or 0, 1),
        "min_temperature": round(row.min_temp or 0, 1),
        "avg_humidity":    round(row.avg_humidity or 0, 1),
        "max_gas_level":   row.max_gas or 0,
        "avg_gas_level":   round(row.avg_gas or 0, 1),
        "max_vibration":   round(row.max_vibration or 0, 3),
        "latest_reading":  _row_to_dict(latest) if latest else None,
    }


# ══════════════════════════════════════════════════════════════
#  GET /health  — system health
# ══════════════════════════════════════════════════════════════
@app.get("/health", response_model=HealthResponse)
async def health(db: AsyncSession = Depends(get_db)):
    # Quick DB ping
    db_ok = False
    try:
        await db.execute(select(func.count(SensorReading.id)))
        db_ok = True
    except Exception:
        pass

    latest_result = await db.execute(
        select(SensorReading).order_by(desc(SensorReading.timestamp)).limit(1)
    )
    latest = latest_result.scalar_one_or_none()
    last_ts = latest.timestamp.isoformat() if latest else None

    # Check if data is fresh (within last 30 seconds)
    gateway_active = False
    if latest:
        age = (datetime.now(timezone.utc) - latest.timestamp.replace(tzinfo=timezone.utc)).total_seconds()
        gateway_active = age < 30

    return {
        "status":          "ok" if db_ok else "degraded",
        "database":        "connected" if db_ok else "error",
        "gateway_active":  gateway_active,
        "sse_clients":     len(sse_clients),
        "last_reading":    last_ts,
        "timestamp":       datetime.now(timezone.utc).isoformat(),
    }


# ══════════════════════════════════════════════════════════════
#  GET /stream  — Server-Sent Events realtime feed
# ══════════════════════════════════════════════════════════════
@app.get("/stream")
async def stream(request: Request):
    """
    Server-Sent Events endpoint.
    Dashboard connects once and receives every new reading in realtime.
    No polling needed — push-based.
    """
    queue: asyncio.Queue = asyncio.Queue(maxsize=50)
    sse_clients.append(queue)
    log.info("SSE client connected (%d total)", len(sse_clients))

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # Send a heartbeat comment every 15 s to keep connection alive
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"   # SSE comment — keeps connection open
        finally:
            try:
                sse_clients.remove(queue)
            except ValueError:
                pass
            log.info("SSE client disconnected (%d remaining)", len(sse_clients))

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


# ══════════════════════════════════════════════════════════════
#  Helper
# ══════════════════════════════════════════════════════════════
def _row_to_dict(row: SensorReading) -> dict:
    return {
        "id":          row.id,
        "timestamp":   row.timestamp.isoformat() if row.timestamp else None,
        "temperature": row.temperature,
        "humidity":    row.humidity,
        "gasLevel":    row.gas_level,
        "vibration":   row.vibration,
        "alert":       row.alert,
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=PORT,
        reload=False,
        log_level="info",
    )
