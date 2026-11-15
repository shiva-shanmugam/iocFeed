"""add threat actors and explorer indexes"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "threat_actors",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("aliases", postgresql.ARRAY(sa.String(100)), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("country", sa.String(2)),
    )
    op.create_table(
        "actor_families",
        sa.Column("actor_id", sa.Integer, sa.ForeignKey("threat_actors.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("family_id", sa.Integer, sa.ForeignKey("malware_families.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_index("ix_indicators_first_last_seen", "indicators", ["first_seen", "last_seen"])
    op.create_index("ix_ip_geo_country_asn", "ip_geo", ["country_code", "asn"])
    op.create_index("ix_actor_families_family", "actor_families", ["family_id"])


def downgrade():
    op.drop_index("ix_actor_families_family", table_name="actor_families")
    op.drop_index("ix_ip_geo_country_asn", table_name="ip_geo")
    op.drop_index("ix_indicators_first_last_seen", table_name="indicators")
    op.drop_table("actor_families")
    op.drop_table("threat_actors")
