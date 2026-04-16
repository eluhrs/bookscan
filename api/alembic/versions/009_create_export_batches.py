"""create export_batches table

Revision ID: 009
Revises: 008
Create Date: 2026-04-16
"""
from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "export_batches",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "exported_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("book_ids", sa.JSON(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("export_batches")
