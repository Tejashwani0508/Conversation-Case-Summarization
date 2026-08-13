import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.repositories.customer_repository import CustomerRepository
from app.schemas.customer import CustomerCreate, CustomerUpdate

CUSTOMER_CODE_PREFIX = "CUS-"
CUSTOMER_CODE_PADDING = 6


def _generate_customer_code(repo: CustomerRepository) -> str:
    """Generate the next sequential customer code (e.g. CUS-000001).

    Uses the highest existing code to derive the next number. The unique
    constraint on customer_code provides a final safety net against races.
    """
    latest = repo.get_latest_customer_code()
    if latest is None:
        next_number = 1
    else:
        try:
            next_number = int(latest.split("-")[-1]) + 1
        except (ValueError, IndexError):
            next_number = 1
    return f"{CUSTOMER_CODE_PREFIX}{next_number:0{CUSTOMER_CODE_PADDING}d}"


class CustomerService:
    """Business logic for Customer operations."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = CustomerRepository(db)

    def create_customer(self, payload: CustomerCreate) -> Customer:
        # Ensure account_number is unique.
        if self.repo.get_by_account_number(payload.account_number):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A customer with this account number already exists.",
            )

        customer = Customer(
            customer_code=_generate_customer_code(self.repo),
            name=payload.name,
            email=payload.email,
            phone=payload.phone,
            account_number=payload.account_number,
            address=payload.address,
        )

        try:
            self.repo.add(customer)
            self.db.commit()
            self.db.refresh(customer)
        except Exception:
            self.db.rollback()
            raise

        return customer

    def get_customer(self, customer_id: uuid.UUID) -> Customer:
        customer = self.repo.get_by_id(customer_id)
        if customer is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found.",
            )
        return customer

    def list_customers(
        self,
        *,
        page: int,
        page_size: int,
        search: str | None = None,
    ) -> tuple[list[Customer], int]:
        items, total = self.repo.list_customers(
            page=page,
            page_size=page_size,
            search=search,
        )
        return items, total

    def update_customer(
        self, customer_id: uuid.UUID, payload: CustomerUpdate
    ) -> Customer:
        customer = self.get_customer(customer_id)

        # If account_number is being changed, ensure it doesn't conflict.
        if payload.account_number is not None and payload.account_number != customer.account_number:
            existing = self.repo.get_by_account_number(payload.account_number)
            if existing is not None and existing.id != customer.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A customer with this account number already exists.",
                )

        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(customer, field, value)

        try:
            self.db.commit()
            self.db.refresh(customer)
        except Exception:
            self.db.rollback()
            raise

        return customer

    def delete_customer(self, customer_id: uuid.UUID) -> None:
        customer = self.get_customer(customer_id)

        # Safe deletion: refuse if related cases exist.
        if customer.cases:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Customer cannot be deleted because related cases exist.",
            )

        try:
            self.repo.delete(customer)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise