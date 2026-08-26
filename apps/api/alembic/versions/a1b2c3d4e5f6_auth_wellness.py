"""auth credentials, diagnosis disclosure, journal, mood

Revision ID: a1b2c3d4e5f6
Revises: 1815e4f69e59
Create Date: 2026-08-26
"""
from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "1815e4f69e59"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.String(length=254), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(length=256), nullable=True))
    op.add_column("users", sa.Column("display_name", sa.String(length=60), nullable=True))
    op.add_column("users", sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("diagnosis_disclosed", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("diagnosis_note_encrypted", sa.LargeBinary(), nullable=True))
    op.add_column("users", sa.Column("diagnosis_key_id", sa.String(length=64), nullable=True))
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "journal_entries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_account_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("title", sa.String(length=120), nullable=True),
        sa.Column("encrypted_content", sa.LargeBinary(), nullable=False),
        sa.Column("key_id", sa.String(length=64), nullable=False),
        sa.Column("mood_at_write", sa.Integer(), nullable=True),
    )

    op.create_table(
        "mood_entries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_account_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("day_utc", sa.String(length=10), nullable=False),
        sa.Column("mood", sa.Integer(), nullable=False),
        sa.Column("note", sa.String(length=280), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("mood_entries")
    op.drop_table("journal_entries")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_column("users", "diagnosis_key_id")
    op.drop_column("users", "diagnosis_note_encrypted")
    op.drop_column("users", "diagnosis_disclosed")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_count")
    op.drop_column("users", "display_name")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "email")
