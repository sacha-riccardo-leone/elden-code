// Bakes every drawn character's sheet ahead of time (client/js/heroes/core.js, loadSheet), so that the
// game loads it as pictures instead of drawing every frame as it starts: the heroes, the great
// enemies and the spectres. For each, in client/assets/hero/baked (or --out):
//   <id>.png, <id>-glow.png          every frame on its grid, and what glows in each
//   <id>-big.png, <id>-big-glow.png  its big drawn poses (bigFrame), if it has any
//   <id>.json                        how they're laid out, what each frame holds, and the fingerprint
//                                    of the art and code they were made from (heroes/bake.js), and
//                                    which files those were
// The game uses a bake only while its fingerprint is still that of the art and code it has (else it
// draws that sheet as it starts, as before), unless the bake is --trusted: the public build's, made
// with the very code it ships (scripts/build-public.mjs). --stale bakes only those whose fingerprint
// has changed (the bridge does so as it starts: server/bridge.js). Baked sheets are never committed.
//
//   node scripts/bake-sheets.mjs [--stale] [--trusted] [--out dir]      (npm run bake)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { png } from './image-io.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = path.join(root, 'client');
const module = (rel) => import(pathToFileURL(path.join(CLIENT, 'js', rel)).href);

// A file's text, as the page fetches it: a module by its URL, the art by its path under the site.
const read = async (url) => fs.readFileSync(url.startsWith('file:') ? fileURLToPath(url) : path.join(CLIENT, url), 'utf8');

export async function bake({ out = path.join(CLIENT, 'assets', 'hero', 'baked'), stale = false, trusted = false } = {}) {
  const [{ HEROES }, boss, golem, spectre, { sheetPixels }, { inputs, hashOf }] = await Promise.all([
    module('heroes/index.js'), module('heroes/boss.js'), module('heroes/golem.js'), module('heroes/spectre.js'),
    module('heroes/core.js'), module('heroes/bake.js'),
  ]);
  const rigs = [...HEROES, boss.default, golem.default, spectre.default];
  fs.mkdirSync(out, { recursive: true });
  const done = { baked: [], kept: [], bytes: 0 };
  for (const rig of rigs) {
    const parts = await inputs(rig, read);
    const print = await hashOf(parts);
    const names = (big) => ['', '-glow', ...(big ? ['-big', '-big-glow'] : [])].map((s) => `${rig.id}${s}.png`);
    const metaFile = path.join(out, `${rig.id}.json`);
    if (stale && fs.existsSync(metaFile)) {
      try {
        const was = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        if (was.fingerprint === print && !!was.trusted === trusted && names(was.big).every((n) => fs.existsSync(path.join(out, n)))) {
          done.kept.push(rig.id);
          continue;
        }
      } catch {} // (unreadable: baked again)
    }
    const json = JSON.parse(await read(rig.art));
    const extras = {};
    for (const [k, url] of Object.entries(rig.extraArt || {})) extras[k] = JSON.parse(await read(url));
    const px = sheetPixels(rig, json, extras);
    // (each written whole and then put in place, the json last: a bake is only there once it is)
    const write = (name, data) => {
      const file = path.join(out, name);
      fs.writeFileSync(`${file}.tmp`, data);
      fs.renameSync(`${file}.tmp`, file);
      done.bytes += data.length;
    };
    const [color, glow, bigColor, bigGlow] = names(px.big);
    write(color, png(px.width, px.height, px.color, 6));
    write(glow, png(px.width, px.height, px.glow, 6));
    if (px.big) {
      write(bigColor, png(px.big.width, px.big.height, px.big.color, 6));
      write(bigGlow, png(px.big.width, px.big.height, px.big.glow, 6));
    }
    const grid = (g) => ({ width: g.width, height: g.height, frameW: g.frameW, frameH: g.frameH, cols: g.cols, rows: g.rows });
    write(`${rig.id}.json`, JSON.stringify({
      id: rig.id,
      fingerprint: print,
      files: parts.map(([name]) => name),
      ...(trusted && { trusted: true }),
      ...grid(px),
      frameCount: px.frameCount,
      slots: px.slots,
      tops: px.tops,
      spans: px.spans,
      glows: px.glows,
      big: px.big && grid(px.big),
    }));
    done.baked.push(rig.id);
  }
  return done;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const outAt = args.indexOf('--out');
  const t = Date.now();
  const r = await bake({ out: outAt >= 0 ? path.resolve(args[outAt + 1]) : undefined, stale: args.includes('--stale'), trusted: args.includes('--trusted') });
  console.log(`baked ${r.baked.length} sheets (${(r.bytes / 1024 / 1024).toFixed(1)} MB), ${r.kept.length} still their own, in ${((Date.now() - t) / 1000).toFixed(1)} s`);
}
