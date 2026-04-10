"""drop subject column from books

Revision ID: 005
Revises: 004
Create Date: 2026-04-09
"""
from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("books", "subject")


def downgrade() -> None:
    import sqlalchemy as sa
    op.add_column("books", sa.Column("subject", sa.Text, nullable=True))
