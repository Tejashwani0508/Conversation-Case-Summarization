import uuid

from app.models.ai_analysis import AIAnalysis
from app.models.case import CustomerCase
from app.models.customer import Customer
from app.models.email_notification import EmailNotification
from app.models.enums import CaseCategory, CasePriority, CaseStatus, EmailStatus


def _create_customer(db_session):
    customer = Customer(
        customer_code="CUST99901",
        name="Arjun Reddy",
        email="arjun@example.com",
        phone="9876543210",
        account_number="ACC99901",
        address="Hyderabad",
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    return customer


def _create_case(db_session, customer_id):
    case = CustomerCase(
        case_number="CASE-000002",
        customer_id=customer_id,
        subject="Billing issue")
    case.description = "Customer reporting repeated billing errors."
    case.category = CaseCategory.BILLING
    case.status = CaseStatus.RESOLVED
    case.priority = CasePriority.CRITICAL
    db_session.add(case)
    db_session.commit()
    db_session.refresh(case)
    return case


def _create_analysis(db_session, case_id):
    analysis = AIAnalysis(
        case_id=case_id,
        summary="Customer is billing dispute resolved.",
        issue="Duplicate invoice charges",
        category=CaseCategory.BILLING,
        sentiment="CONCERNED",
        ai_priority=CasePriority.CRITICAL,
        key_details=["Duplicate charge"],
        actions_taken=["Escalated to billing team"],
        pending_actions=["Review final invoice"],
        recommended_action="Review invoice correction.",
        model_name="openrouter/free",
        prompt_version="v1",
    )
    db_session.add(analysis)
    db_session.commit()
    db_session.refresh(analysis)
    return analysis


def test_send_ai_summary_email_successfully_records_activity(client, clean_tables, db_session, monkeypatch):
    customer = _create_customer(db_session)
    case = _create_case(db_session, customer.id)
    analysis = _create_analysis(db_session, case.id)

    class DummyEmailProvider:
        def __init__(self):
            self.sent = []

        def send(self, *, to_email, cc_emails, subject, html_body, text_body, case_id, ai_analysis_id):
            self.sent.append({
                "to_email": to_email,
                "cc_emails": cc_emails,
                "subject": subject,
                "case_id": case_id,
                "ai_analysis_id": ai_analysis_id,
            })
            return {"provider_message_id": "msg-123"}

    provider = DummyEmailProvider()
    monkeypatch.setattr("app.services.email_service.get_email_provider", lambda: provider)

    response = client.post(
        f"/api/cases/{case.id}/ai-summary/email",
        json={
            "to_email": "manager@example.com",
            "cc_emails": ["ops@example.com"],
            "subject": "AI Case Summary — CASE-000002",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "sent"
    assert payload["message"] == "AI summary email sent successfully."
    record = db_session.query(EmailNotification).filter_by(case_id=case.id).one()
    assert record.status == EmailStatus.SENT
    assert record.provider_message_id == "msg-123"
    assert record.to_email == "manager@example.com"


def test_send_ai_summary_email_case_not_found(client, clean_tables):
    missing_case_id = uuid.uuid4()
    response = client.post(
        f"/api/cases/{missing_case_id}/ai-summary/email",
        json={"to_email": "manager@example.com", "cc_emails": [], "subject": "AI Summary"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Case not found."


def test_send_ai_summary_email_requires_valid_ai_summary(client, clean_tables, db_session):
    customer = _create_customer(db_session)
    case = _create_case(db_session, customer.id)

    response = client.post(
        f"/api/cases/{case.id}/ai-summary/email",
        json={"to_email": "manager@example.com", "cc_emails": [], "subject": "AI Summary"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "AI summary not found for this case."


def test_send_ai_summary_email_validates_recipient(client, clean_tables, db_session):
    customer = _create_customer(db_session)
    case = _create_case(db_session, customer.id)
    _create_analysis(db_session, case.id)

    response = client.post(
        f"/api/cases/{case.id}/ai-summary/email",
        json={"to_email": "not-an-email", "cc_emails": [], "subject": "AI Summary"},
    )

    assert response.status_code == 422


def test_send_ai_summary_email_records_failed_provider_response(client, clean_tables, db_session, monkeypatch):
    customer = _create_customer(db_session)
    case = _create_case(db_session, customer.id)
    _create_analysis(db_session, case.id)

    class FailingEmailProvider:
        def send(self, **kwargs):
            raise RuntimeError("SMTP authentication failed")

    monkeypatch.setattr("app.services.email_service.get_email_provider", lambda: FailingEmailProvider())

    response = client.post(
        f"/api/cases/{case.id}/ai-summary/email",
        json={"to_email": "manager@example.com", "cc_emails": [], "subject": "AI Summary"},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "Unable to send the AI summary email. Please try again."
    record = db_session.query(EmailNotification).filter_by(case_id=case.id).one()
    assert record.status == EmailStatus.FAILED
    assert "SMTP authentication failed" not in record.error_message


def test_get_email_history_for_case_returns_records(client, clean_tables, db_session):
    customer = _create_customer(db_session)
    case = _create_case(db_session, customer.id)
    analysis = _create_analysis(db_session, case.id)

    record = EmailNotification(
        case_id=case.id,
        ai_analysis_id=analysis.id,
        to_email="manager@example.com",
        cc_emails=["ops@example.com"],
        subject="AI Case Summary",
        status=EmailStatus.SENT,
        sent_by="user@example.com",
        provider_message_id="msg-456",
        error_message=None,
    )
    db_session.add(record)
    db_session.commit()

    response = client.get(f"/api/cases/{case.id}/email-history")

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0]["to_email"] == "manager@example.com"
    assert payload["items"][0]["status"] == "SENT"
