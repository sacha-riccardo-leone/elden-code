// The Rune Lord, master of Gold Rune sorcery: a crowned skull-helm in silver and gold, a brown
// mantle, and a staff whose claw holds a dark orb. When he works his sorcery the orb kindles,
// golden runes circle it, and a blow of the staff sends a ring of runes across the ground.
// Source art: assets/hero/runelord.json (92x102, from runelord-stand.webp) and
// runelord-kneel.json (94x93, from runelord-kneel.webp); drawn whole, his Flight of Tomes
// (runelord-ult.json, from ult-jorvik.png) and his staff cast (runelord-attack.json, from
// atk-jorvik.png).

import { Img, NONE, region, blit, rotatable, drawRotated, prepareStill, composeStill, held } from './core.js';

// (room above him for the staff raised high, and ahead of him for the staff thrust out)
const FRAME = { w: 184, h: 160 };
const MID = 45; // source column between the boots
const GROUND = 100;
const OX = FRAME.w / 2 - MID;
const OY = FRAME.h - 1 - GROUND;

// Anatomy, in source-grid coordinates.
const HIP = 80;
const NECK = 36; // above: crown and helm
const BACK_LEG = { x0: 31, x1: 40 };
const FRONT_LEG = { x0: 46, x1: 62 };
const CAPE = { x1: 30, y0: 38 };
const STAFF_TOP = { x: 84.5, y: 11.5 };
const STAFF_FOOT = { x: 59.5, y: 92.5 };
const GRIP = { x: 70.5, y: 58.5 }; // the gauntlet on the staff: it turns and lifts about this
const HAND = { x0: 58, x1: 75, y0: 53, y1: 65 };
const ARM_X0 = 50; // the arm bends from here to the hand when the staff is raised
const ORB = { x: 86.5, y: 9.5, r: 5 };
const KNEEL_ORB = { x: 86.5, y: 8.5, r: 5 };
const BALL = 'DFHJLNPQTVX'; // the orb's own dark stone (the claw around it is gold)

const LEN = Math.hypot(STAFF_FOOT.x - STAFF_TOP.x, STAFF_FOOT.y - STAFF_TOP.y);
const AX = [(STAFF_FOOT.x - STAFF_TOP.x) / LEN, (STAFF_FOOT.y - STAFF_TOP.y) / LEN];
function staffCoords(x, y) {
  const dx = x + 0.5 - STAFF_TOP.x;
  const dy = y + 0.5 - STAFF_TOP.y;
  return [(dx * AX[0] + dy * AX[1]) / LEN, Math.abs(dx * AX[1] - dy * AX[0])];
}
const inHand = (x, y) => x >= HAND.x0 && x <= HAND.x1 && y >= HAND.y0 && y <= HAND.y1;
function isStaff(x, y) {
  if (inHand(x, y)) return false;
  if (x >= 75 && y <= 24) return true; // claw and orb
  const [t, d] = staffCoords(x, y);
  return t > 0.05 && t < 1.03 && d <= 3.4;
}

// Runes of the Golden Order, 3x5 glyphs.
const GLYPHS = [
  ['#.#', '.#.', '###', '.#.', '#.#'],
  ['.#.', '#.#', '.#.', '#.#', '.#.'],
  ['##.', '#.#', '##.', '#..', '#..'],
  ['#.#', '###', '#.#', '..#', '..#'],
];

function prepare(art, more = {}) {
  const { src, ids, addColor } = art;
  const colors = {
    deep: addColor('#d0861e'), // gold-rune light, deep to white-hot
    gold: addColor('#ffc94a'),
    hot: addColor('#fff3c4'),
  };
  const lum = (v) => {
    const n = parseInt(art.palette[v].slice(1), 16);
    return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
  };
  const ball = ids(BALL);
  // The orb's stone, by brightness, so it can kindle from within.
  const orbOf = (img, c) => {
    const px = [];
    for (let y = Math.floor(c.y - c.r); y <= c.y + c.r; y++) {
      for (let x = Math.floor(c.x - c.r); x <= c.x + c.r; x++) {
        const v = img.get(x, y);
        if (v === NONE || !ball.has(v) || Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) > c.r) continue;
        px.push([x, y, lum(v)]);
      }
    }
    return px;
  };
  const inLeg = (leg) => (x, y) => y >= HIP && x >= leg.x0 && x <= leg.x1;
  const isCape = (x, y) => x <= CAPE.x1 && y >= CAPE.y0;
  const inArm = (x, y) => x >= ARM_X0 && y >= 44 && y <= 66 && !isStaff(x, y) && !inHand(x, y);

  // the shaft runs on behind the gauntlet: rebuild it there from the stretch above the hand
  const staff = region(src, isStaff);
  const back = [Math.round(-9 * AX[0]), Math.round(-9 * AX[1])];
  for (let y = HAND.y0; y <= HAND.y1; y++) {
    for (let x = HAND.x0; x <= HAND.x1; x++) {
      const [t, d] = staffCoords(x, y);
      if (d > 2.4 || t <= 0) continue;
      const v = src.get(x + back[0], y + back[1]);
      if (v !== NONE && isStaff(x + back[0], y + back[1])) staff.set(x, y, v);
    }
  }

  const kneelArt = more.kneel;
  return {
    colors,
    lum,
    orb: orbOf(src, ORB),
    kneelOrb: kneelArt ? orbOf(kneelArt.src, KNEEL_ORB) : [],
    still: kneelArt && prepareStill(kneelArt, {
      ground: 91, mid: 50, neck: 37, waist: 55, cape: { x1: 28, y0: 45 }, fixed: (x) => x >= 66,
    }),
    parts: {
      staff: rotatable(staff),
      hand: region(src, inHand),
      arm: region(src, inArm),
      head: region(src, (x, y) => y < NECK && !isStaff(x, y)),
      cape: region(src, (x, y) => isCape(x, y) && y < HIP && !isStaff(x, y)),
      backLeg: region(src, (x, y) => inLeg(BACK_LEG)(x, y) && !isStaff(x, y)),
      frontLeg: region(src, (x, y) => inLeg(FRONT_LEG)(x, y) && !isStaff(x, y)),
      body: region(src, (x, y) => y >= NECK && !isStaff(x, y) && !inHand(x, y) && !inArm(x, y) && !isCape(x, y)
        && !inLeg(BACK_LEG)(x, y) && !inLeg(FRONT_LEG)(x, y)),
    },
    energy: {
      hot: new Set([colors.deep, colors.gold]),
      core: new Set([colors.hot]),
      soft: new Set(),
      dim: [colors.deep, colors.gold],
      flare: [colors.gold, colors.hot],
      crackle: { main: colors.gold, core: colors.hot, sparks: [colors.gold, colors.hot, colors.deep] },
      style: 'shards',
      odds: [[0.15, 0.3, 0.97], [0.1, 0.22, 0.9], [0.04, 0.1, 0.6]],
      bigOff: 'lit',
      keepAbove: 12,
      arcs: [0, 1, 3],
      sparks: [1, 3, 7],
      sparkReach: 10,
      sparkRise: 4, // motes of gold drift upward
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

// The orb kindles: its stone takes on rune-light by brightness (level 1: only a glint).
function kindle(f, orb, level, colors, dx, dy) {
  if (!level) return;
  for (const [x, y, l] of orb) {
    let v;
    if (level >= 2) v = l > 95 ? colors.hot : l > 55 ? colors.gold : colors.deep;
    else if (l > 95) v = colors.gold;
    else continue;
    f.set(x + dx, y + dy, v);
  }
}

// A drawn pose's orb (p.orb: [x, y, r] in the drawing), kindled as his own orb is: by brightness,
// all of it within the circle but its dark outline (level 1: only a glint); and runes wheeling
// round it (p.runes, p.phase).
function drawn({ colors, lum }, f, p) {
  if (!p.orb) return;
  const [cx, cy, r] = p.orb;
  const [dx, dy] = f.at;
  const level = p.kindle || 0;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r) continue;
      const v = f.get(x + dx, y + dy);
      if (v === NONE) continue;
      const l = lum(v);
      const c = level >= 2 ? (l > 170 ? colors.hot : l > 100 ? colors.gold : l > 45 ? colors.deep : null) : l > 170 ? colors.gold : null;
      if (c != null) f.set(x + dx, y + dy, c);
    }
  }
  if (p.runes) runeCircle(f, cx + dx, cy + dy, 13, 6, p.runes, p.phase || 0, colors);
}

function glyph(f, k, x, y, colors) {
  const g = GLYPHS[((k % GLYPHS.length) + GLYPHS.length) % GLYPHS.length];
  g.forEach((row, j) => {
    for (let i = 0; i < 3; i++) {
      if (row[i] === '#') f.set(Math.round(x) + i - 1, Math.round(y) + j - 2, i === 1 && j === 2 ? colors.hot : colors.gold);
    }
  });
}

// Runes wheeling round a point (flattened, as if lying in a ring around it).
function runeCircle(f, cx, cy, rx, ry, count, phase, colors, seed = 0) {
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    glyph(f, i + seed, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, colors);
  }
}

function compose(ctx, p) {
  const { parts, colors } = ctx;
  if (p.still) {
    const f = composeStill(ctx.still, p, FRAME);
    const ox = Math.round(FRAME.w / 2 - ctx.still.spec.mid);
    const oy = FRAME.h - 1 - ctx.still.spec.ground;
    kindle(f, ctx.kneelOrb, p.orb || 0, colors, ox, oy);
    if (p.runes) runeCircle(f, KNEEL_ORB.x + ox, KNEEL_ORB.y + oy - (p.rise || 0), 11, 5, p.runes, p.phase || 0, colors);
    return f;
  }
  const f = new Img(FRAME.w, FRAME.h);
  const bob = p.bob || 0;
  const lean = p.lean || 0;
  const ux = OX + lean;
  const uy = OY + bob;

  const sway = p.sway || 0;
  blit(f, parts.cape, ux, uy);
  if (sway) blit(f, parts.cape, ux, uy, (y) => Math.round((sway * Math.max(0, y - CAPE.y0)) / (HIP - CAPE.y0)));

  const legs = p.legs || {};
  drawLeg(f, parts.backLeg, legs.back || {}, OX, OY);
  drawLeg(f, parts.frontLeg, legs.front || {}, OX, OY);
  blit(f, parts.body, ux, uy);
  const hd = p.head || [0, 0];
  blit(f, parts.head, ux + hd[0], uy + hd[1]);

  // the staff arm: raising the staff lifts the hand and bends the forearm to follow
  const lift = p.lift || 0;
  const share = (x) => Math.max(0, Math.min(1, (x - ARM_X0) / 8));
  for (let x = 0; x < parts.arm.w; x++) {
    const up = Math.round(lift * share(x));
    for (let y = 0; y < parts.arm.h; y++) {
      const v = parts.arm.c[y * parts.arm.w + x];
      if (v === NONE) continue;
      for (let k = 0; k <= up; k++) f.set(x + ux, y + uy - k, v);
    }
  }
  drawRotated(f, parts.staff, p.staff || 0, GRIP, ux, uy - lift);
  blit(f, parts.hand, ux, uy - lift);
  if (!p.staff) kindle(f, ctx.orb, p.orb || 0, colors, ux, uy - lift);

  // sorcery: runes wheel about the orb, rise from it, or race outward from the staff's blow
  if (p.runes) runeCircle(f, ORB.x + ux, ORB.y + uy - lift - (p.rise || 0), 12, 6, p.runes, p.phase || 0, colors);
  if (p.ring) {
    const n = Math.max(4, Math.round(p.ring / 2.2));
    runeCircle(f, STAFF_FOOT.x + ux, GROUND + OY - 2, p.ring, p.ring * 0.32, n, p.phase || 0, colors, 1);
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
const TURN = Math.PI * 2;

anim('idle', seq(6, (i) => ({ bob: [0, 0, 1, 1, 1, 0][i], sway: [0, 1, 1, 0, -1, -1][i], orb: i % 3 === 1 ? 1 : 0, light: 1 })));
anim('walk', seq(6, (i) => ({
  bob: [1, 0, 0, 1, 0, 0][i],
  sway: [-1, -2, -2, -1, -2, -2][i],
  staff: [1, 0, -1, 1, 0, -1][i],
  legs: {
    front: leg([3, 1, -1, -3, -1, 1][i], [0, 0, 0, 0, 2, 2][i]),
    back: leg([-3, -1, 1, 3, 1, -1][i], [0, 2, 2, 0, 0, 0][i]),
  },
  light: 1,
})));
// raise the staff high, then bring it down: a ring of runes races out from the blow
anim('strike', seq(6, (i) => ({
  lift: [0, 3, 6, 0, 0, 0][i],
  lean: [0, -1, -1, 1, 1, 0][i],
  bob: [0, 0, 0, 1, 1, 0][i],
  orb: [1, 2, 2, 2, 2, 1][i],
  ring: [0, 0, 0, 7, 14, 21][i],
  phase: i * 0.4,
  sway: [0, 1, 1, -1, -1, 0][i],
  light: [1, 1, 2, 2, 2, 1][i],
})));
anim('cast', seq(4, (i) => ({ orb: 2, runes: 5, phase: (i / 4) * (TURN / 5), lift: [1, 2, 2, 1][i], bob: i % 2, sway: [1, 2, 1, 2][i], light: 2 })));
anim('raise', seq(4, (i) => ({ orb: 2, lift: [2, 4, 5, 4][i], runes: 3, rise: [2, 5, 8, 11][i], phase: i * 0.6, sway: [0, 1, 1, 0][i], light: 2 })));
anim('point', seq(2, (i) => ({ staff: 10 + i, lean: 1, orb: 1, light: 1 })));
anim('kneel', seq(2, (i) => ({ still: true, bob: i, sway: i, orb: i, light: 1 })));
anim('rest', seq(2, (i) => ({ still: true, bob: i, head: [1, 1], sway: 1 - i, light: 0 })));
anim('pray', seq(2, (i) => ({ still: true, bob: i, head: [1, 2], sway: 2, orb: 2, runes: 4, rise: i * 3, phase: i * 0.8, light: 2 })));
anim('bow', seq(3, (i) => ({ head: [[1, 1], [1, 2], [2, 3]][i], lean: Math.min(1, i), light: 0 })));
anim('study', seq(2, (i) => ({ head: [1, 1], bob: i, orb: i, light: 0 })));
anim('stagger', seq(2, (i) => ({ lean: -2 - i, staff: -6 - i * 4, sway: 2, legs: { front: leg(-1), back: leg(1) }, light: 1 })));
anim('collapse', [{ still: true, head: [2, 3], sway: 2, light: 0 }]);
anim('lifted', seq(2, (i) => ({ sway: -3 + i, staff: -6 - i * 3, legs: { front: { dangle: -2 - i }, back: { dangle: -3 } }, light: 1 })));
anim('talk', seq(2, (i) => ({ lift: i, bob: i, orb: i, light: 1 })));
// drawn whole (core.js, composeDrawn), each set by his crown (where it stands as he stands), the
// orb on the staff kindled (drawn): the Flight of Tomes, the staff thrust high, the free hand
// raised, runes wheeling about the blazing orb while he holds it; the cast (the staff raised in
// both hands, thrust out as the orb blazes, back upright), each drawing twice, so that its light
// stirs on while it's held
anim('tomes', seq(4, (i) => ({ drawn: 'ult', mid: 54, ground: 154, orb: [95, 8, 6], kindle: 2, runes: 5, phase: (i / 4) * (TURN / 5), light: 2 })));
anim('staffcast', [0, 0, 1, 1, 2, 2].map((i) => ({
  drawn: 'attack', frame: i, mid: [78, 70, 76][i], ground: [104, 104, 99][i],
  orb: [[121, 9, 7], [146, 75, 7], [116, 8, 5]][i], kindle: [2, 2, 1][i], light: [1, 2, 1][i],
})));

const G = groups;
export default {
  id: 'runelord',
  src: import.meta.url, // (its module: what its baked sheet was made from, bake.js; and where a worker draws it, core.js)
  art: '/assets/hero/runelord.json',
  extraArt: {
    kneel: '/assets/hero/runelord-kneel.json',
    ult: '/assets/hero/runelord-ult.json',
    attack: '/assets/hero/runelord-attack.json',
  },
  epithet: 'of the Golden Rune',
  title: 'Rune Lord',
  burst: ['#ffc94a', '#fff3c4'],
  frame: FRAME,
  cols: 8,
  px: 2.1 / 82, // world units per art pixel: his eyes sit level with the knight's visor
  head: 99, // art pixels from the ground to the tips of the crown
  hits: { hammer: 3, cast: 1, send: 2, attack: 4 },
  feet: 'chain', // (each foot heard as it's set down: in armour, its chain clinking, npc.js)
  lunge: { attack: 0.35 }, // (his drawing thrown forward as the staff thrusts out: npc.js)
  glowIntensity: 1.15,
  glowColors: [[210, 140, 30], [255, 236, 170]],
  seed: 5150,
  prepare,
  compose,
  drawn,
  poses,
  groups,
  anims: {
    idle: { frames: G.idle, fps: 4 },
    walk: { frames: G.walk, fps: 9 },
    hammer: { frames: G.strike, fps: 8 },
    // (in eighteenths of a second: the staff raised 4, the thrust 3, upright again 4)
    attack: { frames: held(G.staffcast, [2, 2, 2, 1, 2, 2]), fps: 18 },
    ult: { frames: G.tomes, fps: 8 },
    read: { frames: G.study, fps: 1.4 },
    cast: { frames: G.cast, fps: 6 },
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
  groupFps: { idle: 4, walk: 9, strike: 8, cast: 6, raise: 5, point: 2, kneel: 1.5, rest: 1, pray: 3, bow: 3, study: 1.4, stagger: 4, collapse: 1, lifted: 4, talk: 2.5, tomes: 8, staffcast: 9 },
};
