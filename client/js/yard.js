// The training yard below Roundtable Hold: a long floor of grey brick shaped like a pill (its two
// ends round) on a rock of its own, south of the Hold and lower than it; a stair of stone comes down
// to the middle of its north side from the Hold's rim. Its west end is for blows: a sawdust ring, a
// great wooden dummy in its middle and straw ones scattered round it to strike (training.js); its
// east end for dodging: three rune rocks round a ring of cracks in its floor, lifted and dropped in
// turn while one stands inside it (runerocks.js); between them, in its middle, a little Site of Grace
// where the Tarnished are called to train and come by grace. Racks of the Round Table's weapons
// (weapons.js) either side of the stair's foot, barrels and crates, an archery butt, rope lanterns
// about its edge. Always there.
// Its ground is lower than the Hold's (ground.js): on the stair it runs from the one to the other.

import * as THREE from 'three';
import { HUB } from './config.js';
import * as T from './textures.js';
import { rng } from './pixel.js';
import { Builder, seedOf } from './build.js';
import { GraceFigure } from './grace.js';
import { addLevel } from './ground.js';
import { FLOOR } from './arena.js';
import { rippling, rippleBounds } from './ripple.js';
import { weapon } from './weapons.js';

// The yard's half-width (the radius of each of its round ends) and half the length of its straight
// middle (each end's middle from its own); the stair: half its width, its head (where it leaves the
// Hold's ground, just past the cliff's edge), its length and its steps. `lag`: how far past a step's
// middle the ground under a foot reaches the step's height, so that a foot sinks at most a hair into
// the edge of the step below.
const R = 12;
const L = 18;
const STAIR = { half: 1.4, top: HUB.radius + 0.5, run: 7.6, steps: 16, lag: 0.14 };
const NORTH = STAIR.top + STAIR.run; // the yard's north edge, where the stair comes down
// Its floor's height, its middle, half its width (north to south) and half its length (west to
// east), its south edge, and half the stair's width (where the Hold's rim opens for it, hub.js).
export const YARD = { y: -3.2, cz: NORTH + R, halfW: R, halfL: L + R, south: NORTH + 2 * R, stairHalf: STAIR.half };

// What stands on its floor, from its middle (`n`: its north edge, where the stair comes down): either
// side of the stair's foot a rack of the Round Table's weapons (weapons.js, the kinds in it), barrels
// by the one and crates by the other; an archery butt on its south side, east of the grace (clear of
// where the tutorial sets thee before its dummies: tutorial.js); lanterns about its edge, along its
// straight sides (where they stand along them) and round its ends (degrees from the east, round by
// the south, about each end's middle).
const n = -R;
const PROPS = {
  racks: [[5, n + 3.4, [0, 2, 5, 4, 3]], [-5, n + 3.4, [8, 1, 7, 9, 6]]],
  barrels: [[7.3, n + 4.4], [8, n + 5.4]],
  crates: [-8.2, n + 5.4],
  butt: [6, 8.6],
  lanterns: { north: [-14, -3.2, 3.2, 14], south: [-12, 0, 12], west: [135, 180, 225], east: [-45, 0, 45] },
};
// Its great dummy (training.js): the Guardian Golem in wood, halberd and all, a little smaller than
// he, in the middle of the sawdust ring at the yard's west end, never breaking; where it stands (from
// the yard's middle), how much of the floor it takes up (nine tenths of his), how far off the straw
// ones keep (its halberd reaches far either side of it), and its ring's radius.
export const BOSS_DUMMY = { x: -L, z: 0, radius: 1.8, clear: 7.2, ring: 9.4 };
// Its straw dummies (training.js): `count` of them, scattered round the great one anew each time the
// world is made, no further east than `east`, at least `edge` in from its edge and `apart` from one
// another, and clear of the stair's foot and of what stands on it (by `clear`, past what each takes
// up).
// Its little Site of Grace (training.js), in its middle: where thou callest the Tarnished to train,
// and where they come by grace; how big it is (of an island's), and how much of the floor round it,
// where they arrive, is kept clear of dummies.
export const TRAIN_GRACE = { x: 0, z: -1, k: 0.7, clear: 3.2 };
const DUMMIES = { count: 8, edge: 3, apart: 3.4, clear: 1.4, east: -4 };
// Its rune rocks (runerocks.js), at its east end: the middle of their ring of cracks (from the
// yard's middle), how far out from it they stand, on it (degrees from the east, round by the south,
// in the order of their turns), and how much of the floor round each is kept from those walking (a
// rock's drawing is about 3 wide).
export const ROCK_RING = { x: L, z: 0, r: 7.6, spots: [-90, 150, 30], block: 1.05 };

// (how far a point lies from the line down the yard's middle, from the middle of one end to the
// other's: within R of it, on the floor; `off` from the yard's middle, `away` in the world)
const off = (x, z) => Math.hypot(Math.max(0, Math.abs(x) - L), z);
const away = (x, z) => off(x, z - YARD.cz);

export const DUMMY_SPOTS = scatter();

// Where the dummies stand, from the yard's middle: chosen at random, over and again until each
// stands where it may.
function scatter() {
  const { count, edge, apart, clear, east } = DUMMIES;
  const keep = [
    [0, n, 5], // (the stair's foot, and the way on from it)
    [BOSS_DUMMY.x, BOSS_DUMMY.z, BOSS_DUMMY.clear],
    [TRAIN_GRACE.x, TRAIN_GRACE.z + 0.8, TRAIN_GRACE.clear], // (the grace, and in front of it)
    ...PROPS.racks.map(([x, z]) => [x, z, 1.25 + clear]),
    ...PROPS.barrels.map(([x, z]) => [x, z, 0.5 + clear]),
    [PROPS.crates[0] + 0.45, PROPS.crates[1] + 0.15, 1.05 + clear],
    [PROPS.butt[0], PROPS.butt[1], 0.75 + clear],
  ];
  const spots = [];
  for (let tries = 0; spots.length < count && tries < 5000; tries++) {
    const x = -(L + R) + Math.random() * (east + L + R);
    const z = (Math.random() * 2 - 1) * R;
    if (off(x, z) > R - edge) continue;
    if (keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue;
    if (spots.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < apart)) continue;
    spots.push([x, z]);
  }
  return spots;
}

// The floor's shape, finely divided as the arena's disc is (arena.js, discGeometry) so that a
// shockwave can ripple it: a grid as long and wide as the yard, its points beyond either round end
// brought in onto it.
function pillGeometry(step) {
  const geo = new THREE.PlaneGeometry(2 * (L + R), 2 * R, Math.ceil((2 * (L + R)) / step), Math.ceil((2 * R) / step));
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const ex = Math.abs(x) - L;
    const d = Math.hypot(ex, y);
    if (ex > 0 && d > R) {
      x = Math.sign(x) * (L + (ex * R) / d);
      y *= R / d;
    }
    pos.setXY(i, x, y);
    uv.setXY(i, (x / (L + R) + 1) / 2, (y / R + 1) / 2);
  }
  geo.computeVertexNormals();
  return geo;
}

export class Yard extends Builder {
  constructor(world) {
    super(world, 0, YARD.cz);
    this.name = 'Training Yard';
    this.subtitle = 'Where blows are practised';
    this.mat = world.matsFor('ashen');
    this.dark = new THREE.MeshLambertMaterial({ map: world.tex.wood, color: '#8a6c54' }); // (its racks' and posts' wood, darker)
    this.lanterns = [];
    this.build();
    this.mergeStatic();
    addLevel({ contains: (x, z) => this.isLevel(x, z), y: (x, z) => this.floorAt(x, z) });
  }

  onStair(x, z, pad = 0) {
    return Math.abs(x) <= STAIR.half + pad && z >= STAIR.top && z < NORTH;
  }

  // Where its ground lies: the stair, and the yard with the air round it (an ultimate may carry
  // someone off its edge for a moment: they stay at its height). (`away`: from the line down its
  // middle, so that its round ends and its straight sides are all R from it.)
  isLevel(x, z) {
    return this.onStair(x, z, 0.4) || away(x, z) <= R + 6;
  }

  // The Hold's ground runs on to the stair's head, then down its steps to the yard's.
  floorAt(x, z) {
    return Math.max(YARD.y, Math.min(0, (YARD.y * (z - STAIR.top - STAIR.lag)) / STAIR.run));
  }

  // The yard, and its stair once it's left the Hold (world.areaAt).
  contains(x, z) {
    return this.onStair(x, z, 0.4) || away(x, z) <= R;
  }

  // Inside, for the training (training.js): on its floor.
  inside(x, z) {
    return away(x, z) <= R + 0.2;
  }

  // On its floor, at least `inset` in from its edge (runerocks.js: the dust their shockwaves throw up).
  onFloor(x, z, inset = 0) {
    return away(x, z) <= R - inset;
  }

  isWalk(x, z) {
    return away(x, z) <= R - 0.6
      || (Math.abs(x) <= STAIR.half - 0.25 && z >= HUB.walkRadius - 0.5 && z <= NORTH + 0.8);
  }

  build() {
    const { wood, iron } = this.world.mat;
    const { stone, stoneMoss } = this.mat;
    const { dark } = this;
    const y = YARD.y;
    const at = (z) => z - YARD.cz; // (from the Hold's middle to its)
    const r = rng(53);
    const v = (x, yy, z) => new THREE.Vector3(x, yy, z);

    // its floor of grey brick, the arena's, worn to dirt and moss at the edge; a mossy lip round it
    // (open where the stair lands) and below it a rock of its own, down into the mist. (Finely
    // divided, as the arena's, so that a shockwave can ripple it like water: its rune rocks,
    // runerocks.js, ripple.js.)
    const tex = T.pixelTexture(T.floorCanvas((L + R) * 2, R * 2, (cx, cz) => (off(cx - L - R, cz - R) < R - 1.2 ? 1.1 : 0.35), FLOOR, 5150));
    const floor = new THREE.Mesh(pillGeometry(0.25), rippling(new THREE.MeshLambertMaterial({ map: tex }), { lit: true }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = y;
    floor.receiveShadow = true;
    floor.userData.dynamic = true; // (never merged with anything: its material bends it)
    this.add(floor);
    rippleBounds('yard', this.cx, this.cz, R, L);
    const lip = (geo, x, z) => {
      const m = new THREE.Mesh(geo, stoneMoss);
      m.rotation.x = Math.PI / 2;
      m.position.set(x, y - 0.05, z);
      this.add(m);
    };
    // (round each end, and along each side: the north one open where the stair lands)
    for (const s of [-1, 1]) lip(new THREE.TorusGeometry(R - 0.1, 0.24, 4, 28, Math.PI).rotateZ(-s * Math.PI / 2), s * L, 0);
    const gap = STAIR.half + 0.4;
    for (const [x0, x1, z] of [[-L, -gap, -(R - 0.1)], [gap, L, -(R - 0.1)], [-L, L, R - 0.1]]) {
      lip(new THREE.CylinderGeometry(0.24, 0.24, x1 - x0, 4, 1, true).rotateZ(Math.PI / 2), (x0 + x1) / 2, z);
    }
    // (its rock: each round end a half of a cone, its sides slanting in as they do)
    const rockTex = this.mat.rockTex.clone();
    rockTex.repeat.set(11, 13);
    rockTex.needsUpdate = true;
    const rock = new THREE.MeshLambertMaterial({ map: rockTex });
    for (const s of [-1, 1]) {
      const end = new THREE.Mesh(new THREE.CylinderGeometry(R, R - 2, 28, 22, 1, true, s > 0 ? 0 : Math.PI, Math.PI), rock);
      end.position.set(s * L, y - 14, 0);
      this.add(end);
      this.add(this.side(s, rock));
    }
    // the sawdust ring at its west end, round the great dummy, where blows are traded
    const ring = new THREE.Mesh(new THREE.RingGeometry(BOSS_DUMMY.ring, BOSS_DUMMY.ring + 0.45, 96), rippling(new THREE.MeshBasicMaterial({ color: '#c9b38a', transparent: true, opacity: 0.5, depthWrite: false })));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(BOSS_DUMMY.x, y + 0.012, BOSS_DUMMY.z);
    ring.userData.dynamic = true;
    this.add(ring);

    // the stair of stone down from the Hold's rim: its head over the cliff's edge, its steps on a
    // slab with a keel of mossy stone under it and a pier down into the mist, low stones along its
    // sides and a taller one either side of its head and its foot. (In a group of its own, merged
    // apart from the rest: the tutorial puts it away while thou'rt on the yard, the Hold out of
    // sight: tutorial.js.)
    const yardGroup = this.group;
    this.group = new THREE.Group();
    const wide = STAIR.half * 2 + 0.5;
    const tread = STAIR.run / STAIR.steps;
    const head = HUB.radius - 0.35;
    const down = (z) => (y * (z - STAIR.top)) / STAIR.run; // (how far it has come down at z)
    this.box(wide, 0.6, STAIR.top - head, stone, 0, -0.28, at((head + STAIR.top) / 2));
    for (let i = 0; i < STAIR.steps; i++) {
      const top = (y * (i + 0.5)) / STAIR.steps;
      this.box(wide, 0.6, tread + 0.02, stone, 0, top - 0.3, at(STAIR.top + tread * (i + 0.5)));
    }
    this.beam(v(0, -0.75, at(STAIR.top)), v(0, y - 0.75, n), wide - 0.1, stone, 0.5);
    const keel = [STAIR.top + 0.8, NORTH - 0.8].map((z) => v(0, down(z) - 1.45, at(z)));
    this.beam(keel[0], keel[1], 1.6, stoneMoss, 1.4);
    const pier = STAIR.top + STAIR.run * 0.62;
    this.box(1.5, 16, 1.5, stoneMoss, 0, down(pier) - 1.9 - 8, at(pier));
    for (const side of [-1, 1]) {
      const x = side * (STAIR.half + 0.13);
      for (let i = 0; i < STAIR.steps; i += 2) {
        if (r() < 0.15) continue;
        const h = 0.5 + r() * 0.15;
        const foot = (y * (i + 1.5)) / STAIR.steps; // (on the lower of the two steps it stands on)
        this.box(0.25, h, tread * 2 - 0.08, stoneMoss, x, foot + h / 2, at(STAIR.top + tread * (i + 1)));
      }
      this.box(0.4, 0.9, 0.5, stoneMoss, x, 0.42, at(head + 0.35));
      this.box(0.4, 0.9, 0.5, stoneMoss, x, y + 0.42, n + 0.3);
    }
    this.mergeStatic();
    this.stair = this.group;
    this.group = yardGroup;
    this.add(this.stair);

    // its racks, barrels, crates and archery butt (PROPS)
    for (const [x, z, kinds] of PROPS.racks) this.rack(x, z, kinds, wood, dark);
    for (const [x, z] of PROPS.barrels) this.barrel(x, z, wood);
    this.crates(...PROPS.crates, wood, dark);
    this.butt(...PROPS.butt, dark);

    // rope lanterns on posts about its edge: along its sides (either side of the stair's foot among
    // them), and round its ends
    const e = R - 0.9;
    const { north, south, west, east } = PROPS.lanterns;
    for (const x of north) this.lantern(x, -e, dark, iron);
    for (const x of south) this.lantern(x, e, dark, iron);
    for (const [ex, degs] of [[-L, west], [L, east]]) {
      for (const deg of degs) {
        const a = (deg * Math.PI) / 180;
        this.lantern(ex + Math.cos(a) * e, Math.sin(a) * e, dark, iron);
      }
    }

    this.buildGrace();

    // where its dummies stand (training.js draws them, and puts them away for the tutorial: then
    // nothing stands on their spots)
    this.blocks = {
      dummies: DUMMY_SPOTS.map(([x, z]) => this.blockCircle(x, z, 0.5)),
      great: this.blockCircle(BOSS_DUMMY.x, BOSS_DUMMY.z, BOSS_DUMMY.radius),
    };
    // and where its rune rocks stand (runerocks.js)
    for (const [x, z] of this.rockSpots()) this.blockCircle(x - this.cx, z - this.cz, ROCK_RING.block);
  }

  // Where its rune rocks stand, in the world, in their order (runerocks.js).
  rockSpots() {
    return ROCK_RING.spots.map((deg) => {
      const a = (deg * Math.PI) / 180;
      return [this.cx + ROCK_RING.x + Math.cos(a) * ROCK_RING.r, this.cz + ROCK_RING.z + Math.sin(a) * ROCK_RING.r];
    });
  }

  // The middle of its rune rocks' ring, in the world, and its radius.
  ring() {
    return { x: this.cx + ROCK_RING.x, z: this.cz + ROCK_RING.z, r: ROCK_RING.r };
  }

  // One of its rock's straight sides, under one of its straight edges (`s`: -1 the north, 1 the
  // south), slanting in from the floor's edge to its foot as its ends' rounds do (its stone as
  // finely drawn as theirs: `u`, its length in a round end's).
  side(s, mat) {
    const geo = new THREE.BufferGeometry();
    const u = (2 * L) / (Math.PI * R);
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-L, 0, s * R, L, 0, s * R, -L, -28, s * (R - 2), L, -28, s * (R - 2)], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, u, 1, 0, 0, u, 0], 2));
    geo.setIndex(s < 0 ? [0, 1, 2, 2, 1, 3] : [0, 2, 1, 1, 2, 3]); // (facing out)
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.position.y = YARD.y;
    return m;
  }

  // A weapon rack: two posts with caps, a rail high and one low between them, a trough at their
  // feet, and in it five of the Round Table's weapons (weapons.js, `kinds`), standing on their points
  // and heads and leaning back against the rail, each a little its own way.
  rack(x, z, kinds, wood, dark) {
    const y = YARD.y;
    const r = rng(Math.round(Math.abs(x * 31 + z * 7)) + 9);
    const back = z - 0.14; // (where the rails run)
    for (const dx of [-0.98, 0.98]) {
      this.box(0.16, 1.56, 0.16, dark, x + dx, y + 0.78, back, { tile: 1 });
      this.box(0.24, 0.1, 0.24, dark, x + dx, y + 1.61, back, { tile: 1 });
    }
    this.box(2.1, 0.1, 0.12, dark, x, y + 1.32, back, { tile: 1 });
    this.box(2.1, 0.08, 0.1, dark, x, y + 0.56, back, { tile: 1 });
    this.box(2.16, 0.16, 0.52, wood, x, y + 0.08, z + 0.06, { tile: 1 });
    this.box(2.16, 0.1, 0.06, dark, x, y + 0.21, z + 0.3, { tile: 1 });
    kinds.forEach((k, i) => {
      const { g, low } = weapon(k, 1.1);
      g.rotation.y = (r() - 0.5) * 0.7; // (turned a little on its own axis)
      const stand = new THREE.Group();
      stand.position.set(x - 0.76 + i * 0.38, y + 0.16 - low, z + 0.12);
      stand.rotation.set(-0.15, 0, (r() - 0.5) * 0.12); // (leaning back against the rail)
      stand.add(g);
      this.adopt(stand);
    });
    this.block(x - 1.15, z - 0.3, x + 1.15, z + 0.45);
  }

  butt(x, z, dark) {
    const y = YARD.y;
    for (const a of [0, 2.1, 4.2]) this.box(0.1, 1.5, 0.1, dark, x + Math.sin(a) * 0.35, y + 0.7, z - 0.2 + Math.cos(a) * 0.3, { tile: 1, rx: Math.cos(a) * 0.25, rz: -Math.sin(a) * 0.25 });
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.28, 18), [
      new THREE.MeshLambertMaterial({ color: '#b39257' }),
      new THREE.MeshLambertMaterial({ map: this.targetTexture() }),
      new THREE.MeshLambertMaterial({ color: '#b39257' }),
    ]);
    face.rotation.x = Math.PI / 2;
    face.rotation.y = 0.15;
    face.position.set(x, y + 1.25, z);
    face.castShadow = true;
    face.userData.dynamic = true;
    this.add(face);
    this.blockCircle(x, z - 0.1, 0.7);
  }

  // The butt's face: rings of straw, red and white, in the world's pixels.
  targetTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    [[16, '#9c7c46'], [15, '#c9a86a'], [12, '#8e2a22'], [9, '#e8dcc0'], [6, '#8e2a22'], [3, '#e8dcc0']].forEach(([r, col]) => {
      g.fillStyle = col;
      for (let py = 0; py < 32; py++) for (let px = 0; px < 32; px++) if ((px - 15.5) ** 2 + (py - 15.5) ** 2 <= r * r) g.fillRect(px, py, 1, 1);
    });
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  barrel(x, z, wood) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.9, 10), wood);
    b.position.set(x, YARD.y + 0.45, z);
    b.castShadow = true;
    this.add(b);
    this.blockCircle(x, z, 0.5);
  }

  // Two crates, one on the other, and a third beside them.
  crates(x, z, wood, dark) {
    const y = YARD.y;
    this.box(0.9, 0.9, 0.9, wood, x, y + 0.45, z, { tile: 1, ry: 0.2 });
    this.box(0.7, 0.7, 0.7, dark, x + 0.08, y + 1.25, z - 0.04, { tile: 1, ry: -0.35 });
    this.box(0.75, 0.75, 0.75, wood, x + 1.0, y + 0.375, z + 0.35, { tile: 1, ry: -0.12 });
    this.blockCircle(x + 0.45, z + 0.15, 1.05);
  }

  // A lantern on a post, hung from an arm reaching in over the floor (toward the line down its middle).
  lantern(x, z, dark, iron) {
    const y = YARD.y;
    this.box(0.18, 2.6, 0.18, dark, x, y + 1.3, z, { tile: 1 });
    const mx = Math.max(-L, Math.min(L, x)) - x;
    const d = Math.hypot(mx, z) || 1;
    const ax = (mx / d) * 0.45;
    const az = (-z / d) * 0.45;
    this.box(0.55, 0.1, 0.1, dark, x + ax / 2, y + 2.5, z + az / 2, { tile: 1, ry: Math.atan2(-az, ax) });
    this.box(0.03, 0.35, 0.03, iron, x + ax, y + 2.3, z + az, { tile: 1 });
    const cage = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.28), new THREE.MeshLambertMaterial({ color: '#2c2d33', emissive: '#ffb050', emissiveIntensity: 0.9 }));
    cage.position.set(x + ax, y + 1.98, z + az);
    cage.userData.dynamic = true;
    this.add(cage);
    const glow = this.additiveSprite('#ffb060', 1.5, 0.35);
    glow.position.set(x + ax, y + 1.98, z + az);
    this.add(glow);
    this.lanterns.push({ glow, cage, light: this.light(x + ax, y + 2.1, z + az, '#ffb060', 11, 1.5), phase: x + z });
    this.blockCircle(x, z, 0.35);
  }

  // Its little Site of Grace, an island's made smaller (region.js, buildGrace): stones round a
  // flame, a pillar of light, the golden figure floating over it, motes rising.
  buildGrace() {
    const { x: gx, z: gz, k } = TRAIN_GRACE;
    const y = YARD.y;
    const r = rng(71);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const s = (0.22 + r() * 0.15) * k;
      this.box(s * 1.4, s, s, this.mat.stoneMoss, gx + Math.cos(a) * 0.75 * k, y + s / 2, gz + Math.sin(a) * 0.6 * k, { ry: r() * 3, tile: 1 });
    }
    this.blockCircle(gx, gz, 0.9 * k);
    const core = this.additiveSprite('#ffcf6b', 1.1 * k, 0.7);
    core.position.set(gx, y + 0.55 * k, gz);
    const halo = this.additiveSprite('#ffb347', 3.6 * k, 0.18);
    halo.position.set(gx, y + 0.8 * k, gz);
    const pillar = new THREE.Mesh(new THREE.PlaneGeometry(0.35 * k, 3.2 * k), new THREE.MeshBasicMaterial({
      map: this.world.tex.pillar, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.1, 0.85, 0.5),
    }));
    pillar.position.set(gx, y + 1.6 * k, gz);
    pillar.userData.dynamic = true;
    this.add(core, halo, pillar);
    this.grace = {
      core, halo, pillar,
      figure: new GraceFigure(this.group, gx, y + 1.65 * k, gz, 1.4 * k),
      light: this.light(gx, y + 2.2 * k, gz, '#ffb347', 12 * k, 1.2),
    };
    this.ambient(5, () => (this.lit(seedOf(97, 20)) < 0.3 ? null : {
      pos: [this.wx(gx), y + 0.25, this.wz(gz)], spread: [0.25, 0.08, 0.2], vel: [0, 0.6, 0], velSpread: [0.12, 0.2, 0.12],
      color: ['#ffd27a', '#ffe7a8', '#ffb347'], size: 0.05, life: 2, drag: 0.4, intensity: 1.2,
    }));
  }

  // Where its grace is, in the world (interact.js, training.js); and where those who come by grace
  // arrive (npc.js, fastTravel: in front of it).
  graceSpot() {
    return [this.wx(TRAIN_GRACE.x), this.wz(TRAIN_GRACE.z)];
  }

  point() {
    return this.graceSpot();
  }

  // Where its name floats over it, seen from afar (ui.js, updateLabels): as high over its floor, and
  // as far back on it, as the others' over theirs.
  labelSpot() {
    return [this.cx, YARD.y + 9.5, this.cz - 8];
  }

  update(dt, t) {
    // the lanterns' flames stir
    for (const l of this.lanterns) {
      const k = 0.85 + 0.15 * Math.sin(t * 7 + l.phase) * Math.sin(t * 3.1 + l.phase * 2);
      l.glow.material.opacity = 0.35 * k;
      l.light.intensity = 1.6 * k;
    }
    // its grace breathes (and goes out, as every grace does, while a great enemy is abroad)
    const g = this.grace;
    const gp = 0.92 + 0.08 * Math.sin(t * 2.1 + 5);
    const lg = this.lit(seedOf(97, 20));
    g.light.intensity = 8 * gp * lg;
    g.core.material.opacity = 0.65 * gp * lg;
    g.halo.material.opacity = 0.16 * gp * lg;
    g.pillar.material.opacity = (0.4 + 0.18 * Math.sin(t * 1.3)) * lg;
    g.figure.update(dt, gp * lg);
  }
}
