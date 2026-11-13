'use strict';
// Geography + stylised historical territories for the Napoleon short.
// Base map: Natural Earth 110m (world-atlas), projected with a plain Mercator
// into a fixed "world" pixel space, so scenes can just move a camera over it.

const path = require('node:path');
const topo = require('world-atlas/countries-110m.json');
const { feature } = require('topojson-client');
const pc = require('polygon-clipping');
const { Path2D } = require('@napi-rs/canvas');

// ---------------------------------------------------------------- projection
const ORIGIN_LON = -25;
const ORIGIN_LAT = 72;
const PX_PER_DEG = 60;
const D2R = Math.PI / 180;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2)) * (180 / Math.PI);

function project(lon, lat) {
  return [(lon - ORIGIN_LON) * PX_PER_DEG, (mercY(ORIGIN_LAT) - mercY(lat)) * PX_PER_DEG];
}
function unproject(x, y) {
  const lon = x / PX_PER_DEG + ORIGIN_LON;
  const m = mercY(ORIGIN_LAT) - y / PX_PER_DEG;
  const lat = (2 * Math.atan(Math.exp(m * D2R)) - Math.PI / 2) / D2R;
  return [lon, lat];
}

// --------------------------------------------------------------- geo helpers
const fc = feature(topo, topo.objects.countries);
const byName = new Map();
for (const f of fc.features) byName.set(f.properties.name, f);

function toMulti(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}
function projMulti(multi) {
  return multi.map((poly) => poly.map((ring) => ring.map(([lon, lat]) => project(lon, lat))));
}
function box(lon1, lat1, lon2, lat2) {
  const [x1, y1] = project(lon1, lat1);
  const [x2, y2] = project(lon2, lat2);
  return [
    [
      [Math.min(x1, x2), Math.min(y1, y2)],
      [Math.max(x1, x2), Math.min(y1, y2)],
      [Math.max(x1, x2), Math.max(y1, y2)],
      [Math.min(x1, x2), Math.max(y1, y2)],
      [Math.min(x1, x2), Math.min(y1, y2)],
    ],
  ];
}
const inter = (a, b) => pc.intersection(a, b);
const union = (...a) => pc.union(...a);
const diff = (a, b) => pc.difference(a, b);

function geo(name, clip) {
  const f = byName.get(name);
  if (!f) throw new Error(`country not found: ${name}`);
  let m = projMulti(toMulti(f.geometry));
  m = inter(m, box(-24, 28, 74, 72));
  if (clip) m = inter(m, box(...clip));
  return m;
}
function geoNot(name, clip) {
  const f = byName.get(name);
  let m = projMulti(toMulti(f.geometry));
  m = inter(m, box(-24, 28, 74, 72));
  m = diff(m, box(...clip));
  return m;
}

function toPath2D(multi) {
  const p = new Path2D();
  for (const poly of multi) {
    for (const ring of poly) {
      if (!ring.length) continue;
      p.moveTo(ring[0][0], ring[0][1]);
      for (let i = 1; i < ring.length; i++) p.lineTo(ring[i][0], ring[i][1]);
      p.closePath();
    }
  }
  return p;
}

// ------------------------------------------------------------------ borders
// Every territory is a set of multi-polygons in world coordinates.
const M = {};

// France: metropolitan only (drops overseas départements).
M.france = geo('France', [-6, 41.2, 9.7, 51.4]);
M.lowCountries = union(
  geo('Belgium'),
  geo('Netherlands'),
  geo('Luxembourg')
);
M.leftRhine = geo('Germany', [-0.5, 46.5, 7.6, 55]);
M.confRhine = geoNot('Germany', [-0.5, 46.5, 7.6, 55]);

M.piedmont = geo('Italy', [6.4, 43, 9.6, 46.6]);
M.italyNorth = geoNot('Italy', [6.4, 43, 9.6, 46.6]);
M.italyNorth = geoNot2(M.italyNorth); // southern part handled below
function geoNot2(m) {
  // split Italy in two at lat 42.5: north = kingdom of Italy, south = Naples
  return diff(m, box(6, 35, 20, 42.55));
}
M.naples = diff(geo('Italy'), M.italyNorth, M.piedmont);

M.spain = geo('Spain');
M.catalonia = geo('Spain', [0.6, 40.6, 4.5, 43]);
M.spainRest = diff(geo('Spain'), M.catalonia);
M.portugal = geo('Portugal');

M.austria = union(geo('Austria'), geo('Czechia'), geo('Slovakia'), geo('Hungary'));
M.illyria = union(geo('Slovenia'), geo('Croatia'));
M.switzerland = geo('Switzerland');
M.denmark = geo('Denmark');
M.norway = geo('Norway');
M.sweden = geo('Sweden');
M.finland = geo('Finland');
M.prussiaEast = geo('Poland', [14.2, 52.4, 24, 56.5]);
M.warsaw = geoNot('Poland', [14.2, 52.4, 24, 56.5]);
M.russia = geo('Russia', [-25, 44, 74, 72]);
M.britain = union(geo('United Kingdom'), geo('Ireland'));
M.ottoman = union(
  geo('Turkey'), geo('Greece'), geo('Bulgaria'), geo('Romania'), geo('Serbia'),
  geo('Bosnia and Herz.'), geo('Montenegro'), geo('Albania'), geo('Macedonia'), geo('Kosovo')
);
M.sardinia = geo('Italy', [7.8, 38.7, 9.9, 41.5]);
M.sicily = geo('Italy', [11.9, 36.5, 15.7, 38.4]);
M.balearic = geo('Spain', [1, 38.5, 4.5, 40.2]);

// Base "rest of the world" used to keep continents visually complete.
M.europeOther = (() => {
  const names = ['Germany', 'Poland', 'Italy', 'Spain', 'Portugal', 'France',
    'Austria', 'Czechia', 'Slovakia', 'Hungary', 'Slovenia', 'Croatia',
    'Switzerland', 'Belgium', 'Netherlands', 'Luxembourg', 'Denmark', 'Norway',
    'Sweden', 'Finland', 'United Kingdom', 'Ireland', 'Russia', 'Turkey',
    'Greece', 'Bulgaria', 'Romania', 'Serbia', 'Bosnia and Herz.', 'Montenegro',
    'Albania', 'Macedonia', 'Kosovo', 'Belarus', 'Ukraine', 'Lithuania',
    'Latvia', 'Estonia', 'Moldova', 'Libya', 'Egypt', 'Algeria', 'Tunisia',
    'Morocco', 'Syria', 'Iraq', 'Georgia', 'Armenia', 'Azerbaijan', 'Kazakhstan',
    'Iceland', 'Cyprus', 'Malta'];
  let out = [];
  for (const n of names) {
    const f = byName.get(n);
    if (!f) continue;
    out.push(projMulti(toMulti(f.geometry)));
  }
  return out.flat(1);
})();
M.northAfrica = union(geo('Libya'), geo('Egypt'), geo('Algeria'), geo('Tunisia'), geo('Morocco'));

// ------------------------------------------------------------------ exports
const paths = {};
for (const [k, v] of Object.entries(M)) paths[k] = toPath2D(v);

module.exports = {
  project, unproject, toPath2D, paths, multipolygons: M, box, pc,
  PX_PER_DEG, ORIGIN_LON, ORIGIN_LAT,
};
