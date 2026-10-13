// Splits a sprite sheet (a raw 32-bit BGRA dump, see scripts/decode-image.ps1) into one BGRA file
// per frame. Frames are the runs of columns holding any opaque pixel, separated by empty columns;
// or, with --blobs, the separate figures on the sheet (for frames that overlap side by side): each
// connected figure is a frame, and loose bits (sparks, wisps) join the figure nearest to them.
// Each frame is cropped to the sheet's full ink height (so frames keep a shared baseline) plus a
// transparent margin, and its size and place on the sheet are printed.
//
//   node scripts/split-sheet.mjs sheet.bgra WxH out/prefix [--blobs]
//   → out/prefix-1.bgra, out/prefix-2.bgra, … ; prints "out/prefix-1.bgra:WxH  (x0,y0 on the sheet)"

import fs from 'node:fs';
import path from 'node:path';

const [file, dims, prefix, mode] = process.argv.slice(2);
const [W, H] = dims.split('x').map(Number);
const buf = fs.readFileSync(file);
if (buf.length !== W * H * 4) throw new Error(`${file}: expected ${W}x${H} BGRA`);
const ink = (x, y) => buf[(y * W + x) * 4 + 3] >= 128;

// owner[i]: which frame the pixel at i belongs to (-1: none)
const owner = new Int32Array(W * H).fill(-1);
let frames = []; // { x0, x1 }

if (mode === '--blobs') {
  const lab = new Int32Array(W * H).fill(-1);
  const blobs = [];
  for (let i = 0; i < W * H; i++) {
    if (lab[i] >= 0 || !ink(i % W, (i - (i % W)) / W)) continue;
    const id = blobs.length;
    const stack = [i];
    lab[i] = id;
    const b = { id, n: 0, x0: W, x1: 0, y0: H, y1: 0 };
    while (stack.length) {
      const k = stack.pop();
      const x = k % W;
      const y = (k - x) / W;
      b.n += 1;
      b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (lab[j] < 0 && ink(nx, ny)) { lab[j] = id; stack.push(j); }
      }
    }
    blobs.push(b);
  }
  const biggest = Math.max(...blobs.map((b) => b.n));
  const figures = blobs.filter((b) => b.n >= biggest * 0.05).sort((a, b) => a.x0 - b.x0);
  const gap = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1));
  const frameOf = new Map();
  for (const b of blobs) {
    const f = figures.includes(b) ? b : figures.reduce((best, c) => (gap(b, c) < gap(b, best) ? c : best), figures[0]);
    frameOf.set(b.id, figures.indexOf(f));
  }
  for (let i = 0; i < W * H; i++) if (lab[i] >= 0) owner[i] = frameOf.get(lab[i]);
  frames = figures.map(() => ({ x0: W, x1: 0 }));
  for (let i = 0; i < W * H; i++) {
    if (owner[i] < 0) continue;
    const x = i % W;
    const f = frames[owner[i]];
    f.x0 = Math.min(f.x0, x);
    f.x1 = Math.max(f.x1, x);
  }
} else {
  let start = -1;
  for (let x = 0; x <= W; x++) {
    let on = false;
    if (x < W) for (let y = 0; y < H && !on; y++) on = ink(x, y);
    if (on && start < 0) start = x;
    if (!on && start >= 0) { frames.push({ x0: start, x1: x - 1 }); start = -1; }
  }
  frames.forEach((f, k) => {
    for (let y = 0; y < H; y++) for (let x = f.x0; x <= f.x1; x++) if (ink(x, y)) owner[y * W + x] = k;
  });
}

let top = H;
let bottom = 0;
for (let i = 0; i < W * H; i++) {
  if (owner[i] < 0) continue;
  const y = (i - (i % W)) / W;
  top = Math.min(top, y);
  bottom = Math.max(bottom, y);
}

const M = 12; // transparent margin around each frame
fs.mkdirSync(path.dirname(prefix), { recursive: true });
frames.forEach((f, k) => {
  const w = f.x1 - f.x0 + 1 + 2 * M;
  const h = bottom - top + 1 + 2 * M;
  const out = Buffer.alloc(w * h * 4);
  for (let y = top; y <= bottom; y++) {
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * W + x;
      if (owner[i] !== k) continue;
      buf.copy(out, ((y - top + M) * w + (x - f.x0 + M)) * 4, i * 4, i * 4 + 4);
    }
  }
  const name = `${prefix}-${k + 1}.bgra`;
  fs.writeFileSync(name, out);
  console.log(`${name}:${w}x${h}  (${f.x0 - M},${top - M} on the sheet)`);
});
