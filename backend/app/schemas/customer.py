import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CustomerCreate(BaseModel):
    """Payload for creating a new customer."""

    name: str = Field(..., min_length=1, max_length=255, description="Customer full name")
    email: EmailStr | None = Field(None, max_length=255, description="Customer email address")
    phone: str | None = Field(None, max_length=50, description="Customer phone number")
    account_number: str = Field(
        ..., min_length=1, max_length=50, description="Unique customer account number"
    )
    address: str | None = Field(None, description="Customer address")


class CustomerUpdate(BaseModel):
    """Payload for updating a customer. All fields are optional."""

    name: str | None = Field(None, min_length=1, max_length=255, description="Customer full name")
    email: EmailStr | None = Field(None, max_length=255, description="Customer email address")
    phone: str | None = Field(None, max_length=50, description="Customer phone number")
    account_number: str | None = Field(
        None, min_length=1, max_length=50, description="Unique customer account number"
    )
    address: str | None = Field(None, description="Customer address")


class CustomerResponse(BaseModel):
    """Customer representation returned by the API."""

    id: uuid.UUID
    customer_code: str
    name: str
    email: str | None
    phone: str | None
    account_number: str
    address: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerListResponse(BaseModel):
    """Paginated list of customers."""

    items: list[CustomerResponse]
    page: int
    page_size: int
    total: int
    total_pages: int