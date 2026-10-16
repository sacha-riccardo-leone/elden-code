// The title screen, the way into the Lands Between: a pixel-art take on Elden Ring's own. The
// Elden Code wordmark in cracked gold over a faint sigil, embers drifting up out of the dark, and
// one way in: "Start your Tarnished journey (With Claude)". It's all drawn on one small canvas and
// scaled up whole, so the wordmark, the sigil and the words share one grid of big square pixels.
//
// The world loads behind it meanwhile (main.js). Set out before it's ready and a sign turns at the
// bottom right until it is (gate.js); then the title crumbles away, pixel by pixel from the middle
// out, into the world, and only then do the game's own buttons show (body.on-title, game.css).

import { started, ready, setOut } from './gate.js';

const root = document.getElementById('title');
const canvas = document.getElementById('title-canvas');
const button = document.getElementById('title-start');
const ctx = canvas.getContext('2d');
const still = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const LABEL = ['Start your Tarnished journey', '(With Claude)'];
// When each part shows (its fade in, seconds from the first frame; the words wait for their
// fonts), and how long the title takes to crumble away once thou'st set out and the world's ready.
const INTRO = { glow: [0, 1.2], sigil: [0.2, 1.8], logo: [0.9, 2.2], sub: [1.8, 2.6], label: [2.4, 3.1] };
const LEAVE = 1.3;

const PAL = {
  black: [6, 5, 5],
  warm: [[15, 11, 8], [23, 16, 10], [33, 22, 13]], // the dark warming toward the sigil's heart
  line: [126, 97, 53],
  halo: [48, 35, 18],
  halo2: [26, 19, 11],
  gold: [[255, 245, 212], [247, 222, 156], [230, 192, 114], [203, 154, 82], [164, 116, 56], [114, 78, 35]],
  crack: [70, 45, 19],
  outline: [20, 12, 5],
  shade: [9, 6, 3],
  sub: [[176, 146, 96], [128, 102, 64]],
  words: [[246, 228, 180], [224, 192, 122], [172, 132, 68]],
  lit: [[255, 253, 236], [255, 238, 176], [240, 198, 112]],
  glow: [[28, 20, 11], [48, 34, 17], [80, 57, 27], [130, 96, 46]],
  embers: [[255, 238, 182], [255, 210, 118], [240, 164, 74], [196, 114, 50]],
  spark: [255, 240, 196],
};

// ordered dithering: the 4x4 Bayer matrix, so fades and gradients come in pixel patterns
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dither = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ramp = (t, [a, b]) => clamp((t - a) / (b - a), 0, 1);
const css = (c, a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------
// pixels

const blank = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// A full-canvas layer painted pixel by pixel: fn(put) with put(x, y, rgb).
function paint(w, h, fn) {
  const c = blank(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const d = img.data;
  fn((x, y, rgb, a = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    d[i] = rgb[0];
    d[i + 1] = rgb[1];
    d[i + 2] = rgb[2];
    d[i + 3] = a;
  });
  g.putImageData(img, 0, 0);
  return c;
}

// The fade patterns: level k (0..16) keeps the pixels whose Bayer value is under k.
const patterns = [];
for (let k = 0; k <= 16; k++) {
  const c = blank(4, 4);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  for (let i = 0; i < 16; i++) if (BAYER[i] < k) g.fillRect(i & 3, i >> 2, 1, 1);
  patterns[k] = ctx.createPattern(c, 'repeat');
}

// Words in pixels: drawn in a font, then cut to whole pixels (an edge pixel is in or out).
const scratch = blank(1, 1);
const sg = scratch.getContext('2d', { willReadFrequently: true });
function textMask(text, font, cut = 0.5) {
  sg.font = font;
  const m = sg.measureText(text);
  const left = Math.ceil(m.actualBoundingBoxLeft) + 1;
  const asc = Math.ceil(m.actualBoundingBoxAscent) + 1;
  const w = Math.max(1, left + Math.ceil(m.actualBoundingBoxRight) + 1);
  const h = Math.max(1, asc + Math.ceil(m.actualBoundingBoxDescent) + 1);
  scratch.width = w;
  scratch.height = h;
  sg.font = font;
  sg.fillStyle = '#fff';
  sg.textBaseline = 'alphabetic';
  sg.fillText(text, left, asc);
  const a = sg.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = a[i * 4 + 3] >= cut * 255 ? 1 : 0;
  return crop({ w, h, mask, base: asc });
}

// (trimmed to the pixels that are set)
function crop(m) {
  let x0 = m.w;
  let y0 = m.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!m.mask[y * m.w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { w: 1, h: 1, mask: new Uint8Array(1), base: 1 };
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[y * w + x] = m.mask[(y + y0) * m.w + x + x0];
  return { w, h, mask, base: m.base - y0 };
}

// A line of glyphs side by side, `gap` pixels apart, on one baseline (or, `middle`, centred on one
// middle line); null is a space. Each column remembers the top and bottom of its own glyph (for
// shading glyph by glyph).
function row(pieces, gap, space, middle = false) {
  const set = pieces.filter(Boolean);
  const ascent = Math.max(...set.map((p) => p.base));
  const h = middle ? Math.max(...set.map((p) => p.h)) : ascent + Math.max(...set.map((p) => p.h - p.base));
  let w = 0;
  pieces.forEach((p, i) => { w += p ? p.w + (i < pieces.length - 1 && pieces[i + 1] ? gap : 0) : space; });
  const mask = new Uint8Array(w * h);
  const top = new Int16Array(w).fill(0);
  const bottom = new Int16Array(w).fill(h - 1);
  let x = 0;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (!p) { x += space; continue; }
    const y = middle ? Math.round((h - p.h) / 2) : ascent - p.base;
    for (let yy = 0; yy < p.h; yy++) for (let xx = 0; xx < p.w; xx++) if (p.mask[yy * p.w + xx]) mask[(y + yy) * w + x + xx] = 1;
    for (let xx = 0; xx < p.w; xx++) { top[x + xx] = y; bottom[x + xx] = y + p.h - 1; }
    x += p.w + (pieces[i + 1] ? gap : 0);
  }
  return { w, h, mask, top, bottom };
}

// "ELDEN CODE", the first letter of each word standing taller, as on the Elden Ring's own.
const MARK = [['E', 1.32], ['L'], ['D'], ['E'], ['N'], null, ['C', 1.32], ['O'], ['D'], ['E']];
function wordmark(size) {
  const pieces = MARK.map((g) => g && textMask(g[0], `700 ${Math.round(size * (g[1] || 1))}px Cinzel`));
  return row(pieces, Math.max(1, Math.round(size / 15)), Math.round(size * 0.42), true);
}

// Small words in pixels, a pixel between each letter (or they run together), on one baseline.
function spaced(text, weight, size, cut = 0.42) {
  const pieces = [...text].map((ch) => (ch === ' ' ? null : textMask(ch, `${weight} ${size}px Cinzel`, cut)));
  return row(pieces, 1, Math.max(3, Math.round(size * 0.42)));
}

// ---------------------------------------------------------------------------------------------
// what's drawn

// The dark, warming in dithered steps toward the sigil's heart.
function paintBackground(w, h, L) {
  return paint(w, h, (put) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - L.cx) / (L.R * 2.4);
        const dy = (y - L.cy) / (L.R * 1.7);
        const v = 1 - Math.sqrt(dx * dx + dy * dy);
        const k = Math.floor(v * 3.4 + dither(x, y));
        put(x, y, k <= 0 ? PAL.black : PAL.warm[Math.min(2, k - 1)]);
      }
    }
  });
}

// The sigil: a line straight down through three rings and a wide bowl beneath them, drawn a pixel
// wide, with a dim halo about it. `paths` are the lines the sparks run along.
function sigil(L) {
  const { cx, cy, R } = L;
  const r = (k) => Math.round(R * k);
  const rings = [
    { x: cx, y: cy - r(0.1), r: r(0.6) },
    { x: cx, y: cy - r(0.64), r: r(0.33) },
    { x: cx, y: cy + r(0.38), r: r(0.4) },
  ];
  const bowl = { x: cx, y: cy - r(2.0), r: r(2.74), below: cy + r(0.3) };
  const stem = { x: cx, y0: cy - r(1.06), y1: cy + r(1.08) };
  return { rings, bowl, stem, paths: [...rings.map((c) => ({ ...c, kind: 'ring' })), { ...bowl, kind: 'bowl' }, { ...stem, kind: 'stem' }] };
}

function circlePoints(cx, cy, r, each) {
  let x = r;
  let y = 0;
  let err = 1 - r;
  while (x >= y) {
    each(cx + x, cy + y); each(cx + y, cy + x); each(cx - y, cy + x); each(cx - x, cy + y);
    each(cx - x, cy - y); each(cx - y, cy - x); each(cx + y, cy - x); each(cx + x, cy - y);
    y += 1;
    if (err < 0) err += 2 * y + 1;
    else { x -= 1; err += 2 * (y - x) + 1; }
  }
}

// (`holes`: where words stand, which the lines pass behind rather than through)
const inHole = (holes, x, y) => holes.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
function paintSigil(w, h, S, holes = []) {
  const lit = new Uint8Array(w * h);
  const set = (x, y) => { if (x >= 0 && y >= 0 && x < w && y < h && !inHole(holes, x, y)) lit[y * w + x] = 1; };
  for (const c of S.rings) circlePoints(c.x, c.y, c.r, set);
  circlePoints(S.bowl.x, S.bowl.y, S.bowl.r, (x, y) => { if (y >= S.bowl.below) set(x, y); });
  for (let y = S.stem.y0; y <= S.stem.y1; y++) set(S.stem.x, y);
  // how far each pixel is from a line (0 on it, 1 or 2 beside it, 3 further)
  const far = new Uint8Array(w * h).fill(3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!lit[y * w + x]) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const i = yy * w + xx;
          far[i] = Math.min(far[i], Math.max(Math.abs(dx), Math.abs(dy)));
        }
      }
    }
  }
  const lines = paint(w, h, (put) => { for (let i = 0; i < far.length; i++) if (!far[i]) put(i % w, Math.floor(i / w), PAL.line); });
  const halo = paint(w, h, (put) => {
    for (let i = 0; i < far.length; i++) {
      const x = i % w;
      const y = Math.floor(i / w);
      if (far[i] === 1) put(x, y, PAL.halo);
      else if (far[i] === 2 && (x + y) & 1) put(x, y, PAL.halo2);
    }
  });
  return { lines, halo };
}

// A pixel word: dark outline and a drop shadow, filled with `ramp` from the top of each glyph to
// its bottom (lit along its upper edges); `cracks` scores it with dark seams.
function paintWord(put, m, ox, oy, colors, { cracks = 0, seed = 1, shadow = 2 } = {}) {
  const at = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.mask[y * m.w + x];
  for (let y = -2; y < m.h + 3; y++) {
    for (let x = -2; x < m.w + 3; x++) {
      if (at(x, y)) continue;
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy)) { edge = true; break; }
      if (edge) put(ox + x, oy + y, PAL.outline);
      else if (shadow && (at(x - shadow, y - shadow) || at(x - 1, y - shadow) || at(x - shadow, y - 1))) put(ox + x, oy + y, PAL.shade);
    }
  }
  const n = colors.length;
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!at(x, y)) continue;
      const t0 = m.top ? m.top[x] : 0;
      const t1 = m.bottom ? m.bottom[x] : m.h - 1;
      const f = (y - t0) / Math.max(1, t1 - t0);
      let k = clamp(Math.floor(f * (n - 1.6) + dither(x, y)), 0, n - 2);
      if (!at(x, y - 1)) k = Math.max(0, k - 2);
      else if (!at(x, y + 1)) k = n - 1;
      put(ox + x, oy + y, colors[k]);
    }
  }
  if (!cracks) return;
  const rnd = seeded(seed);
  const inner = (x, y) => at(x, y) && at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1);
  for (let i = 0; i < cracks; i++) {
    let x = Math.floor(rnd() * m.w);
    let y = Math.floor(rnd() * m.h);
    const len = 2 + Math.floor(rnd() * 5);
    for (let s = 0; s < len && inner(x, y); s++) {
      put(ox + x, oy + y, PAL.crack);
      const r = rnd();
      if (r < 0.55) y += 1;
      else if (r < 0.78) x += 1;
      else x -= 1;
    }
  }
}

// The way in: two lines of words, centred on `cx`, the first's middle at `y`.
function paintLabel(w, h, lines, cx, y, colors) {
  const [a, b] = lines;
  const ax = cx - Math.floor(a.w / 2);
  const ay = y - Math.floor(a.h / 2);
  const bx = cx - Math.floor(b.w / 2);
  const by = ay + a.h + Math.max(3, Math.round(a.h * 0.45));
  const layer = paint(w, h, (put) => {
    paintWord(put, a, ax, ay, colors, { shadow: 1 });
    paintWord(put, b, bx, by, colors, { shadow: 1 });
  });
  return { layer, rect: { x: Math.min(ax, bx) - 4, y: ay - 3, w: Math.max(a.w, b.w) + 8, h: by + b.h - ay + 6 }, a: { x: ax, y: ay, w: a.w, h: a.h } };
}

// The light behind it, as behind "Press any button": a soft dithered haze about the words, and a
// streak a pixel high running out from either end of them, fraying as it goes.
function paintGlow(w, h, line, bright) {
  const cx = line.x + Math.floor(line.w / 2);
  const y = line.y + Math.floor(line.h / 2);
  const half = Math.round(line.w * 0.62);
  return paint(w, h, (put) => {
    const ry = 6;
    for (let yy = y - ry; yy <= y + ry; yy++) {
      for (let x = cx - half; x <= cx + half; x++) {
        const fx = (x - cx) / half;
        const fy = (yy - y) / ry;
        const v = (1 - fx * fx) * (1 - fy * fy);
        if (v <= 0) continue;
        const k = Math.floor(v * (bright ? 2.6 : 1.9) + dither(x, yy) - 0.5);
        if (k >= 0) put(x, yy, PAL.glow[Math.min(PAL.glow.length - 2, k)]);
      }
    }
    const reach = Math.round(line.w * (bright ? 0.32 : 0.24));
    for (let i = 0; i < reach; i++) {
      const f = i / reach;
      if (f > 1 - dither(i, y) * 0.85) continue;
      const c = f < 0.3 ? PAL.glow[3] : f < 0.65 ? PAL.glow[2] : PAL.glow[1];
      put(line.x - 4 - i, y, c);
      put(line.x + line.w + 3 + i, y, c);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// the screen

const st = {
  t: 0,
  textAt: null, // when the fonts came (the words fade in after)
  skip: false, // an early press or click: the intro shows at once
  menu: false, // the way in is showing, and can be taken
  setOutAt: null, // when thou set out
  bothAt: null, // when thou'd set out and the world was ready
  leaveAt: null,
  hover: false,
  focus: false,
  keys: false, // the keyboard in use (a focused entry then shows lit)
  motes: [],
  sparks: [],
  moteT: 0,
  sparkT: 0.4,
  shineAt: 4,
};
let L = null; // the layout and its layers, rebuilt with the window's size
let fontsIn = false;

function build() {
  const dpr = window.devicePixelRatio || 1;
  // (a page opened out of sight may have no size yet: it's drawn as if 960x540 till it's shown)
  const iw = window.innerWidth || 960;
  const ih = window.innerHeight || 540;
  const portrait = ih > iw * 1.1;
  // every pixel a few screen pixels across (four on a 1080p screen; on a phone held upright, as
  // many as leave the words some 260 pixels to be drawn in), always a whole number of the screen's
  // own pixels, so that all come out the same size
  const cssPx = portrait ? clamp(iw / 260, 1.25, 4) : clamp(Math.round(Math.min(iw / 480, ih / 270)), 2, 6);
  const s = Math.max(1, Math.round(cssPx * dpr));
  const w = Math.ceil((iw * dpr) / s);
  const h = Math.ceil((ih * dpr) / s);
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${(w * s) / dpr}px`;
  canvas.style.height = `${(h * s) / dpr}px`;
  ctx.imageSmoothingEnabled = false;
  const cx = Math.floor(w / 2);
  const cy = Math.round(h * (portrait ? 0.36 : 0.4));
  const R = Math.round(Math.min(h * 0.3, w * (portrait ? 0.44 : 0.3)));
  const next = { w, h, k: s / dpr, portrait, cx, cy, R, tmp: blank(w, h), seen: [window.innerWidth, window.innerHeight, dpr] };
  next.sigil = sigil(next);
  next.bg = paintBackground(w, h, next);
  Object.assign(next, paintSigil(w, h, next.sigil));
  if (fontsIn) buildWords(next);
  L = next;
  placeButton();
}

function buildWords(N) {
  const { w, h, cx, cy, portrait } = N;
  // the wordmark: as wide as fits, a little over half the screen
  const want = portrait ? w * 0.9 : Math.min(w * 0.66, 380);
  let size = 32;
  let mark = wordmark(size);
  size = clamp(Math.floor((size * want) / mark.w), 12, 80);
  mark = wordmark(size);
  while (mark.w > want && size > 12) mark = wordmark(--size);
  const mx = cx - Math.floor(mark.w / 2);
  const my = cy - Math.floor(mark.h / 2);
  N.mark = { x: mx, y: my, w: mark.w, h: mark.h };
  N.logo = paint(w, h, (put) => paintWord(put, mark, mx, my, PAL.gold, { cracks: Math.round(mark.w / 5), seed: 7 }));
  N.logoMask = paint(w, h, (put) => {
    for (let y = 0; y < mark.h; y++) for (let x = 0; x < mark.w; x++) if (mark.mask[y * mark.w + x]) put(mx + x, my + y, [255, 255, 255]);
  });
  // under it, smaller and spaced out: the Lands Between Sessions
  const subSize = Math.max(8, Math.round(size * 0.27));
  const sub = spaced('The Lands Between Sessions', 500, subSize);
  const sx = cx - Math.floor(sub.w / 2);
  const sy = my + mark.h + Math.max(4, Math.round(size * 0.22));
  N.sub = paint(w, h, (put) => paintWord(put, sub, sx, sy, PAL.sub, { shadow: 1 }));
  // (the sigil's lines pass behind these words, not through the gaps between them)
  N.holes = [{ x: sx - 3, y: sy - 2, w: sub.w + 6, h: sub.h + 4 }];
  Object.assign(N, paintSigil(w, h, N.sigil, N.holes));
  // the way in, low on the screen
  let labelSize = Math.max(10, Math.round(size * (portrait ? 0.5 : 0.38)));
  let a = spaced(LABEL[0], 700, labelSize);
  while (a.w > w - 24 && labelSize > 8) a = spaced(LABEL[0], 700, --labelSize);
  const b = spaced(LABEL[1], 700, Math.max(8, Math.round(labelSize * 0.86)));
  const ly = Math.round(h * (portrait ? 0.76 : 0.8));
  const idle = paintLabel(w, h, [a, b], cx, ly, PAL.words);
  N.label = idle.layer;
  N.labelLit = paintLabel(w, h, [a, b], cx, ly, PAL.lit).layer;
  N.labelRect = idle.rect;
  N.labelLine = idle.a;
  N.glow = paintGlow(w, h, idle.a, false);
  N.glowLit = paintGlow(w, h, idle.a, true);
  // the loading sign's word, at the bottom right
  const lw = spaced('Loading', 500, Math.max(8, Math.round(labelSize * 0.86)));
  N.loadingRect = { x: w - lw.w - 22, y: h - lw.h - 8, w: lw.w, h: lw.h };
  N.loadingWord = paint(w, h, (put) => paintWord(put, lw, N.loadingRect.x, N.loadingRect.y, PAL.words, { shadow: 1 }));
}

function placeButton() {
  if (!L?.labelRect) return;
  const { x, y, w, h } = L.labelRect;
  button.style.left = `${x * L.k}px`;
  button.style.top = `${y * L.k}px`;
  button.style.width = `${w * L.k}px`;
  button.style.height = `${h * L.k}px`;
}

// Draws a layer, `level` of it (0..1) shown in a dithered pattern, at `alpha`.
function draw(layer, level = 1, alpha = 1) {
  if (!layer || level <= 0 || alpha <= 0) return;
  ctx.globalAlpha = alpha;
  if (level >= 1) {
    ctx.drawImage(layer, 0, 0);
  } else {
    const t = L.tmp.getContext('2d');
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, L.w, L.h);
    t.drawImage(layer, 0, 0);
    t.globalCompositeOperation = 'destination-in';
    t.fillStyle = patterns[clamp(Math.round(level * 16), 1, 15)];
    t.fillRect(0, 0, L.w, L.h);
    t.globalCompositeOperation = 'source-over';
    ctx.drawImage(L.tmp, 0, 0);
  }
  ctx.globalAlpha = 1;
}

const px = (x, y, c, a = 1) => {
  ctx.fillStyle = css(c, a);
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
};

// Embers drifting up from the bowl and out of the dark below, flickering as they go.
function stepMotes(dt, shown) {
  if (still) return;
  st.moteT -= dt;
  while (st.moteT <= 0) {
    st.moteT += 0.06 + Math.random() * 0.09;
    const { cx, cy, R, h } = L;
    const fromBowl = Math.random() < 0.6;
    st.motes.push({
      x: cx + (Math.random() - 0.5) * R * (fromBowl ? 2.6 : 4.4),
      y: fromBowl ? cy + R * (0.5 + Math.random() * 0.35) : h + 2,
      vy: -(3 + Math.random() * 7),
      sway: Math.random() * Math.PI * 2,
      age: 0,
      life: 3 + Math.random() * 5,
      c: PAL.embers[Math.floor(Math.random() * PAL.embers.length)],
      big: Math.random() < 0.12,
    });
  }
  st.motes = st.motes.filter((m) => {
    m.age += dt;
    m.y += m.vy * dt;
    m.sway += dt * 1.3;
    if (m.age >= m.life || m.y < -2) return false;
    const x = m.x + Math.sin(m.sway) * 1.6;
    const a = Math.sin((Math.PI * m.age) / m.life) * (0.65 + 0.35 * Math.sin(m.age * 13 + m.sway)) * shown;
    if (a <= 0.05) return true;
    px(x, m.y, m.c, a);
    if (m.big) {
      const b = a * 0.45;
      px(x - 1, m.y, m.c, b); px(x + 1, m.y, m.c, b); px(x, m.y - 1, m.c, b); px(x, m.y + 1, m.c, b);
    }
    return true;
  });
}

// Now and then a spark runs along a line of the sigil, leaving a short fading trail.
function stepSparks(dt, shown) {
  if (still) return;
  const S = L.sigil;
  st.sparkT -= dt;
  if (st.sparkT <= 0 && st.sparks.length < 4) {
    st.sparkT = 0.5 + Math.random() * 1.1;
    const path = S.paths[Math.floor(Math.random() * S.paths.length)];
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (path.kind === 'stem') st.sparks.push({ path, at: dir > 0 ? path.y0 : path.y1, v: dir * (26 + Math.random() * 20), age: 0, life: 2.4 });
    else {
      const start = path.kind === 'bowl' ? Math.PI / 2 + (Math.random() - 0.5) * 0.7 : Math.random() * Math.PI * 2;
      st.sparks.push({ path, at: start, v: (dir * (24 + Math.random() * 18)) / path.r, age: 0, life: 1.8 + Math.random() * 1.6 });
    }
  }
  const pointAt = (p, at) => (p.kind === 'stem' ? [p.x, at] : [p.x + Math.cos(at) * p.r, p.y + Math.sin(at) * p.r]);
  const onPath = (p, x, y) => !inHole(L.holes || [], Math.round(x), Math.round(y))
    && (p.kind === 'bowl' ? y >= p.below : p.kind === 'stem' ? y >= p.y0 && y <= p.y1 : true);
  st.sparks = st.sparks.filter((s) => {
    s.age += dt;
    s.at += s.v * dt;
    if (s.age >= s.life) return false;
    const fade = Math.min(1, s.age * 3, (s.life - s.age) * 2) * shown;
    const step = s.path.kind === 'stem' ? Math.sign(s.v) : Math.sign(s.v) / s.path.r;
    for (let i = 0; i < 7; i++) {
      const [x, y] = pointAt(s.path, s.at - step * i);
      if (!onPath(s.path, x, y)) continue;
      px(x, y, i ? PAL.embers[Math.min(3, i >> 1)] : PAL.spark, fade * (1 - i / 7));
    }
    return true;
  });
}

// A band of light sweeping across the wordmark now and then.
function shine() {
  if (still || !L.logoMask) return;
  const span = L.mark.w + L.mark.h + 12;
  const p = (st.t - st.shineAt) * 140;
  if (p > span) { st.shineAt = st.t + 5 + Math.random() * 4; return; }
  if (p < 0) return;
  const t = L.tmp.getContext('2d');
  t.globalCompositeOperation = 'source-over';
  t.clearRect(0, 0, L.w, L.h);
  t.drawImage(L.logoMask, 0, 0);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = css(PAL.gold[0], 0.85);
  for (let y = 0; y < L.mark.h; y++) t.fillRect(Math.round(L.mark.x + p - (y + L.mark.h) * 0.6), L.mark.y + y, 3, 1);
  t.globalCompositeOperation = 'source-over';
  ctx.drawImage(L.tmp, 0, 0);
}

// The loading sign: a ring of points, a bright one running round it, and the word beside it.
function loadingSign(level) {
  if (level <= 0 || !L.loadingRect) return;
  draw(L.loadingWord, level);
  const r = L.loadingRect;
  const cx = L.w - 12;
  const cy = r.y + Math.floor(r.h / 2);
  const n = 10;
  const head = Math.floor(st.t * 12) % n;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const behind = (head - i + n) % n;
    const c = behind === 0 ? PAL.spark : behind < 3 ? PAL.embers[1] : behind < 5 ? PAL.embers[3] : PAL.halo;
    px(cx + Math.round(Math.cos(a) * 4), cy + Math.round(Math.sin(a) * 4), c, level);
  }
}

// The title crumbling away into the world: pixels go, the middle first, in a scatter.
let crumble = null;
function crumbleAway(k) {
  if (!crumble || crumble.w !== L.w || crumble.h !== L.h) {
    const rnd = seeded(11);
    const n = new Float32Array(L.w * L.h);
    for (let y = 0; y < L.h; y++) {
      for (let x = 0; x < L.w; x++) {
        const d = Math.hypot((x - L.cx) / L.w, (y - L.cy) / L.h) * 1.6;
        n[y * L.w + x] = 0.55 * rnd() + 0.45 * Math.min(1, d);
      }
    }
    const c = blank(L.w, L.h);
    crumble = { w: L.w, h: L.h, n, c, g: c.getContext('2d'), img: c.getContext('2d').createImageData(L.w, L.h) };
  }
  const { n, img, g, c } = crumble;
  const d = img.data;
  for (let i = 0; i < n.length; i++) d[i * 4 + 3] = n[i] >= k ? 255 : 0;
  g.putImageData(img, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(c, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

function frame(dt) {
  const t = st.t;
  const intro = (span, words = false) => {
    if (st.skip) return 1;
    if (!words) return ramp(t, span);
    if (st.textAt == null) return 0;
    const lag = Math.max(0, st.textAt + 0.3 - INTRO.logo[0]);
    return ramp(t, [span[0] + lag, span[1] + lag]);
  };
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = css(PAL.black);
  ctx.fillRect(0, 0, L.w, L.h);
  const glow = intro(INTRO.glow);
  draw(L.bg, glow);
  // the sigil, breathing
  const sig = intro(INTRO.sigil);
  const breath = still ? 1 : 0.72 + 0.28 * Math.sin(t * 1.3);
  draw(L.halo, sig, breath);
  draw(L.lines, sig, 0.8 + 0.2 * breath);
  stepSparks(dt, sig);
  stepMotes(dt, glow);
  // the wordmark and the words under it
  const logo = intro(INTRO.logo, true);
  draw(L.logo, logo);
  if (logo >= 1) shine();
  draw(L.sub, intro(INTRO.sub, true));
  // the way in: once it's taken, it flares and goes, and the loading sign comes if need be
  let label = intro(INTRO.label, true);
  if (label >= 1 && !st.menu && st.setOutAt == null) {
    st.menu = true;
    button.disabled = false;
    button.focus({ preventScroll: true });
  }
  const lit = st.hover || (st.focus && st.keys);
  if (st.setOutAt != null) {
    const since = t - st.setOutAt;
    label = since < 0.14 ? 1 : clamp(1 - (since - 0.14) / 0.4, 0, 1);
    draw(L.glowLit, label, since < 0.14 ? 1 : 0.8);
    draw(since < 0.14 ? L.labelLit : L.label, label);
    const waiting = st.bothAt == null ? clamp((since - 0.3) / 0.3, 0, 1) : clamp(1 - (t - st.bothAt) / 0.25, 0, 1);
    loadingSign(waiting);
  } else if (label > 0) {
    const pulse = still ? 1 : 0.82 + 0.18 * Math.sin(t * 2.2);
    draw(lit ? L.glowLit : L.glow, label, lit ? 1 : pulse);
    draw(lit ? L.labelLit : L.label, label);
    if (lit && label >= 1) {
      // the marks either side of it, as by a chosen menu entry
      const a = L.labelLine;
      const y = a.y + Math.floor(a.h / 2);
      for (const [x, dir] of [[a.x - 7, 1], [a.x + a.w + 6, -1]]) {
        px(x, y, PAL.lit[1]); px(x + dir, y, PAL.lit[0]); px(x, y - 1, PAL.lit[2]); px(x, y + 1, PAL.lit[2]); px(x - dir, y, PAL.lit[2]);
      }
    }
  }
  if (st.leaveAt != null) crumbleAway(clamp((t - st.leaveAt) / LEAVE, 0, 1));
}

// ---------------------------------------------------------------------------------------------
// setting out

function go() {
  if (!st.menu || st.setOutAt != null) return;
  st.setOutAt = st.t;
  button.disabled = true;
  setOut();
}

Promise.all([started, ready]).then(() => {
  st.bothAt = st.t;
  // (the loading sign, if it showed, goes first)
  const wait = st.setOutAt != null && st.t - st.setOutAt > 0.3 ? 0.25 : 0.05;
  setTimeout(() => {
    st.leaveAt = st.t;
    root.classList.add('leaving');
    document.body.classList.remove('on-title');
    document.body.classList.add('hud-in');
    setTimeout(() => document.body.classList.remove('hud-in'), 2200);
  }, wait * 1000);
});

button.addEventListener('click', go);
button.addEventListener('pointerenter', () => { st.hover = true; });
button.addEventListener('pointerleave', () => { st.hover = false; });
button.addEventListener('focus', () => { st.focus = true; });
button.addEventListener('blur', () => { st.focus = false; });
// a key or a click during the intro shows it all at once; once the way in shows, Enter takes it
// wherever the focus is
const onKey = (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  st.keys = true;
  if (!st.menu) { st.skip = st.textAt != null; return; }
  if (e.key === 'Enter' && document.activeElement !== button) go();
};
const onPointer = () => {
  st.keys = false;
  if (!st.menu) st.skip = st.textAt != null;
};
window.addEventListener('keydown', onKey);
root.addEventListener('pointerdown', onPointer);

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // (a size change the resize event didn't bring: a page first drawn out of sight, say)
  const [sw, sh, sd] = L.seen;
  if (!resizeTimer && (sw !== window.innerWidth || sh !== window.innerHeight || sd !== (window.devicePixelRatio || 1))) build();
  st.t += dt;
  frame(dt);
  if (st.leaveAt != null && st.t - st.leaveAt >= LEAVE) {
    root.remove();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    return;
  }
  requestAnimationFrame(loop);
}

let resizeTimer = 0;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { resizeTimer = 0; build(); }, 120);
}
window.addEventListener('resize', onResize);

build();
requestAnimationFrame(loop);
// the words wait for their fonts (local files: a moment), or for long enough
Promise.race([
  Promise.all(['700 32px Cinzel', '500 16px Cinzel'].map((f) => document.fonts.load(f))),
  new Promise((resolve) => setTimeout(resolve, 2500)),
]).catch(() => {}).then(() => {
  fontsIn = true;
  buildWords(L);
  placeButton();
  st.textAt = st.t;
});
