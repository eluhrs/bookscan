"""add description_source, needs_description_review, description_generation_failed

Revision ID: 007
Revises: 006
Create Date: 2026-04-14
"""
from alembic import op
import sqlalchemy as sa


revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "books",
        sa.Column("description_source", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "books",
        sa.Column(
            "needs_description_review",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "books",
        sa.Column(
            "description_generation_failed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("books", "description_generation_failed")
    op.drop_column("books", "needs_description_review")
    op.drop_column("books", "description_source")
