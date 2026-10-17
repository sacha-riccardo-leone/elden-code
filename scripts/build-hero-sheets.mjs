// Exports every hand-drawn hero as files you can use anywhere:
//   assets/hero/<id>-sheet.png   all frames, laid out on a grid
//   assets/hero/<id>-glow.png    the glow (emissive) map for the same grid
//   assets/hero/<id>-sheet.json  frame size, grid and every animation's frames and fps
//   assets/hero/<id>-big-sheet.png, <id>-big-glow.png  a hero's big drawn poses, if it has any, in
//                                 frames of their own (bigFrame; the sheet's json says which: big.poses,
//                                 in order, the rest keeping theirs on the main sheet)
//   assets/hero/<id>-<anim>.gif  an animated preview of each animation (3x, looping)
// and the rigged fire of Roundtable Hold (client/js/fire.js) as assets/fx/<brazier-N|candle>.gif.
// Usage: node scripts/build-hero-sheets.mjs   (no dependencies; PNG and GIF are encoded here)

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { HEROES } from '../client/js/heroes/index.js';
import { sheetPixels, buildFrames, anchorOf, frameOf, NONE } from '../client/js/heroes/core.js';
import { rigFires, BRAZIER, CANDLE } from '../client/js/fire.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'client', 'assets', 'hero');

// ---------------------------------------------------------------------------------------------
// PNG (RGBA, filter 0)

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------------------------
// GIF89a (global palette, one transparent index, LZW)

function lzw(indices, minCode) {
  const clear = 1 << minCode;
  const eoi = clear + 1;
  const out = [];
  let cur = 0;
  let bits = 0;
  let size = minCode + 1;
  const emit = (code) => {
    cur |= code << bits;
    bits += size;
    while (bits >= 8) { out.push(cur & 0xff); cur >>>= 8; bits -= 8; }
  };
  let dict = new Map();
  let next = eoi + 1;
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 4096 + k;
    if (dict.has(key)) { prefix = dict.get(key); continue; }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << size && size < 12) size++;
    } else {
      emit(clear);
      dict = new Map();
      next = eoi + 1;
      size = minCode + 1;
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bits > 0) out.push(cur & 0xff);
  return Buffer.from(out);
}

function gif(width, height, frames, palette, delayCs) {
  const T = palette.length; // transparent index
  const tableSize = 64;
  const minCode = 6;
  const parts = [Buffer.from('GIF89a', 'ascii')];
  const lsd = Buffer.alloc(7);
  lsd.writeUInt16LE(width, 0);
  lsd.writeUInt16LE(height, 2);
  lsd[4] = 0x80 | 0x70 | (minCode - 1); // global table, 8-bit colour resolution, 64 entries
  parts.push(lsd);
  const table = Buffer.alloc(tableSize * 3);
  palette.forEach((hex, i) => {
    const n = parseInt(hex.slice(1), 16);
    table[i * 3] = (n >> 16) & 255; table[i * 3 + 1] = (n >> 8) & 255; table[i * 3 + 2] = n & 255;
  });
  parts.push(table);
  parts.push(Buffer.from([0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0', 'ascii'), 0x03, 0x01, 0x00, 0x00, 0x00]));
  for (const indices of frames) {
    const gce = Buffer.from([0x21, 0xf9, 0x04, 0x09, delayCs & 255, delayCs >> 8, T, 0x00]); // dispose: restore bg, transparent
    const desc = Buffer.alloc(10);
    desc[0] = 0x2c;
    desc.writeUInt16LE(width, 5);
    desc.writeUInt16LE(height, 7);
    const data = lzw(indices, minCode);
    const blocks = [];
    for (let i = 0; i < data.length; i += 255) {
      const piece = data.subarray(i, i + 255);
      blocks.push(Buffer.from([piece.length]), piece);
    }
    parts.push(gce, desc, Buffer.from([minCode]), ...blocks, Buffer.from([0]));
  }
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------------------------

const SCALE = 3;
for (const rig of HEROES) {
  const readArt = (url) => JSON.parse(fs.readFileSync(path.join(root, 'client', url.replace(/^\//, '')), 'utf8'));
  const json = readArt(rig.art);
  const extras = Object.fromEntries(Object.entries(rig.extraArt || {}).map(([k, url]) => [k, readArt(url)]));
  const sheet = sheetPixels(rig, json, extras);
  fs.writeFileSync(path.join(outDir, `${rig.id}-sheet.png`), png(sheet.width, sheet.height, sheet.color));
  fs.writeFileSync(path.join(outDir, `${rig.id}-glow.png`), png(sheet.width, sheet.height, sheet.glow));
  if (sheet.big) {
    fs.writeFileSync(path.join(outDir, `${rig.id}-big-sheet.png`), png(sheet.big.width, sheet.big.height, sheet.big.color));
    fs.writeFileSync(path.join(outDir, `${rig.id}-big-glow.png`), png(sheet.big.width, sheet.big.height, sheet.big.glow));
  }
  const meta = {
    name: json.name,
    frame: rig.frame,
    columns: rig.cols,
    frames: sheet.frameCount,
    feet: { x: anchorOf(rig.frame), y: rig.frame.h - 1 },
    ...(sheet.big && {
      big: {
        frame: rig.bigFrame,
        columns: sheet.big.cols,
        feet: { x: anchorOf(rig.bigFrame), y: rig.bigFrame.h - 1 },
        poses: sheet.slots.flatMap((s, i) => (s.big ? [i] : [])),
      },
    }),
    animations: Object.fromEntries(Object.entries(rig.groups).map(([k, f]) => [k, { frames: f, fps: rig.groupFps[k] || 4 }])),
  };
  fs.writeFileSync(path.join(outDir, `${rig.id}-sheet.json`), JSON.stringify(meta, null, 2) + '\n');

  // GIF previews, cropped to the area any frame uses and scaled up: every frame lined up on the
  // character's middle (its frame's anchor) and feet, whichever frame it's drawn in
  const { frames, palette } = buildFrames(rig, json, extras);
  const place = frames.map((fr, i) => {
    const F = frameOf(rig, rig.poses[i]);
    return { a: Math.round(anchorOf(F)), b: F.h - 1, w: F.w };
  });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; // (from the middle, and the feet)
  let left = Infinity, right = -Infinity, top = Infinity;
  frames.forEach((fr, i) => {
    const { a, b, w } = place[i];
    left = Math.min(left, -a); right = Math.max(right, w - 1 - a); top = Math.min(top, -b);
    for (let y = 0; y < fr.color.h; y++) for (let x = 0; x < fr.color.w; x++) {
      if (fr.color.get(x, y) === NONE) continue;
      x0 = Math.min(x0, x - a); y0 = Math.min(y0, y - b); x1 = Math.max(x1, x - a); y1 = Math.max(y1, y - b);
    }
  });
  x0 = Math.max(left, x0 - 2); y0 = Math.max(top, y0 - 2); x1 = Math.min(right, x1 + 2); y1 = Math.min(0, y1 + 1);
  const W = (x1 - x0 + 1) * SCALE;
  const H = (y1 - y0 + 1) * SCALE;
  const T = palette.length;
  for (const [name, list] of Object.entries(rig.groups)) {
    const imgs = list.map((fi) => {
      const fr = frames[fi].color;
      const { a, b } = place[fi];
      const out = new Uint8Array(W * H).fill(T);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const v = fr.get(a + x0 + Math.floor(x / SCALE), b + y0 + Math.floor(y / SCALE));
          if (v !== NONE) out[y * W + x] = v;
        }
      }
      return out;
    });
    const delay = Math.max(2, Math.round(100 / (rig.groupFps[name] || 4)));
    fs.writeFileSync(path.join(outDir, `${rig.id}-${name}.gif`), gif(W, H, imgs, palette, delay));
  }
  const bigNote = sheet.big ? ` + ${rig.id}-big-sheet.png (${sheet.big.width}x${sheet.big.height})` : '';
  console.log(`${rig.id}: ${sheet.frameCount} frames → ${rig.id}-sheet.png (${sheet.width}x${sheet.height})${bigNote}, ${Object.keys(rig.groups).length} GIFs`);
}

// Roundtable Hold's fire: each brazier's loop and the candle's, scaled up like the heroes'.
{
  const fxDir = path.join(root, 'client', 'assets', 'fx');
  const art = (name) => JSON.parse(fs.readFileSync(path.join(fxDir, name), 'utf8'));
  const b = art('brazier-fire.json');
  const c = art('candle-fire.json');
  const rigs = rigFires(b, c);
  const loops = [
    ...rigs.brazier.map((frames, i) => [`brazier-${i + 1}`, frames, rigs.palettes.brazier, BRAZIER.fps, SCALE * 2]),
    [`candle`, rigs.candle[0], rigs.palettes.candle, CANDLE.fps, SCALE * 4],
  ];
  for (const [name, frames, palette, fps, k] of loops) {
    const { w, h } = frames[0];
    const T = palette.length;
    const imgs = frames.map((fr) => {
      const out = new Uint8Array(w * k * h * k).fill(T);
      for (let y = 0; y < h * k; y++) {
        for (let x = 0; x < w * k; x++) {
          const v = fr.cells[Math.floor(y / k) * w + Math.floor(x / k)];
          if (v >= 0) out[y * w * k + x] = v;
        }
      }
      return out;
    });
    fs.writeFileSync(path.join(fxDir, `${name}.gif`), gif(w * k, h * k, imgs, palette, Math.round(100 / fps)));
  }
  console.log(`fire: ${loops.map(([n, f]) => `${n} (${f.length} frames)`).join(', ')} → client/assets/fx/*.gif`);
}
