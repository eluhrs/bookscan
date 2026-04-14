"""replace data_complete with needs_metadata_review

Revision ID: 006
Revises: 005
Create Date: 2026-04-14
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "books",
        sa.Column(
            "needs_metadata_review",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.execute("UPDATE books SET needs_metadata_review = NOT data_complete")
    op.drop_column("books", "data_complete")


def downgrade() -> None:
    op.add_column(
        "books",
        sa.Column(
            "data_complete",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.execute("UPDATE books SET data_complete = NOT needs_metadata_review")
    op.drop_column("books", "needs_metadata_review")
