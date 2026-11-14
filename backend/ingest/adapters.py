import csv, io
from typing import Any
from ingest.base import FeedAdapter
from ingest.normalizer import normalize_record


class URLHausAdapter(FeedAdapter):
    name = "URLhaus"
    url = "https://urlhaus-api.abuse.ch/v1/urls/recent/"

    def payload(self):
        return {"limit": "1000"}

    def parse(self, payload: Any):
        return payload.get("urls", []) if isinstance(payload, dict) else []

    def normalize(self, r):
        return normalize_record(r["url"], r, confidence=90)


class MalwareBazaarAdapter(FeedAdapter):
    name = "MalwareBazaar"
    url = "https://mb-api.abuse.ch/api/v1/"

    def payload(self):
        return {"query": "get_recent", "selector": "1000"}

    def parse(self, payload: Any):
        return payload.get("data", []) if isinstance(payload, dict) else []

    def normalize(self, r):
        return normalize_record(
            r.get("sha256_hash") or r.get("sha1_hash") or r["md5_hash"], r, confidence=94
        )


class ThreatFoxAdapter(FeedAdapter):
    name = "ThreatFox"
    url = "https://threatfox-api.abuse.ch/api/v1/"

    def payload(self):
        return {"query": "get_iocs", "days": "7"}

    def parse(self, payload: Any):
        return payload.get("data", []) if isinstance(payload, dict) else []

    def normalize(self, r):
        return normalize_record(r["ioc"], r, confidence=88)


class FeodoAdapter(FeedAdapter):
    name = "Feodo Tracker"
    url = "https://feodotracker.abuse.ch/downloads/ipblocklist.csv"

    def fetch(self):
        import httpx

        response = httpx.get(self.url, timeout=30)
        response.raise_for_status()
        return response.text

    def parse(self, payload: Any):
        lines = [x for x in str(payload).splitlines() if x and not x.startswith("#")]
        return [
            {"ioc": row[0], "last_seen": row[1] if len(row) > 1 else None, "malware": "Feodo"}
            for row in csv.reader(io.StringIO("\n".join(lines)))
            if row
        ]

    def normalize(self, r):
        return normalize_record(r["ioc"], r, confidence=92)


ADAPTERS = [URLHausAdapter, MalwareBazaarAdapter, ThreatFoxAdapter, FeodoAdapter]
