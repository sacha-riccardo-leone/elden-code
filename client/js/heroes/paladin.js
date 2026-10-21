// Aurelion, the Radiant Oath: a golden-masked holy knight under a torn crimson cape, cradling a
// pale figure in one arm and carrying a long golden sword low in the other. His sorcery is holy
// light: the blade leaves a radiant arc, light bursts from it in rays, and a pillar of light
// falls on his sword.
// Source art: assets/hero/paladin.json (124x164, from paladin-stand.webp) and
// paladin-kneel.json (113x125, from paladin-kneel.webp). His swing (paladin-attack.json: the sword
// raised, cut down in front, carried on low behind), his Radiant Verdict (paladin-ult.json: the
// giant blade of light raised back over his shoulder, then swept low ahead of him; it's the giant
// of his light behind him that swings it, ults.js) and the pose he strikes meanwhile
// (paladin-pose.json: his sword held out low, pointing at the enemy) are drawn whole; they reach
// far wider than his frame, so they're kept in a bigger one (core.js, bigFrame).

import { Img, NONE, region, blit, rotatable, drawRotated, prepareStill, composeStill, held } from './core.js';

const FRAME = { w: 176, h: 172 };
const MID = 53; // source column between the boots
const GROUND = 162;
const OX = FRAME.w / 2 - MID;
const OY = FRAME.h - 1 - GROUND;

// Anatomy, in source-grid coordinates.
const HIP = 118;
const BACK_LEG = { x0: 26, x1: 50 };
const FRONT_LEG = { x0: 51, x1: 86 };
const CAPE = { x1: 25, y0: 50 }; // the torn cape hanging on the left
const HEAD = { y1: 37, x0: 38 }; // the golden mask and helm
const GRIP = { x: 31.5, y: 96.5 }; // the gauntlet on the hilt: the sword turns about it
const HAND = { x0: 26, x1: 37, y0: 89, y1: 103 };
const POMMEL = { x: 16.5, y: 84.5 };
const TIP = { x: 121.5, y: 159.5 };
const SLEN = Math.hypot(TIP.x - POMMEL.x, TIP.y - POMMEL.y);
const U = [(TIP.x - POMMEL.x) / SLEN, (TIP.y - POMMEL.y) / SLEN];
const REACH = Math.hypot(TIP.x - GRIP.x, TIP.y - GRIP.y);
const TIP_ANGLE = Math.atan2(TIP.y - GRIP.y, TIP.x - GRIP.x);
const KNEEL_HEAD_X = 78; // over the kneeling knight's helm

// His drawn poses: per frame of each, the column set where his body's middle (the scale skirt)
// stands as he stands, and the row he stands on. The Radiant Verdict's giant blade of light runs
// from its crossguard to its tip (`blade`, art pixels of the pose; `r` either side of that line),
// and glows steadily; wound up, a glint runs along it. Loosed, the wave leaves it (`from`).
const DRAWN = {
  attack: [
    { mid: 57, ground: 219 },
    { mid: 68, ground: 238 },
    { mid: 157, ground: 238 },
  ],
  ult: [
    { mid: 289, ground: 220, blade: { from: [248, 18], to: [1, 86], r: 8 } },
    { mid: 97, ground: 157, blade: { from: [179, 118], to: [433, 152], r: 8 }, from: [255, 135] },
  ],
  // the pose he strikes while the giant of his light (the Stand, ults.js) swings the Verdict
  pose: [{ mid: 142, ground: 160 }],
};
const BLADE_LIGHT = 'rqomk'; // the blade's white-gold (his palette's palest golds)
// the big frame: room for the giant blade reaching far behind him raised, and far ahead swept
const BIG = { w: 628, h: 240, anchor: 290 };
const PX = (2.1 / 140) * 1.2; // world units per art pixel: a head taller than the knight (1.2x)
// where the wave leaves him, [ahead, up] of his feet in world units (ults.js)
const muzzleAt = (d) => [(d.from[0] - d.mid) * PX, (d.ground - d.from[1]) * PX];

function swordCoords(x, y) {
  const dx = x + 0.5 - POMMEL.x;
  const dy = y + 0.5 - POMMEL.y;
  return [dx * U[0] + dy * U[1], Math.abs(dx * U[1] - dy * U[0])];
}
const inHand = (x, y) => x >= HAND.x0 && x <= HAND.x1 && y >= HAND.y0 && y <= HAND.y1;
function isSword(x, y) {
  if (inHand(x, y)) return false;
  if (x >= 88 && y >= 126) return true; // past his legs only the blade hangs this low
  const [t, d] = swordCoords(x, y);
  if (t >= -4 && t < 27) return d <= 3.2; // pommel and grip
  if (t >= 27 && t <= 32) return d <= 10; // crossguard
  if (t > 32 && t <= SLEN + 2) return d <= 5.5;
  return false;
}

function prepare(art, more = {}) {
  const { src, ids, addColor } = art;
  const colors = {
    deep: addColor('#e3b048'), // holy light, gold to white
    gold: addColor('#ffe7a4'),
    white: addColor('#fffbea'),
  };
  const blade = ids(BLADE_LIGHT);
  // cloth and armour hidden under the blade: carry what lies below it up (or above it down)
  const body = region(src, (x, y) => !isSword(x, y) && !inHand(x, y));
  for (let x = 12; x < src.w; x++) {
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
  const inLeg = (leg) => (x, y) => y >= HIP && x >= leg.x0 && x <= leg.x1;
  const isCape = (x, y) => x <= CAPE.x1 && y >= CAPE.y0;
  const isHead = (x, y) => y <= HEAD.y1 && x >= HEAD.x0;
  return {
    colors,
    blade,
    still: more.kneel && prepareStill(more.kneel, {
      ground: 123, mid: 70, neck: 38, waist: 75, cape: { x1: 45, y0: 50 }, fixed: (x) => x >= 88,
    }),
    parts: {
      sword: rotatable(region(src, isSword)),
      hand: region(src, inHand),
      head: region(body, isHead),
      cape: region(body, (x, y) => isCape(x, y) && y < HIP),
      backLeg: region(body, inLeg(BACK_LEG)),
      frontLeg: region(body, inLeg(FRONT_LEG)),
      body: region(body, (x, y) => !isHead(x, y) && !(isCape(x, y) && y < HIP) && !inLeg(BACK_LEG)(x, y) && !inLeg(FRONT_LEG)(x, y)),
    },
    energy: {
      hot: new Set([colors.deep, colors.gold]),
      core: new Set([colors.white]),
      // (and, of the giant blade's light, its palest: they glow white, drawn)
      soft: new Set([colors.white, ...ids('rq')]),
      dim: [colors.deep, colors.gold],
      flare: [colors.gold, colors.white],
      crackle: { main: colors.gold, core: colors.white, sparks: [colors.gold, colors.white] },
      style: 'shards',
      odds: [[0.1, 0.25, 0.97], [0.06, 0.18, 0.9], [0.02, 0.08, 0.6]],
      bigOff: 'lit',
      keepAbove: 10,
      arcs: [0, 0, 2],
      sparks: [1, 3, 7],
      sparkReach: 12,
      sparkRise: 5, // motes of light drift upward
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

// Holy light: a column falling from the sky onto (cx, toY), white at its heart.
function pillar(f, cx, toY, colors, put, width = 2) {
  for (let y = 0; y <= toY; y++) {
    const fade = y > toY - 6 ? 1 : 0.6 + 0.4 * Math.sin(y * 0.7);
    for (let k = -width - 1; k <= width + 1; k++) {
      const edge = Math.abs(k) > width;
      if (edge && (y + k) % 3) continue;
      put(cx + k, y, Math.abs(k) <= width / 2 ? colors.white : edge || fade < 0.5 ? colors.deep : colors.gold);
    }
  }
}

// Rays of light bursting from a point.
function rays(cx, cy, n, inner, outer, phase, colors, put) {
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const len = i % 2 ? outer * 0.6 : outer;
    for (let r = inner; r <= len; r += 0.8) {
      put(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r < inner + 2 ? colors.white : r > len - 2 ? colors.deep : colors.gold);
    }
  }
}

function compose(ctx, p) {
  const { colors } = ctx;
  if (p.still) {
    const f = composeStill(ctx.still, p, FRAME);
    const glow = [];
    const put = (x, y, v) => {
      const fx = Math.round(x);
      const fy = Math.round(y);
      if (fx < 0 || fy < 0 || fx >= FRAME.w || fy >= FRAME.h) return;
      f.set(fx, fy, v);
      glow.push(fy * FRAME.w + fx);
    };
    if (p.beam) {
      const ox = Math.round(FRAME.w / 2 - ctx.still.spec.mid);
      const oy = FRAME.h - 1 - ctx.still.spec.ground;
      pillar(f, KNEEL_HEAD_X + ox + (p.head?.[0] || 0), oy + (p.head?.[1] || 0) + 1, colors, put, p.beam);
    }
    f.keep = [...(f.keep || []), ...glow];
    return f;
  }
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

  const sway = p.sway || 0;
  blit(f, parts.cape, ux, uy);
  if (sway) blit(f, parts.cape, ux, uy, (y) => Math.round((sway * Math.max(0, y - CAPE.y0)) / (HIP - CAPE.y0)));
  const legs = p.legs || {};
  drawLeg(f, parts.backLeg, legs.back || {}, OX, OY);
  drawLeg(f, parts.frontLeg, legs.front || {}, OX, OY);
  blit(f, parts.body, ux, uy);
  const hd = p.head || [0, 0];
  blit(f, parts.head, ux + hd[0], uy + hd[1]);

  const deg = p.sword || 0;
  drawRotated(f, parts.sword, deg, GRIP, ux, uy);
  blit(f, parts.hand, ux, uy);

  const a = TIP_ANGLE + (deg * Math.PI) / 180;
  const along = (k) => [GRIP.x + ux + Math.cos(a) * REACH * k - 0.5, GRIP.y + uy + Math.sin(a) * REACH * k - 0.5];
  // the radiant arc the blade has just swept
  if (p.trail) {
    const [a0, a1] = p.trail.map((d) => TIP_ANGLE + (d * Math.PI) / 180);
    const steps = Math.ceil(Math.abs(a1 - a0) * REACH * 1.5);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = a0 + (a1 - a0) * t;
      const thick = 1 + Math.round(4 * t);
      for (let k = 0; k < thick; k++) {
        const r = REACH + 1 - k * 1.6;
        put(GRIP.x + ux + r * Math.cos(ang) - 0.5, GRIP.y + uy + r * Math.sin(ang) - 0.5, k === 0 ? colors.white : k < 3 ? colors.gold : colors.deep);
      }
    }
  }
  // light running along the blade
  if (p.glint != null) {
    const [gx, gy] = along(p.glint);
    put(gx, gy, colors.white);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(gx + dx, gy + dy, colors.gold);
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) put(gx + dx, gy + dy, colors.deep);
  }
  if (p.rays) {
    const [rx, ry] = along(p.rays.at);
    rays(rx, ry, p.rays.n || 8, p.rays.inner || 3, p.rays.outer || 10, p.rays.phase || 0, colors, put);
  }
  if (p.beam) {
    const [tx, ty] = along(1);
    pillar(f, tx, ty, colors, put, p.beam);
  }
  f.keep = glow;
  return f;
}

// A drawn pose (core.js, composeDrawn): in the Radiant Verdict, the giant blade's light glows
// steadily (its pixels kept lit, never flickering), and wound up, a glint runs along it from the
// crossguard to the tip.
function drawn(ctx, f, p) {
  const b = p.drawn === 'ult' && DRAWN.ult[p.frame || 0].blade;
  if (!b) return;
  const { colors } = ctx;
  const [ax, ay] = f.at;
  const dx = b.to[0] - b.from[0];
  const dy = b.to[1] - b.from[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const keep = (f.keep ||= []);
  const x0 = Math.max(0, ax + Math.min(b.from[0], b.to[0]) - b.r - 1);
  const x1 = Math.min(f.w - 1, ax + Math.max(b.from[0], b.to[0]) + b.r + 1);
  const y0 = Math.max(0, ay + Math.min(b.from[1], b.to[1]) - b.r - 1);
  const y1 = Math.min(f.h - 1, ay + Math.max(b.from[1], b.to[1]) + b.r + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x - ax + 0.5 - b.from[0];
      const py = y - ay + 0.5 - b.from[1];
      const t = px * ux + py * uy; // (along the blade, past the crossguard)
      if (t < 2 || t > len + 2 || Math.abs(px * uy - py * ux) > b.r) continue;
      if (ctx.blade.has(f.get(x, y))) keep.push(y * f.w + x);
    }
  }
  if (p.glint == null) return;
  const gx = Math.round(ax + b.from[0] + dx * p.glint);
  const gy = Math.round(ay + b.from[1] + dy * p.glint);
  const put = (x, y, v) => {
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) return;
    f.set(x, y, v);
    keep.push(y * f.w + x);
  };
  for (const [a, c] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) put(gx + a, gy + c, colors.white);
  for (const [a, c] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, 1], [1, -1], [-1, -1]]) put(gx + a, gy + c, colors.gold);
  for (const [a, c] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) put(gx + a, gy + c, colors.deep);
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

anim('idle', seq(6, (i) => ({ bob: [0, 0, 1, 1, 1, 0][i], sway: [0, 1, 1, 0, -1, -1][i], glint: [null, 0.35, 0.55, 0.75, 0.95, null][i], light: 1 })));
anim('walk', seq(6, (i) => ({
  bob: [1, 0, 0, 1, 0, 0][i],
  sway: [-1, -2, -3, -2, -2, -3][i],
  sword: [1, 0, -1, 1, 0, -1][i],
  legs: {
    front: leg([3, 1, -1, -3, -1, 1][i], [0, 0, 0, 0, 2, 2][i]),
    back: leg([-3, -1, 1, 3, 1, -1][i], [0, 2, 2, 0, 0, 0][i]),
  },
  light: 1,
})));
// raise the blade high and bring it down in a radiant arc that bursts at the tip
anim('strike', seq(6, (i) => ({
  sword: [0, -30, -62, -16, 3, 2][i],
  lean: [0, -1, -2, 1, 2, 1][i],
  bob: [0, 0, 0, 1, 1, 0][i],
  sway: [0, 1, 2, -1, -2, -1][i],
  legs: { front: leg([0, 0, -1, 2, 3, 2][i]), back: leg([0, 0, 1, -1, -2, -1][i]) },
  trail: [null, null, null, [-62, -16], [-36, 3], null][i],
  rays: i === 4 ? { at: 1, n: 8, inner: 2, outer: 9 } : i === 5 ? { at: 1, n: 8, inner: 6, outer: 12, phase: 0.4 } : null,
  light: [1, 1, 1, 2, 2, 1][i],
})));
// the blade held up before him, light bursting from it
anim('cast', seq(4, (i) => ({ sword: [-70, -74, -74, -70][i], lean: -1, bob: i % 2, rays: { at: 0.62, n: 8, inner: 4, outer: [9, 13, 15, 11][i], phase: i * 0.2 }, light: 2 })));
// the sword lifted to the sky, a pillar of light falling on it
anim('raise', seq(4, (i) => ({ sword: [-46, -64, -70, -68][i], sway: [0, 1, 1, 0][i], beam: [0, 1, 2, 2][i] || null, glint: [0.5, 0.8, 1, 0.9][i], light: 2 })));
anim('point', seq(2, (i) => ({ sword: -32 - i, lean: 1, legs: { front: leg(2), back: leg(-1) }, glint: 0.9, light: 1 })));
anim('kneel', seq(2, (i) => ({ still: true, bob: i, sway: i, light: 1 })));
anim('rest', seq(2, (i) => ({ still: true, bob: i, head: [1, 1], sway: 1 - i, light: 0 })));
anim('pray', seq(2, (i) => ({ still: true, bob: i, head: [1, 2], sway: 2, beam: 1 + i, light: 2 })));
anim('bow', seq(3, (i) => ({ head: [[1, 1], [2, 2], [2, 3]][i], lean: Math.min(1, i), sword: i, light: 0 })));
anim('study', seq(2, (i) => ({ head: [1, 1], bob: i, light: 0 })));
anim('stagger', seq(2, (i) => ({ lean: -2 - i, sword: -10 - i * 6, sway: 2, legs: { front: leg(-1), back: leg(1) }, light: 1 })));
anim('collapse', [{ still: true, head: [2, 3], sway: 2, light: 0 }]);
anim('lifted', seq(2, (i) => ({ sway: -3 + i, sword: -8 - i * 4, legs: { front: { dangle: -2 - i }, back: { dangle: -3 } }, light: 1 })));
anim('talk', seq(2, (i) => ({ sword: i ? -3 : 0, bob: i, light: 1 })));
// drawn whole (core.js, composeDrawn), all in the big frame: his swing; the Radiant Verdict wound
// up (four of it, a glint running along the giant blade while it's held) and loosed
const drawnPose = (key, k, more = {}) => ({ drawn: key, frame: k, mid: DRAWN[key][k].mid, ground: DRAWN[key][k].ground, big: true, ...more });
anim('swing', [0, 1, 2].map((i) => drawnPose('attack', i, { light: [1, 2, 1][i] })));
anim('verdict', seq(4, (i) => drawnPose('ult', 0, { glint: [0.15, 0.4, 0.65, 0.9][i], light: 2 })));
anim('sweep', [drawnPose('ult', 1, { light: 2 })]);
anim('jojo', [drawnPose('pose', 0, { light: 1 })]);

const G = groups;
export default {
  id: 'paladin',
  src: import.meta.url, // (its module: what its baked sheet was made from, bake.js; and where a worker draws it, core.js)
  art: '/assets/hero/paladin.json',
  extraArt: { kneel: '/assets/hero/paladin-kneel.json', ult: '/assets/hero/paladin-ult.json', attack: '/assets/hero/paladin-attack.json', pose: '/assets/hero/paladin-pose.json' },
  firstName: 'Aurelion',
  epithet: 'the Radiant Oath',
  title: 'Holy Knight',
  burst: ['#ffe7a4', '#fffbea'],
  frame: FRAME,
  bigFrame: BIG,
  cols: 8,
  px: PX,
  head: 160, // art pixels from the ground to the top of the helm
  hits: { hammer: 4, cast: 1, send: 2, attack: 4 },
  feet: 'chain', // (each foot heard as it's set down: in armour, its chain clinking, npc.js)
  lunge: { attack: 0.35 }, // (his drawing thrown forward as the sword comes down: npc.js)
  muzzles: { ult: muzzleAt(DRAWN.ult[1]) },
  glowIntensity: 1.1,
  glowColors: [[225, 175, 80], [255, 248, 220]],
  seed: 8811,
  prepare,
  compose,
  drawn,
  poses,
  groups,
  anims: {
    idle: { frames: G.idle, fps: 4 },
    walk: { frames: G.walk, fps: 9 },
    hammer: { frames: G.strike, fps: 9 },
    // (in eighteenths of a second: the sword raised 4, the cut 3, the follow-through 5)
    attack: { frames: held(G.swing, [4, 3, 5]), fps: 18 },
    ult: { frames: G.verdict, fps: 8 },
    sweep: { frames: G.sweep, fps: 1 },
    pose: { frames: G.jojo, fps: 1 },
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
  groupFps: { idle: 4, walk: 9, strike: 9, cast: 6, raise: 4, point: 2, kneel: 1.5, rest: 1, pray: 3, bow: 3, study: 1.4, stagger: 4, collapse: 1, lifted: 4, talk: 2.5, swing: 5, verdict: 8, sweep: 1, jojo: 1 },
};
