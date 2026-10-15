// Corisande, the Glintstone Witch: a sorceress of the old academy, in a navy robe and a red stole,
// with a staff of twisted wood crowned with glintstone, and a stone mask crowned in glintstone
// that she either wears or carries under her arm. One hero with two looks (director.js,
// updateForms): masked while she works her sorcery or fights, bare-faced, the mask under her arm,
// once she has been idle a while. Between the two she lifts the mask over her head (the drawing of
// that, `veil`), the staff standing by itself beside her.
//
// Glintstone sorcery: the staff's crystal kindles blue-white, motes of glintstone wheel round it,
// stars rise from it, and a thrust of the staff looses a glintstone pebble that streaks away and
// shatters. The mask's crystals glow as well, but feebly, far less than the staff's.
//
// Her drawings keep all their detail: they're sampled at twice the density of their drawn pixels
// (fine touches, like the light in her eyes, are half a drawn pixel), so her art grids are about
// twice the size of the other heroes' and her scale (px) half theirs. Every motion is in steps of
// K pixels to move as far as theirs do.
// Source art: sorceress.json (152x278, from sorceress-stand.png) and sorceress-kneel.json (155x246,
// from sorceress-kneel.webp), bare-faced, on one palette; sorceress-masked.json (140x279, from
// sorceress-masked-stand.png) and sorceress-masked-kneel.json (148x246, from
// sorceress-masked-kneel.webp), masked, on another; sorceress-veil.json (186x355, from
// sorceress-veil.png).

import { Img, NONE, region, blit, rotatable, drawRotated, prepareStill, composeStill } from './core.js';

const K = 2; // art pixels to one of the other heroes'
const PX = 1.95 / 190; // world units per art pixel: her eyes sit a little below the knight's visor
const NAME = { firstName: 'Corisande', epithet: 'the Glintstone Witch', title: 'Sorceress' };
const BURST = ['#6fc3ff', '#e8f8ff'];
// glintstone light (1, 2) and the mask's feeble glow (3)
const GLOW = { glowIntensity: 1.5, glowColors: [[70, 150, 255], [215, 242, 255], [20, 60, 54]] };

// ---------------------------------------------------------------------------------------------
// glintstone

const rgbOf = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
const lumOf = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b;
// the staff's glintstone: its blues, and the white at its heart (not its dark outline)
const isBlue = ([r, g, b]) => b > r + 40 && b >= g - 10;
// the mask's sea-green glintstone
const isTeal = ([r, g, b]) => g > r + 25 && b > r + 15 && Math.abs(g - b) < 60;
const isWhite = ([r, g, b]) => r + g + b > 600;

// A twin of a palette colour: the same to the eye (one channel nudged), but an entry of its own,
// so that only these pixels glow (the staff's glintstone and the mask's, not the blues of her eyes).
function twins(art, channel) {
  const made = new Map();
  const twin = (v) => {
    if (!made.has(v)) {
      const n = parseInt(art.palette[v].slice(1), 16);
      const shift = channel === 'red' ? 16 : 0;
      const c = (n >> shift) & 255;
      for (const d of [1, -1, 2, -2, 3, -3]) {
        if (c + d < 0 || c + d > 255) continue;
        const hex = `#${((n & ~(255 << shift)) | ((c + d) << shift)).toString(16).padStart(6, '0')}`;
        if (art.palette.includes(hex)) continue;
        made.set(v, art.addColor(hex));
        break;
      }
    }
    return made.get(v);
  };
  twin.all = () => [...made.values()];
  twin.light = () => [...made.entries()].filter(([v]) => lumOf(rgbOf(art.palette[v])) > 140).map(([, t]) => t);
  return twin;
}

// In one drawing: the staff's crystal (inside `box`) takes its twin colours, and so does the
// mask's glintstone crown (inside `crown`). Returns the crystal's pixels with their brightness, to
// kindle them.
function markGlintstone(art, palette, box, crown, staffTwin, crownTwin) {
  const { src } = art;
  const rgb = palette.map(rgbOf);
  const inBox = (b, x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
  const teal = (x, y) => { const v = src.get(x, y); return v !== NONE && isTeal(rgb[v]); };
  const lit = [];
  const crownPx = [];
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const v = src.get(x, y);
      if (v === NONE) continue;
      const c = rgb[v];
      if (inBox(box, x, y) && (isBlue(c) || isWhite(c))) lit.push([x, y, lumOf(c)]);
      else if (inBox(crown, x, y) && (isTeal(c) || (isWhite(c) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => teal(x + a, y + b))))) crownPx.push([x, y]);
    }
  }
  for (const [x, y] of lit) src.set(x, y, staffTwin(src.get(x, y)));
  for (const [x, y] of crownPx) src.set(x, y, crownTwin(src.get(x, y)));
  return lit;
}

// The crystal kindles: its pixels take on glintstone light by brightness (level 1: a glint at its
// heart; level 2: blazing).
function kindle(img, lit, level, colors, dx = 0, dy = 0) {
  if (!level) return;
  for (const [x, y, l] of lit) {
    let v;
    if (level >= 2) v = l > 150 ? colors.white : l > 95 ? colors.pale : l > 55 ? colors.glint : colors.deep;
    else if (l > 170) v = colors.white;
    else if (l > 120) v = colors.pale;
    else continue;
    img.set(x + dx, y + dy, v);
  }
}

function glintColors(art) {
  return {
    deep: art.addColor('#2f6cf0'),
    glint: art.addColor('#6fc3ff'),
    pale: art.addColor('#b9e8ff'),
    white: art.addColor('#f4fcff'),
  };
}

// The staff's glintstone always shines and never flickers out (a flare now and then); the mask's
// glows faintly and steadily.
function glintEnergy(colors, staffTwin, crownTwin) {
  return {
    hot: new Set([...staffTwin.all(), colors.deep, colors.glint, colors.pale]),
    core: new Set([colors.white]),
    soft: new Set([...staffTwin.light(), colors.pale]),
    dim: [colors.deep, colors.glint],
    flare: [colors.glint, colors.white],
    crackle: { main: colors.glint, core: colors.white, sparks: [colors.glint, colors.pale, colors.white] },
    style: 'shards',
    odds: [[0, 0, 1], [0, 0, 0.93], [0, 0, 0.7]],
    bigOff: 'lit',
    keepAbove: 10,
    arcs: [0, 1, 2],
    sparks: [1, 3, 8],
    sparkReach: 9 * K,
    sparkRise: 3 * K,
    faint: new Set(crownTwin.all()),
  };
}

// Sorcery drawn into a frame; every pixel of it glows steadily (f.keep).
function painter(f) {
  const glow = (f.keep ||= []);
  return (x, y, v) => {
    const fx = Math.round(x);
    const fy = Math.round(y);
    if (fx < 0 || fy < 0 || fx >= f.w || fy >= f.h) return;
    f.set(fx, fy, v);
    glow.push(fy * f.w + fx);
  };
}

// A glint of glintstone: a point, or (big) a little four-pointed star.
function spark(put, x, y, big, colors) {
  for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) put(x + a, y + b, colors.white);
  if (!big) return;
  for (let k = 1; k <= K; k++) {
    for (const [a, b] of [[K - 1 + k, 0], [-k, 0], [0, K - 1 + k], [0, -k], [K - 1 + k, K - 1], [-k, K - 1], [K - 1, K - 1 + k], [K - 1, -k]]) put(x + a, y + b, k === K ? colors.glint : colors.pale);
  }
}

// Motes of glintstone wheeling round a point (a flattened ring, as if lying round it).
function motes(put, cx, cy, count, phase, colors, rx = 9 * K, ry = 4 * K) {
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    spark(put, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, i % 2 === 0, colors);
  }
}

// Little stars rising from a point and spreading as they go.
function stars(put, cx, cy, rise, colors) {
  for (let i = 0; i < 4; i++) {
    const up = (rise + i * 4 * K) % (16 * K);
    const x = cx + (i % 2 ? 1 : -1) * (2 * K + i * K + up * 0.35);
    spark(put, x, cy - 3 * K - up, up < 9 * K, colors);
  }
}

// A glintstone pebble streaking along +x from (x0, y), `d` pixels out: a bright head and a tail
// that thins away behind it.
function pebble(put, x0, y, d, colors) {
  const hx = x0 + d;
  const tail = Math.min(d, 13 * K);
  for (let k = 1; k <= tail; k++) {
    const x = hx - k;
    const t = k / K;
    for (let w = -K + 1; w <= K - 1; w++) put(x, y + w, t < 4 ? colors.pale : t < 9 ? colors.glint : colors.deep);
    if (t < 6) { put(x, y - K, colors.glint); put(x, y + K, colors.glint); }
    if (k % (4 * K) === 2 * K) put(x, y + (k % (8 * K) < 4 * K ? -2 * K : 2 * K), colors.pale); // glints shed along the way
  }
  for (let a = -K; a <= K + 1; a++) for (let b = -K; b <= K; b++) if (Math.abs(a - 0.5) + Math.abs(b) <= K + 0.5) put(hx + a, y + b, colors.pale);
  for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) put(hx + a, y + b - K / 2, colors.white);
  put(hx + 2 * K + 1, y, colors.glint);
}

// The pebble shatters: shards flying out from where it struck.
function shatter(put, x, y, r, colors) {
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2 + (Math.round(r / K) % 2) * 0.39;
    for (let k = Math.max(1, r - 3 * K); k <= r; k++) put(x + k * Math.cos(ang), y + k * Math.sin(ang) * 0.8, k > r - K ? colors.glint : colors.pale);
  }
  for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) put(x + a, y + b, colors.white);
}

// Where a point of the staff goes when it's turned by `deg` about `pivot` (as drawRotated turns it).
function turned(pt, deg, pivot) {
  const a = (deg * Math.PI) / 180;
  const ox = pt.x - pivot.x;
  const oy = pt.y - pivot.y;
  return { x: pivot.x + ox * Math.cos(a) - oy * Math.sin(a), y: pivot.y + ox * Math.sin(a) + oy * Math.cos(a) };
}

// ---------------------------------------------------------------------------------------------
// the two looks (one rig each, from the same animation set)

// Anatomy, in each drawing's own grid:
//   ground, mid   – the row she stands on, the column between her boots
//   staffMin(y)   – the leftmost column the staff can reach on row y
//   seeds         – a pixel of the staff above the hand and one below it (it's flooded from these)
//   hand, grip    – the hand on the staff and the point the staff turns about
//   arm           – the forearm from the sleeve to the hand: it bends from x0 (still) to x1 (lifted
//                   with the hand)
//   neck          – rows above it are the head
//   backLeg/frontLeg(x, y) – the legs below the robe's hem
//   hem           – the robe sways below this row
//   crystal, crown – boxes holding the staff's glintstone (and its middle) and the mask's
//   kneel         – the kneeling drawing's still spec, crystal and crown
const BARE = {
  id: 'sorceress',
  form: 'bare',
  art: '/assets/hero/sorceress.json',
  kneelArt: '/assets/hero/sorceress-kneel.json',
  ground: 276,
  mid: 65,
  staffMin: (y) => (y <= 116 ? 124 : y <= 146 ? 130 : y <= 261 ? 122 : 112),
  seeds: [[145, 4], [128, 260]],
  hand: { x0: 126, x1: 144, y0: 117, y1: 134 },
  grip: { x: 134.5, y: 126 },
  arm: { x0: 115, x1: 131, y0: 128, y1: 152 },
  neck: 106,
  backLeg: (x, y) => y >= 246 && x >= (y <= 251 ? 30 : 27) && x <= (y <= 248 ? 45 : y <= 251 ? 48 : 51),
  frontLeg: (x, y) => y >= 242 && x >= (y <= 256 ? 76 : 73) && x <= (y <= 251 ? 92 : 104),
  hem: 200,
  crystal: { x0: 124, x1: 151, y0: 0, y1: 38, cx: 141, cy: 16 },
  crown: { x0: 18, x1: 58, y0: 103, y1: 134 },
  head: 236,
  kneel: {
    spec: { ground: 244, mid: 66, neck: 117, waist: 159, fixed: (x) => x >= 127 },
    crystal: { x0: 129, x1: 154, y0: 0, y1: 40, cx: 142, cy: 18 },
    crown: { x0: 5, x1: 60, y0: 113, y1: 146 },
  },
  seed: 6101,
};

const MASKED = {
  id: 'sorceress-masked',
  form: 'masked',
  art: '/assets/hero/sorceress-masked.json',
  kneelArt: '/assets/hero/sorceress-masked-kneel.json',
  ground: 278,
  mid: 64,
  staffMin: (y) => (y <= 118 ? 110 : y <= 150 ? 118 : 110),
  seeds: [[134, 3], [118, 260]],
  hand: { x0: 112, x1: 131, y0: 119, y1: 135 },
  grip: { x: 122, y: 127 },
  arm: { x0: 104, x1: 118, y0: 129, y1: 151 },
  neck: 117,
  backLeg: (x, y) => y >= 249 && x >= (y <= 254 ? 30 : 24) && x <= (y <= 254 ? 45 : 49),
  frontLeg: (x, y) => y >= 246 && x >= (y <= 259 ? 75 : y <= 264 ? 73 : 71) && x <= (y <= 254 ? 90 : 103),
  hem: 201,
  crystal: { x0: 114, x1: 139, y0: 0, y1: 38, cx: 130, cy: 17 },
  crown: { x0: 27, x1: 90, y0: 13, y1: 52 },
  head: 262,
  kneel: {
    spec: { ground: 244, mid: 66, neck: 121, waist: 163, fixed: (x) => x >= 119 },
    crystal: { x0: 121, x1: 148, y0: 0, y1: 38, cx: 135, cy: 18 },
    crown: { x0: 37, x1: 98, y0: 35, y1: 68 },
  },
  seed: 6151,
};

function lookRig(S) {
  const FRAME = { w: 300, h: 320 };
  const OX = FRAME.w / 2 - S.mid;
  const OY = FRAME.h - 1 - S.ground;
  const inBox = (b, x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;

  function prepare(art, more = {}) {
    const { src, palette } = art;
    const staffTwin = twins(art, 'blue');
    const crownTwin = twins(art, 'red');
    const colors = glintColors(art);
    const lit = markGlintstone(art, palette, S.crystal, S.crown, staffTwin, crownTwin);

    // the staff: flooded from its seeds through every pixel it could reach (never the hand)
    const staffMask = new Uint8Array(src.w * src.h);
    const reach = (x, y) => x >= 0 && y >= 0 && x < src.w && y < src.h && src.get(x, y) !== NONE
      && x >= S.staffMin(y) && !inBox(S.hand, x, y);
    const stack = S.seeds.filter(([x, y]) => reach(x, y)).map(([x, y]) => y * src.w + x);
    for (const k of stack) staffMask[k] = 1;
    while (stack.length) {
      const k = stack.pop();
      const x = k % src.w;
      const y = (k - x) / src.w;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
        const n = (y + b) * src.w + x + a;
        if (reach(x + a, y + b) && !staffMask[n]) { staffMask[n] = 1; stack.push(n); }
      }
    }
    const isStaff = (x, y) => staffMask[y * src.w + x] === 1;
    const isHand = (x, y) => inBox(S.hand, x, y);
    const isArm = (x, y) => inBox(S.arm, x, y) && !isStaff(x, y) && !isHand(x, y);
    const isLeg = (x, y) => S.backLeg(x, y) || S.frontLeg(x, y);
    const isHead = (x, y) => y < S.neck && !isStaff(x, y) && !isHand(x, y);
    const staff = region(src, isStaff);
    // the staff kindled (levels 1 and 2), ready to turn
    const staffAt = [0, 1, 2].map((level) => {
      const img = region(staff, () => true);
      kindle(img, lit, level, colors);
      return rotatable(img);
    });

    let still = null;
    let kneelLit = [];
    if (more.kneel) {
      const k = more.kneel;
      kneelLit = markGlintstone(k, palette, S.kneel.crystal, S.kneel.crown, staffTwin, crownTwin);
      still = prepareStill(k, S.kneel.spec);
    }
    return {
      colors,
      lit,
      kneelLit,
      still,
      parts: {
        staffAt,
        hand: region(src, isHand),
        arm: region(src, isArm),
        head: region(src, isHead),
        backLeg: region(src, S.backLeg),
        frontLeg: region(src, S.frontLeg),
        body: region(src, (x, y) => !isStaff(x, y) && !isHand(x, y) && !isArm(x, y) && !isLeg(x, y) && !isHead(x, y)),
      },
      energy: glintEnergy(colors, staffTwin, crownTwin),
    };
  }

  // A leg below the hem: sheared forward or back by `stride` (none at its top, all of it at the
  // boot), the boot raised by `lift`, or left to `dangle`.
  function drawLeg(dst, leg, { stride = 0, lift = 0, dangle = 0 }, dx, dy) {
    let top = -1;
    for (let y = 0; y < leg.h && top < 0; y++) for (let x = 0; x < leg.w; x++) if (leg.c[y * leg.w + x] !== NONE) { top = y; break; }
    if (top < 0) return;
    const span = Math.max(1, S.ground - top);
    for (let y = top; y < leg.h; y++) {
      const t = (y - top) / span;
      const shift = Math.round(stride * t + dangle * t * t);
      const up = Math.round(lift * t);
      for (let x = 0; x < leg.w; x++) {
        const v = leg.c[y * leg.w + x];
        if (v !== NONE) dst.set(x + dx + shift, y + dy - up, v);
      }
    }
  }

  function compose(ctx, p) {
    const { parts, colors } = ctx;
    if (p.still) {
      const f = composeStill(ctx.still, p, FRAME);
      const sp = S.kneel.spec;
      const ox = Math.round(FRAME.w / 2 - sp.mid);
      const oy = FRAME.h - 1 - sp.ground;
      kindle(f, ctx.kneelLit, p.glint || 0, colors, ox, oy);
      const put = painter(f);
      const c = S.kneel.crystal;
      if (p.motes) motes(put, c.cx + ox, c.cy + oy, p.motes, p.phase || 0, colors);
      if (p.stars != null) stars(put, c.cx + ox, c.y0 + oy, p.stars, colors);
      return f;
    }
    const f = new Img(FRAME.w, FRAME.h);
    const ux = OX + (p.lean || 0);
    const uy = OY + (p.bob || 0);

    // the legs step under the robe; the robe over them, its hem swaying
    const legs = p.legs || {};
    drawLeg(f, parts.backLeg, legs.back || {}, OX, OY);
    drawLeg(f, parts.frontLeg, legs.front || {}, OX, OY);
    const hem = p.hem || 0;
    blit(f, parts.body, ux, uy, hem ? (y) => (y < S.hem ? 0 : Math.round((hem * (y - S.hem)) / (S.ground - S.hem))) : null);
    const hd = p.head || [0, 0];
    blit(f, parts.head, ux + hd[0], uy + hd[1]);

    // the staff arm: raising the staff lifts the hand, and the forearm bends to follow
    const lift = p.lift || 0;
    const share = (x) => Math.max(0, Math.min(1, (x - S.arm.x0) / (S.arm.x1 - S.arm.x0)));
    const arm = parts.arm;
    for (let x = 0; x < arm.w; x++) {
      const up = Math.round(lift * share(x));
      for (let y = 0; y < arm.h; y++) {
        const v = arm.c[y * arm.w + x];
        if (v === NONE) continue;
        for (let k = 0; k <= up; k++) f.set(x + ux, y + uy - k, v);
      }
    }
    const deg = p.staff || 0;
    drawRotated(f, parts.staffAt[Math.min(2, p.glint || 0)], deg, S.grip, ux, uy - lift);
    blit(f, parts.hand, ux, uy - lift);

    // sorcery about the crystal (where the turned staff carries it)
    const put = painter(f);
    const c = turned({ x: S.crystal.cx, y: S.crystal.cy }, deg, S.grip);
    const cx = c.x + ux;
    const cy = c.y + uy - lift;
    if (p.motes) motes(put, cx, cy, p.motes, p.phase || 0, colors);
    if (p.stars != null) stars(put, cx, cy - 8 * K, p.stars, colors);
    if (p.pebble) pebble(put, cx + 4 * K, cy, p.pebble, colors);
    if (p.shatter) shatter(put, cx + 4 * K + p.at, cy, p.shatter, colors);
    return f;
  }

  return {
    id: S.id,
    pair: 'sorceress', // one hero with two looks (and the drawing between them): see director.js
    form: S.form,
    via: 'veil', // the drawing she wears while putting the mask on or taking it off
    art: S.art,
    extraArt: { kneel: S.kneelArt },
    ...NAME,
    burst: BURST,
    frame: FRAME,
    cols: 8,
    px: PX,
    head: S.head, // art pixels from the ground to the top of her head (of the mask's crown, masked)
    hits: { hammer: 3, cast: 1, send: 2 },
    ...GLOW,
    seed: S.seed,
    prepare,
    compose,
    poses,
    groups,
    anims,
    groupFps,
  };
}

// ---------------------------------------------------------------------------------------------
// the animation set (both looks), in the other heroes' pixels (scaled by K below)

const poses = [];
const groups = {};
function anim(name, list) {
  groups[name] = list.map((p) => { poses.push(p); return poses.length - 1; });
}
const seq = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
const leg = (stride, lift = 0) => ({ stride: stride * K, lift: lift * K });
const k2 = ([a, b]) => [a * K, b * K];
const TURN = Math.PI * 2;

anim('idle', seq(6, (i) => ({ bob: [0, 0, 1, 2, 1, 0][i], hem: [0, 0, 1, 2, 1, 0][i], glint: i % 3 === 1 ? 1 : 0, light: 1 })));
anim('walk', seq(6, (i) => ({
  bob: [1, 0, 0, 1, 0, 0][i] * K,
  hem: [1, 0, -1, -1, 0, 1][i] * K,
  staff: [1, 0, -1, 1, 0, -1][i],
  legs: {
    front: leg([3, 1, -1, -3, -1, 1][i], [0, 0, 0, 0, 2, 2][i]),
    back: leg([-3, -1, 1, 3, 1, -1][i], [0, 2, 2, 0, 0, 0][i]),
  },
  light: 1,
})));
// the staff drawn back while the crystal gathers light, then thrust out: a glintstone pebble
// streaks away from it and shatters
anim('strike', seq(6, (i) => ({
  lift: [2, 4, 1, 0, 0, 0][i] * K,
  lean: [-1, -1, 1, 1, 1, 0][i] * K,
  staff: [-6, -10, 8, 7, 5, 2][i],
  hem: [0, -1, 1, 1, 0, 0][i] * K,
  glint: [1, 2, 2, 2, 1, 1][i],
  motes: [0, 3, 0, 0, 0, 0][i],
  phase: 0.6,
  pebble: [0, 0, 4, 12, 20, 0][i] * K,
  shatter: [0, 0, 0, 0, 0, 5][i] * K,
  at: 22 * K,
  legs: { front: leg([0, 0, 2, 2, 1, 0][i]), back: leg([0, 0, -1, -1, 0, 0][i]) },
  light: [1, 2, 2, 2, 2, 1][i],
})));
anim('cast', seq(4, (i) => ({ glint: 2, motes: 5, phase: (i / 4) * (TURN / 5), lift: [1, 2, 2, 1][i] * K, bob: (i % 2) * K, hem: [0, 1, 0, -1][i] * K, light: 2 })));
anim('raise', seq(4, (i) => ({ glint: 2, lift: [2, 4, 5, 4][i] * K, stars: i * 4 * K, staff: [0, 2, 3, 2][i], light: 2 })));
anim('point', seq(2, (i) => ({ staff: 16 + i * 2, lean: K, glint: 1, light: 1 })));
anim('kneel', seq(2, (i) => ({ still: true, bob: i, glint: i, light: 1 })));
anim('rest', seq(2, (i) => ({ still: true, bob: i, head: k2([1, 1]), light: 0 })));
anim('pray', seq(2, (i) => ({ still: true, bob: i, head: k2([1, 2]), glint: 2, stars: i * 4 * K, light: 2 })));
anim('bow', seq(3, (i) => ({ head: k2([[1, 1], [1, 2], [2, 3]][i]), lean: Math.min(1, i) * K, hem: [0, 1, 1][i] * K, light: 0 })));
anim('study', seq(2, (i) => ({ head: k2([1, 1]), bob: i, glint: i, light: 0 })));
anim('stagger', seq(2, (i) => ({ lean: (-2 - i) * K, staff: -6 - i * 4, hem: 2 * K, legs: { front: leg(-1), back: leg(1) }, light: 1 })));
anim('collapse', [{ still: true, head: k2([2, 3]), light: 0 }]);
anim('lifted', seq(2, (i) => ({ staff: -6 - i * 3, hem: (-3 + i) * K, legs: { front: { dangle: (-2 - i) * K }, back: { dangle: -3 * K } }, light: 1 })));
anim('talk', seq(2, (i) => ({ lift: i * K, bob: i, glint: i, light: 1 })));

const G = groups;
const anims = {
  idle: { frames: G.idle, fps: 4 },
  walk: { frames: G.walk, fps: 8 },
  hammer: { frames: G.strike, fps: 9 },
  read: { frames: G.study, fps: 1.4 },
  cast: { frames: G.cast, fps: 6 },
  send: { frames: G.raise, fps: 5 },
  kneel: { frames: G.kneel, fps: 1.5 },
  sit: { frames: G.rest, fps: 1 },
  doze: { frames: G.rest, fps: 0.6 },
  bow: { frames: [...G.bow, G.bow[2], G.bow[2], G.bow[0]], fps: 3, once: true },
  wave: { frames: [...G.raise, ...G.raise], fps: 6, once: true },
  point: { frames: [...G.point, ...G.point], fps: 2, once: true },
  cheer: { frames: [...G.cast, ...G.cast], fps: 7, once: true },
  pray: { frames: G.pray, fps: 2 },
  collapse: { frames: G.collapse, fps: 1 },
  lifted: { frames: G.lifted, fps: 4 },
  talk: { frames: G.talk, fps: 2.5 },
  stagger: { frames: [...G.stagger, G.idle[0]], fps: 4, once: true },
  kneelBow: { frames: [G.kneel[0], ...G.rest, G.rest[1], G.kneel[0]], fps: 2, once: true },
};
const groupFps = { idle: 4, walk: 8, strike: 9, cast: 6, raise: 5, point: 2, kneel: 1.5, rest: 1, pray: 2, bow: 3, study: 1.4, stagger: 4, collapse: 1, lifted: 4, talk: 2.5 };

// bare-faced, the mask under her arm
export const bare = lookRig(BARE);
// masked
export const masked = lookRig(MASKED);

// ---------------------------------------------------------------------------------------------
// The mask going on or coming off: the drawing of her holding it up over her head, the staff
// standing by itself beside her. Brought to life as a still: she breathes, lifts the mask a
// little, the staff floats, and glintstone motes wheel about the mask's crown.

const VEIL = {
  frame: { w: 248, h: 362 },
  spec: { ground: 353, mid: 72, neck: 113, waist: 199, float: (x) => x >= 151 },
  crystal: { x0: 157, x1: 186, y0: 77, y1: 120 },
  crown: { x0: 37, x1: 106, y0: 0, y1: 42, cx: 71, cy: 21 },
};
const ALL = Object.keys(anims);
const veilPoses = seq(4, (i) => ({
  bob: [0, 0, 1, 1][i],
  head: k2([[0, 0], [0, -1], [0, -1], [0, 0]][i]),
  float: [0, 1, 2, 1][i] * K,
  motes: 3,
  phase: i * 0.8,
  light: [1, 2, 2, 1][i],
}));

export const veil = {
  id: 'sorceress-veil',
  pair: 'sorceress',
  form: 'veil',
  shift: true, // worn only while the mask goes on or comes off
  art: '/assets/hero/sorceress-veil.json',
  ...NAME,
  burst: BURST,
  motes: ['#6fc3ff', '#e8f8ff', '#2f6cf0'], // the glintstone light that gathers round her as she changes
  frame: VEIL.frame,
  cols: 4,
  px: PX,
  head: VEIL.spec.ground,
  hits: {},
  ...GLOW,
  seed: 6203,
  prepare(art) {
    const staffTwin = twins(art, 'blue');
    const crownTwin = twins(art, 'red');
    const colors = glintColors(art);
    const lit = markGlintstone(art, art.palette, VEIL.crystal, VEIL.crown, staffTwin, crownTwin);
    return { colors, lit, still: prepareStill(art, VEIL.spec), energy: glintEnergy(colors, staffTwin, crownTwin) };
  },
  compose(ctx, p) {
    const f = composeStill(ctx.still, p, VEIL.frame);
    const ox = Math.round(VEIL.frame.w / 2 - VEIL.spec.mid);
    const oy = VEIL.frame.h - 1 - VEIL.spec.ground;
    kindle(f, ctx.lit.map(([x, y, l]) => [x, y - (p.float || 0), l]), 1, ctx.colors, ox, oy);
    const hd = p.head || [0, 0];
    const c = VEIL.crown;
    motes(painter(f), c.cx + ox + hd[0], c.cy + oy + (p.bob || 0) + hd[1], p.motes, p.phase, ctx.colors, 17 * K, 5 * K);
    return f;
  },
  poses: veilPoses,
  groups: { shift: [0, 1, 2, 3] },
  anims: Object.fromEntries(ALL.map((k) => [k, { frames: [0, 1, 2, 3], fps: 4 }])),
  groupFps: { shift: 4 },
};
