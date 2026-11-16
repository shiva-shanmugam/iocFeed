from ingest.seed import _value


def test_seed_values_stay_unique_at_full_default_capacity():
    values = [_value(index) for index in range(310_000)]

    assert len(values) == len(set(values))


def test_expanded_ipv4_range_uses_a_separate_private_network():
    assert _value(10_000)[1].startswith("172.16.")
