import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, UUIDMixin, utc_now
from app.models.enums import AIAnalysisRunStatus

if TYPE_CHECKING:
    from app.models.case import CustomerCase


class AIAnalysisRun(UUIDMixin, Base):
    __tablename__ = "ai_analysis_runs"

    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customer_cases.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    input_message_count: Mapped[int] = mapped_column(Integer, nullable=False)
    processing_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[AIAnalysisRunStatus] = mapped_column(
        Enum(
            AIAnalysisRunStatus,
            name="ai_analysis_run_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    case: Mapped["CustomerCase"] = relationship(back_populates="ai_analysis_runs")