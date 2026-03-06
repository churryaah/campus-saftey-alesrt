"""
schemas.py  —  Pydantic v2 request / response schemas
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ── Inbound (gateway → backend) ───────────────────────────────
class SensorDataIn(BaseModel):
    """Schema for data the laptop gateway POSTs to /sensor-data."""
    temperature: float = Field(..., ge=-40, le=125,   description="°C from DHT11")
    humidity:    float = Field(..., ge=0,   le=100,   description="% RH from DHT11")
    gasLevel:    int   = Field(..., ge=0,   le=4095,  description="ADC raw 0-4095 from MQ2")
    vibration:   float = Field(..., ge=0,   le=50,    description="G-force from MPU6050")
    alert:       str   = Field(default="System Normal", max_length=120)

    @field_validator("alert")
    @classmethod
    def strip_alert(cls, v: str) -> str:
        return v.strip()

    model_config = {"json_schema_extra": {
        "example": {
            "temperature": 31.5,
            "humidity":    67.2,
            "gasLevel":    410,
            "vibration":   0.72,
            "alert":       "System Normal",
        }
    }}


# ── Outbound (backend → dashboard) ────────────────────────────
class SensorDataOut(BaseModel):
    """Schema returned by /latest, /history, and SSE stream."""
    id:          Optional[int]      = None
    timestamp:   Optional[str]      = None
    temperature: float
    humidity:    float
    gasLevel:    int
    vibration:   float
    alert:       str


# ── Health ────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status:         str
    database:       str
    gateway_active: bool
    sse_clients:    int
    last_reading:   Optional[str]
    timestamp:      str


# ── Stats ─────────────────────────────────────────────────────
class StatsResponse(BaseModel):
    total_readings:  int
    alert_count:     int
    avg_temperature: float
    max_temperature: float
    min_temperature: float
    avg_humidity:    float
    max_gas_level:   int
    avg_gas_level:   float
    max_vibration:   float
    latest_reading:  Optional[dict]
