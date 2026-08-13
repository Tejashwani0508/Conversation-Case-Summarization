import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.conversation import Conversation
from app.models.enums import ConversationChannel, SenderType


class ConversationRepository:
    """Data access layer for Conversation records."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, conversation_id: uuid.UUID) -> Conversation | None:
        return self.db.get(Conversation, conversation_id)

    def create(self, conversation: Conversation) -> Conversation:
        """Stage a new conversation for creation.

        Commit/refresh is handled by the service layer, matching the
        existing repository transaction convention.
        """
        self.db.add(conversation)
        return conversation

    def _apply_filters(
        self,
        stmt,
        *,
        case_id: uuid.UUID,
        sender_type: SenderType | None = None,
        channel: ConversationChannel | None = None,
    ):
        """Apply shared filtering logic used by both list and count."""
        stmt = stmt.where(Conversation.case_id == case_id)
        if sender_type is not None:
            stmt = stmt.where(Conversation.sender_type == sender_type)
        if channel is not None:
            stmt = stmt.where(Conversation.channel == channel)
        return stmt

    def list_by_case(
        self,
        *,
        case_id: uuid.UUID,
        page: int,
        page_size: int,
        sender_type: SenderType | None = None,
        channel: ConversationChannel | None = None,
    ) -> tuple[list[Conversation], int]:
        """Return a page of conversations for a case and the total count.

        Ordered chronologically by timestamp ASC, with a secondary
        deterministic ordering by id to handle identical timestamps.
        """
        base_stmt = select(Conversation)
        base_stmt = self._apply_filters(
            base_stmt,
            case_id=case_id,
            sender_type=sender_type,
            channel=channel,
        )

        total = self.db.scalar(
            select(func.count()).select_from(base_stmt.subquery())
        ) or 0

        stmt = (
            base_stmt.order_by(
                Conversation.timestamp.asc(),
                Conversation.id.asc(),
            )
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.scalars(stmt).all())

        return items, total

    def count_by_case(
        self,
        *,
        case_id: uuid.UUID,
        sender_type: SenderType | None = None,
        channel: ConversationChannel | None = None,
    ) -> int:
        """Return the total count of conversations matching the same filters as list_by_case."""
        stmt = select(func.count()).select_from(Conversation)
        stmt = self._apply_filters(
            stmt,
            case_id=case_id,
            sender_type=sender_type,
            channel=channel,
        )
        return self.db.scalar(stmt) or 0

    def get_case_conversation_history(self, case_id: uuid.UUID) -> list[Conversation]:
        """Return all conversations for a case in chronological order.

        Ordered by timestamp ASC with a secondary deterministic ordering
        by id to handle identical timestamps. Intended for later use by
        the AI summarization layer.
        """
        stmt = (
            select(Conversation)
            .where(Conversation.case_id == case_id)
            .order_by(
                Conversation.timestamp.asc(),
                Conversation.id.asc(),
            )
        )
        return list(self.db.scalars(stmt).all())