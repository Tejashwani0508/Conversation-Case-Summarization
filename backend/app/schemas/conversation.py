import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ConversationChannel, SenderType


class ConversationCreate(BaseModel):
    """Payload for creating a new conversation."""

    sender_type: SenderType = Field(..., description="Whether the sender is a customer or an agent")
    sender_name: str = Field(..., min_length=1, max_length=255, description="Name of the sender")
    message: str = Field(..., min_length=1, description="Conversation message content")
    timestamp: datetime | None = Field(
        None, description="Timestamp of the message. Defaults to now if not supplied."
    )
    channel: ConversationChannel = Field(..., description="Channel the conversation occurred on")


class ConversationResponse(BaseModel):
    """Conversation representation returned by the API."""

    id: uuid.UUID
    case_id: uuid.UUID
    sender_type: SenderType
    sender_name: str
    message: str
    timestamp: datetime
    channel: ConversationChannel
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationListResponse(BaseModel):
    """Paginated list of conversations."""

    items: list[ConversationResponse]
    page: int
    page_size: int
    total: int
    total_pages: int