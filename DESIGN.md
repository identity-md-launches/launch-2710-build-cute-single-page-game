# Squeek Escape design

## Overview

Squeek Escape is a one-page pixel game for casual players on phones and desktops. The pixel scene
is the product and fills the first screen right under a slim header and the live chain strip. Everything
else (help, stats, about) sits below the scene and is secondary.

The look is a warm, toy-like pixel style: chunky Pixelify Sans for anything game-like (title,
numbers, the button, headings), a plain system sans for sentences, soft rounded surfaces lifted by a
light shadow, and one sunny yellow action colour. The page has two themes that follow the real wheel
rather than a user setting: **day** (cream page, blue sky) while the wheel spins or is offline, and
**night** (deep indigo) when the wheel reports `IDLE`. The theme is set as `data-theme` on `<html>`
in `src/App.tsx` (effect after `const night = wheel.mode === "idle"`).

## Colors

All tokens are CSS custom properties in `src/styles.css` (`:root` for day,
`:root[data-theme="night"]` for night). Hex is the canonical format.

| Token | Day | Night | Use |
| --- | --- | --- | --- |
| `--bg` | `#fff4e0` | `#141a40` | Page background |
| `--surface` | `#ffffff` | `#222a5e` | Cards, result panel, sound button |
| `--ink` | `#3b2414` | `#f4efff` | Primary text |
| `--ink-muted` | `#6b4a31` | `#c9c5ee` | Labels, help text, percent, meta |
| `--accent` | `#ffd23f` | same | Primary button fill |
| `--accent-hover` | `#ffdc66` | same | Primary button hover (hover-capable pointers only) |
| `--accent-ink` | `#2b1a10` | same | Text on the accent |
| `--track` | `#f1dcc0` | `#333b78` | Progress bar track |
| `--fill` | `#e8743b` | `#a99bff` | Progress fill; idle status dot |
| `--live` | `#2f9e44` | `#a99bff` | Spinning status dot |
| `--focus` | `#1f6feb` | `#ffd23f` | `:focus-visible` outline |
| `--stage-sky` | `#7ccbff` | `#141a40` | Stage background behind the canvas |
| `--stage-ink` | `#2b1a10` | `#ffffff` | HUD and notes drawn over the scene |
| `--stage-text-shadow` | white 45% | black 50% | 2px pixel drop shadow for text over the scene |
| `--shadow` | brown 12% layers | black 30% layers | Elevation for surfaces |

Status is never colour alone: the chip always carries text ("Wheel spinning, 700 mm/s", "Wheel
idle", "Wheel offline").

Scene colours live in code, not tokens: sprite palette `PALETTE` in `src/game/sprites.ts` (fur
`#f2a65a`, outline `#5a3a22`, belly `#fff1d6`, pink `#f78fa7`, …) and the sky, hills, fence and
bedding pairs in `Game.draw()` in `src/game/engine.ts`, each mixed from a day colour to a night
colour by the eased `night` value (0–1).

Contrast ratios computed from these token values (not measured on rendered pixels): ink on bg 13.3:1
(day) and 14.9:1 (night); muted on bg 7.3:1 and 10.2:1; accent ink on accent 11.6:1; stage ink on
the top sky band 9.4:1 (day); white on the night sky 10.9–16.8:1.

## Typography

| Role | Family | Size token | Weight | Line height |
| --- | --- | --- | --- | --- |
| Brand title `h1` | `--font-display` | `--text-xl` 1.75rem | 600 | 1.1 |
| Sleeping headline | display | `--text-xl`, `--text-2xl` 2.5rem from 40rem | 600 | 1.1 |
| Score | display | `--text-xl` | 600 | 1.1 |
| Block height, button, stat values, result, `h2` | display | `--text-lg` 1.25rem | 600 | 1.1 |
| Best and combo in the HUD | display | `--text-md` 1rem | 600 | 1.1 |
| Body text | `--font-body` | `--text-md` | 400 | 1.5 |
| Labels, help, percent, meta, status chip | body | `--text-sm` 0.875rem | 400 (chip 600) | 1.5 |

- `--font-display`: "Pixelify Sans" 600, bundled from `@fontsource/pixelify-sans/600.css`
  (imported in `src/main.tsx`, woff2 with woff fallback, subset by `unicode-range`), falling back
  to `ui-monospace`. Only weight 600 is loaded; do not request other weights.
- `--font-body`: `system-ui` stack. Weights 400 and 600.
- Five sizes in total (`--text-sm` to `--text-2xl`). Do not add more.
- Changing numbers use `.num` (`font-variant-numeric: tabular-nums`).
- Headings use `text-wrap: balance`, descriptions `text-wrap: pretty`; the about copy is capped at
  `65ch`. Sentence case everywhere, no tracked capitals.

## Layout

- Page column: `.page`, `max-inline-size: 60rem` (`--page-max`), centred, inline padding
  `max(1rem, safe-area inset)`.
- Spacing scale: `--space-1` 0.25rem, `-2` 0.5rem, `-3` 0.75rem, `-4` 1rem, `-6` 1.5rem,
  `-8` 2rem. Inside a group use 0.25–0.5rem, between groups 0.75rem or more.
- Order: header (`.topbar`: brand at the leading edge, sound button at the trailing edge), live
  chain strip (`.chain`), stage, help line, stats, about.
- Breakpoints (content-driven):
  - Below 30rem the stage is square (`aspect-ratio: 1 / 1`) so the sleeping headline, note and
    start panel fit at 320px. 30rem and up: 4:3. 40rem and up: 16:9, sleeping headline grows to
    `--text-2xl`, stats go to three columns.
  - `.chain` is two rows (block + status chip, then the full-width progress bar) below 46rem and one
    row from 46rem.
  - `.stats` is two columns below 40rem; an odd last card spans both.
- The stage height is also capped at `72svh` so landscape phones keep the button on screen; the
  engine reads the stage's real size on resize.
- Logical properties throughout (`inline-size`, `margin-inline`, `padding-block`, …).

### The pixel world

`Game.resize()` in `src/game/engine.ts` sets the canvas's backing size to a small logical world:
width is the stage's CSS width / `PIXEL_SCALE` (2.6), clamped to 140–220 px, height follows the
stage's aspect ratio (minimum 64). The canvas is stretched with `image-rendering: pixelated`, so one
logical pixel is about 2–4 CSS pixels. The ground strip is 16 px; the hamster is 16×12 and stands at
x = 28. The sun/moon sits in the trailing top corner (`orbX = W - 22`) so it stays clear of the HUD
and the centred headline.

## Elevation & Depth

One shadow token, `--shadow` (two layered soft shadows), on the stage, the sound button, stat cards and
the result panel. Surfaces never have both a border and a shadow, and cards are never nested. The
primary button uses an inset bottom shadow (`inset 0 -4px 0 rgb(0 0 0 / 0.18)`) to look like a
pressable pixel key. Overlay text over the canvas uses `--stage-text-shadow`, a 2px hard drop shadow
in the pixel style.

## Shapes

`--radius-sm` 6px (brand link focus area), `--radius-md` 12px (buttons, stat cards),
`--radius-lg` 18px (stage, result panel). The progress bar uses 3px with an 8px stepped highlight
pattern on the fill; status dots are 10px squares with 2px corners to read as pixels.

## Components

All in `src/App.tsx` and `src/styles.css`; none are a published library.

- **Brand link** (`.brand`): favicon sprite (decorative `alt=""`) + `h1`; reloads the page. At least
  44px tall.
- **Icon button** (`.icon-btn`): 44×44, surface + shadow. The sound toggle uses `aria-pressed`
  with a fixed `aria-label="Sound"`; its icon (`SoundIcon`) is drawn in pixel paths with
  `currentColor`.
- **Chain strip** (`ChainBar`): block height in display type, a `role="progressbar"` bar with
  `aria-valuenow` and a label naming the next block, and the status chip (`.chip--spinning`,
  `.chip--idle`, `.chip--offline`, `.chip--connecting`). Shows "…" for height until the first
  reading.
- **Stage** (`.stage`): focusable group (`tabIndex=0`, `aria-describedby="how-to"`) holding the
  canvas (`aria-hidden`) and `.stage__overlay`, a vertical flex column with `pointer-events: none`
  except on buttons. Children in order: `.hud` (score, best, combo), `.sleep` (IDLE only) or
  `.sleep__note--solo` (offline only), and `.panel` (ready and game-over only). Pointer down
  anywhere on the stage jumps or starts; `touch-action: manipulation` avoids double-tap zoom.
- **Primary button** (`.btn`): accent fill, display type, 48px tall, `scale: 0.96` on press when
  motion is allowed. Labels: "Start running", "Run again". After a crash, focus moves to "Run again"
  after a 600 ms cooldown that also guards against accidental restarts.
- **Stat card** (`.stat` in a `dl.stats`): muted `dt` label above a display-type `dd` value.
- **Live region**: a stable visually hidden `role="status"` paragraph announces game over and wheel
  state changes.

States: connecting (chip text, height "…"), spinning, idle (night + sleeping message), offline
(note in scene, retry with backoff), ready, playing, game over (result + new best).

Keyboard: Space, ↑ or W jumps (or starts when not playing); Enter starts. Key handling is on
`window` and ignores keys whose target is a button, link or field, so Space on the sound button
toggles sound. A keyboard start moves focus to the stage so its `--focus` ring shows; pointer starts
leave focus alone.

Motion: CSS transitions name their properties (`background-color, color` on the body for the slow
day/night fade, `inline-size` on the progress fill, `scale` on press) and sit inside
`prefers-reduced-motion: no-preference`. The sleeping headline's dim pulse runs 3 times, not forever.
Under reduced motion the engine stops the attract scroll before a run, star twinkle, seed bobbing,
the run bounce, screen shake and speed lines, and cuts particles to a third.

## Do's and Don'ts

- Do put any new game-related screen inside `.stage__overlay` as another flex child; never position
  overlay text absolutely over other overlay text.
- Do take colours from the tokens above; a new state gets a token in both `:root` blocks.
- Do use `--font-display` 600 only for short game text and numbers; sentences use `--font-body`.
- Do keep the scene and its main button on the first screen at 390px wide; check 320px with the
  sleeping message showing, which is the tallest overlay.
- Don't add a theme toggle: day and night belong to the wheel.
- Don't add type sizes, weights or a third family, and don't add borders to shadowed surfaces.
- Don't show anything as live that the feed doesn't report; the best score is local to the browser
  and says so.

Recipe for another section: add a `<section>` inside `<main>` after `.about`, give it an `h2` styled
like `.about h2`, body copy in `--text-md` capped at `65ch`, and reuse `.stat` cards or `.btn` for
any controls.
