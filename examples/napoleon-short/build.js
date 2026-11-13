'use strict';
// ---------------------------------------------------------------------------
// build.js — composes the short: scene list, voice-over timing, subtitles,
// music bed render and the final H.264 encode.
// ---------------------------------------------------------------------------
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { createCanvas } = require('@napi-rs/canvas');
const M = require('./lib/map');
const S = require('./lib/scenes');

const FF = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'])
  .toString().trim();
const FPS = 30;
const OUT = path.join(__dirname, 'out');

const audioDir = path.join(__dirname, 'audio');
function dur(file) {
  const out = execFileSync(FF, ['-hide_banner', '-i', file], { stdio: ['ignore', 'pipe', 'pipe'] });
  return 0;
}
function probe(file) {
  return new Promise((res) => {
    const p = spawn(FF, ['-hide_banner', '-i', file]);
    let err = '';
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', () => {
      const m = err.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
      res(m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0);
    });
  });
}

// ------------------------------------------------------------ voice timing
// Each scene: its script block, the visual renderer, and the scene's own
// silent beats (frozen map moments used for chapter cards).
const PLAN = [
  { id: 'vo-01', scene: 'rise', fn: S.rise, durOverride: 27.2 },
  { id: 'vo-02', scene: 'question', fn: S.question, durOverride: 18.4 },
  { id: 'vo-03', scene: 'channel', fn: S.channel, durOverride: 23.8 },
  { id: 'silent-04', scene: 'blockade', fn: S.blockade, silent: 33 },
  { id: 'vo-05', scene: 'peace', fn: S.peace, durOverride: 31.5 },
  { id: 'vo-06', scene: 'character', fn: S.character, durOverride: 37.3 },
  { id: 'silent-07', scene: 'ideology', fn: S.ideology, silent: 24 },
  { id: 'vo-08', scene: 'rejected', fn: S.rejected, durOverride: 26.2 },
  { id: 'vo-09', scene: 'outro', fn: S.outro, durOverride: 26.8 },
];

// subtitle text: on-screen captions are short fragments, not the full VO
const CAPTIONS = {
  'vo-01': [
    '1799. Francia, sola y agotada.',
    '1812. Europa, entera, en azul.',
    'Un corso de metro sesenta y ocho.',
    'Tronos repartidos entre hermanos.',
  ],
  'vo-02': [
    'Su imperio era enorme.',
    'Cruzar su territorio costaba más',
    'que llegar al enemigo.',
    'Entonces, ¿por qué no paró?',
    '¿Por qué no fundó una dinastía?',
  ],
  'vo-03': [
    'Porque había un detalle: Gran Bretaña.',
    'Napoleón no podía invadirla.',
    'El Canal era de la Royal Navy.',
    'Trafalgar, 1805.',
    'La flota, al fondo del mar.',
    'Así que cambió de arma.',
  ],
  'silent-04': [
    'Si no puede invadir: asfixia.',
    'El Sistema Continental, 1806.',
    'Cerrar Europa al comercio británico.',
    'Magnífico sobre el papel.',
    'En la práctica: tres grietas.',
    'Uno: los aliados no se arruinan.',
    'Dos: el contrabando.',
    'Tres: el contra-bloqueo.',
  ],
  'silent-07': [
    'Y la tercera: la ideología.',
    'No temían al general.',
    'Temían la idea.',
    'Código civil, constitución,',
    'fin de los privilegios.',
    'La confianza estaba a cero.',
  ],
  'vo-05': [
    '¿Y las oportunidades de paz?',
    'Amiens, 1802. Catorce meses.',
    'Lo que tarda una tregua',
    'en convertirse en provocación.',
    'Piamonte, Suiza, el imperio.',
    'Firma, celebra, anexiona, repite.',
  ],
  'vo-06': [
    'Primera razón: el carácter.',
    'Su legitimidad era la victoria.',
    'Ceder un centímetro era un límite.',
    'Segunda: no tenía aliados.',
    'Tenía vasallos.',
    'Obligados, no convencidos.',
    'Un aliado humillado es un enemigo.',
  ],
  'vo-08': [
    '1813. Después de Rusia,',
    'las potencias ofrecen un acuerdo.',
    'Conservar Francia.',
    'Napoleón duda. Negocia.',
    'Y rechaza.',
    'Cree que aún puede ganar.',
    'Y no se fía de nadie.',
    '1814. París cae. Elba.',
  ],
  'vo-09': [
    'Cien días. Waterloo. 1815.',
    'Otra isla. Más lejos.',
    'Santa Elena: 1.900 km.',
    'El mapa vuelve a su sitio.',
    'La paz que nunca firmó',
    'duró hasta que él murió.',
    'No fue una paz. Fue una isla.',
  ],
};

// shared word timing: spread caption fragments evenly inside the clip
function timedCaptions(id, clipDur) {
  const frags = CAPTIONS[id] || [];
  if (!frags.length) return [];
  const avail = Math.max(1, clipDur - 0.2);
  const per = avail / frags.length;
  return frags.map((f, i) => ({ text: f, s: 0.1 + i * per, e: 0.1 + (i + 1) * per }));
}

// --------------------------------------------------------------- music bed
// A tiny procedural score: low pulsing drone + brushed rhythm, silenced for
// narration (ducking is applied in the audio mix, not here).
async function renderMusic(total, out) {
  const p = spawn(FF, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i',
    `aevalsrc=0.10*sin(2*PI*55*t)+0.05*sin(2*PI*110*t)*gt(sin(2*PI*0.5*t)\,0):s=44100:d=${total}`,
    '-f', 'lavfi', '-i',
    `aevalsrc=0.05*sin(2*PI*220*t)*pow(max(0\,sin(2*PI*2*t))\,8):s=44100:d=${total}`,
    '-filter_complex', '[0:a][1:a]amix=inputs=2:weights=1 0.6,lowpass=f=900,volume=1.0[a]',
    '-map', '[a]', '-c:a', 'pcm_s16le', out,
  ], { stdio: 'ignore' });
  await new Promise((r) => p.on('close', r));
}

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const clips = [];
  let at = 0;
  const GAP = 0.35; // breath between scenes
  for (const item of PLAN) {
    const d = item.silent ? item.silent : item.durOverride;
    clips.push({ ...item, dur: d, start: at, file: item.silent ? null : path.join(audioDir, `${item.id}.mp3`) });
    at += d + GAP;
  }
  const total = at + 0.9;
  console.log('scenes', clips.length, 'total', total.toFixed(2), 's');

  // 2) video
  const canvas = createCanvas(M.W, M.H);
  const ctx = canvas.getContext('2d');
  const video = path.join(OUT, 'video.mp4');
  const ff = spawn(FF, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${M.W}x${M.H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', video,
  ], { stdio: ['pipe', 'ignore', 'inherit'] });

  const frames = Math.ceil(total * FPS);
  let written = 0;
  const t0 = Date.now();

  const write = (buf) => new Promise((res) => {
    if (!ff.stdin.write(buf)) ff.stdin.once('drain', res);
    else res();
  });

  for (let f = 0; f < frames; f++) {
    const time = f / FPS;
    const clip = clips.find((c) => time >= c.start && time < c.start + c.dur + GAP) || clips[clips.length - 1];
    const local = Math.min(1, Math.max(0, (time - clip.start) / clip.dur));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, M.W, M.H);
    clip.fn(ctx, local);

    // captions
    const caps = timedCaptions(clip.id, clip.dur);
    const hideCaps = clip.id === 'vo-09' && local > 0.78;
    const idx = hideCaps ? -1 : caps.findIndex((c) => local >= c.s && local < c.e);
    if (idx >= 0) {
      const wordT = (local - caps[idx].s) * 8;
      const words = caps[idx].text.split(' ').map((w, i) => ({ t: w, s: i / 8, e: (i + 1) / 8 }));
      require('./lib/ui').drawCaptions(ctx, words, wordT, { size: 54, y: 1010 });
    }

    const buf = Buffer.from(ctx.getImageData(0, 0, M.W, M.H).data.buffer);
    await write(buf);
    written++;
    if (f % 90 === 0) process.stdout.write(`\rframe ${f}/${frames} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('\nvideo done', written, 'frames');

  // 3) mux: concat voice-over, duck music under it, master
  const final = path.join(OUT, 'napoleon.mp4');
  const payload = JSON.stringify(clips.filter((c) => c.file).map((c) => ({ file: c.file, start: c.start, dur: c.dur })));
  execFileSync('node', [path.join(__dirname, 'audio.mjs'), payload, video, final], { stdio: 'inherit' });
  console.log('final', final, (fs.statSync(final).size / 1e6).toFixed(1), 'MB');
})();
