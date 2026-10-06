import html
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from email.message import EmailMessage
import smtplib
from typing import Any

from fastapi import HTTPException, status

from app.config.settings import settings
from app.models.ai_analysis import AIAnalysis
from app.models.case import CustomerCase
from app.models.customer import Customer
from app.models.email_notification import EmailNotification
from app.models.enums import EmailStatus
from app.repositories.ai_analysis_repository import AIAnalysisRepository
from app.repositories.case_repository import CaseRepository
from app.repositories.customer_repository import CustomerRepository
from app.repositories.email_notification_repository import EmailNotificationRepository
from app.schemas.email_notification import EmailSendRequest, EmailSendResponse


class EmailProvider:
    def send(self, *, to_email: str, cc_emails: list[str], subject: str, html_body: str, text_body: str, case_id: uuid.UUID, ai_analysis_id: uuid.UUID) -> dict[str, Any]:
        raise NotImplementedError


class SMTPEmailProvider(EmailProvider):
    def __init__(self) -> None:
        self.host = settings.smtp_host or None
        self.port = settings.smtp_port or 587
        self.username = settings.smtp_username or None
        self.password = settings.smtp_password or None
        self.from_email = settings.smtp_from_email or None
        self.from_name = settings.smtp_from_name or "Conversation Intelligence"

    def send(self, *, to_email: str, cc_emails: list[str], subject: str, html_body: str, text_body: str, case_id: uuid.UUID, ai_analysis_id: uuid.UUID) -> dict[str, Any]:
        if not self.host or not self.from_email:
            raise ValueError("SMTP email provider is not configured.")

        msg = EmailMessage()
        msg["From"] = f"{self.from_name} <{self.from_email}>"
        msg["To"] = to_email
        if cc_emails:
            msg["CC"] = ", ".join(cc_emails)
        msg["Subject"] = subject
        msg.set_content(text_body)
        msg.add_alternative(html_body, subtype="html")

        with smtplib.SMTP(self.host, self.port) as smtp:
            if self.username:
                smtp.starttls()
                smtp.login(self.username, self.password or "")
            smtp.send_message(msg)

        message_id = msg.get("Message-ID") or None
        return {"provider_message_id": message_id}


def get_email_provider() -> EmailProvider:
    provider_name = (settings.email_provider or "smtp").lower()
    if provider_name == "smtp":
        return SMTPEmailProvider()
    raise ValueError(f"Unsupported email provider: {provider_name}")


@dataclass
class EmailTemplateContext:
    case_number: str
    customer_name: str
    customer_email: str | None
    category: str
    priority: str
    status: str
    summary: str
    issue: str | None
    recommended_action: str | None
    app_base_url: str
    case_id: str


class EmailNotificationService:
    def __init__(self, db):
        self.db = db
        self.case_repo = CaseRepository(db)
        self.customer_repo = CustomerRepository(db)
        self.ai_repo = AIAnalysisRepository(db)
        self.email_repo = EmailNotificationRepository(db)

    def get_latest_analysis_for_case(self, case_id: uuid.UUID) -> AIAnalysis | None:
        items, _ = self.ai_repo.list_by_case(case_id=case_id, page=1, page_size=1)
        return items[0] if items else None

    def _safe_error_message(self, exc: Exception) -> str:
        message = str(exc) or "Email provider failed"
        redacted = message.replace((settings.smtp_password or ""), "[REDACTED]")
        redacted = redacted.replace((settings.openrouter_api_key or ""), "[REDACTED]")
        return redacted[:1000]

    def _record_notification(self, *, case_id: uuid.UUID, ai_analysis_id: uuid.UUID, to_email: str, cc_emails: list[str], subject: str, status: EmailStatus, sent_by: str | None, provider_message_id: str | None, error_message: str | None, sent_at: datetime | None = None) -> EmailNotification:
        notification = EmailNotification(
            case_id=case_id,
            ai_analysis_id=ai_analysis_id,
            to_email=to_email,
            cc_emails=cc_emails,
            subject=subject,
            status=status,
            sent_by=sent_by,
            provider_message_id=provider_message_id,
            error_message=error_message,
            sent_at=sent_at or (datetime.now(timezone.utc) if status == EmailStatus.SENT else None),
        )
        self.email_repo.create(notification)
        try:
            self.db.commit()
            self.db.refresh(notification)
        except Exception:
            self.db.rollback()
            raise
        return notification

    def _render_text_email(self, ctx: EmailTemplateContext, html_body: str | None = None) -> str:
        lines = [
            "AI Conversation Intelligence",
            "",
            "AI Case Summary",
            "",
            f"Case: {ctx.case_number}",
            f"Customer: {ctx.customer_name}",
            f"Category: {ctx.category}",
            f"Priority: {ctx.priority}",
            f"Status: {ctx.status}",
            "",
            "AI Summary",
            ctx.summary,
            "",
            "Recommended Action",
            ctx.recommended_action or "No recommendation available.",
            "",
            f"View Case: {ctx.app_base_url}/cases/{ctx.case_id}",
            "",
            "This summary was generated using AI and should be reviewed for accuracy before taking action.",
            "Conversation Intelligence Platform",
        ]
        return "\n".join(lines)

    def _render_html_email(self, ctx: EmailTemplateContext) -> str:
        safe_summary = html.escape(ctx.summary or "")
        safe_recommendation = html.escape(ctx.recommended_action or "No recommendation available.")
        safe_issue = html.escape(ctx.issue or "")
        case_url = f"{ctx.app_base_url.rstrip('/')}/cases/{ctx.case_id}"
        return f"""
        <html>
          <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
            <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"> 
              <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:24px 32px;">
                <div style="font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#475569;font-weight:700;">AI Conversation Intelligence</div>
                <h1 style="margin:12px 0 0;color:#0f172a;font-size:28px;line-height:1.25;">AI Case Summary</h1>
              </div>
              <div style="padding:24px 32px 12px;">
                <p style="margin:0 0 18px;color:#475569;font-size:14px;line-height:1.6;">Below is a summary of the latest case activity and AI-generated analysis.</p>
                <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:14px;">
                  <tr><td style="padding:8px 0;color:#64748b;width:140px;">Case Number</td><td style="padding:8px 0;color:#0f172a;font-weight:600;">{html.escape(ctx.case_number)}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;">Customer</td><td style="padding:8px 0;color:#0f172a;font-weight:600;">{html.escape(ctx.customer_name)}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;">Category</td><td style="padding:8px 0;color:#0f172a;">{html.escape(ctx.category)}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;">Priority</td><td style="padding:8px 0;color:#0f172a;">{html.escape(ctx.priority)}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;">Status</td><td style="padding:8px 0;color:#0f172a;">{html.escape(ctx.status)}</td></tr>
                </table>

                <div style="margin-top:20px;">
                  <h2 style="margin:0 0 10px;font-size:18px;color:#0f172a;">AI Summary</h2>
                  <p style="margin:0;color:#334155;line-height:1.7;font-size:15px;">{safe_summary}</p>
                </div>

                <div style="margin-top:20px;">
                  <h2 style="margin:0 0 10px;font-size:18px;color:#0f172a;">Issue</h2>
                  <p style="margin:0;color:#334155;line-height:1.7;font-size:15px;">{safe_issue or 'No issue summary available.'}</p>
                </div>

                <div style="margin-top:20px;">
                  <h2 style="margin:0 0 10px;font-size:18px;color:#0f172a;">Recommended Action</h2>
                  <p style="margin:0;color:#334155;line-height:1.7;font-size:15px;">{safe_recommendation}</p>
                </div>

                <div style="margin-top:26px; text-align:center;">
                  <a href="{case_url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">View Case</a>
                </div>
              </div>
              <div style="padding:20px 32px 28px;color:#64748b;font-size:12px;line-height:1.6;border-top:1px solid #e2e8f0;background:#fafcff;">
                <p style="margin:0 0 6px;">This summary was generated using AI and should be reviewed for accuracy before taking action.</p>
                <p style="margin:0;">Conversation Intelligence Platform</p>
              </div>
            </div>
          </body>
        </html>
        """

    def send_summary_email(self, case_id: uuid.UUID, payload: EmailSendRequest, sent_by: str | None = None) -> EmailSendResponse:
        case = self.case_repo.get_by_id(case_id)
        if case is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found.")

        analysis = self.get_latest_analysis_for_case(case_id)
        if analysis is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI summary not found for this case.")

        customer = self.customer_repo.get_by_id(case.customer_id)
        if customer is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")

        subject = payload.subject.strip() or "AI Case Summary"
        cc_emails = [str(email).strip() for email in payload.cc_emails if str(email).strip()]
        to_email = str(payload.to_email).strip()
        case_url = f"{(settings.app_base_url or 'http://localhost:3000').rstrip('/')}/cases/{str(case_id)}"

        ctx = EmailTemplateContext(
            case_number=case.case_number,
            customer_name=customer.name,
            customer_email=customer.email,
            category=case.category.value,
            priority=case.priority.value,
            status=case.status.value,
            summary=analysis.summary,
            issue=analysis.issue,
            recommended_action=analysis.recommended_action,
            app_base_url=settings.app_base_url or "http://localhost:3000",
            case_id=str(case_id),
        )

        html_body = self._render_html_email(ctx)
        text_body = self._render_text_email(ctx)

        try:
            provider = get_email_provider()
            response = provider.send(
                to_email=to_email,
                cc_emails=cc_emails,
                subject=subject,
                html_body=html_body,
                text_body=text_body,
                case_id=case_id,
                ai_analysis_id=analysis.id,
            )
        except ValueError as exc:
            notification = self._record_notification(
                case_id=case_id,
                ai_analysis_id=analysis.id,
                to_email=to_email,
                cc_emails=cc_emails,
                subject=subject,
                status=EmailStatus.FAILED,
                sent_by=sent_by,
                provider_message_id=None,
                error_message=str(exc),
            )
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Email provider is not configured.") from exc
        except Exception as exc:
            self._record_notification(
                case_id=case_id,
                ai_analysis_id=analysis.id,
                to_email=to_email,
                cc_emails=cc_emails,
                subject=subject,
                status=EmailStatus.FAILED,
                sent_by=sent_by,
                provider_message_id=None,
                error_message=self._safe_error_message(exc),
            )
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Unable to send the AI summary email. Please try again.") from exc

        notification = self._record_notification(
            case_id=case_id,
            ai_analysis_id=analysis.id,
            to_email=to_email,
            cc_emails=cc_emails,
            subject=subject,
            status=EmailStatus.SENT,
            sent_by=sent_by,
            provider_message_id=(response or {}).get("provider_message_id"),
            error_message=None,
            sent_at=datetime.now(timezone.utc),
        )

        return EmailSendResponse(
            status="sent",
            message="AI summary email sent successfully.",
            email_id=notification.id,
            provider_message_id=notification.provider_message_id,
        )

    def list_history_for_case(self, case_id: uuid.UUID, page: int = 1, page_size: int = 20):
        if self.case_repo.get_by_id(case_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found.")
        items, total = self.email_repo.list_by_case(case_id=case_id, page=page, page_size=page_size)
        return items, total
