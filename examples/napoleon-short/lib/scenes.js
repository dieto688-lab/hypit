'use strict';
// ---------------------------------------------------------------------------
// scenes.js — the actual shot list for "¿Por qué Napoleón no se detuvo?"
// Every scene is a function (t in 0..1) that paints one frame.
// ---------------------------------------------------------------------------

const M = require('./map');
const U = require('./ui');
const G = require('./geo');

const { W, H, PAL, fonts, clamp, lerp, ease, mix, rgba } = M;

// ------------------------------------------------------------------ helpers
function seg(t, a, b) { return clamp((t - a) / (b - a)); }

// camera rigs -----------------------------------------------------------------
const CAMS = {
  europe: M.fitBox(-8, 37, 34, 58, 0.95),
  europeWide: M.fitBox(-12, 34, 40, 60, 0.9),
  west: M.fitBox(-6, 41, 12, 54, 0.95),
  channel: M.fitBox(-7.0, 48.6, 3.4, 52.2, 0.95),
  empire: M.fitBox(-4, 42, 26, 55, 0.95),
  italy: M.fitBox(5, 36, 19, 47, 0.95),
  atlantic: M.fitBox(-20, 38, 22, 60.5, 0.95),
  world: { lon: -7, lat: -11, zoom: 0.5 },

};

function camAt(from, to, t) {
  return {
    lon: lerp(from.lon, to.lon, t),
    lat: lerp(from.lat, to.lat, t),
    zoom: lerp(from.zoom, to.zoom, t),
  };
}

// 1799 France-only map -------------------------------------------------------
const BASE1799 = {
  panels: [
    { territory: 'spain', color: PAL.spain, alpha: 0.9 },
    { territory: 'britain', color: PAL.britain, alpha: 0.9 },
    { territory: 'austria', color: PAL.austria, alpha: 0.9 },
    { territory: 'warsaw', color: PAL.prussia, alpha: 0.55 },
    { territory: 'prussiaEast', color: PAL.prussia, alpha: 0.55 },
    { territory: 'russia', color: PAL.russia, alpha: 0.85 },
    { territory: 'ottoman', color: PAL.ottoman, alpha: 0.8 },
    { territory: 'italyNorth', color: PAL.landDark, alpha: 0.9 },
    { territory: 'naples', color: PAL.landDark, alpha: 0.9 },
  ],
};

// 1812 empire strips ---------------------------------------------------------
const EMPIRE_LAYERS = [
  { territory: 'france', color: PAL.france },
  { territory: 'lowCountries', color: PAL.empire },
  { territory: 'leftRhine', color: PAL.empire },
  { territory: 'piedmont', color: PAL.empire },
  { territory: 'italyNorth', color: PAL.vassal },
  { territory: 'naples', color: PAL.vassal },
  { territory: 'confRhine', color: PAL.vassal, alpha: 0.62 },
  { territory: 'warsaw', color: PAL.vassal },
  { territory: 'spain', color: PAL.spain },
  { territory: 'switzerland', color: PAL.vassal, alpha: 0.9 },
];

function empirePanels(t, start, step = 0.10) {
  return EMPIRE_LAYERS.map((p, i) => {
    const k = clamp((t - start - i * step) / 0.16);
    return { ...p, alpha: (p.alpha ?? 1) * k };
  });
}

// ---------------------------------------------------------------------------
// 0 · OPENING
// ---------------------------------------------------------------------------
function sceneOpening(t) {
  const ctx = arguments[arguments.length - 1];
  return (ctx) => {};
}

// The engine calls scenes as fn(ctx, t, dur). Keeping a single signature:
function opening(ctx, t) {
  // paper
  ctx.fillStyle = PAL.paper;
  ctx.fillRect(0, 0, W, H);
  // tiny dot
  const dt = seg(t, 0.0, 0.12);
  ctx.save();
  ctx.fillStyle = PAL.ink;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 6 * dt, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // map slides in behind
  const mt = seg(t, 0.22, 0.75);
  if (mt > 0) {
    const cam = M.makeCamera({ ...CAMS.europe, zoom: lerp(0.55, 0.72, mt) });
    ctx.save();
    ctx.globalAlpha = 0.9 * mt;
    M.drawMap(ctx, cam, {
      ...BASE1799,
      panels: [
        ...empirePanels(mt * 0.9, 0.0, 0.12),
        { territory: 'spain', color: PAL.spain, alpha: 0.9 },
        { territory: 'britain', color: PAL.britain, alpha: 0.9 },
        { territory: 'russia', color: PAL.russia, alpha: 0.85 },
        { territory: 'austria', color: PAL.austria, alpha: 0.9 },
        { territory: 'ottoman', color: PAL.ottoman, alpha: 0.75 },
        { territory: 'prussiaEast', color: PAL.prussia, alpha: 0.5 },
      ],
    }, mt);
    ctx.restore();
    // darken for title legibility
    ctx.fillStyle = `rgba(26,20,14,${0.35 * mt})`;
    ctx.fillRect(0, 0, W, H);
  }

  U.drawBigTitle(ctx, 'NAPOLEÓN', '¿POR QUÉ NO SE DETUVO?', seg(t, 0.10, 0.35), {
    size: 130,
  });
  if (t > 0.5) {
    ctx.save();
    ctx.globalAlpha = clamp((t - 0.5) * 3);
    U.setFont(ctx, 30, fonts.body, 700);
    ctx.fillStyle = PAL.goldLight;
    ctx.textAlign = 'center';
    ctx.fillText('1805 – 1815 · EN TRES MINUTOS Y MEDIO', W / 2, H / 2 + 150);
    ctx.restore();
  }
  U.drawPaperGrain(ctx, 0.7);
  U.drawVignette(ctx, 0.45);
}

// ---------------------------------------------------------------------------
// 1 · 1799 → 1812. THE DILEMMA TODAY.
// ---------------------------------------------------------------------------
function rise(ctx, t) {
  const camT = ease.inOut(seg(t, 0.02, 0.22));
  const cam1 = camAt(CAMS.west, CAMS.europe, camT);
  const zoom = lerp(cam1.zoom, cam1.zoom * 0.97, ease.inOut(seg(t, 0.2, 0.95)));
  const cam = M.makeCamera({ ...cam1, zoom });

  const base = {
    ...BASE1799,
    panels: [...BASE1799.panels],
  };
  // the empire grows in waves after the camera opens up
  const grow = seg(t, 0.24, 0.98);
  const panels = [...BASE1799.panels, ...empirePanels(grow, 0.0, 0.085)];

  const marks = [];
  // arrows converging on France in 1799
  const arrowT = seg(t, 0.05, 0.24);
  const arrows = [
    { from: [10.5, 46.6], to: [7.0, 47.2], color: PAL.austria, width: 12, t: arrowT },
    { from: [14.5, 50.5], to: [10.0, 49.4], color: PAL.britain, width: 12, t: arrowT * 0.95 },
    { from: [21.5, 53.5], to: [15.5, 51.2], color: PAL.russia, width: 14, t: arrowT * 1.05 },
    { from: [-3.2, 51.4], to: [-0.4, 49.6], color: PAL.britain, width: 12, t: arrowT * 0.9 },
  ];

  M.drawMap(ctx, cam, {
    ...base,
    panels,
    arrows,
    marks: [],
  }, t);

  // year stamps swap
  const y1 = 1 - seg(t, 0.19, 0.24);
  const y2 = seg(t, 0.24, 0.31);
  U.drawYear(ctx, '1799', y1);
  U.drawYear(ctx, '1812', y2);
  U.drawTag(ctx, 'INTRODUCCIÓN · EL DILEMA', 1);

  // labels on the empire
  const lab = seg(t, 0.55, 0.9);
  if (lab > 0) {
    const labels = [
      { lon: 1.6, lat: 46.2, text: 'FRANCIA', display: true, size: 34, color: '#fff', haloColor: 'rgba(20,30,60,.8)', alpha: lab },
      { lon: 3.6, lat: 52.4, text: 'BÉLGICA + HOLANDA', size: 18, alpha: lab },
      { lon: 10.5, lat: 52.9, text: 'RENANIA', size: 18, alpha: lab },
      { lon: 9.4, lat: 44.2, text: 'REINO DE ITALIA', size: 16, alpha: lab, dy: 26 },
      { lon: 15.4, lat: 40.0, text: 'NÁPOLES', size: 16, alpha: lab },
      { lon: 20.5, lat: 50.6, text: 'G. D. VARSOVIA', size: 16, alpha: lab },
      { lon: -2.4, lat: 53.2, text: 'REINO UNIDO', display: true, size: 24, color: '#fff', haloColor: 'rgba(110,25,18,.85)', alpha: lab },
      { lon: 33, lat: 58, text: 'RUSIA', display: true, size: 30, alpha: lab },
    ];
    for (const l of labels) U.drawMap && null;
    for (const l of labels) {
      ctx.save();
      ctx.globalAlpha = l.alpha;
      M.drawLabel(ctx, cam, l);
      ctx.restore();
    }
  }

  // counters
  const cT = seg(t, 0.72, 0.9);
  if (cT > 0) {
    U.drawCounter(ctx, [
      ['130', 'DEPARTAMENTOS'],
      ['44 M', 'SÚBDITOS'],
    ], cT);
  }
  U.drawPaperGrain(ctx, 0.55);
  U.drawVignette(ctx, 0.3);
}

// ---------------------------------------------------------------------------
// 2 · THE QUESTION
// ---------------------------------------------------------------------------
function question(ctx, t) {
  // frozen empire behind
  const cam = M.makeCamera({ ...CAMS.europe, zoom: CAMS.europe.zoom * 0.98 });
  ctx.save();
  ctx.globalAlpha = 0.55;
  M.drawMap(ctx, cam, {
    panels: [
      { territory: 'france', color: PAL.france },
      { territory: 'lowCountries', color: PAL.empire },
      { territory: 'leftRhine', color: PAL.empire },
      { territory: 'italyNorth', color: PAL.vassal },
      { territory: 'naples', color: PAL.vassal },
      { territory: 'warsaw', color: PAL.vassal },
      { territory: 'confRhine', color: PAL.vassal, alpha: 0.7 },
      { territory: 'spain', color: PAL.spain },
      { territory: 'britain', color: PAL.britain },
      { territory: 'russia', color: PAL.russia, alpha: 0.7 },
      { territory: 'austria', color: PAL.austria, alpha: 0.8 },
    ],
  }, 1);
  ctx.restore();
  ctx.fillStyle = 'rgba(24,20,15,0.52)';
  ctx.fillRect(0, 0, W, H);

  // courier envelope travelling Paris → Madrid, absurdly slow
  const et = ease.inOut(seg(t, 0.02, 0.55));
  const a = G.project(2.35, 48.85);
  const b = G.project(-3.7, 40.4);
  const [ax, ay] = [0, 0];
  // draw in screen space using the camera
  const p1 = cam.ll(2.35, 48.85);
  const p2 = cam.ll(-3.7, 40.4);
  const ex = lerp(p1[0], p2[0], et);
  const ey = lerp(p1[1], p2[1], et) - Math.sin(et * Math.PI) * 60;
  if (et > 0) {
    // dotted route
    ctx.save();
    ctx.setLineDash([10, 14]);
    ctx.strokeStyle = rgba('#F2C14E', 0.75);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();
    ctx.restore();
    // envelope
    U.drawEnvelope(ctx, ex, ey, 1, -0.25);
  }
  if (t > 0.4) {
    U.drawStamp(ctx, '12 DÍAS', lerp(p1[0], p2[0], 0.55), lerp(p1[1], p2[1], 0.55) - 70, seg(t, 0.4, 0.55), {
      size: 30, color: PAL.goldLight, rot: -0.05,
    });
  }

  const qt = seg(t, 0.30, 0.55);
  if (qt > 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    U.setFont(ctx, 118, fonts.display, 800);
    const s = ease.snap(qt);
    ctx.translate(W / 2, H / 2 - 40);
    ctx.rotate(-0.012);
    ctx.scale(0.88 + 0.12 * s, 0.88 + 0.12 * s);
    ctx.lineWidth = 18;
    ctx.strokeStyle = PAL.ink;
    ctx.lineJoin = 'round';
    ctx.globalAlpha = clamp(qt * 1.6);
    ctx.strokeText('¿POR QUÉ NO PARÓ?', 0, 0);
    ctx.fillStyle = PAL.white;
    ctx.fillText('¿POR QUÉ NO PARÓ?', 0, 0);
    ctx.restore();
  }

  // three chips that get crossed out
  const chips = ['PAZ', 'TRONO', 'DINASTÍA'];
  chips.forEach((c, i) => {
    const k = seg(t, 0.55 + i * 0.10, 0.72 + i * 0.10);
    const x = W / 2 + (i - 1) * 330;
    const y = H / 2 + 150;
    if (k <= 0) return;
    const s = ease.snap(k);
    ctx.save();
    ctx.globalAlpha = clamp(k * 1.5);
    ctx.translate(x, y);
    ctx.scale(s, s);
    U.setFont(ctx, 52, fonts.display, 800);
    const w = ctx.measureText(c).width + 70;
    ctx.fillStyle = PAL.white;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -42, w, 84, 10);
    ctx.fill();
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = PAL.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c, 0, 3);
    ctx.restore();
    U.drawCrossStamp(ctx, x, y, 96, seg(t, 0.75 + i * 0.07, 0.85 + i * 0.07));
  });

  U.drawPaperGrain(ctx, 0.5);
  U.drawVignette(ctx, 0.4);
}

// ---------------------------------------------------------------------------
// 3 · BRITAIN AND THE CHANNEL
// ---------------------------------------------------------------------------
function channel(ctx, t) {
  const camT = ease.inOut(seg(t, 0.06, 0.35));
  const cam = M.makeCamera(camAt(CAMS.west, CAMS.channel, camT));

  const panels = [
    { territory: 'france', color: PAL.france },
    { territory: 'lowCountries', color: PAL.empire },
    { territory: 'britain', color: PAL.britain },
  ];

  const arrows = [];
  // invasion arrow that stops in the water
  const inv = ease.out(seg(t, 0.10, 0.42));
  if (inv > 0) {
    arrows.push({
      from: [1.95, 50.70], to: [lerp(1.95, 1.30, inv), lerp(50.70, 51.02, inv)],
      color: PAL.france, width: 20, t: 1, bend: 0.06,
    });
  }
  // royal navy sweeps through the channel
  const navy = ease.inOut(seg(t, 0.45, 0.72));
  const marks = [];
  M.drawMap(ctx, cam, { panels, arrows, marks }, t);

  // the "X" on the water
  if (inv > 0.85) {
    const p = cam.ll(1.28, 51.10);
    U.drawCrossStamp(ctx, p[0], p[1], 84, seg(t, 0.40, 0.52), '#B5342A');
  }

  // royal navy silhouettes crossing the channel
  if (navy > 0) {
    const ships = [
      { at: [0.7, 50.45], d: 0.0 },
      { at: [-0.9, 50.05], d: 0.10 },
      { at: [-2.4, 49.7], d: 0.20 },
      { at: [-0.2, 50.75], d: 0.30 },
      { at: [1.6, 50.2], d: 0.40 },
    ];
    ships.forEach((sh, i) => {
      const k = clamp((navy - sh.d) * 3);
      if (k <= 0) return;
      const p = cam.ll(sh.at[0], sh.at[1]);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(p[0], p[1] - (1 - k) * 40);
      U.drawShip(ctx, 0, 0, sh.s, PAL.britainDark);
      ctx.restore();
    });
  }

  const labT = seg(t, 0.30, 0.45);
  M.drawLabel(ctx, cam, { lon: -4.8, lat: 51.4, text: 'GRAN BRETAÑA', display: true, size: 30, color: '#fff', haloColor: 'rgba(110,25,18,.85)', alpha: labT });
  M.drawLabel(ctx, cam, { lon: 2.6, lat: 49.0, text: 'FRANCIA', display: true, size: 30, color: '#fff', haloColor: 'rgba(20,30,60,.85)', alpha: labT });
  M.drawLabel(ctx, cam, { lon: -1.4, lat: 50.0, text: 'CANAL DE LA MANCHA', size: 20, color: '#12313d', alpha: labT });

  // army blocks at Boulogne
  const armyT = seg(t, 0.20, 0.34);
  if (armyT > 0) {
    ctx.save();
    ctx.globalAlpha = armyT;
    for (let i = 0; i < 12; i++) {
      const p = cam.ll(1.72 + (i % 4) * 0.11, 50.52 + Math.floor(i / 4) * 0.12);
      ctx.fillStyle = PAL.france;
      ctx.fillRect(p[0] - 8, p[1] - 8, 16, 16);
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(p[0] - 8, p[1] - 8, 16, 16);
    }
    ctx.restore();
    const bp = cam.ll(3.0, 49.6);
    U.drawStamp(ctx, 'EJÉRCITO DE BOLONIA', bp[0], bp[1], armyT, { size: 20, color: '#8E2A22', rot: 0.03 });
  }

  // Trafalgar explosion
  const kab = seg(t, 0.62, 0.74);
  if (kab > 0) {
    U.drawKaboom(ctx, 480, H - 320, 'TRAFALGAR\n1805', kab, { r: 235, bg: PAL.hm, size: 46 });
    const t2 = seg(t, 0.70, 0.86);
    ctx.save();
    ctx.globalAlpha = t2;
    U.setFont(ctx, 40, fonts.display, 800);
    ctx.fillStyle = PAL.white;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 12;
    ctx.lineJoin = 'round';
    ctx.textAlign = 'center';
    const msg = 'EL CANAL ERA BRITÁNICO';
    ctx.strokeText(msg, 480, H - 96);
    ctx.fillStyle = PAL.hm;
    ctx.fillText(msg, 480, H - 96);
    ctx.restore();
  }

  U.drawYear(ctx, '1805', 1);
  U.drawTag(ctx, 'PARTE 1 · EL RIVAL QUE NO SE PODÍA INVADIR', 1);
  U.drawPaperGrain(ctx, 0.55);
  U.drawVignette(ctx, 0.32);
}

// ---------------------------------------------------------------------------
// 4 · ECONOMIC WAR — THE CONTINENTAL SYSTEM
// ---------------------------------------------------------------------------
function blockade(ctx, t) {
  const cam = M.makeCamera({ ...CAMS.europe, zoom: lerp(0.74, 0.80, t) });

  // Europe in French blue, Britain in red
  const panels = [
    { territory: 'france', color: PAL.france },
    { territory: 'lowCountries', color: PAL.empire },
    { territory: 'leftRhine', color: PAL.empire },
    { territory: 'piedmont', color: PAL.empire },
    { territory: 'italyNorth', color: PAL.vassal },
    { territory: 'naples', color: PAL.vassal },
    { territory: 'confRhine', color: PAL.vassal, alpha: 0.7 },
    { territory: 'warsaw', color: PAL.vassal },
    { territory: 'spain', color: PAL.spain },
    { territory: 'britain', color: PAL.britain },
    { territory: 'russia', color: PAL.russia, alpha: 0.9 },
    { territory: 'austria', color: PAL.austria, alpha: 0.9 },
    { territory: 'ottoman', color: PAL.ottoman, alpha: 0.75 },
  ];
  M.drawMap(ctx, cam, { panels }, t);

  // red blockade line around Britain (drawn as a big arc)
  const ringT = ease.out(seg(t, 0.04, 0.30));
  if (ringT > 0) {
    const c = cam.ll(-3.2, 54.2);
    ctx.save();
    ctx.strokeStyle = PAL.britain;
    ctx.lineWidth = 9;
    ctx.setLineDash([24, 16]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], 420 * ringT, 500 * ringT, -0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    U.drawStamp(ctx, 'SISTEMA CONTINENTAL · 1806', c[0], c[1] - 560 * ringT, seg(t, 0.20, 0.35), {
      size: 30, color: PAL.ink, rot: -0.03,
    });
  }

  // port dots
  const ports = [[2.3, 51.0], [4.0, 51.9], [7.0, 53.6], [9.9, 53.5], [12.1, 54.1], [18.6, 54.4], [23.0, 59.4], [4.8, 43.3], [12.3, 41.7], [15.9, 39.0], [-1.6, 43.4], [-9.1, 38.7], [10.7, 44.9], [13.4, 45.6], [16.4, 43.5], [19.0, 42.4]];
  ports.forEach((p, i) => {
    const k = seg(t, 0.04 + i * 0.012, 0.16 + i * 0.012);
    if (k <= 0) return;
    const s = cam.ll(p[0], p[1]);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = PAL.hm;
    ctx.beginPath();
    ctx.arc(s[0], s[1], 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  });

  // three failures, in sequence
  const fails = [
    { t0: 0.36, n: 1, title: 'LOS ALIADOS NO SE ARRUINAN', sub: 'RUSIA Y PORTUGAL ABREN SUS PUERTOS', spec: [[30, 57], [-8.5, 40]] },
    { t0: 0.55, n: 2, title: 'CONTRABANDO', sub: 'SIEMPRE HAY CONTRABANDO', spec: null },
    { t0: 0.72, n: 3, title: 'CONTRA-BLOQUEO', sub: 'LONDRES CIERRA EL MAR', spec: null },
  ];
  // smuggling routes
  const smugT = seg(t, 0.52, 0.66);
  if (smugT > 0) {
    const routes = [
      { points: [[-6.5, 50.0], [-3.0, 49.0], [0.5, 49.6], [3.2, 50.6], [5.5, 51.6]], color: '#2E7D4F', width: 6, dashed: [14, 12] },
      { points: [[-5.5, 44.0], [-2.0, 44.6], [2.0, 44.9], [6.0, 45.2], [9.0, 45.6]], color: '#2E7D4F', width: 6, dashed: [14, 12] },
      { points: [[8.5, 54.0], [10.5, 55.6], [13.0, 57.2], [16.5, 58.0]], color: '#2E7D4F', width: 6, dashed: [14, 12] },
    ];
    for (const r of routes) {
      const pts = r.points;
      const cut = Math.max(1, Math.floor(pts.length * smugT));
      ctx.save();
      ctx.globalAlpha = 0.9;
      drawRoutePartial(ctx, cam, pts.slice(0, cut), r);
      ctx.restore();
    }
    // little boats
    if (smugT > 0.5) {
      const bp = cam.ll(-1.5, 49.2);
      ctx.save();
      ctx.globalAlpha = clamp((smugT - 0.5) * 2);
      U.drawShip(ctx, bp[0], bp[1], 0.16, '#1E5A38');
      ctx.restore();
    }
  }

  // counter-blockade: european ports dim
  const cbT = seg(t, 0.74, 0.88);
  if (cbT > 0) {
    for (const p of [[4.0, 51.9], [9.9, 53.5], [-1.6, 43.4], [2.3, 51.0]]) {
      const s = cam.ll(p[0], p[1]);
      ctx.save();
      ctx.globalAlpha = cbT * 0.85;
      ctx.fillStyle = '#2A2A2A';
      ctx.beginPath();
      ctx.arc(s[0], s[1], 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const a = cam.ll(4.05, 51.6);
    const b = cam.ll(9.9, 53.2);
    U.drawStamp(ctx, 'ÁMSTERDAM', a[0] + 120, a[1] + 10, cbT, { size: 20, color: PAL.white, rot: -0.06 });
    U.drawStamp(ctx, 'HAMBURGO', b[0] + 130, b[1] + 10, cbT, { size: 20, color: PAL.white, rot: -0.06 });
  }

  // the three failures as a stacked notification card (one slot, no clutter)
  U.drawCards(ctx, [
    { t0: 0.36, text: '1 · LOS ALIADOS NO SE ARRUINAN', color: '#B5342A', hold: 0.16 },
    { t0: 0.55, text: '2 · CONTRABANDO. SIEMPRE HAY CONTRABANDO', color: '#2E7D4F', hold: 0.16 },
    { t0: 0.74, text: '3 · CONTRA-BLOQUEO: LONDRES CIERRA EL MAR', color: '#22406B', hold: 0.22 },
  ], t, { x: 104, y: 330, w: 640 });

  U.drawYear(ctx, '1806', 1);
  U.drawTag(ctx, 'PARTE 2 · LA GUERRA ECONÓMICA', 1);
  U.drawPaperGrain(ctx, 0.55);
  U.drawVignette(ctx, 0.3);
}

function drawRoutePartial(ctx, cam, pts, style) {
  const s = pts.map((p) => cam.ll(p[0], p[1]));
  if (s.length < 2) return;
  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  if (style.dashed) ctx.setLineDash(style.dashed);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s[0][0], s[0][1]);
  for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0], s[i][1]);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 5 · PEACE OPPORTUNITIES
// ---------------------------------------------------------------------------
function peace(ctx, t) {
  const base = M.fitBox(-9, 41, 16, 55.5, 0.95);
  const cam = M.makeCamera(base);

  const panels = [
    { territory: 'france', color: PAL.france },
    { territory: 'britain', color: PAL.britain },
    { territory: 'lowCountries', color: PAL.vassal, alpha: 0.35 },
    { territory: 'italyNorth', color: PAL.vassal, alpha: 0.35 },
    { territory: 'piedmont', color: PAL.vassal, alpha: 0.35 },
    { territory: 'switzerland', color: PAL.vassal, alpha: 0.35 },
    { territory: 'spain', color: PAL.spain, alpha: 0.7 },
    { territory: 'austria', color: PAL.austria, alpha: 0.75 },
    { territory: 'prussiaEast', color: PAL.prussia, alpha: 0.6 },
  ];
  M.drawMap(ctx, cam, { panels }, t);

  // Amiens stamp, top centre
  const st = seg(t, 0.02, 0.16);
  U.drawStamp(ctx, 'PAZ DE AMIENS · 1802', 640, 250, st, { size: 40, color: '#B5342A', rot: -0.03 });

  // 14-month meter, bottom left
  const barT = ease.inOut(seg(t, 0.12, 0.40));
  if (barT > 0) drawMeter(ctx, 150, H - 190, 520, 26, barT, '14 MESES', 'DURACIÓN', '#C0392B');

  // during peace: annexations creep in
  const ann = [
    { t0: 0.34, key: 'piedmont', label: 'PIAMONTE 1802', lon: 9.4, lat: 44.2 },
    { t0: 0.44, key: 'switzerland', label: 'SUIZA 1803', lon: 10.4, lat: 47.2 },
    { t0: 0.54, key: 'lowCountries', label: 'HOLANDA 1806', lon: 7.6, lat: 53.4 },
  ];
  for (const a of ann) {
    const k = seg(t, a.t0, a.t0 + 0.08);
    if (k <= 0) continue;
    M.withWorldTransform(ctx, cam, 0, () => {
      ctx.globalAlpha = k;
      M.drawTerritory(ctx, cam, a.key, PAL.empire, 0.95, true);
      M.drawCoastHatch(ctx, cam, a.key, PAL.gold, 0.9, 9);
      ctx.globalAlpha = 1;
    });
  }
  U.drawCards(ctx, [
    { t0: 0.34, text: 'EN PLENA PAZ: PIAMONTE, 1802', color: '#B5342A' },
    { t0: 0.45, text: 'SUIZA, 1803', color: '#B5342A' },
    { t0: 0.55, text: 'HOLANDA, 1806', color: '#B5342A', hold: 0.16 },
  ], t, { x: 104, y: 330, w: 560 });

  // treaty timeline along the bottom
  const tt = seg(t, 0.58, 0.70);
  if (tt > 0) drawTreatyTimeline(ctx, tt, [['PRESSBURG', '1805'], ['TILSIT', '1807'], ['SCHÖNBRUNN', '1809']]);

  // the loop stamp, top right
  const lp = seg(t, 0.84, 0.94);
  if (lp > 0) U.drawStamp(ctx, 'FIRMA · CELEBRA · ANEXIONA · REPITE', W - 480, 250, lp, { size: 24, color: PAL.ink, rot: 0.02 });

  U.drawYear(ctx, '1802', 1);
  U.drawTag(ctx, 'PARTE 3 · LAS PACES QUE NO DURARON', 1);
  U.drawPaperGrain(ctx, 0.55);
  U.drawVignette(ctx, 0.3);
}

function drawMeter(ctx, x, y, w, h, k, label, sub, color) {
  ctx.save();
  U.setFont(ctx, 26, fonts.display, 800);
  ctx.fillStyle = PAL.white;
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.strokeText(label, x, y - 20);
  ctx.fillText(label, x, y - 20);
  ctx.fillStyle = 'rgba(24,21,17,0.75)';
  ctx.beginPath();
  ctx.roundRect(x - 4, y, w + 8, h + 8, 8);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y + 4, (w - 8) * k, h, 5);
  ctx.fill();
  U.setFont(ctx, 20, fonts.body, 700);
  ctx.fillStyle = PAL.ink;
  ctx.textAlign = 'right';
  ctx.fillText(sub, x + w, y - 16);
  ctx.restore();
}

function drawTreatyTimeline(ctx, k, items) {
  const y = H - 390;
  const x0 = 240;
  const w = W - 480;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x0 + (w - 0) * k, y);
  ctx.stroke();
  items.forEach((it, i) => {
    const x = x0 + (i + 0.5) * (w / items.length);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = PAL.hm;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 4;
    ctx.stroke();
    U.setFont(ctx, 30, fonts.display, 800);
    ctx.textAlign = 'center';
    ctx.fillStyle = PAL.white;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.strokeText(it[0], 0, -34);
    ctx.fillText(it[0], 0, -34);
    U.setFont(ctx, 22, fonts.body, 800);
    ctx.strokeText(it[1], 0, 52);
    ctx.fillText(it[1], 0, 52);
    ctx.restore();
  });
  ctx.restore();
}

module.exports = { opening, rise, question, channel, blockade, peace, CAMS, camAt };

// ---------------------------------------------------------------------------
// 6 · CHARACTER + VASSALS
// ---------------------------------------------------------------------------
function character(ctx, t) {
  const zoomT = ease.inOut(seg(t, 0.0, 0.12));
  const cam = M.makeCamera(camAt(CAMS.europe, CAMS.empire, zoomT));

  const panels = [
    { territory: 'france', color: PAL.france },
    { territory: 'lowCountries', color: PAL.empire },
    { territory: 'leftRhine', color: PAL.empire },
    { territory: 'piedmont', color: PAL.empire },
    { territory: 'italyNorth', color: PAL.vassal },
    { territory: 'naples', color: PAL.vassal },
    { territory: 'confRhine', color: PAL.vassal, alpha: 0.75 },
    { territory: 'warsaw', color: PAL.vassal },
    { territory: 'spain', color: PAL.spain, alpha: 0.75 },
    { territory: 'britain', color: PAL.britain, alpha: 0.85 },
    { territory: 'russia', color: PAL.russia, alpha: 0.65 },
    { territory: 'austria', color: PAL.austria, alpha: 0.7 },
  ];
  M.drawMap(ctx, cam, { panels }, t);

  // --- beat A: the victory curve that cannot stop (0.02 – 0.30)
  const aT = seg(t, 0.02, 0.26);
  if (aT > 0) drawVictoryChart(ctx, aT, seg(t, 0.20, 0.28));

  // --- beat B: vassal states light up (0.32 – 0.62)
  const vassals = [
    { key: 'confRhine', lon: 9.5, lat: 50.2, name: 'BAVIERA · SAJONIA', men: '63.000' },
    { key: 'warsaw', lon: 20.5, lat: 52.0, name: 'G. D. DE VARSOVIA', men: '90.000' },
    { key: 'italyNorth', lon: 10.5, lat: 45.2, name: 'REINO DE ITALIA', men: '45.000' },
    { key: 'naples', lon: 15.2, lat: 40.9, name: 'NÁPOLES', men: '30.000' },
  ];
  vassals.forEach((v, i) => {
    const k = seg(t, 0.34 + i * 0.055, 0.42 + i * 0.055);
    if (k <= 0) return;
    M.withWorldTransform(ctx, cam, 0, () => {
      M.drawTerritory(ctx, cam, v.key, '#8FA0C6', k * 0.95, true);
      M.drawCoastHatch(ctx, cam, v.key, PAL.gold, k * 0.85, 10);
    });
  });

  // --- beat C: the "allies" the treaty built, listed in one place (0.46 – 0.78)
  U.drawCards(ctx, [
    { t0: 0.40, text: 'BAVIERA Y SAJONIA: 63.000 HOMBRES', color: '#7C93C0' },
    { t0: 0.52, text: 'VARSOVIA: 90.000 HOMBRES', color: '#7C93C0' },
    { t0: 0.62, text: 'REINO DE ITALIA: 45.000', color: '#7C93C0' },
    { t0: 0.72, text: 'OBLIGADOS, NO CONVENCIDOS', color: '#B5342A', hold: 0.20 },
  ], t, { x: 104, y: 330, w: 620 });

  // --- beat D: the punchline card (0.72 – 1.0)
  const k = seg(t, 0.86, 0.93);
  if (k > 0) {
    ctx.save();
    ctx.globalAlpha = k * 0.55;
    ctx.fillStyle = 'rgba(24,20,15,1)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const s = ease.snap(k);
    ctx.save();
    ctx.translate(W / 2, H / 2 - 30);
    ctx.scale(0.9 + 0.1 * s, 0.9 + 0.1 * s);
    U.setFont(ctx, 62, fonts.display, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = PAL.ink;
    ctx.lineJoin = 'round';
    ctx.globalAlpha = clamp(k * 1.5);
    const l1 = 'UN ALIADO HUMILLADO';
    const l2 = 'ES UN ENEMIGO CON HORARIO';
    ctx.strokeText(l1, 0, -44);
    ctx.fillStyle = PAL.white;
    ctx.fillText(l1, 0, -44);
    ctx.strokeText(l2, 0, 40);
    ctx.fillStyle = PAL.hm;
    ctx.fillText(l2, 0, 40);
    ctx.restore();
  }

  // reason badge
  const rb = seg(t, 0.0, 0.05);
  U.drawReason(ctx, 1, 'EL CARÁCTER', rb, { x: 104, y: 250 });
  U.drawReason(ctx, 2, 'SIN ALIADOS REALES', seg(t, 0.32, 0.38), { x: 104, y: 250 });

  U.drawYear(ctx, '1806 – 1812', 1);
  U.drawTag(ctx, 'PARTE 4 · POR QUÉ NO PARÓ', 1);
  U.drawPaperGrain(ctx, 0.55);
  U.drawVignette(ctx, 0.3);
}

function drawVictoryChart(ctx, k, crossOut) {
  const x0 = 1290, y0 = H - 250, w = 470, h = 240;
  ctx.save();
  ctx.globalAlpha = clamp(k * 1.5);
  ctx.fillStyle = 'rgba(255,249,236,0.95)';
  ctx.beginPath();
  ctx.roundRect(x0 - 26, y0 - h - 56, w + 52, h + 96, 12);
  ctx.fill();
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = 5;
  ctx.stroke();

  U.setFont(ctx, 24, fonts.display, 800);
  ctx.fillStyle = PAL.ink;
  ctx.textAlign = 'left';
  ctx.fillText('VICTORIAS', x0, y0 - h - 22);

  // rising line
  ctx.beginPath();
  ctx.strokeStyle = PAL.britain;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  const pts = [[0, 1], [0.18, 0.82], [0.36, 0.6], [0.5, 0.46], [0.68, 0.24], [0.82, 0.12], [0.96, 0.02]];
  const cut = Math.floor(pts.length * clamp(k));
  ctx.moveTo(x0, y0 - h * pts[0][1]);
  for (let i = 1; i <= cut && i < pts.length; i++) {
    ctx.lineTo(x0 + w * pts[i][0], y0 - h * pts[i][1]);
  }
  ctx.stroke();

  // the "limit" line that gets crossed
  ctx.beginPath();
  ctx.strokeStyle = '#6B6152';
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 4;
  ctx.moveTo(x0, y0 - h * 0.45);
  ctx.lineTo(x0 + w, y0 - h * 0.45);
  ctx.stroke();
  ctx.setLineDash([]);
  U.setFont(ctx, 18, fonts.body, 800);
  ctx.fillStyle = '#6B6152';
  ctx.fillText('LÍMITE ACEPTABLE', x0 + 4, y0 - h * 0.45 - 14);
  ctx.restore();

  if (crossOut > 0) {
    U.drawCrossStamp(ctx, x0 + w * 0.55, y0 - h * 0.45, 120, crossOut, '#8E2A22');
  }
}

function drawDashedArrow(ctx, p, q, k, color, width) {
  const x = lerp(p[0], q[0], k);
  const y = lerp(p[1], q[1], k);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([16, 14]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 7 · IDEOLOGY
// ---------------------------------------------------------------------------
function ideology(ctx, t) {
  const cam = M.makeCamera({ ...CAMS.europe, zoom: lerp(0.78, 0.72, t) });
  const panels = [
    { territory: 'france', color: PAL.france },
    { territory: 'lowCountries', color: PAL.empire },
    { territory: 'leftRhine', color: PAL.empire },
    { territory: 'italyNorth', color: PAL.vassal },
    { territory: 'naples', color: PAL.vassal },
    { territory: 'confRhine', color: PAL.vassal, alpha: 0.7 },
    { territory: 'warsaw', color: PAL.vassal },
    { territory: 'spain', color: PAL.spain, alpha: 0.8 },
    { territory: 'austria', color: PAL.austria },
    { territory: 'prussiaEast', color: PAL.prussia, alpha: 0.85 },
    { territory: 'russia', color: PAL.russia },
    { territory: 'britain', color: PAL.britain },
  ];
  M.drawMap(ctx, cam, { panels }, t);

  // concentric waves of "revolution" spreading from Paris
  const wT = seg(t, 0.02, 0.55);
  if (wT > 0) {
    const p = cam.ll(2.35, 48.85);
    for (let i = 0; i < 5; i++) {
      const local = clamp((wT - i * 0.16) / 0.44);
      if (local <= 0 || local >= 1) continue;
      ctx.save();
      ctx.globalAlpha = (1 - local) * 0.55;
      ctx.strokeStyle = PAL.hm;
      ctx.lineWidth = 6 * (1 - local) + 1;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 40 + local * 900, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // three thrones
  const thrones = [
    { lon: 14.5, lat: 47.8, name: 'AUSTRIA' },
    { lon: 13.6, lat: 52.8, name: 'PRUSIA' },
    { lon: 32, lat: 57.5, name: 'RUSIA' },
  ];
  thrones.forEach((th, i) => {
    const k = seg(t, 0.18 + i * 0.07, 0.30 + i * 0.07);
    if (k <= 0) return;
    const p = cam.ll(th.lon, th.lat);
    U.drawCrown(ctx, p[0], p[1], ease.snap(k), PAL.ink);
    ctx.save();
    ctx.globalAlpha = k;
    U.setFont(ctx, 22, fonts.display, 800);
    ctx.textAlign = 'center';
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.strokeText(th.name, p[0], p[1] + 58);
    ctx.fillStyle = PAL.white;
    ctx.fillText(th.name, p[0], p[1] + 58);
    ctx.restore();
  });

  // ideas cards
  const ideas = ['CÓDIGO CIVIL', 'CONSTITUCIONES', 'FIN DE LOS PRIVILEGIOS'];
  ideas.forEach((c, i) => {
    const k = seg(t, 0.38 + i * 0.06, 0.48 + i * 0.06);
    if (k <= 0) return;
    cardChip(ctx, c, 130, 320 + i * 92, k, PAL.ink, PAL.hm);
  });

  // trust meter at 0%
  const mT = seg(t, 0.62, 0.78);
  if (mT > 0) {
    ctx.save();
    const x = W - 620, y = 210, w = 470;
    ctx.globalAlpha = clamp(mT * 1.4);
    ctx.fillStyle = 'rgba(255,249,236,0.95)';
    ctx.beginPath();
    ctx.roundRect(x - 30, y - 80, w + 60, 190, 12);
    ctx.fill();
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 5;
    ctx.stroke();
    U.setFont(ctx, 28, fonts.display, 800);
    ctx.fillStyle = PAL.ink;
    ctx.textAlign = 'left';
    ctx.fillText('CONFIANZA MUTUA', x, y - 34);
    ctx.fillStyle = 'rgba(24,20,15,0.14)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 34, 6);
    ctx.fill();
    U.setFont(ctx, 40, fonts.display, 800);
    ctx.fillStyle = PAL.britain;
    ctx.textAlign = 'right';
    ctx.fillText('0 %', x + w, y + 96);
    ctx.restore();
    const needle = cam.ll(2.35, 48.85);
    U.drawCrossStamp(ctx, x + w * 0.5, y + 17, 64, seg(t, 0.72, 0.80), '#8E2A22');
  }

  U.drawReason(ctx, 3, 'INCOMPATIBILIDAD IDEOLÓGICA', seg(t, 0.02, 0.08), { x: 104, y: 250 });
  U.drawYear(ctx, '1812', 1);
  U.drawTag(ctx, 'PARTE 4 · POR QUÉ NO PARÓ', 1);
  U.drawPaperGrain(ctx, 0.55);
  U.drawVignette(ctx, 0.32);
}

function cardChip(ctx, text, x, y, k, bg, fg) {
  const s = ease.snap(k);
  ctx.save();
  ctx.globalAlpha = clamp(k * 1.6);
  ctx.translate(x, y);
  ctx.scale(0.86 + 0.14 * s, 0.86 + 0.14 * s);
  U.setFont(ctx, 30, fonts.display, 800);
  const w = ctx.measureText(text).width + 56;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, -32, w, 64, 8);
  ctx.fill();
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 28, 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 8 · REJECTED OFFERS
// ---------------------------------------------------------------------------
function rejected(ctx, t) {
  const cam = M.makeCamera({ ...M.fitBox(-6, 40, 19, 55.5, 0.95) });

  // the empire collapses in reverse
  const collapse = seg(t, 0.02, 0.30);
  const keep = 1 - ease.inOut(collapse);
  const keepAllies = 1 - ease.inOut(collapse) * 0.85;
  const panels = [
    { territory: 'france', color: PAL.france },
    { territory: 'lowCountries', color: PAL.empire, alpha: lerp(0.35, 1, keep) },
    { territory: 'leftRhine', color: PAL.empire, alpha: lerp(0.3, 0.9, keep) },
    { territory: 'piedmont', color: PAL.empire, alpha: lerp(0.3, 0.9, keep) },
    { territory: 'italyNorth', color: PAL.vassal, alpha: keep },
    { territory: 'naples', color: PAL.vassal, alpha: keep },
    { territory: 'confRhine', color: PAL.vassal, alpha: keep * 0.9 },
    { territory: 'warsaw', color: PAL.vassal, alpha: keep },
    { territory: 'spain', color: PAL.spain, alpha: keep * 0.6 },
    { territory: 'russia', color: PAL.russia, alpha: keepAllies },
    { territory: 'austria', color: PAL.austria, alpha: keepAllies },
    { territory: 'prussiaEast', color: PAL.prussia, alpha: keepAllies * 0.95 },
    { territory: 'britain', color: PAL.britain },
  ];
  const arrows = [];
  // Russian campaign arrow entering and then reversing
  const go = ease.out(seg(t, 0.0, 0.16));
  if (go > 0) {
    arrows.push({ from: [20.5, 54.5], to: [lerp(20.5, 37.6, go), lerp(54.5, 55.7, go)], color: '#B5342A', width: 20, t: 1, bend: -0.1 });
  }
  const back = ease.inOut(seg(t, 0.16, 0.30));
  if (back > 0) {
    arrows.push({ from: [37.6, 55.7], to: [lerp(37.6, 23.5, back), lerp(55.7, 52.5, back)], color: '#6B3A2E', width: 14, t: 1, bend: 0.16 });
  }
  M.drawMap(ctx, cam, { panels, arrows }, t);

  // Frankfurt memorandum card
  const k = seg(t, 0.34, 0.46);
  if (k > 0) {
    const s = ease.snap(k);
    ctx.save();
    ctx.translate(W / 2, 430);
    ctx.rotate(-0.012);
    ctx.scale(0.92 + 0.08 * s, 0.92 + 0.08 * s);
    ctx.globalAlpha = clamp(k * 1.4) * (1 - 0.98 * seg(t, 0.74, 0.84));
    // paper
    ctx.fillStyle = '#FBF3DF';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
    ctx.beginPath();
    ctx.roundRect(-430, -190, 860, 380, 6);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#C9B98F';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    U.setFont(ctx, 24, fonts.body, 800);
    ctx.fillStyle = '#8A7A5E';
    ctx.fillText('CONGRESO DE PRAGA · 1813', 0, -140);
    U.setFont(ctx, 40, fonts.display, 800);
    ctx.fillStyle = PAL.ink;
    ctx.fillText('OFERTA DE PAZ', 0, -92);
    U.setFont(ctx, 25, fonts.body, 700);
    ctx.fillStyle = '#4A4237';
    ctx.fillText('Conservar Francia con sus', 0, -34);
    ctx.fillText('fronteras naturales', 0, 4);
    U.setFont(ctx, 21, fonts.body, 700);
    ctx.fillStyle = '#8A7A5E';
    ctx.fillText('Rusia · Austria · Prusia · Reino Unido', 0, 62);
    // signature line
    ctx.strokeStyle = '#B8A87F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-250, 118);
    ctx.lineTo(250, 118);
    ctx.stroke();
    U.setFont(ctx, 18, fonts.body, 700);
    ctx.fillStyle = '#A08F6B';
    ctx.fillText('NAPOLEÓN, EMPERADOR DE LOS FRANCESES', 0, 146);
    ctx.restore();
  }
  // stamped response
  const st = seg(t, 0.52, 0.62);
  if (st > 0) U.drawStamp(ctx, 'RECHAZADA', W / 2 + 210, 540, st, { size: 54, color: '#B5342A', rot: -0.14 });

  // two reasons
  const r1 = seg(t, 0.66, 0.74);
  const r2 = seg(t, 0.74, 0.82);
  if (r1 > 0) chipPair(ctx, 'EXCESO DE CONFIANZA', r1, 330, H - 200);
  if (r2 > 0) chipPair(ctx, 'DESCONFIANZA MUTUA', r2, 330, H - 300);

  // Paris falls → abdication → Elba
  const el = seg(t, 0.84, 0.96);
  if (el > 0) {
    const p = cam.ll(2.35, 48.85);
    U.drawKaboom(ctx, p[0], p[1] - 10, 'PARÍS\n1814', el, { r: 120, bg: PAL.britain, size: 32 });
    const isl = cam.ll(10.3, 42.8);
    drawDashedArrow(ctx, p, isl, ease.out(el), PAL.hm, 7);
    U.drawStamp(ctx, 'ELBA', isl[0] + 130, isl[1] - 6, seg(t, 0.92, 1), { size: 26, color: '#8E2A22', rot: 0.05 });
  }

  U.drawYear(ctx, '1813', 1);
  U.drawTag(ctx, 'PARTE 5 · LA OFERTA QUE DIJO NO', 1);
  U.drawPaperGrain(ctx, 0.55);
  U.drawVignette(ctx, 0.34);
}

function chipPair(ctx, text, k, x, y) {
  const s = ease.snap(k);
  ctx.save();
  ctx.globalAlpha = clamp(k * 1.5);
  ctx.translate(x, y ?? H - 250);
  ctx.scale(0.9 + 0.1 * s, 0.9 + 0.1 * s);
  U.setFont(ctx, 34, fonts.display, 800);
  const w = ctx.measureText(text).width + 56;
  ctx.fillStyle = PAL.ink;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -34, w, 68, 9);
  ctx.fill();
  ctx.fillStyle = PAL.hm;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 9 · WATERLOO + OUTRO
// ---------------------------------------------------------------------------
function outro(ctx, t) {
  // --- Waterloo (0 – 0.34)
  const camA = M.makeCamera({ ...M.fitBox(-7, 41, 14, 53, 0.95) });
  const camB = M.makeCamera({ ...CAMS.world });
  const cam = t < 0.30 ? camA : camB;

  const panels = [
    { territory: 'france', color: t < 0.36 ? PAL.france : PAL.france, alpha: t > 0.42 ? 1 - seg(t, 0.42, 0.62) * 0.55 : 1 },
    { territory: 'britain', color: PAL.britain, alpha: 0.95 },
    { territory: 'lowCountries', color: PAL.landDark, alpha: 0.9 },
    { territory: 'spain', color: PAL.spain, alpha: 0.85 },
    { territory: 'austria', color: PAL.austria, alpha: 0.8 },
    { territory: 'russia', color: PAL.russia, alpha: 0.8 },
  ];
  M.drawMap(ctx, cam, { panels }, t);

  if (t < 0.32) {
    // hundred days: Elba → Paris → Waterloo
    const hd = ease.inOut(seg(t, 0.0, 0.10));
    const pE = cam.ll(10.3, 42.8), pP = cam.ll(2.35, 48.85);
    drawDashedArrow(ctx, pE, pP, hd, PAL.hm, 8);
    ctx.save();
    ctx.globalAlpha = clamp(hd * 2);
    ctx.fillStyle = PAL.hm;
    ctx.beginPath();
    ctx.arc(pE[0], pE[1], 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = `800 22px ${fonts.display}`;
    ctx.fillStyle = PAL.white;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.textAlign = 'center';
    ctx.strokeText('ELBA', pE[0], pE[1] + 44);
    ctx.fillText('ELBA', pE[0], pE[1] + 44);
    ctx.restore();
    U.drawStamp(ctx, 'LOS CIEN DÍAS', 1050, 225, seg(t, 0.03, 0.12), { size: 24, color: '#8E2A22' });
    const w = seg(t, 0.14, 0.24);
    if (w > 0) {
      const pW = cam.ll(4.35, 50.68);
      U.drawKaboom(ctx, 420, H - 300, 'WATERLOO\n1815', w, { r: 175, bg: PAL.hm, size: 44 });
    }
  } else {
    // Atlantic: the long voyage to Saint Helena
    const v = ease.inOut(seg(t, 0.28, 0.58));
    const p1 = cam.ll(4, 36);
    const p2 = cam.ll(-5.7, -15.97);
    const onScreen = true;
    ctx.save();
    ctx.strokeStyle = PAL.hm;
    ctx.lineWidth = 6;
    ctx.setLineDash([18, 16]);
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(lerp(p1[0], p2[0], v), lerp(p1[1], p2[1], v));
    ctx.stroke();
    ctx.restore();
    const islandFade = 1 - seg(t, 0.84, 0.88);
    if (v > 0.6 && islandFade > 0) {
      const kk = clamp((v - 0.6) * 3) * islandFade;
      ctx.save();
      ctx.globalAlpha = kk;
      // the island itself, deliberately tiny
      ctx.fillStyle = PAL.ink;
      ctx.beginPath();
      ctx.ellipse(p2[0], p2[1], 13, 9, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // rings, like a radar ping
      for (let i = 0; i < 3; i++) {
        const tt = clamp((kk - i * 0.2) / 0.8);
        if (tt <= 0) continue;
        ctx.globalAlpha = kk * (1 - tt) * 0.8;
        ctx.strokeStyle = PAL.hm;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p2[0], p2[1], 20 + tt * 150, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = kk;
      ctx.font = `800 30px ${fonts.display}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = PAL.white;
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = 9;
      ctx.lineJoin = 'round';
      ctx.strokeText('SANTA ELENA', p2[0], p2[1] + 58);
      ctx.fillText('SANTA ELENA', p2[0], p2[1] + 58);
      ctx.font = `700 22px ${fonts.body}`;
      ctx.strokeText('1.900 KM DE CASA', p2[0], p2[1] + 92);
      ctx.fillText('1.900 KM DE CASA', p2[0], p2[1] + 92);
      ctx.restore();
    }
    // map reverts to 1792 borders
    const rev = seg(t, 0.60, 0.78);
    if (rev > 0) {
      ctx.save();
      ctx.globalAlpha = rev * 0.5;
      ctx.fillStyle = 'rgba(244,234,213,1)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  // final card
  const k = seg(t, 0.86, 0.93);
  if (k > 0) {
    const s2 = ease.snap(k);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(26,21,16,0.95)';
    ctx.fillRect(0, 0, W, H);
    // frame
    ctx.strokeStyle = 'rgba(242,193,78,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(70, 70, W - 140, H - 140);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = clamp((t - 0.80) * 6);
    U.setFont(ctx, 26, fonts.body, 800);
    ctx.fillStyle = PAL.goldLight;
    ctx.fillText('DATO CURIOSO', W / 2, H / 2 - 214);
    ctx.save();
    ctx.translate(W / 2, H / 2 - 60);
    ctx.scale(0.94 + 0.06 * s2, 0.94 + 0.06 * s2);
    U.setFont(ctx, 64, fonts.display, 800);
    ctx.fillStyle = PAL.white;
    ctx.fillText('LA PAZ QUE NAPOLEÓN', 0, 0);
    ctx.fillText('NO QUISO FIRMAR', 0, 74);
    ctx.fillStyle = PAL.hm;
    ctx.fillText('DURÓ HASTA QUE ÉL MURIÓ', 0, 160);
    ctx.restore();
    ctx.globalAlpha = clamp((t - 0.88) * 6);
    U.setFont(ctx, 32, fonts.body, 700);
    ctx.fillStyle = 'rgba(255,249,236,0.85)';
    ctx.fillText('Claro que aquello no fue una paz. Fue una isla.', W / 2, H / 2 + 200);
    ctx.restore();
  }

  if (t < 0.86) {
    U.drawYear(ctx, t < 0.28 ? '1815' : '1815 → 1821', 1);
    U.drawTag(ctx, 'DESENLACE · VUELTA AL PUNTO DE PARTIDA', 1);
  }
  U.drawPaperGrain(ctx, 0.55);
  U.drawVignette(ctx, 0.36);
}

module.exports.character = character;
module.exports.ideology = ideology;
module.exports.rejected = rejected;
module.exports.outro = outro;
