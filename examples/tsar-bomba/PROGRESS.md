# Progress

- [x] Narration generated (7 segments, Spanish, voice-00) — `assets/audio/narration-*.mp3`
- [x] Music + SFX synthesized with ffmpeg lavfi — `assets/audio/music.mp3`, `sfx-*.wav`
- [x] Component `@example/tsar-scenes` authored and built
- [x] `authors/main.svml` checks clean; 3 s smoke render verified
- [x] Full render (`final.svrun` → `final.video`) — build `bld_20261114T015057284Z_FF25C85C0A`, 3677 frames, 122.6 s
- [x] Frame review of all 7 scenes; fixed depth-label overlap, mushroom growth origin, figure heads, dot/caption overlap
- [x] Exported `final.mp4` (1080×1920, 30 fps, H.264 + AAC 48 kHz; mean −23.5 dB, max −3.4 dB)

## Sandbox tooling (this machine only)

The sandbox has no system ffmpeg/ffprobe/Chrome and no access to the Chrome
for Testing CDN, so the Runtime points at locally obtained binaries:

- ffmpeg 9.0.2 via `pip install imageio-ffmpeg` (PyPI) → `/tmp/hypit-tools/ffmpeg`
- ffprobe via PyAV shim → `tools/ffprobe-shim.py` (symlinked to `/tmp/hypit-tools/ffprobe`)
- Chromium 153 via `@sparticuz/chromium` (npm) → `/tmp/chrome/chromium`,
  libs in `/tmp/chromelibs/lib` (run builds with `LD_LIBRARY_PATH=/tmp/chromelibs/lib`)

On a normal machine, replace these with a real ffmpeg/ffprobe and the managed
browser (`hypit programs prepare --endpoint html.local`) and drop the shim.
See README.md.
