# Frontend design system

IOC Feed is an internal engineering utility. Its visual language is dense, quiet, text-first, and deliberately closer to a terminal or database client than a product website.

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
| `--color-heat-0..4`      | five fixed steps | reserved legacy scale                    |

JetBrains Mono is the only typeface. Body text is 13px with 1.5 line height. Section headings are 11px uppercase secondary text or 600 weight. Spacing follows a 4px scale. Corner radius is at most 2px; tables have square corners.

## Layout and controls

- Use the fixed 184px text sidebar, main workspace, and 28px single-line status bar.
- Panels use a 1px border and no elevation.
- Buttons are transparent with a 1px border. The primary action is light text color on the dark text color inverse.
- Inputs use a 1px border and a 1px accent focus outline.
- Tables have hairline row dividers, no zebra striping, and surface-color hover.
- Transitions are limited to 100ms color, opacity, background, and border changes. The explorer additionally permits a 320ms count update and a 160ms drawer entrance.
- Respect `prefers-reduced-motion`.

## Data visualization

- Graph nodes are neutral flat shapes. Type is conveyed by shape, malicious by a red outline, and selection by the accent outline. No particles, glow, pulse, or persistent labels.
- Explorer dimensions use sorted neutral bar tables, and every row is both filterable and inspectable.
- Time activity uses a GitHub-style seven-row heat map. Cells use four grey intensity steps, with the accent reserved for the highest bucket.
- Geo uses a flat equirectangular SVG with unfilled country outlines and 3px semantic dots.
- Timeline is a native range input over a 1px ticked baseline.

## Prohibited patterns

Do not use gradients, shadows, glow, blur, glass effects, background patterns, hero sections, marketing copy, illustrations, decorative cards, emoji, large radii, purple, neon colors, filled semantic badges, pulsing, glitch, typewriter effects, looping animation, bubble charts, donut charts, or 3D globes. Semantic colors are reserved for text and narrow rules, except for the required small geo dots.
