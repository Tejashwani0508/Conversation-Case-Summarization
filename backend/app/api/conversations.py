import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.enums import ConversationChannel, SenderType
from app.schemas.conversation import (
    ConversationCreate,
    ConversationListResponse,
    ConversationResponse,
)
from app.services.conversation_service import ConversationService

router = APIRouter(tags=["Conversation Management"])

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 20


@router.post(
    "/api/cases/{case_id}/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a conversation",
    description="Create a customer/agent conversation message for an existing case.",
    responses={
        201: {"description": "Conversation created successfully"},
        404: {"description": "Case not found"},
        422: {"description": "Validation error"},
    },
)
def create_conversation(
    case_id: uuid.UUID,
    payload: ConversationCreate,
    db: Session = Depends(get_db),
) -> ConversationResponse:
    service = ConversationService(db)
    conversation = service.create_conversation(case_id, payload)
    return ConversationResponse.model_validate(conversation)


@router.get(
    "/api/cases/{case_id}/conversations/history",
    response_model=list[ConversationResponse],
    summary="Get complete case conversation history",
    description="Return the complete chronological conversation history for a case.",
    responses={
        200: {"description": "Chronological conversation history"},
        404: {"description": "Case not found"},
    },
)
def get_case_conversation_history(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    service = ConversationService(db)
    conversations = service.get_case_conversation_history(case_id)
    return [ConversationResponse.model_validate(c) for c in conversations]


@router.get(
    "/api/cases/{case_id}/conversations",
    response_model=ConversationListResponse,
    summary="List case conversations",
    description="List conversations for a case with pagination and filters.",
    responses={
        200: {"description": "Paginated list of conversations"},
        404: {"description": "Case not found"},
    },
)
def list_conversations(
    case_id: uuid.UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(
        DEFAULT_PAGE_SIZE,
        ge=1,
        le=MAX_PAGE_SIZE,
        description="Number of items per page (max 100)",
    ),
    sender_type: SenderType | None = Query(
        None,
        description="Filter by sender type",
    ),
    channel: ConversationChannel | None = Query(
        None,
        description="Filter by conversation channel",
    ),
    db: Session = Depends(get_db),
) -> ConversationListResponse:
    service = ConversationService(db)
    result = service.list_conversations(
        case_id=case_id,
        page=page,
        page_size=page_size,
        sender_type=sender_type,
        channel=channel,
    )
    return ConversationListResponse(
        items=[ConversationResponse.model_validate(c) for c in result["items"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
        total_pages=result["total_pages"],
    )


@router.get(
    "/api/conversations/{conversation_id}",
    response_model=ConversationResponse,
    summary="Get a conversation by ID",
    description="Retrieve a single conversation by its UUID.",
    responses={
        200: {"description": "Conversation found"},
        404: {"description": "Conversation not found"},
    },
)
def get_conversation(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> ConversationResponse:
    service = ConversationService(db)
    conversation = service.get_conversation(conversation_id)
    return ConversationResponse.model_validate(conversation)