# NAPOLEÓN · ¿Por qué no se detuvo?

Documental animado corto (16:9 · 1920×1080 · 30 fps · 4 min 12 s), construido en la línea visual de
*History Matters*: mapas planos que se recolorean, tipografía contundente, sellos con sobreimpulso y
una pregunta analítica que se responde en cinco partes.

- **Vídeo:** [`output/napoleon.mp4`](output/napoleon.mp4)
- **Guion completo:** [`GUION.md`](GUION.md)
- **Locución:** [`audio/`](audio) (7 bloques)
- **Generador:** [`build.js`](build.js) + [`lib/`](lib)

## Estructura de la pieza

| # | Bloque | Imagen | Audio |
|---|---|---|---|
| 1 | Introducción y dilema | 1799 → 1812, el imperio azul crece por oleadas | locución |
| 2 | El dilema | pregunta a pantalla completa; el correo París–Madrid | locución |
| 3 | El obstáculo | Canal de la Mancha, Trafalgar, la Royal Navy | locución |
| 4 | Guerra económica | Sistema Continental + sus tres fallos | música y cartelas |
| 5 | Las paces | Amiens, 14 meses, anexiones en paz, Pressburg→Schönbrunn | locución |
| 6 | Carácter y aliados | curva de victorias, vasallos "obligados" | locución |
| 7 | Ideología | coronas, ondas revolucionarias, confianza al 0 % | música y cartelas |
| 8 | Oferta rechazada | Congreso de Praga 1813 → "RECHAZADA" → Elba | locución |
| 9 | Desenlace | Waterloo, Santa Elena, vuelta al mapa de partida | locución |

Los bloques 4 y 7 quedaron sin narración en esta versión: el guion completo de esas escenas está en
[`GUION.md`](GUION.md) y su ritmo se sostiene con cartelas y música. Para narrarlos, genera dos
clips nuevos con el texto del guion y añádelos a `PLAN` en `build.js` (la clave `silent-04` /
`silent-07` pasa a `vo-04` / `vo-07`).

## Cómo está hecho

Nada de vídeo generativo: cada fotograma se dibuja por código y se codifica con ffmpeg.

1. **Mapa base** — Natural Earth 110m (`world-atlas`), proyección Mercator propia sobre un espacio de
   mundo en píxeles, para poder mover una cámara con `lon`/`lat`/`zoom`
   (`fitBox()` encuadra cualquier caja geográfica).
2. **Territorios históricos** — recortes y uniones con `polygon-clipping` sobre fronteras modernas
   (p. ej. Renania = Alemania al oeste del Rin; Gran Ducado de Varsovia = Polonia menos Prusia
   Oriental; Nápoles = Italia al sur del paralelo 42,55).
3. **Escenas** — `lib/scenes.js`: cada función recibe `t ∈ [0,1]` y pinta un fotograma completo
   (cámara, paneles, flechas, sellos, gráficos).
4. **HUD** — `lib/ui.js`: sello de año, etiquetas de parte, captions palabra a palabra, tarjetas
   apiladas que no se solapan, explosiones, coronas, medidores.
5. **Montaje** — `build.js`: temporiza la locución, dibuja los 7 568 fotogramas a 30 fps y los canaliza
   a `ffmpeg` (x264, yuv420p). Después `audio.mjs` mezcla la voz, una cama musical procedural
   generada con `aevalsrc` y aplica *ducking* por sidechain + `loudnorm`.

## Reproducir

```bash
npm install            # @napi-rs/canvas, world-atlas, topojson-client, polygon-clipping, fuentes
npm run build          # render completo (~4 min en 2 vCPU) -> output/napoleon.mp4
npm run scene -- 0.95  # un fotograma suelto para revisar composición
```

`build.js` necesita `ffmpeg`. Si no está en el sistema, el script lo toma de
`python3 -m pip install imageio-ffmpeg`; también puedes exportar `FFMPEG=/ruta/a/ffmpeg`.

## Criterio de estilo (la "fórmula History Matters")

- El mapa nunca se queda quieto: cada afirmación mueve una frontera, un color o una flecha.
- Una idea por plano, y un solo foco de texto en pantalla a la vez.
- Humor seco en la locución ("un enemigo con horario de oficina", "dato curioso: ... fue una isla"),
  nunca en la imagen.
- Las cifras se dicen en pantalla, no en el texto: `130 departamentos`, `44 M de súbditos`,
  `14 meses`, `0 % de confianza`, `1.900 km de casa`.

## Precisión histórica

El mapa es una **caricatura explicativa**, no un atlas. Los recortes por fronteras modernas producen
bordes algo esquemáticos (Renania, Iliria, el Gran Ducado). Las fechas y los hechos siguen la
cronología estándar: Amiens (marzo de 1802 – mayo de 1803), Trafalgar (octubre de 1805), Bloqueo
Continental (decreto de Berlín, noviembre de 1806), Pressburg (1805), Tilsit (1807), Schönbrunn (1809),
campaña de Rusia (1812), Congreso de Praga (1813), abdicación (abril de 1814), Waterloo (junio de 1815),
Santa Elena (1815 – 1821).
