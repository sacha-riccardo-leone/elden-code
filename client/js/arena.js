// The Arena of Trials, north of Roundtable Hold: a ring of broken stone where great enemies are
// fought (fight.js). It lies sunk below the mist, rises (with the stair up to it from the Hold) when
// a fight begins, and sinks again once the fight is over and nobody is left on it. Risen, its floor
// stands higher than the Hold's (ARENA.y, ground.js): on the stair the ground climbs from the one
// to the other.

import * as THREE from 'three';
import { ARENA, HUB } from './config.js';
import * as T from './textures.js';
import { rng } from './pixel.js';
import { Builder, BRICK_TILE, scaleCylUV, NOISE_GLSL, UV_VERT } from './build.js';
import { Flame } from './fire.js';
import { rippleBounds, rippling } from './ripple.js';
import { addLevel } from './ground.js';

// (its floor's colours: grey brick, worn to dirt and moss at the edge; the training yard's too, yard.js)
export const FLOOR = {
  stone: ['#3e3a37', '#45403c', '#393532', '#4a4440', '#403b37'],
  dirt: ['#2a2420', '#2e2723', '#26201d'],
  moss: ['#383427', '#413c2c', '#333023'],
  tuft: ['#565034', '#47422f'],
};
const DEPTH = 46; // how far below the mist it waits
// The stair up from the Hold: its foot (where it leaves the Hold's ground, just past the cliff's
// edge), its head (the arena's rim), its steps, and how far before a step's middle the ground under
// a foot reaches the step's height, so that a foot sinks at most a hair into a step's edge (yard.js
// likewise, going down).
const STAIR = { foot: -(HUB.radius + 0.5), head: ARENA.z + ARENA.radius, steps: 20, lead: 0.22 };
const GATE = { w: ARENA.bridgeHalf * 2 + 0.9, h: 4.2 }; // the fog wall across its entrance
const FOG_LIGHT = new THREE.Color('#dfe2ea'); // (its light: pale; round the Lord of Frenzied Flame, his fire's)
const FRENZY_FOG = new THREE.Color('#ff8a3a');

// The fog wall that seals the arena once thou'st stepped in to face a great enemy: a curtain of
// pale, gold-shot mist welling up and swirling, thick enough to be seen as a wall (`w` wide, `h`
// tall); round the Lord of Frenzied Flame (uFrenzy: his arena's fire, frenzyfx.js), a curtain of
// that fire instead.
const sealFrag = (w, h) => /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uFrenzy;
  varying vec2 vUv;
  ${NOISE_GLSL}
  void main() {
    vec2 p = vec2((vUv.x - 0.5) * ${w.toFixed(2)}, vUv.y * ${h.toFixed(2)});
    float swirl = fbm(vec2(p.x * 0.9 + sin(p.y * 0.7 + uTime * 0.4), p.y * 0.5 - uTime * 0.45));
    float streak = fbm(vec2(p.x * 3.5, p.y * 0.3 + uTime * 0.7));
    float n = swirl * 0.7 + streak * 0.4;
    float edge = smoothstep(0.0, 0.5, ${(w / 2).toFixed(2)} - abs(p.x)) * smoothstep(0.0, 0.25, p.y) * smoothstep(0.0, 1.4, ${h.toFixed(2)} - p.y);
    vec3 col = mix(vec3(0.72, 0.72, 0.78), vec3(1.0, 0.9, 0.68), smoothstep(0.5, 0.95, n));
    col = mix(col, mix(vec3(0.85, 0.22, 0.02), vec3(1.0, 0.78, 0.25), smoothstep(0.45, 0.95, n)), uFrenzy);
    float a = edge * (0.2 + 0.55 * smoothstep(0.35, 0.95, n)) * uIntensity;
    gl_FragColor = vec4(col, a);
  }
`;

// A wall of that fog, `w` wide and `h` tall, facing +z (set its middle h / 2 over the ground), out
// of sight till its `uIntensity` (0..1) brings it up, its `uTime` swirling it: across the arena's
// way in.
function fogWall(w, h) {
  const uniforms = { uTime: { value: 0 }, uIntensity: { value: 0 }, uFrenzy: { value: 0 } };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({
    vertexShader: UV_VERT, fragmentShader: sealFrag(w, h), uniforms,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  mesh.renderOrder = 4;
  mesh.visible = false;
  mesh.userData.dynamic = true;
  return { mesh, uniforms };
}

// A disc of radius R in the xy plane (as CircleGeometry, uv likewise), divided into a grid of
// `step`-sized squares: those past its edge are drawn in onto it, so the rim stays round.
export function discGeometry(R, step) {
  const n = Math.ceil((2 * R) / step);
  const geo = new THREE.PlaneGeometry(2 * R, 2 * R, n, n);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const r = Math.hypot(x, y);
    if (r > R) { x *= R / r; y *= R / r; }
    pos.setXY(i, x, y);
    uv.setXY(i, (x / R + 1) / 2, (y / R + 1) / 2);
  }
  geo.computeVertexNormals();
  return geo;
}

export class Arena extends Builder {
  constructor(world) {
    super(world, 0, ARENA.z);
    this.isArena = true;
    this.name = 'Arena of Trials';
    this.subtitle = 'Where great enemies are faced';
    this.mat = world.matsFor('ashen');
    this.braziers = [];
    this.sealed = false; // the fog wall across the entrance (seal)
    this.build();
    this.mergeStatic();
    this.depth = DEPTH;
    this.rise = 0;
    this.risen = false;
    this.moving = 0; // +1 rising, -1 sinking
    this.setDepth(DEPTH);
    addLevel({ contains: (x, z) => this.isLevel(x, z), y: (x, z) => this.floorAt(x, z) });
  }

  // Where its ground lies once it has risen: the ring and the air round it (an ultimate may carry
  // someone off its edge for a moment: they stay at its height), and the stair up to it.
  isLevel(x, z) {
    if (!this.risen) return false;
    if ((x - this.cx) ** 2 + (z - this.cz) ** 2 <= (ARENA.radius + 2) ** 2) return true;
    return Math.abs(x - this.cx) <= ARENA.bridgeHalf + 0.6 && z <= STAIR.foot && z > STAIR.head;
  }

  // The Hold's ground runs on to the stair's foot, then up its steps to the arena's floor.
  floorAt(x, z) {
    if (z <= STAIR.head) return ARENA.y;
    return Math.max(0, Math.min(ARENA.y, (ARENA.y * (STAIR.foot + STAIR.lead - z)) / (STAIR.foot - STAIR.head)));
  }

  contains(x, z) {
    return this.risen && (x - this.cx) ** 2 + (z - this.cz) ** 2 <= ARENA.radius ** 2;
  }

  // Walkable: the ring itself and its bridge back to the Hold, once it has risen (but not the
  // bridge while the fog wall seals the way out).
  isWalk(x, z) {
    if (!this.risen) return false;
    if ((x - this.cx) ** 2 + (z - this.cz) ** 2 <= ARENA.walkRadius ** 2) return true;
    if (this.sealed) return false;
    return Math.abs(x - this.cx) <= ARENA.bridgeHalf && z <= -HUB.walkRadius + 0.6 && z >= this.cz + ARENA.walkRadius - 0.6;
  }

  // Thou'st stepped in to face a great enemy: a wall of fog wells up across the way out, and stays
  // till the fight is over (fight.js); then it thins away.
  seal(on) {
    if (on === this.sealed) return;
    this.sealed = on;
    this.world.version += 1; // (the bridge is walkable again, or not: the nav grid follows)
    if (!on) return;
    this.world.particles.emit({
      pos: [this.cx, ARENA.y + 1.4, this.cz + this.gateZ], spread: [GATE.w / 2, 1.2, 0.2], vel: [0, 0.6, 0], velSpread: [0.5, 0.5, 0.5],
      color: ['#e8e4dc', '#c8c4bc', '#f2dca8'], size: 0.12, life: 1.6, count: 50, drag: 0.8, intensity: 1.1,
    });
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
    // (finely divided, so the Golem's shockwaves can ripple it like water: ripple.js)
    const floor = new THREE.Mesh(discGeometry(R, 0.25), rippling(new THREE.MeshLambertMaterial({ map: floorTex }), { lit: true }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData.dynamic = true; // (never merged with anything: its material bends it)
    this.add(floor);
    rippleBounds(this.cx, this.cz, R);
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
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.6, 48), rippling(new THREE.MeshBasicMaterial({ color: '#2a1a14', transparent: true, opacity: 0.55, depthWrite: false })));
    ring.userData.dynamic = true;
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

    // the way in from the bridge, where it meets the ring: two stone posts, and between them the
    // fog wall when it's sealed
    this.gateZ = ARENA.walkRadius + 0.4;
    for (const side of [-1, 1]) {
      const x = side * (GATE.w / 2 + 0.2);
      const post = new THREE.Mesh(scaleCylUV(new THREE.CylinderGeometry(0.32, 0.4, 3.6, 8), 0.36, 3.6, BRICK_TILE), this.mat.stoneMoss);
      post.position.set(x, 1.8, this.gateZ);
      post.castShadow = true;
      post.receiveShadow = true;
      this.add(post);
      this.box(0.9, 0.3, 0.9, this.mat.stone, x, 3.75, this.gateZ, { tile: 1 });
    }
    const fog = fogWall(GATE.w, GATE.h);
    this.sealUniforms = fog.uniforms;
    this.fogWall = fog.mesh;
    this.fogWall.position.set(0, GATE.h / 2, this.gateZ);
    this.add(this.fogWall);
    this.fogLight = this.light(0, 2.2, this.gateZ - 0.8, '#dfe2ea', 8, 1.6);

    // the stair of stone up from Roundtable Hold, which rises and sinks with the arena: its foot over
    // the Hold's cliff, its steps on a slab with a keel of mossy stone under it and a pier down
    // into the mist, low stones along its sides and a taller one either side of its foot
    const Y = ARENA.y;
    const at = (z) => z - this.cz; // (from the world's north and south to the arena's)
    const up = (z) => Math.max(0, Math.min(Y, (Y * (STAIR.foot - z)) / (STAIR.foot - STAIR.head))); // (how far it has climbed at z)
    const v = (x, y, z) => new THREE.Vector3(x, y - Y, at(z)); // (the arena's floor is its 0)
    const wide = ARENA.bridgeHalf * 2 + 0.5;
    const tread = (STAIR.foot - STAIR.head) / STAIR.steps;
    const foot = -(HUB.radius - 0.35);
    this.box(wide, 0.6, foot - STAIR.foot, this.mat.stone, 0, -0.28 - Y, at((foot + STAIR.foot) / 2));
    for (let i = 0; i < STAIR.steps; i++) {
      const top = (Y * (i + 0.5)) / STAIR.steps;
      this.box(wide, 0.6, tread + 0.02, this.mat.stone, 0, top - 0.3 - Y, at(STAIR.foot - tread * (i + 0.5)));
    }
    this.beam(v(0, -0.75, STAIR.foot), v(0, Y - 0.75, STAIR.head), wide - 0.1, this.mat.stone, 0.5);
    const keel = [STAIR.foot - 0.8, STAIR.head + 0.8].map((z) => v(0, up(z) - 1.45, z));
    this.beam(keel[0], keel[1], 1.6, this.mat.stoneMoss, 1.4);
    const pier = STAIR.foot - (STAIR.foot - STAIR.head) * 0.45;
    this.box(1.5, 22, 1.5, this.mat.stoneMoss, 0, up(pier) - 1.9 - 11 - Y, at(pier));
    for (const side of [-1, 1]) {
      const x = side * (ARENA.bridgeHalf + 0.13);
      for (let i = 0; i < STAIR.steps; i += 2) {
        if (r() < 0.15) continue;
        const h = 0.5 + r() * 0.15;
        const base = (Y * (i + 0.5)) / STAIR.steps; // (on the lower of the two steps it stands on)
        this.box(0.25, h, tread * 2 - 0.08, this.mat.stoneMoss, x, base + h / 2 - Y, at(STAIR.foot - tread * (i + 1)));
      }
      this.box(0.4, 0.9, 0.5, this.mat.stoneMoss, x, 0.42 - Y, at(foot - 0.35));
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

  // (risen, at its own height: ARENA.y)
  setDepth(d) {
    this.group.position.y = ARENA.y - d;
    for (const src of this.ownLights) src.pos.y = src.baseY + ARENA.y - d;
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
    // the fog wall wells up quickly when sealed, and thins away slowly after
    const u = this.sealUniforms;
    u.uTime.value = t;
    u.uIntensity.value = Math.max(0, Math.min(1, u.uIntensity.value + (this.sealed ? dt / 0.8 : -dt / 1.4)));
    this.fogWall.visible = up && u.uIntensity.value > 0.01;
    this.fogWall.scale.y = 0.4 + 0.6 * Math.min(1, u.uIntensity.value * 1.5);
    this.fogWall.position.y = (GATE.h / 2) * this.fogWall.scale.y;
    this.fogLight.intensity = up ? 7 * u.uIntensity.value : 0;
    // (its fire round the Lord of Frenzied Flame, as the world beyond goes black: daylight.js)
    u.uFrenzy.value = this.world.uBlack.value;
    this.fogLight.color.lerpColors(FOG_LIGHT, FRENZY_FOG, u.uFrenzy.value);
    for (const b of this.braziers) {
      const f = b.flame ? 0.75 + 0.3 * b.flame.step(dt) : 0.85 + 0.15 * Math.sin(t * 10 + b.phase);
      b.light.intensity = up ? 10 * f : 0;
    }
  }
}
