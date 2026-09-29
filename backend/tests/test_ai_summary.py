import uuid
from types import SimpleNamespace
from unittest.mock import patch

from app.models.ai_analysis import AIAnalysis
from app.models.ai_run import AIAnalysisRun
from app.models.case import CustomerCase
from app.models.conversation import Conversation
from app.models.customer import Customer
from app.models.enums import AIAnalysisRunStatus, CaseCategory, CasePriority, CaseStatus, ConversationChannel, SenderType
from app.services.ai_provider import OPENROUTER_BASE_URL, OpenRouterProvider


def _create_customer(db_session):
    customer = Customer(
        customer_code="CUST90001",
        name="Sneha Iyer",
        email="sneha@example.com",
        phone="9876543210",
        account_number="ACC90001",
        address="Hyderabad",
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    return customer


def _create_case(db_session, customer_id):
    case = CustomerCase(
        case_number="CASE-000099",
        customer_id=customer_id,
        subject="Login issue after password reset",
        description="Customer cannot log in after reset.",
        category=CaseCategory.ACCOUNT_UPDATE,
        status=CaseStatus.OPEN,
        priority=CasePriority.HIGH,
    )
    db_session.add(case)
    db_session.commit()
    db_session.refresh(case)
    return case


def test_summarize_case_without_openrouter_key_returns_502_and_failed_run(
    client, clean_tables, db_session, monkeypatch
):
    from app.config.settings import settings

    monkeypatch.setattr(settings, "openrouter_api_key", None)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    customer = _create_customer(db_session)
    case = _create_case(db_session, customer.id)

    db_session.add(
        Conversation(
            case_id=case.id,
            sender_type=SenderType.CUSTOMER,
            sender_name="Sneha Iyer",
            message="I reset my password yesterday but now I can't log in at all. The new password keeps getting rejected.",
            timestamp="2026-09-01T10:00:00+00:00",
            channel=ConversationChannel.EMAIL,
        )
    )
    db_session.add(
        Conversation(
            case_id=case.id,
            sender_type=SenderType.AGENT,
            sender_name="Priya Nair",
            message="I understand your concern. Let me check your account status and verify the password reset flow.",
            timestamp="2026-09-01T10:05:00+00:00",
            channel=ConversationChannel.EMAIL,
        )
    )
    db_session.commit()

    response = client.post(f"/api/cases/{case.id}/summarize")

    assert response.status_code == 502
    assert "AI provider failed" in response.json()["detail"]
    assert db_session.query(AIAnalysis).filter_by(case_id=case.id).count() == 0

    runs = db_session.query(AIAnalysisRun).filter_by(case_id=case.id).all()
    assert len(runs) == 1
    assert runs[0].status == AIAnalysisRunStatus.FAILED
    assert runs[0].error_message


def test_openrouter_provider_uses_configured_endpoint_and_parses_fenced_json():
    content = (
        '```json\n{"summary":"Generated summary","issue":"Billing question",'
        '"category":"BILLING","sentiment":"CONCERNED","sentiment_score":0.8,'
        '"ai_priority":"HIGH","key_details":[],"actions_taken":[],'
        '"pending_actions":[],"recommended_action":"Review the account"}\n```'
    )
    with patch("app.services.ai_provider.OpenAI") as openai:
        openai.return_value.chat.completions.create.return_value = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
        )
        provider = OpenRouterProvider(api_key="test-key", model="openrouter/free")
        result = provider.summarize_conversation(["test conversation"])

    assert openai.call_args.kwargs["base_url"] == OPENROUTER_BASE_URL
    assert openai.return_value.chat.completions.create.call_args.kwargs["model"] == "openrouter/free"
    assert result.summary == "Generated summary"
