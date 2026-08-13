import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.case import CustomerCase


class Customer(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "customers"

    customer_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    account_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    cases: Mapped[list["CustomerCase"]] = relationship(
        back_populates="customer",
        cascade="save-update, merge",
    )