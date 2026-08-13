import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, UUIDMixin, utc_now
from app.models.enums import ConversationChannel, SenderType

if TYPE_CHECKING:
    from app.models.case import CustomerCase


class Conversation(UUIDMixin, Base):
    __tablename__ = "conversations"

    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customer_cases.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    sender_type: Mapped[SenderType] = mapped_column(
        Enum(SenderType, name="sender_type", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    sender_name: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    channel: Mapped[ConversationChannel] = mapped_column(
        Enum(
            ConversationChannel,
            name="conversation_channel",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    case: Mapped["CustomerCase"] = relationship(back_populates="conversations")