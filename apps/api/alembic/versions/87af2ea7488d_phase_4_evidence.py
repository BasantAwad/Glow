"""phase_4_evidence

Revision ID: 87af2ea7488d
Revises: 3c5fecc7563b
Create Date: 2026-08-24 22:28:08.900370

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '87af2ea7488d'
down_revision: Union[str, Sequence[str], None] = '3c5fecc7563b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


import pgvector.sqlalchemy

def upgrade() -> None:
    """Upgrade schema."""
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    
    op.create_table(
        'evidence_entries',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('entry_id', sa.String(length=64), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('content_text', sa.String(), nullable=False),
        sa.Column('embedding', pgvector.sqlalchemy.Vector(dim=1536), nullable=True),
        sa.Column('evidence_type', sa.String(length=64), nullable=False),
        sa.Column('locale', sa.String(length=20), nullable=False),
        sa.Column('jurisdiction', sa.dialects.postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('license', sa.String(length=64), nullable=False),
        sa.Column('license_url', sa.String(), nullable=False),
        sa.Column('source_url', sa.String(), nullable=False),
        sa.Column('source_name', sa.String(), nullable=False),
        sa.Column('retrieved_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('retrieved_by', sa.String(), nullable=False),
        sa.Column('is_approved', sa.Boolean(), nullable=False),
        sa.Column('approved_by', sa.String(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('permitted_uses', sa.dialects.postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('clinical_notes', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_evidence_entries'))
    )
    op.create_index(op.f('ix_evidence_entries_entry_id'), 'evidence_entries', ['entry_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_evidence_entries_entry_id'), table_name='evidence_entries')
    op.drop_table('evidence_entries')
    op.execute('DROP EXTENSION IF EXISTS vector')
