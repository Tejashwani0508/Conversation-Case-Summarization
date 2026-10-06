import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.enums import CasePriority, CaseStatus
from app.schemas.case import (
    CaseCreate,
    CaseListResponse,
    CaseResponse,
    CaseUpdate,
)
from app.schemas.email_notification import (
    EmailNotificationListResponse,
    EmailNotificationResponse,
    EmailSendRequest,
    EmailSendResponse,
)
from app.services.case_service import CaseService
from app.services.email_service import EmailNotificationService

router = APIRouter(prefix="/api/cases", tags=["Case Management"])

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 20


@router.post(
    "",
    response_model=CaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a case",
    description="Create a new customer case. The case_number is generated automatically by the backend.",
    responses={
        201: {"description": "Case created successfully"},
        404: {"description": "Customer not found"},
        422: {"description": "Validation error"},
    },
)
def create_case(
    payload: CaseCreate,
    db: Session = Depends(get_db),
) -> CaseResponse:
    service = CaseService(db)
    case = service.create_case(payload)
    return CaseResponse.model_validate(case)


@router.get(
    "",
    response_model=CaseListResponse,
    summary="List cases",
    description="List cases with pagination, search, and filters.",
    responses={
        200: {"description": "Paginated list of cases"},
    },
)
def list_cases(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(
        DEFAULT_PAGE_SIZE,
        ge=1,
        le=MAX_PAGE_SIZE,
        description="Number of items per page (max 100)",
    ),
    search: str | None = Query(
        None,
        description="Search across case_number, subject, description, and category",
    ),
    customer_id: uuid.UUID | None = Query(
        None,
        description="Filter by customer ID",
    ),
    status: CaseStatus | None = Query(
        None,
        description="Filter by case status",
    ),
    priority: CasePriority | None = Query(
        None,
        description="Filter by case priority",
    ),
    db: Session = Depends(get_db),
) -> CaseListResponse:
    service = CaseService(db)
    result = service.list_cases(
        page=page,
        page_size=page_size,
        search=search,
        customer_id=customer_id,
        status=status,
        priority=priority,
    )
    # The service returns a pagination dict. Build the response with
    # CaseResponse objects serialized from the ORM instances.
    return CaseListResponse(
        items=[CaseResponse.model_validate(c) for c in result["items"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
        total_pages=result["total_pages"],
    )


@router.get(
    "/number/{case_number}",
    response_model=CaseResponse,
    summary="Get a case by case number",
    description="Retrieve a single case by its unique case number (e.g. CASE-000001).",
    responses={
        200: {"description": "Case found"},
        404: {"description": "Case not found"},
    },
)
def get_case_by_number(
    case_number: str,
    db: Session = Depends(get_db),
) -> CaseResponse:
    service = CaseService(db)
    case = service.get_case_by_number(case_number)
    return CaseResponse.model_validate(case)


@router.get(
    "/{case_id}",
    response_model=CaseResponse,
    summary="Get a case by ID",
    description="Retrieve a single case by its UUID.",
    responses={
        200: {"description": "Case found"},
        404: {"description": "Case not found"},
    },
)
def get_case(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> CaseResponse:
    service = CaseService(db)
    case = service.get_case(case_id)
    return CaseResponse.model_validate(case)


@router.patch(
    "/{case_id}",
    response_model=CaseResponse,
    summary="Update a case",
    description="Update case fields. All fields are optional. id, case_number, customer_id, and created_at cannot be changed.",
    responses={
        200: {"description": "Case updated successfully"},
        404: {"description": "Case not found"},
        422: {"description": "Validation error"},
    },
)
def update_case(
    case_id: uuid.UUID,
    payload: CaseUpdate,
    db: Session = Depends(get_db),
) -> CaseResponse:
    service = CaseService(db)
    case = service.update_case(case_id, payload)
    return CaseResponse.model_validate(case)


@router.delete(
    "/{case_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a case",
    description="Delete a case. Fails with 409 if the case has related conversations.",
    responses={
        204: {"description": "Case deleted successfully"},
        404: {"description": "Case not found"},
        409: {"description": "Case has related conversations and cannot be deleted"},
    },
)
def delete_case(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> Response:
    service = CaseService(db)
    service.delete_case(case_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{case_id}/ai-summary/email",
    response_model=EmailSendResponse,
    summary="Send the latest AI summary email",
    description="Send the latest AI-generated summary for a case to the supplied recipient(s).",
    responses={
        200: {"description": "AI summary email sent successfully"},
        404: {"description": "Case or AI summary not found"},
        422: {"description": "Validation error"},
        502: {"description": "Email provider failed"},
        503: {"description": "Email provider not configured"},
    },
)
def send_case_summary_email(
    case_id: uuid.UUID,
    payload: EmailSendRequest,
    db: Session = Depends(get_db),
) -> EmailSendResponse:
    service = EmailNotificationService(db)
    return service.send_summary_email(case_id, payload, sent_by="user")


@router.get(
    "/{case_id}/email-history",
    response_model=EmailNotificationListResponse,
    summary="Get email activity for a case",
    description="Return a paginated activity log of email notifications for the case.",
    responses={
        200: {"description": "Email history returned successfully"},
        404: {"description": "Case not found"},
    },
)
def get_case_email_history(
    case_id: uuid.UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(
        20,
        ge=1,
        le=100,
        description="Number of items per page",
    ),
    db: Session = Depends(get_db),
) -> EmailNotificationListResponse:
    service = EmailNotificationService(db)
    items, total = service.list_history_for_case(case_id, page=page, page_size=page_size)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return EmailNotificationListResponse(
        items=[EmailNotificationResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )