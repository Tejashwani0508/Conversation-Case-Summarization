"""add assigned_agent to customer_cases

Revision ID: c5d6e7f8a9b0
Revises: 383ffe6f31d2
Create Date: 2026-08-12 16:33:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5d6e7f8a9b0'
down_revision: Union[str, Sequence[str], None] = '383ffe6f31d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'customer_cases',
        sa.Column('assigned_agent', sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('customer_cases', 'assigned_agent')