"""initial schema

Revision ID: 001
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "books",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("isbn", sa.String(20), unique=True, index=True, nullable=False),
        sa.Column("title", sa.Text),
        sa.Column("author", sa.Text),
        sa.Column("publisher", sa.Text),
        sa.Column("edition", sa.String(100)),
        sa.Column("year", sa.Integer),
        sa.Column("pages", sa.Integer),
        sa.Column("dimensions", sa.String(100)),
        sa.Column("weight", sa.String(100)),
        sa.Column("subject", sa.Text),
        sa.Column("description", sa.Text),
        sa.Column("cover_image_url", sa.Text),
        sa.Column("cover_image_local", sa.Text),
        sa.Column("data_sources", postgresql.JSONB),
        sa.Column("data_complete", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_table(
        "listings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "book_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("listing_text", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("ebay_listing_id", sa.String(100)),
        sa.Column("ebay_status", sa.String(20), default="draft"),
    )


def downgrade() -> None:
    op.drop_table("listings")
    op.drop_table("books")
