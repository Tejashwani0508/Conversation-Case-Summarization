import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import CaseCategory, CasePriority, CaseStatus


class CaseCreate(BaseModel):
    """Payload for creating a new case."""

    customer_id: uuid.UUID = Field(..., description="ID of the customer the case belongs to")
    subject: str = Field(..., min_length=1, max_length=255, description="Case subject")
    description: str | None = Field(None, description="Detailed case description")
    category: CaseCategory = Field(..., description="Case category")
    priority: CasePriority | None = Field(None, description="Case priority")
    assigned_agent: str | None = Field(
        None, max_length=255, description="Name of the assigned agent"
    )


class CaseUpdate(BaseModel):
    """Payload for updating a case. All fields are optional."""

    subject: str | None = Field(None, min_length=1, max_length=255, description="Case subject")
    description: str | None = Field(None, description="Detailed case description")
    category: CaseCategory | None = Field(None, description="Case category")
    priority: CasePriority | None = Field(None, description="Case priority")
    status: CaseStatus | None = Field(None, description="Case status")
    assigned_agent: str | None = Field(
        None, max_length=255, description="Name of the assigned agent"
    )


class CaseResponse(BaseModel):
    """Case representation returned by the API."""

    id: uuid.UUID
    case_number: str
    customer_id: uuid.UUID
    subject: str
    description: str | None
    category: CaseCategory
    status: CaseStatus
    priority: CasePriority
    assigned_agent: str | None
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CaseListResponse(BaseModel):
    """Paginated list of cases."""

    items: list[CaseResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
