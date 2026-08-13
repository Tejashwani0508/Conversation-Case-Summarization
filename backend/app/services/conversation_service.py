import uuid
from math import ceil

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.conversation import Conversation
from app.models.enums import ConversationChannel, SenderType
from app.repositories.case_repository import CaseRepository
from app.repositories.conversation_repository import ConversationRepository
from app.schemas.conversation import ConversationCreate

MAX_PAGE_SIZE = 100


class ConversationService:
    """Business logic for Conversation operations."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = ConversationRepository(db)
        self.case_repo = CaseRepository(db)

    def _get_case_or_404(self, case_id: uuid.UUID):
        """Return the case or raise a 404 if it does not exist."""
        case = self.case_repo.get_by_id(case_id)
        if case is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Case not found.",
            )
        return case

    def create_conversation(
        self, case_id: uuid.UUID, payload: ConversationCreate
    ) -> Conversation:
        # Verify the case exists.
        self._get_case_or_404(case_id)

        conversation = Conversation(
            case_id=case_id,
            sender_type=payload.sender_type,
            sender_name=payload.sender_name,
            message=payload.message,
            timestamp=payload.timestamp,
            channel=payload.channel,
        )

        try:
            self.repo.create(conversation)
            self.db.commit()
            self.db.refresh(conversation)
        except Exception:
            self.db.rollback()
            raise

        return conversation

    def get_conversation(self, conversation_id: uuid.UUID) -> Conversation:
        conversation = self.repo.get_by_id(conversation_id)
        if conversation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )
        return conversation

    def list_conversations(
        self,
        *,
        case_id: uuid.UUID,
        page: int,
        page_size: int,
        sender_type: SenderType | None = None,
        channel: ConversationChannel | None = None,
    ) -> dict:
        # Verify the case exists.
        self._get_case_or_404(case_id)

        if page < 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="page must be >= 1.",
            )
        if page_size < 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="page_size must be >= 1.",
            )
        if page_size > MAX_PAGE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="page_size must be <= 100.",
            )

        items, total = self.repo.list_by_case(
            case_id=case_id,
            page=page,
            page_size=page_size,
            sender_type=sender_type,
            channel=channel,
        )
        total_pages = ceil(total / page_size) if total > 0 else 0
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }

    def get_case_conversation_history(self, case_id: uuid.UUID) -> list[Conversation]:
        # Verify the case exists.
        self._get_case_or_404(case_id)

        return self.repo.get_case_conversation_history(case_id)