// Shared machinery for hand-drawn heroes. A hero's art is one pose on a palette-indexed pixel
// grid (assets/hero/*.json); a rig cuts it into parts and composes every animation frame by moving
// those parts on the integer grid, rotating held weapons RotSprite-style, and making the glowing
// magic (lightning, frost…) flicker and crackle. Plain data in, plain data out, so the same code
// runs in the browser, in a worker (compose-worker.js) and in the scripts (bake-sheets.mjs: the
// sheets baked ahead of time, loaded as pictures instead of drawn as the game starts; and
// build-hero-sheets.mjs, the previews).

import { BAKED, fingerprint } from './bake.js';

export const NONE = -1;

export class Img {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.c = new Int16Array(w * h).fill(NONE);
  }
  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y * this.w + x] : NONE;
  }
  set(x, y, v) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = v;
  }
}

export function rngFrom(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// addColor(hex) lets a rig bring in colours the drawing lacks (a brighter glow for an effect it
// draws); they are appended after the art's own palette entries. Art that holds several frames
// (scripts/pack-frames.mjs: a drawn attack) gives them all as `frames`; `src` is the first.
export function parseArt(json) {
  const { alphabet } = json;
  const palette = [...json.palette];
  const grid = ({ w, h, rows }) => {
    const img = new Img(w, h);
    rows.forEach((row, y) => {
      for (let x = 0; x < w; x++) if (row[x] !== '.') img.set(x, y, alphabet.indexOf(row[x]));
    });
    return img;
  };
  const frames = (json.frames || [json]).map(grid);
  const src = frames[0];
  const code = (ch) => alphabet.indexOf(ch);
  const ids = (s) => new Set([...s].map(code));
  const addColor = (hex) => {
    const i = palette.indexOf(hex);
    if (i >= 0) return i;
    palette.push(hex);
    return palette.length - 1;
  };
  return { src, frames, palette, code, ids, addColor };
}

// Copy of the pixels of `src` for which test(x, y) holds.
export function region(src, test) {
  const out = new Img(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const v = src.get(x, y);
      if (v !== NONE && test(x, y)) out.set(x, y, v);
    }
  }
  return out;
}

export function blit(dst, img, dx, dy, rowShift = null) {
  for (let y = 0; y < img.h; y++) {
    const sh = rowShift ? rowShift(y) : 0;
    for (let x = 0; x < img.w; x++) {
      const v = img.c[y * img.w + x];
      if (v !== NONE) dst.set(x + dx + sh, y + dy, v);
    }
  }
}

// Clears every pixel `part` occupies (at the given offset) out of dst.
export function erase(dst, part, dx, dy) {
  for (let y = 0; y < part.h; y++) {
    for (let x = 0; x < part.w; x++) if (part.c[y * part.w + x] !== NONE) dst.set(x + dx, y + dy, NONE);
  }
}

// ---------------------------------------------------------------------------------------------
// RotSprite-style rotation: upscale 4x with Scale2x twice, then sample at the rotated centres.

function scale2x(img) {
  const out = new Img(img.w * 2, img.h * 2);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const P = img.get(x, y);
      const A = img.get(x, y - 1);
      const B = img.get(x + 1, y);
      const C = img.get(x - 1, y);
      const D = img.get(x, y + 1);
      out.set(x * 2, y * 2, C === A && C !== D && A !== B ? A : P);
      out.set(x * 2 + 1, y * 2, A === B && A !== C && B !== D ? B : P);
      out.set(x * 2, y * 2 + 1, D === C && D !== B && C !== A ? C : P);
      out.set(x * 2 + 1, y * 2 + 1, B === D && B !== A && D !== C ? D : P);
    }
  }
  return out;
}

export function rotatable(img) {
  return { img, big: scale2x(scale2x(img)) };
}

// Draws a rotatable part turned by `deg` (positive tips its top toward +x) about `pivot`.
export function drawRotated(dst, part, deg, pivot, dx, dy) {
  if (Math.abs(deg) < 0.01) { blit(dst, part.img, dx, dy); return; }
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const { img, big } = part;
  const R = Math.ceil(Math.hypot(img.w, img.h));
  for (let y = Math.floor(pivot.y - R); y <= pivot.y + R; y++) {
    for (let x = Math.floor(pivot.x - R); x <= pivot.x + R; x++) {
      const ox = x + 0.5 - pivot.x;
      const oy = y + 0.5 - pivot.y;
      const sx = ox * cos + oy * sin + pivot.x;
      const sy = -ox * sin + oy * cos + pivot.y;
      const v = big.get(Math.floor(sx * 4), Math.floor(sy * 4));
      if (v !== NONE) dst.set(x + dx, y + dy, v);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Living magic. `spec` names the palette entries of the effect:
//   hot   – colours that glow (lightning reds, frost blues…)
//   core  – white-hot centres, counted only where they touch a hot pixel
//   soft  – hot colours that count as "core" when lit (pinks, pale blues)
//   dim   – [outer, inner] colours for an arc that's smouldering
//   flare – [outer, inner] colours for an arc that flares
//   crackle – { main, core, sparks: [...] } for fresh crackles drawn each frame
//   faint – (optional) colours with a feeble glow of their own that never flickers
// Each connected arc independently goes off (painted over with what's around it), dims, stays
// lit or flares; then new crackles and sparks are drawn. Returns a glow map (1 hot, 2 core,
// 3 faint: rig.glowColors[2]).
// Pixels listed in f.keep (frame indices, e.g. a glowing eye) glow steadily and never flicker.
export function energy(f, spec, level, seed) {
  const r = rngFrom(seed);
  const isHot = (v) => spec.hot.has(v);
  const mask = new Uint8Array(f.w * f.h);
  const steady = new Set(f.keep || []);
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const v = f.get(x, y);
      if (steady.has(y * f.w + x)) continue;
      if (isHot(v)) mask[y * f.w + x] = 1;
      else if (spec.core.has(v) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => isHot(f.get(x + a, y + b)))) mask[y * f.w + x] = 2;
    }
  }
  const base = f.c.slice();
  const fill = (k) => {
    const x0 = k % f.w;
    const y0 = (k - x0) / f.w;
    const votes = new Map();
    let empty = 0;
    let total = 0;
    for (let r2 = 1; r2 <= 2 && total < 3; r2++) {
      for (let b = -r2; b <= r2; b++) for (let a = -r2; a <= r2; a++) {
        if (Math.max(Math.abs(a), Math.abs(b)) !== r2) continue;
        const x = x0 + a;
        const y = y0 + b;
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        const n = y * f.w + x;
        if (mask[n]) continue;
        total += 1;
        if (base[n] === NONE) empty += 1;
        else votes.set(base[n], (votes.get(base[n]) || 0) + 1);
      }
    }
    if (!votes.size || empty * 2 > total) return NONE;
    return [...votes.entries()].sort((p, q) => q[1] - p[1])[0][0];
  };
  const glow = new Img(f.w, f.h);
  const seen = new Uint8Array(f.w * f.h);
  const odds = (spec.odds || [[0.5, 0.68, 0.96], [0.28, 0.42, 0.84], [0.04, 0.1, 0.52]])[level];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    const comp = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const k = stack.pop();
      comp.push(k);
      const x = k % f.w;
      const y = (k - x) / f.w;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
        const nx = x + a;
        const ny = y + b;
        if (nx < 0 || ny < 0 || nx >= f.w || ny >= f.h) continue;
        const n = ny * f.w + nx;
        if (mask[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    // Big bodies of glow (a blade, an orb) never switch fully off; they dim (or stay lit).
    const roll = r();
    let state = roll < odds[0] ? 'off' : roll < odds[1] ? 'dim' : roll < odds[2] ? 'lit' : 'flare';
    if (state === 'off' && comp.length > (spec.keepAbove || 40)) state = spec.bigOff || 'dim';
    for (const k of comp) {
      const v = f.c[k];
      const core = mask[k] === 2 || spec.soft.has(v);
      if (state === 'off') f.c[k] = fill(k);
      else if (state === 'dim') f.c[k] = core ? spec.dim[1] : spec.dim[0];
      else {
        if (state === 'flare') f.c[k] = core ? spec.flare[1] : spec.flare[0];
        glow.c[k] = core || state === 'flare' ? 2 : 1;
      }
    }
  }
  for (const k of steady) {
    const v = f.c[k];
    if (v !== NONE) glow.c[k] = spec.core.has(v) || spec.soft.has(v) ? 2 : 1;
  }
  const anchors = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) anchors.push(i);
  const { main, core: coreColor, sparks } = spec.crackle;
  const arcs = (spec.arcs || [1, 3, 7])[level];
  for (let n = 0; n < arcs && anchors.length; n++) {
    const k = anchors[Math.floor(r() * anchors.length)];
    let x = k % f.w;
    let y = (k - x) / f.w;
    const dir = r() < 0.5 ? -1 : 1;
    const len = 3 + Math.floor(r() * (level === 2 ? 7 : 4));
    for (let s = 0; s < len; s++) {
      if (spec.style === 'shards') { x += dir; y += r() < 0.6 ? -1 : 0; } else if (s % 2 === 0) x += dir; else y += r() < 0.5 ? -1 : 1;
      if (f.get(x, y) === NONE && r() < 0.15) break;
      const hot = s > 0 && s < len - 1 && r() < 0.45;
      f.set(x, y, hot ? coreColor : main);
      glow.set(x, y, hot ? 2 : 1);
    }
  }
  const sparkCount = (spec.sparks || [1, 3, 8])[level];
  for (let n = 0; n < sparkCount && anchors.length; n++) {
    const k = anchors[Math.floor(r() * anchors.length)];
    const reach = spec.sparkReach || 6;
    const x = (k % f.w) + Math.round((r() - 0.5) * reach);
    const y = Math.floor(k / f.w) + Math.round((r() - 0.5) * reach) - (spec.sparkRise || 0);
    if (f.get(x, y) === NONE) {
      f.set(x, y, sparks[Math.floor(r() * sparks.length)]);
      glow.set(x, y, 1);
    }
  }
  if (spec.faint) for (let k = 0; k < f.c.length; k++) if (!glow.c[k] && spec.faint.has(f.c[k])) glow.c[k] = 3;
  return glow;
}

// ---------------------------------------------------------------------------------------------
// Stills: a second hand-drawn pose (kneeling) brought to life without a full rig. It breathes
// (head and chest sink a pixel), bows its head, its cape stirs and a floating part (an orb) can
// drift. `spec` gives, in the still's own grid:
//   ground, mid – the row it stands on and the column that lands on the frame's centre
//   neck, waist – rows above `neck` are the head; rows between them are the chest
//   cape        – { x1, y0 }: the part left of x1 and below y0 sways
//   fixed(x,y)  – pixels that never breathe (a planted spear)
//   float(x,y)  – pixels that drift upwards on their own (an orb)
//   eye         – { x0, x1, y0, y1, ids }: glowing eye pixels that never flicker

export function prepareStill(art, spec) {
  const { src } = art;
  const fixed = spec.fixed || (() => false);
  const float = spec.float || (() => false);
  const head = (x, y) => y < spec.neck && !fixed(x, y) && !float(x, y);
  const chest = (x, y) => y >= spec.neck && y < spec.waist && !fixed(x, y) && !float(x, y);
  const eye = [];
  if (spec.eye) {
    const { x0, x1, y0, y1, ids } = spec.eye;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (ids.has(src.get(x, y))) eye.push([x, y]);
  }
  return {
    spec,
    eye,
    head: region(src, head),
    chest: region(src, chest),
    float: region(src, float),
    rest: region(src, (x, y) => !head(x, y) && !chest(x, y) && !float(x, y)),
  };
}

// p: { bob, head: [dx, dy], sway, float }
export function composeStill(still, p, frame) {
  const { spec } = still;
  const f = new Img(frame.w, frame.h);
  const ox = Math.round(anchorOf(frame) - spec.mid);
  const oy = frame.h - 1 - spec.ground;
  const bob = p.bob || 0;
  const hd = p.head || [0, 0];
  const sway = p.sway || 0;
  const capeShift = (x, y) => (spec.cape && x <= spec.cape.x1 && y >= spec.cape.y0
    ? Math.round((sway * (y - spec.cape.y0)) / Math.max(1, spec.ground - spec.cape.y0)) : 0);
  // drawn once as is and once sheared, so a swaying cape never opens a gap
  for (const sheared of [false, true]) {
    for (const [part, dy] of [[still.rest, 0], [still.chest, bob]]) {
      for (let y = 0; y < part.h; y++) {
        for (let x = 0; x < part.w; x++) {
          const v = part.c[y * part.w + x];
          if (v === NONE) continue;
          const sx = sheared ? capeShift(x, y) : 0;
          if (sheared && !sx) continue;
          f.set(x + ox + sx, y + oy + dy, v);
        }
      }
    }
  }
  blit(f, still.head, ox + hd[0], oy + bob + hd[1]);
  blit(f, still.float, ox, oy - (p.float || 0));
  f.keep = still.eye
    .map(([x, y]) => [x + ox + hd[0], y + oy + bob + hd[1]])
    .filter(([x, y]) => x >= 0 && y >= 0 && x < frame.w && y < frame.h)
    .map(([x, y]) => y * frame.w + x);
  return f;
}

// An animation's steps: each of `frames` held for as many steps as `counts` says (a drawn blow's
// wind-up lingering, the blow itself quick).
export const held = (frames, counts) => frames.flatMap((f, i) => Array(counts[i]).fill(f));

// ---------------------------------------------------------------------------------------------
// Frames: every pose is drawn in the rig's frame, the character's middle on its `anchor` column
// (its centre, unless the frame says otherwise), its feet on the last row. A drawn pose too wide or
// tall for it (`big`: a staff thrust far out) is drawn in the rig's bigFrame instead, kept in a
// sheet of its own (sheetPixels), so that the rest stay small.

export const anchorOf = (frame) => frame.anchor ?? frame.w / 2;
export const frameOf = (rig, p) => (p.big ? rig.bigFrame : rig.frame);

// ---------------------------------------------------------------------------------------------
// Drawn poses: a pose drawn whole on the hero's own palette (an ultimate's, the frames of a blow;
// assets/hero/<id>-<name>.json, in the rig's extraArt), set in the frame as it is: frame `p.frame`
// of it (if it holds several), its column `p.mid` on the frame's anchor column and its row
// `p.ground` (or else its lowest) on the frame's last row (`f.at`: where the drawing's corner
// landed). Its magic lives as the rig's own does; a rig may touch it up besides (rig.drawn: the
// Rune Lord kindles the orb drawn on his staff).

export function composeDrawn(art, p, frame) {
  const src = art.frames[p.frame || 0];
  let ground = p.ground;
  for (let y = src.h - 1; ground == null && y >= 0; y--) {
    for (let x = 0; x < src.w; x++) if (src.get(x, y) !== NONE) { ground = y; break; }
  }
  const f = new Img(frame.w, frame.h);
  f.at = [Math.round(anchorOf(frame) - p.mid), frame.h - 1 - ground];
  blit(f, src, ...f.at);
  return f;
}

// ---------------------------------------------------------------------------------------------
// sheets

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// `extras` holds the hero's other hand-drawn poses ({ kneel: json }), parsed for rig.prepare; a
// pose that names one of them (`drawn`) is that drawing, set in the frame (composeDrawn).
export function buildFrames(rig, json, extras = {}) {
  const art = parseArt(json);
  const more = Object.fromEntries(Object.entries(extras).map(([k, j]) => [k, parseArt(j)]));
  const ctx = rig.prepare(art, more);
  return {
    palette: art.palette,
    frames: rig.poses.map((p, i) => {
      const f = p.drawn ? composeDrawn(more[p.drawn], p, frameOf(rig, p)) : rig.compose(ctx, p);
      if (p.drawn) rig.drawn?.(ctx, f, p);
      const glow = energy(f, ctx.energy, p.light ?? 1, rig.seed + i * 7919);
      return { color: f, glow, big: !!p.big };
    }),
  };
}

// RGBA buffers for the sheet, frames laid out rig.cols across; the big ones (frameOf) in a sheet of
// their own, rig.bigCols across (`big`). `slots[i]`: where pose i is ({ big, k }: the k-th frame of
// its sheet); `tops[i]`: the highest row it draws on; `spans[i]`: the first and last columns.
export function sheetPixels(rig, json, extras = {}) {
  const { frames, palette } = buildFrames(rig, json, extras);
  const rgb = palette.map(hexRgb);
  const counts = [0, 0];
  const slots = frames.map((fr) => ({ big: fr.big, k: counts[fr.big ? 1 : 0]++ }));
  const lay = (frame, cols, count, big) => {
    const { w: FW, h: FH } = frame;
    const rows = Math.ceil(count / cols);
    const W = FW * cols;
    const H = FH * rows;
    const color = new Uint8ClampedArray(W * H * 4);
    const glow = new Uint8ClampedArray(W * H * 4);
    frames.forEach((fr, i) => {
      if (slots[i].big !== big) return;
      const ox = (slots[i].k % cols) * FW;
      const oy = Math.floor(slots[i].k / cols) * FH;
      for (let y = 0; y < FH; y++) {
        for (let x = 0; x < FW; x++) {
          const k = y * FW + x;
          const o = ((oy + y) * W + ox + x) * 4;
          const v = fr.color.c[k];
          if (v !== NONE) {
            const [r, g, b] = rgb[v];
            color[o] = r; color[o + 1] = g; color[o + 2] = b; color[o + 3] = 255;
          }
          const gv = fr.glow.c[k];
          if (gv > 0) {
            const [r, g, b] = rig.glowColors[gv - 1];
            glow[o] = r; glow[o + 1] = g; glow[o + 2] = b; glow[o + 3] = 255;
          }
        }
      }
    });
    return { width: W, height: H, color, glow, frameW: FW, frameH: FH, cols, rows };
  };
  const tops = [];
  const spans = frames.map(({ color: f }) => {
    let top = f.h;
    let lo = f.w;
    let hi = -1;
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        if (f.c[y * f.w + x] === NONE) continue;
        if (top === f.h) top = y;
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
    }
    tops.push(top);
    return [lo, hi];
  });
  // what glows in each frame, as it lights the world round it (npc.js): how much (each glowing
  // pixel counted by how bright its glow is), its middle in the frame, and its colour
  const glows = frames.map(({ glow: g }) => {
    let n = 0;
    let sx = 0;
    let sy = 0;
    const rgb = [0, 0, 0];
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const v = g.c[y * g.w + x];
        if (v <= 0) continue;
        const c = rig.glowColors[v - 1];
        const w = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
        n += w;
        sx += x * w;
        sy += y * w;
        for (let i = 0; i < 3; i++) rgb[i] += c[i] * w;
      }
    }
    return n > 0.5 ? { n, x: sx / n, y: sy / n, rgb: rgb.map((v) => v / n) } : null;
  });
  const base = lay(rig.frame, rig.cols, counts[0], false);
  const big = counts[1] ? lay(rig.bigFrame, rig.bigCols || Math.min(counts[1], 4), counts[1], true) : null;
  return { ...base, frameCount: frames.length, slots, tops, spans, big, glows };
}

// Browser: a hero's sheet as the NPC renderer understands it: its baked pictures, if there's a bake
// that's still its own (bake.js; one the public build made with this very code, `trusted`, isn't
// checked), else drawn now, in a worker if one can be had (compose-worker.js), else here.
export async function loadSheet(rig) {
  const px = (await bakedSheet(rig).catch(() => null)) || canvasesOf(await composedSheet(rig));
  return withAlpha({
    hero: rig.id,
    rig,
    color: px.color,
    glow: px.glow,
    frameW: rig.frame.w,
    frameH: rig.frame.h,
    cols: rig.cols,
    rows: px.rows,
    anchor: anchorOf(rig.frame),
    slots: px.slots,
    tops: px.tops,
    spans: px.spans,
    big: px.big && withAlpha({ ...px.big, anchor: anchorOf(rig.bigFrame) }, px.big.alpha),
    glows: px.glows,
    anims: rig.anims,
    px: rig.px,
    head: rig.head,
    hits: rig.hits,
    glowIntensity: rig.glowIntensity,
    lunge: rig.lunge,
    sounds: rig.sounds,
  }, px.alpha);
}

// A sheet's pixels (`alpha`: where each frame is drawn, for what's clicked or struck: npc.js), as
// they are, or (baked, `alpha` a function) read out of its picture the first time they're wanted,
// not as the game starts.
function withAlpha(sheet, alpha) {
  if (typeof alpha !== 'function') return Object.assign(sheet, { alpha });
  return Object.defineProperty(sheet, 'alpha', {
    configurable: true,
    enumerable: true,
    get() {
      const pixels = alpha();
      Object.defineProperty(this, 'alpha', { value: pixels, enumerable: true, writable: true });
      return pixels;
    },
  });
}

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
};
const fetchText = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
};

// Its baked sheet (scripts/bake-sheets.mjs), if it's still the one its art and code make: its
// pictures as canvases, and the colour sheet's pixels to be read when first wanted (`alpha`); null if
// it isn't (and none at all, a fetch failing: then it's drawn).
async function bakedSheet(rig) {
  const meta = await fetchJson(`${BAKED}${rig.id}.json`);
  if (!meta.trusted && meta.fingerprint !== (await fingerprint(rig, fetchText))) return null;
  const at = (name, pixels) => picture(`${BAKED}${rig.id}${name}.png`, pixels);
  const [color, glow, bigColor, bigGlow] = await Promise.all([at('', true), at('-glow'), meta.big && at('-big', true), meta.big && at('-big-glow')]);
  return {
    color: color.canvas,
    glow: glow.canvas,
    alpha: color.pixels,
    rows: meta.rows,
    slots: meta.slots,
    tops: meta.tops,
    spans: meta.spans,
    glows: meta.glows,
    big: meta.big && { ...meta.big, color: bigColor.canvas, glow: bigGlow.canvas, alpha: bigColor.pixels },
  };
}

// A baked picture, decoded off the page's thread, as a canvas (and how to read its pixels, if
// wanted), its colours exactly as baked: none premultiplied by alpha (its pixels are all opaque or
// all clear) or converted to a colour space.
async function picture(url, pixels = false) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const g = canvas.getContext('2d', pixels ? { willReadFrequently: true } : undefined);
  g.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return { canvas, pixels: pixels ? () => g.getImageData(0, 0, canvas.width, canvas.height).data : null };
}

// Drawn now: in a worker (off the page's thread, a few at once), or here if none can be had.
async function composedSheet(rig) {
  try {
    return await inWorker(rig);
  } catch {
    const json = await fetchJson(rig.art);
    const extras = {};
    for (const [k, url] of Object.entries(rig.extraArt || {})) extras[k] = await fetchJson(url);
    return sheetPixels(rig, json, extras);
  }
}

// Drawn pixels (sheetPixels) as the canvases a baked sheet comes as.
function canvasesOf(px) {
  const toCanvas = (data, { width, height }) => {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    c.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
    return c;
  };
  return {
    color: toCanvas(px.color, px),
    glow: toCanvas(px.glow, px),
    alpha: px.color,
    rows: px.rows,
    slots: px.slots,
    tops: px.tops,
    spans: px.spans,
    glows: px.glows,
    big: px.big && {
      color: toCanvas(px.big.color, px.big),
      glow: toCanvas(px.big.glow, px.big),
      alpha: px.big.color,
      frameW: px.big.frameW,
      frameH: px.big.frameH,
      cols: px.big.cols,
      rows: px.big.rows,
    },
  };
}

// The workers that draw sheets off the page's thread: as many as the machine has cores to spare (at
// most four), each drawing one sheet at a time; made when first wanted, let go once none has been
// wanted for a few seconds. One that fails (no module workers here, say) fails its sheet, which is
// then drawn on the page.
let pool = null;
function inWorker(rig) {
  if (typeof Worker === 'undefined' || !rig.src) return Promise.reject(new Error('no workers here'));
  pool ??= workerPool();
  return pool.run(rig);
}

function workerPool() {
  const size = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  const idle = [];
  const waiting = [];
  const running = new Map(); // job -> { worker, resolve, reject }
  let made = 0;
  let next = 0;
  let quiet = 0;
  const me = {
    run(rig) {
      return new Promise((resolve, reject) => {
        waiting.push({ job: next++, rig, resolve, reject });
        pump();
      });
    },
  };
  const make = () => {
    const worker = new Worker(new URL('./compose-worker.js', import.meta.url), { type: 'module' });
    made += 1;
    worker.onmessage = ({ data }) => {
      const r = running.get(data.job);
      running.delete(data.job);
      if (data.error) r?.reject(new Error(data.error));
      else r?.resolve(data.px);
      idle.push(worker);
      pump();
    };
    worker.onerror = (ev) => {
      ev.preventDefault?.();
      for (const [job, r] of running) if (r.worker === worker) { running.delete(job); r.reject(new Error(ev.message || 'worker failed')); }
      worker.terminate();
      made -= 1;
      pump();
    };
    return worker;
  };
  const pump = () => {
    while (waiting.length && (idle.length || made < size)) {
      let worker;
      try { worker = idle.pop() || make(); } catch (err) { for (const w of waiting.splice(0)) w.reject(err); break; }
      const { job, rig, resolve, reject } = waiting.shift();
      running.set(job, { worker, resolve, reject });
      worker.postMessage({ job, id: rig.id, src: rig.src });
    }
    clearTimeout(quiet);
    if (!waiting.length && !running.size) {
      quiet = setTimeout(() => {
        if (waiting.length || running.size) return;
        for (const w of idle.splice(0)) w.terminate();
        made = 0;
        if (pool === me) pool = null;
      }, 5000);
    }
  };
  return me;
}
