// Procedural pixel-art characters built on one hand-drawn base body.
//
// The base is a bald 12x21 side-view figure (head, torso with coat / shirt / accent layers,
// arm, hands, two legs). Every Tarnished starts from exactly that silhouette, recoloured from
// its own dark palette; hair, helmets, hats, armour, cloaks and weapons are separate whole-pixel
// pieces layered on top, each with its own 1px outline, and they may stick out past the base.
// Each pose moves the template's parts (head, torso, arms, legs) on the integer grid, so nothing
// is ever drawn at a fractional pixel.

import { PixelGrid, makeCanvas, rng, hashStr, ramp, shade, mix } from './pixel.js';
import { PX } from './config.js';

export const FRAME = 32;
export const COLS = 8;
export const ROWS = 4;

const OUTLINE = '#0b090d';
const OX = 10; // where the base body's top-left sits inside a 32x32 frame
const OY = 11;

export const ANIMS = {
  idle: { frames: [0, 1], fps: 1.6 },
  walk: { frames: [2, 3, 4, 5], fps: 8 },
  hammer: { frames: [6, 7, 8, 8, 7], fps: 7 },
  read: { frames: [9, 9, 10], fps: 1.4 },
  cast: { frames: [11, 12, 13, 12], fps: 5 },
  send: { frames: [14, 14, 15, 15], fps: 2.5 },
  kneel: { frames: [16], fps: 1 },
  sit: { frames: [17], fps: 1 },
  doze: { frames: [17, 30], fps: 0.5 },
  bow: { frames: [18, 19, 19, 19, 19, 18], fps: 3, once: true },
  wave: { frames: [20, 21, 20, 21, 20, 21], fps: 5, once: true },
  point: { frames: [22, 22, 22, 22], fps: 2, once: true },
  cheer: { frames: [23, 24, 23, 24, 23, 24], fps: 5, once: true },
  pray: { frames: [25], fps: 1 },
  collapse: { frames: [26], fps: 1 },
  lifted: { frames: [27], fps: 1 },
  talk: { frames: [0, 28, 0, 28], fps: 2.5 },
  stagger: { frames: [29, 29, 0], fps: 3, once: true },
  kneelBow: { frames: [16, 31, 31, 31, 16], fps: 2, once: true },
};

// ---------------------------------------------------------------------------------------------
// The base body, facing right. Letters are shading roles, not colours:
//   a outline · c/d/b/l/f/e skin light→dark · i/j ear · h eye white · g pupil
//   n/o/s shirt light→dark · p/t/m coat light→dark · q/r accent · u/w trousers · z/y/x boots
const BASE = [
  '...aaaaa....',
  '..abdccba...',
  '.adbbbdcba..',
  '.abfbeeeea..',
  '.aijilhgla..',
  '..afllfflca.',
  '..mafleelbca',
  '.monafllfaa.',
  'mpoonaaaap..',
  'mpomonnqnom.',
  'mpomsonrnpm.',
  'afbasooqotm.',
  'afccaooqomca',
  'afbcasomomca',
  'abbbaoomomca',
  '.aaapssmsma.',
  '...mmmmmmm..',
  '..auuwwawa..',
  '..awuuuaua..',
  '..azzyyxaxa.',
  '..aaaaaaaaa.',
];

const ROLE = {
  a: ['out'],
  c: ['skin', 3], d: ['skin', 2], b: ['skin', 2], l: ['skin', 1], f: ['skin', 1], e: ['skin', 0],
  i: ['skin', 1], j: ['skin', 2],
  h: ['eyeW'], g: ['eyeD'],
  n: ['shirt', 3], o: ['shirt', 2], s: ['shirt', 1],
  p: ['coat', 2], t: ['coat', 1], m: ['coat', 0],
  q: ['accent', 2], r: ['accent', 1],
  u: ['pants', 1], w: ['pants', 2],
  z: ['boots', 1], y: ['boots', 2], x: ['boots', 3],
};

function partOf(c, r) {
  if (r >= 17) return c <= 7 ? 'legNear' : 'legFar';
  if (r <= 5) return 'head';
  if (r === 6) return c >= 3 ? 'head' : 'torso';
  if (r === 7) return c >= 4 ? 'head' : 'torso';
  if (r <= 10 && c <= 2) return 'arm';
  if (r >= 11 && r <= 15 && c <= 3) return 'arm';
  if (r >= 12 && r <= 14 && c >= 10) return 'hand';
  return 'torso';
}

const PARTS = (() => {
  const parts = { head: [], torso: [], arm: [], hand: [], legNear: [], legFar: [] };
  BASE.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      parts[partOf(c, r)].push([c, r, ROLE[ch]]);
    }
  });
  return parts;
})();

// ---------------------------------------------------------------------------------------------
// palettes

// (No generic sorcerer: the Bloodbender hero is the sorcerer now.)
export const ARCHETYPES = ['knight', 'ranger', 'pilgrim', 'vagabond', 'noble', 'monk', 'hunter'];
const ROBED = new Set(['sorcerer', 'pilgrim', 'monk']);
const CAPED = new Set(['knight', 'ranger', 'noble', 'vagabond']);

const ARMOR = {
  iron: ['#24252b', '#41434c', '#6a6e79', '#a1a6b0'],
  black: ['#151419', '#25242c', '#3a3944', '#5a5968'],
  bronze: ['#2b1f13', '#553d24', '#86663a', '#bd975a'],
  leather: ['#22170f', '#3d291a', '#5e412b', '#836247'],
  bone: ['#37322a', '#5b5447', '#898170', '#bab29f'],
  ash: ['#1c1a20', '#2f2c36', '#48444f', '#69646f'],
  cloth: ['#141318', '#22212a', '#34323e', '#4a4756'],
  fur: ['#241d18', '#3f362e', '#5e5246', '#80705f'],
};
const LINEN = ['#3e3a32', '#7a7262', '#a89f89', '#cbc3ad'];
const SKIN = [
  ['#3b2418', '#68412b', '#9a6845', '#c48f68'],
  ['#2a1a12', '#4f301f', '#7a4c31', '#a3714d'],
  ['#4a3226', '#7d5945', '#b08870', '#d8b296'],
  ['#363032', '#5c5456', '#887e80', '#b0a6a8'],
];
const HAIR = [
  ['#120d0b', '#2a1d16', '#45312a'],
  ['#1b1b20', '#383842', '#666674'],
  ['#2a190d', '#583819', '#8a5d2c'],
  ['#3e3e3e', '#7e7e7e', '#bdbdbd'],
  ['#4a4436', '#8f8670', '#cdc4ac'],
  ['#2a0f0f', '#5a2420', '#8a3e30'],
];
const METAL = ['#3a3d45', '#777c88', '#b6bbc5', '#e8ebf0'];
const WOOD = ['#1f150d', '#3a2717', '#5a3e25', '#7a5636'];
const GOLD = ['#5a4116', '#9c7631', '#d6b46e', '#f4e1a1'];
const PAGE = ['#8f8670', '#cfc4a6', '#ece3c8'];
const SHADOW_FACE = '#120d12';
const EYE_WHITE = '#cfc6b4';
const EYE_DARK = '#140e12';

export const MODEL_CREST = {
  opus: '#e0ac45',
  sonnet: '#c3ccd8',
  haiku: '#71b894',
  fable: '#a487de',
  other: '#b0443c',
};

const SPIRIT = ['#0d2440', '#1e4c7c', '#4e8fd0', '#b4e2ff'];

const WEAPON = {
  knight: 'sword', sorcerer: 'staff', ranger: 'bow', pilgrim: 'lantern',
  vagabond: 'axe', noble: 'rapier', monk: 'seal', hunter: 'torch',
};

export function makeLook(sid, project, model) {
  const r = rng(hashStr(`look:${sid}`));
  const cls = ARCHETYPES[hashStr(`cls:${sid}`) % ARCHETYPES.length];
  const hue = hashStr(`proj:${project || 'Unknown'}`) % 360;
  const cloth = ramp(hue, 0.42, 0.09, 0.44);
  const armorKey = {
    knight: r.pick(['iron', 'black', 'bronze', 'iron']),
    vagabond: r.pick(['fur', 'leather', 'fur']),
  }[cls];
  const beardChance = { vagabond: 0.85, sorcerer: 0.6, pilgrim: 0.3, noble: 0.25, hunter: 0.35 }[cls] || 0;
  const hairStyles = { vagabond: ['wild', 'wild', 'bald'], monk: ['bald'], knight: ['short'] }[cls] || ['short', 'long', 'tied', 'short', 'long', 'bald'];
  return {
    sid,
    cls,
    hue,
    cloth,
    armor: armorKey ? ARMOR[armorKey] : ARMOR.iron,
    skin: SKIN[r.pick([0, 1, 2, 0, 1, 2, 3])],
    hair: cls === 'sorcerer' && r.chance(0.6) ? HAIR[r.pick([3, 4])] : r.pick(HAIR),
    hairStyle: r.pick(hairStyles),
    beard: r.chance(beardChance) ? r.pick(['full', 'full', 'moustache']) : null,
    crest: MODEL_CREST[model] || MODEL_CREST.other,
    horns: r.chance(0.5),
    shield: r.chance(0.7),
    spirit: false,
  };
}

export function spiritLook() {
  return {
    sid: 'spirit', cls: 'monk', hue: 210, cloth: SPIRIT, armor: SPIRIT, skin: SPIRIT, hair: SPIRIT.slice(0, 3),
    hairStyle: 'bald', beard: null, crest: '#d8f2ff', horns: false, shield: false, spirit: true,
  };
}

function paletteFor(L) {
  const p = {
    hair: L.hair, skin: L.skin, hand: L.skin, shirt: ARMOR.cloth, coat: L.cloth, accent: GOLD,
    pants: ARMOR.cloth, boots: ARMOR.leather, sleeve: null,
  };
  if (L.spirit) return { ...p, shirt: SPIRIT, coat: SPIRIT, accent: SPIRIT, pants: SPIRIT, boots: SPIRIT, hand: SPIRIT };
  switch (L.cls) {
    case 'knight': return { ...p, coat: L.armor, shirt: L.armor, accent: L.cloth, hand: L.armor, pants: L.armor, boots: L.armor };
    case 'sorcerer': return { ...p, coat: L.cloth, shirt: ARMOR.black, accent: GOLD };
    case 'ranger': return { ...p, coat: ARMOR.leather, shirt: L.cloth, accent: ARMOR.leather, hand: ARMOR.leather };
    case 'pilgrim': return { ...p, coat: ARMOR.bone, shirt: ARMOR.ash, accent: L.cloth };
    case 'vagabond': return { ...p, coat: L.armor, shirt: L.skin, accent: L.skin, pants: ARMOR.leather, sleeve: L.skin };
    case 'noble': return { ...p, coat: L.cloth, shirt: LINEN, accent: GOLD };
    case 'monk': return { ...p, coat: ARMOR.ash, shirt: ARMOR.cloth, accent: L.cloth };
    case 'hunter': return { ...p, coat: L.cloth, shirt: LINEN, accent: ARMOR.cloth, hand: ARMOR.leather };
    default: return p;
  }
}

function roleColor(role, pal, part) {
  const [kind, k] = role;
  const limb = part === 'arm' || part === 'hand';
  switch (kind) {
    case 'out': return OUTLINE;
    case 'eyeW': return EYE_WHITE;
    case 'eyeD': return EYE_DARK;
    case 'skin': return (limb ? pal.hand : pal.skin)[k];
    case 'shirt': return (limb && pal.sleeve ? pal.sleeve : pal.shirt)[k];
    case 'coat': return (limb && pal.sleeve ? pal.sleeve : pal.coat)[k];
    case 'accent': return pal.accent[k];
    case 'pants': return pal.pants[k];
    case 'boots': return pal.boots[k];
    default: return OUTLINE;
  }
}

function stamp(g, part, pal, x, y, keep = null) {
  for (const [c, r, role] of PARTS[part]) {
    if (keep && !keep(c, r)) continue;
    g.set(x + c, y + r, roleColor(role, pal, part));
  }
}

// A layer drawn in base-body coordinates (offset into the frame), composited with its own outline.
class Piece {
  constructor(ox, oy) {
    this.g = new PixelGrid(FRAME, FRAME);
    this.ox = ox;
    this.oy = oy;
  }
  set(c, r, col) { this.g.set(this.ox + c, this.oy + r, col); }
  rect(c, r, w, h, col) { this.g.rect(this.ox + c, this.oy + r, w, h, col); }
  line(c0, r0, c1, r1, col, thick = 1) { this.g.line(this.ox + c0, this.oy + r0, this.ox + c1, this.oy + r1, col, thick); }
  // rows: [[r, c0, c1], ...] filled with a lit-from-the-top-left 4-step ramp
  shape(rows, R, { edgeLight = true } = {}) {
    rows.forEach(([r, c0, c1], i) => {
      for (let c = c0; c <= c1; c++) {
        let col = R[2];
        if (edgeLight && c === c0) col = R[3];
        if (c >= c1 - 1 && c1 - c0 > 2) col = R[1];
        if (i === 0 && c < c1 - 1) col = R[3];
        this.set(c, r, col);
      }
    });
  }
}

function put(g, piece, outline = true) {
  g.composite(piece.g, outline ? OUTLINE : null);
}

// ---------------------------------------------------------------------------------------------
// poses: hand positions are the top-left of the 3x3 hand, relative to the shoulder.
// 'T' keeps the base drawing's own arm.

const POSES = [
  /* 0 idle0 */ { front: 'T', back: 'T', prop: 'weapon' },
  /* 1 idle1 */ { dy: 1, front: 'T', back: 'T', prop: 'weapon', sway: 1 },
  /* 2 walk0 */ { legs: ['walk', 0], dy: 1, front: [3, 4], back: 'T', prop: 'weapon', sway: -1 },
  /* 3 walk1 */ { legs: ['walk', 1], front: 'T', back: 'T', prop: 'weapon' },
  /* 4 walk2 */ { legs: ['walk', 2], dy: 1, front: [-2, 4], back: 'T', prop: 'weapon', sway: -1 },
  /* 5 walk3 */ { legs: ['walk', 3], front: 'T', back: 'T', prop: 'weapon' },
  /* 6 hammer0 */ { front: [0, -9], back: 'T', prop: 'hammer' },
  /* 7 hammer1 */ { front: [6, -5], back: 'T', prop: 'hammer', lean: 1 },
  /* 8 hammer2 */ { front: [8, 2], back: 'T', prop: 'hammer', lean: 2, dy: 1 },
  /* 9 read0 */ { front: [4, 1], back: [-3, 1], prop: 'book', headDy: 1 },
  /* 10 read1 */ { front: [4, 1], back: [-3, 1], prop: 'book', bookFlip: true, headDy: 1 },
  /* 11 cast0 */ { front: [7, 0], back: [2, 0], prop: 'focus', glow: 1 },
  /* 12 cast1 */ { front: [6, -6], back: [1, -6], prop: 'focus', glow: 1 },
  /* 13 cast2 */ { front: [4, -10], back: [0, -10], prop: 'focus', glow: 2, sway: 1 },
  /* 14 send0 */ { front: [2, -10], back: 'T', prop: 'none' },
  /* 15 send1 */ { front: [8, -7], back: 'T', prop: 'none', lean: 1 },
  /* 16 kneel */ { legs: 'kneel', dy: 2, front: [8, 2], back: 'T', prop: 'planted', headDy: 1 },
  /* 17 sit */ { legs: 'sit', dy: 3, front: [5, 3], back: [0, 3], prop: 'none' },
  /* 18 bow0 */ { lean: 1, headDy: 1, front: [4, 1], back: 'T', prop: 'weapon' },
  /* 19 bow1 */ { lean: 2, headDy: 2, dy: 1, front: [4, 1], back: 'T', prop: 'weapon' },
  /* 20 wave0 */ { front: [5, -9], back: 'T', prop: 'none' },
  /* 21 wave1 */ { front: [8, -7], back: 'T', prop: 'none' },
  /* 22 point */ { front: [9, -1], back: 'T', prop: 'none', lean: 1 },
  /* 23 cheer0 */ { front: [4, -8], back: [-2, -8], prop: 'none' },
  /* 24 cheer1 */ { front: [2, -11], back: [0, -11], prop: 'none' },
  /* 25 pray */ { front: [5, 0], back: [-2, 0], prop: 'none', headDy: 1 },
  /* 26 collapse */ { legs: 'kneel', dy: 3, lean: 2, headDy: 2, front: [4, 5], back: [0, 5], prop: 'dropped' },
  /* 27 lifted */ { legs: 'dangle', front: [2, -11], back: [0, -11], prop: 'none', sway: -1 },
  /* 28 talk */ { front: [7, -1], back: 'T', prop: 'none' },
  /* 29 stagger */ { lean: -2, front: [-3, 3], back: [2, 2], prop: 'weapon', sway: 1 },
  /* 30 doze */ { legs: 'sit', dy: 3, headDy: 2, front: [5, 3], back: [0, 3], prop: 'none' },
  /* 31 kneelBow */ { legs: 'kneel', dy: 3, lean: 2, headDy: 2, front: [8, 2], back: 'T', prop: 'planted' },
];

// ---------------------------------------------------------------------------------------------
// back layer: cloak, shield slung on the back, long hair, standing collar

function backLayer(g, L, pal, P, T, H) {
  if (CAPED.has(L.cls)) {
    const R = L.cls === 'vagabond' ? ARMOR.fur : L.cloth;
    const p = new Piece(T.x, T.y);
    const sway = P.sway || 0;
    const low = P.legs === 'sit' || P.legs === 'kneel';
    const bottom = L.cls === 'noble' ? 15 : low ? 20 - (P.dy || 0) : 19;
    for (let r = 8; r <= bottom; r++) {
      const t = (r - 8) / Math.max(1, bottom - 8);
      const c0 = Math.round(-1 - t * 2.5 - sway * t);
      const c1 = Math.round(5 - t * 1.5);
      for (let c = c0; c <= c1; c++) p.set(c, r, c === c0 ? R[2] : c >= c1 - 1 ? R[0] : R[1]);
    }
    if (L.cls === 'vagabond') for (let c = -5; c < 6; c += 2) p.g.clear(T.x + c, T.y + bottom);
    put(g, p);
  }
  if (L.cls === 'knight' && L.shield) {
    const p = new Piece(T.x, T.y);
    const C = L.cloth;
    const rows = [[8, -3, 1], [9, -3, 1], [10, -3, 1], [11, -3, 1], [12, -2, 0], [13, -2, 0], [14, -1, -1]];
    rows.forEach(([r, c0, c1]) => { for (let c = c0; c <= c1; c++) p.set(c, r, c === c0 || r === 8 ? GOLD[1] : C[2]); });
    p.set(-1, 10, GOLD[2]);
    p.set(-1, 11, GOLD[2]);
    put(g, p);
  }
  if (L.hairStyle === 'long' && !['knight', 'monk', 'ranger'].includes(L.cls)) {
    const p = new Piece(H.x, H.y);
    p.rect(0, 3, 3, 7, pal.hair[1]);
    p.rect(0, 3, 1, 7, pal.hair[0]);
    p.set(1, 3, pal.hair[2]);
    put(g, p);
  }
  if (L.hairStyle === 'tied' && !['knight', 'monk', 'ranger'].includes(L.cls)) {
    const p = new Piece(H.x, H.y);
    p.line(1, 3, -1, 8, pal.hair[1], 2);
    p.set(0, 4, GOLD[1]);
    put(g, p);
  }
  if (L.cls === 'hunter') {
    const p = new Piece(T.x, T.y);
    p.rect(0, 3, 3, 6, L.cloth[1]);
    p.rect(0, 3, 1, 6, L.cloth[2]);
    put(g, p);
  }
}

// ---------------------------------------------------------------------------------------------
// legs

function legsLayer(g, L, pal, P) {
  const legs = P.legs || 'stand';
  const dy = P.dy || 0;
  if (ROBED.has(L.cls)) return;
  if (legs === 'kneel') {
    const hip = OY + 17 + dy;
    const far = new Piece(OX, 0);
    far.rect(1, 30, 3, 2, pal.pants[1]);
    far.rect(-1, 31, 2, 1, pal.boots[1]);
    put(g, far);
    const near = new Piece(OX, 0);
    near.rect(3, hip - 1, 7, 2, pal.pants[2]);
    near.rect(3, hip - 1, 7, 1, pal.pants[3]);
    near.rect(8, hip, 2, 31 - hip, pal.pants[1]);
    near.rect(8, 31, 4, 1, pal.boots[2]);
    put(g, near);
    return;
  }
  if (legs === 'sit') {
    const near = new Piece(OX, 0);
    near.rect(4, 30, 7, 2, pal.pants[2]);
    near.rect(4, 30, 7, 1, pal.pants[3]);
    near.rect(11, 28, 2, 4, pal.boots[2]);
    near.set(11, 28, pal.boots[3]);
    const far = new Piece(OX, 0);
    far.rect(9, 29, 2, 2, pal.boots[1]);
    put(g, far);
    put(g, near);
    return;
  }
  let a = [0, 0];
  let b = [0, 0];
  if (Array.isArray(legs)) {
    a = [[-1, 0], [0, 0], [1, 0], [0, -1]][legs[1]];
    b = [[1, 0], [0, -1], [-1, 0], [0, 0]][legs[1]];
  } else if (legs === 'dangle') {
    a = [0, 1];
    b = [0, 0];
  }
  stamp(g, 'legFar', pal, OX + b[0], OY + b[1]);
  stamp(g, 'legNear', pal, OX + a[0], OY + a[1]);
}

function robeLayer(g, L, pal, P, T) {
  if (!ROBED.has(L.cls)) return;
  const legs = P.legs || 'stand';
  const R = pal.coat;
  const p = new Piece(OX, 0);
  const sway = Array.isArray(legs) ? [-1, 0, 1, 0][legs[1]] : (P.sway || 0) > 0 ? 1 : 0;
  const pooled = legs === 'kneel' || legs === 'sit';
  const top = T.y - OY + 14;
  const bottom = pooled ? 20 : 18;
  for (let r = top; r <= bottom; r++) {
    const t = (r - top) / Math.max(1, bottom - top);
    const c0 = Math.round(3 - t * 2 + (pooled ? 0 : sway * t));
    const c1 = Math.round(10 + t * (pooled ? 3 : 1) + (pooled ? 0 : sway * t));
    for (let c = c0; c <= c1; c++) {
      let col = (c + r) % 4 === 0 ? R[1] : R[2];
      if (c === c0) col = R[3];
      if (c >= c1 - 1) col = R[1];
      p.set(c, OY + r, col);
    }
  }
  if (L.cls === 'sorcerer') for (let r = top; r <= bottom; r++) p.set(8, OY + r, GOLD[1]);
  if (L.cls === 'pilgrim') for (let r = top; r <= bottom - 1; r++) { p.set(7, OY + r, L.cloth[2]); p.set(8, OY + r, L.cloth[1]); }
  if (L.cls === 'monk') for (let c = 3; c <= 10; c++) p.set(c, OY + bottom, R[0]);
  put(g, p);
  if (!pooled) {
    const shoes = new Piece(OX, OY);
    const ft = Array.isArray(legs) ? legs[1] : -1;
    const n = ft === 0 ? 2 : ft === 2 ? 4 : 3;
    const f = ft === 0 ? 9 : ft === 2 ? 7 : 8;
    shoes.rect(n, 19, 3, 1, pal.boots[2]);
    shoes.rect(f, 19, 2, 1, pal.boots[1]);
    put(g, shoes);
  }
}

// ---------------------------------------------------------------------------------------------
// torso paint and shoulder pieces

function torsoLayer(g, L, pal, P, T) {
  stamp(g, 'torso', pal, T.x, T.y);
  const p = new Piece(T.x, T.y);
  switch (L.cls) {
    case 'knight':
      for (let r = 9; r <= 15; r++) p.set(7, r, r === 9 ? L.cloth[3] : L.cloth[2]);
      for (let c = 4; c <= 9; c++) p.set(c, 16, ARMOR.leather[1]);
      p.set(7, 16, GOLD[2]);
      break;
    case 'sorcerer':
      for (let c = 4; c <= 9; c++) p.set(c, 13, GOLD[0]);
      break;
    case 'ranger':
      p.line(4, 9, 9, 14, ARMOR.leather[0]);
      p.set(7, 16, GOLD[1]);
      break;
    case 'noble':
      for (const r of [10, 12, 14]) p.set(9, r, GOLD[3]);
      break;
    case 'monk':
      for (const [c, r] of [[5, 9], [6, 10], [7, 11], [8, 10], [9, 9]]) p.set(c, r, GOLD[1]);
      for (let c = 4; c <= 9; c++) p.set(c, 14, L.cloth[2]);
      break;
    case 'hunter':
      for (let c = 4; c <= 9; c++) p.set(c, 15, ARMOR.leather[0]);
      p.set(7, 15, GOLD[2]);
      break;
    default:
      break;
  }
  g.composite(p.g, null);
}

function shoulderLayer(g, L, pal, P, T) {
  const p = new Piece(T.x, T.y);
  switch (L.cls) {
    case 'knight':
      p.shape([[7, 0, 2], [8, -1, 3], [9, -1, 3]], L.armor);
      put(g, p);
      break;
    case 'ranger':
      p.shape([[7, 0, 3], [8, -1, 10], [9, -1, 2], [9, 9, 10]], L.cloth);
      put(g, p);
      break;
    case 'vagabond': {
      const F = ARMOR.fur;
      for (let c = -2; c <= 11; c++) {
        p.set(c, 8, c < 1 ? F[3] : F[2]);
        if (c % 2 === 0) p.set(c, 9, F[1]);
      }
      for (let c = -1; c <= 3; c++) p.set(c, 7, F[2]);
      put(g, p);
      break;
    }
    case 'noble':
      p.shape([[7, 4, 10], [8, 5, 9]], LINEN);
      put(g, p);
      break;
    case 'hunter': {
      const tails = new Piece(T.x, T.y);
      if (P.legs !== 'sit' && P.legs !== 'kneel') {
        const sway = P.sway || 0;
        for (let r = 16; r <= 18; r++) {
          for (let c = 2 - (r - 16) - (sway < 0 ? 1 : 0); c <= 9; c++) {
            if (r > 16 && c >= 6 && c <= 7) continue;
            tails.set(c, r, c < 3 ? L.cloth[2] : L.cloth[1]);
          }
        }
        put(g, tails);
      }
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------------------------------------
// heads: the bald base head, then hair or headgear

const FULL_COVER = new Set(['knight', 'monk']);
const BRIMMED = new Set(['sorcerer', 'pilgrim', 'noble', 'hunter']);

function headLayer(g, glow, L, pal, H) {
  if (FULL_COVER.has(L.cls)) {
    if (L.cls === 'knight') greatHelm(g, glow, L, H);
    else cowl(g, glow, L, H);
    return;
  }
  if (L.cls === 'ranger') {
    stamp(g, 'head', pal, H.x, H.y, (c, r) => r >= 3 && c >= 4);
    hood(g, L, H);
    return;
  }
  stamp(g, 'head', pal, H.x, H.y, BRIMMED.has(L.cls) ? (c, r) => r >= 2 : null);
  if (L.beard) beard(g, L, pal, H);
  if (BRIMMED.has(L.cls)) {
    if (L.hairStyle !== 'bald') {
      const p = new Piece(H.x, H.y);
      p.rect(1, 2, 3, 2, pal.hair[1]);
      p.set(1, 4, pal.hair[0]);
      put(g, p);
    }
    if (L.cls === 'sorcerer') wizardHat(g, L, H);
    if (L.cls === 'pilgrim') wideBrim(g, L, H);
    if (L.cls === 'noble') tricorn(g, L, H);
    if (L.cls === 'hunter') capotain(g, L, H);
    return;
  }
  if (L.hairStyle !== 'bald') hair(g, L, pal, H, L.hairStyle === 'wild');
  if (L.cls === 'vagabond') {
    const p = new Piece(H.x, H.y);
    for (let c = 2; c <= 8; c++) p.set(c, 2, L.crest);
    p.set(2, 2, shade(L.crest, -0.3));
    g.composite(p.g, null);
    if (L.horns) {
      const h = new Piece(H.x, H.y);
      [[2, 0], [1, -1], [1, -2], [2, -3]].forEach(([c, r]) => h.set(c, r, ARMOR.bone[3]));
      [[8, 0], [9, -1], [9, -2], [8, -3]].forEach(([c, r]) => h.set(c, r, ARMOR.bone[2]));
      put(g, h);
    }
  }
}

function hair(g, L, pal, H, wild) {
  const R = pal.hair;
  const p = new Piece(H.x, H.y);
  const rows = [[-1, 3, 7], [0, 2, 8], [1, 1, 8], [2, 1, 5], [3, 1, 3], [4, 1, 1]];
  rows.forEach(([r, c0, c1]) => {
    for (let c = c0; c <= c1; c++) p.set(c, r, r <= 0 && c < 6 ? R[2] : c === c1 && r > 0 ? R[0] : R[1]);
  });
  p.set(8, 2, R[1]);
  if (wild) [[2, -2], [4, -2], [6, -2], [0, 0], [0, 2], [-1, 3]].forEach(([c, r]) => p.set(c, r, R[1]));
  put(g, p);
}

function beard(g, L, pal, H) {
  const R = pal.hair;
  const p = new Piece(H.x, H.y);
  if (L.beard === 'moustache') {
    for (let c = 7; c <= 9; c++) p.set(c, 5, R[1]);
    p.set(9, 6, R[0]);
  } else {
    const rows = [[5, 7, 9], [6, 4, 10], [7, 5, 10], [8, 6, 10], [9, 7, 9]];
    rows.forEach(([r, c0, c1]) => { for (let c = c0; c <= c1; c++) p.set(c, r, r === 5 ? R[2] : c === c1 ? R[0] : R[1]); });
  }
  put(g, p);
}

function greatHelm(g, glow, L, H) {
  const A = L.armor;
  const p = new Piece(H.x, H.y);
  p.shape([[-1, 3, 7], [0, 2, 8], [1, 1, 9], [2, 1, 10], [3, 1, 11], [4, 1, 11], [5, 1, 11], [6, 1, 10], [7, 2, 10]], A);
  for (let r = -1; r <= 7; r++) p.set(5, r, r < 2 ? A[3] : A[2]);
  for (let c = 6; c <= 11; c++) p.set(c, 4, '#07060a');
  p.set(9, 6, '#07060a');
  p.set(10, 6, '#07060a');
  p.set(8, 4, shade(L.crest, 0.2));
  glow.set(H.x + 8, H.y + 4, shade(L.crest, 0.2));
  put(g, p);
  const plume = new Piece(H.x, H.y);
  [[5, -2], [4, -3], [3, -3], [2, -3], [1, -2], [0, -1], [-1, 0], [-1, 1], [-2, 2], [-2, 3]].forEach(([c, r], i) => {
    plume.set(c, r, i < 3 ? shade(L.crest, 0.25) : L.crest);
    plume.set(c, r + 1, shade(L.crest, -0.3));
  });
  put(g, plume);
}

function cowl(g, glow, L, H) {
  const C = L.cloth;
  const p = new Piece(H.x, H.y);
  p.shape([[-2, 3, 6], [-1, 2, 8], [0, 1, 9], [1, 0, 10], [2, 0, 10], [3, 0, 10], [4, 0, 10], [5, 0, 10], [6, 0, 10], [7, 0, 10], [8, 0, 10], [9, 1, 9]], C);
  [[-1, 1], [-1, 2], [-2, 2]].forEach(([c, r]) => p.set(c, r, C[1]));
  for (let r = 3; r <= 8; r++) for (let c = 5; c <= 10; c++) p.set(c, r, SHADOW_FACE);
  for (let r = 3; r <= 8; r++) p.set(4, r, C[3]);
  for (let c = 5; c <= 10; c++) p.set(c, 2, C[3]);
  p.set(8, 4, L.crest);
  p.set(6, 4, shade(L.crest, -0.55));
  glow.set(H.x + 8, H.y + 4, L.crest);
  put(g, p);
}

function hood(g, L, H) {
  const C = L.cloth;
  const p = new Piece(H.x, H.y);
  const open = (c, r) => c >= 5 && r >= 3 && r <= 8;
  const rows = [[-1, 2, 7], [0, 1, 8], [1, 0, 9], [2, 0, 9], [3, 0, 9], [4, 0, 9], [5, 0, 9], [6, 0, 9], [7, 0, 9], [8, 0, 9]];
  rows.forEach(([r, c0, c1]) => {
    for (let c = c0; c <= c1; c++) if (!open(c, r)) p.set(c, r, c === c0 ? C[1] : r <= 0 ? C[3] : C[2]);
  });
  for (let r = 3; r <= 8; r++) p.set(4, r, C[3]);
  p.set(-1, 1, C[1]);
  p.set(-1, 2, C[1]);
  put(g, p);
  const mask = new Piece(H.x, H.y);
  mask.rect(5, 5, 7, 2, '#231f26');
  mask.rect(5, 5, 7, 1, '#2f2a33');
  put(g, mask);
}

function wizardHat(g, L, H) {
  const C = L.cloth;
  const p = new Piece(H.x, H.y);
  const cone = [[-8, 1, 1], [-7, 2, 3], [-6, 3, 4], [-5, 4, 5], [-4, 4, 6], [-3, 4, 7], [-2, 3, 7], [-1, 3, 8]];
  cone.forEach(([r, c0, c1]) => { for (let c = c0; c <= c1; c++) p.set(c, r, c === c0 ? C[3] : c === c1 ? C[1] : C[2]); });
  for (let c = 2; c <= 9; c++) p.set(c, 0, c === 2 ? shade(L.crest, -0.3) : L.crest);
  for (let c = -1; c <= 12; c++) p.set(c, 1, c < 2 ? C[2] : C[1]);
  put(g, p);
}

function wideBrim(g, L, H) {
  const B = ARMOR.leather;
  const p = new Piece(H.x, H.y);
  p.shape([[-3, 3, 6], [-2, 2, 7], [-1, 2, 7]], B);
  for (let c = 2; c <= 7; c++) p.set(c, 0, L.cloth[2]);
  for (let c = -2; c <= 11; c++) p.set(c, 1, c < 1 ? B[2] : B[1]);
  put(g, p);
  const f = new Piece(H.x, H.y);
  [[1, -1], [0, -2], [-1, -3]].forEach(([c, r], i) => f.set(c, r, i === 2 ? shade(L.crest, 0.3) : L.crest));
  put(g, f);
}

function tricorn(g, L, H) {
  const B = ARMOR.cloth;
  const p = new Piece(H.x, H.y);
  p.shape([[-2, 3, 6], [-1, 2, 7], [0, 1, 8]], B);
  for (let c = -1; c <= 11; c++) p.set(c, 1, GOLD[1]);
  [[-1, 0], [-2, -1], [11, 0], [12, -1]].forEach(([c, r]) => p.set(c, r, B[2]));
  put(g, p);
  const plume = new Piece(H.x, H.y);
  [[4, -3], [3, -4], [2, -4], [1, -3], [0, -2]].forEach(([c, r]) => plume.set(c, r, L.crest));
  plume.set(-1, -1, shade(L.crest, -0.3));
  put(g, plume);
}

function capotain(g, L, H) {
  const B = ARMOR.cloth;
  const p = new Piece(H.x, H.y);
  p.shape([[-7, 3, 7], [-6, 2, 8], [-5, 2, 8], [-4, 2, 8], [-3, 2, 8], [-2, 2, 8], [-1, 2, 8], [0, 2, 8]], B);
  for (let c = 2; c <= 8; c++) p.set(c, -1, '#0d0c10');
  p.set(5, -1, GOLD[2]);
  p.set(6, -1, GOLD[2]);
  for (let c = -2; c <= 11; c++) p.set(c, 1, c < 1 ? B[2] : B[1]);
  put(g, p);
}

// ---------------------------------------------------------------------------------------------
// arms and props

function frontArm(g, L, pal, P, T, hand) {
  if (P.front === 'T') {
    stamp(g, 'arm', pal, T.x, T.y);
    return;
  }
  const sleeve = pal.sleeve || pal.coat;
  const p = new Piece(0, 0);
  const sx = T.x + 1;
  const sy = T.y + 8;
  p.line(sx, sy, hand[0] + 1, hand[1], sleeve[1], 3);
  p.line(sx, sy, hand[0] + 1, hand[1], sleeve[2], 1);
  p.rect(hand[0], hand[1], 3, 3, pal.hand[2]);
  p.set(hand[0], hand[1], pal.hand[3]);
  p.set(hand[0] + 2, hand[1] + 2, pal.hand[1]);
  put(g, p);
}

function backArm(g, L, pal, P, T, hand) {
  if (P.back === 'T') return;
  const sleeve = pal.sleeve || pal.coat;
  const p = new Piece(0, 0);
  p.line(T.x + 9, T.y + 8, hand[0], hand[1], sleeve[0], 2);
  p.line(T.x + 9, T.y + 8, hand[0], hand[1], sleeve[1], 1);
  p.rect(hand[0], hand[1], 2, 2, pal.hand[1]);
  p.set(hand[0], hand[1], pal.hand[2]);
  put(g, p);
}

function weapon(g, glow, L, hand, kind) {
  const [hx, hy] = hand;
  const p = new Piece(0, 0);
  switch (kind) {
    case 'sword':
      p.set(hx + 1, hy - 1, WOOD[1]);
      p.rect(hx - 1, hy + 3, 5, 1, GOLD[1]);
      p.line(hx + 1, hy + 4, hx + 1, hy + 11, METAL[2]);
      p.line(hx + 2, hy + 4, hx + 2, hy + 10, METAL[3]);
      break;
    case 'rapier':
      p.rect(hx, hy + 3, 3, 1, GOLD[2]);
      p.line(hx + 1, hy + 4, hx + 4, hy + 12, METAL[3]);
      break;
    case 'axe':
      p.line(hx + 1, hy - 6, hx + 1, hy + 6, WOOD[2]);
      p.rect(hx + 2, hy - 7, 3, 4, METAL[1]);
      p.rect(hx + 4, hy - 8, 1, 6, METAL[2]);
      p.set(hx + 5, hy - 7, METAL[3]);
      break;
    case 'bow':
      for (let j = -7; j <= 7; j++) p.set(hx + 3 + Math.round(2 * Math.cos((j / 7) * 1.57)), hy + 1 + j, j === 0 ? WOOD[3] : WOOD[2]);
      p.line(hx + 3, hy - 6, hx + 3, hy + 8, '#9a927e');
      break;
    case 'staff':
      p.line(hx + 1, hy - 9, hx + 1, hy + 9, WOOD[2]);
      p.rect(hx, hy - 12, 3, 3, '#7fc8ff');
      glow.rect(hx, hy - 12, 3, 3, '#9fd8ff');
      glow.set(hx + 1, hy - 11, '#e8f7ff');
      break;
    case 'lantern':
      p.line(hx + 1, hy + 3, hx + 1, hy + 4, METAL[1]);
      p.rect(hx, hy + 5, 3, 4, GOLD[1]);
      p.rect(hx + 1, hy + 6, 1, 2, '#ffcf6b');
      glow.rect(hx + 1, hy + 6, 1, 2, '#ffb347');
      break;
    case 'torch':
      p.line(hx + 1, hy - 4, hx + 1, hy + 5, WOOD[2]);
      p.rect(hx, hy - 7, 3, 3, '#ff9a3a');
      p.set(hx + 1, hy - 8, '#ffd27a');
      glow.rect(hx, hy - 7, 3, 3, '#ff8a2a');
      glow.set(hx + 1, hy - 8, '#ffe7a0');
      glow.set(hx + 1, hy - 6, '#fff1b8');
      break;
    case 'seal':
      p.rect(hx, hy + 3, 3, 3, GOLD[2]);
      p.set(hx + 1, hy + 4, GOLD[0]);
      glow.set(hx, hy + 3, '#ffd36b');
      glow.set(hx + 2, hy + 5, '#ffd36b');
      break;
    default:
      return;
  }
  put(g, p);
}

function propLayer(g, glow, L, P, hand, T) {
  const kind = WEAPON[L.cls];
  switch (P.prop) {
    case 'weapon':
      weapon(g, glow, L, hand, kind);
      break;
    case 'focus':
      if (kind === 'staff' || kind === 'torch' || kind === 'seal') weapon(g, glow, L, hand, kind);
      break;
    case 'hammer': {
      const sx = T.x + 1;
      const sy = T.y + 8;
      const cx = hand[0] + 1;
      const cy = hand[1] + 1;
      const dx = cx - sx;
      const dy = cy - sy;
      const len = Math.hypot(dx, dy) || 1;
      const ex = Math.round(cx + (dx / len) * 5);
      const ey = Math.round(cy + (dy / len) * 5);
      const px = Math.round((-dy / len) * 2);
      const py = Math.round((dx / len) * 2);
      const p = new Piece(0, 0);
      p.line(cx, cy, ex, ey, WOOD[2]);
      p.line(ex - px, ey - py, ex + px, ey + py, METAL[1], 2);
      p.set(ex + px, ey + py, METAL[3]);
      put(g, p);
      break;
    }
    case 'book': {
      const p = new Piece(T.x, T.y);
      p.rect(2, 10, 9, 4, '#3b1418');
      p.rect(3, 9, 3, 4, PAGE[2]);
      p.rect(7, 9, 3, 4, PAGE[1]);
      p.rect(6, 9, 1, 4, '#2a2a2a');
      if (P.bookFlip) p.rect(7, 7, 2, 2, PAGE[2]);
      p.line(3, 10, 5, 10, '#6f6650');
      p.line(7, 11, 9, 11, '#6f6650');
      put(g, p);
      break;
    }
    case 'planted': {
      const p = new Piece(0, 0);
      const x = hand[0] + 3;
      const top = hand[1] - 2;
      if (kind === 'sword' || kind === 'rapier') {
        p.rect(x, top, 1, 3, WOOD[1]);
        p.rect(x - 1, top + 3, 3, 1, GOLD[1]);
        p.line(x, top + 4, x, 31, METAL[2]);
      } else if (kind === 'staff') {
        p.line(x, top - 6, x, 31, WOOD[2]);
        p.rect(x - 1, top - 9, 3, 3, '#7fc8ff');
        glow.rect(x - 1, top - 9, 3, 3, '#9fd8ff');
      } else if (kind === 'axe') {
        p.line(x, top, x, 31, WOOD[2]);
        p.rect(x + 1, 27, 3, 4, METAL[1]);
      } else if (kind === 'torch') {
        p.line(x, top, x, 31, WOOD[2]);
        p.rect(x - 1, top - 3, 3, 3, '#ff9a3a');
        glow.rect(x - 1, top - 3, 3, 3, '#ff8a2a');
      } else if (kind === 'lantern') {
        p.rect(x - 1, 28, 3, 4, GOLD[1]);
        p.set(x, 29, '#ffcf6b');
        glow.set(x, 29, '#ffb347');
      } else {
        return;
      }
      put(g, p);
      break;
    }
    case 'dropped': {
      const p = new Piece(0, 0);
      if (kind === 'lantern' || kind === 'seal') p.rect(22, 30, 3, 2, GOLD[0]);
      else p.line(20, 31, 28, 30, kind === 'sword' || kind === 'rapier' ? METAL[2] : WOOD[2]);
      put(g, p);
      break;
    }
    default:
      break;
  }
}

function glowHands(glow, g, hands, level) {
  const c = level > 1 ? '#fff1b8' : '#ffd36b';
  for (const [hx, hy] of hands) {
    const pts = level > 1
      ? [[1, -1], [0, 0], [2, 0], [1, 1], [-1, 1], [3, 1], [1, -2], [-1, -1], [3, -1]]
      : [[1, -1], [0, 0], [2, 0], [1, 1]];
    for (const [dx, dy] of pts) {
      glow.set(hx + dx, hy + dy, c);
      g.set(hx + dx, hy + dy, c);
    }
  }
}

// ---------------------------------------------------------------------------------------------

function drawFigure(L, P) {
  const g = new PixelGrid(FRAME, FRAME);
  const glow = new PixelGrid(FRAME, FRAME);
  const pal = paletteFor(L);
  const dy = P.dy || 0;
  const lean = P.lean || 0;
  const T = { x: OX + Math.floor(lean / 2), y: OY + dy };
  const H = { x: OX + lean, y: OY + dy + (P.headDy || 0) };
  const frontHand = P.front === 'T' ? [T.x + 1, T.y + 12] : [T.x + 1 + P.front[0], T.y + 8 + P.front[1]];
  const backHand = P.back === 'T' ? [T.x + 10, T.y + 12] : [T.x + 9 + P.back[0], T.y + 8 + P.back[1]];

  backLayer(g, L, pal, P, T, H);
  backArm(g, L, pal, P, T, backHand);
  legsLayer(g, L, pal, P);
  torsoLayer(g, L, pal, P, T);
  if (P.back === 'T') stamp(g, 'hand', pal, T.x, T.y);
  robeLayer(g, L, pal, P, T);
  shoulderLayer(g, L, pal, P, T);
  headLayer(g, glow, L, pal, H);
  frontArm(g, L, pal, P, T, frontHand);
  propLayer(g, glow, L, P, frontHand, T);
  if (P.glow) glowHands(glow, g, [frontHand, backHand], P.glow);

  g.outline(OUTLINE);
  return { g, glow };
}

const atlasCache = new Map();

// Returns { color, glow, alpha } holding every pose of this look.
export function buildAtlas(L) {
  const key = `${L.sid}|${L.cls}|${L.crest}|${L.hue}|${L.spirit}|${L.hairStyle}|${L.beard}`;
  if (atlasCache.has(key)) return atlasCache.get(key);
  const color = makeCanvas(FRAME * COLS, FRAME * ROWS);
  const glow = makeCanvas(FRAME * COLS, FRAME * ROWS);
  POSES.forEach((P, i) => {
    const { g, glow: gl } = drawFigure(L, P);
    const ox = (i % COLS) * FRAME;
    const oy = Math.floor(i / COLS) * FRAME;
    g.blit(color.ctx, ox, oy);
    gl.blit(glow.ctx, ox, oy);
  });
  const atlas = { color: color.c, glow: glow.c, alpha: color.ctx.getImageData(0, 0, FRAME * COLS, FRAME * ROWS).data };
  atlasCache.set(key, atlas);
  return atlas;
}

// The sheet description the renderer works from (the hand-drawn hero supplies its own).
export function sheetForLook(L) {
  return {
    ...buildAtlas(L),
    frameW: FRAME, frameH: FRAME, cols: COLS, rows: ROWS,
    anims: ANIMS, px: PX, head: 22,
    hits: { hammer: 2, cast: 2, send: 2 },
  };
}

// ---------------------------------------------------------------------------------------------
// Emote icons, shown in a small dark bubble with a gold rim above a character's head.

const ICONS = {
  quest: { color: '#f2c75c', rows: ['...XX....', '...XX....', '...XX....', '...XX....', '...XX....', '.........', '...XX....', '...XX....'] },
  alert: { color: '#e5573f', rows: ['...XX....', '...XX....', '...XX....', '...XX....', '...XX....', '.........', '...XX....', '...XX....'] },
  question: { color: '#d8d2c4', rows: ['..XXXX...', '.XX..XX..', '.....XX..', '....XX...', '...XX....', '.........', '...XX....', '...XX....'] },
  heart: { color: '#d0485a', rows: ['.XX..XX..', 'XXXXXXXX.', 'XXXXXXXX.', 'XXXXXXXX.', '.XXXXXX..', '..XXXX...', '...XX....', '.........'] },
  note: { color: '#d6b46e', rows: ['...XXXX..', '...X..XX.', '...X.....', '...X.....', '.XXX.....', 'XXXX.....', '.XX......', '.........'] },
  sweat: { color: '#7fb3d9', rows: ['...X.....', '...X.....', '..XXX....', '.XXXXX...', '.XXXXX...', '.XXXXX...', '..XXX....', '.........'] },
  anger: { color: '#e04a3a', rows: ['.XX..XX..', 'XX....XX.', 'X......X.', '.........', 'X......X.', 'XX....XX.', '.XX..XX..', '.........'] },
  zzz: { color: '#9fb0c8', rows: ['....XXXX.', '......X..', '.....X...', '....XXXX.', 'XXX......', '..X......', '.X.......', 'XXX......'] },
  sparkle: { color: '#ffe7a0', rows: ['...X.....', '...X.....', '..XXX....', 'XXXXXXX..', '..XXX....', '...X.....', '...X..X..', '.....XXX.'] },
  dots: { color: '#d8d2c4', rows: ['.........', '.........', '.........', '.........', 'XX.XX.XX.', 'XX.XX.XX.', '.........', '.........'] },
  skull: { color: '#d8d2c4', rows: ['.XXXXXX..', 'XXXXXXXX.', 'X..XX..X.', 'X..XX..X.', 'XXXXXXXX.', '.XX.XX...', '.X.X.X...', '.........'] },
  eye: { color: '#d6b46e', rows: ['.........', '..XXXX...', '.X.XX.X..', 'X.XXXX.X.', 'X.XXXX.X.', '.X.XX.X..', '..XXXX...', '.........'] },
  bell: { color: '#d6b46e', rows: ['...XX....', '..XXXX...', '..XXXX...', '..XXXX...', '.XXXXXX..', 'XXXXXXXX.', '...XX....', '.........'] },
  rune: { color: '#ffd36b', rows: ['...X.....', '..XXX....', '.X.X.X...', 'X..X..X..', '...X.....', '..X.X....', '.X...X...', '.........'] },
  crown: { color: '#e0ac45', rows: ['.........', 'X..X..X..', 'XX.X.XX..', 'XXXXXXX..', 'XXXXXXX..', '.........', '.........', '.........'] },
};

export const ICON_NAMES = Object.keys(ICONS);

const iconCache = new Map();

export function buildIcon(name) {
  if (iconCache.has(name)) return iconCache.get(name);
  const def = ICONS[name] || ICONS.dots;
  const g = new PixelGrid(15, 16);
  const rim = '#b8924e';
  const fill = '#17141b';
  for (let y = 1; y < 12; y++) for (let x = 1; x < 14; x++) g.set(x, y, fill);
  for (let x = 2; x < 13; x++) { g.set(x, 0, rim); g.set(x, 12, rim); }
  for (let y = 1; y < 12; y++) { g.set(0, y, rim); g.set(14, y, rim); }
  g.set(1, 1, rim); g.set(13, 1, rim); g.set(1, 11, rim); g.set(13, 11, rim);
  g.rect(6, 13, 3, 1, rim);
  g.set(7, 14, rim);
  g.set(7, 13, fill);
  g.stamp(def.rows, 3, 2, { X: def.color });
  const { c, ctx } = makeCanvas(16, 16);
  g.blit(ctx, 0, 0);
  iconCache.set(name, c);
  return c;
}

// ---------------------------------------------------------------------------------------------
// Ravens for the tower: two wing frames side by side in one 24x8 canvas.

export function buildRaven() {
  const g = new PixelGrid(24, 8);
  const C = { K: '#0d0b10', D: '#25212b', Y: '#c9a24a', R: '#d14b3a' };
  g.stamp([
    'K.........K.',
    'DK.......KD.',
    '.DK.KK..KD..',
    '..KKKKKKK...',
    '....KKKKRY..',
    '.....KK.....',
  ], 0, 1, C);
  g.stamp([
    '............',
    '............',
    '....KK......',
    '..KKKKKKK...',
    '.DKKKKKKRY..',
    'DK...KK.KD..',
    'K........K..',
  ], 12, 0, C);
  const { c, ctx } = makeCanvas(24, 8);
  g.blit(ctx, 0, 0);
  return c;
}

export { mix };

// The unequipped base body (dev viewer only).
export function baseLook(hairStyle = 'bald') {
  return { ...makeLook('base00000000', 'Base', 'opus'), cls: 'base', hairStyle, beard: null, cloth: ['#2a1a20', '#4a2a33', '#6a3a45', '#8a5a62'] };
}
