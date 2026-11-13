'use strict';
// ---------------------------------------------------------------------------
// map.js — draws stylised "History Matters"-style maps on a 2D canvas.
//
// Every scene supplies:
//   cam      {lon, lat, zoom}      camera centre + zoom (1 = 1000 km-ish view)
//   panels   [{territory, color, alpha, outline, label}]  filled regions
//   arrows   [{from, to, color, width, t}]                campaign arrows
//   marks    [{lon, lat, kind, text, color, t}]           city/explosion marks
//   routes   [{points, color, width, dashed}]             shipping/smuggling lines
//   sea      {color}                                      water tint
// ---------------------------------------------------------------------------

const fs = require('node:fs');
const path = require('node:path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const G = require('./geo');

const W = 1920;
const H = 1080;

// ------------------------------------------------------------------ palette
const PAL = {
  paper: '#F4EAD5',
  ink: '#22201C',
  sea: '#A9C7D4',
  seaDeep: '#8FB4C5',
  land: '#E7DCC2',
  landDark: '#D9CBAE',
  coast: '#6F6455',
  gold: '#D9A441',
  goldLight: '#EFC878',
  france: '#3A5A9B',
  franceLight: '#5C7FBF',
  empire: '#2F4A82',
  vassal: '#7C93C0',
  britain: '#A63A32',
  britainDark: '#7E2A24',
  russia: '#4F7A4A',
  austria: '#C9B24A',
  prussia: '#5B5B5B',
  ottoman: '#8C7B5A',
  spain: '#B98A3E',
  hm: '#F2C14E',
  white: '#FFF9EC',
};

// ---------------------------------------------------------------- typography
const FONT_DIR = path.join(__dirname, '..', 'node_modules', '@fontsource');
function regFont(file, family) {
  try {
    GlobalFonts.registerFromPath(path.join(FONT_DIR, file), family);
    return true;
  } catch (e) {
    return false;
  }
}
regFont('archivo-black/files/archivo-black-latin-400-normal.woff', 'Display');
regFont('montserrat/files/montserrat-latin-800-normal.woff', 'Body');
regFont('montserrat/files/montserrat-latin-700-normal.woff', 'Body');
regFont('montserrat/files/montserrat-latin-400-normal.woff', 'Body');

const fonts = { display: '"Display","DejaVu Sans",sans-serif', body: '"Body","DejaVu Sans",sans-serif' };

// ------------------------------------------------------------------- helpers
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = {
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  back: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
  linear: (t) => t,
  // everything in the house style snaps: small overshoot, settle
  snap: (t) => {
    const c = 2.6;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
};

function hexToRgb(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], t)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function rgba(h, a) {
  const [r, g, b] = hexToRgb(h);
  return `rgba(${r},${g},${b},${a})`;
}

// ------------------------------------------------------------------- camera
function makeCamera(cam) {
  const [cx, cy] = G.project(cam.lon, cam.lat);
  const z = cam.zoom;
  return {
    z,
    cam,
    toScreen: (wx, wy) => [(wx - cx) * z + W / 2, (wy - cy) * z + H / 2],
    // longitude/latitude transform used for labels and marks
    ll: (lon, lat) => {
      const [wx, wy] = G.project(lon, lat);
      return [(wx - cx) * z + W / 2, (wy - cy) * z + H / 2];
    },
    scale: (px) => px * z,
  };
}

// camera that fits a lon/lat box with a little breathing room
function fitBox(lon1, lat1, lon2, lat2, pad = 0.92) {
  const [x1, y1] = G.project(lon1, lat1);
  const [x2, y2] = G.project(lon2, lat2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  const z = Math.min(W / w, H / h) * pad;
  const [cx, cy] = [(x1 + x2) / 2, (y1 + y2) / 2];
  const [lon, lat] = G.unproject(cx, cy);
  return { lon, lat, zoom: z };
}

// ------------------------------------------------------------------- drawing
function drawSea(ctx, cam, o = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, o.top || PAL.sea);
  g.addColorStop(1, o.bottom || PAL.seaDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // latitude lines, very faint, like a school atlas
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = '#1d3946';
  ctx.lineWidth = 1.4;
  for (let lat = 30; lat <= 70; lat += 10) {
    const [, y] = cam.ll(-20, lat);
    if (y < -50 || y > H + 50) continue;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
}

let baseCache = null;
function basePath() {
  if (!baseCache) baseCache = G.toPath2D(G.multipolygons.europeOther);
  return baseCache;
}
function drawRestOfWorld(ctx, cam, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  withWorldTransform(ctx, cam, 0, () => {
    ctx.fillStyle = PAL.land;
    ctx.fill(basePath());
    ctx.strokeStyle = rgba('#1f1b16', 0.35);
    ctx.lineWidth = 1.6 / cam.z;
    ctx.stroke(basePath());
  });
  ctx.restore();
}

// A territory is drawn in world coordinates through the camera matrix.
function withWorldTransform(ctx, cam, inset, fn) {
  const c = cam._c || (cam._c = G.project(cam.cam.lon, cam.cam.lat));
  const cx = c[0], cy = c[1];
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(cam.z, cam.z);
  ctx.translate(-cx, -cy);
  fn(ctx);
  ctx.restore();
}

function drawTerritory(ctx, cam, key, color, alpha = 1, outline = true) {
  const p = G.paths[key];
  if (!p) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill(p);
  if (outline) {
    ctx.lineWidth = 2.0 / cam.z;
    ctx.strokeStyle = rgba('#1f1b16', 0.55);
    ctx.stroke(p);
  }
  ctx.restore();
}

function drawCoastHatch(ctx, cam, key, color, alpha = 1, spacing = 7) {
  const p = G.paths[key];
  if (!p) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.2 / cam.z;
  ctx.setLineDash([spacing / cam.z, spacing / cam.z]);
  ctx.stroke(p);
  ctx.restore();
}

// Campaign arrow: tapered ribbon + solid triangular head, inked outline.
function drawArrow(ctx, cam, a) {
  const [x1, y1] = cam.ll(a.from[0], a.from[1]);
  const [x2, y2] = cam.ll(a.to[0], a.to[1]);
  const t = clamp(a.t ?? 1);
  if (t <= 0.001) return;
  const w = a.width || 18;
  const bend = a.bend ?? 0.14;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const cx = (x1 + x2) / 2 + nx * len * bend;
  const cy = (y1 + y2) / 2 + ny * len * bend;

  const headLen = w * 2.4;
  const N = 32;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * t;
    const px = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * cx + u * u * x2;
    const py = (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * cy + u * u * y2;
    pts.push([px, py]);
  }
  if (pts.length < 2) return;

  // find where the shaft should stop (leave room for the head, only at full growth)
  let shaft = pts;
  let head = null;
  if (t > 0.35 || len < headLen * 3) {
    const e = pts[pts.length - 1];
    let acc = 0;
    let cut = pts.length - 1;
    for (let i = pts.length - 1; i > 0; i--) {
      acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc >= headLen) { cut = i; break; }
    }
    shaft = pts.slice(0, cut + 1);
    const b = pts[Math.max(0, cut)];
    const ang = Math.atan2(e[1] - b[1], e[0] - b[0]);
    head = { e, ang };
  }

  const colour = a.color || PAL.ink;
  // shaft as tapered band
  const left = [], right = [];
  for (let i = 0; i < shaft.length; i++) {
    const u = i / Math.max(1, shaft.length - 1);
    const p = shaft[i];
    const q = shaft[Math.min(shaft.length - 1, i + 1)];
    const r = shaft[Math.max(0, i - 1)];
    let tx = q[0] - r[0], ty = q[1] - r[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const half = (w / 2) * (0.9 + 0.1 * Math.sin(u * Math.PI));
    left.push([p[0] - ty * half, p[1] + tx * half]);
    right.push([p[0] + ty * half, p[1] - tx * half]);
  }
  ctx.save();
  ctx.globalAlpha = a.alpha ?? 1;
  ctx.lineJoin = 'round';
  // inked outline
  ctx.strokeStyle = a.outlineColor || '#221F1A';
  ctx.fillStyle = colour;
  const shaftPath = () => {
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (const p of left) ctx.lineTo(p[0], p[1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
  };
  shaftPath();
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.fill();

  if (head) {
    const { e, ang } = head;
    const spread = 0.52;
    const p1 = [e[0] - Math.cos(ang - spread) * headLen, e[1] - Math.sin(ang - spread) * headLen];
    const p2 = [e[0] - Math.cos(ang + spread) * headLen, e[1] - Math.sin(ang + spread) * headLen];
    ctx.beginPath();
    ctx.moveTo(e[0], e[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.closePath();
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.fill();
  }
  ctx.restore();
}

function drawRoute(ctx, cam, r) {
  const pts = r.points.map((p) => cam.ll(p[0], p[1]));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = r.color;
  ctx.lineWidth = r.width || 4;
  if (r.dashed) ctx.setLineDash(r.dashed);
  ctx.globalAlpha = r.alpha ?? 1;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) {
    // smooth-ish curve
    ctx.lineTo(p[0], p[1]);
  }
  ctx.stroke();
  ctx.restore();
}

function drawMark(ctx, cam, m) {
  const [x, y] = cam.ll(m.lon, m.lat);
  const t = m.t ?? 1;
  if (t <= 0) return;
  const col = m.color || PAL.ink;
  ctx.save();
  if (m.kind === 'city') {
    ctx.translate(x, y);
    ctx.scale(ease.back(clamp(t)), ease.back(clamp(t)));
    ctx.fillStyle = PAL.white;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    if (m.text) {
      ctx.font = `700 26px ${fonts.body}`;
      const label = m.text;
      const w = ctx.measureText(label).width;
      ctx.fillStyle = rgba('#FFFDF6', 0.94);
      ctx.beginPath();
      ctx.roundRect(16, -20, w + 22, 40, 8);
      ctx.fill();
      ctx.strokeStyle = rgba(col, 0.65);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.fillText(label, 27, 8);
    }
  } else if (m.kind === 'burst') {
    // classic comic explosion
    const s = ease.out(clamp(t));
    ctx.translate(x, y);
    const spikes = 12;
    const R = 58 * s;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const ang = (i / (spikes * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? R : R * 0.45;
      const px = Math.cos(ang) * rr;
      const py = Math.sin(ang) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 4;
    ctx.stroke();
  } else if (m.kind === 'ring') {
    for (let k = 0; k < 3; k++) {
      const tt = clamp((t - k * 0.18) / 0.7);
      if (tt <= 0) continue;
      ctx.globalAlpha = 1 - tt;
      ctx.strokeStyle = col;
      ctx.lineWidth = 5 * (1 - tt) + 1;
      ctx.beginPath();
      ctx.arc(x, y, 20 + tt * 140, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (m.kind === 'pin') {
    ctx.globalAlpha = clamp(t * 1.5);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba('#FFFDF6', 0.9);
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLabel(ctx, cam, l) {
  const [x, y] = cam.ll(l.lon, l.lat);
  ctx.save();
  ctx.globalAlpha = l.alpha ?? 1;
  const size = l.size || 30;
  ctx.font = `${l.weight || 700} ${size}px ${l.display ? fonts.display : fonts.body}`;
  ctx.textAlign = l.align || 'center';
  ctx.textBaseline = 'middle';
  if (l.halo !== false) {
    ctx.lineWidth = size * 0.34;
    ctx.strokeStyle = l.haloColor || 'rgba(255,250,238,0.85)';
    ctx.lineJoin = 'round';
    ctx.strokeText(l.text, x + (l.dx || 0), y + (l.dy || 0));
  }
  ctx.fillStyle = l.color || PAL.ink;
  ctx.fillText(l.text, x + (l.dx || 0), y + (l.dy || 0));
  ctx.restore();
}

// Draws a full map layer from a scene description at time t (0..1 progress
// inside the scene is handled by the caller; `t` here drives entrance anims).
function drawMap(ctx, cam, s, t) {
  drawSea(ctx, cam, s.sea);
  drawRestOfWorld(ctx, cam, s.landAlpha ?? 1);

  withWorldTransform(ctx, cam, 0, () => {
    if (s.base) {
      for (const [key, val] of Object.entries(s.base)) {
        drawTerritory(ctx, cam, key, val.color || PAL.landDark, val.alpha ?? 1, val.outline ?? true);
      }
    }
    for (const p of s.panels || []) {
      const a = p.alpha ?? 1;
      if (a <= 0) continue;
      drawTerritory(ctx, cam, p.territory, p.color, a, p.outline);
      if (p.hatch) drawCoastHatch(ctx, cam, p.territory, p.hatch, a * 0.9, p.hatchSpacing);
    }
  });

  for (const r of s.routes || []) drawRoute(ctx, cam, r);
  for (const a of s.arrows || []) drawArrow(ctx, cam, a);
  for (const m of s.marks || []) drawMark(ctx, cam, m);
  for (const l of s.labels || []) drawLabel(ctx, cam, l);
}

module.exports = {
  W, H, PAL, fonts, clamp, lerp, ease, mix, rgba, makeCamera,
  fitBox, drawMap, drawSea, drawRestOfWorld, drawTerritory, drawCoastHatch, drawArrow, drawLabel,
  withWorldTransform, createCanvas, GlobalFonts,
};
