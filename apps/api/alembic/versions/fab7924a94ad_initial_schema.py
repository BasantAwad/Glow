"""initial_schema

Revision ID: fab7924a94ad
Revises: 
Create Date: 2026-08-24 22:03:39.399231

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fab7924a94ad'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_adult_confirmed", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("completed_sessions", sa.Integer(), nullable=False),
        sa.Column("free_sessions_remaining", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users"))
    )
    op.create_index(op.f("ix_users_user_id"), "users", ["user_id"], unique=True)

    # user_preferences
    op.create_table(
        "user_preferences",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_account_id", sa.Integer(), nullable=False),
        sa.Column("locale", sa.String(length=32), nullable=False),
        sa.Column("session_mode", sa.String(length=32), nullable=False),
        sa.Column("avatar_disclosure", sa.String(length=32), nullable=False),
        sa.Column("input_modality", sa.String(length=32), nullable=False),
        sa.Column("persona_name", sa.String(length=40), nullable=True),
        sa.Column("accessibility", sa.JSON(), nullable=False),
        sa.Column("preferred_session_minutes", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_account_id"], ["users.id"], name=op.f("fk_user_preferences_user_account_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_preferences")),
        sa.UniqueConstraint("user_account_id", name=op.f("uq_user_preferences_user_account_id"))
    )

    # consent_records
    op.create_table(
        "consent_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_account_id", sa.Integer(), nullable=False),
        sa.Column("record_version", sa.Integer(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("policy_version", sa.String(length=64), nullable=False),
        sa.Column("locale_presented", sa.String(length=20), nullable=False),
        sa.Column("service_use", sa.Boolean(), nullable=False),
        sa.Column("transcript_retention", sa.Boolean(), nullable=False),
        sa.Column("audio_storage", sa.Boolean(), nullable=False),
        sa.Column("video_storage", sa.Boolean(), nullable=False),
        sa.Column("session_summary", sa.Boolean(), nullable=False),
        sa.Column("personalisation", sa.Boolean(), nullable=False),
        sa.Column("research_and_model_improvement", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["user_account_id"], ["users.id"], name=op.f("fk_consent_records_user_account_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_consent_records"))
    )
    op.create_index(op.f("ix_consent_records_user_account_id"), "consent_records", ["user_account_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_consent_records_user_account_id"), table_name="consent_records")
    op.drop_table("consent_records")
    op.drop_table("user_preferences")
    op.drop_index(op.f("ix_users_user_id"), table_name="users")
    op.drop_table("users")

