// Packs art grids extracted from the frames of one sheet (scripts/split-sheet.mjs, then
// scripts/extract-hero.mjs with all frames in one run so they share a palette) into a single
// animation file: { name, source, alphabet, palette, frames: [{ w, h, rows }] }.
// Frames all of one size (extracted with --keep, so in register) are cut down together to the
// area any of them uses, so they stay in register; the source note says where that area was.
// A frame drawn off-centre in its cell (it would jump from one frame to the next) is moved back
// first with --shift k:dx,dy (frame k, counted from 1, moved dx art pixels right and dy down).
//
//   node scripts/pack-frames.mjs out.json "Name" "source note" [--shift 3:2,0 …] frame-1.json frame-2.json …

import fs from 'node:fs';

const [out, name, source, ...rest] = process.argv.slice(2);
const shifts = new Map();
const inputs = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--shift') {
    const [k, d] = rest[++i].split(':');
    shifts.set(Number(k), d.split(',').map(Number));
  } else inputs.push(rest[i]);
}
const grids = inputs.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const { alphabet, palette } = grids[0];
for (const g of grids) {
  if (g.palette.join() !== palette.join()) throw new Error('frames must share one palette (extract them in one run)');
}
let frames = grids.map(({ w, h, rows }, i) => {
  const [dx, dy] = shifts.get(i + 1) || [0, 0];
  if (!dx && !dy) return { w, h, rows };
  const blank = '.'.repeat(w);
  const moved = rows.map((_, y) => {
    const row = rows[y - dy] ?? blank;
    return dx >= 0 ? ('.'.repeat(dx) + row).slice(0, w) : (row + '.'.repeat(-dx)).slice(-dx);
  });
  return { w, h, rows: moved };
});
let note = source;
if (shifts.size) note += `; frames moved back into register: ${[...shifts].map(([k, [dx, dy]]) => `frame ${k} by ${dx}, ${dy}`).join(', ')}`;
const { w: W, h: H } = frames[0];
const even = frames.every((f) => f.w === W && f.h === H);
if (even) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (const f of frames) {
    f.rows.forEach((row, y) => {
      for (let x = 0; x < W; x++) {
        if (row[x] === '.') continue;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    });
  }
  if (x1 >= 0 && (x0 > 0 || y0 > 0 || x1 < W - 1 || y1 < H - 1)) {
    frames = frames.map((f) => ({ w: x1 - x0 + 1, h: y1 - y0 + 1, rows: f.rows.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1)) }));
    note += `; all frames cut to columns ${x0}..${x1} and rows ${y0}..${y1} of their ${W} x ${H} grids`;
  }
}
const json = { name, source: note, alphabet, palette, frames };
const text = JSON.stringify(json, null, 2)
  .replace(/"palette": \[\s+([^\]]+?)\s+\]/s, (m, body) => `"palette": [${body.split(/,\s+/).join(', ')}]`)
  .replace(/"rows": \[\s+([^\]]+?)\s+\]/gs, (m, body) => `"rows": [${body.split(/,\s+/).join(', ')}]`);
fs.writeFileSync(out, text + '\n');
console.log(`${out}: ${grids.length} frames${even ? ` of ${frames[0].w}x${frames[0].h}` : ''}, ${palette.length} colours`);
