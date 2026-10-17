// Splits a sprite sheet (a raw 32-bit BGRA dump, see scripts/decode-image.ps1) into one BGRA file
// per frame. Frames are the runs of columns holding any opaque pixel, separated by empty columns;
// or, with --blobs, the separate figures on the sheet (for frames that overlap side by side): each
// connected figure is a frame, and loose bits (sparks, wisps) join the figure nearest to them.
// Each frame is cropped to the sheet's full ink height (so frames keep a shared baseline) plus a
// transparent margin, and its size and place on the sheet are printed.
// With --grid CxR the sheet is C cells across and R down, read left to right, then top to bottom
// (a 2 x 2 grid with its last cell empty holds three frames). Each connected figure, and each loose
// bit, belongs to the cell that holds most of it, so a cape or a spear point that strays over a
// cell's edge stays with its own frame. Every frame comes out the size of a cell plus the same
// margin all round (as much as the farthest stray needs), at the same place relative to its cell,
// so the frames keep their places from cell to cell; empty cells are skipped.
//
//   node scripts/split-sheet.mjs sheet.bgra WxH out/prefix [--blobs | --grid CxR]
//   → out/prefix-1.bgra, out/prefix-2.bgra, … ; prints "out/prefix-1.bgra:WxH  (x0,y0 on the sheet)"

import fs from 'node:fs';
import path from 'node:path';

const [file, dims, prefix, mode, layout] = process.argv.slice(2);
const [W, H] = dims.split('x').map(Number);
const buf = fs.readFileSync(file);
if (buf.length !== W * H * 4) throw new Error(`${file}: expected ${W}x${H} BGRA`);
const ink = (x, y) => buf[(y * W + x) * 4 + 3] >= 128;

// owner[i]: which frame the pixel at i belongs to (-1: none)
const owner = new Int32Array(W * H).fill(-1);

// The connected figures on the sheet (8-connected opaque pixels): lab[i] is the figure the pixel
// at i is part of (-1: none).
function label() {
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
  return { lab, blobs };
}

// Frame k: the pixels it owns in the w x h box at (sx, sy) on the sheet (transparent elsewhere).
function write(k, sx, sy, w, h, note) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const X = sx + x;
      const Y = sy + y;
      if (X < 0 || Y < 0 || X >= W || Y >= H || owner[Y * W + X] !== k) continue;
      buf.copy(out, (y * w + x) * 4, (Y * W + X) * 4, (Y * W + X) * 4 + 4);
    }
  }
  const name = `${prefix}-${k + 1}.bgra`;
  fs.writeFileSync(name, out);
  console.log(`${name}:${w}x${h}  (${sx},${sy} on the sheet${note})`);
}

// Frames side by side: runs of inked columns, or (blobs) the figures.
function splitRow(blobs) {
  let frames = []; // { x0, x1 }
  if (blobs) {
    const { lab, blobs: all } = label();
    const biggest = Math.max(...all.map((b) => b.n));
    const figures = all.filter((b) => b.n >= biggest * 0.05).sort((a, b) => a.x0 - b.x0);
    const gap = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1));
    const frameOf = new Map();
    for (const b of all) {
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
  frames.forEach((f, k) => write(k, f.x0 - M, top - M, f.x1 - f.x0 + 1 + 2 * M, bottom - top + 1 + 2 * M, ''));
}

// Frames in a grid of C x R cells.
function splitGrid(C, R) {
  const cw = Math.floor(W / C);
  const ch = Math.floor(H / R);
  const cellAt = (x, y) => Math.min(R - 1, Math.floor(y / ch)) * C + Math.min(C - 1, Math.floor(x / cw));
  const { lab, blobs } = label();
  // each figure to the cell holding most of it
  const votes = blobs.map(() => new Map());
  for (let i = 0; i < W * H; i++) {
    if (lab[i] < 0) continue;
    const c = cellAt(i % W, (i - (i % W)) / W);
    votes[lab[i]].set(c, (votes[lab[i]].get(c) || 0) + 1);
  }
  const cellOf = votes.map((v) => [...v.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  const used = [...new Set(cellOf)].sort((a, b) => a - b);
  for (let i = 0; i < W * H; i++) if (lab[i] >= 0) owner[i] = used.indexOf(cellOf[lab[i]]);
  // the margin every frame gets: as far as any figure strays out of its cell
  let M = 0;
  blobs.forEach((b, id) => {
    const x0 = (cellOf[id] % C) * cw;
    const y0 = Math.floor(cellOf[id] / C) * ch;
    M = Math.max(M, x0 - b.x0, b.x1 - (x0 + cw - 1), y0 - b.y0, b.y1 - (y0 + ch - 1));
  });
  M = Math.ceil(M / 8) * 8;
  used.forEach((c, k) => write(k, (c % C) * cw - M, Math.floor(c / C) * ch - M, cw + 2 * M, ch + 2 * M, `; cell ${c + 1}`));
}

fs.mkdirSync(path.dirname(prefix), { recursive: true });
if (mode === '--grid') splitGrid(...layout.split('x').map(Number));
else splitRow(mode === '--blobs');
