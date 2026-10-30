# Squeek Escape

A cute pixel endless runner whose speed comes from a real hamster wheel. The page reads
`https://api.squeekchain.com/v1/status` every two seconds and drives the game from it:

| Wheel (`measurement.coreStatus`) | In the game |
| --- | --- |
| `SPINNING` | Day mode, full speed. World speed is `0.9 + speedMmPerSecond / 1000`, clamped to ×1.1–×1.9. Dust particles, speed lines above ×1.3 and random squeaks. |
| `IDLE` | The hamster sleeps (eyes shut, floating Z's, soft snores), the whole page switches to night, the simulation runs at ×0.4 slow motion, and a big "The hamster is currently sleeping…" message sits over the scene. |
| Unreachable or stale (no report within `staleAfterSeconds`) | "Wheel offline" chip and a note in the scene. The run continues at ×1.0 in day mode and the feed is retried with backoff (2 s doubling to 15 s). |

The top strip shows the live block height and progress to the next block from `builder.projected`
(`blockProgress / 1e9`, since `cumulativeBlockUnits = blockHeight × 10⁹ + blockProgress`).

Play: tap the scene, click it, or press Space, ↑ or W to jump; jump again in midair for a double
jump. Enter starts a run. Seeds score 5, golden acorns 50, and every fifth seed in a row raises the
seed combo (up to ×5). Distance adds a point per metre and the pace ramps up over two minutes. The best
score and the sound setting are saved in this browser's `localStorage`
(`squeek-escape:best`, `squeek-escape:sound`). Nothing is shared between visitors.

## Install, preview, rebuild

Requires Node 20+ and npm.

```sh
npm ci            # install exact versions from package-lock.json
npm run dev       # local dev server with hot reload
npm run build     # typecheck (tsc --noEmit), then production build into dist/
npm run preview   # serve the built dist/ locally
npm run typecheck # typecheck only
```

`dist/` is committed and is the deliverable: a static export with relative asset URLs
(`base: "./"` in `vite.config.ts`), so it works from any subpath, an IPFS gateway or an ENS name.
Rebuild and commit `dist/` after every source change.

The favicon and share image are generated from the hamster sprite in `src/game/sprites.ts`:

```sh
node scripts/make-art.mjs                                  # favicon.svg only
node scripts/make-art.mjs /path/to/playwright/index.mjs    # favicon.svg and og.png (needs Playwright)
```

## Layout

```
index.html            title, description, favicon, og/twitter tags
src/main.tsx          entry, loads the Pixelify Sans 600 font
src/App.tsx           page shell: header, chain strip, stage overlays, stats, about
src/wheel.ts          status polling, payload parsing, speed mapping
src/game/engine.ts    canvas game loop, physics, spawning, drawing
src/game/sprites.ts   pixel sprites and palette
src/audio.ts          WebAudio squeaks (no audio files)
src/storage.ts        localStorage helpers
src/styles.css        design tokens and component styles (see DESIGN.md)
public/               favicon.svg, og.png
scripts/make-art.mjs  regenerates favicon and share image
dist/                 committed production export
```

## Validation (worker-run, 2026-10-30)

These are the checks run on this machine against the final export. They are the worker's own
results, not an independent certification. The full record (assumptions, per-domain coverage,
`file:line` findings) is `artifacts/validation.md`, which is delivered as a separate artifact rather
than committed.

| Check | Command | Result |
| --- | --- | --- |
| Typecheck + production build | `npm run build` | Pass: `tsc --noEmit` clean, Vite 6.4.5 built 33 modules, JS 54 kB gzip |
| Design probe (taste@1) | `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | 16/16 checks pass at 320, 390 and 1440 against the live API (wheel was IDLE) |
| Interaction suite, Chromium | Playwright script serving `dist/` at a `/sub/` path with the API mocked as IDLE, SPINNING and unreachable | 99 checks pass at 390, 1440 and 320 (see validation notes) |
| Keyboard, live switch, sound, reduced motion | second Playwright script | 13/13 pass |
| Payload parsing against the real feed | `node --experimental-strip-types` test of `parseStatus` on a live response | 6/6 pass |

Design review (Better Interface, all six domains: accessibility, layout, writing, typography,
colors, UI) was applied while building and then run on the export. Ten findings were fixed and rechecked:

- High: at 320 the Start button was clipped when the sleeping message showed. The stage is now
  square below 30rem (`src/styles.css`, `.stage`).
- Medium: first-screen prose was over budget at 390 (88 words, now 60); the sun/moon sat under the
  HUD and the headline; the hamster was too small on phones (the world width now adapts); the
  sleeping headline broke one word per line at 1440.
- Low: orphaned stat card, focus ring after mouse starts, hard-coded hover colour, pixel stretch on
  landscape phones, `aria-label` on a paragraph.

Limitations: WebKit (Safari) could not be launched on this machine (missing host libraries), so
no Safari run was done. Audio was not listened to. No physical phone or screen reader was used.
During this session the real wheel only ever reported `IDLE`, so the spinning state was checked with
mocked responses only.
