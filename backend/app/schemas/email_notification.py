import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import EmailStatus


class EmailSendRequest(BaseModel):
    to_email: EmailStr = Field(..., description="Recipient email address")
    cc_emails: list[EmailStr] = Field(default_factory=list, description="Optional CC recipients")
    subject: str = Field(default="AI Case Summary", min_length=1, max_length=255, description="Email subject")


class EmailSendResponse(BaseModel):
    status: str = Field(default="sent")
    message: str
    email_id: uuid.UUID
    provider_message_id: str | None = None


class EmailNotificationResponse(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    ai_analysis_id: uuid.UUID
    to_email: str
    cc_emails: list[str]
    subject: str
    status: EmailStatus
    sent_at: datetime | None
    sent_by: str | None
    provider_message_id: str | None
    error_message: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmailNotificationListResponse(BaseModel):
    items: list[EmailNotificationResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
