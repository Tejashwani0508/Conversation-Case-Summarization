import uuid

from app.models import CustomerCase
from app.models.enums import CaseCategory, CasePriority, CaseStatus


def _create_customer_payload(**overrides):
    payload = {
        "name": "Rajesh Kumar",
        "email": "rajesh@example.com",
        "phone": "9876543210",
        "account_number": "ACC10001",
        "address": "Hyderabad",
    }
    payload.update(overrides)
    return payload


def test_create_customer_successfully(client, clean_tables):
    response = client.post("/api/customers", json=_create_customer_payload())
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Rajesh Kumar"
    assert data["email"] == "rajesh@example.com"
    assert data["phone"] == "9876543210"
    assert data["account_number"] == "ACC10001"
    assert data["address"] == "Hyderabad"
    assert data["customer_code"] == "CUS-000001"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_customer_duplicate_account_number(client, clean_tables):
    client.post("/api/customers", json=_create_customer_payload())
    response = client.post("/api/customers", json=_create_customer_payload())
    assert response.status_code == 409
    assert "account number" in response.json()["detail"].lower()


def test_get_customer_by_id(client, clean_tables):
    created = client.post("/api/customers", json=_create_customer_payload()).json()
    response = client.get(f"/api/customers/{created['id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == created["id"]
    assert data["name"] == "Rajesh Kumar"


def test_get_non_existing_customer(client, clean_tables):
    response = client.get(f"/api/customers/{uuid.uuid4()}")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_list_customers(client, clean_tables):
    for i in range(3):
        client.post(
            "/api/customers",
            json=_create_customer_payload(
                name=f"Customer {i}",
                account_number=f"ACC{i:05d}",
            ),
        )
    response = client.get("/api/customers")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert data["page"] == 1
    assert data["page_size"] == 20
    assert data["total_pages"] == 1
    assert len(data["items"]) == 3


def test_search_customers(client, clean_tables):
    client.post(
        "/api/customers",
        json=_create_customer_payload(name="Alice", account_number="ACC10001"),
    )
    client.post(
        "/api/customers",
        json=_create_customer_payload(name="Bob", account_number="ACC10002"),
    )
    response = client.get("/api/customers", params={"search": "Alice"})
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Alice"


def test_pagination(client, clean_tables):
    for i in range(5):
        client.post(
            "/api/customers",
            json=_create_customer_payload(
                name=f"Customer {i}",
                account_number=f"ACC{i:05d}",
            ),
        )
    response = client.get("/api/customers", params={"page": 1, "page_size": 2})
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 5
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert data["total_pages"] == 3
    assert len(data["items"]) == 2


def test_update_customer(client, clean_tables):
    created = client.post("/api/customers", json=_create_customer_payload()).json()
    response = client.put(
        f"/api/customers/{created['id']}",
        json={"name": "Updated Name", "phone": "1111111111"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["phone"] == "1111111111"
    assert data["customer_code"] == created["customer_code"]


def test_update_customer_duplicate_account_number(client, clean_tables):
    client.post(
        "/api/customers",
        json=_create_customer_payload(account_number="ACC10001"),
    )
    second = client.post(
        "/api/customers",
        json=_create_customer_payload(account_number="ACC10002"),
    ).json()
    response = client.put(
        f"/api/customers/{second['id']}",
        json={"account_number": "ACC10001"},
    )
    assert response.status_code == 409
    assert "account number" in response.json()["detail"].lower()


def test_delete_customer_without_cases(client, clean_tables):
    created = client.post("/api/customers", json=_create_customer_payload()).json()
    response = client.delete(f"/api/customers/{created['id']}")
    assert response.status_code == 204
    # Verify it's gone.
    get_response = client.get(f"/api/customers/{created['id']}")
    assert get_response.status_code == 404


def test_delete_customer_with_cases(client, clean_tables, db_session):
    created = client.post("/api/customers", json=_create_customer_payload()).json()
    # Create a related case directly in the DB.
    case = CustomerCase(
        case_number="CASE-000001",
        customer_id=uuid.UUID(created["id"]),
        subject="Billing issue",
        category=CaseCategory.BILLING,
        status=CaseStatus.OPEN,
        priority=CasePriority.MEDIUM,
    )
    db_session.add(case)
    db_session.commit()

    response = client.delete(f"/api/customers/{created['id']}")
    assert response.status_code == 409
    assert "related cases" in response.json()["detail"].lower()


def test_validation_errors(client, clean_tables):
    # Missing required fields.
    response = client.post("/api/customers", json={"name": "No Account"})
    assert response.status_code == 422

    # Invalid email.
    response = client.post(
        "/api/customers",
        json=_create_customer_payload(email="not-an-email"),
    )
    assert response.status_code == 422

    # Empty name.
    response = client.post(
        "/api/customers",
        json=_create_customer_payload(name=""),
    )
    assert response.status_code == 422