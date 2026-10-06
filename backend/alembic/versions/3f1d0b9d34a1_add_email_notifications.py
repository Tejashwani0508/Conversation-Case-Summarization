"""add email notifications

Revision ID: 3f1d0b9d34a1
Revises: c5d6e7f8a9b0
Create Date: 2026-10-05 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM


# revision identifiers, used by Alembic.
revision: str = "3f1d0b9d34a1"
down_revision: Union[str, Sequence[str], None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    email_status = ENUM("PENDING", "SENT", "FAILED", name="email_notification_status", create_type=False)

    result = bind.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = :enum_name)"
        ),
        {"enum_name": "email_notification_status"},
    ).scalar()
    if not result:
        email_status.create(bind, checkfirst=True)

    if not bind.dialect.has_table(bind, "email_notifications"):
        op.create_table(
            "email_notifications",
            sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("case_id", sa.UUID(as_uuid=True), nullable=False),
            sa.Column("ai_analysis_id", sa.UUID(as_uuid=True), nullable=False),
            sa.Column("to_email", sa.String(length=255), nullable=False),
            sa.Column("cc_emails", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column("subject", sa.String(length=255), nullable=False),
            sa.Column("status", email_status, nullable=False, server_default="PENDING"),
            sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("sent_by", sa.String(length=255), nullable=True),
            sa.Column("provider_message_id", sa.String(length=255), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["case_id"], ["customer_cases.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["ai_analysis_id"], ["ai_analysis.id"], ondelete="RESTRICT"),
        )

    if not bind.dialect.has_index(bind, "email_notifications", "ix_email_notifications_case_id"):
        op.create_index(op.f("ix_email_notifications_case_id"), "email_notifications", ["case_id"], unique=False)
    if not bind.dialect.has_index(bind, "email_notifications", "ix_email_notifications_ai_analysis_id"):
        op.create_index(op.f("ix_email_notifications_ai_analysis_id"), "email_notifications", ["ai_analysis_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_email_notifications_ai_analysis_id"), table_name="email_notifications")
    op.drop_index(op.f("ix_email_notifications_case_id"), table_name="email_notifications")
    op.drop_table("email_notifications")

    email_status = sa.Enum(name="email_notification_status")
    email_status.drop(op.get_bind(), checkfirst=True)
