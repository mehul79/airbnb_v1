"""favorites

Revision ID: 0005
Revises: 0004
"""
from alembic import op
import sqlalchemy as sa


revision = '0005'
down_revision = '0004'


def upgrade() -> None:
    op.create_table('favorites',
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('listing_id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['listing_id'], ['listings.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id', 'listing_id')
    )
    op.create_index('ix_favorites_user_created', 'favorites', ['user_id', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_favorites_user_created', table_name='favorites')
    op.drop_table('favorites')
