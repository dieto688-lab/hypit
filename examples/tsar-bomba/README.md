# Bomba del Zar en la Fosa de las Marianas (vertical explainer)

A ~2 minute 1080×1920 Spanish explainer: what happens if the Tsar Bomba
detonates at the bottom of the Mariana Trench — and why Castle Bravo on an
island was far worse. All visuals are authored vector components; narration,
music and effects are supplied/synthesized audio. No generation services.

## Run

From the repository root (after `pnpm install` and building the component):

```bash
pnpm --filter @example/tsar-scenes build
node bin/hypit.mjs check examples/tsar-bomba/authors/main.svml --project examples/tsar-bomba
node bin/hypit.mjs build examples/tsar-bomba/final.svrun --project examples/tsar-bomba --runtime examples/tsar-bomba/hypit.runtime.json --follow
node bin/hypit.mjs get <build-id> --output final.video --project examples/tsar-bomba --to final.mp4
```

`test.svrun` renders the first 3 seconds for quick previews.

## Runtime

`hypit.runtime.json` selects local media + HTML rendering. On a normal machine:

- install ffmpeg/ffprobe on `PATH` (or set `ffmpegPath`/`ffprobePath`),
- prepare the managed browser: `hypit programs prepare --runtime examples/tsar-bomba/hypit.runtime.json --endpoint html.local`,
- remove the sandbox `chromePath`/`browserGpu` overrides if you prefer the managed browser.

This sandbox used a PyAV ffprobe shim (`tools/ffprobe-shim.py`), an
imageio-ffmpeg binary and a bundled Chromium; see PROGRESS.md. The shim is
only needed where a real ffprobe is unavailable.

## Layout

- `authors/` — `main.svml` (Timeline, scenes, audio, film), `assets.svml`, `composition.svs`
- `packages/tsar-scenes/` — the seven-scene component
- `assets/audio/` — narration, music, effects
- `BRIEF.md`, `TREATMENT.md`, `PROGRESS.md` — production notes
