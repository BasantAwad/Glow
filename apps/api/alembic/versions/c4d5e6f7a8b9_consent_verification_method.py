"""Add consent verification audit field.

Revision ID: c4d5e6f7a8b9
Revises: b2c3d4e5f6a7
Create Date: 2026-08-30
"""

from alembic import op
import sqlalchemy as sa


revision = "c4d5e6f7a8b9"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "consent_records",
        sa.Column(
            "expected_verification_method",
            sa.String(length=128),
            nullable=False,
            server_default="jwt_bearer",
        ),
    )


def downgrade() -> None:
    op.drop_column("consent_records", "expected_verification_method")