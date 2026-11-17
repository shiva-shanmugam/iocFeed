# Frontend design system

Tracefold is an internal engineering utility. Its visual language is dense, quiet, text-first, and deliberately closer to a terminal or database client than a product website.

## Tokens

The canonical tokens live as CSS variables in `frontend/src/index.css`. Tailwind aliases in `frontend/tailwind.config.js` reference those variables; components must not introduce a second palette.

| Token                    | Value            | Use                                      |
| ------------------------ | ---------------- | ---------------------------------------- |
| `--color-bg`             | `#0d0d0e`        | application background                   |
| `--color-surface`        | `#131314`        | selected rows and bounded panels         |
| `--color-border`         | `#232325`        | all hairline borders                     |
| `--color-text`           | `#e6e6e6`        | primary text                             |
| `--color-text-secondary` | `#8a8a8e`        | labels and metadata                      |
| `--color-text-disabled`  | `#55555a`        | disabled controls                        |
| `--color-accent`         | `#7aa2f7`        | focus, active navigation, selection only |
| `--color-malicious`      | `#e5534b`        | malicious text or 2px rule only          |
| `--color-suspicious`     | `#c69026`        | suspicious text or 2px rule only         |
| `--color-bar`            | `#3a3a3d`        | neutral data bars and map outlines       |
| `--color-heat-0..6`      | seven fixed steps | six neutral levels and a highest-bucket accent |

JetBrains Mono is the only typeface. Body text is 13px with 1.5 line height. Section headings are 11px uppercase secondary text or 600 weight. Spacing follows a 4px scale. Corner radius is at most 2px; tables have square corners.

## Layout and controls

- Use the fixed 184px text sidebar, main workspace, and 28px single-line status bar.
- Panels use a 1px border and no elevation.
- Buttons are transparent with a 1px border. The primary action is light text color on the dark text color inverse.
- Inputs use a 1px border and a 1px accent focus outline.
- Tables have hairline row dividers, no zebra striping, and surface-color hover.
- Transitions are limited to 100ms color, opacity, background, and border changes. The explorer additionally permits a 320ms count update, a 160ms drawer entrance, and a 280ms hover transform on a closed file's decorative surface. File click areas and open heatmaps never transform.
- Respect `prefers-reduced-motion`.
- One ambient motion treatment is allowed: a faint grey orbit in the lower sidebar and a larger copy at the top right of the main workspace. Each has one arc and dot turning every 96 seconds. The workspace orbit scales from 480px to 720px while keeping a 1px stroke. Both sit behind content, never receive pointer events, and have no effect on layout. Clip the workspace orbit to a dedicated fixed background layer so it cannot create overflow or clip drawers. Reduced motion stops both entirely. Their opacity, speed, and workspace size use the `--ambient-orbit-*` tokens. Do not extend this exception to other decorative animation.

## Data visualization

- The graph canvas must use the measured graph stage, excluding the sidebar, toolbar, and open evidence panel. Initial load, reset, and panel/viewport resizing fit the full bounded neighbourhood. Highlight stored path edges, show direction with small arrows, and keep a 250-node display limit.
- Graph nodes are neutral flat shapes. Type is conveyed by shape, malicious by a red outline, and selection by the accent outline. No particles, glow, pulse, or persistent labels.
- Explorer dimensions use sorted neutral bar tables, and every row is both filterable and inspectable.
- Time activity is a temporal archive: year files are ordered oldest/back to newest/front. There are no tabs; the year sits on the right of each file, and the entire closed file is a button. No file opens by default. Hover moves only the decorative surface and dims siblings; click areas and stacking order stay fixed. Opening a file separates it from its neighbours in normal document flow. When a file is open, other files stay still and dimmed. The open file initially contains only a full-year, seven-row daily heatmap with month labels. Render the IOC list area only after a day is selected and remove it when the day filter is cleared. Keep the heatmap and file header stationary when that area expands or collapses; once visible, keep the list size stable through loading, day changes, and pagination. Use the full-width header to close it. Populated days use five neutral levels based on that year's count quantiles; zero days use the darkest step and only the busiest tenth use the accent.
- Evidence Replay uses a compact confidence step chart, a capture slider, source-presence lanes, and two small SVG neighbourhoods with matching node positions. Prefer changed neighbours when sampling the miniatures. Accent edges/outlines indicate additions; faded absent nodes preserve the positional comparison. Show current versus selected verdicts as text and 1px bars. Mark simulated stages explicitly and never reconstruct historical verdicts from first-seen dates.
- Geo uses a flat equirectangular SVG with unfilled country outlines and 3px semantic dots.
- Timeline is a native range input over a 1px ticked baseline.

## Prohibited patterns

Do not use gradients, shadows, glow, blur, glass effects, background patterns, hero sections, marketing copy, illustrations, decorative cards, emoji, large radii, purple, neon colors, filled semantic badges, pulsing, glitch, typewriter effects, looping animation beyond the single ambient orbit exception, bubble charts, donut charts, or 3D globes. Semantic colors are reserved for text and narrow rules, except for the required small geo dots.
