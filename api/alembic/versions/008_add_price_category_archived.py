"""add price, ebay_category_id, ebay_category_name, archived

Revision ID: 008
Revises: 007
Create Date: 2026-04-15
"""
from alembic import op
import sqlalchemy as sa


revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "books",
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=True),
    )
    op.add_column(
        "books",
        sa.Column("ebay_category_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "books",
        sa.Column("ebay_category_name", sa.String(), nullable=True),
    )
    op.add_column(
        "books",
        sa.Column(
            "archived",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("books", "archived")
    op.drop_column("books", "ebay_category_name")
    op.drop_column("books", "ebay_category_id")
    op.drop_column("books", "price")
