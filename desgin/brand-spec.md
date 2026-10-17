# Libra Reader — brand spec

Sampled pixel-by-pixel from the reference interface the user supplied
(`image.png`), which supersedes the hex values first stated in the brief. The
measured anchors are paper `#F9F8F6`, stone `#F2F2EF`, hairline `#DFDEDA`,
ink `#1A150E` and a terracotta accent `#91544B`. Converted to OKLch so both
themes derive from the same ladder.

**The system in one sentence:** a contemporary digital library — near-neutral
paper ground, warm brown-black ink doing the work of every primary action, a
single terracotta reserved for the mark and small indicators, and typography
carrying the hierarchy that cards and shadows usually carry.

## Tokens — light (default)

| Token | OKLch | Rendered hex | Role |
|---|---|---|---|
| `--bg` | `oklch(0.979 0.003 85)` | `#F9F8F6` | paper ground — barely warm, near-neutral |
| `--surface` | `oklch(0.960 0.004 100)` | `#F2F2EF` | stone — sidebar, panels, wells |
| `--well` | `oklch(0.970 0.003 92)` | `#F6F5F3` | recessed field between paper and stone |
| `--fg` | `oklch(0.205 0.013 76)` | `#1B1611` | warm brown-black ink |
| `--muted` | `oklch(0.505 0.009 75)` | `#68645F` | metadata, timestamps, labels |
| `--border` | `oklch(0.900 0.005 95)` | `#DFDEDA` | hairline rules, 1px only |
| `--accent` | `oklch(0.514 0.083 29)` | `#91544B` | terracotta — mark, nav state, progress |
| `--accent-text` | `oklch(0.455 0.088 29)` | `#814239` | accent labels sitting on an accent tint |
| `--primary` | `oklch(0.199 0.0155 76)` | `#1A150E` | ink fill for primary buttons |
| `--primary-hover` | `oklch(0.290 0.016 76)` | `#312A22` | lifted ink on hover |
| `--err` / `--warn` | `oklch(0.505 0.175 16)` / `oklch(0.640 0.135 54)` | `#B22641` / `#CA7231` | import failure, duplicate |

## Tokens — dark (warm charcoal, not neutral black)

| Token | OKLch | Rendered hex | Role |
|---|---|---|---|
| `--bg` | `oklch(0.198 0.005 75)` | `#171513` | warm charcoal ground |
| `--surface` | `oklch(0.246 0.005 75)` | `#22201E` | raised warm charcoal |
| `--fg` | `oklch(0.932 0.005 85)` | `#EAE8E5` | warm off-white ink |
| `--muted` | `oklch(0.745 0.007 80)` | `#AFACA7` | metadata |
| `--border` | `oklch(0.345 0.005 75)` | `#3B3936` | hairline |
| `--accent` / `--primary` | `oklch(0.730 0.075 38)` | `#D29886` | lifted terracotta, readable on charcoal |
| `--accent-text` | `oklch(0.775 0.072 38)` | `#DFA695` | accent labels on an accent tint |

Neither theme uses pure black or pure white. `--bg`, `--surface`, `--border`,
`--accent` and `--primary` reproduce the sampled reference hex exactly; the
muted values were pushed darker in light mode and lighter in dark mode until
every metadata row and accent label cleared 4.5:1. The error red was rotated
off hue 32 to hue 16 so it can no longer be confused with the terracotta
accent, and the reference's small warm orange (`#E08038`) survives as the
`--warn` duplicate-item state rather than as a second accent.

## Highlight palette (4 colors, semantic-free — user's own taxonomy)

| Name | Light | Dark |
|---|---|---|
| Yellow | `oklch(0.925 0.080 96)` | `oklch(0.47 0.072 96)` |
| Sage | `oklch(0.908 0.044 152)` | `oklch(0.44 0.046 152)` |
| Blue | `oklch(0.908 0.040 238)` | `oklch(0.44 0.044 248)` |
| Blush | `oklch(0.908 0.042 10)` | `oklch(0.45 0.050 10)` |

Chroma came down a touch across all four so the washes stay quiet on the
lighter, less yellow paper, and blush rotated to hue 10 to hold its distance
from the terracotta accent.

Each highlight also carries a name in its chip, so color is never the only
signal.

## Type

- **Display / reading:** `Newsreader` — optical-size serif, used for article
  bodies, titles, and library item titles. Fallback: `Iowan Old Style, Source
  Serif 4, Georgia, serif`.
- **UI:** `Archivo` for navigation, metadata, and controls — a true grotesque
  standing in for the Söhne-like face the brief asked for, chosen because it
  holds its counters at 11-13px where most of the interface lives. Fallback:
  `-apple-system, Segoe UI, Helvetica Neue, Arial, sans-serif`.
- **Mono:** `ui-monospace, SFMono-Regular, Menlo, monospace` — shortcuts,
  counts, source URLs.
- Three weights only: 400 read / 500 emphasize / 600 announce.
- ALL-CAPS labels always carry `letter-spacing: 0.09em` and never drop below
  11.5px; display ≥32px carries `-0.02em`.

## Posture rules

1. **Hairlines, not cards.** Structure comes from 1px `--border` rules and
   whitespace. Shadows appear only on genuinely floating layers (popovers,
   modals, toasts) and never exceed a 24px soft blur at ≤12% alpha.
2. **Primary actions are ink, not accent.** Following the reference, the
   Add-content button, every `.btn.prime` and the mobile FAB are filled with
   `--primary` (near-black) on paper text. Terracotta is reserved for the
   wordmark, the current nav item, progress fills and focus rings — small
   indicators, never a large field.
3. **Titles are serif and dominant; metadata is sans, 13px, muted.** The
   contrast between the two families is the main hierarchy device.
4. **Radii stay small** — 6px for controls, 10px for panels, 2px for highlight
   marks. Nothing is a pill except status chips.
5. **No photographic thumbnails.** Items carry a letterpress-style bookplate:
   publication monogram in Newsreader on a tinted stone field, tinted by
   content type. It reads as a library spine label, not a missing image.
