from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = (
        UniqueConstraint(
            "general_queue_id",
            "queue_date",
            "general_queue_number",
            name="uq_ticket_general_queue_number",
        ),
        UniqueConstraint("request_id", name="uq_ticket_request_id"),
        UniqueConstraint("ticket_code", name="uq_ticket_ticket_code"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    ticket_code: Mapped[str] = mapped_column(String(64), index=True)
    queue_date: Mapped[date] = mapped_column(Date, index=True)

    general_queue_id: Mapped[int] = mapped_column(ForeignKey("queues.id"), index=True)
    general_queue_number: Mapped[int] = mapped_column(Integer)

    clinic_queue_id: Mapped[int | None] = mapped_column(
        ForeignKey("queues.id"), nullable=True, index=True
    )
    clinic_queue_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    routing_status: Mapped[str] = mapped_column(String(20), default="unrouted", index=True)
    routed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    request_id: Mapped[str] = mapped_column(String(64), index=True)
    subject_ref: Mapped[str] = mapped_column(String(64), index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
