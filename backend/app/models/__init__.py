import enum
from datetime import datetime
from typing import Any
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class IndicatorType(str, enum.Enum):
    ipv4 = "ipv4"
    domain = "domain"
    url = "url"
    md5 = "md5"
    sha1 = "sha1"
    sha256 = "sha256"


class Verdict(str, enum.Enum):
    malicious = "malicious"
    suspicious = "suspicious"
    unknown = "unknown"


class Indicator(Base):
    __tablename__ = "indicators"
    __table_args__ = (
        UniqueConstraint("type", "value"),
        CheckConstraint("confidence BETWEEN 0 AND 100"),
        Index("ix_indicators_type_value", "type", "value"),
        Index("ix_indicators_last_seen", "last_seen"),
        Index("ix_indicators_verdict", "verdict"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[IndicatorType] = mapped_column(Enum(IndicatorType, name="indicator_type"))
    value: Mapped[str] = mapped_column(Text)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    confidence: Mapped[int] = mapped_column(Integer, default=0)
    verdict: Mapped[Verdict] = mapped_column(Enum(Verdict, name="verdict"), default=Verdict.unknown)
    sources: Mapped[list["IndicatorSource"]] = relationship(
        back_populates="indicator", cascade="all, delete-orphan"
    )
    tags: Mapped[list["Tag"]] = relationship(
        secondary="indicator_tags", back_populates="indicators"
    )
    families: Mapped[list["MalwareFamily"]] = relationship(
        secondary="indicator_families", back_populates="indicators"
    )


class Source(Base):
    __tablename__ = "sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    url: Mapped[str] = mapped_column(Text)
    last_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="offline")


class IndicatorSource(Base):
    __tablename__ = "indicator_sources"
    __table_args__ = (UniqueConstraint("indicator_id", "source_id"),)
    indicator_id: Mapped[int] = mapped_column(
        ForeignKey("indicators.id", ondelete="CASCADE"), primary_key=True
    )
    source_id: Mapped[int] = mapped_column(
        ForeignKey("sources.id", ondelete="CASCADE"), primary_key=True
    )
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    raw: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    indicator: Mapped[Indicator] = relationship(back_populates="sources")
    source: Mapped[Source] = relationship()


class MalwareFamily(Base):
    __tablename__ = "malware_families"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    indicators: Mapped[list[Indicator]] = relationship(
        secondary="indicator_families", back_populates="families"
    )
    actors: Mapped[list["ThreatActor"]] = relationship(
        secondary="actor_families", back_populates="families"
    )


class ThreatActor(Base):
    __tablename__ = "threat_actors"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    aliases: Mapped[list[str]] = mapped_column(ARRAY(String(100)), default=list)
    description: Mapped[str] = mapped_column(Text, default="")
    country: Mapped[str | None] = mapped_column(String(2))
    families: Mapped[list["MalwareFamily"]] = relationship(
        secondary="actor_families", back_populates="actors"
    )


class ActorFamily(Base):
    __tablename__ = "actor_families"
    actor_id: Mapped[int] = mapped_column(
        ForeignKey("threat_actors.id", ondelete="CASCADE"), primary_key=True
    )
    family_id: Mapped[int] = mapped_column(
        ForeignKey("malware_families.id", ondelete="CASCADE"), primary_key=True
    )


class IndicatorFamily(Base):
    __tablename__ = "indicator_families"
    indicator_id: Mapped[int] = mapped_column(
        ForeignKey("indicators.id", ondelete="CASCADE"), primary_key=True
    )
    family_id: Mapped[int] = mapped_column(
        ForeignKey("malware_families.id", ondelete="CASCADE"), primary_key=True
    )


class Tag(Base):
    __tablename__ = "tags"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    indicators: Mapped[list[Indicator]] = relationship(
        secondary="indicator_tags", back_populates="tags"
    )


class IndicatorTag(Base):
    __tablename__ = "indicator_tags"
    indicator_id: Mapped[int] = mapped_column(
        ForeignKey("indicators.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)


class Relationship(Base):
    __tablename__ = "relationships"
    __table_args__ = (
        UniqueConstraint("src_indicator_id", "dst_indicator_id", "relation_type", "source_id"),
        Index("ix_relationships_src", "src_indicator_id"),
        Index("ix_relationships_dst", "dst_indicator_id"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    src_indicator_id: Mapped[int] = mapped_column(ForeignKey("indicators.id", ondelete="CASCADE"))
    dst_indicator_id: Mapped[int] = mapped_column(ForeignKey("indicators.id", ondelete="CASCADE"))
    relation_type: Mapped[str] = mapped_column(String(32))
    source_id: Mapped[int | None] = mapped_column(ForeignKey("sources.id", ondelete="SET NULL"))


class IPGeo(Base):
    __tablename__ = "ip_geo"
    ip: Mapped[str] = mapped_column(INET, primary_key=True)
    country_code: Mapped[str] = mapped_column(String(2))
    lat: Mapped[float]
    lon: Mapped[float]
    asn: Mapped[int]
    as_name: Mapped[str] = mapped_column(String(200))
    synthetic: Mapped[bool] = mapped_column(default=False)


class IngestionLog(Base):
    __tablename__ = "ingestion_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    source: Mapped[str] = mapped_column(String(100))
    level: Mapped[str] = mapped_column(String(16))
    message: Mapped[str] = mapped_column(Text)
    new_count: Mapped[int] = mapped_column(default=0)
    updated_count: Mapped[int] = mapped_column(default=0)


class EvidenceSnapshot(Base):
    __tablename__ = "evidence_snapshots"
    __table_args__ = (Index("ix_snapshot_indicator_time", "indicator_id", "recorded_at", "id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    indicator_id: Mapped[int] = mapped_column(ForeignKey("indicators.id", ondelete="CASCADE"))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reason: Mapped[str] = mapped_column(String(100))
    simulated: Mapped[bool] = mapped_column(default=False)
    state: Mapped[dict[str, Any]] = mapped_column(JSONB)
