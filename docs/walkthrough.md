# Browser walkthrough video

Created 2026-11-18. The finished local render is `artifacts/walkthrough/IOC-Feed-Walkthrough.mp4`: 1920×1080, H.264, 25 fps, 2:30, approximately 11.8 MB. It is silent and caption-led, with 21 baked-in text callouts, target outlines, a moving pointer, and a browser-window frame styled with the app's JetBrains Mono font and color tokens.

The real browser interactions cover Atlas/year files/day heatmaps, facets and collections, search, IOC records/source evidence, the dense relationship graph and node/path interaction, Replay's capture timeline/origin grouping/graph changes, a second connected investigation, bulk triage and a real CSV download, map/time/family controls, and feed history. Demo IOCs, simulated replay stages, and synthetic geography are identified on screen. No production UI or stored IOC data is changed by the recorder.

## Chapters

- **0:00** Atlas · browse the dataset
- **0:18** Filters · collections and pivots
- **0:36** Search · a connected IOC
- **0:50** Evidence · inspect the source
- **0:57** Graph · explicit relationships
- **1:22** Replay · captured evidence over time
- **1:43** Another investigation · same workflow
- **1:49** Bulk triage · review and export
- **2:03** Map · geography and observation time
- **2:18** Feeds · source and import history
- **2:24** Follow one IOC from lookup to evidence

## Reproduce

Start the app with its populated synthetic dataset. Install frontend dependencies if absent. FFmpeg and FFprobe must be on PATH; the renderer uses only the Python standard library.

```sh
cd frontend
node scripts/record-walkthrough.mjs --dry
node scripts/record-walkthrough.mjs
cd ..
python3 frontend/scripts/render-walkthrough.py
```

The recorder discovers the current leading IOCs through the graph leaderboard. The demonstrated setup has 1,310,000 synthetic IOCs and 923,999 stored relationships. The current video's primary examples are `172.20.165.27`, `172.20.169.11`, and `172.20.172.249`, each with 200 direct relationships.

The dry run saves preview screenshots; the real run records the browser plus scene/callout metadata. The renderer aligns the recording clock using the first visible callout, removes inter-chapter loading gaps, and encodes one continuous H.264 stream. It writes MP4 chapter metadata, an optional SRT transcript, a poster, chapter review frames, and a validation report. The local `production/render.py` is an editable copy of the renderer for this capture session.

The final render passes a full decode and source-frame comparisons for all 11 chapters (SSIM ≥0.997 in this run). Generated media and intermediate files are ignored by Git; the recording and editing scripts are versioned. Ingestion workers are not started by the tour.
