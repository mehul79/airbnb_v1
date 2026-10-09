"""drop the secondary indexes, users.avatar_url and the currency columns

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa


revision = '0006'
down_revision = '0005'

# (index, table, columns): kept so downgrade can recreate them.
INDEXES = [
    ('ix_sessions_user_id', 'sessions', ['user_id']),
    ('ix_listings_archived_created_id', 'listings', ['archived_at', 'created_at', 'id']),
    ('ix_listings_host_archived', 'listings', ['host_id', 'archived_at']),
    ('ix_listings_city', 'listings', ['city']),
    ('ix_listings_property_type', 'listings', ['property_type']),
    ('ix_listing_amenities_amenity_listing', 'listing_amenities', ['amenity_id', 'listing_id']),
    ('ix_reviews_listing_id', 'reviews', ['listing_id']),
    ('ix_bookings_listing_status_dates', 'bookings', ['listing_id', 'status', 'check_in', 'check_out']),
    ('ix_bookings_guest_check_in_id', 'bookings', ['guest_id', 'check_in', 'id']),
    ('ix_favorites_user_created', 'favorites', ['user_id', 'created_at']),
]


def upgrade() -> None:
    # Data is small, so these only added write cost. UNIQUE constraints stay: they enforce rules.
    for name, table, _ in INDEXES:
        op.drop_index(name, table_name=table)
    # No custom avatars: the UI draws an initial on a gradient.
    op.drop_column('users', 'avatar_url')
    # Everything is INR, so the column is dead weight. SQLite cannot drop a column that a CHECK mentions,
    # so batch mode rebuilds the table (env.py turns foreign keys off for that, or the rebuild would cascade).
    for table in ('listings', 'bookings'):
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(f'ck_{table}_currency', type_='check')
            batch.drop_column('currency')


def downgrade() -> None:
    for table in ('listings', 'bookings'):
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column('currency', sa.String(length=3), server_default='INR', nullable=False))
            batch.create_check_constraint(f'ck_{table}_currency', "currency = 'INR'")
    op.add_column('users', sa.Column('avatar_url', sa.String(length=500), nullable=True))
    for name, table, columns in INDEXES:
        op.create_index(name, table, columns, unique=False)
