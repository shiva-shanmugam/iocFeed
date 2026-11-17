"""append-only evidence history"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "evidence_snapshots",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("indicator_id", sa.Integer, sa.ForeignKey("indicators.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("reason", sa.String(100), nullable=False),
        sa.Column("simulated", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("state", JSONB, nullable=False),
    )
    op.create_index("ix_snapshot_indicator_time", "evidence_snapshots", ["indicator_id", "recorded_at", "id"])


def downgrade():
    op.drop_table("evidence_snapshots")
