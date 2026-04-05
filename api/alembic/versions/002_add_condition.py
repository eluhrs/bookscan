"""add condition to books

Revision ID: 002
Create Date: 2026-04-04
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("books", sa.Column("condition", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("books", "condition")
