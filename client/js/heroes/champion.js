// The Red Hammer, the night form of the Twofold (by day the Eternal Queen walks in his place; see
// twofold.js): a towering champion of cracked grey stone with a mane of red hair, one arm and half
// the face black and seamed with golden light. He carries a fractured hammer whose cracks glow,
// swings it up over his shoulder and brings it down in a burst of gold.
// Source art: assets/hero/champion.json (52x98, from champion-stand.webp), champion-hammer.json
// (29x30, the hammer alone, from champion-hammer.png, on the same grid) and champion-kneel.json
// (51x80, from champion-kneel.webp, its black background removed). His blow (champion-attack.json:
// the maul swung up over his head, brought down onto the ground in front, resting on his shoulder)
// and his Hammerfall (champion-ult.json: the crouch, airborne with the maul raised, the slam) are
// drawn whole; the maul reaches far above him and behind him, so they're kept in a bigger frame
// (core.js, bigFrame). Played by thee, he throws the maul (right click, his `spell`: combat.js),
// crouching as for Hammerfall, then stretched out after it, his hand open (champion-throw.json),
// till it comes back to him.

import { Img, NONE, blit, region, rotatable, drawRotated, prepareStill, composeStill, held } from './core.js';

const PAD = 16; // the hammer hangs left of the drawing: everything sits PAD columns to the right
const P = (x) => x + PAD;
const FRAME = { w: 100, h: 106 };
const MID = P(30); // between the feet
const GROUND = 96;
const OX = FRAME.w / 2 - MID;
const OY = FRAME.h - 1 - GROUND;

// Anatomy, in source-grid coordinates (moved PAD to the right).
const HAIR = 'DNSIF';
const GOLD = 'zxytqkmwf'; // the light in his cracks and the hammer's
const HIP = 80;
const BACK_LEG = { x0: P(12), x1: P(28) };
const FRONT_LEG = { x0: P(29), x1: P(48) };
const FOREARM = { x0: P(8), x1: P(20), y0: 46, y1: 65 }; // the stone forearm and the fist
const GRIP = { x: P(12.5), y: 61.5 }; // the fist on the haft: the hammer turns about it
const HAMMER_AT = { x: P(-13), y: 59 }; // where the hammer's own drawing sits on this grid
const HEAD_AT = { x: P(-5), y: 76 }; // the middle of the hammer's head
const REACH = Math.hypot(HEAD_AT.x - GRIP.x, HEAD_AT.y - GRIP.y);
const HEAD_ANGLE = Math.atan2(HEAD_AT.y - GRIP.y, HEAD_AT.x - GRIP.x);
const MANE = { x1: P(24), y0: 20, y1: 64 }; // the trailing hair sways below y0

// His drawn poses: per frame of each, the column set where his body's middle (the kilt's waistband)
// stands as he stands, and the row he stands on (airborne: his lowest toes).
const DRAWN = {
  attack: [
    { mid: 31, ground: 122 },
    { mid: 30, ground: 122 },
    { mid: 49, ground: 122 },
  ],
  ult: [
    { mid: 71, ground: 79 },
    { mid: 50, ground: 88 },
    { mid: 48, ground: 79 },
  ],
  // (the maul thrown: his middle halfway between his feet, as in the crouch before it)
  throw: [{ mid: 37, ground: 71, hand: [101, 14] }],
};
// the big frame: room for the maul raised high over him, lying far behind him in the crouch, and
// his hand stretched out far ahead after it as he throws it
const BIG = { w: 144, h: 124, anchor: 72 };
const PX = 2.8 / 96; // world units per art pixel: a head taller than the knight
// where his thrown maul leaves his open hand, [ahead, up] of his feet in world units (combat.js,
// throwMaul): its head a haft's length past his palm, the haft back to it
const muzzleAt = (d) => [(d.hand[0] - d.mid) * PX + 1, (d.ground - d.hand[1]) * PX];

function prepare(art, more = {}) {
  const { src, ids, code, addColor } = art;
  const body = new Img(src.w + PAD, src.h);
  blit(body, src, PAD, 0);
  const hammer = new Img(body.w, body.h);
  if (more.hammer) blit(hammer, more.hammer.src, HAMMER_AT.x, HAMMER_AT.y);
  const hair = ids(HAIR);
  const isHair = (x, y) => hair.has(body.get(x, y));
  const inForearm = (x, y) => x >= FOREARM.x0 && x <= FOREARM.x1 && y >= FOREARM.y0 && y <= FOREARM.y1 && !isHair(x, y);
  const inMane = (x, y) => isHair(x, y) && x <= MANE.x1 && y >= MANE.y0 && y < HIP;
  const inLeg = (leg) => (x, y) => y >= HIP && x >= leg.x0 && x <= leg.x1;
  const white = addColor('#fffbe6');
  const gold = addColor('#ffd34a');
  const amber = addColor('#e8900a');
  return {
    still: more.kneel && prepareStill(more.kneel, { ground: 78, mid: 26, neck: 24, waist: 46, cape: { x1: 14, y0: 30 } }),
    parts: {
      hammer: rotatable(hammer),
      forearm: region(body, inForearm),
      mane: region(body, inMane),
      backLeg: region(body, inLeg(BACK_LEG)),
      frontLeg: region(body, inLeg(FRONT_LEG)),
      body: region(body, (x, y) => !inForearm(x, y) && !inMane(x, y) && !inLeg(BACK_LEG)(x, y) && !inLeg(FRONT_LEG)(x, y)),
    },
    colors: { white, gold, amber },
    // the cracks never go dark; they smoulder, glow and flare
    energy: {
      hot: new Set([...ids(GOLD), gold, amber]),
      core: new Set([white]),
      soft: ids('zy'),
      dim: [code('U'), code('k')],
      flare: [gold, white],
      crackle: { main: code('q'), core: white, sparks: [code('m'), code('q'), amber] },
      odds: [[0.12, 0.42, 0.98], [0.08, 0.38, 0.96], [0.02, 0.1, 0.6]],
      bigOff: 'lit',
      keepAbove: 10,
      arcs: [0, 1, 3],
      sparks: [1, 2, 6],
      sparkReach: 8,
      sparkRise: 3, // embers float up
    },
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
  const { parts, colors } = ctx;
  const f = new Img(FRAME.w, FRAME.h);
  const bob = p.bob || 0;
  const ux = OX + (p.lean || 0);
  const uy = OY + bob;
  const glow = [];
  const put = (x, y, v) => {
    const fx = Math.round(x);
    const fy = Math.round(y);
    if (fx < 0 || fy < 0 || fx >= FRAME.w || fy >= FRAME.h) return;
    f.set(fx, fy, v);
    glow.push(fy * FRAME.w + fx);
  };

  // the mane, swaying (drawn as is and sheared, so it never opens a gap)
  const sway = p.sway || 0;
  blit(f, parts.mane, ux, uy);
  if (sway) blit(f, parts.mane, ux, uy, (y) => Math.round((sway * Math.max(0, y - MANE.y0)) / (MANE.y1 - MANE.y0)));

  const legs = p.legs || {};
  drawLeg(f, parts.backLeg, legs.back || {}, OX, OY);
  drawLeg(f, parts.frontLeg, legs.front || {}, OX, OY);
  blit(f, parts.body, ux, uy);

  // the forearm bends up (and forward), and the hammer turns about the fist, the fist over its haft
  // (none in it, `bare`, while he has thrown it: combat.js)
  const rx = p.reach || 0;
  const ly = p.lift || 0;
  const deg = p.hammer || 0;
  if (!p.bare) drawRotated(f, parts.hammer, deg, GRIP, ux + rx, uy - ly);
  blit(f, parts.forearm, ux + rx, uy - ly);
  const gx = GRIP.x + ux + rx;
  const gy = GRIP.y + uy - ly;

  // the arc the hammer's head has just swept
  if (p.trail) {
    const [a0, a1] = p.trail.map((d) => HEAD_ANGLE + (d * Math.PI) / 180);
    const steps = Math.ceil(Math.abs(a1 - a0) * (REACH + 8) * 1.5);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = a0 + (a1 - a0) * t;
      const thick = 1 + Math.round(3 * t);
      for (let k = 0; k < thick; k++) {
        const r = REACH + 7 - k;
        put(gx + r * Math.cos(a) - 0.5, gy + r * Math.sin(a) - 0.5, k === 0 ? colors.white : k === 1 ? colors.gold : colors.amber);
      }
    }
  }

  // where it lands: a burst of gold round the head and a crack of light running along the ground
  if (p.impact) {
    const a = HEAD_ANGLE + (deg * Math.PI) / 180;
    const hx = gx + REACH * Math.cos(a);
    const hy = gy + REACH * Math.sin(a);
    const n = 12;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + p.impact * 0.4;
      const r = 6 + p.impact * 4 + (i % 3);
      put(hx + r * Math.cos(ang), hy + r * Math.sin(ang) * 0.75, i % 2 ? colors.gold : colors.white);
    }
    const y0 = OY + GROUND;
    const len = 10 + p.impact * 8;
    for (let k = 0; k <= len; k++) {
      const yy = y0 - [0, 1, 1, 0, 0, 1, 2, 1][k % 8];
      put(hx + k, yy, k > len - 3 ? colors.amber : k % 3 ? colors.gold : colors.white);
      if (k % 6 === 4) put(hx + k + 1, yy - 1, colors.amber); // a branch of the crack
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

const idlePose = (i) => ({ bob: [0, 0, 1, 1, 1, 0][i], sway: [0, 1, 1, 0, -1, -1][i], hammer: [0, 1, 2, 2, 1, 0][i], light: 1 });
const walkPose = (i) => ({
  bob: [1, 0, 0, 1, 0, 0][i],
  sway: [-1, -2, -2, -1, -2, -2][i],
  hammer: [-3, -1, 1, 3, 1, -1][i],
  legs: {
    front: leg([3, 1, -1, -3, -1, 1][i], [0, 0, 0, 0, 2, 2][i]),
    back: leg([-3, -1, 1, 3, 1, -1][i], [0, 2, 2, 0, 0, 0][i]),
  },
  light: 1,
});
anim('idle', seq(6, idlePose));
anim('walk', seq(6, walkPose));
// (and so, his maul thrown and not yet back in his hand: pilot.js)
anim('idleBare', seq(6, (i) => ({ ...idlePose(i), bare: true })));
anim('walkBare', seq(6, (i) => ({ ...walkPose(i), bare: true })));
// up over the shoulder and down in front, in a sweep of gold; it lands in a burst
anim('strike', seq(6, (i) => ({
  hammer: [0, -12, 80, 160, 250, 270][i],
  lift: [0, 1, 8, 12, 3, 0][i],
  reach: [0, -1, 2, 5, 9, 9][i],
  lean: [0, -1, 0, 1, 2, 2][i],
  bob: [0, 0, 0, 0, 1, 1][i],
  sway: [0, 1, 2, 1, -1, -2][i],
  trail: [null, null, [-12, 80], [80, 160], [160, 250], null][i],
  impact: [0, 0, 0, 0, 1, 2][i],
  legs: { front: leg([0, 0, 1, 2, 2, 1][i]), back: leg([0, 0, 0, -1, -1, 0][i]) },
  light: [1, 1, 2, 2, 2, 2][i],
})));
// the hammer raised high, its cracks blazing
anim('cast', seq(4, (i) => ({ hammer: [138, 142, 146, 142][i], lift: 12, reach: 3, bob: i % 2, sway: [1, 2, 1, 2][i], light: 2 })));
anim('raise', seq(4, (i) => ({ hammer: [90, 98, 104, 98][i], lift: [6, 8, 9, 8][i], reach: 2, sway: [0, 1, 1, 0][i], light: 2 })));
anim('point', seq(2, (i) => ({ hammer: 215 + i * 2, lift: 6, reach: 6, lean: 1, light: 1 })));
// his kneeling drawing, as it is: it breathes, the mane stirs
anim('kneel', seq(2, (i) => ({ still: true, bob: i, sway: i, light: 1 })));
anim('rest', seq(2, (i) => ({ still: true, bob: i, sway: 1 - i, light: 0 })));
anim('pray', seq(2, (i) => ({ still: true, bob: i, sway: 1, light: 2 })));
anim('bow', seq(3, (i) => ({ lean: Math.min(1, i), bob: [0, 1, 2][i], hammer: [0, 2, 4][i], light: 0 })));
anim('study', seq(2, (i) => ({ bob: i, hammer: i, light: 0 })));
anim('stagger', seq(2, (i) => ({ lean: -2 - i, reach: -2, hammer: -10 - i * 4, sway: 2, legs: { front: leg(-1), back: leg(1) }, light: 2 })));
anim('collapse', [{ still: true, bob: 1, sway: 2, light: 0 }]);
anim('lifted', seq(2, (i) => ({ hammer: -6 - i * 4, sway: -3 + i, legs: { front: { dangle: -2 - i }, back: { dangle: -3 } }, light: 1 })));
anim('talk', seq(2, (i) => ({ bob: i, hammer: i, light: 1 })));
// drawn whole (core.js, composeDrawn), all in the big frame: his blow; Hammerfall's crouch, leap and slam
const drawnPose = (key, k, more = {}) => ({ drawn: key, frame: k, mid: DRAWN[key][k].mid, ground: DRAWN[key][k].ground, big: true, ...more });
anim('swing', [0, 1, 2].map((i) => drawnPose('attack', i, { light: [1, 2, 1][i] })));
anim('crouch', [drawnPose('ult', 0, { light: 1 })]);
anim('airborne', [drawnPose('ult', 1, { light: 2 })]);
anim('slam', [drawnPose('ult', 2, { light: 2 })]);
anim('release', [drawnPose('throw', 0, { light: 2 })]);

const G = groups;
export default {
  id: 'champion',
  src: import.meta.url, // (its module: what its baked sheet was made from, bake.js; and where a worker draws it, core.js)
  pair: 'twofold', // one hero with two forms: see twofold.js
  form: 'night',
  via: 'dusk', // the drawing worn while becoming this form
  art: '/assets/hero/champion.json',
  extraArt: { hammer: '/assets/hero/champion-hammer.json', kneel: '/assets/hero/champion-kneel.json', attack: '/assets/hero/champion-attack.json', ult: '/assets/hero/champion-ult.json', throw: '/assets/hero/champion-throw.json' },
  firstName: 'Ruadan',
  epithet: 'the Red Hammer',
  title: 'Champion',
  burst: ['#ffd34a', '#fff1c0'],
  frame: FRAME,
  bigFrame: BIG,
  cols: 8,
  px: PX,
  head: 95, // art pixels from the ground to the top of his hair
  hits: { hammer: 4, cast: 1, send: 1, attack: 4, spell: 4 },
  muzzles: { attack: muzzleAt(DRAWN.throw[0]) }, // (his maul thrown)
  lunge: { attack: 0.35 }, // (his drawing thrown forward as the maul comes down: npc.js)
  glowIntensity: 0.8, // he glows in many places at once: keep each one gentle
  glowColors: [[175, 108, 26], [236, 206, 140]],
  seed: 7713,
  prepare,
  compose,
  poses,
  groups,
  anims: {
    idle: { frames: G.idle, fps: 4 },
    walk: { frames: G.walk, fps: 8 },
    hammer: { frames: G.strike, fps: 8 },
    // (in eighteenths of a second: the maul raised 4, the blow 3, back on his shoulder 5)
    attack: { frames: held(G.swing, [4, 3, 5]), fps: 18 },
    crouch: { frames: G.crouch, fps: 1 },
    airborne: { frames: G.airborne, fps: 1 },
    slam: { frames: G.slam, fps: 1 },
    // (his maul thrown, right click, in eighteenths of a second: crouched 4, then stretched out after
    // it, held till it comes back: combat.js)
    spell: { frames: held([...G.crouch, ...G.release], [4, 6]), fps: 18, once: true },
    // (his maul thrown: about without it, and his hand held out for it as it comes back)
    idleBare: { frames: G.idleBare, fps: 4 },
    walkBare: { frames: G.walkBare, fps: 8 },
    catch: { frames: G.release, fps: 1 },
    read: { frames: G.study, fps: 1.4 },
    cast: { frames: G.cast, fps: 5 },
    send: { frames: G.raise, fps: 4 },
    kneel: { frames: G.kneel, fps: 1.5 },
    sit: { frames: G.rest, fps: 1 },
    doze: { frames: G.rest, fps: 0.6 },
    bow: { frames: [...G.bow, G.bow[2], G.bow[2], G.bow[0]], fps: 3, once: true },
    wave: { frames: [...G.raise, ...G.raise], fps: 6, once: true },
    point: { frames: [...G.point, ...G.point], fps: 2, once: true },
    cheer: { frames: [...G.cast, ...G.cast], fps: 7, once: true },
    pray: { frames: G.pray, fps: 1.5 },
    collapse: { frames: G.collapse, fps: 1 },
    lifted: { frames: G.lifted, fps: 4 },
    talk: { frames: G.talk, fps: 2.5 },
    stagger: { frames: [...G.stagger, G.idle[0]], fps: 4, once: true },
    kneelBow: { frames: [G.kneel[0], ...G.rest, G.rest[1], G.kneel[0]], fps: 2, once: true },
  },
  groupFps: { idle: 4, walk: 8, idleBare: 4, walkBare: 8, strike: 8, cast: 5, raise: 4, point: 2, kneel: 1.5, rest: 1, pray: 1.5, bow: 3, study: 1.4, stagger: 4, collapse: 1, lifted: 4, talk: 2.5, swing: 5, crouch: 1, airborne: 1, slam: 1, release: 1 },
};
