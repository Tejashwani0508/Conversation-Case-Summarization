import uuid
from math import ceil

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.base import utc_now
from app.models.case import CustomerCase
from app.models.enums import CasePriority, CaseStatus
from app.repositories.case_repository import CaseRepository
from app.repositories.customer_repository import CustomerRepository
from app.schemas.case import CaseCreate, CaseUpdate

CASE_NUMBER_PREFIX = "CASE-"
CASE_NUMBER_PADDING = 6

MAX_PAGE_SIZE = 100


def _generate_case_number(db: Session) -> str:
    """Generate the next sequential case number (e.g. CASE-000001).

    Mirrors the CustomerService code-generation pattern. The unique
    constraint on ``case_number`` provides a final safety net against
    concurrent races for the current MVP.
    """
    latest = db.scalar(select(func.max(CustomerCase.case_number)))
    if latest is None:
        next_number = 1
    else:
        try:
            next_number = int(latest.split("-")[-1]) + 1
        except (ValueError, IndexError):
            next_number = 1
    return f"{CASE_NUMBER_PREFIX}{next_number:0{CASE_NUMBER_PADDING}d}"


def _apply_resolved_at_logic(case: CustomerCase, update_data: dict) -> None:
    """Set or clear ``resolved_at`` based on the target status.

    - RESOLVED        -> set resolved_at to now
    - CLOSED          -> set resolved_at if it is not already set
    - OPEN/IN_PROGRESS-> clear resolved_at
    """
    if "status" not in update_data:
        return
    new_status = update_data["status"]
    if new_status == CaseStatus.RESOLVED:
        case.resolved_at = utc_now()
    elif new_status == CaseStatus.CLOSED and case.resolved_at is None:
        case.resolved_at = utc_now()
    elif new_status in (CaseStatus.OPEN, CaseStatus.IN_PROGRESS):
        case.resolved_at = None


class CaseService:
    """Business logic for Case operations."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = CaseRepository(db)
        self.customer_repo = CustomerRepository(db)

    def create_case(self, payload: CaseCreate) -> CustomerCase:
        # Verify the referenced customer exists.
        if self.customer_repo.get_by_id(payload.customer_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found.",
            )

        case = CustomerCase(
            case_number=_generate_case_number(self.db),
            customer_id=payload.customer_id,
            subject=payload.subject,
            description=payload.description,
            category=payload.category,
            priority=payload.priority or CasePriority.MEDIUM,
            assigned_agent=payload.assigned_agent,
        )

        try:
            self.repo.create(case)
            self.db.commit()
            self.db.refresh(case)
        except Exception:
            self.db.rollback()
            raise

        return case

    def get_case(self, case_id: uuid.UUID) -> CustomerCase:
        case = self.repo.get_by_id(case_id)
        if case is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Case not found.",
            )
        return case

    def get_case_by_number(self, case_number: str) -> CustomerCase:
        case = self.repo.get_by_case_number(case_number)
        if case is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Case not found.",
            )
        return case

    def list_cases(
        self,
        *,
        page: int,
        page_size: int,
        search: str | None = None,
        customer_id: uuid.UUID | None = None,
        status: CaseStatus | None = None,
        priority: CasePriority | None = None,
    ) -> dict:
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

        items, total = self.repo.list_cases(
            page=page,
            page_size=page_size,
            search=search,
            customer_id=customer_id,
            status=status,
            priority=priority,
        )
        total_pages = ceil(total / page_size) if total > 0 else 0
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }

    def update_case(self, case_id: uuid.UUID, payload: CaseUpdate) -> CustomerCase:
        case = self.get_case(case_id)

        update_data = payload.model_dump(exclude_unset=True)

        # Apply resolved_at logic based on the status change (if any).
        _apply_resolved_at_logic(case, update_data)

        for field, value in update_data.items():
            setattr(case, field, value)

        try:
            self.db.commit()
            self.db.refresh(case)
        except Exception:
            self.db.rollback()
            raise

        return case

    def delete_case(self, case_id: uuid.UUID) -> None:
        case = self.get_case(case_id)

        if self.repo.has_related_conversations(case_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Case cannot be deleted because related conversations exist.",
            )

        try:
            self.repo.delete(case)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise