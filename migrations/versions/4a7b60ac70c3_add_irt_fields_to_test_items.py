"""add irt fields to test_items

Revision ID: 4a7b60ac70c3
Revises: d3e1f2a4b5c6
Create Date: 2026-04-13 03:05:00.746509

"""
from alembic import op
import sqlalchemy as sa


revision = '4a7b60ac70c3'
down_revision = 'd3e1f2a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('test_items') as batch_op:
        batch_op.add_column(sa.Column('irt_difficulty',       sa.Float(),   nullable=True))
        batch_op.add_column(sa.Column('irt_discrimination',   sa.Float(),   nullable=True))
        batch_op.add_column(sa.Column('response_count',       sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('correct_count',        sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('empirical_difficulty', sa.Float(),   nullable=True))


def downgrade():
    with op.batch_alter_table('test_items') as batch_op:
        batch_op.drop_column('empirical_difficulty')
        batch_op.drop_column('correct_count')
        batch_op.drop_column('response_count')
        batch_op.drop_column('irt_discrimination')
        batch_op.drop_column('irt_difficulty')
