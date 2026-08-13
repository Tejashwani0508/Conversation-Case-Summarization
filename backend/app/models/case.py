import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import CaseCategory, CasePriority, CaseStatus

if TYPE_CHECKING:
    from app.models.ai_analysis import AIAnalysis
    from app.models.ai_run import AIAnalysisRun
    from app.models.conversation import Conversation
    from app.models.customer import Customer


class CustomerCase(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "customer_cases"

    case_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[CaseCategory] = mapped_column(
        Enum(CaseCategory, name="case_category", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    status: Mapped[CaseStatus] = mapped_column(
        Enum(CaseStatus, name="case_status", values_callable=lambda e: [m.value for m in e]),
        default=CaseStatus.OPEN,
        nullable=False,
    )
    priority: Mapped[CasePriority] = mapped_column(
        Enum(CasePriority, name="case_priority", values_callable=lambda e: [m.value for m in e]),
        default=CasePriority.MEDIUM,
        nullable=False,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    assigned_agent: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    customer: Mapped["Customer"] = relationship(back_populates="cases")
    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="case",
        cascade="save-update, merge",
        order_by="Conversation.timestamp",
    )
    ai_analyses: Mapped[list["AIAnalysis"]] = relationship(
        back_populates="case",
        cascade="save-update, merge",
        order_by="AIAnalysis.created_at",
    )
    ai_analysis_runs: Mapped[list["AIAnalysisRun"]] = relationship(
        back_populates="case",
        cascade="save-update, merge",
        order_by="AIAnalysisRun.created_at",
    )