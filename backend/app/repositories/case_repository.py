import uuid

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.models.case import CustomerCase
from app.models.conversation import Conversation
from app.models.enums import CasePriority, CaseStatus


class CaseRepository:
    """Data access layer for CustomerCase records."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, case_id: uuid.UUID) -> CustomerCase | None:
        return self.db.get(CustomerCase, case_id)

    def get_by_case_number(self, case_number: str) -> CustomerCase | None:
        stmt = select(CustomerCase).where(
            CustomerCase.case_number == case_number
        )
        return self.db.scalar(stmt)

    def create(self, case: CustomerCase) -> CustomerCase:
        """Stage a new case for creation.

        Commit/refresh is handled by the service layer, matching the
        existing CustomerRepository transaction convention.
        """
        self.db.add(case)
        return case

    def update(self, case: CustomerCase, update_data: dict) -> CustomerCase:
        """Apply supplied field updates to an existing case.

        The caller controls which fields are allowed. Commit/refresh is
        handled by the service layer.
        """
        for field, value in update_data.items():
            setattr(case, field, value)
        return case

    def delete(self, case: CustomerCase) -> None:
        """Stage an existing case for deletion.

        Does not cascade-delete related conversations.
        """
        self.db.delete(case)

    def _apply_filters(
        self,
        stmt,
        *,
        search: str | None = None,
        customer_id: uuid.UUID | None = None,
        status: CaseStatus | None = None,
        priority: CasePriority | None = None,
    ):
        """Apply shared filtering logic used by both list and count."""
        if customer_id is not None:
            stmt = stmt.where(CustomerCase.customer_id == customer_id)
        if status is not None:
            stmt = stmt.where(CustomerCase.status == status)
        if priority is not None:
            stmt = stmt.where(CustomerCase.priority == priority)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    CustomerCase.case_number.ilike(pattern),
                    CustomerCase.subject.ilike(pattern),
                    CustomerCase.description.ilike(pattern),
                    # Category is a PostgreSQL enum; cast to text for ilike.
                    cast(CustomerCase.category, String).ilike(pattern),
                )
            )
        return stmt

    def list_cases(
        self,
        *,
        page: int,
        page_size: int,
        search: str | None = None,
        customer_id: uuid.UUID | None = None,
        status: CaseStatus | None = None,
        priority: CasePriority | None = None,
    ) -> tuple[list[CustomerCase], int]:
        """Return a page of cases and the total count matching the filters."""
        base_stmt = select(CustomerCase)
        base_stmt = self._apply_filters(
            base_stmt,
            search=search,
            customer_id=customer_id,
            status=status,
            priority=priority,
        )

        total = self.db.scalar(
            select(func.count()).select_from(base_stmt.subquery())
        ) or 0

        stmt = (
            base_stmt.order_by(CustomerCase.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.scalars(stmt).all())

        return items, total

    def count_cases(
        self,
        *,
        search: str | None = None,
        customer_id: uuid.UUID | None = None,
        status: CaseStatus | None = None,
        priority: CasePriority | None = None,
    ) -> int:
        """Return the total count of cases matching the same filters as list_cases."""
        stmt = select(func.count()).select_from(CustomerCase)
        stmt = self._apply_filters(
            stmt,
            search=search,
            customer_id=customer_id,
            status=status,
            priority=priority,
        )
        return self.db.scalar(stmt) or 0

    def has_related_conversations(self, case_id: uuid.UUID) -> bool:
        """Return True if the case has any related conversations."""
        stmt = (
            select(func.count())
            .select_from(Conversation)
            .where(Conversation.case_id == case_id)
        )
        return (self.db.scalar(stmt) or 0) > 0