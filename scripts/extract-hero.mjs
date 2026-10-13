// Turns upscaled "pixel art" images (e.g. AI-made sprites) into the palette-indexed pixel grids the
// hero rigs use (client/assets/hero/<id>.json). For each image it removes the flat background,
// finds the art's true pixel grid, takes one colour per grid cell and reduces the colours to a
// shared palette (or maps them onto an existing hero's palette, so new poses match the old ones).
//
// Input images are raw 32-bit BGRA dumps (see scripts/decode-image.ps1, which uses the Windows
// image codecs, so WebP/PNG/JPEG all work without any npm packages).
//
//   node scripts/extract-hero.mjs --name "Name" [--colors 40 | --palette hero.json]
//        in.bgra:WxH:out.json [more.bgra:WxH:more.json ...]
//   per input, optional ":pitch=px,py,ox,oy" overrides the detected grid.

import fs from 'node:fs';
import path from 'node:path';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const W8 = [2, 4, 3]; // colour distance weights (r, g, b): the eye is most sensitive to green

function args() {
  const a = process.argv.slice(2);
  const opts = { name: 'Hero', colors: 40, palette: null, inputs: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--name') opts.name = a[++i];
    else if (a[i] === '--colors') opts.colors = Number(a[++i]);
    else if (a[i] === '--palette') opts.palette = JSON.parse(fs.readFileSync(a[++i], 'utf8')).palette;
    else {
      const [file, dims, out, ...rest] = a[i].split(':').reduce((acc, part) => {
        // keep Windows drive letters (C:/...) attached to their path
        if (acc.length && /^[A-Za-z]$/.test(acc[acc.length - 1])) acc[acc.length - 1] += ':' + part;
        else acc.push(part);
        return acc;
      }, []);
      const [w, h] = dims.split('x').map(Number);
      const input = { file, w, h, out };
      for (const r of rest) if (r.startsWith('pitch=')) input.pitch = r.slice(6).split(',').map(Number);
      opts.inputs.push(input);
    }
  }
  return opts;
}

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const dist = (a, b) => W8[0] * (a[0] - b[0]) ** 2 + W8[1] * (a[1] - b[1]) ** 2 + W8[2] * (a[2] - b[2]) ** 2;
const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

function load({ file, w, h }) {
  const buf = fs.readFileSync(file);
  if (buf.length !== w * h * 4) throw new Error(`${file}: expected ${w}x${h} BGRA`);
  const rgb = new Float32Array(w * h * 3);
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    rgb[i * 3] = buf[i * 4 + 2];
    rgb[i * 3 + 1] = buf[i * 4 + 1];
    rgb[i * 3 + 2] = buf[i * 4];
    alpha[i] = buf[i * 4 + 3];
  }
  return { w, h, rgb, alpha };
}

// Background: transparent pixels, plus everything reachable from the border through pixels
// close to the border's dominant colour (the art has a dark outline that stops the flood).
function backgroundMask(img) {
  const { w, h, rgb, alpha } = img;
  const counts = new Map();
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  for (const i of border) {
    if (alpha[i] < 128) continue;
    const key = [0, 1, 2].map((c) => Math.round(rgb[i * 3 + c] / 16)).join(',');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let bg = null;
  if (counts.size) {
    const key = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    bg = key.split(',').map((v) => Number(v) * 16);
  }
  const mask = new Uint8Array(w * h);
  // A black background (a decoder that dropped transparency) sits right next to dark outlines,
  // so it gets a much tighter tolerance than a white one.
  const tol = bg && bg[0] + bg[1] + bg[2] < 90 ? 24 : 70;
  const near = (i) => alpha[i] < 128 || (bg && Math.abs(rgb[i * 3] - bg[0]) + Math.abs(rgb[i * 3 + 1] - bg[1]) + Math.abs(rgb[i * 3 + 2] - bg[2]) < tol);
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
  for (let i = 0; i < w * h; i++) if (alpha[i] < 128) mask[i] = 1;
  return mask;
}

const lumaAt = (img, x, y) => {
  const i = (y * img.w + x) * 3;
  return 0.299 * img.rgb[i] + 0.587 * img.rgb[i + 1] + 0.114 * img.rgb[i + 2];
};

// Pixel pitch along one axis. Colour steps between art pixels recur every P source pixels, so
// the autocorrelation of each line's step positions peaks at P, 2P, 3P…; the peaks are refined
// to sub-pixel precision and fitted together. This works locally, so a grid that drifts a little
// across the image still gives the right pitch. Returns [pitch, peak sharpness 0..1].
function findPitch(img, mask, axis) {
  const { w, h, rgb } = img;
  const [n, m] = axis === 'x' ? [w, h] : [h, w];
  const R = new Float64Array(64);
  const steps = new Uint8Array(n);
  for (let j = 0; j < m; j++) {
    for (let i = 1; i < n; i++) {
      const a = axis === 'x' ? j * w + i : i * w + j;
      const b = axis === 'x' ? a - 1 : a - w;
      let d = 0;
      if (mask[a] !== mask[b]) d = 255;
      else if (!mask[a]) for (let c = 0; c < 3; c++) d += Math.abs(rgb[a * 3 + c] - rgb[b * 3 + c]);
      steps[i] = d > 50 ? 1 : 0;
    }
    for (let i = 0; i < n; i++) if (steps[i]) for (let lag = 2; lag < 64 && i + lag < n; lag++) R[lag] += steps[i + lag];
  }
  const peakNear = (centre, reach) => {
    let best = -1;
    for (let k = Math.max(2, Math.round(centre - reach)); k <= Math.min(62, Math.round(centre + reach)); k++) if (best < 0 || R[k] > R[best]) best = k;
    const [a, b, c] = [R[best - 1], R[best], R[best + 1]];
    const den = a - 2 * b + c;
    return { at: best + (den ? (a - c) / (2 * den) : 0), value: b };
  };
  const top = Math.max(...R.slice(4, 62));
  let base = 0;
  for (let k = 4; k < 62 && !base; k++) if (R[k] >= 0.75 * top && R[k] >= R[k - 1] && R[k] >= R[k + 1]) base = k;
  let num = 0;
  let den = 0;
  for (let k = 1; k * base < 60; k++) {
    const p = peakNear(peakNear(k * base, base / 3).at, 1);
    num += k * p.at;
    den += k * k;
  }
  const P = num / den;
  // sharpness: how deep the dip between the first two peaks is
  let valley = top;
  for (let k = Math.round(1.3 * P); k <= Math.round(1.7 * P) && k < 64; k++) valley = Math.min(valley, R[k]);
  return [P, 1 - valley / top];
}

// Grid offset along one axis: the one whose cells are most uniform in their middle half.
function findOffset(img, mask, axis, P) {
  const { w, h } = img;
  const [n, m] = axis === 'x' ? [w, h] : [h, w];
  let best = { s: Infinity, off: 0 };
  for (let off = 0; off < P; off += 0.1) {
    let s = 0;
    let count = 0;
    for (let j = 0; j < m; j += 2) {
      for (let c = off; c + P < n; c += P) {
        const mid = Math.floor(c + P / 2);
        const at = (i) => (axis === 'x' ? [i, j] : [j, i]);
        const [mx, my] = at(mid);
        if (mask[my * w + mx]) continue;
        const ref = lumaAt(img, mx, my);
        for (let i = Math.ceil(c + P * 0.2); i < c + P * 0.8; i++) {
          const [x, y] = at(i);
          s += Math.abs(lumaAt(img, x, y) - ref);
          count++;
        }
      }
    }
    if (s / count < best.s) best = { s: s / count, off };
  }
  return best.off;
}

function median(values) {
  values.sort((a, b) => a - b);
  return values[values.length >> 1];
}

function sampleCells(img, mask, [px, py, ox, oy]) {
  const { w, h, rgb } = img;
  const cols = Math.floor((w - ox) / px);
  const rows = Math.floor((h - oy) / py);
  const cells = [];
  let spread = 0;
  let counted = 0;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const x0 = Math.round(ox + gx * px + px * 0.25);
      const x1 = Math.round(ox + gx * px + px * 0.75);
      const y0 = Math.round(oy + gy * py + py * 0.25);
      const y1 = Math.round(oy + gy * py + py * 0.75);
      const ch = [[], [], []];
      let bg = 0;
      let all = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const i = y * w + x;
          all++;
          if (mask[i]) { bg++; continue; }
          for (let c = 0; c < 3; c++) ch[c].push(rgb[i * 3 + c]);
        }
      }
      if (!all || bg * 2 >= all) { cells.push(null); continue; }
      const col = ch.map(median);
      cells.push(col);
      // how uniform is the cell? (low = the grid is aligned with the art)
      let s = 0;
      for (let k = 0; k < ch[0].length; k++) s += Math.abs(ch[0][k] - col[0]) + Math.abs(ch[1][k] - col[1]) + Math.abs(ch[2][k] - col[2]);
      spread += s / ch[0].length;
      counted++;
    }
  }
  return { cols, rows, cells, spread: spread / Math.max(1, counted) };
}

function kmeans(points, k, seed = 11) {
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const centres = [points[Math.floor(rand() * points.length)]];
  const d2 = new Float64Array(points.length).fill(Infinity);
  while (centres.length < k) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      d2[i] = Math.min(d2[i], dist(points[i], centres[centres.length - 1]));
      sum += d2[i];
    }
    let r = rand() * sum;
    let pick = 0;
    for (; pick < points.length - 1 && r > d2[pick]; pick++) r -= d2[pick];
    centres.push(points[pick]);
  }
  const assign = new Int32Array(points.length);
  for (let it = 0; it < 24; it++) {
    for (let i = 0; i < points.length; i++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist(points[i], centres[c]);
        if (d < bd) { bd = d; best = c; }
      }
      assign[i] = best;
    }
    const acc = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < points.length; i++) {
      const a = acc[assign[i]];
      a[0] += points[i][0]; a[1] += points[i][1]; a[2] += points[i][2]; a[3]++;
    }
    for (let c = 0; c < k; c++) if (acc[c][3]) centres[c] = [acc[c][0] / acc[c][3], acc[c][1] / acc[c][3], acc[c][2] / acc[c][3]];
  }
  return centres.map((c) => c.map(Math.round)).sort((a, b) => lum(a) - lum(b));
}

const opts = args();
const sampled = opts.inputs.map((input) => {
  const img = load(input);
  const mask = backgroundMask(img);
  let grid = input.pitch;
  let fit = '';
  if (!grid || grid.length < 4) {
    // a given pitch (two numbers) keeps its value and only the offsets are searched
    const [px, sx] = grid ? [grid[0], NaN] : findPitch(img, mask, 'x');
    const [py, sy] = grid ? [grid[1], NaN] : findPitch(img, mask, 'y');
    grid = [px, py, findOffset(img, mask, 'x', px), findOffset(img, mask, 'y', py)];
    if (!Number.isNaN(sx)) fit = ` (grid sharpness ${sx.toFixed(2)} / ${sy.toFixed(2)}; below ~0.5 the art is soft, check it by eye)`;
  }
  const s = sampleCells(img, mask, grid);
  console.log(`${path.basename(input.file)}: grid ${grid.map((v) => v.toFixed(3)).join(', ')}${fit} → ${s.cols}x${s.rows} cells, cell spread ${s.spread.toFixed(1)}`);
  return { input, grid, ...s };
});

let palette;
if (opts.palette) {
  palette = opts.palette.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
} else {
  const points = sampled.flatMap((s) => s.cells.filter(Boolean));
  palette = kmeans(points, Math.min(opts.colors, ALPHABET.length));
}
const nearest = (c) => {
  let best = 0;
  let bd = Infinity;
  palette.forEach((p, i) => { const d = dist(c, p); if (d < bd) { bd = d; best = i; } });
  return best;
};

for (const s of sampled) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  s.cells.forEach((c, i) => {
    if (!c) return;
    const x = i % s.cols;
    const y = (i - x) / s.cols;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  });
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(s.cols - 1, x1 + 1); y1 = Math.min(s.rows - 1, y1 + 1);
  const rows = [];
  let opaque = 0;
  for (let y = y0; y <= y1; y++) {
    let row = '';
    for (let x = x0; x <= x1; x++) {
      const c = s.cells[y * s.cols + x];
      if (c) opaque++;
      row += c ? ALPHABET[nearest(c)] : '.';
    }
    rows.push(row);
  }
  const g = s.grid.map((v) => +v.toFixed(3));
  const json = {
    name: opts.name,
    source: `${path.basename(s.input.file).replace(/\.bgra$/, '.webp')}, resampled on its ${g[0]} x ${g[1]} px art grid (offset ${g[2]}, ${g[3]}; cells ${x0}..${x1} x ${y0}..${y1}) and reduced to ${palette.length} colours`,
    w: x1 - x0 + 1,
    h: y1 - y0 + 1,
    alphabet: ALPHABET,
    palette: opts.palette || palette.map(hex),
    rows,
  };
  const text = JSON.stringify(json, null, 2).replace(/"palette": \[\s+([^\]]+?)\s+\]/s, (m, body) => `"palette": [${body.split(/,\s+/).join(', ')}]`);
  fs.writeFileSync(s.input.out, text + '\n');
  console.log(`  → ${s.input.out}: ${json.w}x${json.h}, ${opaque} pixels`);
}
