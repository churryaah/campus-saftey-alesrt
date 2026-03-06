"""
SafetyHub Gateway v2  —  gateway.py
══════════════════════════════════════════════════════════════
Runs on your laptop while connected to the ESP32 WiFi.

Flow:
    ESP32 (192.168.4.1/api/data)
        │  GET every 2 s
        ▼
    This script
        │  POST to cloud backend every 2 s
        ▼
    Cloud Backend (Render / localhost)
        │
        ▼
    PostgreSQL Database → Public Dashboard

Install:
    pip install -r requirements.txt

Configure:
    Set BACKEND_URL environment variable to your deployed backend.
    Or edit BACKEND_URL below.

Run:
    python gateway.py
    python gateway.py --backend http://localhost:8000   # local dev
    python gateway.py --backend https://safetyhub.onrender.com
══════════════════════════════════════════════════════════════
"""

import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone

import httpx
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ── CLI args (override with env vars or command line) ─────────
parser = argparse.ArgumentParser(description="SafetyHub Gateway")
parser.add_argument("--esp32",   default=os.getenv("ESP32_URL",    "http://192.168.4.1/api/data"))
parser.add_argument("--backend", default=os.getenv("BACKEND_URL",  "http://localhost:8000"))
parser.add_argument("--interval",default=float(os.getenv("POLL_INTERVAL", "2.0")), type=float)
parser.add_argument("--port",    default=int(os.getenv("GATEWAY_PORT", "8001")),    type=int)
args, _ = parser.parse_known_args()

ESP32_URL    = args.esp32
BACKEND_URL  = args.backend
POLL_INTERVAL= args.interval
GATEWAY_PORT = args.port
FETCH_TIMEOUT= 3.0
PUSH_TIMEOUT = 5.0
HISTORY_MAX  = 100

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("gateway")

# ── In-memory state ───────────────────────────────────────────
class State:
    latest:               dict | None = None
    esp32_online:         bool        = False
    backend_online:       bool        = False
    last_esp32_success:   str | None  = None
    last_backend_push:    str | None  = None
    last_error:           str | None  = None
    esp32_failures:       int         = 0
    backend_failures:     int         = 0
    total_reads:          int         = 0
    total_pushes:         int         = 0
    history:              list        = []

state = State()

# ── FastAPI local API (for debugging / local dashboard) ───────
app = FastAPI(title="SafetyHub Gateway", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/sensor-data")
async def local_sensor_data():
    if not state.latest:
        return JSONResponse(status_code=503, content={"error": "No data yet", "esp32": state.esp32_online})
    return state.latest

@app.get("/health")
async def local_health():
    return {
        "gateway":          "online",
        "esp32":            "online" if state.esp32_online else "offline",
        "backend":          "online" if state.backend_online else "offline",
        "esp32_url":        ESP32_URL,
        "backend_url":      BACKEND_URL,
        "last_esp32":       state.last_esp32_success,
        "last_push":        state.last_backend_push,
        "last_error":       state.last_error,
        "esp32_failures":   state.esp32_failures,
        "backend_failures": state.backend_failures,
        "total_reads":      state.total_reads,
        "total_pushes":     state.total_pushes,
        "history_count":    len(state.history),
    }

@app.get("/history")
async def local_history(limit: int = 50):
    limit = min(limit, HISTORY_MAX)
    return {"count": min(limit, len(state.history)), "readings": state.history[-limit:]}


# ── Core polling loop ─────────────────────────────────────────
async def run_gateway():
    """
    Runs forever:
      1. Fetch from ESP32
      2. Validate
      3. Push to cloud backend
      4. Cache locally
      5. Sleep 2 s
    """
    log.info("══════════════════════════════════════")
    log.info("  SafetyHub Gateway v2 starting")
    log.info("  ESP32   → %s", ESP32_URL)
    log.info("  Backend → %s", BACKEND_URL)
    log.info("  Interval: %.1f s", POLL_INTERVAL)
    log.info("══════════════════════════════════════")

    async with httpx.AsyncClient() as client:
        while True:
            await _cycle(client)
            await asyncio.sleep(POLL_INTERVAL)


async def _cycle(client: httpx.AsyncClient):
    # ── Step 1: Fetch from ESP32 ─────────────────────────────
    try:
        resp = await client.get(ESP32_URL, timeout=FETCH_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        required = {"temperature", "humidity", "gasLevel", "vibration", "alert"}
        if not required.issubset(data.keys()):
            raise ValueError(f"Missing fields: {required - data.keys()}")

        ts = datetime.now(timezone.utc).isoformat()
        enriched = {**data, "timestamp": ts}

        state.latest              = enriched
        state.esp32_online        = True
        state.last_esp32_success  = ts
        state.esp32_failures      = 0
        state.total_reads        += 1

        state.history.append(enriched)
        if len(state.history) > HISTORY_MAX:
            state.history.pop(0)

        log.debug("ESP32 ✓ | temp=%.1f hum=%.1f gas=%d vib=%.3f | %s",
                  data["temperature"], data["humidity"],
                  data["gasLevel"],   data["vibration"], data["alert"])

    except httpx.ConnectError:
        _esp32_error("ESP32 unreachable — check WiFi connection to 'SafetyHub'")
        return
    except httpx.TimeoutException:
        _esp32_error(f"ESP32 timed out after {FETCH_TIMEOUT}s")
        return
    except (ValueError, KeyError) as e:
        _esp32_error(f"Bad ESP32 response: {e}")
        return
    except Exception as e:
        _esp32_error(f"Unexpected: {e}")
        return

    # ── Step 2: Push to cloud backend ────────────────────────
    try:
        push_resp = await client.post(
            f"{BACKEND_URL}/sensor-data",
            json={
                "temperature": data["temperature"],
                "humidity":    data["humidity"],
                "gasLevel":    data["gasLevel"],
                "vibration":   data["vibration"],
                "alert":       data["alert"],
            },
            timeout=PUSH_TIMEOUT,
        )
        push_resp.raise_for_status()

        state.backend_online      = True
        state.last_backend_push   = ts
        state.backend_failures    = 0
        state.total_pushes       += 1

        # Alert to console when hazard detected
        if data["alert"] != "System Normal":
            log.warning("⚠  ALERT: %s", data["alert"])

    except httpx.ConnectError:
        _backend_error("Backend unreachable — is the cloud server running?")
    except httpx.HTTPStatusError as e:
        _backend_error(f"Backend returned {e.response.status_code}: {e.response.text[:200]}")
    except httpx.TimeoutException:
        _backend_error(f"Backend push timed out after {PUSH_TIMEOUT}s")
    except Exception as e:
        _backend_error(f"Unexpected push error: {e}")


def _esp32_error(msg: str):
    state.esp32_online    = False
    state.last_error      = msg
    state.esp32_failures += 1
    if state.esp32_failures == 1 or state.esp32_failures % 10 == 0:
        log.warning("ESP32 OFFLINE [%d] — %s", state.esp32_failures, msg)


def _backend_error(msg: str):
    state.backend_online    = False
    state.last_error        = msg
    state.backend_failures += 1
    if state.backend_failures == 1 or state.backend_failures % 10 == 0:
        log.error("BACKEND OFFLINE [%d] — %s", state.backend_failures, msg)


# ── Entry point ───────────────────────────────────────────────
async def main():
    # Run gateway loop + local FastAPI server concurrently
    config = uvicorn.Config(app, host="0.0.0.0", port=GATEWAY_PORT,
                            log_level="warning", reload=False)
    server = uvicorn.Server(config)
    await asyncio.gather(
        run_gateway(),
        server.serve(),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Gateway stopped by user")
        sys.exit(0)
