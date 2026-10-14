// The Guardian Golem, the other great enemy of the Arena of Trials (fight.js, golem.js): a giant of
// black stone, a fire burning in his ribcage, a great double-bladed axe on a long pole. Every
// drawing is the user's own (assets/golem/golem-<sheet>.webp, golem-axe.png): the attacks, his
// fall and the fire he spits are used as drawn, three frames each (five for the fall); idle and
// walk are rigged from the idle drawing (he breathes; his legs stride).
//
// Source art: assets/golem/golem.json (395x261, from golem-idle.webp) and golem-<still>.json, all on
// one palette. The sheets draw him at different sizes, so each was sampled on its own grid to match
// the idle (3.6 source px per art pixel): the fall at 0.37 of that (its frames enlarged 3x first,
// they're drawn so small), the lunge at 0.65, the swing at 0.55, the slam and the lone axe at 0.80,
// the fire at 0.85 (measured on the helmet's pompom, the axe, his shoulders).
//
// Every drawing stands on his planted back heel (HEELX) with its ground on the frame's bottom row;
// his middle, where he stands in the world, is BODYX. His weak point, the cracked ankle, is on that
// back leg, just above the heel; lying felled, the fire in his chest shows (fight's golem.js).

import { Img, NONE, blit, region } from './core.js';

const FRAME = { w: 600, h: 460 };
const HEELX = 142;
const BODYX = HEELX + 58;
const GROUND = FRAME.h - 1;

// Each drawing: its planted heel (x) and ground row; the stills of the fall and the attacks are
// placed by them. (Measured: .elden/golem/anchors.mjs.)
const ART = {
  idle: { file: 'golem', heel: 132, ground: 259 },
  'fall-1': { heel: 75, ground: 217 }, 'fall-2': { heel: 105, ground: 188 }, 'fall-3': { heel: 140, ground: 156 },
  'fall-4': { heel: 88, ground: 141 }, 'fall-5': { heel: 84, ground: 107 },
  'lunge-1': { heel: 132, ground: 217 }, 'lunge-2': { heel: 3, ground: 168 }, 'lunge-3': { heel: 38, ground: 190 },
  'swing-1': { heel: 11, ground: 360 }, 'swing-2': { heel: 31, ground: 214 }, 'swing-3': { heel: 102, ground: 224 },
  'slam-1': { heel: 11, ground: 452 }, 'slam-2': { heel: 3, ground: 400 }, 'slam-3': { heel: 2, ground: 413 },
  'fire-1': { heel: 24, ground: 236 }, 'fire-2': { heel: 23, ground: 273 }, 'fire-3': { heel: 26, ground: 248 },
  // the lone axe, planted where the slam drove its pole into the ground (slam-2: 119 px in front of
  // his heel), its butt and the foot of its pole sunk out of sight below the cut
  axe: { heel: 34 - 119, ground: 339 },
};
const STILLS = Object.keys(ART).filter((k) => k !== 'idle');

// Where things are, in art pixels from his middle (forward +x) and up from the ground, for the
// fight: the cracked ankle, the fire in his chest as he lies felled, where the swing's axe lands,
// the lunge's point, where the slam's pole strikes, and the chest he spits fire from.
const at = (still, x, y) => [x - ART[still].heel + HEELX - BODYX, ART[still].ground - y];
export const SPOTS = {
  ankle: at('idle', 144.7, 225.3),
  heart: at('fall-5', 218.6, 71),
  swing: at('swing-3', 295, 224),
  lunge: at('lunge-2', 450, 95),
  slam: at('slam-2', 122, 400),
  chest: at('fire-2', 90, 110),
};

// Anatomy of the idle drawing.
const HIP = 178; // the legs stride below this row
const BACK_LEG = { x0: 122, x1: 192 };
const FRONT_LEG = { x0: 193, x1: 272 };
const isAxe = (x) => x < BACK_LEG.x0 || x > FRONT_LEG.x1; // the axe's butt and head, either side of him
const GLOW = 'sx1478 9+un26y'.replace(' ', ''); // the fire's oranges and yellows

function prepare(art, more = {}) {
  const { src, ids, code } = art;
  const inLeg = (leg) => (x, y) => y >= HIP && x >= leg.x0 && x <= leg.x1;
  return {
    stills: Object.fromEntries(STILLS.map((k) => [k, more[k]?.src])),
    parts: {
      backLeg: region(src, inLeg(BACK_LEG)),
      frontLeg: region(src, inLeg(FRONT_LEG)),
      upper: region(src, (x, y) => y < HIP || isAxe(x)),
    },
    // the fire in his chest and his cracks smoulder and flare; embers rise off them
    energy: {
      hot: ids(GLOW),
      core: new Set(),
      soft: ids('789+'),
      dim: [code('f'), code('n')],
      flare: [code('7'), code('+')],
      crackle: { main: code('x'), core: code('8'), sparks: [code('s'), code('4'), code('8')] },
      odds: [[0.02, 0.2, 0.92], [0.01, 0.1, 0.82], [0, 0.04, 0.55]],
      bigOff: 'lit',
      keepAbove: 4,
      arcs: [0, 0, 0],
      sparks: [1, 3, 6],
      sparkReach: 8,
      sparkRise: 6,
    },
  };
}

// Where a drawing's (x, y) lands in the frame: its heel on HEELX, its ground on the bottom row.
const origin = (name, dx = 0, dy = 0) => [HEELX - ART[name].heel + dx, GROUND - ART[name].ground + dy];

// A leg of the idle drawing, sheared: its foot `stride` px forward (and lifted `lift`), its hip still.
function drawLeg(dst, leg, stride, lift, ox, oy) {
  const span = ART.idle.ground - HIP;
  for (let y = HIP; y <= ART.idle.ground; y++) {
    const t = (y - HIP) / span;
    const sh = Math.round(stride * t);
    const up = Math.round(lift * t);
    for (let x = 0; x < leg.w; x++) {
      const v = leg.get(x, y);
      if (v !== NONE) dst.set(x + ox + sh, y + oy - up, v);
    }
  }
}

function compose(ctx, p) {
  const f = new Img(FRAME.w, FRAME.h);
  if (p.still) {
    const [ox, oy] = origin(p.still);
    const img = ctx.stills[p.still];
    if (p.still === 'axe') {
      // only down to the cut: the rest is in the ground
      for (let y = 0; y <= ART.axe.ground; y++) for (let x = 0; x < img.w; x++) {
        const v = img.c[y * img.w + x];
        if (v !== NONE) f.set(x + ox, y + oy, v);
      }
      return f;
    }
    blit(f, img, ox, oy);
    return f;
  }
  const { parts } = ctx;
  const [ox, oy] = origin('idle');
  const legs = p.legs || [0, 0, 0, 0];
  drawLeg(f, parts.backLeg, legs[0], legs[1], ox, oy);
  drawLeg(f, parts.frontLeg, legs[2], legs[3], ox, oy);
  // the body above the hips, and the axe in his hands, rising and sinking as he breathes or steps
  blit(f, parts.upper, ox, oy + (p.bob || 0));
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

// breathing: the chest sinks and rises, the fire in it pulsing
anim('idle', seq(6, (i) => ({ bob: [0, 1, 2, 2, 1, 0][i], light: [1, 1, 2, 2, 1, 1][i] })));
// the heavy walk: each foot swung forward lifted, set down, and pushed back under him; he sinks as
// both feet take his weight
anim('walk', seq(8, (i) => {
  const t = (i / 8) * Math.PI * 2;
  const A = 11;
  const L = 7;
  return {
    bob: Math.round(1 + Math.cos(2 * t)),
    legs: [-A * Math.cos(t), L * Math.max(0, Math.sin(t)), A * Math.cos(t), L * Math.max(0, -Math.sin(t))].map(Math.round),
    light: 1,
  };
}));
for (const k of STILLS) anim(k, [{ still: k, light: k === 'fire-2' || k === 'fire-1' ? 2 : 1 }]);
// felled, the fire in his chest beating
anim('down', [{ still: 'fall-5', light: 1 }, { still: 'fall-5', light: 2 }]);

const G = groups;
const FALL = ['fall-1', 'fall-2', 'fall-3', 'fall-4', 'fall-5'].map((k) => G[k][0]);
const single = (k) => ({ frames: G[k], fps: 1 });
export default {
  id: 'golem',
  art: '/assets/golem/golem.json',
  extraArt: Object.fromEntries(STILLS.map((k) => [k, `/assets/golem/golem-${k}.json`])),
  firstName: 'Guardian Golem',
  epithet: '',
  title: 'Great Enemy',
  frame: FRAME,
  cols: 6,
  px: 0.031, // world units per art pixel: he stands about 8 units, three times a Tarnished
  offset: FRAME.w / 2 - BODYX, // (art px) how far the frame's middle lies ahead of his own
  head: 255,
  hits: {},
  glowIntensity: 1.6,
  glowColors: [[255, 110, 20], [255, 210, 90]],
  seed: 4242,
  prepare,
  compose,
  poses,
  groups,
  anims: {
    idle: { frames: G.idle, fps: 3 },
    walk: { frames: G.walk, fps: 5 },
    // passing out, and (played backwards) getting up again; dying, he falls as he passes out
    fall: { frames: FALL, fps: 4, once: true },
    rise: { frames: [...FALL].reverse(), fps: 3, once: true },
    collapse: { frames: FALL, fps: 4, once: true },
    down: { frames: G.down, fps: 2 },
    ...Object.fromEntries(STILLS.map((k) => [k, single(k)])),
  },
  groupFps: {},
};
