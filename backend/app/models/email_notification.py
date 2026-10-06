import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import EmailStatus

if TYPE_CHECKING:
    from app.models.ai_analysis import AIAnalysis
    from app.models.case import CustomerCase


class EmailNotification(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "email_notifications"

    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customer_cases.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    ai_analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_analysis.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    cc_emails: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[EmailStatus] = mapped_column(
        Enum(EmailStatus, name="email_notification_status", values_callable=lambda e: [m.value for m in e]),
        default=EmailStatus.PENDING,
        nullable=False,
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    case: Mapped["CustomerCase"] = relationship(back_populates="email_notifications")
    ai_analysis: Mapped["AIAnalysis"] = relationship(back_populates="email_notifications")
