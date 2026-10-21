// The Stormbound Knight: plate, ragged violet cape, a spear wreathed in red lightning.
// Source art: assets/hero/knight.json (66x135, from knight-stand.webp); drawn whole, her Red Storm
// (knight-ult.json, from ult-maren.png) and her thrust (knight-attack.json, from atk-maren.png).

import { Img, NONE, region, blit, erase, rotatable, drawRotated, prepareStill, composeStill, held } from './core.js';

// (room above her for the spear raised to the sky, and ahead of her for the thrust)
const FRAME = { w: 216, h: 180 };

// Anatomy, in source-grid coordinates.
const GROUND = 131;
const OX = FRAME.w / 2 - 34; // source x 34 (centre of the feet) lands on the frame's centre column
const OY = FRAME.h - 1 - GROUND; // the ground lands on the frame's last row
const HIP = 110;
const PIVOT = { x: 52.5, y: 97.5 }; // centre of the hand gripping the spear
const HAND = { x0: 48, x1: 57, y0: 92, y1: 102 };
const HEAD = { x0: 17, x1: 47, y0: 48, y1: 76 };
const SPEAR_BUTT = { x: 47.5, y: 131 };
const SPEAR_SLOPE = 0.109; // the shaft leans right by this many px per row upward
const BACK_LEG = { x0: 21, x1: 33 };
const FRONT_LEG = { x0: 34, x1: 44 };
const CAPE_LOW = { x1: 20, y0: 104 };

const axisX = (y) => SPEAR_BUTT.x + (SPEAR_BUTT.y - y) * SPEAR_SLOPE;
const inHand = (x, y) => x >= HAND.x0 && x <= HAND.x1 && y >= HAND.y0 && y <= HAND.y1;
function isSpear(x, y) {
  if (inHand(x, y)) return false;
  if (y < 50) return x >= 44;
  const d = x - axisX(y);
  return d >= -3.5 && d <= 7.5;
}

function prepare(art, more = {}) {
  const { src, code, ids } = art;
  // The spear: its band, and whatever of it spills a pixel or few past either edge of the band and
  // ends in air (the foot of its blade, a lick of its lightning). Left with the body, those hung
  // in the air whenever the spear swung away; a longer run is the arm, which stays.
  const spill = new Set();
  for (let y = 50; y <= GROUND; y++) {
    const edges = [[Math.ceil(axisX(y) - 3.5), -1], [Math.floor(axisX(y) + 7.5), 1]];
    for (const [edge, step] of edges) {
      if (src.get(edge, y) === NONE) continue;
      let k = 0;
      while (k < 5 && src.get(edge + step * (k + 1), y) !== NONE && !inHand(edge + step * (k + 1), y)) k++;
      if (k && k <= 4 && src.get(edge + step * (k + 1), y) === NONE) for (let i = 1; i <= k; i++) spill.add(`${edge + step * i},${y}`);
    }
  }
  const spearAt = (x, y) => isSpear(x, y) || spill.has(`${x},${y}`);
  const spear = region(src, spearAt);
  // Rebuild the stretch of shaft hidden behind the fingers by repeating the rows just above
  // the hand, following the shaft's lean, so the spear is whole wherever the hand moves.
  const above = [HAND.y0 - 5, HAND.y0 - 4, HAND.y0 - 3, HAND.y0 - 2];
  for (let y = HAND.y0; y <= HAND.y1 + 1; y++) {
    const sy = above[(y - HAND.y0) % above.length];
    const shift = Math.round(axisX(y) - axisX(sy));
    for (let x = HAND.x0 - 2; x <= HAND.x1; x++) {
      const v = src.get(x - shift, sy);
      if (v !== NONE && isSpear(x - shift, sy)) spear.set(x, y, v);
    }
  }
  const legs = (r) => region(src, (x, y) => y >= HIP && x >= r.x0 && x <= r.x1 && !spearAt(x, y));
  const taken = (x, y) => spearAt(x, y) || inHand(x, y)
    || (y >= CAPE_LOW.y0 && x <= CAPE_LOW.x1)
    || (y >= HIP && ((x >= BACK_LEG.x0 && x <= BACK_LEG.x1) || (x >= FRONT_LEG.x0 && x <= FRONT_LEG.x1)));
  return {
    // kneeling is its own drawing (assets/hero/knight-kneel.json): the spear stays planted
    still: more.kneel && prepareStill(more.kneel, {
      ground: 119, mid: 38, neck: 71, waist: 86, cape: { x1: 22, y0: 84 }, fixed: (x) => x >= 57,
    }),
    parts: {
      spear: rotatable(spear),
      hand: region(src, inHand),
      capeLow: region(src, (x, y) => y >= CAPE_LOW.y0 && x <= CAPE_LOW.x1 && !spearAt(x, y)),
      backLeg: legs(BACK_LEG),
      frontLeg: legs(FRONT_LEG),
      head: region(src, (x, y) => y >= HEAD.y0 && y <= HEAD.y1 && x >= HEAD.x0 && x <= HEAD.x1 && !spearAt(x, y)),
      body: region(src, (x, y) => !taken(x, y)),
    },
    energy: {
      hot: ids('GJLPQSTZdbgj'),
      core: ids('mn'),
      soft: ids('gj'),
      dim: [code('B'), code('D')],
      flare: [code('d'), code('n')],
      crackle: { main: code('S'), core: code('n'), sparks: [code('S'), code('Q')] },
    },
  };
}

function drawLeg(dst, leg, { stride = 0, lift = 0, crouch = 0, dangle = 0 }, dx, dy) {
  const span = GROUND - HIP;
  const knee = HIP + 4;
  for (let y = HIP; y <= GROUND; y++) {
    // Crouching folds the shin away: the rows just under the knee caps disappear and the
    // thigh drops with the body while the boot stays on the ground.
    let ty = y + crouch;
    if (crouch) {
      if (y > knee && y < knee + crouch) continue;
      if (y >= knee + crouch) ty = y;
    }
    const t = (y - HIP) / span;
    const shift = Math.round(stride * t + dangle * t * t);
    const up = Math.round(lift * t);
    for (let x = 0; x < leg.w; x++) {
      const v = leg.get(x, y);
      if (v !== NONE) dst.set(x + dx + shift, ty + dy - up, v);
    }
  }
}

function compose({ parts, still }, p) {
  if (p.still) return composeStill(still, p, FRAME);
  const f = new Img(FRAME.w, FRAME.h);
  const bob = p.bob || 0;
  const crouch = p.crouch || 0;
  const lean = p.lean || 0;
  const ux = OX + lean;
  const uy = OY + bob + crouch;

  // lower cape: the hem shears with the wind; its inner edge is backfilled so no gap opens
  const sway = p.sway || 0;
  const span = GROUND - CAPE_LOW.y0;
  const capeShift = (y) => (y < CAPE_LOW.y0 ? 0 : Math.round((sway * (y - CAPE_LOW.y0)) / span));
  for (let y = CAPE_LOW.y0; y < parts.capeLow.h; y++) {
    for (let x = CAPE_LOW.x1 - 3; x <= CAPE_LOW.x1; x++) {
      const v = parts.capeLow.get(x, y);
      if (v !== NONE && y + uy < FRAME.h) f.set(x + ux, y + uy, v);
    }
  }
  blit(f, parts.capeLow, ux, uy, capeShift);

  // legs stay planted (the far leg first)
  const legs = p.legs || {};
  drawLeg(f, parts.backLeg, { ...legs.back, crouch }, OX, OY);
  drawLeg(f, parts.frontLeg, { ...legs.front, crouch }, OX, OY);

  // upper body; a bowed head is lifted off and redrawn lower
  blit(f, parts.body, ux, uy);
  const hd = p.head || [0, 0];
  if (hd[0] || hd[1]) {
    erase(f, parts.head, ux, uy);
    blit(f, parts.head, ux + hd[0], uy + hd[1]);
  }

  // the spear turns about the hand; a planted spear stays put while the knight crouches
  const planted = !!p.spearPlanted;
  drawRotated(f, parts.spear, p.spear || 0, PIVOT, OX + (planted ? 0 : lean), OY + (planted ? 0 : bob + crouch));
  blit(f, parts.hand, ux, uy);
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

anim('idle', [0, 0, 1, 1, 1, 0].map((bob, i) => ({ bob, sway: [0, 1, 1, 0, -1, -1][i], light: 1 })));
anim('walk', [0, 1, 2, 3, 4, 5].map((i) => ({
  bob: [1, 0, 0, 1, 0, 0][i],
  sway: [-1, -2, -2, -1, -2, -2][i],
  spear: [3, 2, 1, 3, 2, 1][i],
  legs: {
    front: leg([3, 1, -1, -3, -1, 1][i], [0, 0, 0, 0, 2, 2][i]),
    back: leg([-3, -1, 1, 3, 1, -1][i], [0, 2, 2, 0, 0, 0][i]),
  },
  light: 1,
})));
anim('strike', [0, 1, 2, 3, 4, 5].map((i) => ({
  spear: [0, -10, 22, 44, 40, 14][i],
  lean: [0, -1, 1, 2, 2, 1][i],
  bob: [0, 0, 1, 1, 1, 0][i],
  legs: { front: leg([0, 0, 1, 2, 2, 1][i]), back: leg([0, 0, -1, -1, -1, 0][i]) },
  sway: [0, 1, -1, -2, -2, -1][i],
  light: [1, 1, 2, 2, 2, 1][i],
})));
anim('cast', [0, 1, 2, 3].map((i) => ({ spear: [-6, -9, -7, -5][i], lean: -1, sway: [1, 2, 1, 2][i], light: 2 })));
anim('raise', [0, 1, 2, 3].map((i) => ({ spear: [10, 20, 22, 14][i], sway: [0, 1, 1, 0][i], light: 2 })));
anim('point', [0, 1].map((i) => ({ spear: 48 + i * 2, lean: 1, legs: { front: leg(2), back: leg(-1) }, light: 1 })));
anim('kneel', [0, 1].map((i) => ({ still: true, bob: i, sway: i, light: 1 })));
anim('rest', [0, 1].map((i) => ({ still: true, bob: i, head: [1, 1], sway: 1 - i, light: 0 })));
anim('pray', [0, 1].map((i) => ({ still: true, bob: i, head: [1, 2], sway: 2, light: 2 })));
anim('bow', [0, 1, 2].map((i) => ({ head: [[1, 1], [2, 2], [2, 3]][i], lean: Math.min(1, i), spear: i * 3, light: 0 })));
anim('study', [0, 1].map((i) => ({ head: [1, 1], bob: i, light: 0 })));
anim('stagger', [0, 1].map((i) => ({ lean: -2 - i, spear: -10 - i * 4, sway: 2, legs: { front: leg(-1), back: leg(1) }, light: 2 })));
anim('collapse', [{ still: true, head: [2, 3], sway: 2, light: 0 }]);
anim('lifted', [0, 1].map((i) => ({ sway: -3 + i, spear: -8, legs: { front: { dangle: -2 - i }, back: { dangle: -3 } }, light: 1 })));
anim('talk', [0, 1].map((i) => ({ spear: i ? 8 : 2, bob: i, light: 1 })));
// drawn whole (core.js, composeDrawn), each set by her body's middle: the Red Storm, the spear
// raised to the sky, its lightning crackling while she holds it; the thrust (wind-up, lunge,
// recovery), the lightning flaring along the shaft as it lands (each drawing twice, so that its
// lightning crackles on while it's held: anims.attack)
anim('storm', [0, 1, 2, 3].map(() => ({ drawn: 'ult', mid: 54, ground: 174, light: 2 })));
anim('thrust', [0, 0, 1, 1, 2, 2].map((i) => ({ drawn: 'attack', frame: i, mid: 60, ground: [106, 106, 101][i], light: [1, 2, 1][i] })));

const G = groups;
export default {
  id: 'knight',
  src: import.meta.url, // (its module: what its baked sheet was made from, bake.js; and where a worker draws it, core.js)
  art: '/assets/hero/knight.json',
  extraArt: { kneel: '/assets/hero/knight-kneel.json', ult: '/assets/hero/knight-ult.json', attack: '/assets/hero/knight-attack.json' },
  firstName: 'Maren',
  epithet: 'the Stormbound',
  title: 'Knight',
  frame: FRAME,
  cols: 8,
  px: 2.4 / 81, // world units per art pixel: he stands ~2.4 units, a head taller than the rest
  head: 82, // art pixels from the ground to the top of the helm
  hits: { hammer: 3, cast: 1, send: 1, attack: 4 },
  feet: 'chain', // (each foot heard as it's set down: in armour, its chain clinking, npc.js)
  lunge: { attack: 0.35 }, // (her drawing thrown forward as the thrust lands, springing back: npc.js)
  glowIntensity: 1.1,
  glowColors: [[170, 18, 12], [210, 120, 110]],
  seed: 9001,
  prepare,
  compose,
  poses,
  groups,
  // Game animation name → frames and timing (every name the NPC code asks for).
  anims: {
    idle: { frames: G.idle, fps: 5 },
    walk: { frames: G.walk, fps: 9 },
    hammer: { frames: G.strike, fps: 8 },
    // (in eighteenths of a second: the wind-up 4, the lunge 6, the recovery 4)
    attack: { frames: held(G.thrust, [2, 2, 3, 3, 2, 2]), fps: 18 },
    ult: { frames: G.storm, fps: 8 },
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
  // Playback rates for the named groups in previews and exports.
  groupFps: { idle: 5, walk: 9, strike: 8, cast: 6, raise: 4, point: 2, kneel: 1.5, rest: 1, pray: 3, bow: 3, study: 1.4, stagger: 4, collapse: 1, lifted: 4, talk: 2.5, storm: 8, thrust: 9 },
};
