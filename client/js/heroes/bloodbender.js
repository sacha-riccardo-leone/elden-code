// Vael, the Crimson Weaver: a masked sorcerer in blood-soaked wraps and a hooded shawl. Blood magic coils
// around one fist; it spins, flares and lashes out like a whip.
// Source art: assets/hero/bloodbender.json (70x102, from bloodbender-stand.webp) and
// bloodbender-kneel.json (70x77, from bloodbender-kneel.webp); drawn whole, his Crimson Mire
// (bloodbender-ult.json, from ult-vael.png) and his cast (bloodbender-attack.json, from
// atk-vael.png).

import { Img, NONE, region, blit, rotatable, drawRotated, prepareStill, composeStill, held } from './core.js';

// (room above him for the arm raised high and the blood streaming up it)
const FRAME = { w: 124, h: 140 };
const MID = 37; // source column between the boots
const GROUND = 100;
const OX = FRAME.w / 2 - MID;
const OY = FRAME.h - 1 - GROUND;

// Anatomy, in source-grid coordinates.
const HIP = 90;
const NECK = 31; // above: hood and mask
const BACK_LEG = { x0: 17, x1: 30 };
const FRONT_LEG = { x0: 36, x1: 57 };
const CAPE = { x1: 15, y0: 40 }; // the ragged sleeve hanging on the left
const HEM = 72; // the tunic's tatters sway below this row
const ARM = { x0: 46, y0: 46, y1: 67 }; // the outstretched forearm and fist (with the shawl's end)
const FIST = { x: 56.5, y: 59.5 }; // the blood coils around this point
const MAGIC = 'HF'; // the blood magic's own reds (the stains on the cloth are darker)

function prepare(art, more = {}) {
  const { src, ids, code, addColor } = art;
  const magic = ids(MAGIC);
  const isMagic = (x, y) => magic.has(src.get(x, y));
  const inArm = (x, y) => x >= ARM.x0 && y >= ARM.y0 && y <= ARM.y1 && !isMagic(x, y);
  const inLeg = (leg) => (x, y) => y >= HIP && x >= leg.x0 && x <= leg.x1;
  const isCape = (x, y) => x <= CAPE.x1 && y >= CAPE.y0;
  const bright = addColor('#c0101c'); // fresh blood, brighter than anything in the drawing
  const hot = addColor('#ff4a3a');
  let still = null;
  if (more.kneel) {
    const k = more.kneel;
    const kMagic = k.ids(MAGIC);
    still = prepareStill(k, {
      ground: 75, mid: 37, neck: 26, waist: 42, cape: { x1: 14, y0: 40 },
      float: (x, y) => x >= 52 && kMagic.has(k.src.get(x, y)),
    });
  }
  return {
    still,
    parts: {
      swirl: rotatable(region(src, isMagic)),
      arm: region(src, inArm),
      head: region(src, (x, y) => y < NECK && !isMagic(x, y)),
      cape: region(src, (x, y) => isCape(x, y) && y < HIP),
      backLeg: region(src, inLeg(BACK_LEG)),
      frontLeg: region(src, inLeg(FRONT_LEG)),
      body: region(src, (x, y) => y >= NECK && !isMagic(x, y) && !inArm(x, y) && !isCape(x, y)
        && !inLeg(BACK_LEG)(x, y) && !inLeg(FRONT_LEG)(x, y)),
    },
    colors: { blood: code('H'), dark: code('F'), bright, hot },
    energy: {
      hot: new Set([...magic, bright]),
      core: new Set([hot]),
      soft: new Set(),
      dim: [code('E'), code('F')],
      flare: [bright, hot],
      crackle: { main: code('H'), core: bright, sparks: [code('H'), code('F')] },
      odds: [[0.3, 0.5, 0.96], [0.16, 0.3, 0.88], [0.04, 0.12, 0.55]],
      bigOff: 'lit',
      keepAbove: 30,
      arcs: [1, 2, 4],
      sparks: [2, 4, 8],
      sparkReach: 8,
      sparkRise: -2, // drops fall
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

// The arm reaches forward and lifts from the elbow: each column moves by its share of the
// motion; the gaps that opens are filled by stretching the wraps.
function drawArm(dst, arm, reach, lift, dx, dy) {
  const share = (x) => Math.max(0, Math.min(1, (x - ARM.x0) / 8));
  for (let x = 0; x < arm.w; x++) {
    const ox = Math.round(reach * share(x));
    const prev = Math.round(reach * share(x - 1));
    const up = Math.round(lift * share(x));
    let bottom = -1;
    for (let y = 0; y < arm.h; y++) {
      const v = arm.c[y * arm.w + x];
      if (v === NONE) continue;
      for (let k = Math.min(ox, prev + 1); k <= ox; k++) dst.set(x + k + dx, y - up + dy, v);
      bottom = y;
    }
    if (up > 0 && bottom >= 0) {
      const v = arm.c[bottom * arm.w + x];
      for (let k = 1; k <= up; k++) dst.set(x + ox + dx, bottom - up + k + dy, v);
    }
  }
}

function compose(ctx, p) {
  if (p.still) return composeStill(ctx.still, p, FRAME);
  const { parts, colors } = ctx;
  const f = new Img(FRAME.w, FRAME.h);
  const bob = p.bob || 0;
  const lean = p.lean || 0;
  const ux = OX + lean;
  const uy = OY + bob;

  // the ragged sleeve behind, swaying
  const sway = p.sway || 0;
  const capeShift = (y) => Math.round((sway * Math.max(0, y - CAPE.y0)) / (HIP - CAPE.y0));
  blit(f, parts.cape, ux, uy);
  if (sway) blit(f, parts.cape, ux, uy, capeShift);

  const legs = p.legs || {};
  drawLeg(f, parts.backLeg, legs.back || {}, OX, OY);
  drawLeg(f, parts.frontLeg, legs.front || {}, OX, OY);

  // body, with the tunic's tatters swishing
  const hem = p.hem || 0;
  blit(f, parts.body, ux, uy);
  if (hem) blit(f, parts.body, ux, uy, (y) => (y < HEM ? 0 : Math.round((hem * (y - HEM)) / (HIP - HEM))));
  const hd = p.head || [0, 0];
  blit(f, parts.head, ux + hd[0], uy + hd[1]);

  // the outstretched arm, and the blood coiling round its fist
  const reach = p.reach || 0;
  const lift = p.lift || 0;
  drawArm(f, parts.arm, reach, lift, ux, uy);
  drawRotated(f, parts.swirl, p.swirl || 0, FIST, ux + reach, uy - lift);

  // a whip of blood lashing out from the fist
  if (p.lash) {
    const x0 = FIST.x + 6 + reach + ux;
    const y0 = FIST.y - lift + uy;
    for (let k = 0; k <= p.lash; k++) {
      const t = k / p.lash;
      const amp = 1 + 3 * t;
      const y = Math.round(y0 + Math.sin(k * 0.45 + (p.phase || 0)) * amp - t * 2);
      const x = Math.round(x0 + k);
      f.set(x, y, k > p.lash - 3 ? colors.blood : colors.bright);
      f.set(x, y + 1, t > 0.75 ? colors.dark : colors.blood);
      if (k % 7 === 3) f.set(x + 1, y + 3, colors.blood); // drops shaken loose
    }
  }
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

anim('idle', seq(6, (i) => ({
  bob: [0, 0, 1, 1, 1, 0][i], sway: [0, 1, 1, 0, -1, -1][i], hem: [0, 0, 1, 1, 0, 0][i],
  lift: [0, 0, 1, 1, 1, 0][i], swirl: [0, 10, 20, 30, 20, 10][i], light: 1,
})));
anim('walk', seq(6, (i) => ({
  bob: [1, 0, 0, 1, 0, 0][i],
  sway: [-1, -2, -2, -1, -2, -2][i],
  hem: [1, 0, -1, -1, 0, 1][i],
  swirl: [0, 12, 24, 36, 24, 12][i],
  legs: {
    front: leg([3, 1, -1, -3, -1, 1][i], [0, 0, 0, 0, 2, 2][i]),
    back: leg([-3, -1, 1, 3, 1, -1][i], [0, 2, 2, 0, 0, 0][i]),
  },
  light: 1,
})));
anim('strike', seq(6, (i) => ({
  reach: [0, -1, 3, 5, 4, 1][i],
  lift: [1, 2, 0, 0, 0, 1][i],
  lean: [0, -1, 1, 2, 1, 0][i],
  swirl: [0, 30, 60, 90, 120, 150][i],
  lash: [0, 0, 12, 28, 36, 18][i],
  phase: i * 0.9,
  legs: { front: leg([0, 0, 1, 2, 2, 1][i]), back: leg([0, 0, 0, -1, -1, 0][i]) },
  light: [1, 1, 2, 2, 2, 1][i],
})));
anim('cast', seq(4, (i) => ({ lift: [2, 3, 3, 2][i], swirl: i * 90, bob: i % 2, sway: [1, 2, 1, 2][i], light: 2 })));
anim('raise', seq(4, (i) => ({ lift: [2, 4, 5, 4][i], reach: 1, swirl: i * 45, sway: [0, 1, 1, 0][i], light: 2 })));
anim('point', seq(2, (i) => ({ reach: 3 + i, swirl: i * 15, lean: 1, light: 1 })));
anim('kneel', seq(2, (i) => ({ still: true, bob: i, sway: i, float: i, light: 1 })));
anim('rest', seq(2, (i) => ({ still: true, bob: i, head: [1, 1], sway: 1 - i, light: 0 })));
anim('pray', seq(2, (i) => ({ still: true, bob: i, head: [1, 2], sway: 2, float: 1 + i, light: 2 })));
anim('bow', seq(3, (i) => ({ head: [[1, 1], [1, 2], [2, 3]][i], lean: Math.min(1, i), light: 0 })));
anim('study', seq(2, (i) => ({ head: [1, 1], bob: i, swirl: i * 15, light: 0 })));
anim('stagger', seq(2, (i) => ({ lean: -2 - i, reach: -2 - i, swirl: 30 + i * 30, sway: 2, legs: { front: leg(-1), back: leg(1) }, light: 2 })));
anim('collapse', [{ still: true, head: [2, 3], sway: 2, light: 0 }]);
anim('lifted', seq(2, (i) => ({ sway: -3 + i, hem: -2 + i, swirl: i * 20, legs: { front: { dangle: -2 - i }, back: { dangle: -3 } }, light: 1 })));
anim('talk', seq(2, (i) => ({ lift: i, bob: i, swirl: i * 12, light: 1 })));
// drawn whole (core.js, composeDrawn), each set where his boots stand: the Crimson Mire, one arm
// raised high and clawed, blood streaming up it, the other pointing down and dripping, the blood
// alive while he holds it; the cast (the fist drawn back in its coil of blood, thrust out as the
// blood bursts from the palm, lowered, dripping), each drawing twice, so that its blood stirs on
// while it's held (anims.attack)
anim('mire', seq(4, () => ({ drawn: 'ult', mid: 49, ground: 134, light: 2 })));
anim('bloodcast', [0, 0, 1, 1, 2, 2].map((i) => ({ drawn: 'attack', frame: i, mid: [45, 49, 51][i], ground: [98, 99, 98][i], light: [1, 2, 1][i] })));

const G = groups;
export default {
  id: 'bloodbender',
  src: import.meta.url, // (its module: what its baked sheet was made from, bake.js; and where a worker draws it, core.js)
  art: '/assets/hero/bloodbender.json',
  extraArt: {
    kneel: '/assets/hero/bloodbender-kneel.json',
    ult: '/assets/hero/bloodbender-ult.json',
    attack: '/assets/hero/bloodbender-attack.json',
  },
  firstName: 'Vael',
  epithet: 'the Crimson Weaver',
  title: 'Sorcerer',
  burst: ['#a0101a', '#e8c8b8'],
  frame: FRAME,
  cols: 8,
  px: 2.05 / 80, // world units per art pixel: about the Ronin's build
  head: 99, // art pixels from the ground to the top of the hood
  hits: { hammer: 3, cast: 1, send: 1, attack: 4 },
  lunge: { attack: 0.35 }, // (his drawing thrown forward as the blood bursts from his palm: npc.js)
  glowIntensity: 1.1,
  glowColors: [[150, 8, 14], [240, 70, 60]],
  seed: 6602,
  prepare,
  compose,
  poses,
  groups,
  anims: {
    idle: { frames: G.idle, fps: 5 },
    walk: { frames: G.walk, fps: 9 },
    hammer: { frames: G.strike, fps: 9 },
    // (in eighteenths of a second: the fist drawn back 4, the burst 3, lowered 4)
    attack: { frames: held(G.bloodcast, [2, 2, 2, 1, 2, 2]), fps: 18 },
    ult: { frames: G.mire, fps: 8 },
    read: { frames: G.study, fps: 1.4 },
    cast: { frames: G.cast, fps: 7 },
    send: { frames: G.raise, fps: 5 },
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
  groupFps: { idle: 5, walk: 9, strike: 9, cast: 7, raise: 5, point: 2, kneel: 1.5, rest: 1, pray: 3, bow: 3, study: 1.4, stagger: 4, collapse: 1, lifted: 4, talk: 2.5, mire: 8, bloodcast: 9 },
};
