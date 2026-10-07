from app.models.case import CustomerCase
from app.models.customer import Customer
from app.models.enums import CaseCategory, CasePriority, CaseStatus


def _create_case(db_session):
    customer = Customer(
        customer_code="CUSTCASE01",
        name="Case Update Customer",
        email="case-update@example.com",
        phone="5551234567",
        account_number="ACCCASE01",
        address="Test address",
    )
    db_session.add(customer)
    db_session.flush()
    case = CustomerCase(
        case_number="CASE-UPDATE-01",
        customer_id=customer.id,
        subject="Case update test",
        description="",
        category=CaseCategory.OTHER,
        status=CaseStatus.OPEN,
        priority=CasePriority.MEDIUM,
    )
    db_session.add(case)
    db_session.commit()
    db_session.refresh(case)
    return case


def test_patch_case_updates_status_priority_and_resolved_at(client, clean_tables, db_session):
    case = _create_case(db_session)

    response = client.patch(
        f"/api/cases/{case.id}",
        json={"status": "RESOLVED", "priority": "CRITICAL"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "RESOLVED"
    assert response.json()["priority"] == "CRITICAL"
    assert response.json()["resolved_at"] is not None

    reopened = client.patch(f"/api/cases/{case.id}", json={"status": "OPEN"})
    assert reopened.status_code == 200
    assert reopened.json()["resolved_at"] is None


def test_patch_case_rejects_invalid_status_and_priority(client, clean_tables, db_session):
    case = _create_case(db_session)

    invalid_status = client.patch(f"/api/cases/{case.id}", json={"status": "WAITING"})
    invalid_priority = client.patch(f"/api/cases/{case.id}", json={"priority": "URGENT"})

    assert invalid_status.status_code == 422
    assert invalid_priority.status_code == 422