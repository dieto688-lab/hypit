'use strict';
// ---------------------------------------------------------------------------
// ui.js — typography, HUD, speech captions, cards, chapter titles and the
// little comic devices that give the short its "History Matters" rhythm.
// ---------------------------------------------------------------------------

const M = require('./map');

const { W, H, PAL, fonts, clamp, lerp, ease, mix, rgba } = M;

const SAFE = { x: 96, top: 80, bottom: H - 80 };

// ------------------------------------------------------------------ helpers
function setFont(ctx, size, family = fonts.body, weight = 800) {
  ctx.font = `${weight} ${size}px ${family}`;
}

function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function pop(ctx, x, y, scale, rot, fn) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(scale, scale);
  fn();
  ctx.restore();
}

// paper grain + vignette, drawn once per frame at low cost
let grain = null;
function getGrain() {
  if (grain) return grain;
  const { createCanvas } = require('@napi-rs/canvas');
  const c = createCanvas(512, 512);
  const g = c.getContext('2d');
  const img = g.createImageData(512, 512);
  let seed = 12345;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = 128 + ((seed >>> 20) % 26) - 13;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 10;
  }
  g.putImageData(img, 0, 0);
  grain = c;
  return grain;
}

function drawPaperGrain(ctx, alpha = 0.5) {
  ctx.save();
  ctx.globalAlpha = alpha * 0.35;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = ctx.createPattern(getGrain(), 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawVignette(ctx, strength = 0.35) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(30,22,12,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------------- badges
// Year / date pill in the top-left, like the timeline stamps in the reference.
function drawYear(ctx, text, t = 1, opts = {}) {
  if (t <= 0) return;
  const s = ease.snap(clamp(t));
  const x = SAFE.x;
  const y = SAFE.top + 26;
  ctx.save();
  ctx.globalAlpha = clamp(t * 1.6);
  setFont(ctx, 54, fonts.display, 800);
  const w = ctx.measureText(text).width + 64;
  pop(ctx, x, y, s, -0.015, () => {
    ctx.fillStyle = opts.bg || PAL.ink;
    ctx.beginPath();
    ctx.roundRect(0, -36, w, 72, 12);
    ctx.fill();
    ctx.fillStyle = opts.fg || PAL.hm;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 30, 6);
  });
  ctx.restore();
}

// small "chapter" tag, e.g. "PARTE 2 · EL BLOQUEO"
function drawTag(ctx, text, t = 1, opts = {}) {
  if (t <= 0) return;
  const s = ease.out(clamp(t));
  const x = SAFE.x;
  const y = SAFE.top + 92;
  ctx.save();
  ctx.globalAlpha = clamp(t * 2);
  setFont(ctx, 26, fonts.body, 800);
  const w = ctx.measureText(text).width + 42;
  pop(ctx, x, y, 0.98 + 0.02 * s, 0, () => {
    ctx.fillStyle = opts.bg || 'rgba(34,32,28,0.82)';
    ctx.beginPath();
    ctx.roundRect(0, -19, w, 38, 6);
    ctx.fill();
    ctx.fillStyle = opts.fg || PAL.white;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 21, 2);
  });
  ctx.restore();
}

// ------------------------------------------------------------------ captions
// Word-by-word "karaoke" caption at the bottom, the house caption style.
function drawCaptions(ctx, words, clock, opts = {}) {
  if (!words || !words.length) return;
  const size = opts.size || 52;
  const maxW = opts.maxW || 1420;
  setFont(ctx, size, fonts.body, 800);
  const tokens = words.map((w) => ({ ...w, wpx: ctx.measureText(w.t).width + ctx.measureText(' ').width }));
  // group into lines of ~3-5 words
  const lines = [];
  let cur = [];
  let curW = 0;
  for (const tk of tokens) {
    if (curW + tk.wpx > maxW && cur.length) {
      lines.push(cur);
      cur = [];
      curW = 0;
    }
    cur.push(tk);
    curW += tk.wpx;
  }
  if (cur.length) lines.push(cur);

  const lh = size * 1.28;
  const baseY = opts.y || H - 132;
  lines.forEach((line, li) => {
    const totalW = line.reduce((a, b) => a + b.wpx, 0);
    let x = W / 2 - totalW / 2;
    const y = baseY - (lines.length - 1 - li) * lh;
    for (const tk of line) {
      const on = clock >= tk.s;
      const active = clock >= tk.s && clock < tk.e;
      const popT = clamp((clock - tk.s) / 0.16);
      const sc = on ? 1 + 0.10 * (1 - ease.out(popT)) : 1;
      ctx.save();
      ctx.translate(x + tk.wpx / 2, y);
      ctx.scale(sc, sc);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (on) {
        ctx.lineWidth = size * 0.22;
        ctx.strokeStyle = opts.outline || 'rgba(26,20,14,0.9)';
        ctx.lineJoin = 'round';
        ctx.strokeText(tk.t, 0, 0);
        ctx.fillStyle = active ? (opts.highlight || PAL.hm) : (opts.color || PAL.white);
      } else {
        ctx.fillStyle = 'rgba(255,249,236,0.55)';
      }
      ctx.fillText(tk.t, 0, 0);
      ctx.restore();
      x += tk.wpx;
    }
  });
}

// -------------------------------------------------------------------- cards
// Full-frame typographic card used between chapters.
function drawCaptionBar(ctx, text, t = 1, opts = {}) {
  if (t <= 0) return;
  const s = ease.out(clamp(t));
  const size = opts.size || 44;
  setFont(ctx, size, fonts.body, 800);
  const lines = wrap(ctx, text, opts.maxW || 1180);
  const lh = size * 1.25;
  const boxH = lines.length * lh + 46;
  const y = opts.y || H - 96 - boxH;
  ctx.save();
  ctx.globalAlpha = clamp(t * 1.4);
  pop(ctx, W / 2, y + boxH / 2, 0.96 + 0.04 * s, 0, () => {
    ctx.fillStyle = opts.bg || 'rgba(24,21,17,0.86)';
    ctx.beginPath();
    ctx.roundRect(-660, -boxH / 2, 1320, boxH, 14);
    ctx.fill();
    ctx.fillStyle = opts.fg || PAL.white;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => {
      ctx.fillText(l, 0, -((lines.length - 1) / 2) * lh + i * lh + 2);
    });
  });
  ctx.restore();
}

// ------------------------------------------------------------------- titles
function drawBigTitle(ctx, main, sub, t = 1, opts = {}) {
  const a = clamp(t);
  if (a <= 0) return;
  const s = ease.snap(clamp(t));
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // kicker
  if (sub) {
    setFont(ctx, 30, fonts.body, 800);
    ctx.globalAlpha = clamp((t - 0.15) * 2.4);
    ctx.fillStyle = opts.subColor || PAL.hm;
    const raw = sub;
    const w = ctx.measureText(raw).width;
    ctx.fillStyle = PAL.ink;
    ctx.globalAlpha = clamp((t - 0.15) * 2.4) * 0.92;
    ctx.beginPath();
    ctx.roundRect(W / 2 - w / 2 - 26, H / 2 - 168, w + 52, 50, 8);
    ctx.fill();
    ctx.fillStyle = opts.subColor || PAL.hm;
    ctx.fillText(raw, W / 2, H / 2 - 142);
  }
  // main
  setFont(ctx, opts.size || 128, fonts.display, 800);
  ctx.globalAlpha = a;
  const lines = wrap(ctx, main, 1500);
  const lh = (opts.size || 128) * 1.02;
  ctx.lineWidth = 14;
  ctx.strokeStyle = PAL.ink;
  ctx.lineJoin = 'round';
  pop(ctx, W / 2, H / 2 + 40, 0.9 + 0.1 * s, -0.008, () => {
    lines.forEach((l, i) => {
      const y = -((lines.length - 1) / 2) * lh + i * lh;
      ctx.strokeText(l, 0, y);
      ctx.fillStyle = opts.color || PAL.white;
      ctx.fillText(l, 0, y);
    });
  });
  ctx.restore();
}

// big number stamp, e.g. "1", "2", "3" for the reasons
function drawNumberStamp(ctx, n, text, t = 1, opts = {}) {
  if (t <= 0) return;
  const s = ease.snap(clamp(t));
  const x = opts.x ?? 210;
  const y = opts.y ?? H / 2;
  ctx.save();
  ctx.globalAlpha = clamp(t * 1.5);
  pop(ctx, x, y, 0.55 + 0.45 * s, -0.06, () => {
    ctx.fillStyle = opts.bg || PAL.britain;
    ctx.beginPath();
    ctx.arc(0, 0, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = PAL.ink;
    ctx.stroke();
    setFont(ctx, 104, fonts.display, 800);
    ctx.fillStyle = PAL.white;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 0, 6);
  });
  // label to the right
  if (text) {
    setFont(ctx, 50, fonts.display, 800);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const lines = wrap(ctx, text, 780);
    const lh = 56;
    ctx.lineWidth = 10;
    ctx.strokeStyle = PAL.ink;
    ctx.lineJoin = 'round';
    lines.forEach((l, i) => {
      const yy = y + 210 + i * lh;
      ctx.strokeText(l, 200, yy);
      ctx.fillStyle = PAL.white;
      ctx.fillText(l, 200, yy);
    });
  }
  ctx.restore();
}

// ------------------------------------------------------------------ devices
// a hand-drawn-ish red "X" stamp for failed ideas
function drawCrossStamp(ctx, x, y, size, t = 1, color = '#B5342A') {
  const s = ease.snap(clamp(t));
  if (s <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(t * 2);
  ctx.translate(x, y);
  ctx.rotate(-0.06);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.20;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-size / 2, -size / 2);
  ctx.lineTo(size / 2, size / 2);
  ctx.moveTo(size / 2, -size / 2);
  ctx.lineTo(-size / 2, size / 2);
  ctx.stroke();
  ctx.restore();
}

// flat coin/banknote doodles for the economic war
function drawCoin(ctx, x, y, r, label, color = PAL.gold) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = r * 0.14;
  ctx.stroke();
  ctx.fillStyle = PAL.ink;
  setFont(ctx, r * 0.9, fonts.display, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + r * 0.06);
  ctx.restore();
}

function drawShip(ctx, x, y, s, color = PAL.ink, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * flip, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-58, 0);
  ctx.lineTo(58, 0);
  ctx.lineTo(38, 26);
  ctx.lineTo(-40, 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-4, -66, 7, 66);
  ctx.beginPath();
  ctx.moveTo(4, -60);
  ctx.lineTo(4, -8);
  ctx.lineTo(52, -8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-6, -52);
  ctx.lineTo(-6, -8);
  ctx.lineTo(-46, -8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// six-pointed rough explosion + label, for battles
function drawKaboom(ctx, x, y, text, t = 1, opts = {}) {
  const s = ease.snap(clamp(t));
  if (s <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(opts.rot ?? -0.05);
  ctx.scale(s, s);
  const spikes = 14;
  const R = opts.r || 150;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const ang = (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? R : R * (0.62 + 0.16 * Math.sin(i * 2.1));
    const px = Math.cos(ang) * rr;
    const py = Math.sin(ang) * rr * 0.72;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = opts.bg || PAL.hm;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = PAL.ink;
  ctx.stroke();
  setFont(ctx, opts.size || 54, fonts.display, 800);
  ctx.fillStyle = PAL.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = String(text).split('\n');
  lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * 58));
  ctx.restore();
}

// stamped date, rotating slightly, used for treaty beats
function drawStamp(ctx, text, x, y, t = 1, opts = {}) {
  const s = ease.snap(clamp(t));
  if (s <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(opts.rot ?? -0.09);
  ctx.scale(s, s);
  setFont(ctx, opts.size || 34, fonts.display, 800);
  const w = ctx.measureText(text).width + 46;
  ctx.globalAlpha = clamp(t * 1.6);
  if (opts.plate !== false) {
    ctx.save();
    ctx.fillStyle = opts.plateColor || '#FBF3DF';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -32, w, 64, 8);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = opts.color || '#B5342A';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -32, w, 64, 8);
  ctx.stroke();
  ctx.fillStyle = opts.color || '#B5342A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 2);
  ctx.restore();
}

module.exports.SAFE = SAFE;
module.exports.setFont = setFont;
module.exports.wrap = wrap;
module.exports.pop = pop;
module.exports.drawPaperGrain = drawPaperGrain;
module.exports.drawVignette = drawVignette;
module.exports.drawYear = drawYear;
module.exports.drawTag = drawTag;
module.exports.drawCaptions = drawCaptions;
module.exports.drawCaptionBar = drawCaptionBar;
module.exports.drawBigTitle = drawBigTitle;
module.exports.drawNumberStamp = drawNumberStamp;
module.exports.drawCrossStamp = drawCrossStamp;
module.exports.drawCoin = drawCoin;
module.exports.drawShip = drawShip;
module.exports.drawKaboom = drawKaboom;
module.exports.drawStamp = drawStamp;

// counter cluster (top right) — "130 departamentos" etc.
module.exports.drawCounter = function drawCounter(ctx, rows, t = 1) {
  if (t <= 0) return;
  const x = W - 500;
  let y = 168;
  rows.forEach((r, i) => {
    const k = clamp((t - i * 0.12) * 2.6);
    if (k <= 0) return;
    const cy = y;
    y += 104;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(x, cy);
    ctx.scale(0.94 + 0.06 * ease.out(k), 0.94 + 0.06 * ease.out(k));
    ctx.fillStyle = 'rgba(255,249,236,0.94)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 430, 92, 10);
    ctx.fill();
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `800 46px ${fonts.display}`;
    ctx.fillStyle = PAL.britain;
    ctx.fillText(r[0], 26, 46);
    ctx.font = `700 22px ${fonts.body}`;
    ctx.fillStyle = '#4A4237';
    ctx.fillText(r[1], 26, 78 - 4);
    ctx.restore();
  });
};

// tiny envelope doodle for the courier beat
module.exports.drawEnvelope = function drawEnvelope(ctx, x, y, s = 1, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.fillStyle = '#FFF9EC';
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(-34, -24, 68, 48, 5);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-34, -24);
  ctx.lineTo(0, 4);
  ctx.lineTo(34, -24);
  ctx.stroke();
  ctx.restore();
};

// reason badge top-left (1/2/3)
module.exports.drawReason = function drawReason(ctx, n, text, t = 1, opts = {}) {
  if (t <= 0) return;
  const s = ease.snap(clamp(t));
  const x = opts.x ?? 104;
  const y = opts.y ?? 250;
  ctx.save();
  ctx.globalAlpha = clamp(t * 1.5);
  // text pill
  setFont(ctx, 22, fonts.body, 800);
  const w = ctx.measureText(text).width + 34;
  ctx.fillStyle = 'rgba(34,32,28,0.92)';
  ctx.beginPath();
  ctx.roundRect(x + 52, y - 20, w, 40, 6);
  ctx.fill();
  ctx.fillStyle = PAL.white;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 52 + 17, y + 1);
  // number disc
  ctx.save();
  ctx.translate(x + 30, y);
  ctx.scale(0.8 + 0.2 * s, 0.8 + 0.2 * s);
  ctx.fillStyle = PAL.britain;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.font = `800 30px ${fonts.display}`;
  ctx.fillStyle = PAL.white;
  ctx.textAlign = 'center';
  ctx.fillText(String(n), 0, 2);
  ctx.restore();
  ctx.restore();
};

// little crown doodle for the throne states
module.exports.drawCrown = function drawCrown(ctx, x, y, s = 1, color = '#22201C') {
  if (s <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-34, 18);
  ctx.lineTo(-34, -16);
  ctx.lineTo(-18, 2);
  ctx.lineTo(0, -26);
  ctx.lineTo(18, 2);
  ctx.lineTo(34, -16);
  ctx.lineTo(34, 18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

// ---------------------------------------------------------------------------
// Stacked, self-timing key-points. `cards` is a list of {t0, text, color}.
// Cards enter, stay a beat, then leave and let the next one take the slot.
// One shared slot keeps the map readable, which is the whole point.
// ---------------------------------------------------------------------------
function drawCardsImpl(ctx, cards, t, opts = {}) {
  const inT = 0.07;
  const outT = 0.05;
  let y = opts.y ?? 300;
  cards.forEach((c, ci) => {
    const t0 = c.t0;
    const next = cards[ci + 1];
    const hold = c.hold ?? (next ? Math.max(0.06, next.t0 - t0 - 0.10) : 0.30);
    const enter = clamp((t - t0) / inT);
    const exit = clamp((t - (t0 + hold)) / outT);
    if (enter <= 0) return;
    const alpha = clamp(enter) * (1 - exit);
    if (alpha <= 0.001) return;
    const s = ease.snap(enter);
    const slide = (1 - ease.out(enter)) * -60 + ease.in(exit) * 60;
    ctx.save();
    ctx.globalAlpha = alpha;
    setFont(ctx, 30, fonts.display, 800);
    const lines = wrap(ctx, c.text, opts.maxW || 520);
    const lh = 36;
    const h = lines.length * lh + 34;
    ctx.translate(opts.x ?? 104, y + slide);
    ctx.scale(0.94 + 0.06 * s, 0.94 + 0.06 * s);
    // card
    const w = (opts.w ?? 600);
    ctx.fillStyle = c.bg || 'rgba(255,249,236,0.96)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 4;
    ctx.stroke();
    // accent bar
    ctx.fillStyle = c.color || PAL.britain;
    ctx.beginPath();
    ctx.roundRect(0, 0, 12, h, 10);
    ctx.fill();
    ctx.fillStyle = PAL.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 34, 27 + i * lh));
    ctx.restore();
    y += h + 16;
  });
}
module.exports.drawCards = drawCardsImpl;
