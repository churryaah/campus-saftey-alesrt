"""
models.py  —  SQLAlchemy ORM table definitions
"""

from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger, DateTime, Float, Integer, String, Index
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class SensorReading(Base):
    """
    One row per sensor poll (every 2 seconds from gateway).
    Indexed on timestamp for fast time-range queries.
    """
    __tablename__ = "sensor_data"

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    temperature: Mapped[float] = mapped_column(Float, nullable=False)
    humidity:    Mapped[float] = mapped_column(Float, nullable=False)
    gas_level:   Mapped[int]   = mapped_column(Integer, nullable=False)
    vibration:   Mapped[float] = mapped_column(Float, nullable=False)
    alert:       Mapped[str]   = mapped_column(String(120), nullable=False, default="System Normal")

    # Composite index for alert history queries
    __table_args__ = (
        Index("ix_sensor_data_alert_ts", "alert", "timestamp"),
    )

    def __repr__(self) -> str:
        return (
            f"<SensorReading id={self.id} ts={self.timestamp} "
            f"temp={self.temperature} gas={self.gas_level} alert='{self.alert}'>"
        )
