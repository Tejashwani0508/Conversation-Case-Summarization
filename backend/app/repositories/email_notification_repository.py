import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.email_notification import EmailNotification


class EmailNotificationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, notification: EmailNotification) -> EmailNotification:
        self.db.add(notification)
        return notification

    def get_by_id(self, notification_id: uuid.UUID) -> EmailNotification | None:
        return self.db.get(EmailNotification, notification_id)

    def list_by_case(self, *, case_id: uuid.UUID, page: int, page_size: int) -> tuple[list[EmailNotification], int]:
        base_stmt = select(EmailNotification).where(EmailNotification.case_id == case_id)
        total = self.db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
        stmt = (
            base_stmt.order_by(EmailNotification.created_at.desc(), EmailNotification.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.scalars(stmt).all())
        return items, total
