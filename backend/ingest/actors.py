import json
from pathlib import Path

from sqlalchemy import select

from app.models import ActorFamily, MalwareFamily, ThreatActor


ACTORS = [
    ("TA505", ["Hive0067"], "Financially motivated intrusion group.", "RU", ["Dridex"]),
    ("MuddyWater", ["Seedworm"], "Regional espionage activity cluster.", "IR", ["AsyncRAT"]),
    ("Lazarus Group", ["Hidden Cobra"], "State-aligned intrusion group.", "KP", ["TrickBot"]),
    ("FIN7", ["Carbanak Group"], "Financially motivated intrusion group.", "RU", ["QakBot"]),
    ("Wizard Spider", ["UNC1878"], "Criminal enterprise associated with loader activity.", "RU", ["TrickBot", "QakBot"]),
    ("Mustang Panda", ["RedDelta"], "Espionage group using commodity loaders.", "CN", ["AgentTesla"]),
    ("Kimsuky", ["Velvet Chollima"], "Espionage activity targeting research organizations.", "KP", ["IcedID"]),
    ("Sandworm", ["Voodoo Bear"], "Destructive and disruptive intrusion group.", "RU", ["Emotet"]),
    ("Gamaredon", ["Primitive Bear"], "High-volume regional targeting group.", "RU", ["RedLine"]),
    ("Turla", ["Snake"], "Long-running espionage intrusion set.", "RU", ["Dridex"]),
    ("APT29", ["Cozy Bear"], "State-aligned espionage group.", "RU", ["QakBot"]),
    ("Transparent Tribe", ["APT36"], "Regional espionage and collection group.", "PK", ["AsyncRAT"]),
]


def _actor_rows():
    path = Path(__file__).with_name("data") / "threat_actors.json"
    try:
        return [
            (row["name"], row["aliases"], row["description"], row["country"], row["families"])
            for row in json.loads(path.read_text())
        ]
    except (OSError, KeyError, TypeError, json.JSONDecodeError):
        return ACTORS


def seed_actors(db) -> int:
    created = 0
    for name, aliases, description, country, family_names in _actor_rows():
        actor = db.scalar(select(ThreatActor).where(ThreatActor.name == name))
        if not actor:
            actor = ThreatActor(
                name=name, aliases=aliases, description=description, country=country
            )
            db.add(actor)
            db.flush()
            created += 1
        for family_name in family_names:
            family = db.scalar(select(MalwareFamily).where(MalwareFamily.name == family_name))
            if not family:
                family = MalwareFamily(name=family_name)
                db.add(family)
                db.flush()
            exists = db.get(ActorFamily, (actor.id, family.id))
            if not exists:
                db.add(ActorFamily(actor_id=actor.id, family_id=family.id))
    return created
