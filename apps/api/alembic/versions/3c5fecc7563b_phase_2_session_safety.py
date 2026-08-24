"""phase_2_session_safety

Revision ID: 3c5fecc7563b
Revises: fab7924a94ad
Create Date: 2026-08-24 22:14:12.118464

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3c5fecc7563b'
down_revision: Union[str, Sequence[str], None] = 'fab7924a94ad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # session_records
    op.create_table(
        "session_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.String(length=64), nullable=False),
        sa.Column("user_account_id", sa.Integer(), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False),
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("hard_limit_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paused_duration_seconds", sa.Integer(), nullable=False),
        sa.Column("is_crisis", sa.Boolean(), nullable=False),
        sa.Column("closure_reason", sa.String(length=32), nullable=True),
        sa.Column("consent_version", sa.String(length=64), nullable=False),
        sa.Column("summary_generated", sa.Boolean(), nullable=False),
        sa.Column("summary_consent", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["user_account_id"], ["users.id"], name=op.f("fk_session_records_user_account_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_session_records"))
    )
    op.create_index(op.f("ix_session_records_session_id"), "session_records", ["session_id"], unique=True)
    op.create_index(op.f("ix_session_records_user_account_id"), "session_records", ["user_account_id"], unique=False)

    # session_messages
    op.create_table(
        "session_messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_record_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["session_record_id"], ["session_records.id"], name=op.f("fk_session_messages_session_record_id_session_records"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_session_messages"))
    )
    op.create_index(op.f("ix_session_messages_session_record_id"), "session_messages", ["session_record_id"], unique=False)

    # safety_audit_events
    op.create_table(
        "safety_audit_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_id", sa.String(length=64), nullable=False),
        sa.Column("session_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("check_type", sa.String(length=32), nullable=False),
        sa.Column("risk_tier", sa.Integer(), nullable=False),
        sa.Column("signals", sa.JSON(), nullable=False),
        sa.Column("action_taken", sa.String(length=64), nullable=False),
        sa.Column("audit_note", sa.String(), nullable=False),
        sa.Column("policy_version", sa.String(length=64), nullable=False),
        sa.Column("extra_metadata", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_safety_audit_events"))
    )
    op.create_index(op.f("ix_safety_audit_events_event_id"), "safety_audit_events", ["event_id"], unique=True)
    op.create_index(op.f("ix_safety_audit_events_session_id"), "safety_audit_events", ["session_id"], unique=False)
    op.create_index(op.f("ix_safety_audit_events_user_id"), "safety_audit_events", ["user_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_safety_audit_events_user_id"), table_name="safety_audit_events")
    op.drop_index(op.f("ix_safety_audit_events_session_id"), table_name="safety_audit_events")
    op.drop_index(op.f("ix_safety_audit_events_event_id"), table_name="safety_audit_events")
    op.drop_table("safety_audit_events")
    
    op.drop_index(op.f("ix_session_messages_session_record_id"), table_name="session_messages")
    op.drop_table("session_messages")
    
    op.drop_index(op.f("ix_session_records_user_account_id"), table_name="session_records")
    op.drop_index(op.f("ix_session_records_session_id"), table_name="session_records")
    op.drop_table("session_records")
