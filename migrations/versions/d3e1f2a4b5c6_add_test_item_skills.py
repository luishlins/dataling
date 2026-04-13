"""add test_item_skills

Revision ID: d3e1f2a4b5c6
Revises: b97768bbe914
Create Date: 2026-04-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'd3e1f2a4b5c6'
down_revision = 'b97768bbe914'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'test_item_skills',
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['item_id'], ['test_items.id']),
        sa.ForeignKeyConstraint(['skill_id'], ['skill_nodes.skill_id']),
        sa.PrimaryKeyConstraint('item_id', 'skill_id'),
    )


def downgrade():
    op.drop_table('test_item_skills')
