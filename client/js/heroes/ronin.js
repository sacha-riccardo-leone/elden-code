// The Ronin of the Iron Kasa: a wanderer in plate under a lattice-iron hat, wrapped in a ragged
// brown cloak and scarf, a long curved blade carried low in one hand.
// Source art: assets/hero/ronin.json (114x118, from ronin-stand.webp) and ronin-kneel.json
// (125x104, from ronin-kneel.webp). His cut (ronin-attack.json: crouched, the blade drawn back low
// behind him; the wide cut forward; the follow-through, the blade high behind him) and his
// Iaijutsu (ronin-ult.json: the drawing stance, his blade sheathed in a black scabbard at his hip;
// the dash; sliding the blade home) are drawn whole; the blade reaches far ahead of him and behind,
// so they're kept in a bigger frame (core.js, bigFrame).

import { Img, NONE, region, blit, rotatable, drawRotated, prepareStill, composeStill, held } from './core.js';

const FRAME = { w: 160, h: 120 };
const MID = 43; // source column between the boots
const GROUND = 116;
const OX = FRAME.w / 2 - MID;
const OY = FRAME.h - 1 - GROUND;

// Anatomy, in source-grid coordinates.
const HIP = 100;
const NECK = 38; // above: the kasa and the face beneath it
const BACK_LEG = { x0: 23, x1: 39 };
const FRONT_LEG = { x0: 42, x1: 62 };
const CAPE_Y = 62; // the cloak hanging on the left sways below this row
const capeEdge = (y) => (y < 78 ? 18 : 21); // its right edge (the arm is beside it higher up)
const TAIL = { x0: 56, y0: 58, y1: 107 }; // the scarf's loose end, on the right
const GRIP = { x: 25.5, y: 79.5 }; // the gloved hand on the hilt: the blade turns about it
const HAND = { x0: 22, x1: 29, y0: 77, y1: 83 };
const HANDLE = [[12.5, 72.5], [29.5, 80.5]];
const BLADE = [[30.5, 80.5], [56.5, 89.5], [78.5, 95.5], [99.5, 99.5], [113.5, 101.5]]; // curving to the tip
const END = BLADE[BLADE.length - 1];
const TIP = Math.hypot(END[0] - GRIP.x, END[1] - GRIP.y);
const TIP_ANGLE = Math.atan2(END[1] - GRIP.y, END[0] - GRIP.x);

// His drawn poses: per frame of each, the column set where his body's middle (the ring on his
// sash) stands as he stands, and the row he stands on.
const DRAWN = {
  attack: [
    { mid: 118, ground: 105 },
    { mid: 84, ground: 105 },
    { mid: 96, ground: 104 },
  ],
  ult: [
    { mid: 72, ground: 90 },
    { mid: 94, ground: 77 },
    { mid: 77, ground: 106 },
  ],
};
// the big frame: room for the blade drawn back far behind him, and thrust far ahead in the dash
const BIG = { w: 250, h: 110, anchor: 119 };

function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
const inHand = (x, y) => x >= HAND.x0 && x <= HAND.x1 && y >= HAND.y0 && y <= HAND.y1;
function isSword(x, y) {
  if (inHand(x, y)) return false;
  const px = x + 0.5;
  const py = y + 0.5;
  if (x >= 11 && x <= 21) return segDist(px, py, ...HANDLE) <= 2.2;
  if (x >= 64 && y >= 84) return true; // past his legs nothing but the blade hangs this low
  if (x < 30) return false;
  for (let i = 1; i < BLADE.length; i++) if (segDist(px, py, BLADE[i - 1], BLADE[i]) <= 3) return true;
  return false;
}
const isCape = (x, y) => y >= CAPE_Y && x <= capeEdge(y);
const isTail = (x, y) => x >= TAIL.x0 && y >= TAIL.y0 && y <= TAIL.y1;
const legRange = (y) => [
  [BACK_LEG.x0, BACK_LEG.x1],
  [FRONT_LEG.x0, y < 109 ? 56 : FRONT_LEG.x1],
];

function prepare(art, more = {}) {
  const { src, ids, code } = art;
  const sword = region(src, isSword);
  // Cloth hidden under the blade: carry what hangs below it straight up (or what is above down).
  const body = region(src, (x, y) => !isSword(x, y) && !inHand(x, y));
  for (let x = 30; x < src.w; x++) {
    let y = 0;
    while (y < src.h) {
      if (!(isSword(x, y) && src.get(x, y) !== NONE)) { y++; continue; }
      const ya = y;
      while (y < src.h && isSword(x, y) && src.get(x, y) !== NONE) y++;
      const below = body.get(x, y);
      const above = body.get(x, ya - 1);
      if (below !== NONE) for (let k = ya; k < y; k++) body.set(x, k, below);
      else if (above !== NONE) for (let k = ya; k < Math.min(y, ya + 2); k++) body.set(x, k, above);
    }
  }
  const inLeg = (leg) => (x, y) => y >= HIP && x >= legRange(y)[leg][0] && x <= legRange(y)[leg][1];
  const taken = (x, y) => y < NECK || isCape(x, y) || isTail(x, y) || inLeg(0)(x, y) || inLeg(1)(x, y);
  return {
    still: more.kneel && prepareStill(more.kneel, {
      ground: 102, mid: 49, neck: 40, waist: 58, cape: { x1: 26, y0: 62 },
    }),
    parts: {
      sword: rotatable(sword),
      hand: region(src, inHand),
      head: region(body, (x, y) => y < NECK),
      cape: region(body, isCape),
      tail: region(body, (x, y) => isTail(x, y) && !inLeg(1)(x, y)),
      backLeg: region(body, (x, y) => inLeg(0)(x, y) && !isCape(x, y)),
      frontLeg: region(body, (x, y) => inLeg(1)(x, y)),
      body: region(body, (x, y) => !taken(x, y)),
    },
    // no magic: only the slash trail and the glint glow, steadily
    energy: {
      hot: new Set(),
      core: new Set(),
      soft: ids('rq'),
      dim: [0, 0],
      flare: [0, 0],
      crackle: { main: 0, core: 0, sparks: [0] },
      arcs: [0, 0, 0],
      sparks: [0, 0, 0],
    },
    white: code('r'),
    pale: code('q'),
    light: code('n'),
  };
}

function drawLeg(dst, leg, { stride = 0, lift = 0, dangle = 0 }, dx, dy) {
  const span = GROUND - HIP;
  for (let y = HIP; y <= GROUND; y++) {
    const t = (y - HIP) / span;
    const shift = Math.round(stride * t + dangle * t * t);
    const up = Math.round(lift * t);
    for (let x = 0; x < leg.w; x++) {
      const v = leg.get(x, y);
      if (v !== NONE) dst.set(x + dx + shift, y + dy - up, v);
    }
  }
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
  if (p.still) return composeStill(ctx.still, p, FRAME);
  const { parts } = ctx;
  const f = new Img(FRAME.w, FRAME.h);
  const bob = p.bob || 0;
  const lean = p.lean || 0;
  const ux = OX + lean;
  const uy = OY + bob;
  const glow = [];

  // the cloak behind him, its hem swaying
  const sway = p.sway || 0;
  blitSheared(f, parts.cape, ux, uy, (y) => (y < CAPE_Y ? 0 : Math.round((sway * (y - CAPE_Y)) / (GROUND - CAPE_Y))));

  // legs stay planted (the far one first)
  const legs = p.legs || {};
  drawLeg(f, parts.backLeg, legs.back || {}, OX, OY);
  drawLeg(f, parts.frontLeg, legs.front || {}, OX, OY);

  blit(f, parts.body, ux, uy);
  const tail = p.tail ?? -sway;
  blitSheared(f, parts.tail, ux, uy, (y) => Math.round((tail * Math.max(0, y - TAIL.y0)) / (TAIL.y1 - TAIL.y0)));
  const hd = p.head || [0, 0];
  blit(f, parts.head, ux + hd[0], uy + hd[1]);

  // the blade turns about the hand on its hilt
  const deg = p.sword || 0;
  drawRotated(f, parts.sword, deg, GRIP, ux, uy);
  blit(f, parts.hand, ux, uy);

  const put = (x, y, v) => {
    const fx = Math.round(x) + ux;
    const fy = Math.round(y) + uy;
    if (fx < 0 || fy < 0 || fx >= FRAME.w || fy >= FRAME.h) return;
    f.set(fx, fy, v);
    glow.push(fy * FRAME.w + fx);
  };
  // the arc the tip has just swept, thickening toward the blade
  if (p.trail) {
    const [a0, a1] = p.trail.map((d) => TIP_ANGLE + (d * Math.PI) / 180);
    const steps = Math.ceil(Math.abs(a1 - a0) * TIP * 1.5);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = a0 + (a1 - a0) * t;
      const thick = 1 + Math.round(3 * t);
      for (let k = 0; k < thick; k++) {
        const r = TIP + 1 - k;
        put(GRIP.x + r * Math.cos(a) - 0.5, GRIP.y + r * Math.sin(a) - 0.5, k === 0 ? ctx.white : k === 1 ? ctx.pale : ctx.light);
      }
    }
  }
  // a glint running along the blade
  if (p.glint != null) {
    const a = TIP_ANGLE + (deg * Math.PI) / 180;
    const r = TIP * p.glint;
    const gx = GRIP.x + r * Math.cos(a) - 0.5;
    const gy = GRIP.y + r * Math.sin(a) - 0.5;
    put(gx, gy, ctx.white);
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(gx + ax, gy + ay, ctx.pale);
    if (p.glint > 0.3) for (const [ax, ay] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) put(gx + ax, gy + ay, ctx.light);
  }
  f.keep = glow;
  return f;
}

// ---------------------------------------------------------------------------------------------
// the animation set

const leg = (stride, lift = 0) => ({ stride, lift });
const poses = [];
const groups = {};
function anim(name, list) {
  groups[name] = list.map((p) => { poses.push(p); return poses.length - 1; });
}
const seq = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));

anim('idle', seq(6, (i) => ({ bob: [0, 0, 1, 1, 1, 0][i], sway: [0, 1, 1, 0, -1, -1][i] })));
anim('walk', seq(6, (i) => ({
  bob: [1, 0, 0, 1, 0, 0][i],
  sway: [-1, -2, -3, -2, -2, -3][i],
  tail: [-1, -1, -2, -1, -1, -2][i],
  sword: [1, 0, -1, 1, 0, -1][i],
  legs: {
    front: leg([3, 1, -1, -3, -1, 1][i], [0, 0, 0, 0, 2, 2][i]),
    back: leg([-3, -1, 1, 3, 1, -1][i], [0, 2, 2, 0, 0, 0][i]),
  },
})));
anim('strike', seq(6, (i) => ({
  sword: [0, -35, -70, -14, 9, 5][i],
  lean: [0, -1, -2, 1, 2, 1][i],
  bob: [0, 0, 0, 1, 1, 0][i],
  sway: [0, 1, 2, -1, -2, -1][i],
  legs: { front: leg([0, 0, -1, 2, 3, 2][i]), back: leg([0, 0, 1, -1, -2, -1][i]) },
  trail: [null, null, null, [-70, -14], [-34, 9], null][i],
})));
anim('cast', seq(4, (i) => ({ sword: [-14, -16, -16, -14][i], lean: 1, bob: i % 2, glint: [0.2, 0.5, 0.8, null][i] })));
anim('raise', seq(4, (i) => ({ sword: [-30, -55, -62, -58][i], sway: [0, 1, 1, 0][i], glint: [null, 0.6, 0.95, null][i] })));
anim('point', seq(2, (i) => ({ sword: -14 - i, lean: 1, legs: { front: leg(2), back: leg(-1) } })));
anim('kneel', seq(2, (i) => ({ still: true, bob: i, sway: i })));
anim('rest', seq(2, (i) => ({ still: true, bob: i, head: [1, 1], sway: 1 - i })));
anim('pray', seq(2, (i) => ({ still: true, bob: i, head: [1, 2], sway: 2 })));
anim('bow', seq(3, (i) => ({ head: [[1, 1], [2, 2], [2, 3]][i], lean: Math.min(1, i), sword: [2, 4, 5][i] })));
anim('study', seq(2, (i) => ({ head: [1, 1], bob: i })));
anim('stagger', seq(2, (i) => ({ lean: -2 - i, sword: -12 - i * 8, sway: 2, legs: { front: leg(-1), back: leg(1) } })));
anim('collapse', [{ still: true, head: [2, 3], sway: 2 }]);
anim('lifted', seq(2, (i) => ({ sway: -3 + i, tail: -2 + i, sword: -6 - i * 4, legs: { front: { dangle: -2 - i }, back: { dangle: -3 } } })));
anim('talk', seq(2, (i) => ({ sword: i ? -3 : 0, bob: i })));
// drawn whole (core.js, composeDrawn), all in the big frame: his cut; Iaijutsu's stance, dash and
// sheathing
const drawnPose = (key, k, more = {}) => ({ drawn: key, frame: k, mid: DRAWN[key][k].mid, ground: DRAWN[key][k].ground, big: true, ...more });
anim('swing', [0, 1, 2].map((i) => drawnPose('attack', i)));
anim('stance', [drawnPose('ult', 0)]);
anim('dash', [drawnPose('ult', 1)]);
anim('sheathe', [drawnPose('ult', 2)]);

const G = groups;
export default {
  id: 'ronin',
  art: '/assets/hero/ronin.json',
  extraArt: { kneel: '/assets/hero/ronin-kneel.json', attack: '/assets/hero/ronin-attack.json', ult: '/assets/hero/ronin-ult.json' },
  epithet: 'of the Iron Kasa',
  title: 'Ronin',
  burst: ['#e8e2d0', '#ffffff'],
  frame: FRAME,
  bigFrame: BIG,
  cols: 8,
  px: 2.05 / 80, // world units per art pixel: his face, under the kasa, is level with the knight's visor
  head: 112, // art pixels from the ground to the tip of the kasa
  hits: { hammer: 4, cast: 1, send: 2, attack: 4 },
  lunge: { attack: 0.35 }, // (his drawing thrown forward as the blade cuts: npc.js)
  glowIntensity: 0.9,
  glowColors: [[150, 140, 120], [255, 248, 228]],
  seed: 7130,
  prepare,
  compose,
  poses,
  groups,
  anims: {
    idle: { frames: G.idle, fps: 4 },
    walk: { frames: G.walk, fps: 9 },
    hammer: { frames: G.strike, fps: 9 },
    // (in eighteenths of a second: drawn back 4, the cut 3, the follow-through 5)
    attack: { frames: held(G.swing, [4, 3, 5]), fps: 18 },
    stance: { frames: G.stance, fps: 1 },
    dash: { frames: G.dash, fps: 1 },
    sheathe: { frames: G.sheathe, fps: 1 },
    read: { frames: G.study, fps: 1.4 },
    cast: { frames: G.cast, fps: 5 },
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
  groupFps: { idle: 4, walk: 9, strike: 9, cast: 5, raise: 4, point: 2, kneel: 1.5, rest: 1, pray: 3, bow: 3, study: 1.4, stagger: 4, collapse: 1, lifted: 4, talk: 2.5, swing: 5, stance: 1, dash: 1, sheathe: 1 },
};
