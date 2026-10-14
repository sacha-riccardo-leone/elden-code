// The Eternal Queen, the day form of the Twofold (by night the Red Hammer walks in this one's place;
// see twofold.js): a goddess with a long golden braid, crowned in gold, in a black gown worked with
// gold, a ring of holy light turning about one hand. The ring spins and flares, rises with the
// hand, sheds motes of light, and lances out as a beam of gold that bursts where it ends.
// Source art: assets/hero/queen.json (71x120, from queen-stand.webp) and queen-kneel.json (77x96,
// from queen-kneel.webp).

import { Img, NONE, region, blit, rotatable, drawRotated, prepareStill, composeStill } from './core.js';

const FRAME = { w: 148, h: 124 };
const MID = 36; // between the feet
const GROUND = 118;
const OX = FRAME.w / 2 - MID;
const OY = FRAME.h - 1 - GROUND;

// Anatomy, in source-grid coordinates.
const GOLDISH = 'mztrxqywnkhc'; // the colours of the ring of light (and of gold and hair elsewhere)
const MAGIC_BOX = { x0: 49, y0: 55, y1: 90 }; // the ring lies in here, around the hand
const KNEEL_MAGIC_BOX = { x0: 56, y0: 48, y1: 84 };
const RING = { x: 60.5, y: 72 }; // it turns about this point
const BRAID = { y0: 40, y1: 92 }; // the braid hangs down the left and sways below y0
const HEM = 100; // the gown's panels sway below this row
// Her legs walk as the knight's do (each sheared from its top to the foot, the foot lifted): the
// one bare through the gown's slit (behind) and the other, below the hem (in front). Each is its
// skin and sandal straps, with their dark outline.
const BACK_LEG = { x0: 21, x1: 34, y0: 86 };
const FRONT_LEG = { x0: 36, x1: 49, y0: 94 };
const SKIN = 'eilpsuv';
const STRAPS = 'fkmqtxORaUZ';
const BUST = { x0: 35, x1: 49, y0: 45, y1: 53 }; // bounces a pixel, a beat behind her step

// The ring is gold among gold (crown, bracelets, the gown's embroidery). Its pixels are the
// gold-coloured ones in its box that touch nothing but gold or air; those get twin colours (one
// step off the originals) so that only the ring glows.
function ringOf(art, box, goldish, twinOf) {
  const { src } = art;
  const gold = (v) => v >= 0 && goldish.has(v);
  const isRing = (x, y) => x >= box.x0 && y >= box.y0 && y <= box.y1 && gold(src.get(x, y))
    && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => { const v = src.get(x + a, y + b); return v < 0 || gold(v); });
  const ring = new Img(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (isRing(x, y)) ring.set(x, y, twinOf(src.get(x, y)));
  return { ring, isRing };
}

function prepare(art, more = {}) {
  const { src, ids, palette, addColor } = art;
  const twins = new Map();
  const twinOf = (v) => {
    if (!twins.has(v)) {
      const n = parseInt(palette[v].slice(1), 16);
      const b = n & 255;
      twins.set(v, addColor(`#${((n & 0xffff00) | (b === 255 ? 254 : b + 1)).toString(16).padStart(6, '0')}`));
    }
    return twins.get(v);
  };
  const goldish = ids(GOLDISH);
  const { ring, isRing } = ringOf(art, MAGIC_BOX, goldish, twinOf);
  const isBraid = (x, y) => y >= BRAID.y0 && y <= BRAID.y1 && x <= (y < 52 ? 19 : 17);
  const white = addColor('#fffdf0');
  const gold = addColor('#ffd75a');
  const amber = addColor('#f0a020');
  let still = null;
  if (more.kneel) {
    const k = more.kneel;
    const kr = ringOf(k, KNEEL_MAGIC_BOX, k.ids(GOLDISH), twinOf);
    for (let y = 0; y < k.src.h; y++) for (let x = 0; x < k.src.w; x++) if (kr.isRing(x, y)) k.src.set(x, y, kr.ring.get(x, y));
    still = prepareStill(k, { ground: 94, mid: 36, neck: 34, waist: 58, cape: { x1: 18, y0: 45 }, float: kr.isRing });
  }
  const code = (ch) => twinOf(art.code(ch));
  // a leg: its skin, the outline right beside it, and the sandal straps over it (up to two
  // pixels from the skin)
  const skin = ids(SKIN);
  const straps = ids(STRAPS);
  const nearSkin = (x, y, r) => {
    for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (skin.has(src.get(x + a, y + b))) return true;
    return false;
  };
  const legOf = (box) => (x, y) => {
    if (x < box.x0 || x > box.x1 || y < box.y0 || y > GROUND) return false;
    const v = src.get(x, y);
    if (v === NONE) return false;
    return skin.has(v) || nearSkin(x, y, straps.has(v) ? 2 : 1);
  };
  const isBack = legOf(BACK_LEG);
  const isFront = legOf(FRONT_LEG);
  const isLeg = (x, y) => isBack(x, y) || isFront(x, y);
  const body = region(src, (x, y) => !isBraid(x, y) && !isRing(x, y) && !isLeg(x, y));
  return {
    still,
    parts: {
      ring: rotatable(ring),
      braid: region(src, (x, y) => isBraid(x, y) && !isRing(x, y)),
      body,
      backLeg: region(src, isBack),
      frontLeg: region(src, isFront),
      bust: region(body, (x, y) => x >= BUST.x0 && x <= BUST.x1 && y >= BUST.y0 && y <= BUST.y1),
      // where the legs were: the gown's dark inside shows when they step away (not at the very
      // bottom, where it's the floor)
      gap: region(src, (x, y) => isLeg(x, y) && y < GROUND - 4),
    },
    gapColor: art.code('A'),
    colors: { white, gold, amber },
    // only the ring (and the light it sheds) glows; it shimmers and flares but never goes out
    energy: {
      hot: new Set([...twins.values(), gold, amber]),
      core: new Set([white]),
      soft: new Set([code('z'), code('y'), code('x')]),
      dim: [code('k'), code('m')],
      flare: [gold, white],
      crackle: { main: code('t'), core: white, sparks: [code('t'), code('z'), gold] },
      odds: [[0.1, 0.4, 0.97], [0.05, 0.28, 0.9], [0.02, 0.1, 0.5]],
      bigOff: 'lit',
      keepAbove: 6,
      arcs: [0, 1, 2],
      sparks: [1, 3, 7],
      sparkReach: 10,
      sparkRise: 3,
    },
  };
}

// A leg from `top` down to the ground: sheared forward or back by `stride` (none at the top, all of
// it at the foot), the foot raised by `lift`, or left to `dangle`.
function drawLeg(dst, leg, top, { stride = 0, lift = 0, dangle = 0 }, dx, dy) {
  const span = GROUND - top;
  for (let y = top; y <= GROUND; y++) {
    const t = (y - top) / span;
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
  const ux = OX + (p.lean || 0);
  const uy = OY + (p.bob || 0);
  const glow = [];
  const put = (x, y, v) => {
    const fx = Math.round(x);
    const fy = Math.round(y);
    if (fx < 0 || fy < 0 || fx >= FRAME.w || fy >= FRAME.h) return;
    f.set(fx, fy, v);
    glow.push(fy * FRAME.w + fx);
  };

  // the braid swings (drawn as is and sheared, so nothing opens a gap)
  const sway = p.sway || 0;
  blit(f, parts.braid, ux, uy);
  if (sway) blit(f, parts.braid, ux, uy, (y) => Math.round((sway * Math.max(0, y - BRAID.y0)) / (BRAID.y1 - BRAID.y0)));
  // the legs stay planted and step under the gown: the dark inside where they were, the legs
  // where they are, then the gown over them, its panels swaying
  const g = parts.gap;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.c[y * g.w + x] !== NONE) f.set(x + OX, y + OY, ctx.gapColor);
  const legs = p.legs || {};
  drawLeg(f, parts.backLeg, BACK_LEG.y0, legs.back || {}, OX, OY);
  drawLeg(f, parts.frontLeg, FRONT_LEG.y0, legs.front || {}, OX, OY);
  const hem = p.hem || 0;
  blit(f, parts.body, ux, uy);
  if (hem) blit(f, parts.body, ux, uy, (y) => (y < HEM ? 0 : Math.round((hem * (y - HEM)) / (GROUND - HEM))));
  // the bust, a pixel behind her step
  if (p.bounce) blit(f, parts.bust, ux, uy + p.bounce);

  // the ring of light turns about the hand (and rises from it)
  const rise = p.rise || 0;
  drawRotated(f, parts.ring, p.spin || 0, RING, ux, uy - rise);
  const cx = RING.x + ux;
  const cy = RING.y + uy - rise;

  // motes of light drifting up from the ring
  for (let k = 0; k < (p.motes || 0); k++) {
    const x = cx - 9 + ((k * 7 + (p.phase || 0) * 5) % 19);
    const y = cy - 13 - ((k * 5 + (p.phase || 0) * 3) % 12);
    put(x, y, k % 3 ? colors.gold : colors.white);
  }

  // a lance of holy light from the ring, bursting where it ends
  if (p.beam) {
    const x0 = cx + 4;
    for (let k = 0; k <= p.beam; k++) {
      const x = x0 + k;
      const fade = k > p.beam - 4;
      put(x, cy, fade ? colors.gold : colors.white);
      put(x, cy - 1, fade ? colors.amber : colors.gold);
      put(x, cy + 1, fade ? colors.amber : colors.gold);
      if (k % 5 === 2) put(x, cy - 3 + (k % 2) * 6, colors.white); // glints along it
    }
    if (p.burst) {
      const bx = x0 + p.beam;
      const len = 2 + p.burst * 2;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2 + (p.burst % 2) * 0.39;
        for (let r = 2; r <= len + 1; r++) put(bx + r * Math.cos(ang), cy + r * Math.sin(ang), r > len - 1 ? colors.amber : r % 2 ? colors.white : colors.gold);
      }
      put(bx, cy, colors.white);
    }
  }
  f.keep = glow;
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

const leg = (stride, lift = 0) => ({ stride, lift });
anim('idle', seq(6, (i) => ({ bob: [0, 0, 1, 1, 1, 0][i], sway: [0, 1, 1, 0, -1, -1][i], hem: [0, 0, 1, 1, 0, 0][i], bounce: [0, 0, 0, 1, 0, 0][i], spin: i * 15, light: 1 })));
// walking as the knight walks: the legs stride and lift in turn, the gown's panels following
anim('walk', seq(6, (i) => ({
  bob: [1, 0, 0, 1, 0, 0][i],
  sway: [-1, -2, -2, -1, -2, -2][i],
  hem: [1, 0, -1, -1, 0, 1][i],
  bounce: [-1, 1, 0, -1, 1, 0][i],
  legs: {
    front: leg([3, 1, -1, -3, -1, 1][i], [0, 0, 0, 0, 2, 2][i]),
    back: leg([-3, -1, 1, 3, 1, -1][i], [0, 2, 2, 0, 0, 0][i]),
  },
  spin: i * 20,
  light: 1,
})));
// the ring whirls up, and a lance of light leaps from it and bursts
anim('strike', seq(6, (i) => ({
  spin: [0, 40, 90, 150, 210, 260][i],
  rise: [0, 1, 2, 1, 0, 0][i],
  beam: [0, 0, 16, 32, 38, 14][i],
  burst: [0, 0, 0, 1, 2, 0][i],
  lean: [0, -1, 0, 1, 1, 0][i],
  hem: [0, -1, 0, 1, 1, 0][i],
  bounce: [0, 0, 1, -1, 0, 0][i],
  legs: { front: leg([0, 0, -1, 2, 3, 2][i]), back: leg([0, 0, 1, -1, -2, -1][i]) },
  light: [1, 2, 2, 2, 2, 1][i],
})));
anim('cast', seq(4, (i) => ({ spin: i * 60, rise: [2, 3, 3, 2][i], motes: 5, phase: i, bob: i % 2, sway: [1, 2, 1, 2][i], light: 2 })));
anim('raise', seq(4, (i) => ({ spin: i * 45, rise: [3, 5, 6, 5][i], motes: 3, phase: i, sway: [0, 1, 1, 0][i], light: 2 })));
anim('point', seq(2, (i) => ({ spin: i * 20, rise: 1, beam: 6 + i * 2, lean: 1, light: 1 })));
// the kneeling drawing: it breathes, the braid stirs, the ring drifts
anim('kneel', seq(2, (i) => ({ still: true, bob: i, sway: i, float: i, light: 1 })));
anim('rest', seq(2, (i) => ({ still: true, bob: i, head: [1, 1], sway: 1 - i, light: 0 })));
anim('pray', seq(2, (i) => ({ still: true, bob: i, head: [1, 2], sway: 1, float: 1 + i, light: 2 })));
anim('bow', seq(3, (i) => ({ lean: Math.min(1, i), bob: [0, 1, 2][i], hem: [0, 1, 1][i], spin: i * 10, light: 0 })));
anim('study', seq(2, (i) => ({ bob: i, spin: i * 10, light: 0 })));
anim('stagger', seq(2, (i) => ({ lean: -2 - i, spin: 30 + i * 30, sway: 2, hem: 2, bounce: i ? 1 : -1, legs: { front: leg(-1), back: leg(1) }, light: 2 })));
anim('collapse', [{ still: true, head: [2, 3], sway: 2, light: 0 }]);
anim('lifted', seq(2, (i) => ({ sway: -3 + i, hem: -2 + i, spin: i * 20, legs: { front: { dangle: -2 - i }, back: { dangle: -3 } }, light: 1 })));
anim('talk', seq(2, (i) => ({ bob: i, spin: i * 12, light: 1 })));

const G = groups;
export default {
  id: 'queen',
  pair: 'twofold', // one hero with two forms: see twofold.js
  form: 'day',
  art: '/assets/hero/queen.json',
  extraArt: { kneel: '/assets/hero/queen-kneel.json' },
  firstName: 'Solenne',
  epithet: 'the Eternal Queen',
  title: 'Goddess',
  burst: ['#ffd75a', '#fffdf0'],
  frame: FRAME,
  cols: 8,
  px: 2.6 / 118, // world units per art pixel: as tall as the Red Hammer, less the mane
  head: 117, // art pixels from the ground to the top of the hair
  hits: { hammer: 3, cast: 1, send: 1 },
  glowIntensity: 1.3,
  glowColors: [[230, 170, 40], [255, 245, 200]],
  seed: 5150,
  prepare,
  compose,
  poses,
  groups,
  anims: {
    idle: { frames: G.idle, fps: 4 },
    walk: { frames: G.walk, fps: 7 },
    hammer: { frames: G.strike, fps: 9 },
    read: { frames: G.study, fps: 1.4 },
    cast: { frames: G.cast, fps: 6 },
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
  groupFps: { idle: 4, walk: 7, strike: 9, cast: 6, raise: 4, point: 2, kneel: 1.5, rest: 1, pray: 1.5, bow: 3, study: 1.4, stagger: 4, collapse: 1, lifted: 4, talk: 2.5 },
};
