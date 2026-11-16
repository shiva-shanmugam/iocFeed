# Navigation model

The interface follows an evidence-first drill-down rather than a dashboard-to-modal pattern.

```text
IOC Atlas → collection → IOC record → source evidence
                          ↘ relationship graph
```

## Routes

- `/` — IOC Atlas: density, facets, activity, and ranked indicators.
- `/collection/:kind/:value` — permanent dataset for a type, family, actor, source, tag, country, or ASN.
- `/ioc/:id` — permanent decision record for one indicator.
- `/evidence/:id/:source` — locally stored observation from one source, with attribution and an upstream link when the source is HTTP-accessible.
- `/investigate/:id` — explicit relationship graph rooted at one IOC.

## Navigation rules

1. Every drill-down has a stable, shareable URL.
2. Breadcrumbs show the current scope.
3. `Continue exploring` links are contextual to the current entity.
4. Explicit relationships and shared-metadata pivots remain visibly distinct.
5. The sidebar keeps the six most recent collections, IOC records, and evidence pages in a browser-local investigation trail.
6. Source evidence is rendered from the record already stored during ingestion; it is not fetched from the upstream source during page navigation.

The visual system remains the one documented in `docs/design.md`: flat surfaces, hairline borders, JetBrains Mono, one accent, and no decorative animation or graph effects.
