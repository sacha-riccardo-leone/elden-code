// Image helpers shared by the art scripts (recolor-sprite.mjs, clear-background.mjs): decoding any
// image the Windows codecs read, writing a PNG, and finding where a sprite's background is.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Any image the Windows codecs read, as straight-alpha BGRA.
export function decode(file) {
  const tmp = path.join(os.tmpdir(), `recolor-${process.pid}-${path.basename(file)}.bgra`);
  const dims = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts', 'decode-image.ps1'), path.resolve(file), tmp], { encoding: 'utf8' }).trim();
  const [w, h] = dims.split('x').map(Number);
  const buf = fs.readFileSync(tmp);
  fs.rmSync(tmp);
  if (buf.length !== w * h * 4) throw new Error(`${file}: decoded ${buf.length} bytes for ${dims}`);
  return { w, h, buf };
}

export const rgbAt = (img, i) => [img.buf[i * 4 + 2], img.buf[i * 4 + 1], img.buf[i * 4]];
// the value at a given share of a sorted list
export const quantile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))];

// What isn't the sprite: transparent pixels, or else a background flooded in from the border by
// colour. The border's main colours are the background: one for a flat white or black fallback, two
// for a painted grey-and-white checkerboard (only neutral greys join the first, so a sprite that
// touches the edge doesn't). A dark one gets a tight tolerance (`dark`, as in extract-hero.mjs: it
// sits right next to the outlines; tighter still for an outline drawn nearly black on black), a
// light one a looser one (`light`): summed differences of red, green and blue.
export function backgroundMask(img, { dark = 24, light = 70 } = {}) {
  const { w, h, buf } = img;
  let clear = 0;
  for (let i = 0; i < w * h; i++) if (buf[i * 4 + 3] < 128) clear++;
  if (clear > w * h * 0.05) return Uint8Array.from({ length: w * h }, (_, i) => (buf[i * 4 + 3] < 128 ? 1 : 0));
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const counts = new Map();
  for (const i of border) {
    const c = rgbAt(img, i);
    const key = c.map((v) => Math.round(v / 16)).join(',');
    const bin = counts.get(key) || { n: 0, sum: [0, 0, 0] };
    bin.n++;
    c.forEach((v, j) => { bin.sum[j] += v; });
    counts.set(key, bin);
  }
  const ranked = [...counts.values()].sort((a, b) => b.n - a.n).map((bin) => [bin.sum.map((v) => v / bin.n), bin.n]);
  const bgs = [ranked[0][0]];
  let covered = ranked[0][1];
  for (const [c, n] of ranked.slice(1)) {
    if (covered >= border.length * 0.85 || bgs.length === 4) break;
    if (Math.max(...c) - Math.min(...c) > 24) continue;
    bgs.push(c);
    covered += n;
  }
  const near = (i) => {
    const c = rgbAt(img, i);
    return bgs.some((bg) => Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]) < (bg[0] + bg[1] + bg[2] < 90 ? dark : light));
  };
  const mask = new Uint8Array(w * h);
  const stack = border.filter(near);
  for (const i of stack) mask[i] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (!mask[n] && near(n)) { mask[n] = 1; stack.push(n); }
    }
  }
  // pockets of a painted checkerboard the flood can't reach (between an arm and a staff): an
  // enclosed patch mostly in the background's exact colours, laid out as the checkerboard is (a
  // square further along is the other colour), and then any strip of those colours right beside
  // it. A white jewel shaded with grey isn't laid out like that, nor are a stone mask's curls.
  if (bgs.length >= 2) {
    const flatOn = (i) => {
      const c = rgbAt(img, i);
      return bgs.findIndex((bg) => Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]) < 30);
    };
    // the square's size, from the whole runs of one colour between the other along the border
    const square = (lines) => {
      const runs = [];
      for (const line of lines) {
        let prev = -1;
        let cur = -1;
        let len = 0;
        for (const i of line) {
          const c = flatOn(i);
          if (c === cur) { len++; continue; }
          if (cur >= 0 && prev >= 0 && c >= 0 && prev !== cur && c !== cur) runs.push(len);
          prev = cur;
          cur = c;
          len = 1;
        }
      }
      runs.sort((a, b) => a - b);
      return runs.length >= 4 ? Math.round(quantile(runs, 0.5)) : 0;
    };
    const across = square([Array.from({ length: w }, (_, x) => x), Array.from({ length: w }, (_, x) => (h - 1) * w + x)]);
    const down = square([Array.from({ length: h }, (_, y) => y * w), Array.from({ length: h }, (_, y) => y * w + w - 1)]);
    const patchOf = new Int32Array(w * h).fill(-1);
    const patches = [];
    for (let s = 0; s < w * h && across && down; s++) {
      if (mask[s] || patchOf[s] >= 0 || !near(s)) continue;
      const id = patches.length;
      const patch = [s];
      patchOf[s] = id;
      for (let m = 0; m < patch.length; m++) {
        const x = patch[m] % w;
        const y = (patch[m] - x) / w;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (!mask[n] && patchOf[n] < 0 && near(n)) { patchOf[n] = id; patch.push(n); }
        }
      }
      let flat = 0;
      let pairs = 0;
      let swapped = 0;
      for (const i of patch) {
        const a = flatOn(i);
        if (a < 0) continue;
        flat++;
        const x = i % w;
        for (const j of [x + across < w ? i + across : -1, i + down * w < w * h ? i + down * w : -1]) {
          if (j < 0 || patchOf[j] !== id) continue;
          const b = flatOn(j);
          if (b < 0) continue;
          pairs++;
          if (b !== a) swapped++;
        }
      }
      patches.push({ patch, flat: flat / patch.length, pairs, swapped: swapped / Math.max(1, pairs) });
    }
    const pocket = new Uint8Array(w * h);
    for (const p of patches) {
      if (p.pairs >= 20 && p.flat >= 0.6 && p.swapped >= 0.6) for (const i of p.patch) { mask[i] = 1; pocket[i] = 1; }
      if (process.env.RECOLOR_DEBUG && p.patch.length >= 40 && p.pairs) console.log(`pocket at ${p.patch[0] % w},${Math.floor(p.patch[0] / w)}: ${p.patch.length} px, ${p.flat.toFixed(2)} flat, ${p.pairs} pairs a square apart, ${p.swapped.toFixed(2)} swapped${pocket[p.patch[0]] ? ' - background' : ''}`);
    }
    const besidePocket = (i) => {
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -across; dy <= across; dy++) {
        for (let dx = -across; dx <= across; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && pocket[ny * w + nx]) return true;
        }
      }
      return false;
    };
    for (const p of patches) {
      if (pocket[p.patch[0]] || p.flat < 0.5 || p.patch.length < 15 || !p.patch.some(besidePocket)) continue;
      for (const i of p.patch) mask[i] = 1;
      if (process.env.RECOLOR_DEBUG) console.log(`strip at ${p.patch[0] % w},${Math.floor(p.patch[0] / w)}: ${p.patch.length} px beside a pocket - background`);
    }
  }
  return mask;
}

// A PNG of straight-alpha RGBA pixels.
export function png(w, h, rgba) {
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = table[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
