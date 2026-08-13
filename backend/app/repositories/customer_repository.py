import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.customer import Customer


class CustomerRepository:
    """Data access layer for Customer records."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, customer_id: uuid.UUID) -> Customer | None:
        return self.db.get(Customer, customer_id)

    def get_by_account_number(self, account_number: str) -> Customer | None:
        stmt = select(Customer).where(Customer.account_number == account_number)
        return self.db.scalar(stmt)

    def get_by_customer_code(self, customer_code: str) -> Customer | None:
        stmt = select(Customer).where(Customer.customer_code == customer_code)
        return self.db.scalar(stmt)

    def get_latest_customer_code(self) -> str | None:
        """Return the highest customer_code currently in the table."""
        stmt = select(func.max(Customer.customer_code))
        return self.db.scalar(stmt)

    def list_customers(
        self,
        *,
        page: int,
        page_size: int,
        search: str | None = None,
    ) -> tuple[list[Customer], int]:
        """Return a page of customers and the total count matching the filters."""
        base_stmt = select(Customer)

        if search:
            pattern = f"%{search}%"
            base_stmt = base_stmt.where(
                or_(
                    Customer.customer_code.ilike(pattern),
                    Customer.name.ilike(pattern),
                    Customer.email.ilike(pattern),
                    Customer.phone.ilike(pattern),
                    Customer.account_number.ilike(pattern),
                )
            )

        total = self.db.scalar(
            select(func.count()).select_from(base_stmt.subquery())
        ) or 0

        stmt = (
            base_stmt.order_by(Customer.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.scalars(stmt).all())

        return items, total

    def add(self, customer: Customer) -> Customer:
        self.db.add(customer)
        return customer

    def delete(self, customer: Customer) -> None:
        self.db.delete(customer)