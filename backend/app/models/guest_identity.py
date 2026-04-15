from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Index,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GuestIdentity(Base):
    __tablename__ = "guest_identities"
    __table_args__ = (
        UniqueConstraint("user_ref", name="uq_guest_identity_user_ref"),
        UniqueConstraint("google_sub", name="uq_guest_identity_google_sub"),
        CheckConstraint(
            "(is_phone_active = false) OR (phone IS NOT NULL)",
            name="ck_guest_identity_active_phone_requires_phone",
        ),
        Index(
            "uq_guest_identity_active_phone",
            "phone",
            unique=True,
            postgresql_where=text("is_phone_active = true"),
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_ref: Mapped[str] = mapped_column(String(64), index=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)

    is_phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_phone_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    phone_linked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
