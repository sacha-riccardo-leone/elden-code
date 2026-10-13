// Fortuna, the Four-armed Beauty: a blue-skinned witch under a great white hat. Her upper hands
// hold a frost orb and drip ice; the lower ones grip a frost blade and rest open.
// Source art: assets/hero/fortuna.json (122x151, from fortuna-src.webp).

import { Img, NONE, region, blit, rotatable, drawRotated, prepareStill, composeStill } from './core.js';

const FRAME = { w: 180, h: 152 };
const MID = 46; // source column under the middle of her skirts
const GROUND = 149;
const OX = FRAME.w / 2 - MID;
const OY = FRAME.h - 1 - GROUND;

// Anatomy, in source-grid coordinates.
const SKIRT = 118; // rows from here down are skirts, planted on the ground
const NECK = 64; // rows above this (hat, face, hair, shoulders) bow
const CAPE = { x1: 26, y0: 100 }; // the fur cape's hem, behind her on the left
const GRIP = { x: 43.5, y: 97.5 }; // the lower hand holding the sword; the blade turns about it
const LEN = Math.hypot(76, 50);
const ALONG = [76 / LEN, 50 / LEN]; // from the grip toward the tip
const ACROSS = [-ALONG[1], ALONG[0]];
const HAND = { x0: 39, x1: 46, y0: 87, y1: 102 };
const ORB_TOP = 58; // the orb and its motes sit above this row, the hand below
const EYE = { x0: 56, x1: 62, y0: 42, y1: 48 };

function bladeCoords(x, y) {
  const dx = x + 0.5 - GRIP.x;
  const dy = y + 0.5 - GRIP.y;
  return [dx * ALONG[0] + dy * ALONG[1], dx * ACROSS[0] + dy * ACROSS[1]];
}
const inHand = (x, y) => x >= HAND.x0 && x <= HAND.x1 && y >= HAND.y0 && y <= HAND.y1;
function isSword(x, y) {
  if (inHand(x, y)) return false;
  if (x >= 84 && y >= 103) return true; // frost shards and motes trailing off the blade
  const [t, d] = bladeCoords(x, y);
  if (t >= -17 && t < -3) return d >= -2 && d <= 4; // grip and pommel
  if (t >= 6.5 && t <= 9.5) return d >= -9 && d <= 12; // crossguard
  if (t > 9.5 && t <= 44) return d >= -10 && d <= 8;
  if (t > 44) return d >= -18 && d <= 14;
  return false;
}
// The upper front hand, its orb and the motes around it (the hat brim is left out).
function isOrb(x, y) {
  if (y < 43 || y > 72 || x < 83) return false;
  return !(y <= 45 && x <= 86);
}
// The upper back hand and the icicles dripping from it.
function isIce(x, y) {
  if (y >= 64 && y <= 71) return x <= 18;
  if (y >= 72 && y <= 79) return x <= 22;
  if (y >= 80 && y <= 89) return x <= 15;
  return false;
}

function prepare(art, more = {}) {
  const { src, code, ids } = art;
  const sword = region(src, isSword);
  // The grip runs on behind the fingers: rebuild it there from the stretch just before the
  // hand, so the hilt stays whole however the blade turns.
  const back = [Math.round(8 * ALONG[0]), Math.round(8 * ALONG[1])];
  for (let y = HAND.y0; y <= HAND.y1; y++) {
    for (let x = HAND.x0; x <= HAND.x1; x++) {
      const [t, d] = bladeCoords(x, y);
      if (t < -3 || t > 6.5 || d < -2 || d > 3.5) continue;
      const v = src.get(x - back[0], y - back[1]);
      if (v !== NONE && isSword(x - back[0], y - back[1])) sword.set(x, y, v);
    }
  }

  // Robe hidden under the blade: carry the folds below it straight up (they hang vertically),
  // or the ones above it down where there is nothing below.
  const robe = region(src, (x, y) => !isSword(x, y) && !inHand(x, y));
  const cloth = ids('ABCDEFGHJKMPQTVYbcgjlnprt'); // whites, greys and shadows, no frost blues
  const fold = (x, y0, step) => {
    if (robe.get(x, y0) === NONE) return NONE;
    for (let k = 0; k < 8; k++) {
      const v = robe.get(x, y0 + k * step);
      if (v === NONE) break;
      if (cloth.has(v)) return v;
    }
    return NONE;
  };
  for (let x = 0; x < src.w; x++) {
    let y = 0;
    while (y < src.h) {
      if (!(isSword(x, y) && src.get(x, y) !== NONE)) { y++; continue; }
      const ya = y;
      while (y < src.h && isSword(x, y) && src.get(x, y) !== NONE) y++;
      const yb = y - 1;
      const below = fold(x, yb + 1, 1);
      const above = fold(x, ya - 1, -1);
      if (below !== NONE) for (let k = ya; k <= yb; k++) robe.set(x, k, below);
      // nothing below: only the sleeve's hem carries on a little way past the blade's edge
      else if (above !== NONE && x < 80) for (let k = ya; k <= Math.min(yb, ya + 2); k++) robe.set(x, k, above);
    }
  }

  const taken = (x, y) => inHand(x, y) || isOrb(x, y) || isIce(x, y);
  const eye = [];
  const hotIds = ids('Xeho');
  for (let y = EYE.y0; y <= EYE.y1; y++) for (let x = EYE.x0; x <= EYE.x1; x++) if (hotIds.has(src.get(x, y))) eye.push([x, y]);
  return {
    eye,
    // kneeling is its own drawing (assets/hero/fortuna-kneel.json); her orb still floats
    still: more.kneel && prepareStill(more.kneel, {
      ground: 116, mid: 53, neck: 58, waist: 72, cape: { x1: 22, y0: 72 },
      float: (x, y) => y >= 43 && y <= 58 && (x >= 95 || (x >= 93 && y >= 50)),
      eye: { x0: 66, x1: 74, y0: 42, y1: 46, ids: hotIds },
    }),
    parts: {
      sword: rotatable(sword),
      hand: region(src, inHand),
      orb: region(src, isOrb),
      ice: region(src, isIce),
      head: region(robe, (x, y) => y < NECK && !taken(x, y)),
      upper: region(robe, (x, y) => y >= NECK && y < SKIRT && !taken(x, y)),
      lower: region(robe, (x, y) => y >= SKIRT),
    },
    energy: {
      hot: ids('Xeha' + 'o'),
      core: ids('suvq'),
      soft: ids('o'),
      dim: [code('R'), code('k')],
      flare: [code('o'), code('v')],
      crackle: { main: code('h'), core: code('v'), sparks: [code('X'), code('e'), code('o')] },
      style: 'shards',
      odds: [[0.35, 0.55, 0.97], [0.2, 0.34, 0.9], [0.06, 0.14, 0.6]],
      bigOff: 'lit',
      keepAbove: 30,
      arcs: [0, 2, 5],
      sparks: [2, 4, 9],
      sparkReach: 8,
      sparkRise: 3,
    },
  };
}

// Draws `img` with each pixel moved up by lift(x, y). A column that hung from something below
// it (a wrist from its sleeve) is stretched down so it stays attached.
function blitLifted(dst, img, dx, dy, lift, attachedBelow) {
  for (let x = 0; x < img.w; x++) {
    let bottom = -1;
    for (let y = 0; y < img.h; y++) {
      const v = img.c[y * img.w + x];
      if (v === NONE) continue;
      dst.set(x + dx, y + dy - lift(x, y), v);
      bottom = y;
    }
    if (bottom < 0) continue;
    const s = lift(x, bottom);
    if (s > 0 && attachedBelow(x, bottom + 1)) {
      const v = img.c[bottom * img.w + x];
      for (let k = 1; k <= s; k++) dst.set(x + dx, bottom + dy - s + k, v);
    }
  }
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function compose({ parts, eye, still }, p) {
  if (p.still) return composeStill(still, p, FRAME);
  const f = new Img(FRAME.w, FRAME.h);
  const bob = p.bob || 0;
  const crouch = p.crouch || 0;
  const lean = p.lean || 0;
  const ux = OX + lean;
  const uy = OY + bob + crouch;
  const sway = p.sway || 0;
  const hem = p.hem || 0;
  const capeShift = (y) => (y < CAPE.y0 ? 0 : Math.round((sway * (y - CAPE.y0)) / (GROUND - CAPE.y0)));
  const hemShift = (y) => Math.round((hem * (y - SKIRT)) / (GROUND - SKIRT));
  // a leaning body shears the skirts: full lean at the waist, none at the hem
  const leanShift = (y) => Math.round((lean * (GROUND - y)) / (GROUND - SKIRT));

  // skirts and the cape's hem stay on the ground; crouching folds rows out of them. Drawn once
  // as they are and once sheared, so a shear never opens a gap.
  for (const sheared of [false, true]) {
    for (let y = SKIRT + crouch; y <= GROUND; y++) {
      for (let x = 0; x < parts.lower.w; x++) {
        const v = parts.lower.get(x, y);
        if (v === NONE) continue;
        const sx = sheared ? (x <= CAPE.x1 ? capeShift(y) : hemShift(y)) + leanShift(y - crouch) : 0;
        f.set(x + OX + sx, y + OY, v);
      }
    }
  }

  // the body, the cape's upper part swaying with the hem
  for (const sheared of [false, true]) {
    for (let y = NECK; y < SKIRT; y++) {
      for (let x = 0; x <= (sheared ? CAPE.x1 : parts.upper.w - 1); x++) {
        const v = parts.upper.get(x, y);
        if (v !== NONE) f.set(x + ux + (sheared ? capeShift(y) : 0), y + uy, v);
      }
    }
  }

  // the upper back hand rises from the elbow; its icicles come with it
  const ice = p.ice || 0;
  blitLifted(f, parts.ice, ux, uy, (x) => Math.round(ice * clamp01((22 - x) / 6)),
    (x, y) => parts.upper.get(x, y) !== NONE);

  // hat, face and hair; a bow sets them down lower and forward
  const hd = p.head || [0, 0];
  blit(f, parts.head, ux + hd[0], uy + hd[1]);

  // the orb hand lifts from the wrist and the orb floats above the palm
  const orb = p.orb || 0;
  const float = p.float || 0;
  blitLifted(f, parts.orb, ux, uy,
    (x, y) => Math.round(orb * clamp01((x - 82) / 4)) + (y <= ORB_TOP ? float : 0),
    (x, y) => parts.upper.get(x, y) !== NONE);

  // the sword turns about the gripping hand, which is drawn over its hilt
  drawRotated(f, parts.sword, p.sword || 0, GRIP, ux, uy);
  blit(f, parts.hand, ux, uy);

  // the glowing eye never flickers
  f.keep = eye
    .map(([x, y]) => [x + ux + hd[0], y + uy + hd[1]])
    .filter(([x, y]) => x >= 0 && y >= 0 && x < FRAME.w && y < FRAME.h)
    .map(([x, y]) => y * FRAME.w + x);
  return f;
}

// ---------------------------------------------------------------------------------------------
// the animation set

const poses = [];
const groups = {};
function anim(name, list) {
  groups[name] = list.map((p) => { poses.push(p); return poses.length - 1; });
}
const seq = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));

anim('idle', seq(6, (i) => ({
  bob: [0, 0, 1, 1, 1, 0][i],
  sway: [0, 1, 1, 0, -1, -1][i],
  hem: [0, 0, 1, 1, 0, 0][i],
  float: [0, 1, 2, 2, 1, 0][i],
  light: 1,
})));
anim('walk', seq(6, (i) => ({
  bob: [1, 0, 0, 1, 0, 0][i],
  sway: [-1, -2, -3, -2, -2, -3][i],
  hem: [2, 1, -1, -2, -1, 1][i],
  float: [1, 1, 2, 1, 1, 2][i],
  sword: [0, -1, -2, 0, -1, -2][i],
  light: 1,
})));
anim('strike', seq(6, (i) => ({
  sword: [0, -28, -60, -24, 2, 1][i],
  lean: [0, -1, -2, 0, 2, 1][i],
  bob: [0, 0, 0, 1, 1, 0][i],
  hem: [0, -1, -1, 1, 2, 1][i],
  sway: [0, 1, 2, -1, -2, -1][i],
  float: [0, 1, 1, 0, 0, 1][i],
  light: [1, 1, 2, 2, 2, 1][i],
})));
anim('cast', seq(4, (i) => ({
  orb: [2, 3, 3, 2][i], float: [1, 2, 3, 2][i], ice: [1, 2, 2, 1][i],
  sway: [1, 2, 1, 2][i], hem: [0, 1, 0, 1][i], sword: -3, lean: -1, light: 2,
})));
anim('raise', seq(4, (i) => ({
  orb: [1, 3, 4, 3][i], float: [2, 3, 4, 3][i], ice: [0, 1, 2, 1][i],
  sword: [-4, -8, -10, -6][i], sway: [0, 1, 1, 0][i], light: 2,
})));
anim('point', seq(2, (i) => ({ sword: -30 - i, lean: 1, hem: 1, float: 1 + i, light: 1 })));
anim('kneel', seq(2, (i) => ({ still: true, bob: i, sway: i, float: 1 + i, light: 1 })));
anim('rest', seq(2, (i) => ({ still: true, bob: i, head: [1, 1], sway: 1 - i, float: i, light: 0 })));
anim('pray', seq(2, (i) => ({ still: true, bob: i, head: [1, 2], sway: 2, float: 2 + i, light: 2 })));
anim('bow', seq(3, (i) => ({ head: [[1, 1], [2, 2], [2, 3]][i], lean: Math.min(1, i), sword: -i, light: 0 })));
anim('study', seq(2, (i) => ({ head: [1, 1], bob: i, float: 1 + i, light: 0 })));
anim('stagger', seq(2, (i) => ({ lean: -2 - i, sword: -10 - i * 4, sway: 2, hem: -2, float: 3, ice: 2, light: 2 })));
anim('collapse', [{ still: true, head: [2, 3], sway: 2, light: 0 }]);
anim('lifted', seq(2, (i) => ({ sway: -3 + i, hem: -2 - i, sword: -6 - i * 4, float: i, ice: 1 - i, light: 1 })));
anim('talk', seq(2, (i) => ({ orb: i, float: 1 + i, bob: i, light: 1 })));

const G = groups;
export default {
  id: 'fortuna',
  art: '/assets/hero/fortuna.json',
  extraArt: { kneel: '/assets/hero/fortuna-kneel.json' },
  firstName: 'Fortuna',
  epithet: 'the Four-armed Beauty',
  title: 'Witch',
  burst: ['#7fc4ff', '#e8f6ff'],
  frame: FRAME,
  cols: 8,
  px: 1.95 / 104, // world units per art pixel: her eyes sit a little below the knight's visor
  head: 140, // art pixels from the ground to the top of the hat
  hits: { hammer: 4, cast: 1, send: 1 },
  glowIntensity: 0.95,
  glowColors: [[24, 96, 210], [140, 196, 250]],
  seed: 4404,
  prepare,
  compose,
  poses,
  groups,
  anims: {
    idle: { frames: G.idle, fps: 5 },
    walk: { frames: G.walk, fps: 8 },
    hammer: { frames: G.strike, fps: 8 },
    read: { frames: G.study, fps: 1.4 },
    cast: { frames: G.cast, fps: 6 },
    send: { frames: G.raise, fps: 4 },
    kneel: { frames: G.kneel, fps: 1.5 },
    sit: { frames: G.rest, fps: 1 },
    doze: { frames: G.rest, fps: 0.6 },
    bow: { frames: [...G.bow, G.bow[2], G.bow[2], G.bow[0]], fps: 3, once: true },
    wave: { frames: [...G.raise, ...G.raise], fps: 6, once: true },
    point: { frames: [...G.point, ...G.point], fps: 2, once: true },
    cheer: { frames: [...G.raise, ...G.raise], fps: 7, once: true },
    pray: { frames: G.pray, fps: 3 },
    collapse: { frames: G.collapse, fps: 1 },
    lifted: { frames: G.lifted, fps: 4 },
    talk: { frames: G.talk, fps: 2.5 },
    stagger: { frames: [...G.stagger, G.idle[0]], fps: 4, once: true },
    kneelBow: { frames: [G.kneel[0], ...G.rest, G.rest[1], G.kneel[0]], fps: 2, once: true },
  },
  groupFps: { idle: 5, walk: 8, strike: 8, cast: 6, raise: 4, point: 2, kneel: 1.5, rest: 1, pray: 3, bow: 3, study: 1.4, stagger: 4, collapse: 1, lifted: 4, talk: 2.5 },
};
