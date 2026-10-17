// Shared machinery for hand-drawn heroes. A hero's art is one pose on a palette-indexed pixel
// grid (assets/hero/*.json); a rig cuts it into parts and composes every animation frame by moving
// those parts on the integer grid, rotating held weapons RotSprite-style, and making the glowing
// magic (lightning, frost…) flicker and crackle. Plain data in, plain data out, so the same code
// runs in the browser and in scripts/build-hero-sheets.mjs.

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
  const ox = Math.round(frame.w / 2 - spec.mid);
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
// Drawn poses: a pose drawn whole on the hero's own palette (an ultimate's, the frames of a blow;
// assets/hero/<id>-<name>.json, in the rig's extraArt), set in the frame as it is: frame `p.frame`
// of it (if it holds several), its column `p.mid` on the frame's centre column and its row
// `p.ground` (or else its lowest) on the frame's last row. Its magic lives as the rig's own does.

export function composeDrawn(art, p, frame) {
  const src = art.frames[p.frame || 0];
  let ground = p.ground;
  for (let y = src.h - 1; ground == null && y >= 0; y--) {
    for (let x = 0; x < src.w; x++) if (src.get(x, y) !== NONE) { ground = y; break; }
  }
  const f = new Img(frame.w, frame.h);
  blit(f, src, Math.round(frame.w / 2 - p.mid), frame.h - 1 - ground);
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
      const f = p.drawn ? composeDrawn(more[p.drawn], p, rig.frame) : rig.compose(ctx, p);
      const glow = energy(f, ctx.energy, p.light ?? 1, rig.seed + i * 7919);
      return { color: f, glow };
    }),
  };
}

// RGBA buffers for the whole sheet, frames laid out rig.cols across.
export function sheetPixels(rig, json, extras = {}) {
  const { frames, palette } = buildFrames(rig, json, extras);
  const { w: FW, h: FH } = rig.frame;
  const W = FW * rig.cols;
  const H = FH * Math.ceil(frames.length / rig.cols);
  const color = new Uint8ClampedArray(W * H * 4);
  const glow = new Uint8ClampedArray(W * H * 4);
  const rgb = palette.map(hexRgb);
  frames.forEach((fr, i) => {
    const ox = (i % rig.cols) * FW;
    const oy = Math.floor(i / rig.cols) * FH;
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
  return { width: W, height: H, color, glow, frameCount: frames.length };
}

// Browser: fetch a hero's art and turn it into a sheet the NPC renderer understands.
export async function loadSheet(rig) {
  const fetchJson = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.json();
  };
  const json = await fetchJson(rig.art);
  const extras = {};
  for (const [k, url] of Object.entries(rig.extraArt || {})) extras[k] = await fetchJson(url);
  const px = sheetPixels(rig, json, extras);
  const toCanvas = (data) => {
    const c = document.createElement('canvas');
    c.width = px.width;
    c.height = px.height;
    c.getContext('2d').putImageData(new ImageData(data, px.width, px.height), 0, 0);
    return c;
  };
  return {
    hero: rig.id,
    rig,
    color: toCanvas(px.color),
    glow: toCanvas(px.glow),
    alpha: px.color,
    frameW: rig.frame.w,
    frameH: rig.frame.h,
    cols: rig.cols,
    rows: Math.ceil(px.frameCount / rig.cols),
    anims: rig.anims,
    px: rig.px,
    head: rig.head,
    hits: rig.hits,
    glowIntensity: rig.glowIntensity,
    lunge: rig.lunge,
  };
}
