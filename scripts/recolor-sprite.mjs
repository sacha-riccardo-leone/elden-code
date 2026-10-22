// Puts a new sprite of a hero (e.g. a pose drawn by ChatGPT) back on that hero's own colours.
// Image generators drift: gold comes back yellow, wine red comes back bright red, grey goes cold,
// a navy robe comes back royal blue and dark wood comes back orange.
// Each material is matched separately against the hero's master art (the image its art grid,
// client/assets/hero/<hero>.json, was made from: beside the grid, or else found by its name anywhere in
// art/, where all the art lives), in CIELAB, where distances are roughly what the eye sees:
//   - pixels are sorted into materials: the dark outline, greys, then the colour families by hue;
//   - a pixel takes the master's lightness at its rank within its material, held near one straight
//     line through the two medians, so a part's tones land where the master has them while a robe's
//     highlight can't jump to a crystal of the same family; chroma and hue move by the material's
//     drift, measured per third of its lightness (shadows often drift more than lights);
//   - the pixel then takes the nearest colour of the hero's palette, of any material (a ramp can
//     straddle two: wood runs from red-brown to brown); a colour the hero rarely uses has to be a
//     little nearer;
//   - with --weapon, the weapon cut alone out of the master (as the art prompts attach it) says what
//     the weapon is drawn in; in the new image the weapon is found where those colours dominate, and
//     it is matched against the cut-out alone, which ChatGPT's drift for one small object needs: a
//     staff it lit in gold-trim tones gets back its own browns, while the real trim stays gold;
//   - a flat fallback background (white or black, or a painted grey-and-white checkerboard),
//     flooded in from the edges, becomes transparent, and so do enclosed pockets of the
//     checkerboard (between an arm and a staff);
//   - a --light band (a segment and a radius, in the new image's pixels) marks new light the hero
//     has no counterpart for, such as a blade of light: it keeps its own brightness and goes onto
//     the palette's brightest colours of its hue.
// Images are decoded with scripts/decode-image.ps1, so PNG and WebP both work. The result is
// written next to the input as <name>-recoloured.png, unless an output path is given.
//
//   node scripts/recolor-sprite.mjs <image> <hero> [out.png] [--weapon cut-out.png] [--light x1,y1,x2,y2,r ...]
//   e.g. node scripts/recolor-sprite.mjs art/heroes/Aurelion/ult-aurelion-1-raise.png paladin --light 38,432,944,168,42
//        node scripts/recolor-sprite.mjs art/heroes/Corisande/ult-corisande.png sorceress-masked --weapon art/heroes/Corisande/corisande-staff.png
//        node scripts/recolor-sprite.mjs art/bosses/Fenrath/boss-roar.png client/assets/boss/boss.json
//   heroes: knight, fortuna, ronin, bloodbender, runelord, paladin, bandit, champion, queen, sorceress-masked;
//   any other art grid (a boss's) goes by its path, its master art beside it

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, png, rgbAt, quantile, backgroundMask } from './image-io.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const heroDir = path.join(root, 'client', 'assets', 'hero');

function args() {
  const a = process.argv.slice(2);
  const rest = [];
  const light = [];
  let weapon = null;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--light') light.push(a[++i].split(',').map(Number));
    else if (a[i] === '--weapon') weapon = a[++i];
    else rest.push(a[i]);
  }
  const [input, hero, out] = rest;
  if (!input || !hero || light.some((l) => l.length !== 5 || l.some(Number.isNaN)) || weapon === undefined) {
    console.error('usage: node scripts/recolor-sprite.mjs <image> <hero> [out.png] [--weapon cut-out.png] [--light x1,y1,x2,y2,r ...]');
    process.exit(1);
  }
  return { input, hero, out: out || input.replace(/\.[^./\\]+$/, '') + '-recoloured.png', light, weapon };
}

const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
function hsv([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}

function material(rgb) {
  const [h, s, v] = hsv(rgb);
  if (v < 0.16) return 'dark';
  if (s < 0.2) return 'grey';
  if (h >= 330 || h < 15) return 'red';
  if (h < 70) return 'gold';
  if (h < 170) return 'green';
  if (h < 260) return 'blue';
  return 'violet';
}

// CIELAB (D65): lightness 0..100, and a plane of hue and chroma
function lab([r, g, b]) {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function inBands(bands, x, y) {
  return bands.some(([x1, y1, x2, y2, r]) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
    return (x1 + t * dx - x) ** 2 + (y1 + t * dy - y) ** 2 <= r * r;
  });
}

// share of a sorted list below v (ties count half), and the value at a given share
function rank(sorted, v) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < v) lo = m + 1; else hi = m; }
  let lo2 = lo;
  hi = sorted.length;
  while (lo2 < hi) { const m = (lo2 + hi) >> 1; if (sorted[m] <= v) lo2 = m + 1; else hi = m; }
  return (lo + lo2) / 2 / Math.max(1, sorted.length);
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// lightness (sorted), median chroma, and mean hue (weighted by chroma: greys have no hue to speak
// of) of a list of CIELAB colours
function describe(labs) {
  const L = labs.map((c) => c[0]).sort((a, b) => a - b);
  const C = labs.map((c) => Math.hypot(c[1], c[2])).sort((a, b) => a - b);
  let a = 0;
  let b = 0;
  for (const c of labs) { a += c[1]; b += c[2]; }
  return { L, C: quantile(C, 0.5), H: Math.atan2(b, a) };
}
// the hue turn from one description to another, only between colourful ones and never past 20°
const turnOf = (to, from) => (to.C >= 8 && from.C >= 8 ? clamp(Math.atan2(Math.sin(to.H - from.H), Math.cos(to.H - from.H)), -0.35, 0.35) : 0);

// nearest palette colour to a CIELAB colour, plus the colour's own handicap: a colour the hero
// rarely uses has to be a little nearer to win (between two browns about as near, the one the staff
// is mostly drawn in)
function nearest(list, [l, a, b]) {
  let best = list[0];
  let bd = Infinity;
  for (const p of list) {
    const d = Math.sqrt((p.lab[0] - l) ** 2 + (p.lab[1] - a) ** 2 + (p.lab[2] - b) ** 2) + p.rare;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
// a CIELAB colour with its lightness, chroma and hue moved
function moved([l, a, b], L, chroma, turn) {
  const C = Math.hypot(a, b) * chroma;
  const H = Math.atan2(b, a) + turn;
  return [L, C * Math.cos(H), C * Math.sin(H)];
}

const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
// nearest colour of a light band to a target brightness and hue, saturation aside (generated light
// runs white-hot); hue only counts for saturated colours
function nearestLight(list, targetL, targetH, ownS) {
  let best = list[0];
  let bd = Infinity;
  for (const p of list) {
    const d = Math.abs(p.L - targetL) + 0.6 * hueGap(targetH, p.h) * Math.min(ownS, p.s);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

const opts = args();
const gridFile = /\.json$/i.test(opts.hero) ? path.resolve(opts.hero) : path.join(heroDir, `${opts.hero}.json`);
const grid = JSON.parse(fs.readFileSync(gridFile, 'utf8'));
const palette = grid.palette.map((hx, n) => {
  const rgb = [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16));
  const [h, s] = hsv(rgb);
  return { n, rgb, h, s, L: lum(rgb), lab: lab(rgb), k: material(rgb), rare: 0 };
});
const img = decode(opts.input);

// how often the hero's art grid uses each colour, and the master art the grid was made from (its
// tones per material: the grid's palette reduction runs a little darker than what the eye judges by)
const uses = palette.map(() => 0);
for (const row of grid.rows) {
  for (const ch of row) {
    const n = grid.alphabet.indexOf(ch);
    if (n >= 0) uses[n]++;
  }
}
// the master art: beside its grid, or (moved out of client/assets with the rest of the art) under art/
function masterArt(name) {
  const beside = path.join(path.dirname(gridFile), name);
  if (fs.existsSync(beside)) return beside;
  const found = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
      else if (e.name === name) found.push(path.join(dir, e.name));
    }
  };
  if (fs.existsSync(path.join(root, 'art'))) walk(path.join(root, 'art'));
  if (!found.length) throw new Error(`${name}, the master art of ${gridFile}, is neither beside it nor in art/`);
  return found[0];
}
const master = decode(masterArt(grid.source.split(',')[0].trim()));
const masterBg = backgroundMask(master);
const tones = {};
for (let i = 0; i < master.w * master.h; i++) {
  if (masterBg[i]) continue;
  const c = rgbAt(master, i);
  (tones[material(c)] ||= []).push(lab(c));
}
const most = Math.max(...uses);
const handicapped = palette.map((p) => ({ ...p, rare: Number(process.env.RECOLOR_PRIOR ?? 2) * Math.log((most + 1) / (uses[p.n] + 1)) }));

// the new image: background, light, and each material's colours
const bg = backgroundMask(img);
const kind = new Array(img.w * img.h);
const labAt = new Array(img.w * img.h);
const lightCount = {};
const colours = {};
for (let i = 0; i < img.w * img.h; i++) {
  if (bg[i]) continue;
  const c = rgbAt(img, i);
  const x = i % img.w;
  const k = material(c);
  if (opts.light.length && inBands(opts.light, x, (i - x) / img.w)) {
    const [, s, v] = hsv(c);
    // the band's dark outline and any grey detail (a jewel) keep the normal mapping
    if (v >= 0.3 && !(s < 0.2 && v < 0.85)) {
      kind[i] = 'light';
      if (k !== 'grey' && k !== 'dark') lightCount[k] = (lightCount[k] || 0) + 1;
      continue;
    }
  }
  kind[i] = k;
  labAt[i] = lab(c);
  (colours[k] ||= []).push(labAt[i]);
}

// The drift of a set of colours (a material, or the weapon's) from the master's: a lightness line
// through the medians, sloped by the ratio of the quartile spreads, then a chroma factor and a hue
// turn for each third of the lightness. A third is kept within 15% and 8° of the whole, so a third
// that mixes two parts can't swing.
function fit(master, own) {
  const g = describe(master);
  const o = describe(own);
  const spread = (L) => quantile(L, 0.75) - quantile(L, 0.25);
  const slope = clamp(spread(g.L) / Math.max(1, spread(o.L)), 0.7, 1.4);
  const offset = quantile(g.L, 0.5) - slope * quantile(o.L, 0.5);
  const chroma = clamp(g.C / Math.max(1, o.C), 0.5, 2);
  const turn = turnOf(g, o);
  const cuts = [quantile(g.L, 1 / 3), quantile(g.L, 2 / 3)];
  const third = (L) => (L < cuts[0] ? 0 : L < cuts[1] ? 1 : 2);
  const masterThirds = [[], [], []];
  const ownThirds = [[], [], []];
  for (const c of master) masterThirds[third(c[0])].push(c);
  for (const c of own) ownThirds[third(slope * c[0] + offset)].push(c);
  const thirds = masterThirds.map((mc, t) => {
    if (mc.length < 20 || ownThirds[t].length < 50) return null;
    const mt = describe(mc);
    const ot = describe(ownThirds[t]);
    return { at: quantile(mt.L, 0.5), chroma: clamp(mt.C / Math.max(1, ot.C), chroma * 0.85, chroma * 1.15), turn: clamp(turnOf(mt, ot), turn - 0.14, turn + 0.14) };
  }).filter(Boolean);
  return { slope, offset, chroma, turn, thirds, masterL: g.L, ownL: o.L, masterC: g.C, ownC: o.C };
}
// A colour moved by a drift. Its lightness is the master's at the colour's rank, held within 6 of
// the straight line: one part's tones land where the master has them, but a robe's highlight can't
// reach a crystal's. Chroma and hue go by the thirds, eased between their middles.
function shift(d, c) {
  const line = d.slope * c[0] + d.offset;
  const L = clamp(quantile(d.masterL, rank(d.ownL, c[0])), line - 6, line + 6);
  let at = d;
  const t = d.thirds;
  if (t.length) {
    if (L <= t[0].at) at = t[0];
    else if (L >= t[t.length - 1].at) at = t[t.length - 1];
    else {
      const k = t.findIndex((x) => L < x.at);
      const f = (L - t[k - 1].at) / (t[k].at - t[k - 1].at);
      at = { chroma: t[k - 1].chroma + f * (t[k].chroma - t[k - 1].chroma), turn: t[k - 1].turn + f * (t[k].turn - t[k - 1].turn) };
    }
  }
  return moved(c, L, at.chroma, at.turn);
}
const deg = (v) => `${v >= 0 ? '+' : ''}${((v * 180) / Math.PI).toFixed(0)}°`;
const told = (name, d) => `${name}: L* quartiles master ${[0.25, 0.5, 0.75].map((q) => quantile(d.masterL, q).toFixed(0)).join('/')}, image ${[0.25, 0.5, 0.75].map((q) => quantile(d.ownL, q).toFixed(0)).join('/')}; chroma x${d.chroma.toFixed(2)}, hue ${deg(d.turn)}; thirds ${d.thirds.map((t) => `L*${t.at.toFixed(0)} x${t.chroma.toFixed(2)} ${deg(t.turn)}`).join(' | ')}`;

const drift = {};
for (const [k, list] of Object.entries(colours)) {
  if (!tones[k]) continue;
  drift[k] = fit(tones[k], list);
  if (process.env.RECOLOR_DEBUG) console.log(told(k, drift[k]));
}

// light goes onto the palette's brightest colours of its own hue, plus its near-white
const lightHue = Object.entries(lightCount).sort((a, b) => b[1] - a[1])[0]?.[0];
let lightRamp = palette.filter((p) => (p.k === lightHue && p.L >= 150) || (p.k === 'grey' && p.L >= 235));
if (!lightRamp.length) lightRamp = palette.filter((p) => p.L >= 200);

const pick = new Int16Array(img.w * img.h).fill(-1);
const used = {};
for (let i = 0; i < img.w * img.h; i++) {
  const k = kind[i];
  if (!k) continue;
  const d = drift[k];
  if (k === 'light') {
    // generated light runs hot: a step darker keeps a white core without washing the band out
    const c = rgbAt(img, i);
    const [h, s] = hsv(c);
    pick[i] = nearestLight(lightRamp, lum(c) - 20, h, s).n;
  } else if (d) {
    pick[i] = nearest(handicapped, shift(d, labAt[i])).n;
  } else {
    // a material the hero doesn't have: the nearest palette colour
    pick[i] = nearest(palette, labAt[i]).n;
  }
  used[k] = (used[k] || 0) + 1;
}

// --weapon: in the new image, the weapon is where the cut-out's colours dominate. How much of a
// colour's use on the hero is the weapon's: the cut-out counts master pixels and the grid counts
// cells, so the cell size from the grid's source line converts between them.
let weaponPixels = 0;
if (opts.weapon) {
  const cut = decode(opts.weapon);
  const cutUses = palette.map(() => 0);
  const cutPixels = [];
  for (let i = 0; i < cut.w * cut.h; i++) {
    if (cut.buf[i * 4 + 3] < 200) continue;
    const c = lab(rgbAt(cut, i));
    const p = nearest(palette, c);
    cutUses[p.n]++;
    cutPixels.push([c, p]);
  }
  const cutTotal = cutUses.reduce((a, b) => a + b, 0);
  const cellSize = /on its ([\d.]+) x ([\d.]+) px art grid/.exec(grid.source);
  const perCell = cellSize ? Number(cellSize[1]) * Number(cellSize[2]) : 1;
  // (a colour the weapon has under a fifth of, like a sliver of robe left on the cut-out, isn't its)
  const own = palette.map((p) => {
    const share = cutUses[p.n] >= cutTotal * 0.002 ? Math.min(1, cutUses[p.n] / perCell / Math.max(1, uses[p.n])) : 0;
    return share >= 0.2 ? share : 0;
  });
  // around each pixel, the weapon's share of its colours (outline and background don't vote)
  const w = img.w;
  const sumOwn = new Float64Array((w + 1) * (img.h + 1));
  const sumVotes = new Float64Array((w + 1) * (img.h + 1));
  const votes = (i) => pick[i] >= 0 && kind[i] !== 'light' && palette[pick[i]].k !== 'dark';
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const j = (y + 1) * (w + 1) + x + 1;
      sumOwn[j] = (votes(i) ? own[pick[i]] : 0) + sumOwn[j - 1] + sumOwn[j - w - 1] - sumOwn[j - w - 2];
      sumVotes[j] = (votes(i) ? 1 : 0) + sumVotes[j - 1] + sumVotes[j - w - 1] - sumVotes[j - w - 2];
    }
  }
  const r = Math.max(4, Math.round(Math.max(w, img.h) / 120));
  const share = (i) => {
    const x = i % w;
    const y = (i - x) / w;
    const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(w, x + r + 1), y1 = Math.min(img.h, y + r + 1);
    const box = (s) => s[y1 * (w + 1) + x1] - s[y0 * (w + 1) + x1] - s[y1 * (w + 1) + x0] + s[y0 * (w + 1) + x0];
    const n = box(sumVotes);
    return n ? box(sumOwn) / n : 0;
  };
  // weapon pixels: seeded where the share is clear, then grown through weapon colours while it
  // stays fair, so its highlights come along but a belt in the same browns stays out
  const group = (k) => (k === 'red' || k === 'gold' ? 'warm' : k === 'grey' ? 'grey' : k === 'dark' ? null : 'cool');
  const isWeapon = new Uint8Array(w * img.h);
  const candidate = (i) => votes(i) && own[pick[i]] > 0 && group(kind[i]);
  const stack = [];
  for (let i = 0; i < w * img.h; i++) if (candidate(i) && share(i) >= 0.45) { isWeapon[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= img.h) continue;
        const n = ny * w + nx;
        if (!isWeapon[n] && candidate(n) && share(n) >= 0.25) { isWeapon[n] = 1; stack.push(n); }
      }
    }
  }
  // what was found within the window's reach of each other is one part (a staff crossed by a dark
  // line). The weapon is the biggest part, any part at least a quarter its size (a shield beside a
  // spear), and the smaller parts lying within a quarter of its length (the stretch of a staff past
  // the hand holding it). Further off is a stray: a crown's glint in the crystal's whites, a sleeve's
  // trim, a belt in the staff's browns.
  const sumFound = new Float64Array((w + 1) * (img.h + 1));
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < w; x++) {
      const j = (y + 1) * (w + 1) + x + 1;
      sumFound[j] = isWeapon[y * w + x] + sumFound[j - 1] + sumFound[j - w - 1] - sumFound[j - w - 2];
    }
  }
  const reach = (i) => {
    const x = i % w;
    const y = (i - x) / w;
    const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(w, x + r + 1), y1 = Math.min(img.h, y + r + 1);
    return sumFound[y1 * (w + 1) + x1] - sumFound[y0 * (w + 1) + x1] - sumFound[y1 * (w + 1) + x0] + sumFound[y0 * (w + 1) + x0] > 0;
  };
  const part = new Int32Array(w * img.h).fill(-1);
  const parts = [];
  for (let s = 0; s < w * img.h; s++) {
    if (!isWeapon[s] || part[s] >= 0) continue;
    const members = [];
    const queue = [s];
    part[s] = parts.length;
    while (queue.length) {
      const i = queue.pop();
      if (isWeapon[i]) members.push(i);
      const x = i % w;
      const y = (i - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= img.h) continue;
        const n = ny * w + nx;
        if (part[n] < 0 && reach(n)) { part[n] = parts.length; queue.push(n); }
      }
    }
    parts.push(members);
  }
  const box = (m) => {
    let x0 = w, y0 = img.h, x1 = 0, y1 = 0;
    for (const i of m) { const x = i % w; const y = (i - x) / w; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return [x0, y0, x1, y1];
  };
  parts.sort((a, b) => b.length - a.length);
  const main = parts.length ? box(parts[0]) : null;
  const total = parts.reduce((a, m) => a + m.length, 0);
  const found = {};
  for (const members of parts) {
    const [x0, y0, x1, y1] = box(members);
    const gap = Math.hypot(Math.max(0, main[0] - x1, x0 - main[2]), Math.max(0, main[1] - y1, y0 - main[3]));
    const near = members.length >= total * 0.05 && gap <= Math.max(main[2] - main[0], main[3] - main[1]) / 4;
    members.kept = members.length >= parts[0].length / 4 || near;
    if (members.kept) for (const i of members) (found[group(kind[i])] ||= []).push(i);
  }
  if (process.env.RECOLOR_DEBUG) console.log(`weapon parts: ${parts.slice(0, 8).map((m) => `${m.length} at ${box(m).join(',')}${m.kept ? '' : ' (stray)'}`).join(' | ')}`);
  // small patches the weapon encloses join it: highlights ChatGPT drew in a colour the weapon
  // doesn't have (a staff's glints in trim gold). A patch counts when it is bounded mostly by the
  // weapon, the rest by outline; a hand runs on into the arm, and a gem elsewhere has no weapon round it.
  const inWeapon = new Uint8Array(w * img.h);
  let held = 0;
  for (const members of parts) if (members.kept) for (const i of members) { inWeapon[i] = 1; held++; }
  const other = (i) => !inWeapon[i] && pick[i] >= 0 && kind[i] !== 'light' && kind[i] !== 'dark' && group(kind[i]);
  const looked = new Uint8Array(w * img.h);
  let enclosed = 0;
  for (let s = 0; s < w * img.h; s++) {
    if (looked[s] || !other(s)) continue;
    const patch = [s];
    looked[s] = 1;
    let byWeapon = 0;
    let byElse = 0;
    for (let m = 0; m < patch.length; m++) {
      const x = patch[m] % w;
      const y = (patch[m] - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= img.h) continue;
        const n = ny * w + nx;
        if (other(n)) { if (!looked[n]) { looked[n] = 1; patch.push(n); } } else if (inWeapon[n]) byWeapon++; else byElse++;
      }
    }
    if (patch.length > Math.max(200, held * 0.05) || byWeapon < (byWeapon + byElse) * 0.5) continue;
    for (const i of patch) (found[group(kind[i])] ||= []).push(i);
    enclosed += patch.length;
  }
  if (process.env.RECOLOR_DEBUG) console.log(`weapon encloses ${enclosed} px more`);
  // per group of materials (warm, cool, grey), the cut-out's colours against the weapon's pixels
  for (const [gk, pixels] of Object.entries(found)) {
    const mine = palette.filter((p) => own[p.n] && group(p.k) === gk);
    if (!mine.length || pixels.length < 30) continue;
    const top = Math.max(...mine.map((p) => cutUses[p.n]));
    const choices = mine.map((p) => ({ ...p, rare: 2 * Math.log((top + 1) / (cutUses[p.n] + 1)) }));
    // against the cut-out's own pixels (not their palette colours, which are averages and a little
    // duller), as the new image's are
    // (a pixel none of the weapon's colours comes near, like the wood's grey shading beside a
    // crystal's whites, keeps its main mapping)
    const d = fit(cutPixels.filter(([, p]) => own[p.n] && group(p.k) === gk).map(([c]) => c), pixels.map((i) => labAt[i]));
    for (const i of pixels) {
      const t = shift(d, labAt[i]);
      const p = nearest(choices, t);
      if (Math.hypot(p.lab[0] - t[0], p.lab[1] - t[1], p.lab[2] - t[2]) > 20) continue;
      pick[i] = p.n;
      weaponPixels++;
    }
    if (process.env.RECOLOR_DEBUG) console.log(told(`weapon ${gk} (${pixels.length} px on ${mine.length} colours)`, d));
  }
}

const out = Buffer.alloc(img.w * img.h * 4);
for (let i = 0; i < img.w * img.h; i++) {
  if (pick[i] < 0) continue;
  const t = palette[pick[i]].rgb;
  out[i * 4] = t[0];
  out[i * 4 + 1] = t[1];
  out[i * 4 + 2] = t[2];
  out[i * 4 + 3] = 255;
}
fs.writeFileSync(opts.out, png(img.w, img.h, out));
console.log(`${opts.out}: ${img.w}x${img.h} on ${path.basename(gridFile, '.json')}'s ${palette.length} colours (pixels by material: ${Object.entries(used).map(([k, n]) => `${k} ${n}`).join(', ')}${opts.weapon ? `; weapon ${weaponPixels}` : ''})`);
