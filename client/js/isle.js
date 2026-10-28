// The Isle of the Caged, north-east of Roundtable Hold beside the Arena of Trials: an island of grey
// brick of its own, joined to the Hold's rim by a long bridge of stone, where the great enemies keep
// those they have taken. Along its back stand three iron cages on stone plinths, two heroes held in
// each, idle, out of reach (not to be clicked, never taking up a session: director.js leaves them
// out); and at each cage's feet the pieces of a slab of stone that was thrown down there and broke,
// still glowing the red of a summoning sign, its white runes still to be read across its pieces.
// Touched (E), a sign summons the great enemy who holds that cage (fight.js, call: thy companions
// first); beaten from it, he lets them go (free): the cage's door swings open and its two walk out of
// it and away over the isle's bridge to the Round Table, as Sacha wants (no grace for them), and once
// there they're Tarnished like the rest, anyone's to become, to take into a fight, to take up a
// session. The signs wake one after another, as Sacha wants: the Guardian
// Golem's first, Fenrath's once the Golem's cage is open, Morvane's once Fenrath's is; one not yet
// awake lies dormant, an ember, and one whose cage is open is spent, dark. Freed is freed for good, in
// this browser (FREED). A little Site of Grace near the bridge's foot, a brazier either side of the
// middle cage.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HUB, BRIDGE } from './config.js';
import * as T from './textures.js';
import { rng, hexToRgb } from './pixel.js';
import { Builder, BRICK_TILE, scaleBoxUV, seedOf } from './build.js';
import { GraceFigure } from './grace.js';
import { FLOOR } from './arena.js';
import { Flame } from './fire.js';
import { SpriteBody } from './npc.js';
import { carry, flash } from './lights.js';
import { SHIFT } from './director.js';

// Where it lies (its middle: as far north as the arena's middle, so that the islands' backs never
// stand between it and the camera) and its shape: an oval `hw` either side of its middle east and
// west, and `hd` north and south.
export const ISLE = { cx: 40, cz: -43, hw: 15, hd: 10 };
// Its cages, west to east along its back (where each stands, from its middle): the great enemy whose
// broken sign lies before it, and the two heroes held in it (their ids: director.js, heroActor): Wynn
// and Ulric; Fortuna and Corisande; the Twofold (Ruadan by night, Solenne by day) and Aurelion.
export const CAGES = [
  { boss: 'golem', heroes: ['ronin', 'bandit'], x: -8.2 },
  { boss: 'fenrath', heroes: ['fortuna', 'sorceress'], x: 0 },
  { boss: 'morvane', heroes: ['twofold', 'paladin'], x: 8.2 },
];
// A cage: how wide (west to east), deep and tall its bars stand, on a plinth so high; how far apart its
// bars; its door, in the middle of its front, hinged on its west side: how wide, how far it swings open
// (radians, in toward its back: its broken sign lies at its foot) and over how long (seconds); where
// it stands (`z`, from the isle's middle), and how far either side of its middle its two stand in it.
const CAGE = { w: 5, d: 2.6, h: 3.7, plinth: 0.3, bar: 0.34, door: 1.5, swing: 1.9, opening: 1.4, z: -5.2, apart: 1.15 };
// A broken sign: its slab as it was (how wide, deep, thick: each piece its own thickness), how many
// times it cracked across (breakSlab), the gap between its pieces, how far they lie scattered from
// where they were, how far they lean back against the cage's plinth (their tops toward thee: radians)
// and how far tilted besides, at random; how round their edges, how many of its runes' pixels to a
// world unit, where it lies (`z`, at the foot of its cage's plinth), and its light (lights.js: power,
// reach).
const SIGN = { w: 2.4, d: 1.3, thick: [0.16, 0.32], across: 4, gap: 0.07, scatter: 0.22, lean: 0.34, tilt: 0.22, round: 0.05, ppu: 20, z: -2.95, light: [6, 7] };
// Freed (free): how long after the door begins to swing the first of its two walks out (seconds; the
// other so long after), how fast (world units a second), and their way out from the cage's middle,
// [across (toward the side each stood on), out, how high it stands]: to the door, through it to the
// edge of the plinth, down onto the sign's stones and over them, and down onto clear floor, where it's
// a Tarnished again (handOver), walking on to the Round Table.
const OUT = { after: 0.9, apart: 0.7, speed: 1.7, way: [[1.15, 0, 0.3], [0.35, 0.8, 0.3], [0.35, 1.5, 0.3], [0.4, 1.9, 0.22], [0.45, 2.7, 0.2], [0.8, 3.6, 0]] };
// Its little Site of Grace (from its middle), and how big it is (of an island's).
const GRACE = { x: 4.6, z: 4.6, k: 0.7 };
// Its braziers, either side of the middle cage.
const BRAZIERS = [[-4.1, -5.9], [4.1, -5.9]];
// Who holds each cage, as the signs and the log say it.
const NAMES = { golem: 'the Guardian Golem', fenrath: 'Fenrath', morvane: 'Morvane' };
const FREED = 'elden-code:freed';

// The bridge to it, straight from the Hold's middle toward its own: the way (a direction on the floor),
// the angle it leaves the Hold's rim at (hub.js opens its rim and its colonnade there), and where along
// it the bridge begins (just inside the Hold's rim) and ends (at the isle's edge).
export const WAY = (() => {
  const len = Math.hypot(ISLE.cx, ISLE.cz);
  const dir = [ISLE.cx / len, ISLE.cz / len];
  const edge = 1 / Math.hypot(dir[0] / ISLE.hw, dir[1] / ISLE.hd); // (from its middle back toward the Hold)
  return { dir, angle: Math.atan2(ISLE.cz, ISLE.cx), from: HUB.radius - 0.4, to: len - edge };
})();

// The cages opened so far, by the great enemy each was opened from (in this browser).
function freedNow() {
  try { return new Set(JSON.parse(localStorage.getItem(FREED) || '[]')); } catch { return new Set(); }
}

// The slab as it broke: cracks across it (`across` of them, spread along its length, each at a slant
// of its own), one along it, and one more anywhere; each piece a convex polygon ([[x, z]…], from the
// slab's middle), none a mere sliver.
function breakSlab(w, d, across, r) {
  const cuts = [];
  for (let k = 0; k < across; k++) cuts.push([-w / 2 + (w * (k + 0.75 + r() * 0.5)) / (across + 1), (r() - 0.5) * d * 0.4, (r() - 0.5) * 0.8]);
  cuts.push([(r() - 0.5) * w * 0.3, (r() - 0.5) * d * 0.3, Math.PI / 2 + (r() - 0.5) * 0.5]);
  cuts.push([(r() - 0.5) * w * 0.6, (r() - 0.5) * d * 0.5, r() * Math.PI]);
  let pieces = [[[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]];
  for (const [px, pz, a] of cuts) {
    const next = [];
    for (const p of pieces) for (const half of clip(p, px, pz, Math.cos(a), Math.sin(a))) if (half.length >= 3) next.push(half);
    pieces = next;
  }
  // (a polygon's area, by the shoelace)
  const area = (p) => Math.abs(p.reduce((s, [x, z], i) => s + x * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * z, 0)) / 2;
  return pieces.filter((p) => area(p) > 0.06);
}

// A convex polygon cut in two by the line through (px, pz) with normal (nx, nz).
function clip(poly, px, pz, nx, nz) {
  const side = ([x, z]) => (x - px) * nx + (z - pz) * nz;
  const a = [];
  const b = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    const sp = side(p);
    const sq = side(q);
    (sp >= 0 ? a : b).push(p);
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq);
      const m = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      a.push(m);
      b.push(m);
    }
  });
  return [a, b];
}

// (one of a geometry's groups as a geometry of its own: an extrusion's caps, 0, or its sides, 1)
function part(geo, k) {
  const flat = geo.index ? geo.toNonIndexed() : geo;
  const { start, count } = flat.groups[k];
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = flat.attributes[name];
    out.setAttribute(name, new THREE.Float32BufferAttribute(a.array.slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize));
  }
  return out;
}

// A sign's runes, as its slab bore them before it broke, `w` by `d` world units at `ppu` pixels to
// one: strokes, each a stem and its branches (as the summoning signs' runes are), carved dark in the
// isle's own grey stone (its floor's), a worn edge round each. Two drawings: its colours, and what of
// it glows (the runes white, their edges red, the stone not at all: the red comes from under it).
function runeCanvases(w, d, ppu, seed) {
  const W = Math.round(w * ppu);
  const H = Math.round(d * ppu);
  const r = rng(seed);
  const stroke = new Uint8Array(W * H);
  const line = (x0, y0, x1, y1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      for (const [dx, dy] of [[0, 0], [1, 0]]) if (x + dx >= 0 && x + dx < W && y >= 0 && y < H) stroke[y * W + x + dx] = 1;
    }
  };
  // a row of runes along it, each a slanting stem with two to four branches off it
  const count = 4;
  for (let k = 0; k < count; k++) {
    const cx = Math.round(((k + 0.5) * W) / count + (r() - 0.5) * 3);
    const top = Math.round(H * 0.2 + r() * 2);
    const bottom = Math.round(H * 0.82 - r() * 2);
    const lean = Math.round((r() - 0.5) * 4);
    line(cx + lean, top, cx - lean, bottom);
    const branches = 2 + Math.floor(r() * 3);
    for (let b = 0; b < branches; b++) {
      const t = 0.15 + r() * 0.7;
      const sx = Math.round(cx + lean - 2 * lean * t);
      const sy = Math.round(top + (bottom - top) * t);
      const side = r() < 0.5 ? -1 : 1;
      const len = 4 + Math.floor(r() * 4);
      line(sx, sy, sx + side * len, sy + (r() < 0.5 ? -1 : 1) * Math.round(len * (0.4 + r() * 0.6)));
    }
    if (r() < 0.5) line(cx - 4, top + 1, cx + 4, top + 1); // (a bar across its head)
  }
  const color = document.createElement('canvas');
  const glow = document.createElement('canvas');
  color.width = glow.width = W;
  color.height = glow.height = H;
  const ci = color.getContext('2d').createImageData(W, H);
  const gi = glow.getContext('2d').createImageData(W, H);
  const STONE = FLOOR.stone.map(hexToRgb);
  const at = (x, y) => x >= 0 && x < W && y >= 0 && y < H && stroke[y * W + x];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const near = !stroke[i] && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => at(x + dx, y + dy));
      let c;
      let g;
      // (the runes carved, dark in the stone, but for the light that fills them while the sign is awake)
      if (stroke[i]) { c = [29, 27, 32]; g = [255, 255, 255]; } else if (near) { c = [92, 86, 80]; g = [255, 70, 50]; } else {
        const k = r() < 0.12 ? 0.8 : 1;
        c = STONE[Math.floor(r() * STONE.length)].map((v) => Math.round(v * k));
        g = [0, 0, 0];
      }
      ci.data.set([...c, 255], i * 4);
      gi.data.set([...g, 255], i * 4);
    }
  }
  color.getContext('2d').putImageData(ci, 0, 0);
  glow.getContext('2d').putImageData(gi, 0, 0);
  return { color, glow };
}

// The stone of a sign's sides, a world unit of it (the world's 16 pixels): the isle's floor's grey,
// mottled, a darker pixel here and there, seamless.
function stoneCanvas(seed) {
  const r = rng(seed);
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const img = c.getContext('2d').createImageData(16, 16);
  const BASE = FLOOR.stone.map(hexToRgb);
  for (let i = 0; i < 256; i++) {
    const k = r() < 0.12 ? 0.75 : 1;
    img.data.set([...BASE[Math.floor(r() * BASE.length)].map((v) => Math.round(v * k)), 255], i * 4);
  }
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

// The red light from under a sign, as it falls on its stones' sides: brightest at each one's foot and
// gone a little way up (an extrusion's sides map its height to v, 1 at its foot falling as it rises:
// three.js, ExtrudeGeometry; clamped, all below its foot as bright as at it).
function underGlowCanvas() {
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.05, '#ffffff');
  grad.addColorStop(0.2, '#000000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1, 64);
  return c;
}

export class Isle extends Builder {
  constructor(world) {
    super(world, ISLE.cx, ISLE.cz);
    this.name = 'Isle of the Caged';
    this.subtitle = 'Where the great enemies keep their prisoners';
    this.mat = world.matsFor('ashen');
    this.freed = freedNow();
    this.ctx = null; // (the world's, once its prisoners are drawn: fill)
    this.cages = [];
    this.signs = [];
    this.braziers = [];
    this.walkers = []; // (those freed, on their way to the Round Table: handOver)
    this.build();
    this.mergeStatic();
    this.buildBridge();
  }

  // Whether a hero is still held in one of its cages (director.js keeps it out of the Lands Between).
  caged(id) {
    return CAGES.some((c) => c.heroes.includes(id) && !this.freed.has(c.boss));
  }

  // On its floor, `inset` in from its edge (or out past it).
  inside(x, z, inset = 0) {
    const u = (x - this.cx) / (ISLE.hw - inset);
    const v = (z - this.cz) / (ISLE.hd - inset);
    return u * u + v * v <= 1;
  }

  // On its bridge from the Hold (`pad` either side of its walkable strip).
  onBridge(x, z, pad = 0) {
    const [dx, dz] = WAY.dir;
    const along = x * dx + z * dz;
    return along >= WAY.from - 1 && along <= WAY.to + 1.5 && Math.abs(x * dz - z * dx) <= BRIDGE.halfWidth + pad;
  }

  // The isle itself (world.areaAt): not its bridge, which is no place of its own.
  contains(x, z) {
    return this.inside(x, z, -0.5);
  }

  isWalk(x, z) {
    return this.inside(x, z, 0.7) || this.onBridge(x, z);
  }

  build() {
    const { hw, hd } = ISLE;
    // its floor of grey brick, the arena's, worn to dirt and moss at its edge; a mossy lip round it,
    // open where the bridge comes in; and under it a rock of its own, down into the mist
    const tex = T.pixelTexture(T.floorCanvas(hw * 2, hd * 2, (cx, cz) => (((cx - hw) / (hw - 1.4)) ** 2 + ((cz - hd) / (hd - 1.4)) ** 2 < 1 ? 1.1 : 0.35), FLOOR, 6060));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 72), new THREE.MeshLambertMaterial({ map: tex }));
    floor.scale.set(hw, hd, 1);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.add(floor);
    const land = Math.atan2(-WAY.dir[1] / hd, -WAY.dir[0] / hw); // (where the bridge comes in, round its oval)
    const speed = Math.hypot(hw * Math.sin(land), hd * Math.cos(land));
    const open = (BRIDGE.halfWidth + 0.4) / speed;
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const t = land + open + ((Math.PI * 2 - 2 * open) * i) / 120;
      pts.push(new THREE.Vector3((hw - 0.1) * Math.cos(t), -0.05, (hd - 0.1) * Math.sin(t)));
    }
    this.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.22, 4, false), this.mat.stoneMoss));
    const rockTex = this.mat.rockTex.clone();
    rockTex.repeat.set(34, 13);
    rockTex.needsUpdate = true;
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.86, 26, 56, 1, true), new THREE.MeshLambertMaterial({ map: rockTex }));
    rock.scale.set(hw, 1, hd);
    rock.position.y = -13;
    this.add(rock);

    CAGES.forEach((c, i) => {
      this.cages.push(this.cage(c.x, CAGE.z, this.freed.has(c.boss)));
      this.signs.push(this.sign(i, c.x, SIGN.z));
    });
    for (const [x, z] of BRAZIERS) this.brazier(x, z);
    this.buildGrace();
  }

  // A cage of iron bars on a plinth of stone, its door (a group of its own, swinging on its hinge:
  // update) shut, or (`open`) standing open; nobody walks into it.
  cage(x, z, open) {
    const { w, d, h, plinth, bar } = CAGE;
    const iron = this.world.mat.iron;
    const top = plinth + h;
    const half = CAGE.door / 2;
    this.box(w + 0.3, plinth, d + 0.3, this.mat.stone, x, plinth / 2, z, { tile: 1 });
    const rod = (len) => new THREE.CylinderGeometry(0.035, 0.035, len, 5);
    const upright = (px, pz, into = this.group) => {
      const m = new THREE.Mesh(rod(h), iron);
      m.position.set(px, plinth + h / 2, pz);
      m.castShadow = true;
      into.add(m);
    };
    // its corner posts, crowned with points, and rails along its foot, round it high up and at its top
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this.box(0.16, h, 0.16, iron, x + (sx * w) / 2, plinth + h / 2, z + (sz * d) / 2, { tile: 1 });
        const point = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 4), iron);
        point.position.set(x + (sx * w) / 2, top + 0.16, z + (sz * d) / 2);
        point.castShadow = true;
        this.add(point);
      }
    }
    for (const y of [plinth + 0.1, plinth + h * 0.62, top]) {
      this.box(w, 0.1, 0.1, iron, x, y, z - d / 2, { tile: 1 });
      for (const sx of [-1, 1]) {
        this.box(0.1, 0.1, d, iron, x + (sx * w) / 2, y, z, { tile: 1 });
        this.box(w / 2 - half, 0.1, 0.1, iron, x + sx * (w / 4 + half / 2), y, z + d / 2, { tile: 1 });
      }
    }
    // its bars: along its back and its sides, either side of its door, and across its top
    for (let bx = -w / 2 + bar; bx < w / 2 - bar / 2; bx += bar) {
      upright(x + bx, z - d / 2);
      if (Math.abs(bx) > half + 0.08) upright(x + bx, z + d / 2);
      const across = new THREE.Mesh(rod(d), iron);
      across.rotation.x = Math.PI / 2;
      across.position.set(x + bx, top, z);
      this.add(across);
    }
    for (let bz = -d / 2 + bar; bz < d / 2 - bar / 2; bz += bar) for (const sx of [-1, 1]) upright(x + (sx * w) / 2, z + bz);
    // its door: a frame of its own with its bars, a lock on its free side; hinged at its west edge
    const door = new THREE.Group();
    door.position.set(x - half, 0, z + d / 2);
    const piece = (pw, ph, pd, mat, px, py) => {
      const m = new THREE.Mesh(scaleBoxUV(new THREE.BoxGeometry(pw, ph, pd), pw, ph, pd, 1), mat);
      m.position.set(px, py, 0);
      m.castShadow = true;
      door.add(m);
    };
    piece(0.1, h, 0.12, iron, 0.05, plinth + h / 2);
    piece(0.1, h, 0.12, iron, CAGE.door - 0.05, plinth + h / 2);
    for (const y of [plinth + 0.1, plinth + h * 0.62, top - 0.08]) piece(CAGE.door, 0.1, 0.12, iron, CAGE.door / 2, y);
    for (let bx = bar; bx < CAGE.door - bar / 2; bx += bar) upright(bx, 0, door);
    piece(0.24, 0.3, 0.16, this.world.mat.bronze, CAGE.door - 0.16, plinth + 1.45);
    if (open) door.rotation.y = CAGE.swing;
    this.add(door);
    this.block(x - w / 2 - 0.25, z - d / 2 - 0.25, x + w / 2 + 0.25, z + d / 2 + 0.25);
    return { x, z, door, figures: [], opening: open ? CAGE.opening : -1 };
  }

  // A broken sign before its cage: the slab's pieces, small stones of the isle's own grey, lying where
  // they fell a little apart, tilted this way and that, each its own thickness, with rounded edges (in
  // two meshes: their tops, the runes as they ran across the slab before it broke, and their sides);
  // and the red light welling up from under them, on the floor round them and between them, at the
  // feet of their sides, and a low haze (all dark while the sign sleeps: update); nobody walks over
  // them.
  sign(i, x, z) {
    const r = rng(9100 + i * 37);
    const { w, d, ppu } = SIGN;
    const runes = runeCanvases(w, d, ppu, 4400 + i * 13);
    const map = (canvas) => {
      const t = T.pixelTexture(canvas);
      t.repeat.set(1 / w, 1 / d);
      t.offset.set(0.5, 0.5);
      return t;
    };
    const top = new THREE.MeshLambertMaterial({ map: map(runes.color), emissive: '#ffffff', emissiveMap: map(runes.glow), emissiveIntensity: 0 });
    const rock = T.pixelTexture(stoneCanvas(61 + i), { repeat: [1, 1] });
    const side = new THREE.MeshLambertMaterial({ map: rock, emissive: '#ff2a16', emissiveMap: new THREE.CanvasTexture(underGlowCanvas()), emissiveIntensity: 0 });
    const caps = [];
    const sides = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const turn = (r() - 0.5) * 0.3; // (the whole of it, a little askew)
    for (const poly of breakSlab(w, d, SIGN.across, r)) {
      const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
      const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
      const shrunk = poly.map(([px, pz]) => {
        const dist = Math.hypot(px - cx, pz - cz) || 1;
        const k = Math.max(0.5, 1 - SIGN.gap / dist);
        return new THREE.Vector2(cx + (px - cx) * k, -(cz + (pz - cz) * k)); // (its shape's y: the slab's -z)
      });
      const thick = SIGN.thick[0] + r() * (SIGN.thick[1] - SIGN.thick[0]);
      const geo = new THREE.ExtrudeGeometry(new THREE.Shape(shrunk), { depth: thick, bevelEnabled: true, bevelThickness: SIGN.round, bevelSize: SIGN.round, bevelSegments: 2, curveSegments: 1 });
      geo.rotateX(-Math.PI / 2); // (lying flat, its top the shape's front, as the slab lay)
      geo.translate(-cx, SIGN.round - 0.06, -cz);
      // (scattered a little from where it was, outward and at random, tilted, sunk a little)
      const out = SIGN.scatter * (0.4 + r() * 0.6);
      const dist = Math.hypot(cx, cz) || 1;
      const sx = cx + (cx / dist) * out + (r() - 0.5) * 0.14;
      const sz = cz + (cz / dist) * out * 0.7 + (r() - 0.5) * 0.14;
      e.set(SIGN.lean + (r() - 0.5) * SIGN.tilt, (r() - 0.5) * 0.4, (r() - 0.5) * SIGN.tilt);
      m.compose(new THREE.Vector3(sx * Math.cos(turn) + sz * Math.sin(turn), -0.04, -sx * Math.sin(turn) + sz * Math.cos(turn)), q.setFromEuler(e).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn)), new THREE.Vector3(1, 1, 1));
      geo.applyMatrix4(m);
      caps.push(part(geo, 0));
      sides.push(part(geo, 1));
      geo.dispose();
    }
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    for (const [geos, mat] of [[caps, top], [sides, side]]) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      geos.forEach((g) => g.dispose());
    }
    // a few chips of it, flung farther
    const chips = new THREE.MeshLambertMaterial({ map: rock });
    for (let k = 0; k < 5; k++) {
      const a = r() * Math.PI * 2;
      const chip = new THREE.Mesh(new THREE.DodecahedronGeometry(0.05 + r() * 0.04, 0), chips);
      chip.position.set(Math.cos(a) * (w / 2 + 0.25 + r() * 0.4), 0.03, Math.sin(a) * (d / 2 + 0.2 + r() * 0.3));
      chip.rotation.set(r() * 3, r() * 3, r() * 3);
      group.add(chip);
    }
    // the red light from under it: a pool of it on the floor, spreading out round the stones, and a
    // brighter one right under them, showing between them; a low haze over it; its light, from low
    // among them (lights.js), on the floor, the cage and whoever stands by
    const glowOn = (pw, pd, color) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), new THREE.MeshBasicMaterial({
        map: this.world.tex.glow, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      p.rotation.x = -Math.PI / 2;
      p.position.y = 0.02;
      p.renderOrder = 4;
      group.add(p);
      return p;
    };
    const pool = glowOn(w + 2.8, d + 2.6, '#ff2a18');
    const core = glowOn(w + 0.6, d + 0.7, '#ff5a30');
    const haze = this.additiveSprite('#ff3a24', 3.4, 0);
    haze.position.set(0, 0.2, 0.2);
    group.add(haze);
    group.userData.dynamic = true;
    this.add(group);
    this.block(x - w / 2 - 0.2, z - d / 2 - 0.2, x + w / 2 + 0.2, z + d / 2 + 0.2);
    const s = { i, x, z, top, side, haze, pool, core, glow: this.state(i) === 'awake' ? 1 : 0, flare: 0, light: this.light(x, 0.3, z + 0.2, '#ff3a26', SIGN.light[1], 1.5) };
    // (red motes rising from under it while it's awake)
    this.ambient(4, () => (s.glow < 0.5 ? null : {
      pos: [this.wx(x), 0.15, this.wz(z)], spread: [w / 2, 0.1, d / 2], vel: [0, 0.5, 0], velSpread: [0.1, 0.2, 0.1],
      color: ['#ff4a32', '#ffd0c4', '#ff2a18'], size: 0.05, life: 2.2, drag: 0.3, intensity: 2,
    }));
    return s;
  }

  // An iron brazier on three legs (the Hold's), its fire the user's drawn flame once it's in (lightFires).
  brazier(x, z) {
    const iron = this.world.mat.iron;
    for (let k = 0; k < 3; k++) {
      const la = (k / 3) * Math.PI * 2;
      this.box(0.08, 1.1, 0.08, iron, x + Math.cos(la) * 0.25, 0.5, z + Math.sin(la) * 0.25, { tile: 1, rx: Math.sin(la) * 0.2, rz: -Math.cos(la) * 0.2 });
    }
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.32, 10), iron);
    bowl.position.set(x, 1.15, z);
    bowl.castShadow = true;
    this.add(bowl);
    const fire = this.additiveSprite('#ff8a2a', 1.1, 0.95);
    fire.position.set(x, 1.6, z);
    this.add(fire);
    this.blockCircle(x, z, 0.55);
    const i = this.braziers.length;
    this.braziers.push({ fire, light: this.light(x, 1.9, z, '#ff8a3a', 9, 1.5), phase: x * 3, x, z, flame: null });
    this.ambient(3, () => (this.lit(seedOf(5, 30 + i)) < 0.3 ? null : {
      pos: [this.wx(x), 1.5, this.wz(z)], spread: [0.2, 0.05, 0.2], vel: [0, 1.1, 0], velSpread: [0.25, 0.4, 0.25],
      color: ['#ff9a3a', '#ffd27a', '#ff6a2a'], size: 0.06, life: 1.4, flicker: 1, intensity: 1.7,
    }));
  }

  lightFires(art) {
    if (!art?.brazier?.length) return;
    this.braziers.forEach((b, i) => {
      b.flame = new Flame(art.brazier[(i + 1) % art.brazier.length]);
      b.flame.mesh.position.set(b.x, 1.17, b.z);
      this.add(b.flame.mesh);
    });
  }

  // Its little Site of Grace, an island's made smaller (as the training yard's: yard.js).
  buildGrace() {
    const { x: gx, z: gz, k } = GRACE;
    const r = rng(83);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const s = (0.22 + r() * 0.15) * k;
      this.box(s * 1.4, s, s, this.mat.stoneMoss, gx + Math.cos(a) * 0.75 * k, s / 2, gz + Math.sin(a) * 0.6 * k, { ry: r() * 3, tile: 1 });
    }
    this.blockCircle(gx, gz, 0.9 * k);
    const core = this.additiveSprite('#ffcf6b', 1.1 * k, 0.7);
    core.position.set(gx, 0.55 * k, gz);
    const halo = this.additiveSprite('#ffb347', 3.6 * k, 0.18);
    halo.position.set(gx, 0.8 * k, gz);
    const pillar = new THREE.Mesh(new THREE.PlaneGeometry(0.35 * k, 3.2 * k), new THREE.MeshBasicMaterial({
      map: this.world.tex.pillar, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.1, 0.85, 0.5),
    }));
    pillar.position.set(gx, 1.6 * k, gz);
    pillar.userData.dynamic = true;
    this.add(core, halo, pillar);
    this.grace = {
      core, halo, pillar,
      figure: new GraceFigure(this.group, gx, 1.65 * k, gz, 1.4 * k),
      light: this.light(gx, 2.2 * k, gz, '#ffb347', 12 * k, 1.2),
    };
    this.ambient(5, () => (this.lit(seedOf(98, 20)) < 0.3 ? null : {
      pos: [this.wx(gx), 0.25, this.wz(gz)], spread: [0.25, 0.08, 0.2], vel: [0, 0.6, 0], velSpread: [0.12, 0.2, 0.12],
      color: ['#ffd27a', '#ffe7a8', '#ffb347'], size: 0.05, life: 2, drag: 0.4, intensity: 1.2,
    }));
  }

  // Its bridge of stone from the Hold's rim (as the islands' are, world.js: buildBridge, but long and
  // slanting, on three piers down into the mist), in the world's own space.
  buildBridge() {
    const lo = WAY.from - 0.4;
    const hi = WAY.to + 0.8; // (on into its floor a little)
    const len = hi - lo;
    const mid = (lo + hi) / 2;
    const { stone, stoneMoss } = this.mat;
    const g = new THREE.Group();
    const box = (bw, bh, bd, mat, x, y, z) => {
      const m = new THREE.Mesh(scaleBoxUV(new THREE.BoxGeometry(bw, bh, bd), bw, bh, bd, BRICK_TILE), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    };
    box(len, 0.6, 2.8, stone, mid, -0.28, 0);
    box(len * 0.82, 1.4, 1.6, stoneMoss, mid, -1.2, 0);
    for (const k of [0.27, 0.52, 0.77]) box(1.5, 16, 1.5, stoneMoss, lo + len * k, -9.5, 0);
    const r = rng(1201);
    for (const side of [-1, 1]) {
      for (let x = lo + 0.9; x < hi - 1.2; x += 1.1) {
        if (r() < 0.2) continue;
        box(0.9, 0.5 + r() * 0.15, 0.25, stoneMoss, x + 0.45, 0.27, side * 1.28);
      }
    }
    Builder.prototype.mergeStatic.call({ group: g });
    g.rotation.y = -WAY.angle;
    this.world.scene.add(g);
    this.bridge = g;
  }

  // Its grace, in the world (interact.js); where those who come by grace arrive (npc.js, fastTravel: in
  // front of it), whatever they came for.
  graceSpot() {
    return [this.wx(GRACE.x), this.wz(GRACE.z)];
  }

  point() {
    return this.graceSpot();
  }

  // Where its name floats over it, seen from afar (ui.js, updateLabels).
  labelSpot() {
    return [this.cx, 9.5, this.cz - 7];
  }

  // A sign, as it stands: awake (its cage shut, and every cage before it open), dormant (one before it
  // still shut), or spent (its cage open).
  state(i) {
    if (this.freed.has(CAGES[i].boss)) return 'spent';
    return i === 0 || this.freed.has(CAGES[i - 1].boss) ? 'awake' : 'dormant';
  }

  // Its signs as things to use (interact.js; its grace is used as every grace is): one awake summons
  // the great enemy holding its cage; one dormant says what wakes it; one spent is nothing now.
  spots() {
    const out = [];
    CAGES.forEach((c, i) => {
      const s = this.state(i);
      if (s === 'spent') return;
      const at = { x: this.wx(c.x), z: this.wz(SIGN.z), reach: 2.6 };
      if (s === 'awake') out.push({ ...at, label: `Summon ${NAMES[c.boss]}`, use: (n) => this.touch(i, n) });
      else out.push({ ...at, label: 'A dormant sign', use: () => this.ctx?.ui.log(`The sign lies dormant: free those held by ${NAMES[CAGES[i - 1].boss]} first`, 'dim') });
    });
    return out;
  }

  // A sign touched: the great enemy who holds its cage is summoned to the Arena of Trials (fight.js:
  // thy companions first), the sign flaring red as he's called, heard as the ritual circle is invoked.
  touch(i, n) {
    const { fight, ui } = this.ctx;
    const { boss } = CAGES[i];
    const name = NAMES[boss];
    if (!fight.kinds().includes(boss)) { ui.log(`${name[0].toUpperCase()}${name.slice(1)} cannot be called just now`, 'dim'); return; }
    const can = fight.canSummon();
    if (can !== true) { ui.log(can, 'dim'); return; }
    const s = this.signs[i];
    const [x, z] = [this.wx(s.x), this.wz(s.z)];
    if (Math.abs(x - n.pos.x) > 0.3) n.body.facing = x > n.pos.x ? 1 : -1;
    n.gesture('cast');
    s.flare = 1;
    flash(null, [x, 1, z + 0.3], { color: '#ff3a24', power: 26, reach: 10, life: 0.8, rise: 0.08 });
    this.world.particles.emit({
      pos: [x, 0.4, z], spread: [SIGN.w / 2, 0.1, SIGN.d / 2], vel: [0, 2.2, 0], velSpread: [0.6, 0.8, 0.6],
      color: ['#ff4a32', '#ffd0c4', '#ff2a18', '#ffffff'], size: 0.07, life: 1.4, count: 46, drag: 0.7, intensity: 2.4,
    });
    this.world.sound?.play('work-summon', { at: [x, z] });
    fight.call({ kind: 'slab', boss });
  }

  // Its prisoners, once the heroes' drawings are in (main.js): in each cage still shut, its two, drawn
  // (the Twofold in its form for the hour, the Witch bare-faced), standing idle and facing one another.
  fill(ctx) {
    this.ctx = ctx;
    const sheets = ctx.heroSheets || [];
    const formsOf = (pair) => Object.fromEntries(sheets.filter((s) => s.rig.pair === pair).map((s) => [s.rig.form, s]));
    CAGES.forEach((c, i) => {
      if (this.freed.has(c.boss)) return;
      const cage = this.cages[i];
      cage.figures = c.heroes.map((id, k) => {
        const forms = id === 'twofold' || id === 'sorceress' ? formsOf(id) : null;
        const form = id === 'twofold' ? ctx.director.formNow() : id === 'sorceress' ? 'bare' : null;
        const sheet = forms ? forms[form] : sheets.find((s) => s.hero === id && !s.rig.pair);
        if (!sheet) return null;
        const side = k === 0 ? -1 : 1;
        const f = { id, forms, form, x: this.wx(c.x + side * CAGE.apart), z: this.wz(CAGE.z), facing: -side, body: null, shift: null };
        this.dress(f, sheet);
        f.body.anim.t = Math.random() * 6; // (not both in step)
        return f;
      }).filter(Boolean);
    });
  }

  // A prisoner in a drawing (anew, as the Twofold changes).
  dress(f, sheet) {
    f.body?.dispose();
    f.body = new SpriteBody(this.world.scene, sheet);
    f.body.facing = f.facing;
    f.body.play('idle', true);
  }

  // The Twofold, held, still changes with the hour, as abroad (director.js, SHIFT): golden light
  // gathers round it, the drawing of the change holds a moment, and its other form bursts out.
  turn(f, dt) {
    if (!f.shift) {
      const want = this.ctx.director.formNow();
      if (want === f.form) return;
      f.shift = { to: want, t: 0, stage: 0, glow: 0, light: carry(null, [f.x, 1.3 + CAGE.plinth, f.z + 0.5], { color: '#ffc860', power: 16, reach: 8, level: 0 }) };
    }
    const s = f.shift;
    s.t += dt;
    s.glow -= dt;
    s.light.level = s.t < SHIFT.reveal ? Math.min(1, s.t / 0.3) : Math.max(0, 1 - (s.t - SHIFT.reveal) / (SHIFT.end - SHIFT.reveal));
    if (s.glow <= 0 && s.stage < 2) {
      s.glow = 0.12;
      this.world.particles.emit({
        pos: [f.x, CAGE.plinth + 1.3, f.z], spread: [0.5, 1.1, 0.3], vel: [0, 1.1, 0], velSpread: [0.3, 0.4, 0.3],
        color: ['#ffd75a', '#fff1c0', '#f0a020'], size: 0.07, life: 1.3, count: 6, drag: 0.6, intensity: 2.2,
      });
    }
    if (s.stage === 0 && s.t >= SHIFT.change) {
      s.stage = 1;
      const via = f.forms[f.forms[s.to]?.rig.via];
      if (via) this.dress(f, via);
    }
    if (!s.heard && s.t >= SHIFT.reveal - SHIFT.lead) {
      s.heard = true;
      this.world.sound?.play(SHIFT.sound, { at: [f.x, f.z] });
    }
    if (s.stage === 1 && s.t >= SHIFT.reveal) {
      s.stage = 2;
      this.dress(f, f.forms[s.to]);
      f.form = s.to;
    }
    if (s.t >= SHIFT.end) {
      s.light.end(0.2);
      f.shift = null;
    }
  }

  // A great enemy beaten from a sign (fight.js, win): his cage's door swings open (update) with a clank
  // of iron, and its two walk out of it, one after the other, over its sign's stones and away on foot
  // across the isle and its bridge to the Round Table (walkOut, handOver); it's remembered, its sign
  // is spent, and the next wakes.
  free(boss) {
    const i = CAGES.findIndex((c) => c.boss === boss);
    if (i < 0 || this.freed.has(boss)) return;
    this.freed.add(boss);
    try { localStorage.setItem(FREED, JSON.stringify([...this.freed])); } catch {}
    const cage = this.cages[i];
    cage.opening = 0;
    this.world.sound?.play('work-anvil', { at: [this.wx(cage.x), this.wz(cage.z)], pitch: 0.6 });
    cage.figures.forEach((f, k) => {
      // (the Twofold in its form for the hour, should it have been changing just then)
      if (f.shift) {
        f.shift.light.end(0.2);
        f.shift = null;
        f.form = this.ctx.director.formNow();
        this.dress(f, f.forms[f.form]);
      }
      const s = Math.sign(f.x - this.wx(cage.x)) || 1;
      f.out = { t: -(OUT.after + k * OUT.apart), d: 0, way: OUT.way.map(([x, z, y]) => [this.wx(cage.x + s * x), this.wz(cage.z + z), y]) };
    });
    // (one not drawn in it, its art missing: on foot to the table from before the cage all the same)
    for (const id of CAGES[i].heroes) {
      if (!cage.figures.some((f) => f.id === id)) this.handOver({ id, x: this.wx(cage.x), z: this.wz(cage.z + OUT.way[OUT.way.length - 1][1]), facing: 1 });
    }
    const names = cage.figures.map((f) => f.body.sheet.rig?.firstName).filter(Boolean).join(' and ');
    if (!names) return;
    this.ctx.ui.log(`${names}, freed from ${NAMES[boss]}'s cage, walk to Roundtable Hold`, 'gold', { region: this });
    this.ctx.ui.banner('Prisoners Freed', `${names} walk to Roundtable Hold`, 'gold');
  }

  // One freed walking out of its cage along its way (free), at its turn: to the door, through it, down
  // off the plinth and over its sign's stones, onto clear floor. Whether it's out.
  walkOut(f, dt) {
    const o = f.out;
    o.t += dt;
    if (o.t < 0) return false; // (waiting its turn)
    f.body.play('walk');
    o.d += OUT.speed * dt;
    let d = o.d;
    for (let k = 1; k < o.way.length; k++) {
      const [ax, az, ay] = o.way[k - 1];
      const [bx, bz, by] = o.way[k];
      const len = Math.hypot(bx - ax, bz - az);
      if (d <= len) {
        const u = d / len;
        f.x = ax + (bx - ax) * u;
        f.z = az + (bz - az) * u;
        f.y = ay + (by - ay) * u;
        if (Math.abs(bx - ax) > 0.05) f.facing = f.body.facing = Math.sign(bx - ax);
        return false;
      }
      d -= len;
    }
    return true;
  }

  // Out of its cage: the drawing gives way to the hero itself (director.js, start), there, walking on
  // over the bridge to a seat at the Round Table (npc.js, journey: on foot all the way, never by
  // grace), and taking up nothing (no session, no fight, no training) till it's there (`freeing`:
  // director.js, freeHero; companions.js; and update, below, lets it go).
  handOver(f) {
    const { director } = this.ctx;
    f.body?.dispose();
    director.start((id) => id === f.id);
    const n = director.heroes.get(f.id);
    if (!n) return;
    n.pos.set(f.x, f.z);
    n.body.facing = f.facing;
    n.freeing = true;
    n.setIntent({ kind: 'journey', dest: 'hub' });
    this.walkers.push(n);
  }

  update(dt, t) {
    // its braziers burn, and its grace breathes (going out, as every fire and grace does, while a
    // great enemy is abroad)
    this.braziers.forEach((b, i) => {
      const lb = this.lit(seedOf(5, 30 + i));
      this.smoke(b, lb, b.x, 1.5, b.z);
      let f = 0.85 + 0.1 * Math.sin(t * 10 + b.phase) + 0.05 * Math.sin(t * 23 + b.phase * 2);
      if (b.flame) {
        b.level = (b.level ?? 1) + (0.75 + 0.3 * b.flame.step(dt) - (b.level ?? 1)) * Math.min(1, dt * 12);
        f = b.level;
        b.fire.scale.set(2.15 * f, 1.95 * f, 1);
        b.fire.material.opacity = 0.3 * lb;
        b.flame.mesh.scale.setScalar(lb);
        b.flame.mesh.visible = lb > 0.02;
      } else {
        b.fire.scale.set(0.9 * f * lb, 1.15 * f * lb, 1);
      }
      b.light.intensity = 10 * f * lb;
    });
    const g = this.grace;
    const gp = 0.92 + 0.08 * Math.sin(t * 2.1 + 9);
    const lg = this.lit(seedOf(98, 20));
    g.light.intensity = 8 * gp * lg;
    g.core.material.opacity = 0.65 * gp * lg;
    g.halo.material.opacity = 0.16 * gp * lg;
    g.pillar.material.opacity = (0.4 + 0.18 * Math.sin(t * 1.3)) * lg;
    g.figure.update(dt, gp * lg);
    // its signs: one awake glowing and breathing (flaring as it's touched), one dormant an ember, one
    // spent dark; each coming to it slowly
    for (const s of this.signs) {
      const state = this.state(s.i);
      const want = state === 'awake' ? 1 : state === 'dormant' ? 0.06 : 0;
      s.glow += (want - s.glow) * Math.min(1, dt * 1.5);
      s.flare = Math.max(0, s.flare - dt * 0.8);
      const k = s.glow * (0.86 + 0.14 * Math.sin(t * 1.6 + s.i * 2.1)) + s.flare * 1.4;
      s.top.emissiveIntensity = 0.95 * k; // (white enough to shine, not so bright the bloom blurs the runes away)
      s.side.emissiveIntensity = 2.2 * k; // (the red from under, at the stones' feet: underGlowCanvas)
      s.haze.material.opacity = 0.16 * Math.min(1.6, k);
      s.pool.material.opacity = 0.75 * Math.min(1.6, k);
      s.core.material.opacity = 0.95 * Math.min(1.6, k);
      s.light.intensity = SIGN.light[0] * k;
    }
    // a cage's door swinging open, and the prisoners standing idle (the Twofold changing with the
    // hour), or, freed, walking out of it and away, Tarnished again
    for (const c of this.cages) {
      if (c.opening >= 0 && c.opening < CAGE.opening) {
        c.opening = Math.min(CAGE.opening, c.opening + dt);
        const k = c.opening / CAGE.opening;
        c.door.rotation.y = CAGE.swing * (1 - (1 - k) ** 3);
      }
      for (const f of c.figures) {
        if (f.out) {
          if (this.walkOut(f, dt)) { this.handOver(f); f.gone = true; continue; }
        } else if (f.id === 'twofold' && this.ctx) this.turn(f, dt);
        f.body.tick(dt);
        f.body.place(f.x, f.y ?? CAGE.plinth, f.z);
      }
      c.figures = c.figures.filter((f) => !f.gone);
    }
    // the freed on their way to the Round Table: free of it all once there (npc.js, journeyDone: a seat
    // at the table), or once anything else takes them (thou, becoming one)
    this.walkers = this.walkers.filter((n) => {
      if (!n.dead && !n.piloted && n.intent.kind === 'journey' && n.intent.dest === 'hub') return true;
      n.freeing = false;
      return false;
    });
  }
}
