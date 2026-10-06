import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, UUIDMixin, utc_now
from app.models.enums import CaseCategory, CasePriority, Sentiment

if TYPE_CHECKING:
    from app.models.case import CustomerCase
    from app.models.email_notification import EmailNotification


class AIAnalysis(UUIDMixin, Base):
    __tablename__ = "ai_analysis"

    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customer_cases.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    issue: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[CaseCategory] = mapped_column(
        Enum(CaseCategory, name="case_category", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    sentiment: Mapped[Sentiment] = mapped_column(
        Enum(Sentiment, name="sentiment", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    sentiment_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_priority: Mapped[CasePriority] = mapped_column(
        Enum(
            CasePriority,
            name="case_priority",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )
    key_details: Mapped[list] = mapped_column(
        JSONB, default=list, nullable=False
    )
    actions_taken: Mapped[list] = mapped_column(
        JSONB, default=list, nullable=False
    )
    pending_actions: Mapped[list] = mapped_column(
        JSONB, default=list, nullable=False
    )
    recommended_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    case: Mapped["CustomerCase"] = relationship(back_populates="ai_analyses")
    email_notifications: Mapped[list["EmailNotification"]] = relationship(
        back_populates="ai_analysis",
        cascade="save-update, merge",
        order_by="EmailNotification.created_at.desc()",
    )