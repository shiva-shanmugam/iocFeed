# Functional audit

Audit date: 2026-11-17. The local Docker application was tested at 1440×900 with Playwright against 310,000 indicators after the archive and IOC data changes. The machine-readable result is in `frontend/artifacts/functionality/report.json`; screenshots are stored beside it, including the closed default archive, hover state, and open day IOC list.

## Relationship graph model

The graph is an evidence view, not a similarity visualization. A line appears only when the database contains an explicit relationship between two indicators.

1. `/graph` searches for the IOC that will become the root.
2. Opening a result loads the root and its stored relationships to depth 2, capped at 250 nodes.
3. Clicking a node opens its evidence drawer and requests its direct neighbours.
4. Clicking a second node asks the API for the shortest stored path between the last two selected nodes and highlights it.
5. Hovering a node shows its IOC; hovering a connected node exposes the relationship type.
6. Type checkboxes hide or show node types. `fit` reframes the visible graph and `reset` returns to the original root.

An isolated IOC is valid data, not a graph failure. The view now says that no explicit relationships are stored and keeps the node at a readable size. Family, tag, and source links in the drawer are metadata pivots back into Explore; they may include IOCs that share classification but are not directly connected.

## Borrowed interaction ideas

The HexBrain reference influenced the breadcrumb hierarchy, ranked search-to-detail flow, persistent context in drawers, and lateral links from a detail record. The visual treatment remains this project's quiet, dense utility system: no hero, decorative map, glow, animation, or card-heavy navigation.

## Checks passed

- Atlas: four overlapping year files with staggered tabs, sibling dimming, no file open by default, and a full-year GitHub-style daily heatmap with month markers in the opened file; clicking a day reveals the IOC list inside that file. The audit also checked six exploration lenses, IOC preview, Escape close, URL-backed facets, sorting, page size, and pagination.
- Collections: permanent family/type/source/actor/tag/country/ASN routes, activity strip, contextual pivots, indicator table, and Atlas handoff.
- IOC records: explainable disposition, confidence factors, classification, explicit relationships, metadata pivots, graph handoff, and raw observations.
- Evidence: one locally rendered page per IOC/source observation, normalized fields, raw JSON, attribution, and upstream link handling.
- Navigation: persistent investigation trail across collection, IOC, and evidence routes.
- Search: grouped collection and indicator suggestions, with indicators opening permanent IOC records.
- Graph: root picker, instruction strip, canvas render, evidence drawer open/close, initial expansion API, neighbour expansion API, and shortest-path API.
- Bulk: parsing three inputs and verdict filtering.
- Map/timeline: plotted points, family filter, date-range filter, play, and pause.
- Feeds: source table and ingestion log.
- APIs: health, summary, facets, time series, indicator rows, entity collections, detailed IOC records, source evidence, graph, graph expansion, graph path, geo points, timeline, ingestion log, and CSV/JSON/blocklist exports.
- Browser: no console errors during the complete flow.

The automated audit recorded 54 passing checks and zero failures. Backend tests (15 passed, 3 integration tests skipped without their opt-in flag), frontend unit tests (4), ESLint, TypeScript, and the production build also pass. PostgreSQL and the API both confirmed 310,000 stored IOCs; a last-seen day with two stored IOCs returned two API records. The scheduled ingestion worker is stopped and excluded from default Compose startup.
