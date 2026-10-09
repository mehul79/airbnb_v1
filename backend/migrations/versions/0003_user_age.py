"""users.age

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa


revision = '0003'
down_revision = '0002'


def upgrade() -> None:
    op.add_column('users', sa.Column('age', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'age')
