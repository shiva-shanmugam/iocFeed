# Evidence Replay

Replay is available from the sidebar, full IOC records, source-evidence pages, graph drawers, and Atlas IOC previews. An Atlas day is passed as `?at=YYYY-MM-DD`; dates before capture coverage show an explicit unavailable state rather than an inferred historical verdict. Selecting a capture produces a shareable `?capture=ID` URL.

## Visual reading order

1. The confidence step chart, capture slider, and dated controls locate the selected stored state.
2. The selected/current comparison shows verdict, confidence, source mentions, and relationship counts.
3. Source lanes mark presence at each capture. Declared upstream origin identifiers group mirrored reports; unknown origins remain unknown and feed count is never presented as independent corroboration.
4. Two SVG neighbourhoods use identical node positions. Their bounded sample prioritizes added/removed neighbours, so changes are visible. Accent links and outlines indicate additions; absent nodes are faint reference positions. Each miniature shows at most 18 neighbours.
5. Preserved source excerpts and attribution appear below. Links explicitly open the **current** source record, not an alleged historical copy of that page.

## Capture contract

`evidence_snapshots` stores capture timestamp, reason, simulation flag, and a frozen JSON state. The state contains verdict/confidence, classification, source excerpts and raw-record fingerprints, declared origins, and a bounded explicit relationship sample with the full relationship count. Source imports capture the pre-update state and changed post-import state. Identical states are skipped. Bulk baselines and live captures normalize timestamps and use compatible raw-record fingerprints.

Capture time is distinct from source `first_seen`/`last_seen`. Existing data received a baseline at this import's actual time. The system does not reconstruct missing history from observation dates. Capture history is bounded to the latest 500 states per request, and relationship samples to 250 edges; truncation is indicated. Historical excerpts/fingerprints are stored in the capture; the full raw source record link is the current observation.

The three leading synthetic infrastructure IOCs also have three **simulated** earlier stages. These are marked in storage, every capture control, and a persistent page notice. A demonstration mirror shares an explicit origin so the source grouping can be exercised. These fixtures are not real threat observations.

## Expanded local dataset

The one-time import added 1,000,000 synthetic IOCs to the existing 310,000, for 1,310,000 indicators and 923,999 explicit relationships. The new source is `synthetic-campaigns`. Generated campaign relationships are `resolves_to`, `hosted_on`, and `payload_of`; all carry synthetic source attribution. A 1,000-record campaign shares infrastructure, producing connected multi-hop neighbourhoods.

The leading examples are tied at 200 direct stored relationships each:

| IOC | ID | Graph | Replay |
| --- | --- | --- | --- |
| `172.20.165.27` | 310008 | `/investigate/310008` | `/replay/310008` |
| `172.20.169.11` | 311008 | `/investigate/311008` | `/replay/311008` |
| `172.20.172.249` | 312008 | `/investigate/312008` | `/replay/312008` |

`python -m ingest.bulk_demo --count 1000000` is a one-time, bounded-memory COPY import that respects `MAX_INDICATORS`, commits batches, then captures baselines. Running it in a `docker compose run --rm` container leaves no ingestion container after completion. Continuous ingestion remains an opt-in Compose profile. Database, API, and frontend containers serve the app and do not schedule feed polling.

## Graph behavior

The canvas measures the stage left after the sidebar, toolbar, and open evidence column. Initial layout, reset, and stage resizing fit the rendered neighbourhood. The root is pinned in the force layout; node type is conveyed by shape. Directed edges show explicit database relationships; hovering identifies a relationship and selecting two nodes highlights their stored shortest path. A graph is capped at 250 visible nodes, and truncated neighbourhoods are labeled. Use **make root** on a selected IOC to explore another neighbourhood. Graph/path queries are bounded, and graph selection preserves the root and valid edge endpoints at the display cap.

## Validation

`frontend/scripts/audit-replay-graph.mjs` checks actual canvas pixels for centering with the evidence column open/closed, after reset, and at a narrower viewport. It clicks a rendered node and verifies evidence, expansion, and a stored path. Replay checks cover capture URLs/reload, source-origin grouping, visible link changes, recorded versus simulated labels, and unavailable historical coverage. Backend database tests cover immutable old states, unchanged-state deduplication, bulk/live baseline compatibility, missing history, and root retention under the graph budget.
