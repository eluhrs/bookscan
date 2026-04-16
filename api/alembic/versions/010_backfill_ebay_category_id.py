"""Backfill ebay_category_id to 261186 and set column default.

Revision ID: 010
Revises: 009
Create Date: 2026-04-16
"""
from alembic import op

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Backfill existing NULL rows to 261186 (Books)
    op.execute("UPDATE books SET ebay_category_id = 261186 WHERE ebay_category_id IS NULL")
    # Set default for new rows
    op.alter_column("books", "ebay_category_id", server_default="261186")


def downgrade() -> None:
    op.alter_column("books", "ebay_category_id", server_default=None)
