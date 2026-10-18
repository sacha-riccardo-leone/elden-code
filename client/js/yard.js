// The training yard below Roundtable Hold: a great five-sided platform of timber and iron south of
// the Hold and lower than it, slung from its rim on two chains and standing on posts that run down
// into the mist, a stair of stone coming down to it from the rim. A sawdust ring on its boards,
// straw dummies round it to strike (training.js), a rack of practice weapons, an archery butt,
// barrels and crates, rope lanterns at its corners. Always there.
// Its ground is lower than the Hold's (ground.js): on the stair it runs from the one to the other.

import * as THREE from 'three';
import { HUB } from './config.js';
import { rng } from './pixel.js';
import { Builder, BRICK_TILE, scaleBoxUV } from './build.js';
import { addLevel } from './ground.js';

// The yard: how far its five corners lie from its middle (one points south, away from the Hold, and
// its north side faces the Hold), and how far the middles of its sides do.
const R = 13;
const APOTHEM = R * Math.cos(Math.PI / 5);
// The stair: half its width, its head (where it leaves the Hold's ground, just past the cliff's
// edge), its length and its steps. `lag`: how far past a step's middle the ground under a foot
// reaches the step's height, so that a foot sinks at most a hair into the edge of the step below.
const STAIR = { half: 1.4, top: HUB.radius + 0.5, run: 7.6, steps: 16, lag: 0.14 };
const NORTH = STAIR.top + STAIR.run; // the yard's north side, where the stair comes down
// Its floor's height, its middle, half its width (corner to corner), its south corner, and half the
// stair's width (where the Hold's rim opens for it, hub.js).
export const YARD = { y: -3.2, cz: NORTH + APOTHEM, halfW: R * Math.sin(0.4 * Math.PI), south: NORTH + APOTHEM + R, stairHalf: STAIR.half };
// Its corners from its middle, south first and round by the west, and the way each side faces, out
// from the yard (the side from one corner to the next).
const turn = (k) => Math.PI / 2 + k * 0.4 * Math.PI;
const CORNERS = [0, 1, 2, 3, 4].map((k) => [R * Math.cos(turn(k)), R * Math.sin(turn(k))]);
const SIDES = [0, 1, 2, 3, 4].map((k) => [Math.cos(turn(k + 0.5)), Math.sin(turn(k + 0.5))]);
// where its dummies stand (training.js), from its middle: inside its sawdust ring, toward its corners
export const DUMMY_SPOTS = CORNERS.map(([x, z]) => [x * 0.4, z * 0.4]);

// How far a point (from the yard's middle) lies out past its sides; below 0, inside it, that far in
// from the nearest.
function past(x, z) {
  let most = -Infinity;
  for (const [nx, nz] of SIDES) most = Math.max(most, x * nx + z * nz);
  return most - APOTHEM;
}

// Where a line across the yard, north to south at x = v (or east to west at z = v), meets its sides,
// `m` in from them: [from, to] along it.
function span(v, eastWest, m = 0) {
  let lo = -Infinity;
  let hi = Infinity;
  for (const [nx, nz] of SIDES) {
    const [along, across] = eastWest ? [nx, nz] : [nz, nx];
    const room = APOTHEM - m - v * across;
    if (Math.abs(along) < 1e-6) continue;
    if (along > 0) hi = Math.min(hi, room / along);
    else lo = Math.max(lo, room / along);
  }
  return [lo, hi];
}

export class Yard extends Builder {
  constructor(world) {
    super(world, 0, YARD.cz);
    this.name = 'Training Yard';
    this.subtitle = 'Where blows are practised';
    this.mat = world.matsFor('ashen');
    this.dark = new THREE.MeshLambertMaterial({ map: world.tex.wood, color: '#8a6c54' }); // its beams, darker than its boards
    this.lanterns = [];
    this.build();
    this.mergeStatic();
    addLevel({ contains: (x, z) => this.isLevel(x, z), y: (x, z) => this.floorAt(x, z) });
  }

  onStair(x, z, pad = 0) {
    return Math.abs(x) <= STAIR.half + pad && z >= STAIR.top && z < NORTH;
  }

  // Where its ground lies: the stair, and the yard with the air round it (an ultimate may carry
  // someone off its edge for a moment: they stay at its height).
  isLevel(x, z) {
    return this.onStair(x, z, 0.4) || past(x, z - YARD.cz) <= 6;
  }

  // The Hold's ground runs on to the stair's head, then down its steps to the yard's.
  floorAt(x, z) {
    return Math.max(YARD.y, Math.min(0, (YARD.y * (z - STAIR.top - STAIR.lag)) / STAIR.run));
  }

  // The yard, and its stair once it's left the Hold (world.areaAt).
  contains(x, z) {
    return this.onStair(x, z, 0.4) || past(x, z - YARD.cz) <= 0;
  }

  // Inside, for the training (training.js): on its boards.
  inside(x, z) {
    return past(x, z - YARD.cz) <= 0.2;
  }

  isWalk(x, z) {
    return past(x, z - YARD.cz) <= -0.45
      || (Math.abs(x) <= STAIR.half - 0.25 && z >= HUB.walkRadius - 0.5 && z <= NORTH + 0.8);
  }

  build() {
    const { wood, iron } = this.world.mat;
    const { stone, stoneMoss } = this.mat;
    const { dark } = this;
    const y = YARD.y;
    const n = -APOTHEM; // (its north side, from its middle)
    const at = (z) => z - YARD.cz; // (from the Hold's middle to its)
    const r = rng(53);
    const v = (x, yy, z) => new THREE.Vector3(x, yy, z);

    // the boards, and a beam round their edge with iron at the corners (open where the stair lands)
    const plan = new THREE.Shape(CORNERS.map(([x, z]) => new THREE.Vector2(x, z)));
    const geo = new THREE.ExtrudeGeometry(plan, { depth: 0.4, bevelEnabled: false });
    geo.rotateX(Math.PI / 2); // (lying flat, its top at its height)
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / BRICK_TILE, uv.getY(i) / BRICK_TILE);
    const boards = new THREE.Mesh(geo, wood);
    boards.position.y = y;
    boards.castShadow = true;
    boards.receiveShadow = true;
    this.add(boards);
    CORNERS.forEach(([x0, z0], k) => {
      const [x1, z1] = CORNERS[(k + 1) % 5];
      const [nx, nz] = SIDES[k];
      const a = v(x0 + nx * 0.05, y + 0.06, z0 + nz * 0.05);
      const b = v(x1 + nx * 0.05, y + 0.06, z1 + nz * 0.05);
      if (nz < -0.99) {
        // (the north side, either side of the stair's foot)
        const gap = STAIR.half + 0.35;
        this.beam(a, v(-gap, a.y, a.z), 0.3, dark, 0.28);
        this.beam(v(gap, b.y, b.z), b, 0.3, dark, 0.28);
      } else {
        this.beam(a, b, 0.3, dark, 0.28);
      }
      this.box(0.42, 0.34, 0.42, iron, x0, y + 0.08, z0, { tile: 1 });
    });
    // the sawdust ring on them, where blows are traded
    const ring = new THREE.Mesh(new THREE.RingGeometry(6.4, 6.85, 72), new THREE.MeshBasicMaterial({ color: '#c9b38a', transparent: true, opacity: 0.5, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, y + 0.012, 0);
    ring.userData.dynamic = true;
    this.add(ring);

    // below: beams across, posts down into the mist braced in pairs, and struts back against the cliff
    for (const x of [-9, -4.5, 0, 4.5, 9]) {
      const [z0, z1] = span(x, false, 0.4);
      this.box(0.45, 0.45, z1 - z0, dark, x, y - 0.62, (z0 + z1) / 2);
    }
    for (const z of [-8, -3, 2, 7]) {
      const [x0, x1] = span(z, true, 0.4);
      this.box(x1 - x0, 0.4, 0.4, dark, (x0 + x1) / 2, y - 0.62, z);
    }
    const DEEP = 14;
    for (const [x, z] of [[-4.5, -8], [4.5, -8], [-9, 2], [9, 2], [-4.5, 7], [4.5, 7], [0, 2]]) this.box(0.42, DEEP, 0.42, dark, x, y - 0.6 - DEEP / 2, z);
    for (const [[x0, z0], [x1, z1]] of [[[-9, 2], [-4.5, 7]], [[-4.5, 7], [4.5, 7]], [[4.5, 7], [9, 2]]]) {
      this.beam(v(x0, y - 1, z0), v(x1, y - 5.5, z1), 0.24, dark);
      this.beam(v(x0, y - 5.5, z0), v(x1, y - 1, z1), 0.24, dark);
    }
    // (the cliff's face below the Hold's rim, `h` down: how far south of the Hold's middle at x)
    const cliff = (x, h) => Math.sqrt((HUB.radius + (1.5 * h) / 26) ** 2 - x * x) - 0.2;
    for (const x of [-5.5, 5.5]) {
      const h = y - 5;
      this.beam(v(x, y - 0.8, n + 0.6), v(x * 0.6, h, at(cliff(x * 0.6, h))), 0.38, dark);
    }

    // the stair of stone down from the Hold's rim: its head over the cliff's edge, its steps on a
    // slab with a keel of mossy stone under it and a pier down into the mist, low stones along its
    // sides and a taller one either side of its head and its foot
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

    // the two chains it hangs from, from iron rings on the Hold's rim down to its north corners
    for (const side of [-1, 1]) {
      const [cx, cz] = CORNERS[side < 0 ? 2 : 3];
      const from = v(side * (STAIR.half + 2.4), 0.35, at(HUB.radius - 1));
      this.box(0.34, 0.3, 0.34, iron, from.x, 0.15, from.z, { tile: 1 });
      this.chain(from, v(cx * 0.96, y + 0.3, cz * 0.96), iron);
    }

    // either side of the stair's foot: a rack of practice weapons and barrels by it (east), an
    // archery butt and crates (west)
    this.rack(4.6, n + 3.1, wood, dark);
    this.barrel(7.0, n + 3.9, wood);
    this.barrel(7.8, n + 4.9, wood);
    this.butt(-4.8, n + 3.3, dark);
    this.crates(-7.4, n + 4.6, wood, dark);

    // rope lanterns on posts: at its three far corners, and either side of the stair's foot
    for (const k of [0, 1, 4]) this.lantern(CORNERS[k][0] * 0.92, CORNERS[k][1] * 0.92, dark, iron);
    for (const side of [-1, 1]) this.lantern(side * 5.9, n + 0.7, dark, iron);

    // where its dummies stand (training.js draws them)
    for (const [x, z] of DUMMY_SPOTS) this.blockCircle(x, z, 0.5);
  }

  // A square beam from one point to another (local coordinates), `w` thick (`h` tall, if given).
  beam(from, to, w, mat, h = w) {
    const len = from.distanceTo(to);
    const m = new THREE.Mesh(scaleBoxUV(new THREE.BoxGeometry(w, h, len), w, h, len, BRICK_TILE), mat);
    m.position.copy(from).lerp(to, 0.5);
    m.lookAt(to); // (before it's in the yard's group: its place and `to` are both the yard's)
    m.castShadow = true;
    this.add(m);
    return m;
  }

  // A chain of iron links, each turned a quarter to the last.
  chain(from, to, mat) {
    const len = from.distanceTo(to);
    const links = Math.round(len / 0.26);
    for (let i = 0; i < links; i++) {
      const a = from.clone().lerp(to, i / links);
      const b = from.clone().lerp(to, (i + 1) / links);
      const link = this.beam(a, b, i % 2 ? 0.05 : 0.14, mat, i % 2 ? 0.14 : 0.05);
      link.scale.z = 1.25;
    }
  }

  rack(x, z, wood, dark) {
    const y = YARD.y;
    for (const dx of [-0.75, 0.75]) this.box(0.14, 1.5, 0.14, dark, x + dx, y + 0.75, z, { tile: 1 });
    this.box(1.8, 0.12, 0.14, dark, x, y + 1.35, z, { tile: 1 });
    this.box(1.8, 0.1, 0.5, dark, x, y + 0.05, z + 0.2, { tile: 1 });
    // practice swords and a staff leaning on it
    [[-0.5, 0.18, 1.35], [-0.1, -0.14, 1.25], [0.32, 0.1, 1.55]].forEach(([dx, tilt, h]) => {
      this.box(0.09, h, 0.09, wood, x + dx, y + h / 2 + 0.05, z + 0.12, { tile: 1, rz: tilt, rx: -0.12 });
      if (h < 1.5) this.box(0.34, 0.07, 0.09, dark, x + dx - Math.sin(tilt) * (h - 0.4), y + h - 0.3, z + 0.12, { tile: 1, rz: tilt });
    });
    this.block(x - 1, z - 0.3, x + 1, z + 0.5);
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

  // A lantern on a post, hung from an arm reaching in over the boards.
  lantern(x, z, dark, iron) {
    const y = YARD.y;
    this.box(0.18, 2.6, 0.18, dark, x, y + 1.3, z, { tile: 1 });
    const d = Math.hypot(x, z) || 1;
    const ax = (-x / d) * 0.45;
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

  update(dt, t) {
    // the lanterns' flames stir
    for (const l of this.lanterns) {
      const k = 0.85 + 0.15 * Math.sin(t * 7 + l.phase) * Math.sin(t * 3.1 + l.phase * 2);
      l.glow.material.opacity = 0.35 * k;
      l.light.intensity = 1.6 * k;
    }
  }
}
