// Shared building blocks for islands (the hub and every project region): geometry helpers
// with world-scaled UVs, and a Builder base that places things in island-local coordinates,
// records obstacles for pathfinding, registers pooled lights and near-camera particle emitters.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DOUSE } from './config.js';

export const BRICK_TILE = 2; // world units covered by one brick texture

// A steady 0..1 for a thing from a number or two (which moment a fire goes out, Builder.lit).
export function seedOf(a, b = 0) {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function scaleBoxUV(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile);
    }
  }
  return geo;
}

export function scaleCylUV(geo, radius, height, tile) {
  const uv = geo.attributes.uv;
  const circ = 2 * Math.PI * radius;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * circ) / tile, (uv.getY(i) * height) / tile);
  return geo;
}

export const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
`;

export const UV_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Builder {
  constructor(world, cx, cz = 0) {
    this.world = world;
    this.cx = cx;
    this.cz = cz;
    this.group = new THREE.Group();
    this.group.position.set(cx, 0, cz);
    world.scene.add(this.group);
    this.obstacles = [];
    this.near = true;
    this.ownLights = []; // pooled light sources this builder registered (they move if it does)
    this.ownAmbient = []; // its ambient particle emitters (taken away with it, world.removeRegion)
  }

  wx(x) { return this.cx + x; }
  wz(z) { return this.cz + z; }

  add(...objs) {
    for (const o of objs) this.group.add(o);
    return objs[0];
  }

  box(w, h, d, mat, x, y, z, { cast = true, receive = true, tile = BRICK_TILE, ry = 0, rz = 0, rx = 0 } = {}) {
    const geo = scaleBoxUV(new THREE.BoxGeometry(w, h, d), w, h, d, tile);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = cast;
    m.receiveShadow = receive;
    this.group.add(m);
    return m;
  }

  // A square beam from one point to another (local coordinates), `w` thick (`h` tall, if given).
  beam(from, to, w, mat, h = w) {
    const len = from.distanceTo(to);
    const m = new THREE.Mesh(scaleBoxUV(new THREE.BoxGeometry(w, h, len), w, h, len, BRICK_TILE), mat);
    m.position.copy(from).lerp(to, 0.5);
    m.lookAt(to); // (before it's in the group: its place and `to` are both the group's)
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  // A thing built of several meshes (in groups of their own), set in place in the group: its meshes
  // are moved into the group itself as they stand, so that mergeStatic folds them in with the rest.
  adopt(obj) {
    this.group.add(obj);
    this.group.updateMatrixWorld(true);
    const inv = this.group.matrixWorld.clone().invert();
    const meshes = [];
    obj.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const m of meshes) {
      const local = inv.clone().multiply(m.matrixWorld);
      m.parent.remove(m);
      local.decompose(m.position, m.quaternion, m.scale);
      this.group.add(m);
    }
    this.group.remove(obj);
  }

  // Obstacles are given in local coordinates and stored in world coordinates.
  block(x0, z0, x1, z1) {
    this.obstacles.push({
      type: 'rect',
      x0: this.cx + Math.min(x0, x1), z0: this.cz + Math.min(z0, z1),
      x1: this.cx + Math.max(x0, x1), z1: this.cz + Math.max(z0, z1),
    });
  }

  // (it's returned, to be stood aside for a while, `off`, or taken away again: unblock)
  blockCircle(x, z, r) {
    const o = { type: 'circle', x: this.cx + x, z: this.cz + z, r };
    this.obstacles.push(o);
    return o;
  }

  unblock(o) {
    this.obstacles = this.obstacles.filter((x) => x !== o);
  }

  isBlocked(x, z, pad = 0) {
    for (const o of this.obstacles) {
      if (o.off) continue;
      if (o.type === 'rect') {
        if (x > o.x0 - pad && x < o.x1 + pad && z > o.z0 - pad && z < o.z1 + pad) return true;
      } else if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + pad) ** 2) {
        return true;
      }
    }
    return false;
  }

  additiveSprite(color, size, opacity = 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.world.tex.glow, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.scale.set(size, size, 1);
    s.renderOrder = 5;
    return s;
  }

  // A light that only becomes a real PointLight when it's among the closest to the camera.
  light(x, y, z, color, distance, decay = 1.5) {
    const src = this.world.addLightSource({
      pos: new THREE.Vector3(this.cx + x, y, this.cz + z),
      color: new THREE.Color(color), distance, decay, intensity: 0, baseY: y,
    });
    this.ownLights.push(src);
    return src;
  }

  // How lit one of its fires (or its grace) is just now: 1, or less while they're put out for a
  // great enemy (world.douse), each going out, and being lit again, at its own moment (`seed`, 0..1).
  lit(seed) {
    const d = this.world.douse;
    if (d <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - (d - seed * DOUSE.spread) / (1 - DOUSE.spread)));
  }

  // A wisp of smoke from a fire as it goes out (`state` remembers it's out; local coordinates).
  smoke(state, lit, x, y, z) {
    if (lit > 0.5) state.out = false;
    if (lit > 0.08 || state.out) return;
    state.out = true;
    if (!this.near) return;
    this.world.particles.emit({
      pos: [this.wx(x), y, this.wz(z)], spread: [0.12, 0.08, 0.12], vel: [0, 0.8, 0], velSpread: [0.25, 0.3, 0.25],
      color: ['#5a5652', '#3a3734', '#77716a'], size: 0.09, life: 1.6, count: 12, drag: 0.9, intensity: 0.5,
    });
  }

  // Ambient particles only flow while the island is near the camera (and above the mist).
  ambient(rate, factory) {
    const e = this.world.particles.addAmbient(rate, (t) => (this.near && this.risen !== false ? factory(t) : null));
    this.ownAmbient.push(e);
    return e;
  }

  // Fold every static mesh that shares a material into one, so an island costs a handful of
  // draw calls instead of hundreds. Meshes with their own material (animated ones) are left alone.
  mergeStatic() {
    const buckets = new Map();
    for (const m of [...this.group.children]) {
      if (!m.isMesh || m.isInstancedMesh || Array.isArray(m.material) || m.userData.dynamic) continue;
      const key = `${m.material.uuid}|${m.castShadow}|${m.receiveShadow}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(m);
    }
    for (const meshes of buckets.values()) {
      if (meshes.length < 2) continue;
      const geos = meshes.map((m) => {
        m.updateMatrix();
        let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
        g.clearGroups();
        g.applyMatrix4(m.matrix);
        return g;
      });
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      geos.forEach((g) => g.dispose());
      const one = new THREE.Mesh(merged, meshes[0].material);
      one.castShadow = meshes[0].castShadow;
      one.receiveShadow = meshes[0].receiveShadow;
      for (const m of meshes) {
        this.group.remove(m);
        if (!m.geometry.userData.shared) m.geometry.dispose();
      }
      this.group.add(one);
    }
  }

  swayBanner(b, t) {
    const pos = b.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = b.base[i * 3 + 1];
      const k = -y / 2.5;
      pos.setZ(i, Math.sin(t * 1.6 + b.phase + y * 1.5) * 0.12 * k);
      pos.setX(i, b.base[i * 3] + Math.sin(t * 1.1 + b.phase) * 0.05 * k);
    }
    pos.needsUpdate = true;
  }

  bannerMesh(tex, phase = 0) {
    const geo = new THREE.PlaneGeometry(1.0, 2.5, 1, 10);
    geo.translate(0, -1.25, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    mesh.castShadow = true;
    return { mesh, base: geo.attributes.position.array.slice(), phase };
  }
}
