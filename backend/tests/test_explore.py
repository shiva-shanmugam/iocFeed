from datetime import date

import pytest
from fastapi import HTTPException

from app.api.explore import _split, parse_filters


def test_split_supports_repeated_and_comma_separated_values():
    assert _split(["domain,url", "ipv4"]) == ["domain", "url", "ipv4"]


def test_filter_parser_normalizes_all_dimensions():
    parsed = parse_filters(
        types=["domain,url"],
        sources=["feed-a"],
        families=["QakBot"],
        actors=["FIN7"],
        tags=["c2"],
        countries=["US"],
        asns=["64512"],
        date_from=date(2026, 1, 1),
        date_to=date(2026, 1, 31),
        contains=" node ",
    )
    assert parsed.types == ["domain", "url"]
    assert parsed.asns == [64512]
    assert parsed.contains == "node"


def test_filter_parser_rejects_invalid_asn():
    with pytest.raises(HTTPException) as exc:
        parse_filters(asns=["not-an-asn"])
    assert exc.value.status_code == 422
