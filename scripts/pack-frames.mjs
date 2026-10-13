// Packs art grids extracted from the frames of one sheet (scripts/split-sheet.mjs, then
// scripts/extract-hero.mjs with all frames in one run so they share a palette) into a single
// animation file: { name, source, alphabet, palette, frames: [{ w, h, rows }] }.
//
//   node scripts/pack-frames.mjs out.json "Name" "source note" frame-1.json frame-2.json …

import fs from 'node:fs';

const [out, name, source, ...inputs] = process.argv.slice(2);
const grids = inputs.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const { alphabet, palette } = grids[0];
for (const g of grids) {
  if (g.palette.join() !== palette.join()) throw new Error('frames must share one palette (extract them in one run)');
}
const json = { name, source, alphabet, palette, frames: grids.map(({ w, h, rows }) => ({ w, h, rows })) };
const text = JSON.stringify(json, null, 2)
  .replace(/"palette": \[\s+([^\]]+?)\s+\]/s, (m, body) => `"palette": [${body.split(/,\s+/).join(', ')}]`)
  .replace(/"rows": \[\s+([^\]]+?)\s+\]/gs, (m, body) => `"rows": [${body.split(/,\s+/).join(', ')}]`);
fs.writeFileSync(out, text + '\n');
console.log(`${out}: ${grids.length} frames, ${palette.length} colours`);
