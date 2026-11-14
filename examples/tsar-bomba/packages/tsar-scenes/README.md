# Tsar scenes

A project component that renders the seven authored explainer scenes for the
Tsar Bomba vertical video. Each `Scene` has a kind, an absolute window and a
caption string whose `||`-separated phrases are distributed across the window
proportionally to their length. The component owns layout, animation and
caption visibility; timing arrives as windows from the Timeline.

```svml
<tsar:Scenes id="scenes" timeline={program.timeline} within={canvas.bounds}
  font={font} during={program.window} caption-size="54">
  <tsar:Scene id="s1" kind="hook" during={program.s1}
    caption="Phrase one || Phrase two"/>
</tsar:Scenes>
```

Kinds: `hook`, `zar`, `pressure`, `blast`, `rebound`, `bravo`, `finale`.
All text is authored as typed text elements; the HTML program only toggles
visibility and transforms per frame, so scrubbing and range rendering stay
exact. Compile with `npm run build` (or `pnpm --filter @example/tsar-scenes build`).
