// The second great enemy of the Arena of Trials (fight.js): a dragon of bleached bone with golden
// wings, two pairs of them, that calls down red lightning. Built from the user's cut-out pieces
// (assets/boss/dragon.json: wings, head, neck, chest, arms, legs, tail in four, the jaw cut from
// the head; dragon-backs.json: the backs of the wings) as a skeleton:
// every piece turns about its own joint, the rest following (a forearm the arm, the jaw the skull),
// so each pose is posed rather than drawn, and every frame is the same dragon. Pieces are turned
// RotSprite-style (core.js), so their pixels stay crisp; a wing can also be squashed along its
// span or across it as it beats, and shows its back on the upstroke.
//
// Posed facing left, as drawn; every frame is then mirrored to face right, as all sprites do.

import { Img, NONE, rotatable } from './core.js';

const FRAME = { w: 600, h: 420 };
const GROUND = FRAME.h - 1; // the row the feet stand on
const MIDX = 300; // his body's middle (his hips, not tail or wings) sits here in every frame
// the head's lower jaw: below the line under its upper teeth, and in front of the hinge
const inJaw = (x, y) => x <= 44 && y >= 39.5 - (x - 5) * 0.13;

// Where each piece lies on its sheet (its box; the piece is the figure filling most of it), its
// joint (where it hangs from its parent, in the piece's own pixels), and which sheet.
const PIECES = {
  wingFar: { box: [1, 1, 178, 110], joint: [150, 92] },
  wingNear: { box: [247, 1, 195, 111], joint: [24, 94] },
  smallFar: { box: [26, 101, 141, 75], joint: [128, 44] },
  smallNear: { box: [254, 101, 134, 75], joint: [9, 44] },
  neck: { box: [189, 56, 39, 58], joint: [10, 53] },
  // (`caps`: open socket ends to close with bone, [cx, cy, rx, ry]: the pieces are made to slot
  // together like a figure's, and a socket's dark hollow shouldn't show where nothing slots in)
  torso: { box: [176, 111, 64, 79], joint: [33, 64], caps: [[53, 14, 6, 11], [4, 12, 5, 9]] },
  upperNear: { box: [365, 141, 37, 35], joint: [6, 10], caps: [[8, 13, 7, 11]] },
  upperFar: { box: [15, 143, 39, 34], joint: [33, 10], caps: [[31, 12, 7, 11]] },
  foreNear: { box: [348, 176, 56, 55], joint: [36, 6] },
  foreFar: { box: [10, 176, 58, 55], joint: [22, 6] },
  // the legs come as one figure each, thigh and shin and foot: cut at the knee (row 37)
  thighFar: { box: [107, 181, 59, 99], rows: [0, 37], joint: [51, 9], caps: [[47, 7, 8, 8]] },
  shinFar: { box: [107, 181, 59, 99], rows: [37, 99], joint: [41, 39] },
  thighNear: { box: [197, 192, 56, 98], rows: [0, 37], joint: [11, 8], caps: [[8, 7, 8, 8]] },
  shinNear: { box: [197, 192, 56, 98], rows: [37, 98], joint: [20, 38] },
  tail1: { box: [237, 182, 49, 52], joint: [5, 13] },
  tail2: { box: [271, 218, 55, 41], joint: [3, 19] },
  tail3: { box: [314, 237, 41, 30], joint: [3, 13] },
  tail4: { box: [354, 241, 101, 45], joint: [3, 17] },
  // the crested head, its lower jaw cut free to open and snap shut about its hinge
  skull: { box: [168, 1, 88, 66], test: (x, y) => !inJaw(x, y), joint: [44, 49] },
  jaw: { box: [168, 1, 88, 66], test: inJaw, joint: [42, 36] },
  backBig: { sheet: 'backs', box: [1, 1, 197, 111], joint: [21, 91] },
  backSmall: { sheet: 'backs', box: [7, 102, 138, 75], joint: [9, 50] },
};

// The skeleton, back to front as drawn. Each bone: its piece, its parent, and the socket its joint
// slots into, in the parent's own pixels (the virtual hips are the torso's pelvis: theirs too). The
// user's sheet is an exploded view, every piece set a little out from where it belongs; slotted in,
// each child's joint end tucks under its parent, or covers the cut end of it (the tail's
// segments, each over the one before). At rest every bone stands at angle 0, as drawn; a bone
// turns about its piece's joint.
const BONES = [
  { name: 'hips', virtual: true },
  { name: 'wingFar', parent: 'torso', socket: [9, 7] },
  { name: 'smallFar', parent: 'torso', socket: [7, 28] },
  { name: 'upperFar', parent: 'torso', socket: [4, 12] },
  { name: 'foreFar', parent: 'upperFar', socket: [17, 26] },
  // (a shin under its thigh, which covers the cut top of it at the knee; thigh and shin share their
  // box, so the shin's socket is its own joint: as drawn)
  { name: 'shinFar', parent: 'thighFar', socket: [41, 39] },
  { name: 'thighFar', parent: 'hips', socket: [16, 66] },
  { name: 'wingNear', parent: 'torso', socket: [47, 7] },
  { name: 'smallNear', parent: 'torso', socket: [52, 28] },
  { name: 'tail1', parent: 'hips', socket: [53, 66] },
  { name: 'tail2', parent: 'tail1', socket: [27, 41] },
  { name: 'tail3', parent: 'tail2', socket: [35, 29] },
  { name: 'tail4', parent: 'tail3', socket: [29, 18] },
  { name: 'shinNear', parent: 'thighNear', socket: [20, 38] },
  { name: 'torso', parent: 'hips', socket: [33, 64] },
  { name: 'thighNear', parent: 'hips', socket: [50, 68] }, // (in front of his belly)
  { name: 'neck', parent: 'torso', socket: [28, 7] },
  { name: 'skull', parent: 'neck', socket: [23, 4] },
  { name: 'jaw', parent: 'skull', socket: [42, 36] },
  { name: 'upperNear', parent: 'torso', socket: [51, 14] },
  { name: 'foreNear', parent: 'upperNear', socket: [20, 30] },
];
const BONE = Object.fromEntries(BONES.map((b) => [b.name, b]));
// Where each joint stands at rest: from the hips down the tree, each child's joint on its socket;
// then all of him moved so his feet stand on the ground, his hips at x = HIPX.
const HIPX = 300;
const SOLES = { Near: [27, 97], Far: [29, 98] }; // each foot's sole, in its shin's box
{
  const place = (b) => {
    if (b.at) return;
    if (b.virtual) { b.at = [0, 0]; return; }
    const parent = BONE[b.parent];
    place(parent);
    const pj = PIECES[parent.virtual ? 'torso' : parent.name].joint;
    b.at = [parent.at[0] + b.socket[0] - pj[0], parent.at[1] + b.socket[1] - pj[1]];
  };
  BONES.forEach(place);
  for (const b of BONES) if (!b.virtual) b.off = [b.at[0] - PIECES[b.name].joint[0], b.at[1] - PIECES[b.name].joint[1]];
  const low = Math.max(...Object.entries(SOLES).map(([side, [, y]]) => BONE[`shin${side}`].off[1] + y));
  const [dx, dy] = [HIPX - BONE.hips.at[0], GROUND - 1 - low];
  for (const b of BONES) {
    b.at = [b.at[0] + dx, b.at[1] + dy];
    if (b.off) b.off = [b.off[0] + dx, b.off[1] + dy];
  }
}
// the order bones are worked out in: a parent before its children
const SOLVE = [];
const solved = new Set();
const visit = (b) => {
  if (solved.has(b.name)) return;
  if (b.parent) visit(BONE[b.parent]);
  solved.add(b.name);
  SOLVE.push(b);
};
BONES.forEach(visit);

// ---------------------------------------------------------------------------------------------

// Every figure on a sheet (8-connected), labelled; each piece is the figure filling most of its box.
function label(src) {
  const lab = new Int32Array(src.w * src.h).fill(-1);
  let n = 0;
  for (let i = 0; i < lab.length; i++) {
    if (lab[i] >= 0 || src.c[i] === NONE) continue;
    const stack = [i];
    lab[i] = n;
    while (stack.length) {
      const k = stack.pop();
      const x = k % src.w;
      const y = (k - x) / src.w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= src.w || ny >= src.h) continue;
          const j = ny * src.w + nx;
          if (lab[j] < 0 && src.c[j] !== NONE) { lab[j] = n; stack.push(j); }
        }
      }
    }
    n += 1;
  }
  return lab;
}

function cut(src, lab, { box: [x0, y0, w, h], rows, test }) {
  const count = new Map();
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const l = lab[y * src.w + x];
    if (l >= 0) count.set(l, (count.get(l) || 0) + 1);
  }
  const mine = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const img = new Img(w, h);
  const [r0, r1] = rows || [0, h];
  for (let y = r0; y < r1; y++) for (let x = 0; x < w; x++) {
    if (lab[(y0 + y) * src.w + x0 + x] === mine && (!test || test(x, y))) img.set(x, y, src.get(x0 + x, y0 + y));
  }
  return img;
}

// A piece drawn into `dst` with its joint at (wx, wy), turned `deg` (positive: clockwise), and
// scaled sx along its own x and sy along its own y (about the joint); flipped left to right first
// if `flip`. Sampled from the piece's 4x RotSprite enlargement, so the pixels stay crisp.
function draw(dst, piece, wx, wy, deg = 0, sx = 1, sy = 1, flip = false) {
  const { img, big } = piece.rot;
  const [jx0, jy] = piece.joint;
  const jx = flip ? img.w - jx0 : jx0;
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  // where its corners land, to bound the work
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [cx, cy] of [[0, 0], [img.w, 0], [0, img.h], [img.w, img.h]]) {
    const u = (cx - jx) * sx;
    const v = (cy - jy) * sy;
    const X = wx + u * cos - v * sin;
    const Y = wy + u * sin + v * cos;
    minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y);
  }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(dst.h - 1, Math.ceil(maxY)); y++) {
    for (let x = Math.max(0, Math.floor(minX)); x <= Math.min(dst.w - 1, Math.ceil(maxX)); x++) {
      const ox = x + 0.5 - wx;
      const oy = y + 0.5 - wy;
      const u = (ox * cos + oy * sin) / sx;
      const v = (-ox * sin + oy * cos) / sy;
      let lx = u + jx;
      const ly = v + jy;
      if (flip) lx = img.w - lx;
      const val = big.get(Math.floor(lx * 4), Math.floor(ly * 4));
      if (val !== NONE) dst.set(x, y, val);
    }
  }
}

// Closes a socket's dark hollow with bone: its darkest pixels within the ellipse take the bone's
// shades, lit from above (light at the top, mid, then shadowed at the bottom).
function cap(img, [cx, cy, rx, ry], dark, shades) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      const v = img.get(x, y);
      if (d > 1 || v === NONE || !dark.has(v)) continue;
      const k = Math.min(shades.length - 1, Math.floor(((y - (cy - ry)) / (2 * ry)) * shades.length));
      img.set(x, y, shades[d > 0.75 ? Math.min(shades.length - 1, k + 1) : k]);
    }
  }
}

function prepare(art, more) {
  const sheets = { main: art.src, backs: more.backs.src };
  const labels = Object.fromEntries(Object.entries(sheets).map(([k, s]) => [k, label(s)]));
  // the hollows' dark browns, and the bone's shades from light to shadow
  const dark = art.ids('ABCDEFHJLNQUWZ');
  const shades = [...'53z1xt'].map(art.code);
  const pieces = {};
  for (const [name, p] of Object.entries(PIECES)) {
    const sheet = p.sheet || 'main';
    const img = cut(sheets[sheet], labels[sheet], p);
    for (const c of p.caps || []) cap(img, c, dark, shades);
    pieces[name] = { name, joint: p.joint, rot: rotatable(img) };
  }
  // (the far wings' backs are the near ones', mirrored: compose)
  return {
    pieces,
    maw: [art.code('G'), art.code('B')], // the inside of the mouth, deep red-brown into shadow
    // nothing of him glows (his lightning is thrown, bossfx.js)
    energy: { hot: new Set(), core: new Set(), soft: new Set(), dim: [0, 0], flare: [0, 0], crackle: { main: 0, core: 0, sparks: [0] }, arcs: [0, 0, 0], sparks: [0, 0, 0] },
  };
}

// ---------------------------------------------------------------------------------------------
// posing

// Each leg's hip, knee and the sole of its foot at rest (frame pixels), for the legs' IK: a pose
// says where the feet stand, and the thigh and shin turn to reach them. He stands with his feet
// set wider than the pieces fall (SPREAD, outward), the legs bending to reach them.
const SPREAD = { Near: 9, Far: -9 };
const LEGS = {};
for (const [side, sole] of Object.entries(SOLES)) {
  const thigh = BONE[`thigh${side}`];
  const shin = BONE[`shin${side}`];
  const hip = thigh.at;
  const knee = shin.at;
  const drawn = [shin.off[0] + sole[0], shin.off[1] + sole[1]];
  const foot = [drawn[0] + SPREAD[side], drawn[1]];
  const T = [knee[0] - hip[0], knee[1] - hip[1]];
  const S = [drawn[0] - knee[0], drawn[1] - knee[1]];
  // which side of the line from hip to foot the knee lies on (kept as the legs bend)
  const D = [drawn[0] - hip[0], drawn[1] - hip[1]];
  LEGS[side] = { foot, T, S, L1: Math.hypot(...T), L2: Math.hypot(...S), bend: Math.sign(D[0] * T[1] - D[1] * T[0]) || 1 };
}
const deg = (r) => (r * 180) / Math.PI;
const ang = ([x, y]) => Math.atan2(y, x);

// Thigh and shin turns (absolute, from rest) that bring the foot from the hip at `hip` to `foot`.
function reach(leg, hip, foot) {
  const D = [foot[0] - hip[0], foot[1] - hip[1]];
  const d = Math.max(Math.abs(leg.L1 - leg.L2) + 0.5, Math.min(leg.L1 + leg.L2 - 0.5, Math.hypot(...D)));
  const cosA = (leg.L1 ** 2 + d ** 2 - leg.L2 ** 2) / (2 * leg.L1 * d);
  const thighDir = ang(D) - leg.bend * Math.acos(Math.max(-1, Math.min(1, cosA)));
  const knee = [hip[0] + Math.cos(thighDir) * leg.L1, hip[1] + Math.sin(thighDir) * leg.L1];
  const shinDir = ang([hip[0] + (D[0] / Math.hypot(...D)) * d - knee[0], hip[1] + (D[1] / Math.hypot(...D)) * d - knee[1]]);
  return { thigh: deg(thighDir - ang(leg.T)), shin: deg(shinDir - ang(leg.S)) };
}

// Where every bone stands, how it's turned, and whether it's mirrored, for a pose:
//   root: [dx, dy]   the whole body moved (the feet stay put unless `feet` moves them)
//   a: { bone: deg } turns (clockwise), each adding to its parent's
//   feet: { Near: [dx, dy], Far: [dx, dy] } the soles moved from where they stand at rest; or
//         null for legs that hang free (in flight), turned by `a` alone
//   flip: { bone: true } that bone and all it carries mirrored about its joint (a head turned
//         to look behind)
function solve(pose) {
  const out = {};
  const [rx, ry] = pose.root || [0, 0];
  const a = { ...(pose.a || {}) };
  for (const b of SOLVE) {
    if (!b.parent) {
      out[b.name] = { x: b.at[0] + rx, y: b.at[1] + ry, deg: a[b.name] || 0, flip: false };
    } else {
      const p = out[b.parent];
      const flip = p.flip || !!pose.flip?.[b.name];
      const pa = (p.deg * Math.PI) / 180;
      let ox = b.at[0] - BONE[b.parent].at[0];
      const oy = b.at[1] - BONE[b.parent].at[1];
      if (p.flip) ox = -ox;
      // the legs reach for their feet
      const side = b.name.startsWith('thigh') ? b.name.slice(5) : null;
      if (side && pose.feet !== null) {
        const leg = LEGS[side];
        const [fx, fy] = pose.feet?.[side] || [0, 0];
        const hip = [p.x + ox * Math.cos(pa) - oy * Math.sin(pa), p.y + ox * Math.sin(pa) + oy * Math.cos(pa)];
        const r = reach(leg, hip, [leg.foot[0] + fx, leg.foot[1] + fy]);
        a[b.name] = r.thigh - p.deg;
        a[`shin${side}`] = r.shin - r.thigh;
      }
      let own = (a[b.name] || 0) * (flip ? -1 : 1);
      const x = p.x + ox * Math.cos(pa) - oy * Math.sin(pa);
      const y = p.y + ox * Math.sin(pa) + oy * Math.cos(pa);
      // the tail lies along the ground rather than through it: a segment whose far end would
      // sink below it lifts until it doesn't
      const end = TAIL_END[b.name];
      if (end) {
        const reachOf = (d) => {
          const r = ((p.deg + d) * Math.PI) / 180;
          const ex = end[0] - PIECES[b.name].joint[0];
          const ey = end[1] - PIECES[b.name].joint[1];
          return y + ex * Math.sin(r) + ey * Math.cos(r);
        };
        for (let k = 0; k < 40 && reachOf(own) > GROUND - 3; k++) own -= 2;
      }
      out[b.name] = { x, y, deg: p.deg + own, flip };
    }
  }
  return out;
}
// the far end of each tail segment (its piece's pixels): where the next sits, and the tip
const TAIL_END = { tail1: [30, 44], tail2: [38, 31], tail3: [32, 19], tail4: [99, 43] };

// The dark red inside the mouth, filled behind the jaw where it opens wider than drawn: the
// triangle between its hinge, the tip of the upper jaw and the tip of the lower.
function mouth(f, at, ctx) {
  const s = at.skull;
  const j = at.jaw;
  const local = (w, px, py, joint) => {
    const r = (w.deg * Math.PI) / 180;
    const dx = (w.flip ? -1 : 1) * (px - joint[0]);
    const dy = py - joint[1];
    return [w.x + dx * Math.cos(r) - dy * Math.sin(r), w.y + dx * Math.sin(r) + dy * Math.cos(r)];
  };
  const tri = [local(j, 42, 36, PIECES.jaw.joint), local(s, 9, 37, PIECES.skull.joint), local(j, 12, 50, PIECES.jaw.joint)];
  const [x0, x1] = [Math.min(...tri.map((p) => p[0])), Math.max(...tri.map((p) => p[0]))];
  const [y0, y1] = [Math.min(...tri.map((p) => p[1])), Math.max(...tri.map((p) => p[1]))];
  const side = (p, q, x, y) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  for (let y = Math.floor(y0); y <= y1; y++) {
    for (let x = Math.floor(x0); x <= x1; x++) {
      const s0 = side(tri[0], tri[1], x + 0.5, y + 0.5);
      const s1 = side(tri[1], tri[2], x + 0.5, y + 0.5);
      const s2 = side(tri[2], tri[0], x + 0.5, y + 0.5);
      if ((s0 >= 0 && s1 >= 0 && s2 >= 0) || (s0 <= 0 && s1 <= 0 && s2 <= 0)) f.set(x, y, y < (y0 + y1) / 2 ? ctx.maw[0] : ctx.maw[1]);
    }
  }
}

function compose(ctx, pose) {
  const f = new Img(FRAME.w, FRAME.h);
  const at = solve(pose);
  for (const b of BONES) {
    if (b.virtual) continue;
    const w = at[b.name];
    const [sx, sy] = pose.s?.[b.name] || [1, 1];
    let piece = ctx.pieces[b.name];
    let flip = w.flip;
    // a wing turned away shows its back
    if (pose.back?.[b.name]) {
      const big = b.name === 'wingNear' || b.name === 'wingFar';
      piece = ctx.pieces[big ? 'backBig' : 'backSmall'];
      flip = b.name === 'wingFar' || b.name === 'smallFar';
    }
    if (b.name === 'jaw') mouth(f, at, ctx);
    draw(f, piece, w.x, w.y, w.deg, sx, sy, flip);
  }
  // facing right, as every sprite's drawing does, his body's middle at MIDX
  const out = new Img(FRAME.w, FRAME.h);
  for (let y = 0; y < FRAME.h; y++) {
    for (let x = 0; x < FRAME.w; x++) {
      const sx = HIPX + MIDX - x;
      if (sx >= 0 && sx < FRAME.w) out.c[y * FRAME.w + x] = f.c[y * FRAME.w + sx];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// poses and animations (drawn facing left: forward is -x; a positive turn is clockwise, so it
// tips an arm hanging down forward, raises a snout, and closes the jaw)

const poses = [];
const groups = {};
function anim(name, list) {
  groups[name] = list.map((p) => {
    poses.push(p);
    return poses.length - 1;
  });
}
const TAU = Math.PI * 2;
const sin = Math.sin;
// a pose from the bones' turns and anything else, the turns added to `base`'s
function pose(base, over = {}) {
  const a = { ...(base.a || {}) };
  for (const [k, v] of Object.entries(over.a || {})) a[k] = (a[k] || 0) + v;
  return { ...base, ...over, a };
}
const STAND = { root: [0, 0], a: {}, feet: {} };

// breathing, the wings and tail stirring, the head turning a little: a slow loop
anim('idle', Array.from({ length: 8 }, (_, i) => {
  const t = (i / 8) * TAU;
  return pose(STAND, {
    root: [0, Math.round(1.5 + 1.5 * sin(t))],
    a: {
      torso: 1.2 * sin(t), neck: -2.5 * sin(t + 0.6), skull: 3 * sin(t + 1.2), jaw: 5 + 4 * sin(t * 2),
      wingNear: -3 * sin(t), wingFar: 3 * sin(t + 0.3), smallNear: -4 * sin(t + 1), smallFar: 4 * sin(t + 1.3),
      upperNear: 3 * sin(t + 0.4), foreNear: -3 * sin(t + 0.8), upperFar: -3 * sin(t + 0.4), foreFar: 3 * sin(t + 0.8),
      tail1: 2 * sin(t), tail2: 3.5 * sin(t - 0.8), tail3: 5 * sin(t - 1.6), tail4: 6 * sin(t - 2.4),
    },
  });
}));

// a heavy stride: each foot lifted and swung forward in turn, the body rising and falling over
// them, the tail and the arms swinging against it, the wings rocking
anim('walk', Array.from({ length: 8 }, (_, i) => {
  const t = (i / 8) * TAU;
  const step = (ph) => [-26 * Math.cos(ph), -14 * Math.max(0, sin(ph))];
  return pose(STAND, {
    root: [0, Math.round(3 - 4 * Math.abs(sin(t)))],
    feet: { Near: step(t), Far: step(t + Math.PI) },
    a: {
      torso: -4 + 2 * sin(t * 2), neck: -4 + 3 * sin(t * 2 + 0.5), skull: -2 + 3 * sin(t * 2 + 1), jaw: 6,
      wingNear: -4 * sin(t), wingFar: 4 * sin(t), smallNear: -5 * sin(t + 0.6), smallFar: 5 * sin(t + 0.6),
      upperNear: 10 * sin(t + Math.PI), foreNear: 6 * sin(t + Math.PI), upperFar: 10 * sin(t), foreFar: 6 * sin(t),
      tail1: 4 * sin(t), tail2: 6 * sin(t - 0.7), tail3: 8 * sin(t - 1.4), tail4: 10 * sin(t - 2.1),
    },
  });
}));

// in the air: the four wings beating (the small pair a beat behind), each shown from behind on
// the upstroke, the legs hanging, the tail streaming out behind
const AIR = pose(STAND, {
  root: [0, -26],
  feet: null,
  a: { torso: -8, neck: -8, skull: -6, jaw: 8, thighNear: 18, shinNear: 22, thighFar: 22, shinFar: 18, upperNear: 30, foreNear: 50, upperFar: -10, foreFar: 40, tail1: -20, tail2: -8, tail3: -6, tail4: -4 },
});
function flap(t) {
  // t 0..1 round the beat: 0 wings high, 0.5 low
  const big = Math.cos(t * TAU); // 1 up, -1 down
  const small = Math.cos(t * TAU - 0.9);
  const up = t > 0.55; // rising again: the backs show
  return pose(AIR, {
    root: [0, -26 + Math.round(5 * big)],
    a: {
      wingNear: -42 * big + 8, wingFar: 42 * big - 8, smallNear: -36 * small + 10, smallFar: 36 * small - 10,
      tail2: 4 * sin(t * TAU), tail3: 6 * sin(t * TAU - 1), tail4: 8 * sin(t * TAU - 2),
    },
    s: {
      wingNear: [1, 0.72 + 0.28 * Math.abs(big)], wingFar: [1, 0.72 + 0.28 * Math.abs(big)],
      smallNear: [1, 0.75 + 0.25 * Math.abs(small)], smallFar: [1, 0.75 + 0.25 * Math.abs(small)],
    },
    back: { wingNear: up, wingFar: up, smallNear: up && t < 0.95, smallFar: up && t < 0.95 },
  });
}
anim('fly', Array.from({ length: 6 }, (_, i) => flap(i / 6)));
// gathering to take off: down in a crouch, wings raised high; and coming down to land: legs
// reaching for the ground, wings spread wide to brake
anim('takeoff', [pose(STAND, { root: [0, 16], a: { torso: -6, neck: -6, skull: -4, jaw: 4, wingNear: -40, wingFar: 40, smallNear: -30, smallFar: 30, upperNear: 10, upperFar: -6, tail1: 8, tail2: 6 } })]);
anim('land', [pose(STAND, { root: [0, 10], a: { torso: 4, neck: 6, skull: 6, jaw: -4, wingNear: -55, wingFar: 55, smallNear: -40, smallFar: 40, upperNear: -20, foreNear: -20, upperFar: 20, foreFar: 20, tail1: -6, tail2: -4 } })]);

// the claw swipe: the near arm raised high and drawn back, then swept forward and across the
// body, ending at the far shoulder; the body turning into it
anim('claw-1', [pose(STAND, { root: [4, 4], a: { torso: 12, neck: 6, skull: -6, jaw: -10, upperNear: -168, foreNear: 62, upperFar: 18, foreFar: 10, wingNear: -14, wingFar: 6, tail1: -6, tail2: -6, tail3: -6 } })]);
anim('claw-2', [pose(STAND, { root: [-8, 6], a: { torso: -14, neck: -8, skull: -8, jaw: -14, upperNear: 72, foreNear: -16, upperFar: -10, foreFar: 8, wingNear: 8, wingFar: -6, tail1: 6, tail2: 6, tail3: 6 } })]);
anim('claw-3', [pose(STAND, { root: [-9, 6], a: { torso: -16, neck: -6, skull: -6, jaw: 2, upperNear: 40, foreNear: 118, upperFar: -14, foreFar: 6, wingNear: 10, wingFar: -8, tail1: 8, tail2: 8, tail3: 8 } })]);

// the lunging bite: the head drawn back and up, the jaws opening; then driven forward low, the
// neck straightened, the jaws wide; then snapped shut
anim('bite-1', [pose(STAND, { root: [6, 6], a: { torso: 8, neck: 20, skull: 14, jaw: -14, upperNear: -6, upperFar: 6, wingNear: -8, wingFar: 8, tail1: -8, tail2: -6, tail3: -4 } })]);
anim('bite-2', [pose(STAND, { root: [-16, 10], a: { torso: -22, neck: -42, skull: -16, jaw: -24, upperNear: 20, foreNear: 10, upperFar: 10, wingNear: 10, wingFar: -10, tail1: 10, tail2: 8, tail3: 8 } })]);
anim('bite-3', [pose(STAND, { root: [-18, 10], a: { torso: -20, neck: -38, skull: -12, jaw: 14, upperNear: 16, foreNear: 8, upperFar: 8, wingNear: 8, wingFar: -8, tail1: 8, tail2: 6, tail3: 6 } })]);

// the thunder-summoning roar: drawing himself up, arms opening, head lifting; then standing tall,
// hands spread, wings raised; then the full roar to the sky, jaws wide (the bolts fall now)
anim('roar-1', [pose(STAND, { root: [0, 2], a: { torso: 6, neck: 10, skull: 14, jaw: -6, upperNear: -30, foreNear: -20, upperFar: 30, foreFar: 20, wingNear: -10, wingFar: 10, smallNear: -8, smallFar: 8 } })]);
anim('roar-2', [pose(STAND, { root: [0, -2], a: { torso: 10, neck: 20, skull: 28, jaw: -14, upperNear: -55, foreNear: -35, upperFar: 55, foreFar: 35, wingNear: -22, wingFar: 22, smallNear: -16, smallFar: 16, tail1: -6 } })]);
anim('roar-3', [
  pose(STAND, { root: [0, -6], a: { torso: 12, neck: 26, skull: 40, jaw: -28, upperNear: -62, foreNear: -40, upperFar: 62, foreFar: 40, wingNear: -30, wingFar: 30, smallNear: -22, smallFar: 22, tail1: -10, tail2: -6 } }),
  pose(STAND, { root: [0, -6], a: { torso: 12, neck: 27, skull: 41, jaw: -31, upperNear: -64, foreNear: -42, upperFar: 64, foreFar: 42, wingNear: -32, wingFar: 32, smallNear: -24, smallFar: 24, tail1: -10, tail2: -6 } }),
]);

// the tail sweep: crouching, the tail coiled round under him; then down almost on his knees,
// body near level, looking back over his shoulder as the tail lashes out low behind; full
// stretch; then rising, the tail easing down
anim('tail-1', [pose(STAND, { root: [4, 14], a: { torso: -8, neck: -4, skull: -2, jaw: 4, upperNear: 20, foreNear: 20, upperFar: -10, tail1: -34, tail2: -32, tail3: -34, tail4: -30, wingNear: -6, wingFar: 6 } })]);
anim('tail-2', [pose(STAND, { root: [-10, 46], a: { torso: -42, neck: 122, skull: 10, jaw: -10, upperNear: 50, foreNear: 10, upperFar: 36, foreFar: 10, tail1: -8, tail2: -4, tail3: -2, tail4: 0, wingNear: 36, wingFar: 36, smallNear: 34, smallFar: 34 }, flip: { skull: true } })]);
anim('tail-3', [pose(STAND, { root: [-12, 48], a: { torso: -46, neck: 126, skull: 6, jaw: -6, upperNear: 54, foreNear: 10, upperFar: 40, foreFar: 10, tail1: -22, tail2: -10, tail3: -6, tail4: -4, wingNear: 40, wingFar: 40, smallNear: 38, smallFar: 38 }, flip: { skull: true } })]);
anim('tail-4', [pose(STAND, { root: [-6, 22], a: { torso: -24, neck: 30, skull: -2, jaw: 4, upperNear: 28, foreNear: 10, upperFar: 20, tail1: -12, tail2: -6, tail3: -2, tail4: 2, wingNear: 18, wingFar: 18, smallNear: 16, smallFar: 16 } })]);

// struck hard: he reels back, wings flared, jaws open in pain; and dying, he sinks to the ground
anim('stagger', [
  pose(STAND, { root: [8, 4], a: { torso: 14, neck: 22, skull: 18, jaw: -18, upperNear: -20, foreNear: -20, upperFar: 20, foreFar: 20, wingNear: -20, wingFar: 20, smallNear: -14, smallFar: 14, tail1: -10, tail2: -8 } }),
  pose(STAND, { root: [11, 6], a: { torso: 16, neck: 25, skull: 20, jaw: -20, upperNear: -24, foreNear: -22, upperFar: 24, foreFar: 22, wingNear: -24, wingFar: 24, smallNear: -16, smallFar: 16, tail1: -12, tail2: -8 } }),
]);
anim('collapse', [
  pose(STAND, { root: [0, 20], a: { torso: -10, neck: -20, skull: -10, jaw: -10, wingNear: 20, wingFar: -20, smallNear: 15, smallFar: -15, upperNear: 20, upperFar: -10, tail1: 6, tail2: 6, tail3: 6 } }),
  pose(STAND, { root: [-6, 44], a: { torso: -26, neck: -40, skull: -22, jaw: -6, wingNear: 42, wingFar: -42, smallNear: 30, smallFar: -30, upperNear: 40, foreNear: 20, upperFar: 20, tail1: 14, tail2: 10, tail3: 10, tail4: 8 } }),
  pose(STAND, { root: [-10, 62], a: { torso: -40, neck: -60, skull: -30, jaw: 4, wingNear: 60, wingFar: -60, smallNear: 40, smallFar: -40, upperNear: 60, foreNear: 30, upperFar: 30, tail1: 18, tail2: 14, tail3: 12, tail4: 10 } }),
]);

const G = groups;
const once = (name, fps) => ({ frames: G[name], fps, once: true });
export default {
  id: 'dragon',
  art: '/assets/boss/dragon.json',
  extraArt: { backs: '/assets/boss/dragon-backs.json' },
  firstName: 'Ossyrion',
  epithet: 'the Pale Tempest',
  title: 'Great Enemy',
  frame: FRAME,
  cols: 6,
  px: 0.034, // world units per art pixel: about a hero's own, so he stands huge
  head: 255, // (to the crest of his head: where his words show)
  hits: {},
  glowIntensity: 1,
  glowColors: [[200, 20, 20], [255, 120, 100]],
  seed: 7331,
  prepare,
  compose,
  poses,
  groups,
  anims: {
    idle: { frames: G.idle, fps: 5 },
    walk: { frames: G.walk, fps: 7 },
    fly: { frames: G.fly, fps: 10 },
    takeoff: once('takeoff', 1),
    land: once('land', 1),
    stagger: { frames: G.stagger, fps: 3 },
    collapse: once('collapse', 3),
    ...Object.fromEntries(['claw-1', 'claw-2', 'claw-3', 'bite-1', 'bite-2', 'bite-3', 'roar-1', 'roar-2', 'tail-1', 'tail-2', 'tail-3', 'tail-4'].map((k) => [k, once(k, 1)])),
    'roar-3': { frames: G['roar-3'], fps: 8 },
  },
  groupFps: {},
  // (for the preview script)
  BONES,
  solve,
  PIECES,
};
