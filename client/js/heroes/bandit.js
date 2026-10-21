// The Bandit Knight: a bald, grinning brawler in a black scarf and patched leathers, a long spear
// in one fist and a tower shield in the other. No sorcery: the spear sweeps over his head and
// lunges, and the shield comes up to guard.
// Source art: assets/hero/bandit.json (59x81, from bandit-stand.webp) and bandit-kneel.json
// (44x50, his resting squat from bandit-kneel.webp, used exactly as drawn). His lunge
// (bandit-attack.json: the spear cocked over his head, thrust out past the shield, drawn back
// upright; his size, his skin's shades and his eye those of his standing pose) and his Tenfold
// Spears (bandit-ult.json: the spear cocked back like a javelin, then thrown, his hand open) are
// drawn whole; the spear reaches far beyond his frame, so they're kept in a bigger one (core.js,
// bigFrame). Played by thee, he throws a single spear with the same two drawings (right click, his
// `spell`: combat.js).

import { Img, NONE, region, blit, rotatable, drawRotated, prepareStill, composeStill, held } from './core.js';

const FRAME = { w: 92, h: 86 };
const MID = 33; // source column between the boots
const GROUND = 79;
const OX = FRAME.w / 2 - MID;
const OY = FRAME.h - 1 - GROUND;

// Anatomy, in source-grid coordinates.
const HIP = 63;
const BACK_LEG = { x0: 22, x1: 33 };
const FRONT_LEG = { x0: 34, x1: 43 };
const SHIELD = { x0: 44, y0: 37 };
const HEAD = { x0: 23, y1: 31 };
const HAND = { x0: 14, x1: 22, y0: 48, y1: 57 };
const shaftX = (y) => 10.5 + (y - 30.5) / 3; // the shaft's centre line, leaning left toward the top
const GRIP = { x: shaftX(52.5), y: 52.5 }; // his fist on the shaft: the spear turns about it
const TIP = { x: 2, y: 1.5 };
const REACH = Math.hypot(TIP.x - GRIP.x, TIP.y - GRIP.y);
const TIP_ANGLE = Math.atan2(TIP.y - GRIP.y, TIP.x - GRIP.x);

// His drawn poses: per frame of each, the column set where his body's middle (the green tunic)
// stands as he stands, and the row he stands on; thrown, where the spears leave his hand (`from`).
const DRAWN = {
  attack: [
    { mid: 43, ground: 69 },
    { mid: 28, ground: 51 },
    { mid: 32, ground: 77 },
  ],
  ult: [
    { mid: 67, ground: 74 },
    { mid: 60, ground: 70, from: [108, 27] },
  ],
};
// the big frame: room for the spear held level far ahead and behind, and upright above him
const BIG = { w: 182, h: 90, anchor: 76 };
const PX = 2.0 / 51; // world units per art pixel: his eyes sit just below the knight's visor
// where the spears leave him, [ahead, up] of his feet in world units (ults.js)
const muzzleAt = (d) => [(d.from[0] - d.mid) * PX, (d.ground - d.from[1]) * PX];

const inHand = (x, y) => x >= HAND.x0 && x <= HAND.x1 && y >= HAND.y0 && y <= HAND.y1;
function isSpear(x, y) {
  if (inHand(x, y)) return false;
  if (y <= 20 && x <= 10) return true; // the blade
  if (y >= 19 && y <= 27 && x <= 14) return true; // its crossbar
  const d = Math.abs(x + 0.5 - shaftX(y + 0.5));
  return y > 27 && y <= 77 && d <= (y > 69 ? 1.3 : 2.4);
}
const isShield = (x, y) => x >= SHIELD.x0 && y >= SHIELD.y0;

function prepare(art, more = {}) {
  const { src, ids, code } = art;
  // what the shaft hid: carry what lies below it up (or above it down)
  const body = region(src, (x, y) => !isSpear(x, y) && !inHand(x, y));
  for (let x = 15; x < 30; x++) {
    let y = 28;
    while (y < src.h) {
      if (!(isSpear(x, y) && src.get(x, y) !== NONE)) { y++; continue; }
      const ya = y;
      while (y < src.h && isSpear(x, y) && src.get(x, y) !== NONE) y++;
      const below = body.get(x, y);
      if (below !== NONE) for (let k = ya; k < y; k++) body.set(x, k, below);
    }
  }
  const inLeg = (leg) => (x, y) => y >= HIP && x >= leg.x0 && x <= leg.x1;
  const isHead = (x, y) => y <= HEAD.y1 && x >= HEAD.x0 && !isShield(x, y);
  return {
    // his resting squat, as drawn: it only breathes (head and chest sink a pixel and rise)
    still: more.kneel && prepareStill(more.kneel, { ground: 48, mid: 22, neck: 13, waist: 30 }),
    parts: {
      spear: rotatable(region(src, isSpear)),
      hand: region(src, inHand),
      shield: region(body, isShield),
      head: region(body, isHead),
      backLeg: region(body, (x, y) => inLeg(BACK_LEG)(x, y) && !isShield(x, y)),
      frontLeg: region(body, (x, y) => inLeg(FRONT_LEG)(x, y) && !isShield(x, y)),
      body: region(body, (x, y) => !isShield(x, y) && !isHead(x, y) && !inLeg(BACK_LEG)(x, y) && !inLeg(FRONT_LEG)(x, y)),
    },
    // no magic: only the spear's sweep glows, and steadily
    energy: {
      hot: new Set(), core: new Set(), soft: ids('fe'), dim: [0, 0], flare: [0, 0],
      crackle: { main: 0, core: 0, sparks: [0] }, arcs: [0, 0, 0], sparks: [0, 0, 0],
    },
    white: code('f'),
    pale: code('e'),
    light: code('c'),
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

function compose(ctx, p) {
  if (p.still) return composeStill(ctx.still, p, FRAME);
  const { parts } = ctx;
  const f = new Img(FRAME.w, FRAME.h);
  const bob = p.bob || 0;
  const lean = p.lean || 0;
  const ux = OX + lean;
  const uy = OY + bob;
  const glow = [];
  const put = (x, y, v) => {
    const fx = Math.round(x);
    const fy = Math.round(y);
    if (fx < 0 || fy < 0 || fx >= FRAME.w || fy >= FRAME.h) return;
    f.set(fx, fy, v);
    glow.push(fy * FRAME.w + fx);
  };

  const legs = p.legs || {};
  drawLeg(f, parts.backLeg, legs.back || {}, OX, OY);
  drawLeg(f, parts.frontLeg, legs.front || {}, OX, OY);
  blit(f, parts.body, ux, uy);
  const hd = p.head || [0, 0];
  blit(f, parts.head, ux + hd[0], uy + hd[1]);
  // the shield comes up (and forward) to guard
  const [sx, sy] = p.shield || [0, 0];
  blit(f, parts.shield, ux + sx, uy - sy);

  // the spear turns about his fist
  const deg = p.spear || 0;
  drawRotated(f, parts.spear, deg, GRIP, ux, uy);
  blit(f, parts.hand, ux, uy);

  // the arc the spear's point has just swept
  if (p.trail) {
    const [a0, a1] = p.trail.map((d) => TIP_ANGLE + (d * Math.PI) / 180);
    const steps = Math.ceil(Math.abs(a1 - a0) * REACH * 1.5);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = a0 + (a1 - a0) * t;
      const thick = 1 + Math.round(2 * t);
      for (let k = 0; k < thick; k++) {
        const r = REACH + 1 - k;
        put(GRIP.x + ux + r * Math.cos(a) - 0.5, GRIP.y + uy + r * Math.sin(a) - 0.5, k === 0 ? ctx.white : k === 1 ? ctx.pale : ctx.light);
      }
    }
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

anim('idle', seq(6, (i) => ({ bob: [0, 0, 1, 1, 1, 0][i] })));
anim('walk', seq(6, (i) => ({
  bob: [1, 0, 0, 1, 0, 0][i],
  spear: [2, 1, 0, 2, 1, 0][i],
  shield: [0, [0, 1, 1, 0, 1, 1][i]],
  legs: {
    front: leg([2, 1, -1, -2, -1, 1][i], [0, 0, 0, 0, 2, 2][i]),
    back: leg([-2, -1, 1, 2, 1, -1][i], [0, 2, 2, 0, 0, 0][i]),
  },
})));
// draw the spear back, sweep it over his head and lunge
anim('strike', seq(6, (i) => ({
  spear: [0, -12, 35, 85, 100, 70][i],
  lean: [0, -1, 0, 2, 2, 1][i],
  bob: [0, 0, 0, 1, 1, 0][i],
  legs: { front: leg([0, 0, 1, 2, 2, 1][i]), back: leg([0, 0, 0, -1, -1, 0][i]) },
  trail: [null, null, [-12, 35], [35, 85], [70, 100], null][i],
})));
// shield up: on guard
anim('cast', seq(4, (i) => ({ shield: [1, [2, 3, 3, 2][i]], lean: -1, spear: -4, bob: i % 2 })));
anim('raise', seq(4, (i) => ({ spear: [8, 14, 16, 12][i], shield: [0, [1, 2, 2, 1][i]], bob: i % 2 })));
anim('point', seq(2, (i) => ({ spear: 96 + i, lean: 1, legs: { front: leg(1), back: leg(-1) } })));
anim('kneel', seq(2, (i) => ({ still: true, bob: i })));
anim('rest', seq(2, (i) => ({ still: true, bob: i })));
anim('pray', seq(2, (i) => ({ still: true, bob: i })));
anim('bow', seq(3, (i) => ({ head: [[1, 1], [1, 2], [2, 2]][i], lean: Math.min(1, i) })));
anim('study', seq(2, (i) => ({ head: [1, 1], bob: i })));
anim('stagger', seq(2, (i) => ({ lean: -2 - i, spear: -8 - i * 4, shield: [-1, 0], legs: { front: leg(-1), back: leg(1) } })));
anim('collapse', [{ still: true, bob: 1 }]);
anim('lifted', seq(2, (i) => ({ spear: -6 - i * 3, shield: [0, -1], legs: { front: { dangle: -2 - i }, back: { dangle: -2 } } })));
anim('talk', seq(2, (i) => ({ bob: i, spear: i ? 3 : 0 })));
// drawn whole (core.js, composeDrawn), all in the big frame: his lunge; Tenfold Spears cocked
// and thrown
const drawnPose = (key, k) => ({ drawn: key, frame: k, mid: DRAWN[key][k].mid, ground: DRAWN[key][k].ground, big: true });
anim('lunge', [0, 1, 2].map((i) => drawnPose('attack', i)));
anim('cock', [drawnPose('ult', 0)]);
anim('throw', [drawnPose('ult', 1)]);

const G = groups;
export default {
  id: 'bandit',
  src: import.meta.url, // (its module: what its baked sheet was made from, bake.js; and where a worker draws it, core.js)
  art: '/assets/hero/bandit.json',
  extraArt: { kneel: '/assets/hero/bandit-kneel.json', ult: '/assets/hero/bandit-ult.json', attack: '/assets/hero/bandit-attack.json' },
  epithet: 'of the Broken Road',
  title: 'Bandit Knight',
  burst: ['#f0854d', '#faf2e0'],
  frame: FRAME,
  bigFrame: BIG,
  cols: 8,
  px: PX,
  head: 61, // art pixels from the ground to the top of his head
  hits: { hammer: 4, cast: 1, send: 1, attack: 4, spell: 4 },
  feet: 'chain', // (each foot heard as it's set down: in armour, its chain clinking, npc.js)
  lunge: { attack: 0.35 }, // (his drawing thrown forward as the spear drives out: npc.js)
  // (where his spears leave his open hand: the Tenfold Spears, and the one he throws, right click)
  muzzles: { ult: muzzleAt(DRAWN.ult[1]), attack: muzzleAt(DRAWN.ult[1]) },
  glowIntensity: 0.8,
  glowColors: [[150, 140, 120], [250, 240, 220]],
  seed: 3141,
  prepare,
  compose,
  poses,
  groups,
  anims: {
    idle: { frames: G.idle, fps: 4 },
    walk: { frames: G.walk, fps: 9 },
    hammer: { frames: G.strike, fps: 9 },
    // (in eighteenths of a second: the spear cocked 4, the lunge 3, drawn back 5)
    attack: { frames: held(G.lunge, [4, 3, 5]), fps: 18 },
    ult: { frames: G.cock, fps: 1 },
    throw: { frames: G.throw, fps: 1 },
    // (a spear thrown, right click, in eighteenths of a second: cocked back 4, thrown 6)
    spell: { frames: held([...G.cock, ...G.throw], [4, 6]), fps: 18 },
    read: { frames: G.study, fps: 1.4 },
    cast: { frames: G.cast, fps: 4 },
    send: { frames: G.raise, fps: 4 },
    kneel: { frames: G.kneel, fps: 1.5 },
    sit: { frames: G.rest, fps: 1 },
    doze: { frames: G.rest, fps: 0.6 },
    bow: { frames: [...G.bow, G.bow[2], G.bow[2], G.bow[0]], fps: 3, once: true },
    wave: { frames: [...G.raise, ...G.raise], fps: 6, once: true },
    point: { frames: [...G.point, ...G.point], fps: 2, once: true },
    cheer: { frames: [...G.raise, ...G.raise], fps: 7, once: true },
    pray: { frames: G.pray, fps: 1.5 },
    collapse: { frames: G.collapse, fps: 1 },
    lifted: { frames: G.lifted, fps: 4 },
    talk: { frames: G.talk, fps: 2.5 },
    stagger: { frames: [...G.stagger, G.idle[0]], fps: 4, once: true },
    kneelBow: { frames: [G.kneel[0], ...G.rest, G.rest[1], G.kneel[0]], fps: 2, once: true },
  },
  groupFps: { idle: 4, walk: 9, strike: 9, cast: 4, raise: 4, point: 2, kneel: 1.5, rest: 1, pray: 1.5, bow: 3, study: 1.4, stagger: 4, collapse: 1, lifted: 4, talk: 2.5, lunge: 5, cock: 1, throw: 1 },
};
