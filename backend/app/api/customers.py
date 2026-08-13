import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.schemas.customer import (
    CustomerCreate,
    CustomerListResponse,
    CustomerResponse,
    CustomerUpdate,
)
from app.services.customer_service import CustomerService

router = APIRouter(prefix="/api/customers", tags=["Customer Management"])

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 20


@router.post(
    "",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a customer",
    description="Create a new customer. The customer_code is generated automatically by the backend.",
    responses={
        201: {"description": "Customer created successfully"},
        409: {"description": "Account number already exists"},
        422: {"description": "Validation error"},
    },
)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
) -> CustomerResponse:
    service = CustomerService(db)
    customer = service.create_customer(payload)
    return CustomerResponse.model_validate(customer)


@router.get(
    "",
    response_model=CustomerListResponse,
    summary="List customers",
    description="List customers with pagination, search, and sorting.",
    responses={
        200: {"description": "Paginated list of customers"},
    },
)
def list_customers(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(
        DEFAULT_PAGE_SIZE,
        ge=1,
        le=MAX_PAGE_SIZE,
        description="Number of items per page (max 100)",
    ),
    search: str | None = Query(
        None,
        description="Search across customer_code, name, email, phone, account_number",
    ),
    db: Session = Depends(get_db),
) -> CustomerListResponse:
    service = CustomerService(db)
    items, total = service.list_customers(
        page=page,
        page_size=page_size,
        search=search,
    )
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return CustomerListResponse(
        items=[CustomerResponse.model_validate(c) for c in items],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Get a customer by ID",
    description="Retrieve a single customer by its UUID.",
    responses={
        200: {"description": "Customer found"},
        404: {"description": "Customer not found"},
    },
)
def get_customer(
    customer_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> CustomerResponse:
    service = CustomerService(db)
    customer = service.get_customer(customer_id)
    return CustomerResponse.model_validate(customer)


@router.put(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Update a customer",
    description="Update customer fields. All fields are optional. customer_code and id cannot be changed.",
    responses={
        200: {"description": "Customer updated successfully"},
        404: {"description": "Customer not found"},
        409: {"description": "Account number conflicts with another customer"},
        422: {"description": "Validation error"},
    },
)
def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
) -> CustomerResponse:
    service = CustomerService(db)
    customer = service.update_customer(customer_id, payload)
    return CustomerResponse.model_validate(customer)


@router.delete(
    "/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a customer",
    description="Delete a customer. Fails with 409 if the customer has related cases.",
    responses={
        204: {"description": "Customer deleted successfully"},
        404: {"description": "Customer not found"},
        409: {"description": "Customer has related cases and cannot be deleted"},
    },
)
def delete_customer(
    customer_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> Response:
    service = CustomerService(db)
    service.delete_customer(customer_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)