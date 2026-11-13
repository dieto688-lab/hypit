'use strict';
// Render one frame of one scene, for composition review.
//   node tools/frame.js <scene> <t> [out.png]
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas } = require('@napi-rs/canvas');
const M = require('../lib/map');
const S = require('../lib/scenes');

const scene = process.argv[2] || 'rise';
const t = parseFloat(process.argv[3] || '0.5');
const out = process.argv[4] || path.join(__dirname, '..', 'output', `${scene}-${t}.png`);
if (typeof S[scene] !== 'function') {
  console.error(`unknown scene "${scene}". options: ${['opening', 'rise', 'question', 'channel', 'blockade', 'peace', 'character', 'ideology', 'rejected', 'outro'].join(', ')}`);
  process.exit(1);
}
const canvas = createCanvas(M.W, M.H);
const ctx = canvas.getContext('2d');
ctx.clearRect(0, 0, M.W, M.H);
S[scene](ctx, t);
fs.writeFileSync(out, canvas.toBuffer('image/png'));
console.log(out);
