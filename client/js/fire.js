// Pixel-art fire for Roundtable Hold's braziers and the candles on its round table, from the
// user's sprite sheets (assets/fx/brazier-fire.json and candle-fire.json; see README).
//
// Brazier: the sheet's frames grow tall and collapse rather than loop, so the fire is rigged from
// a few of its cleanest frames instead. The flame sways in a wave that climbs it, stretches and
// settles above its glowing bed; both sides swell and draw in on their own, with licks running up
// them; heat shimmers up through it, the tips lick, and sparks break off and rise.
// Candle: the sheet's own frames, on one baseline, played in the order that changes least from
// one frame to the next (the one bent frame that jumps out is left out), with a black wick rising
// from the wax into the bottom of the flame.

import * as THREE from 'three';

const ART = { brazier: '/assets/fx/brazier-fire.json', candle: '/assets/fx/candle-fire.json' };

export const BRAZIER = {
  bases: [0, 3, 9, 11], // the sheet frames the four braziers are rigged from (0-based)
  frames: 24,
  fps: 12,
  bed: 9, // rows of glowing bed at the bottom: they keep their height and barely sway
  sway: 2.3, // pixels the tips swing either side
  sparks: 5, // per loop
  px: 0.048, // world units per art pixel: close to the heroes' own pixels
};

export const CANDLE = {
  order: [0, 11, 3, 2, 10, 5, 4, 7, 8, 6, 1],
  fps: 8,
  px: 0.018,
  wick: '#120c0a', // added to the candle palette
};

const rand = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

// A frame as a heat grid (palette index; the palettes run from dark red to white), trimmed to its
// pixels, with the centre of its bottom row (where it sits on the coals or the wick).
function grid(frame, alphabet) {
  const rows = frame.rows.filter((r) => /[^.]/.test(r));
  let x0 = Infinity;
  let x1 = -1;
  for (const r of rows) {
    const a = r.search(/[^.]/);
    const b = r.length - 1 - [...r].reverse().join('').search(/[^.]/);
    x0 = Math.min(x0, a);
    x1 = Math.max(x1, b);
  }
  const w = x1 - x0 + 1;
  const h = rows.length;
  const cells = new Int8Array(w * h).fill(-1);
  rows.forEach((r, y) => {
    for (let x = 0; x < w; x++) if (r[x + x0] !== '.') cells[y * w + x] = alphabet.indexOf(r[x + x0]);
  });
  const bottom = [...cells.slice((h - 1) * w)].map((v, x) => (v >= 0 ? x : -1)).filter((x) => x >= 0);
  return { w, h, cells, base: (bottom[0] + bottom[bottom.length - 1]) / 2 };
}

// The resampled AI art has pinholes and stray rim-coloured pixels inside the flame: fill each
// with its neighbours' heat.
function tidy(g) {
  const { w, h } = g;
  let cells = g.cells;
  for (let pass = 0; pass < 2; pass++) {
    const src = cells;
    cells = src.slice();
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const v = src[y * w + x];
        const n = [src[y * w + x - 1], src[y * w + x + 1], src[(y - 1) * w + x], src[(y + 1) * w + x]];
        const hole = v < 0 && n.every((c) => c >= 0);
        const speck = v >= 0 && v < 2 && n.every((c) => c >= 2);
        if (hole || speck) cells[y * w + x] = Math.round(n.reduce((a, c) => a + Math.max(0, c), 0) / 4);
      }
    }
  }
  return { ...g, cells };
}

function mirror(g) {
  const cells = new Int8Array(g.cells.length);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) cells[y * g.w + x] = g.cells[y * g.w + g.w - 1 - x];
  return { ...g, cells, base: g.w - 1 - g.base };
}

// How far one side of the flame stands out (+) or in (−) at height k, at loop time t (0..1): a
// ripple climbing the side, and a lick (a bulge) running up it twice a loop. Whole harmonics of
// the loop, so it runs on seamlessly.
function side(k, t, ph) {
  const climb = (t * 2 + ph / (Math.PI * 2)) % 1;
  const lick = 1.3 * Math.exp(-((k - (climb * 30 - 3)) ** 2) / 6);
  return Math.max(-1, Math.min(2, 0.8 * Math.sin(Math.PI * 4 * t - 0.42 * k + ph) + lick));
}

// The rigged brazier loop from one source frame: `frames` heat grids of one size, each with how
// much fire it holds (for the light it casts).
function rigBrazier(src, seed) {
  const { frames: N, bed, sway } = BRAZIER;
  const { w, h } = src;
  const M = 5; // margin for the sway, the stretch and the sparks
  const W = w + 2 * M;
  const H = h + 2 * M;
  const flame = h - bed;
  const at = (x, k) => (x < 0 || x >= w || k < 0 || k >= h ? -1 : src.cells[(h - 1 - k) * w + x]);
  const r = rand(seed);
  const ph = r() * Math.PI * 2;
  const out = [];
  for (let f = 0; f < N; f++) {
    const t = f / N;
    const T = Math.PI * 2 * t;
    const img = new Int8Array(W * H).fill(-1);
    const put = (x, k, v) => { if (x >= 0 && x < W && k >= 0 && k < H) img[(H - 1 - k) * W + x] = v; };
    const get = (x, k) => (x < 0 || x >= W || k < 0 || k >= H ? -1 : img[(H - 1 - k) * W + x]);
    // whole harmonics of the loop, so the last frame runs into the first
    const stretch = 1 + 0.1 * Math.sin(T + ph) + 0.06 * Math.sin(3 * T + 1.3 * ph);
    for (let k = 0; k < H; k++) {
      let ks = k;
      let dx = 0;
      if (k >= bed) {
        const u = (k - bed) / flame;
        ks = bed + Math.round((k - bed) / stretch);
        // a wave that climbs the flame, swinging the tips most
        dx = Math.round(sway * u ** 1.5 * Math.sin(T - 2.8 * u + ph) + 0.55 * sway * u * u * Math.sin(2 * T - 4.6 * u + 2 * ph));
      }
      const row = [];
      for (let x = 0; x < w; x++) row.push(at(x, ks));
      const filled = row.map((v, x) => (v >= 0 ? x : -1)).filter((x) => x >= 0);
      if (!filled.length) continue;
      // the sides move too: each edge swells and draws in on its own, row by row, the row
      // resampled between its new edges (so its rim stays a rim and its heat stays in order)
      const L = filled[0];
      const R = filled[filled.length - 1];
      let eL = 0;
      let eR = 0;
      if (k > 0 && R - L >= 3) {
        // gentle at the base of the bed, full along the body, calmer toward the thin tips
        const a = k < bed ? 0.35 + (0.65 * k) / bed : 1 - 0.45 * Math.min(1, (k - bed) / flame);
        eL = Math.round(a * side(k, t, ph));
        eR = Math.round(a * side(k, t, ph + 2.4));
      }
      const L2 = L - eL;
      const R2 = R + eR;
      for (let x = L2; x <= R2; x++) {
        const v = row[R2 === L2 ? L : L + Math.round(((x - L2) * (R - L)) / (R2 - L2))];
        if (v >= 0) put(x + M + dx, k, v);
      }
    }
    // heat shimmering up through the body
    const copy = img.slice();
    for (let k = 2; k < H; k++) {
      for (let x = 0; x < W; x++) {
        const v = copy[(H - 1 - k) * W + x];
        if (v < 2 || v > 6) continue;
        const n = Math.round(0.62 * Math.sin(3 * T - 0.9 * k + 0.45 * x + ph));
        img[(H - 1 - k) * W + x] = Math.max(1, Math.min(7, v + n));
      }
    }
    // the tips lick: now and then a tongue's last pixel is gone
    for (let x = 0; x < W; x++) {
      for (let k = H - 1; k >= bed + flame * 0.55; k--) {
        if (get(x, k) < 0) continue;
        if (r() < 0.18) put(x, k, -1);
        break;
      }
    }
    // keep the outline: heat showing at an open edge darkens to the rim colour
    const lit = img.slice();
    for (let k = 0; k < H; k++) {
      for (let x = 0; x < W; x++) {
        const v = lit[(H - 1 - k) * W + x];
        if (v < 2) continue;
        const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => {
          const xx = x + a;
          const kk = k + b;
          return xx < 0 || xx >= W || kk < 0 || kk >= H || lit[(H - 1 - kk) * W + xx] < 0;
        });
        if (open) img[(H - 1 - k) * W + x] = 0;
      }
    }
    out.push({ w: W, h: H, cells: img, base: src.base + M });
  }
  // sparks: born at the highest tip, rising a pixel a frame and drifting, cooling as they go
  const tip = (img) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (img.cells[y * W + x] >= 0) return [x, H - 1 - y];
    return [W >> 1, H >> 1];
  };
  for (let s = 0; s < BRAZIER.sparks; s++) {
    const born = Math.floor(r() * N);
    const life = 3 + Math.floor(r() * 3);
    const drift = r() < 0.5 ? -1 : 1;
    const [sx, sk] = tip(out[born]);
    for (let age = 0; age < life; age++) {
      const fr = out[(born + age) % N];
      const x = sx + drift * Math.floor((age + 1) / 2);
      const k = sk + 2 + age;
      if (x < 0 || x >= W || k >= H) continue;
      const i = (H - 1 - k) * W + x;
      if (fr.cells[i] < 0) fr.cells[i] = age < 2 ? 2 : age < 4 ? 1 : 0;
    }
  }
  return out;
}

// The candle loop: the sheet's frames in CANDLE.order, on one baseline and one centre line, one
// pixel above the bottom of the frame: the wick (palette index `wick`) stands there on the wax and
// runs two pixels up into the flame.
function candleFrames(grids, wick) {
  const list = CANDLE.order.map((i) => grids[i]);
  const left = Math.ceil(Math.max(...list.map((g) => g.base))) + 1;
  const right = Math.ceil(Math.max(...list.map((g) => g.w - 1 - g.base))) + 1;
  const W = left + right + 1;
  const H = Math.max(...list.map((g) => g.h)) + 2;
  return list.map((g) => {
    const cells = new Int8Array(W * H).fill(-1);
    const ox = Math.round(left - g.base);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) cells[(H - 1 - g.h + y) * W + x + ox] = g.cells[y * g.w + x];
    for (let y = H - 3; y < H; y++) cells[y * W + left] = wick;
    return { w: W, h: H, cells, base: left };
  });
}

// Frames → one canvas strip, and how bright each frame burns (0 the dimmest of the loop, 1 the
// brightest).
function strip(frames, palette) {
  const { w, h } = frames[0];
  const c = document.createElement('canvas');
  c.width = w * frames.length;
  c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(c.width, h);
  const rgb = palette.map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
  const heat = frames.map((fr, n) => {
    let sum = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = fr.cells[y * w + x];
        if (v < 0) continue;
        sum += v + 1;
        const o = (y * c.width + n * w + x) * 4;
        img.data.set([...rgb[v], 255], o);
      }
    }
    return sum;
  });
  g.putImageData(img, 0, 0);
  const lo = Math.min(...heat);
  const hi = Math.max(...heat);
  return { canvas: c, energy: heat.map((s) => (hi > lo ? (s - lo) / (hi - lo) : 1)) };
}

// One animation: a canvas strip of frames, with where the fire sits (its base) in each frame.
function sheet(frames, palette, fps, px) {
  const { canvas, energy } = strip(frames, palette);
  return { canvas, energy, frames: frames.length, w: frames[0].w, h: frames[0].h, base: frames[0].base, fps, px };
}

// Both rigs from the two art files, as frame lists (heat grids, no canvas needed): { brazier:
// [one loop per brazier, alternate ones mirrored], candle: [the loop, mirrored] }.
export function rigFires(b, c) {
  const bg = b.frames.map((f) => tidy(grid(f, b.alphabet)));
  const brazier = BRAZIER.bases.map((i, k) => rigBrazier(k % 2 ? mirror(bg[i]) : bg[i], 101 + k * 37));
  const cg = c.frames.map((f) => grid(f, c.alphabet));
  const candle = [cg, cg.map(mirror)].map((g) => candleFrames(g, c.palette.length));
  return { brazier, candle, palettes: { brazier: b.palette, candle: [...c.palette, CANDLE.wick] } };
}

// Loads both sheets and rigs them into canvas strips: { brazier: [4 sheets, one per brazier],
// candle: [sheet, mirrored sheet] }, or null if the art can't be had (the old glows stay then).
export async function loadFireArt() {
  try {
    const [b, c] = await Promise.all([ART.brazier, ART.candle].map((u) => fetch(u).then((r) => r.json())));
    const rigs = rigFires(b, c);
    return {
      brazier: rigs.brazier.map((frames) => sheet(frames, rigs.palettes.brazier, BRAZIER.fps, BRAZIER.px)),
      candle: rigs.candle.map((frames) => sheet(frames, rigs.palettes.candle, CANDLE.fps, CANDLE.px)),
    };
  } catch (err) {
    console.warn('Fire art unavailable', err);
    return null;
  }
}

// A flame in the world: a billboard standing on its base, stepping through its sheet.
export class Flame {
  constructor(sheet, { start = Math.random(), brightness = 1.35 } = {}) {
    this.sheet = sheet;
    this.t = start * (sheet.frames / sheet.fps);
    const tex = new THREE.CanvasTexture(sheet.canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(1 / sheet.frames, 1);
    this.tex = tex;
    const W = sheet.w * sheet.px;
    const H = sheet.h * sheet.px;
    const geo = new THREE.PlaneGeometry(W, H);
    geo.translate(W / 2 - (sheet.base + 0.5) * sheet.px, H / 2, 0);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, color: new THREE.Color(brightness, brightness, brightness) }));
    this.mesh.userData.dynamic = true;
    this.frame = -1;
    this.energy = 1;
    this.step(0);
  }

  // Advance; returns how bright the current frame burns (0 dimmest .. 1 brightest of its loop).
  step(dt) {
    const s = this.sheet;
    this.t += dt;
    const f = Math.floor(this.t * s.fps) % s.frames;
    if (f !== this.frame) {
      this.frame = f;
      this.tex.offset.x = f / s.frames;
      this.energy = s.energy[f];
    }
    return this.energy;
  }
}
