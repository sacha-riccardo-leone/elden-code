// The training yard below Roundtable Hold: a round floor of grey brick on a rock of its own, south
// of the Hold and lower than it, like the Arena of Trials (arena.js) but with no pillars; a stair of
// stone comes down to it from the Hold's rim. A sawdust ring on its floor, straw dummies round it to
// strike (training.js), racks of the Round Table's weapons (weapons.js), an archery butt, barrels
// and crates, rope lanterns about its edge. Always there.
// Its ground is lower than the Hold's (ground.js): on the stair it runs from the one to the other.

import * as THREE from 'three';
import { HUB } from './config.js';
import * as T from './textures.js';
import { rng } from './pixel.js';
import { Builder } from './build.js';
import { addLevel } from './ground.js';
import { FLOOR } from './arena.js';
import { weapon } from './weapons.js';

// The yard's radius; the stair: half its width, its head (where it leaves the Hold's ground, just
// past the cliff's edge), its length and its steps. `lag`: how far past a step's middle the ground
// under a foot reaches the step's height, so that a foot sinks at most a hair into the edge of the
// step below.
const R = 12;
const STAIR = { half: 1.4, top: HUB.radius + 0.5, run: 7.6, steps: 16, lag: 0.14 };
const NORTH = STAIR.top + STAIR.run; // the yard's north edge, where the stair comes down
// Its floor's height, its middle, half its width, its south edge, and half the stair's width (where
// the Hold's rim opens for it, hub.js).
export const YARD = { y: -3.2, cz: NORTH + R, halfW: R, south: NORTH + 2 * R, stairHalf: STAIR.half };
// where its dummies stand (training.js), from its middle: five, round inside its sawdust ring
export const DUMMY_SPOTS = [0, 1, 2, 3, 4].map((k) => [5.2 * Math.cos(Math.PI / 2 + k * 0.4 * Math.PI), 5.2 * Math.sin(Math.PI / 2 + k * 0.4 * Math.PI)]);

// (how far a point lies from the yard's middle)
const away = (x, z) => Math.hypot(x, z - YARD.cz);

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
  // someone off its edge for a moment: they stay at its height).
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

  isWalk(x, z) {
    return away(x, z) <= R - 0.6
      || (Math.abs(x) <= STAIR.half - 0.25 && z >= HUB.walkRadius - 0.5 && z <= NORTH + 0.8);
  }

  build() {
    const { wood, iron } = this.world.mat;
    const { stone, stoneMoss } = this.mat;
    const { dark } = this;
    const y = YARD.y;
    const n = -R; // (its north edge, from its middle)
    const at = (z) => z - YARD.cz; // (from the Hold's middle to its)
    const r = rng(53);
    const v = (x, yy, z) => new THREE.Vector3(x, yy, z);

    // its floor of grey brick, the arena's, worn to dirt and moss at the edge; a mossy lip round it
    // (open where the stair lands) and below it a rock of its own, down into the mist
    const tex = T.pixelTexture(T.floorCanvas(R * 2, R * 2, (cx, cz) => (Math.hypot(cx - R, cz - R) < R - 1.2 ? 1.1 : 0.35), FLOOR, 5150));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshLambertMaterial({ map: tex }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = y;
    floor.receiveShadow = true;
    this.add(floor);
    const gap = Math.asin((STAIR.half + 0.4) / (R - 0.1));
    const rim = new THREE.TorusGeometry(R - 0.1, 0.24, 4, 54, Math.PI * 2 - gap * 2);
    rim.rotateZ(-Math.PI / 2 + gap); // (the gap to the north)
    const lip = new THREE.Mesh(rim, stoneMoss);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = y - 0.05;
    this.add(lip);
    const rock = this.mat.rockTex.clone();
    rock.repeat.set(22, 13);
    rock.needsUpdate = true;
    const cliff = new THREE.Mesh(new THREE.CylinderGeometry(R, R - 2, 28, 40, 1, true), new THREE.MeshLambertMaterial({ map: rock }));
    cliff.position.y = y - 14;
    this.add(cliff);
    // the sawdust ring on it, where blows are traded
    const ring = new THREE.Mesh(new THREE.RingGeometry(6.4, 6.85, 72), new THREE.MeshBasicMaterial({ color: '#c9b38a', transparent: true, opacity: 0.5, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, y + 0.012, 0);
    ring.userData.dynamic = true;
    this.add(ring);

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

    // either side of the stair's foot, a rack of the Round Table's weapons (weapons.js): barrels by
    // the one, crates by the other; an archery butt to the west
    this.rack(5, n + 3.4, [0, 2, 5, 4, 3], wood, dark);
    this.rack(-5, n + 3.4, [8, 1, 7, 9, 6], wood, dark);
    this.barrel(7.3, n + 4.4, wood);
    this.barrel(8, n + 5.4, wood);
    this.crates(-8.2, n + 5.4, wood, dark);
    this.butt(-9.4, 1.8, dark);

    // rope lanterns on posts about its edge: either side of the stair's foot, and round to the south
    for (const deg of [-112, -68, 18, 90, 162]) {
      const a = (deg * Math.PI) / 180;
      this.lantern(Math.cos(a) * (R - 0.9), Math.sin(a) * (R - 0.9), dark, iron);
    }

    // where its dummies stand (training.js draws them)
    for (const [x, z] of DUMMY_SPOTS) this.blockCircle(x, z, 0.5);
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

  // A lantern on a post, hung from an arm reaching in over the floor.
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
