import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    AIAnalysisRunStatus,
    CaseCategory,
    CasePriority,
    Sentiment,
)


class AIAnalysisResponse(BaseModel):
    """AI analysis representation returned by the API."""

    id: uuid.UUID
    case_id: uuid.UUID
    summary: str
    issue: str
    category: CaseCategory
    sentiment: Sentiment
    sentiment_score: float | None
    ai_priority: CasePriority
    key_details: list
    actions_taken: list
    pending_actions: list
    recommended_action: str | None
    model_name: str | None
    prompt_version: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AIAnalysisRunResponse(BaseModel):
    """AI analysis run representation returned by the API."""

    id: uuid.UUID
    case_id: uuid.UUID
    model_name: str | None
    prompt_version: str | None
    input_message_count: int
    processing_time_ms: int | None
    status: AIAnalysisRunStatus
    error_message: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AIAnalysisListResponse(BaseModel):
    """Paginated list of AI analyses."""

    items: list[AIAnalysisResponse]
    page: int
    page_size: int
    total: int
    total_pages: int


class AIRunListResponse(BaseModel):
    """Paginated list of AI analysis runs."""

    items: list[AIAnalysisRunResponse]
    page: int
    page_size: int
    total: int
    total_pages: int


class AISummaryOutput(BaseModel):
    """Structured output expected from the LLM.

    This schema validates the AI provider's response before it is
    written to the database, ensuring arbitrary LLM JSON is never
    trusted directly.
    """

    summary: str = Field(..., min_length=1, description="Concise case summary")
    issue: str = Field(..., min_length=1, description="Identified issue")
    category: CaseCategory = Field(..., description="Detected case category")
    sentiment: Sentiment = Field(..., description="Detected customer sentiment")
    sentiment_score: float | None = Field(
        None, ge=0.0, le=1.0, description="Optional sentiment score between 0 and 1"
    )
    ai_priority: CasePriority = Field(..., description="AI-recommended priority")
    key_details: list[str] = Field(
        default_factory=list, description="Key points/details extracted"
    )
    actions_taken: list[str] = Field(
        default_factory=list, description="Actions already taken"
    )
    pending_actions: list[str] = Field(
        default_factory=list, description="Pending/unresolved actions"
    )
    recommended_action: str | None = Field(
        None, description="Recommended next step"
    )