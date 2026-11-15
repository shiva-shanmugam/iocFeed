# Dashboard audit — before data-explorer rebuild

Audit date: 2026-11-15. The running seeded application was inspected with Playwright at 1440×900 and 1024×768 before dashboard changes. Reference captures are in `artifacts/dashboard-audit/before-1440x900.png` and `before-1024x768.png`.

## Layout and responsiveness

- The page has no horizontal document overflow at either tested viewport, but it is not actually responsive: the 7/5 column split is hard-coded at every width. At 1024px the main workspace is only 840px after the sidebar, yet the two-column layout remains active.
- Family rows use a fixed `140px 1fr 64px` grid and source rows use `120px 1fr 64px`. They consume most of the narrow widget width and leave little room for the data bar.
- The activity heatmap is a fixed 18-column grid. Cells resize only as a side effect of their container width, not around a meaningful time scale. Dates, weeks, and missing days are not represented, so the grid cannot be interpreted reliably.
- The dashboard uses fixed column spans rather than the required 3/2/1 responsive widget grid. There is no useful behavior below the 1024px minimum width.
- No widget observes its own size. There are no charts that recompute axes or density when resized.

## Information quality

- The headline `10,000 indicators · live` does not define what “live” means and omits the dataset dimensions needed to understand the store.
- The activity heatmap is nearly flat because seeded `first_seen` dates have a narrow, uniform distribution. One accent cell implies an outlier without explaining its count or date. It has no axis, date labels, aggregation choice, `first_seen`/`last_seen` definition, or clustering warning.
- Family and source bars are visual decoration rather than charts: all family counts are identical, there is no share percentage or first/last seen, and the scale is not explained.
- The indicator-type table has useful totals and shares, but rows are not interactive and cannot filter or drill into data.
- There is no adversary, tag, country, ASN, or filtered-indicator view.
- Verdict and confidence are absent from this page, which is appropriate for an explorer, but the page still lacks a neutral faceted-data framing.
- The ingestion log occupies the full bottom row even though it is operational metadata rather than a primary exploration dimension.

## Interaction

- Family rows are clickable but only set local component state. The selection does not update the URL, counts, other widgets, or any visible selected-state explanation.
- Type rows, source rows, activity cells, and log lines are not clickable.
- There is no global filter state, filter removal, clear-all action, free-text search, URL sharing, or browser back/forward support.
- Counts are not faceted. Nothing recomputes when the family state changes.
- There are no drill-down dialogs or links between related entities.
- There is no indicator table, pagination, sorting, copy action, or keyboard row navigation.
- Loading and error handling replace the entire page with one line; individual widgets cannot retry and previous data disappears during refresh.

## Accessibility and motion

- Clickable family rows are buttons, but table-like navigation and arrow-key movement are absent.
- There is no modal focus management, Escape handling, focus return, or deep-link state.
- Data changes have no defined crossfade, number transition, or chart transition.
- Reduced-motion is globally handled, but the dashboard has no state-change motion to validate against the new allowed durations.

## Decisions for the rebuild

- `/` becomes Explore. Lookup moves to `/search`; existing lookup behavior remains available.
- The old fixed 18-column heatmap and ingestion-log dashboard widget are removed. Feeds and logs move to a dedicated Feeds page. The replacement activity view uses a calendar-aligned GitHub-style heat map with dated tooltips and clickable cells.
- The simplest performant implementation for 10k rows is PostgreSQL-filtered row selection plus cached in-process aggregation for facets and entity payloads. Identical explore requests are cached for 30 seconds.
- Actor attribution comes from a committed, trimmed ATT&CK-style reference file. If it cannot be loaded, the seed creates synthetic mappings and marks their provenance.
- The activity heat map uses a responsive SVG and the global date fields handle range filtering without bringing back a large chart dependency.
