"""payment webhook events

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-26
"""
from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payment_webhook_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("provider_event_id", sa.String(length=64), nullable=False),
        sa.Column("provider_name", sa.String(length=32), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("processed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        op.f("ix_payment_webhook_events_provider_event_id"),
        "payment_webhook_events",
        ["provider_event_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_payment_webhook_events_provider_event_id"), table_name="payment_webhook_events")
    op.drop_table("payment_webhook_events")
