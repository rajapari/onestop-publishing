"""Add is_verified to user

Revision ID: d7f3e2c4a9b1
Revises: a3f9c12d4e57
Create Date: 2026-04-16
"""

from alembic import op
import sqlalchemy as sa

revision = "d7f3e2c4a9b1"
down_revision = "a3f9c12d4e57"
branch_labels = None
depends_on = None


def upgrade():
    # Your runtime model has `is_verified`, but the original Alembic
    # `initial_database_setup.py` didn't. Add it so Postgres deployments work.
    with op.batch_alter_table("user", schema=None) as batch_op:
        batch_op.add_column(sa.Column("is_verified", sa.Boolean(), nullable=True))


def downgrade():
    with op.batch_alter_table("user", schema=None) as batch_op:
        batch_op.drop_column("is_verified")

