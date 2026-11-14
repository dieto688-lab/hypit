# Treatment — Bomba del Zar en la Fosa de las Marianas

## Idea

A single narrator carries the argument; seven authored scenes visualize it.
Each narration segment owns one absolute Timeline window (built from the
normalized audio extent, with 0.4 s breaths between segments). Scenes share
those windows, so picture, voice and captions stay locked together.

## Structure (7 scenes, multi-phase)

| # | Window | Scene | Phases |
|---|--------|-------|--------|
| 1 | narration 1 | `hook` | torpedo descends 0→11.000 m → imagined tsunami vs. city, freeze + "?" |
| 2 | narration 2 | `zar` | torpedo + info card (50 Mt, 3.000× Hiroshima) → dot-grid scale |
| 3 | narration 3 | `pressure` | trench + inward pressure arrows (×1.000) → finger + car infographic |
| 4 | narration 4 | `blast` | fireball expands → crushed to a core in 2 s (timer ring) |
| 5 | narration 5 | `rebound` | oscillating bubble rises → glass floor + globe + seismograph spike → surface hump, vapor puff, crossed-out "hongo / estruendo / tsunami" |
| 6 | narration 6 | `bravo` | big vs. small torpedo (×3) → island mushroom cloud to 35 km → fallout map (5 h / 177 km) + figures under ash |
| 7 | narration 7 | `finale` | bar-chart comparison → Earth + "El agua es el mejor escudo del planeta" |

The ten supplied scene prompts are merged into these seven beats (1:1 with
the seven narration segments) so Timeline windows come from audio extents
instead of hand-typed seconds.

## Visual language

Minimalist vector infographic: deep ocean blues, signal red torpedo, amber
accents, white Inter ExtraBold text. All shapes are SVG/CSS; particles
(bubbles, ash, dots) are deterministic canvas drawings. No generated imagery.

## Sound

- Voice: seven supplied narration MP3s, normalized to 48 kHz, placed 1:1.
- Music: synthesized dark pad (A-minor sines + sub pulse + pink-noise ocean),
  looped under the whole piece at low gain.
- Effects: synthesized underwater boom (detonation), alarm (Castle Bravo),
  vapor puff (surface). All generated with ffmpeg lavfi filters.

## Captions

Phrase-level, authored: each scene caption is split on `||` and distributed
across its window proportionally to phrase length. Display uses digits
("50 megatones") while the voice speaks them out ("cincuenta megatones") —
the same display/spoken split as Dual Text. To upgrade to word-level karaoke,
add WhisperX alignment and a CaptionFine track; the scene windows already
provide the Timeline anchors.

## Voice

Spanish male narrator (Arena TTS, voice-00), energetic explainer delivery.
Narration files live in `assets/audio/narration-*.mp3`.
