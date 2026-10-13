// The Noble Sorcerer's spectre: a gaunt, skull-faced sorcerer in a jewelled circlet and a tattered
// cloak, a crystal-tipped staff in one hand, his legs trailing off beneath him. Not a hero: when
// every hero is out on a quest, spectres are called up to work the overflow (director.js). They
// never walk: idle and moving are both a float, rising and sinking, the cloak's tatters and the
// legs stirring beneath; their work is done with the staff. Each spectre at a time wears its own
// colour (spectreSheets: blue, purple, green…).
// Source art: assets/hero/spectre.json (84x115, from spectre-stand.webp).

import { Img, NONE, region, blit, rotatable, drawRotated } from './core.js';

const FRAME = { w: 120, h: 124 };
const MID = 42; // source column on the frame's centre
const FEET = 113; // lowest source row (his trailing feet)
const OX = FRAME.w / 2 - MID;
const OY = FRAME.h - 4 - FEET; // a little room below for the float

// Anatomy, in source-grid coordinates.
const NECK = 20; // above: the skull and the circlet
const CAPE_Y = 38; // the cloak left of capeEdge sways below this row
const capeEdge = (y) => (y < 60 ? 27 : y < 80 ? 24 : 26);
const LEGS = 94; // the legs, below this row, dangle
const HAND = { x0: 64, x1: 82, y0: 43, y1: 55 }; // the hand on the staff
const GRIP = { x: 75.5, y: 49.5 }; // the staff turns about it
const inHand = (x, y) => x >= HAND.x0 && x <= HAND.x1 && y >= HAND.y0 && y <= HAND.y1;
const isStaff = (x, y) => !inHand(x, y) && ((x >= 72 && (y <= 44 || y >= 56)) || (x >= 70 && y >= 97));
const isCape = (x, y) => y >= CAPE_Y && x <= capeEdge(y) && y < LEGS;

function prepare(art) {
  const { src, ids, code } = art;
  return {
    parts: {
      staff: rotatable(region(src, isStaff)),
      hand: region(src, inHand),
      head: region(src, (x, y) => y < NECK && !isStaff(x, y)),
      cape: region(src, (x, y) => isCape(x, y) && !isStaff(x, y)),
      legs: region(src, (x, y) => y >= LEGS && !isStaff(x, y)),
      body: region(src, (x, y) => y >= NECK && y < LEGS && !isCape(x, y) && !isStaff(x, y) && !inHand(x, y)),
    },
    // the staff's crystal and the circlet's gems glow, and flare when he works his sorcery
    energy: {
      hot: ids('S'),
      core: ids('ab'),
      soft: ids('W'),
      dim: [code('N'), code('R')],
      flare: [code('W'), code('b')],
      crackle: { main: code('S'), core: code('b'), sparks: [code('S'), code('W'), code('a')] },
      odds: [[0.2, 0.5, 0.98], [0.05, 0.25, 0.9], [0, 0.05, 0.5]],
      bigOff: 'dim',
      keepAbove: 12,
      arcs: [0, 0, 2],
      sparks: [0, 1, 4],
      sparkReach: 8,
      sparkRise: 3,
    },
  };
}

// A sheared copy of `part`: drawn once as it is, then shifted, so no gap opens behind it.
function blitSheared(dst, part, dx, dy, shift) {
  blit(dst, part, dx, dy);
  for (let y = 0; y < part.h; y++) {
    const s = shift(y);
    if (!s) continue;
    for (let x = 0; x < part.w; x++) {
      const v = part.c[y * part.w + x];
      if (v !== NONE) dst.set(x + dx + s, y + dy, v);
    }
  }
}

function compose(ctx, p) {
  const { parts } = ctx;
  const f = new Img(FRAME.w, FRAME.h);
  const ux = OX + (p.lean || 0);
  const uy = OY - (p.rise || 0); // the whole of him floats up and down together
  // the cloak behind him, its hem stirring (the lower, the further)
  const sway = p.sway || 0;
  blitSheared(f, parts.cape, ux, uy, (y) => (y < CAPE_Y ? 0 : Math.round((sway * (y - CAPE_Y)) / (LEGS - CAPE_Y))));
  // the legs trailing beneath, swaying from the knee down
  const dangle = p.dangle || 0;
  blitSheared(f, parts.legs, OX, uy, (y) => (y < LEGS ? 0 : Math.round((dangle * (y - LEGS) ** 2) / (FEET - LEGS) ** 2)));
  blit(f, parts.body, ux, uy);
  const hd = p.head || [0, 0];
  blit(f, parts.head, ux + hd[0], uy + hd[1]);
  // the staff turns about his hand
  drawRotated(f, parts.staff, p.staff || 0, GRIP, ux, uy);
  blit(f, parts.hand, ux, uy);
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
const RISE = [0, 1, 2, 3, 2, 1]; // the float: up and down, in whole pixels

anim('idle', seq(6, (i) => ({ rise: RISE[i], sway: [0, 1, 1, 0, -1, -1][i], dangle: [-1, 0, 1, 1, 0, -1][i] })));
// gliding along: leaning into it, the cloak and legs trailing behind
anim('walk', seq(6, (i) => ({ rise: RISE[i], lean: 1, sway: [-2, -3, -3, -2, -3, -3][i], dangle: [-3, -2, -3, -4, -3, -2][i], staff: [2, 1, 0, 1, 2, 3][i] })));
// sorcery: the staff tilted forward and its crystal flaring (a positive angle tips the crystal ahead)
anim('cast', seq(4, (i) => ({ rise: [1, 2, 2, 1][i], staff: [8, 14, 16, 12][i], sway: [0, 1, 2, 1][i], dangle: [0, 1, 1, 0][i], light: 2 })));
// at the forge: the staff brought down like a hammer
anim('strike', seq(6, (i) => ({ rise: [1, 2, 3, 1, 0, 0][i], staff: [0, -8, -12, 18, 30, 10][i], lean: [0, -1, -1, 1, 1, 0][i], sway: [0, 1, 2, -1, -2, -1][i], light: [1, 1, 2, 2, 1, 1][i] })));
// poring over the scrolls: the skull bowed
anim('study', seq(4, (i) => ({ rise: [0, 1, 1, 0][i], head: [0, 1], dangle: [0, 1, 0, -1][i] })));
// sending: the staff held high
anim('raise', seq(4, (i) => ({ rise: [1, 2, 3, 2][i], staff: [12, 20, 24, 20][i], sway: [0, 1, 1, 0][i], light: [1, 2, 2, 1][i] })));
anim('point', seq(2, (i) => ({ rise: 1 + i, staff: 22 + i * 2, lean: 1 })));
// resting, praying, kneeling: sunk low, the skull bowed
anim('rest', seq(4, (i) => ({ rise: [0, 0, -1, 0][i], head: [0, 1], sway: [0, 1, 0, -1][i], dangle: [1, 2, 2, 1][i], light: 0 })));
anim('pray', seq(4, (i) => ({ rise: [1, 2, 2, 1][i], head: [0, 1], staff: 6, light: 2 })));
anim('bow', seq(3, (i) => ({ rise: 1, head: [[0, 1], [1, 2], [1, 2]][i], lean: Math.min(1, i) })));
anim('stagger', seq(2, (i) => ({ rise: 2 - i, lean: -1 - i, sway: 2, dangle: 3 })));
anim('talk', seq(2, (i) => ({ rise: 1 + i, staff: i ? 3 : 0 })));

const G = groups;
export default {
  id: 'spectre',
  art: '/assets/hero/spectre.json',
  title: 'Spectre',
  epithet: 'of the Noble Sorcerers',
  frame: FRAME,
  cols: 8,
  px: 2.5 / 112, // world units per art pixel: a little taller than the knight, floating
  head: 116, // art pixels from the frame's foot to the top of the circlet
  hits: { hammer: 3, cast: 1, send: 2 },
  glowIntensity: 1.2,
  glowColors: [[74, 187, 240], [210, 245, 255]],
  seed: 4211,
  prepare,
  compose,
  poses,
  groups,
  anims: {
    idle: { frames: G.idle, fps: 4 },
    walk: { frames: G.walk, fps: 6 },
    hammer: { frames: G.strike, fps: 8 },
    read: { frames: G.study, fps: 1.6 },
    cast: { frames: G.cast, fps: 5 },
    send: { frames: G.raise, fps: 4 },
    kneel: { frames: G.rest, fps: 1.5 },
    sit: { frames: G.rest, fps: 1 },
    doze: { frames: G.rest, fps: 0.6 },
    bow: { frames: [...G.bow, G.bow[2], G.bow[0]], fps: 3, once: true },
    wave: { frames: [...G.raise, ...G.raise], fps: 6, once: true },
    point: { frames: [...G.point, ...G.point], fps: 2, once: true },
    cheer: { frames: [...G.raise, ...G.raise], fps: 7, once: true },
    pray: { frames: G.pray, fps: 3 },
    collapse: { frames: G.rest, fps: 1 },
    lifted: { frames: G.idle, fps: 4 },
    talk: { frames: G.talk, fps: 2.5 },
    stagger: { frames: [...G.stagger, G.idle[0]], fps: 4, once: true },
    kneelBow: { frames: [...G.rest, G.rest[0]], fps: 2, once: true },
  },
  groupFps: { idle: 4, walk: 6, strike: 8, cast: 5, study: 1.6, raise: 4, point: 2, rest: 1, pray: 3, bow: 3, stagger: 4, talk: 2.5 },
};
