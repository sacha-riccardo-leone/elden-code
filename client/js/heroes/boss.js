// The great enemy of the Arena of Trials (fight.js): a beast in black armour worked with gold,
// with a white mane and tail, a tattered crimson cape and a cracked greatsword that burns red.
// Idle and walk are rigged from the idle drawing (it breathes, the mane and tail stir, the legs
// stride); the attacks and the jump are the user's own frames, each three (four for the jump):
// anticipation, the blow, recovery.
// Source art: assets/boss/boss.json (214x163, from boss-idle.webp) and boss-<attack>-<n>.json
// (from the boss-swing / -lunge / -slam / -jump sheets), all on one palette. The sheets draw him at
// different sizes, so each is sampled on a coarser grid to match the idle: the swing sheet at
// 3.125 source px per art pixel (x0.8), the lunge at 2.717 (x0.92), the slam at 3.012 (x0.83);
// the jump sheet already matches at 2.5. His great attack's drawings (fight.js, wrath): the roar,
// head thrown back and the sword held high (boss-roar.json), and the hover over the arena, facing
// thee, the sword held level over his head (boss-float.json), both sampled at 5.5 (as big as he
// is in the slam); taller than his other frames, they're kept in frames of their own (BIG).

import { Img, NONE, blit, region, anchorOf } from './core.js';

const FRAME = { w: 466, h: 260 };
const CX = FRAME.w / 2; // the boss's middle (its torso) sits here in every frame
const TORSO = 53; // how far the torso stands in front of the planted back foot (idle)
// the great attack's frames (core.js, bigFrame): narrower, taller, his middle on the anchor column
const BIG = { w: 208, h: 300, anchor: 112 };

// Each drawing: where its back foot is planted (x) and its ground row, or (mid) the column that
// is his middle; `big`: drawn in BIG. The ground row is where the planted back paw ends, so that
// it stands on the floor (the front claws reaching a row or two lower dig into it).
const ART = {
  idle: { file: 'boss', foot: 57.5, ground: 159 },
  'swing-1': { foot: 48.5, ground: 204 }, 'swing-2': { foot: 53.3, ground: 169 }, 'swing-3': { foot: 56.2, ground: 155 },
  'lunge-1': { foot: 72.5, ground: 145 }, 'lunge-2': { foot: 42.9, ground: 148 }, 'lunge-3': { foot: 43, ground: 146 },
  'slam-1': { foot: 67.2, ground: 212 }, 'slam-2': { foot: 43.8, ground: 162 }, 'slam-3': { foot: 46.8, ground: 164 },
  'jump-1': { foot: 53, ground: 163 }, 'jump-2': { foot: 32.3, ground: 242 }, 'jump-3': { foot: 42.3, ground: 204 }, 'jump-4': { foot: 56.5, ground: 160 },
  roar: { foot: 56, ground: 298, big: true },
  float: { mid: 86, ground: 245, big: true }, // (in the air, facing thee: by his middle; ground: his lower toes)
};
const STILLS = Object.keys(ART).filter((k) => k !== 'idle');

// Anatomy of the idle drawing.
const HIP = 126; // the legs stride below this row
const BACK_LEG = { x0: 36, x1: 86 };
const FRONT_LEG = { x0: 104, x1: 174 };
const SWORD_X = 177; // the greatsword, right of this column
const MANE_Y = 50; // the mane above this row stirs
const TAIL_X = 44; // the tail, left of this column, sways
const GLOW = 'bn'; // the sword's burning reds

function prepare(art, more = {}) {
  const { src, ids, code } = art;
  const isSword = (x) => x >= SWORD_X;
  const inLeg = (leg) => (x, y) => y >= HIP && x >= leg.x0 && x <= leg.x1 && !isSword(x);
  const isTail = (x, y) => x < TAIL_X && y > 70;
  const isMane = (x, y) => y < MANE_Y && x < 150;
  return {
    stills: Object.fromEntries(STILLS.map((k) => [k, more[k]?.src])),
    parts: {
      backLeg: region(src, inLeg(BACK_LEG)),
      frontLeg: region(src, inLeg(FRONT_LEG)),
      tail: region(src, isTail),
      mane: region(src, isMane),
      upper: region(src, (x, y) => y < HIP && !isTail(x, y) && !isMane(x, y)),
      rest: region(src, (x, y) => y >= HIP && !inLeg(BACK_LEG)(x, y) && !inLeg(FRONT_LEG)(x, y) && !isTail(x, y)),
    },
    // the sword's cracks smoulder and flare; nothing else glows
    energy: {
      hot: ids(GLOW),
      core: new Set(),
      soft: ids('n'),
      dim: [code('R'), code('b')],
      flare: [code('n'), code('z')],
      crackle: { main: code('b'), core: code('n'), sparks: [code('b'), code('R'), code('n')] },
      odds: [[0.08, 0.4, 0.97], [0.04, 0.25, 0.9], [0.02, 0.1, 0.6]],
      bigOff: 'lit',
      keepAbove: 6,
      arcs: [0, 1, 3],
      sparks: [1, 3, 8],
      sparkReach: 10,
      sparkRise: 4,
    },
  };
}

// Where a drawing's (x, y) lands in its frame.
const frameOf = (name) => (ART[name].big ? BIG : FRAME);
const origin = (name, dx = 0, dy = 0) => {
  const a = ART[name];
  const F = frameOf(name);
  const x = a.mid != null ? anchorOf(F) - a.mid : anchorOf(F) - TORSO - a.foot;
  return [Math.round(x) + dx, F.h - 1 - a.ground + dy];
};

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
  if (p.still) {
    const F = frameOf(p.still);
    const f = new Img(F.w, F.h);
    const [ox, oy] = origin(p.still, p.dx || 0, p.bob || 0);
    blit(f, ctx.stills[p.still], ox, oy);
    return f;
  }
  const f = new Img(FRAME.w, FRAME.h);
  const { parts } = ctx;
  const [ox, oy] = origin('idle', p.lean || 0);
  const bob = p.bob || 0;
  const sway = p.sway || 0;
  // the tail, rising and falling toward its tip
  const tail = parts.tail;
  for (let y = 0; y < tail.h; y++) {
    for (let x = 0; x < tail.w; x++) {
      const v = tail.c[y * tail.w + x];
      if (v === NONE) continue;
      const lift = Math.round((p.tail || 0) * (TAIL_X - x) / TAIL_X);
      f.set(x + ox, y + oy - lift + bob, v);
    }
  }
  const legs = p.legs || [0, 0, 0, 0];
  drawLeg(f, parts.backLeg, legs[0], legs[1], ox, oy);
  drawLeg(f, parts.frontLeg, legs[2], legs[3], ox, oy);
  blit(f, parts.rest, ox, oy);
  blit(f, parts.upper, ox, oy + bob);
  // the mane stirs: the higher, the further (drawn as is and sheared, so it never opens a gap)
  blit(f, parts.mane, ox, oy + bob);
  if (sway) blit(f, parts.mane, ox, oy + bob, (y) => Math.round((sway * (MANE_Y - y)) / MANE_Y));
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

anim('idle', seq(6, (i) => ({ bob: [0, 0, 1, 1, 1, 0][i], sway: [0, 1, 2, 2, 1, 0][i], tail: [0, 1, 2, 2, 1, 0][i], light: 1 })));
anim('walk', seq(6, (i) => ({
  bob: [1, 0, 0, 1, 0, 0][i],
  sway: [-1, -2, -2, -1, -2, -2][i],
  tail: [1, 2, 3, 2, 1, 0][i],
  legs: [[4, 0, -4, 3], [2, 3, -2, 1], [-2, 3, 2, 0], [-4, 0, 4, 0], [-2, 0, 2, 3], [2, 0, -2, 3]][i],
  light: 1,
})));
// (the blow itself, and the great attack's drawings, the sword blazing)
for (const k of STILLS) anim(k, [{ still: k, big: !!ART[k].big, light: /-2$/.test(k) || ART[k].big ? 2 : 1 }]);
anim('stagger', [{ still: 'jump-4', dx: -3, light: 2 }, { still: 'jump-4', dx: -5, bob: 1, light: 2 }]);
anim('collapse', [{ still: 'jump-4', bob: 2, light: 0 }]);

const G = groups;
const single = (k) => ({ frames: G[k], fps: 1 });
export default {
  id: 'boss',
  src: import.meta.url, // (its module: what its baked sheet was made from, bake.js; and where a worker draws it, core.js)
  art: '/assets/boss/boss.json',
  extraArt: Object.fromEntries(STILLS.map((k) => [k, `/assets/boss/boss-${k}.json`])),
  firstName: 'Fenrath',
  epithet: 'the Crimson Fang',
  title: 'Great Enemy',
  frame: FRAME,
  bigFrame: BIG,
  cols: 8,
  px: 6.2 / 162, // world units per art pixel: a little under three times a Tarnished's height
  head: 150,
  hits: {},
  glowIntensity: 1.1,
  glowColors: [[200, 20, 20], [255, 120, 100]],
  seed: 6661,
  prepare,
  compose,
  poses,
  groups,
  anims: {
    idle: { frames: G.idle, fps: 4 },
    walk: { frames: G.walk, fps: 7 },
    stagger: { frames: G.stagger, fps: 3 },
    collapse: { frames: G.collapse, fps: 1 },
    ...Object.fromEntries(STILLS.map((k) => [k, single(k)])),
  },
  groupFps: { idle: 4, walk: 7, stagger: 3, collapse: 1, ...Object.fromEntries(STILLS.map((k) => [k, 1])) },
};
