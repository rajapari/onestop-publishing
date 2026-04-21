"""Add WOPI, collaborators, and snapshot support

Revision ID: a3f9c12d4e57
Revises: 78d2e40db221
Create Date: 2026-04-10

"""
from alembic import op
import sqlalchemy as sa

revision = 'a3f9c12d4e57'
down_revision = '78d2e40db221'
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to manuscript
    with op.batch_alter_table('manuscript', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_snapshot', sa.Boolean(), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('snapshot_label', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('last_modified', sa.DateTime(), nullable=True, server_default=sa.func.now()))

    # Create document_collaborator table
    op.create_table(
        'document_collaborator',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('manuscript_name', sa.String(length=255), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=True),
        sa.Column('added_at', sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['project_id'], ['project.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create wopi_token table
    op.create_table(
        'wopi_token',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('manuscript_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('can_write', sa.Boolean(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['manuscript_id'], ['manuscript.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token')
    )

    # Create wopi_lock table
    op.create_table(
        'wopi_lock',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('manuscript_id', sa.Integer(), nullable=True),
        sa.Column('lock_string', sa.String(length=1024), nullable=True),
        sa.Column('locked_at', sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['manuscript_id'], ['manuscript.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('manuscript_id')
    )


def downgrade():
    op.drop_table('wopi_lock')
    op.drop_table('wopi_token')
    op.drop_table('document_collaborator')

    with op.batch_alter_table('manuscript', schema=None) as batch_op:
        batch_op.drop_column('last_modified')
        batch_op.drop_column('snapshot_label')
        batch_op.drop_column('is_snapshot')
