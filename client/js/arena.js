// The Arena of Trials, north of Roundtable Hold: a ring of broken stone where great enemies are
// fought (fight.js). It lies sunk below the mist, rises (with its bridge from the Hold) when a fight
// begins, and sinks again once the fight is over and nobody is left on it.

import * as THREE from 'three';
import { ARENA, HUB } from './config.js';
import * as T from './textures.js';
import { rng } from './pixel.js';
import { Builder, BRICK_TILE, scaleCylUV, scaleBoxUV } from './build.js';
import { Flame } from './fire.js';

const FLOOR = {
  stone: ['#3e3a37', '#45403c', '#393532', '#4a4440', '#403b37'],
  dirt: ['#2a2420', '#2e2723', '#26201d'],
  moss: ['#383427', '#413c2c', '#333023'],
  tuft: ['#565034', '#47422f'],
};
const DEPTH = 46; // how far below the mist it waits

export class Arena extends Builder {
  constructor(world) {
    super(world, 0, ARENA.z);
    this.isArena = true;
    this.name = 'Arena of Trials';
    this.subtitle = 'Where great enemies are faced';
    this.mat = world.matsFor('ashen');
    this.braziers = [];
    this.build();
    this.mergeStatic();
    this.depth = DEPTH;
    this.rise = 0;
    this.risen = false;
    this.moving = 0; // +1 rising, -1 sinking
    this.setDepth(DEPTH);
  }

  contains(x, z) {
    return this.risen && (x - this.cx) ** 2 + (z - this.cz) ** 2 <= ARENA.radius ** 2;
  }

  // Walkable: the ring itself and its bridge back to the Hold, once it has risen.
  isWalk(x, z) {
    if (!this.risen) return false;
    if ((x - this.cx) ** 2 + (z - this.cz) ** 2 <= ARENA.walkRadius ** 2) return true;
    return Math.abs(x - this.cx) <= ARENA.bridgeHalf && z <= -HUB.walkRadius + 0.6 && z >= this.cz + ARENA.walkRadius - 0.6;
  }

  // Arrivals by grace come in at the south end, by the bridge; the great enemy waits to the north.
  point(name) {
    if (name === 'boss') return [this.cx, this.cz - ARENA.radius * 0.45];
    return [this.cx, this.cz + ARENA.radius * 0.62];
  }

  build() {
    const R = ARENA.radius;
    const floorTex = T.pixelTexture(T.floorCanvas(R * 2, R * 2, (cx, cz) => {
      const d = Math.hypot(cx - R, cz - R);
      return d < R - 1.2 ? 1.1 : 0.35;
    }, FLOOR, 9191));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 56), new THREE.MeshLambertMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.add(floor);
    const rock = this.mat.rockTex.clone();
    rock.repeat.set(34, 13);
    rock.needsUpdate = true;
    const cliff = new THREE.Mesh(new THREE.CylinderGeometry(R, R - 2, 28, 44, 1, true), new THREE.MeshLambertMaterial({ map: rock }));
    cliff.position.y = -14;
    this.add(cliff);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(R - 0.1, 0.24, 4, 56), this.mat.stoneMoss);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = -0.05;
    this.add(lip);

    // a carved ring in the middle of the floor, where the great enemy is met
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.6, 48), new THREE.MeshBasicMaterial({ color: '#2a1a14', transparent: true, opacity: 0.55, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    this.add(ring);

    // tall broken pillars all round, open to the south where the bridge comes in (and the eye looks in)
    const r = rng(311);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.1;
      const deg = ((a * 180) / Math.PI) % 360;
      if (deg > 55 && deg < 125) continue;
      const x = Math.cos(a) * (R - 1.3);
      const z = Math.sin(a) * (R - 1.3) * 0.94;
      const broken = r() < 0.4;
      const h = broken ? 1.4 + r() * 2 : 6 + r() * 2.2;
      const col = new THREE.Mesh(scaleCylUV(new THREE.CylinderGeometry(0.5, 0.6, h, 8), 0.55, h, BRICK_TILE), this.mat.stoneMoss);
      col.position.set(x, h / 2, z);
      col.castShadow = true;
      col.receiveShadow = true;
      this.add(col);
      if (!broken) this.box(1.4, 0.4, 1.4, this.mat.stone, x, h + 0.2, z, { tile: 1 });
      else this.box(0.7, 0.35, 0.6, this.mat.stone, x + 0.7, 0.17, z + 0.4, { ry: r() * 3, tile: 1 });
      this.blockCircle(x, z, 0.75);
    }

    // braziers in a ring, lit with the Hold's fire
    for (const a of [-0.35, -1.2, -1.95, -2.8, 0.55, 2.6]) {
      const x = Math.cos(a) * (R - 3.4);
      const z = Math.sin(a) * (R - 3.4) * 0.94;
      for (let k = 0; k < 3; k++) {
        const la = (k / 3) * Math.PI * 2;
        this.box(0.08, 1.1, 0.08, this.world.mat.iron, x + Math.cos(la) * 0.25, 0.5, z + Math.sin(la) * 0.25, { tile: 1, rx: Math.sin(la) * 0.2, rz: -Math.cos(la) * 0.2 });
      }
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.32, 10), this.world.mat.iron);
      bowl.position.set(x, 1.15, z);
      bowl.castShadow = true;
      this.add(bowl);
      const glow = this.additiveSprite('#ff8a2a', 2.0, 0.3);
      glow.position.set(x, 1.6, z);
      this.add(glow);
      this.blockCircle(x, z, 0.55);
      this.braziers.push({ x, z, glow, light: this.light(x, 1.9, z, '#ff8a3a', 10, 1.5), flame: null, phase: a * 7 });
    }

    // the bridge back to Roundtable Hold, which rises and sinks with the arena
    const z0 = R - 0.6;
    const z1 = -HUB.radius - this.cz + 0.6;
    const len = z1 - z0;
    const mid = (z0 + z1) / 2;
    const box = (w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(scaleBoxUV(new THREE.BoxGeometry(w, h, d), w, h, d, BRICK_TILE), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.add(m);
    };
    box(ARENA.bridgeHalf * 2 + 0.5, 0.6, len, this.mat.stone, 0, -0.28, mid);
    box(1.6, 1.4, len * 0.7, this.mat.stoneMoss, 0, -1.2, mid);
    for (const side of [-1, 1]) {
      for (let z = z0 + 0.3; z < z1 - 0.3; z += 1.1) {
        if (r() < 0.2) continue;
        box(0.25, 0.5 + r() * 0.15, 0.9, this.mat.stoneMoss, side * (ARENA.bridgeHalf + 0.13), 0.27, z + 0.45);
      }
    }
  }

  lightFires(art) {
    if (!art || this.braziers[0]?.flame) return;
    this.braziers.forEach((b, i) => {
      b.flame = new Flame(art.brazier[i % art.brazier.length]);
      b.flame.mesh.position.set(b.x, 1.17, b.z);
      this.add(b.flame.mesh);
    });
  }

  // rising out of the mist (and, after the fight, sinking back into it)
  raise() {
    if (this.risen || this.moving > 0) return;
    this.moving = 1;
    this.world.particles.emit({
      pos: [this.cx, -3, this.cz], spread: [ARENA.radius, 2, ARENA.radius], vel: [0, 2.2, 0], velSpread: [1.2, 1.4, 1.2],
      color: ['#8a8278', '#6a625a', '#c8c0a8'], size: 0.14, life: 2.8, count: 160, drag: 0.5, intensity: 0.7,
    });
  }

  lower() {
    if (!this.risen && this.moving >= 0 && this.rise <= 0) return;
    this.moving = -1;
    this.risen = false;
    this.world.version += 1;
  }

  setDepth(d) {
    this.group.position.y = -d;
    for (const src of this.ownLights) src.pos.y = src.baseY - d;
  }

  update(dt, t) {
    if (this.moving) {
      this.rise = Math.max(0, Math.min(1, this.rise + (this.moving * dt) / 3.2));
      const eased = this.moving > 0 ? 1 - (1 - this.rise) ** 3 : this.rise ** 2;
      this.setDepth(DEPTH * (1 - eased));
      if (this.moving > 0 && this.rise >= 1) { this.moving = 0; this.risen = true; this.world.version += 1; }
      if (this.moving < 0 && this.rise <= 0) this.moving = 0;
    }
    const up = this.rise > 0;
    this.group.visible = up;
    for (const b of this.braziers) {
      const f = b.flame ? 0.75 + 0.3 * b.flame.step(dt) : 0.85 + 0.15 * Math.sin(t * 10 + b.phase);
      b.light.intensity = up ? 10 * f : 0;
    }
  }
}
