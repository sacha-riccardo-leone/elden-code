// One project's region: a walled island with its own Site of Grace, forge, scriptorium, war
// table, ritual circle, raven tower and fog gate, dressed in the project's biome and heraldry.
// Everything is built in island-local coordinates inside this.group.

import * as THREE from 'three';
import { REGION, STATIONS, BRIDGE, slotCenterX } from './config.js';
import * as T from './textures.js';
import { rng, ramp, hashStr, shade } from './pixel.js';
import { buildRaven } from './sprites.js';
import { BIOMES } from './biomes.js';
import { Builder, BRICK_TILE, scaleCylUV, NOISE_GLSL, UV_VERT, seedOf } from './build.js';
import { Flame } from './fire.js';
import { GraceFigure } from './grace.js';

const FOG_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  ${NOISE_GLSL}
  void main() {
    vec2 p = vec2((vUv.x - 0.5) * 4.4, vUv.y * 7.8);
    float inside = 1.0;
    if (p.y > 4.0) inside = step(distance(p, vec2(-2.2, 4.0)), 4.4) * step(distance(p, vec2(2.2, 4.0)), 4.4);
    float swirl = fbm(vec2(p.x * 0.9 + sin(p.y * 0.6 + uTime * 0.3), p.y * 0.45 - uTime * 0.35));
    float streak = fbm(vec2(p.x * 4.0, p.y * 0.25 + uTime * 0.6));
    float n = swirl * 0.75 + streak * 0.35;
    float edge = smoothstep(0.0, 0.6, 2.2 - abs(p.x)) * smoothstep(0.0, 0.4, p.y);
    vec3 col = mix(vec3(0.42, 0.43, 0.5), vec3(0.95, 0.82, 0.58), smoothstep(0.5, 0.95, n));
    float a = inside * edge * (0.03 + 0.16 * smoothstep(0.4, 0.95, n)) * uIntensity;
    gl_FragColor = vec4(col * (0.3 + 0.2 * uIntensity), a);
  }
`;

// Still water / rot pools: dark surface with slow drifting highlights.
// A pool (water, blood), drawn on the floor's own pixel grid. It's opaque, so the flagstones
// beneath don't show, and it has depth: a dark lip at the edge, a lighter shallow ring, then
// bands stepping down to a dark middle, with glints drifting over it. Unlit, so it carries a
// night and a day colour, and its glints brighten by day.
const POOL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uDay;
  uniform vec2 uTexels;
  uniform vec3 uDeep;
  uniform vec3 uDayDeep;
  uniform vec3 uShine;
  varying vec2 vUv;
  ${NOISE_GLSL}
  void main() {
    vec2 uv = (floor(vUv * uTexels) + 0.5) / uTexels;
    vec2 c = uv - 0.5;
    float r = length(c * vec2(1.0, 1.4)) + (noise(uv * 6.0) - 0.5) * 0.08;
    if (r > 0.47) discard;
    vec3 base = mix(uDeep, uDayDeep, uDay);
    float depth = floor((1.0 - smoothstep(0.1, 0.42, r)) * 3.0 + 0.5) / 3.0;
    vec3 col = mix(base * 1.45 + 0.012, base * 0.42, depth);
    if (r > 0.435) col = base * 0.38;
    float n = fbm(uv * 5.0 + vec2(uTime * 0.05, uTime * 0.03));
    float glint = step(0.68, n) * step(r, 0.43);
    col = mix(col, mix(uShine, vec3(1.0), uDay * 0.45), glint * 0.75);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Region extends Builder {
  constructor(world, project, slot, biomeKey) {
    super(world, slotCenterX(slot), 0);
    this.project = project;
    this.slot = slot;
    this.biomeKey = biomeKey;
    this.biome = BIOMES[biomeKey];
    this.hue = hashStr(`proj:${project}`) % 360;
    this.cloth = ramp(this.hue, 0.42, 0.09, 0.44);
    this.color = this.cloth[3];
    this.seed = hashStr(`region:${project}`);
    this.mat = world.matsFor(biomeKey);
    this.activity = { forge: 0, scriptorium: 0, ritual: 0, tower: 0, table: 0, gate: 0, grace: 0 };
    this.level = { ...this.activity };
    this.slots = {};
    for (const [id, st] of Object.entries(STATIONS)) this.slots[id] = st.slots.map(() => null);
    this.ravens = [];
    this.bellSwing = 0;
    this.forgeFlash = 0;
    this.lights = {};
    this.animated = [];
    this.risen = true; // false while it waits below the mist to rise
    this.rise = 1;
    this.rising = false;
    this.depth = 0;
    this.bridge = null; // the bridge that joins it to its neighbour; it rises with the island

    this.buildGround();
    this.buildWalls();
    this.buildGate();
    this.buildGrace();
    this.buildForge();
    this.buildScriptorium();
    this.buildTable();
    this.buildRitual();
    this.buildTower();
    this.buildBell();
    this.buildBanners();
    this.buildTorches();
    this.buildDecor();
    this.buildShafts();
    this.buildParticles();
    this.mergeStatic();
    this.lightFires(world.fireArt);
  }

  get name() {
    return this.project;
  }

  // Islands are born below the mist and rise into place.
  sink(depth = 46) {
    this.depth = depth;
    this.rise = 0;
    this.risen = false;
    this.rising = false;
    this.setDepth(depth);
  }

  startRise() {
    this.rising = true;
    this.world.particles.emit({
      pos: [this.cx, -3, -0.5], spread: [REGION.halfW, 2, 9], vel: [0, 2.2, 0], velSpread: [1.2, 1.4, 1.2],
      color: ['#8a8278', '#6a625a', '#c8c0a8'], size: 0.14, life: 2.8, count: 140, drag: 0.5, intensity: 0.7,
    });
  }

  // ... and, once nobody calls it home any more (the public demo only, director.retireIslands),
  // sinks back into it, to be taken away (world.removeRegion).
  startSink() {
    this.sinking = true;
    this.sunk = false;
    this.risen = false; // nobody may set foot on it now
    this.world.version += 1;
    this.world.particles.emit({
      pos: [this.cx, 0.5, -0.5], spread: [REGION.halfW, 1.5, 9], vel: [0, -1.2, 0], velSpread: [1.2, 1, 1.2],
      color: ['#8a8278', '#6a625a', '#c8c0a8'], size: 0.14, life: 2.8, count: 140, drag: 0.5, intensity: 0.7,
    });
  }

  stepSink(dt) {
    this.rise = Math.max(0, this.rise - dt / 3.6);
    const p = 1 - this.rise;
    this.setDepth(46 * p * p);
    if (this.rise <= 0) { this.sinking = false; this.sunk = true; }
  }

  // Frees what only this island used (shared materials and textures are left alone).
  dispose(shared) {
    const sharedTex = new Set(Object.values(this.world.tex || {}));
    this.grace.figure.dispose();
    this.world.scene.remove(this.group);
    for (const s of this.ravens) {
      this.world.scene.remove(s);
      s.material.map?.dispose();
      s.material.dispose();
    }
    this.group.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      for (const m of [].concat(o.material || [])) {
        if (shared.has(m)) continue;
        for (const k of ['map', 'emissiveMap', 'alphaMap']) if (m[k] && !sharedTex.has(m[k])) m[k].dispose();
        m.dispose();
      }
    });
  }

  // The user's pixel-art fire (fire.js), as in Roundtable Hold: a flame on each candle (the
  // scriptorium's stand and the war table's), a fire burning in the forge's mouth (fiercer while
  // someone works it), and a small one on each torch beside the fog gate. The old glows stay on,
  // dimmer and wider, as the light around them. `art` comes from fire.js loadFireArt().
  lightFires(art) {
    if (!art || this.fires) return;
    const flame = (sheet, x, y, z, height, opts) => {
      const f = new Flame(sheet, opts);
      const s = height / (sheet.h * sheet.px);
      f.mesh.scale.set(s, s, 1);
      f.base = s;
      f.mesh.position.set(x, y, z);
      this.add(f.mesh);
      return f;
    };
    const candle = (glow, i) => {
      const f = new Flame(art.candle[i % art.candle.length], { brightness: 1.05 });
      const base = glow.position.y - 0.08; // the wick, just above the wax
      f.mesh.position.set(glow.position.x, base, glow.position.z);
      this.add(f.mesh);
      glow.position.y = base + 0.13; // the halo just behind its flame, so the wick stays dark
      glow.position.z -= 0.06;
      return { flame: f, glow };
    };
    const { x: mx, z: mz } = this.forgeAt;
    // two fires side by side fill the forge's mouth, licking up past its top as they flare
    const forgeFires = [[-0.36, 1.45, 0], [0.38, 1.25, 2]].map(([dx, h, k]) => flame(art.brazier[(this.slot + k) % art.brazier.length], mx + dx, 0.24, mz + 0.02, h, { brightness: 1.2 }));
    this.fires = {
      forgeScales: forgeFires.map((f) => f.mesh.scale.x),
      candles: [...this.candles.map(candle), candle(this.tableFlame, 3)],
      // the forge's mouth goes dark and deep, the fire burning low in it
      forge: forgeFires,
      torches: this.torches.map((tc, i) => {
        const p = tc.flame.position;
        const f = flame(art.brazier[(i + 1) % art.brazier.length], p.x, p.y - 0.22, p.z, 0.95, { brightness: 1.3 });
        tc.flame.position.y = p.y + 0.05;
        return f;
      }),
    };
  }

  stepRise(dt) {
    this.rise = Math.min(1, this.rise + dt / 3.2);
    const eased = 1 - (1 - this.rise) ** 3;
    this.setDepth(this.depth * (1 - eased));
    if (this.rise >= 1) { this.rising = false; this.risen = true; }
  }

  setDepth(d) {
    this.group.position.y = -d;
    if (this.bridge) this.bridge.position.y = -d;
    for (const src of this.ownLights) src.pos.y = src.baseY - d;
  }

  contains(x, z) {
    return Math.abs(x - this.cx) <= REGION.halfW && z >= REGION.minZ && z <= REGION.maxZ;
  }

  walkRect() {
    const w = REGION.walk;
    return { minX: this.cx + w.minX, maxX: this.cx + w.maxX, minZ: w.minZ, maxZ: w.maxZ };
  }

  slotWorld(station, index) {
    const s = STATIONS[station].slots[index];
    return { x: this.wx(s[0]), z: this.wz(s[1]), face: s[2] };
  }

  point(station) {
    const [x, z] = STATIONS[station].pos;
    return [this.wx(x), this.wz(z)];
  }

  // --------------------------------------------------------------------------------------------

  buildGround() {
    const W = REGION.halfW * 2;
    const D = REGION.maxZ - REGION.minZ;
    const paved = (cx, cz) => {
      const x = cx - REGION.halfW;
      const z = cz + REGION.minZ;
      const plaza = 1 - Math.hypot(x / 10, (z + 2) / 6.5);
      const gatePath = Math.abs(x) < 2.4 && z < -3 ? 0.9 : 0;
      const front = Math.abs(x) < 2 && z > 0 ? 0.8 - z * 0.04 : 0;
      const road = Math.abs(z - BRIDGE.z) < 1.4 && Math.abs(x) > 9 ? 0.85 : 0;
      const nook = x < -9.5 && z > -1.5 && z < 3.5 ? 0.75 : 0;
      const forgeYard = x < -5.5 && z < -3 && x > -13 ? 0.6 : 0;
      const n = Math.sin(x * 1.7 + z * 0.9) * 0.12 + Math.sin(x * 0.5 - z * 1.3) * 0.1;
      return Math.max(plaza + 0.45, gatePath, front, road, nook, forgeYard) + n;
    };
    const floorTex = T.pixelTexture(T.floorCanvas(W, D, paved, this.biome.floor, this.seed));
    const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
    if (this.biomeKey === 'frost') this.world.snowByDay(floorMat);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, (REGION.minZ + REGION.maxZ) / 2);
    floor.receiveShadow = true;
    this.add(floor);

    // the island's cliff faces, falling away into the mist
    const rockTex = this.mat.rockTex;
    const cliff = (w, x, z, ry) => {
      const tex = rockTex.clone();
      tex.repeat.set(w / 2, 13);
      tex.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 26), new THREE.MeshLambertMaterial({ map: tex }));
      m.position.set(x, -13, z);
      m.rotation.y = ry;
      m.receiveShadow = true;
      this.add(m);
    };
    cliff(W, 0, REGION.maxZ, 0);
    cliff(D, REGION.halfW, (REGION.minZ + REGION.maxZ) / 2, Math.PI / 2);
    cliff(D, -REGION.halfW, (REGION.minZ + REGION.maxZ) / 2, -Math.PI / 2);
    this.box(W, 0.4, 0.5, this.mat.stoneMoss, 0, -0.15, REGION.maxZ - 0.2, { cast: false });
  }

  buildWalls() {
    const r = rng(this.seed + 42);
    const H = 5.2;
    const frost = this.biomeKey === 'frost';
    const snow = this.mat.snow;
    for (const side of [-1, 1]) {
      const x0 = 3.9;
      const x1 = 16.2;
      this.box(x1 - x0, H, 1.1, this.mat.stone, side * (x0 + x1) / 2, H / 2, -10.05);
      if (frost) this.box(x1 - x0, 0.18, 1.2, snow, side * (x0 + x1) / 2, H + 0.08, -10.05, { cast: false });
      for (let x = x0 + 0.4; x < x1; x += 1.5) {
        if (r() < 0.22) continue;
        const h = 0.7 + r() * 0.5;
        this.box(0.8, h, 1.1, this.mat.stone, side * x, H + h / 2, -10.05);
        if (frost) this.box(0.86, 0.14, 1.16, snow, side * x, H + h + 0.06, -10.05, { cast: false });
      }
      const buttresses = side < 0 ? [7.0, 13.8] : [7.0];
      for (const bx of buttresses) {
        this.box(1.0, 6.8, 1.4, this.mat.stoneMoss, side * bx, 3.4, -9.3);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 4), this.mat.slate);
        cap.position.set(side * bx, 7.6, -9.3);
        cap.rotation.y = Math.PI / 4;
        cap.castShadow = true;
        this.add(cap);
        this.block(side * bx - 0.6, -10, side * bx + 0.6, -8.5);
      }
    }
    this.block(-16.5, -11.2, -3.0, -9.4);
    this.block(3.0, -11.2, 16.5, -9.4);

    // ruined side walls, open where the bridges come in
    for (const side of [-1, 1]) {
      for (let z = -10.6; z < -1.8; z += 1.5) {
        const t = (z + 10.6) / 8.8;
        const h = Math.max(0.8, 5.0 - t * 3.2 + (r() - 0.5) * 1.2);
        this.box(1.0, h, 1.55, t > 0.5 ? this.mat.stoneMoss : this.mat.stone, side * 15.7, h / 2, z + 0.75);
        if (frost) this.box(1.06, 0.14, 1.6, snow, side * 15.7, h + 0.06, z + 0.75, { cast: false });
      }
      this.block(side * 15.1, -11, side * 16.5, -1.6);
      for (let z = 3.0; z < 6.6; z += 1.4) {
        if (r() < 0.35) continue;
        const h = 0.5 + r() * 1.3;
        this.box(1.0, h, 1.3, this.mat.stoneMoss, side * 15.7, h / 2, z + 0.6);
      }
      this.block(side * 15.1, 2.9, side * 16.5, 6.8);
    }

    // broken front wall fragments
    for (const side of [-1, 1]) {
      for (let x = 8.5; x < 15.5; x += 1.2) {
        if (r() < 0.3) continue;
        const h = 0.4 + r() * 0.9;
        this.box(1.2, h, 0.9, this.mat.stoneMoss, side * x, h / 2, 9.3, { ry: (r() - 0.5) * 0.1 });
      }
      this.block(side * 8.0, 8.8, side * 16.2, 9.9);
    }

    // windows glowing faintly in the back wall
    const winTex = T.pixelTexture(T.windowCanvas());
    this.windowMat = new THREE.MeshBasicMaterial({ map: winTex, color: new THREE.Color(1.3, 1.0, 0.75) });
    for (const x of [-8.6, 8.6]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), this.windowMat);
      w.position.set(x, 3.3, -9.48);
      this.add(w);
    }
  }

  buildGate() {
    const outer = new THREE.Shape();
    outer.moveTo(-3.9, 0);
    outer.lineTo(-3.9, 8.6);
    outer.lineTo(0, 11.8);
    outer.lineTo(3.9, 8.6);
    outer.lineTo(3.9, 0);
    outer.lineTo(-3.9, 0);
    const hole = new THREE.Path();
    const w = 4.4;
    hole.moveTo(-w / 2, 0);
    hole.lineTo(-w / 2, 4);
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI - (i / 12) * (Math.PI / 3);
      hole.lineTo(w / 2 + Math.cos(a) * w, 4 + Math.sin(a) * w);
    }
    for (let i = 12; i >= 0; i--) {
      const a = (i / 12) * (Math.PI / 3);
      hole.lineTo(-w / 2 + Math.cos(a) * w, 4 + Math.sin(a) * w);
    }
    hole.lineTo(w / 2, 4);
    hole.lineTo(w / 2, 0);
    hole.lineTo(-w / 2, 0);
    outer.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(outer, { depth: 1.6, bevelEnabled: false });
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / BRICK_TILE, uv.getY(i) / BRICK_TILE);
    const gate = new THREE.Mesh(geo, this.mat.stone);
    gate.position.set(0, 0, -10.9);
    gate.castShadow = true;
    gate.receiveShadow = true;
    this.add(gate);
    for (const side of [-1, 1]) {
      const col = new THREE.Mesh(scaleCylUV(new THREE.CylinderGeometry(0.55, 0.65, 9.5, 8), 0.6, 9.5, BRICK_TILE), this.mat.stoneMoss);
      col.position.set(side * 4.3, 4.75, -9.2);
      col.castShadow = true;
      this.add(col);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.2, 8), this.mat.slate);
      cap.position.set(side * 4.3, 10.6, -9.2);
      cap.castShadow = true;
      this.add(cap);
      this.blockCircle(side * 4.3, -9.2, 0.8);
    }
    this.fogUniforms = { uTime: { value: 0 }, uIntensity: { value: 0.75 } };
    const fog = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 7.8), new THREE.ShaderMaterial({
      vertexShader: UV_VERT, fragmentShader: FOG_FRAG, uniforms: this.fogUniforms,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    fog.position.set(0, 3.9, -10.2);
    fog.renderOrder = 4;
    this.add(fog);
    this.lights.gate = this.light(0, 2.5, -8.6, '#c8ccd8', 8, 1.6);
  }

  buildGrace() {
    const [gx, gz] = STATIONS.grace.pos;
    const r = rng(this.seed + 7);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const s = 0.22 + r() * 0.15;
      this.box(s * 1.4, s, s, this.mat.stoneMoss, gx + Math.cos(a) * 0.75, s / 2, gz + Math.sin(a) * 0.6, { ry: r() * 3, tile: 1 });
    }
    this.blockCircle(gx, gz, 0.9);
    const core = this.additiveSprite('#ffcf6b', 1.1, 0.7);
    core.position.set(gx, 0.55, gz);
    const halo = this.additiveSprite('#ffb347', 3.6, 0.18);
    halo.position.set(gx, 0.8, gz);
    const pillar = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 3.2), new THREE.MeshBasicMaterial({
      map: this.world.tex.pillar, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.1, 0.85, 0.5),
    }));
    pillar.position.set(gx, 1.6, gz);
    this.add(core, halo, pillar);
    // the grace itself, a figure of golden light floating over its flame
    this.grace = { core, halo, pillar, figure: new GraceFigure(this.group, gx, 1.65, gz, 1.4) };
    this.lights.grace = this.light(gx, 2.2, gz, '#ffb347', 12, 1.2);
    this.ambient(7, () => (this.lit(seedOf(this.slot, 20)) < 0.3 ? null : {
      pos: [this.wx(gx), 0.3, this.wz(gz)], spread: [0.35, 0.1, 0.3], vel: [0, 0.7, 0], velSpread: [0.15, 0.25, 0.15],
      color: ['#ffd27a', '#ffe7a8', '#ffb347'], size: 0.06, life: 2.4, drag: 0.4, intensity: 1.2,
    }));
  }

  buildForge() {
    const fx = -10.6, fz = -8.2;
    this.box(3.4, 2.8, 2.2, this.mat.stone, fx, 1.4, fz);
    this.box(3.8, 0.4, 2.5, this.mat.stoneMoss, fx, 2.95, fz);
    this.box(1.3, 4.6, 1.3, this.mat.stone, fx - 0.7, 5.4, fz - 0.3);
    this.box(1.6, 0.3, 1.6, this.mat.stoneMoss, fx - 0.7, 7.8, fz - 0.3);
    this.block(fx - 1.9, fz - 1.3, fx + 1.9, fz + 1.2);
    this.forgeMouth = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.6, 0.15) }));
    this.forgeMouth.position.set(fx + 0.3, 0.75, fz + 1.11);
    this.forgeAt = { x: fx + 0.3, z: fz + 1.11 }; // where its fire burns (lightFires)
    this.add(this.forgeMouth);
    const [ax, az] = STATIONS.forge.pos;
    this.box(0.5, 0.55, 0.45, this.mat.iron, ax, 0.27, az, { tile: 1 });
    this.box(1.1, 0.25, 0.5, this.mat.iron, ax, 0.66, az, { tile: 1 });
    this.box(0.35, 0.18, 0.3, this.mat.iron, ax + 0.7, 0.68, az, { tile: 1 });
    this.box(0.9, 0.3, 0.7, this.mat.wood, ax, 0.05, az, { tile: 1 });
    this.block(ax - 0.7, az - 0.4, ax + 0.9, az + 0.4);
    this.anvilTop = new THREE.Vector3(this.wx(ax + 0.2), 0.85, this.wz(az));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.9, 10), this.mat.wood);
    barrel.position.set(-6.3, 0.45, -7.0);
    barrel.castShadow = true;
    this.add(barrel);
    this.blockCircle(-6.3, -7.0, 0.55);
    for (let i = 0; i < 4; i++) this.box(0.08, 1.6, 0.08, this.mat.wood, -14.2 + i * 0.35, 0.8, -6.4, { tile: 1, rz: (i - 1.5) * 0.08 });
    this.box(1.6, 0.1, 0.12, this.mat.wood, -13.7, 1.3, -6.4, { tile: 1 });
    this.block(-14.5, -6.7, -12.8, -6.1);
    this.lights.forge = this.light(fx + 0.3, 1.2, fz + 1.8, '#ff6a1f', 12, 1.4);
    this.forgeSmoke = {};
    this.ambient(2, () => (this.lit(seedOf(this.slot, 1)) < 0.3 ? null : {
      pos: [this.wx(fx - 0.7), 8.2, this.wz(fz - 0.3)], spread: [0.4, 0.1, 0.4], vel: [0.2, 1.2, 0], velSpread: [0.2, 0.3, 0.2],
      color: ['#ff8a3a', '#ffb347'], size: 0.06, life: 3, drag: 0.2, flicker: 1, intensity: 1.5,
    }));
  }

  buildScriptorium() {
    const shelf = (x, z, w, tex) => {
      const h = 2.6;
      const mats = [this.mat.wood, this.mat.wood, this.mat.wood, this.mat.wood, new THREE.MeshLambertMaterial({ map: tex }), this.mat.wood];
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.7), mats);
      m.position.set(x, h / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.add(m);
    };
    shelf(-12.9, -1.0, 2.6, this.world.tex.shelfA);
    shelf(-10.4, -1.0, 1.8, this.world.tex.shelfB);
    this.block(-14.3, -1.4, -9.4, -0.6);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), new THREE.MeshLambertMaterial({ map: this.world.tex.rug }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-11.6, 0.01, 1.3);
    rug.receiveShadow = true;
    this.add(rug);
    const lx = -11.6, lz = 1.9;
    this.box(0.25, 1.0, 0.25, this.mat.wood, lx, 0.5, lz, { tile: 1 });
    this.box(0.9, 0.08, 0.6, this.mat.wood, lx, 1.05, lz, { tile: 1, rx: -0.35 });
    const book = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshLambertMaterial({ color: '#d9cfb0', emissive: '#2a2418' }));
    book.position.set(lx, 1.12, lz + 0.02);
    book.rotation.x = -1.22;
    this.add(book);
    this.block(lx - 0.4, lz - 0.35, lx + 0.4, lz + 0.35);
    this.candles = [];
    const cx = -13.8, cz = 3.2;
    this.box(0.12, 1.3, 0.12, this.mat.iron, cx, 0.65, cz, { tile: 1 });
    this.box(0.6, 0.06, 0.25, this.mat.iron, cx, 1.3, cz, { tile: 1 });
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 6), this.world.mat.wax);
      c.position.set(cx - 0.2 + i * 0.2, 1.44, cz);
      const f = this.additiveSprite('#ffb347', 0.28, 0.9);
      f.position.set(cx - 0.2 + i * 0.2, 1.62, cz);
      this.add(c, f);
      this.candles.push(f);
    }
    this.blockCircle(cx, cz, 0.4);
    this.lights.scriptorium = this.light(-12.4, 2.0, 1.8, '#ffb070', 7, 1.5);
  }

  buildTable() {
    const [tx, tz] = STATIONS.table.pos;
    this.box(2.6, 0.12, 1.3, this.mat.wood, tx, 0.95, tz, { tile: 1 });
    for (const [dx, dz] of [[-1.15, -0.5], [1.15, -0.5], [-1.15, 0.5], [1.15, 0.5]]) this.box(0.12, 0.9, 0.12, this.mat.wood, tx + dx, 0.45, tz + dz, { tile: 1 });
    const map = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.0), new THREE.MeshLambertMaterial({ map: this.world.tex.parchment }));
    map.rotation.x = -Math.PI / 2;
    map.rotation.z = 0.06;
    map.position.set(tx, 1.02, tz);
    map.receiveShadow = true;
    this.add(map);
    this.box(0.1, 0.25, 0.1, this.world.mat.wax, tx + 1.0, 1.13, tz - 0.4, { tile: 1 });
    this.tableFlame = this.additiveSprite('#ffb347', 0.3, 0.9);
    this.tableFlame.position.set(tx + 1.0, 1.33, tz - 0.4);
    this.add(this.tableFlame);
    this.block(tx - 1.35, tz - 0.7, tx + 1.35, tz + 0.7);
  }

  buildRitual() {
    const [rx, rz] = STATIONS.ritual.pos;
    this.ritualMat = new THREE.MeshBasicMaterial({
      map: this.world.tex.runes, color: new THREE.Color(1.6, 0.25, 0.35), transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const circle = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), this.ritualMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(rx, 0.03, rz);
    circle.renderOrder = 3;
    this.add(circle);
    this.ritualCircle = circle;
    const r = rng(this.seed + 13);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const h = 1.2 + r() * 1.0;
      const sx = rx + Math.cos(a) * 2.75;
      const sz = rz + Math.sin(a) * 2.3;
      this.box(0.55, h, 0.4, this.mat.stoneMoss, sx, h / 2, sz, { ry: a, rz: (r() - 0.5) * 0.15, tile: 1 });
      this.blockCircle(sx, sz, 0.45);
    }
    this.lights.ritual = this.light(rx, 1.0, rz, '#d0304a', 9, 1.4);
  }

  buildTower() {
    const [tx, tz] = STATIONS.tower.pos;
    const R = 1.9, H = 10;
    const SIDES = 10;
    const TURN = Math.PI / SIDES; // a flat face, not a corner, toward the viewer (the door sits on it)
    const body = new THREE.Mesh(scaleCylUV(new THREE.CylinderGeometry(R, R * 1.08, H, SIDES), R, H, BRICK_TILE), this.mat.stone);
    body.position.set(tx, H / 2, tz);
    body.rotation.y = TURN;
    body.castShadow = true;
    body.receiveShadow = true;
    const ledge = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.35, R + 0.35, 0.4, SIDES), this.mat.stoneMoss);
    ledge.position.set(tx, H, tz);
    ledge.rotation.y = TURN;
    ledge.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(R + 0.6, 4.0, SIDES), this.biomeKey === 'frost' ? this.mat.snow : this.mat.slate);
    roof.position.set(tx, H + 2.2, tz);
    roof.rotation.y = TURN;
    roof.castShadow = true;
    this.add(body, ledge, roof);
    this.blockCircle(tx, tz, R + 0.4);
    // the front face's distance from the axis at height y (the tower narrows as it rises)
    const face = (y) => (R * 1.08 - (R * 0.08 * y) / H) * Math.cos(TURN);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.8), this.world.mat.doorway);
    door.position.set(tx, 0.9, tz + face(0.9) + 0.03);
    this.towerWindowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.7, 0.3) });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.0), this.towerWindowMat);
    win.position.set(tx, H - 2.0, tz + face(H - 2.0) + 0.03);
    this.add(door, win);
    for (let i = 0; i < 3; i++) {
      const tex = this.world.tex.raven.clone();
      tex.repeat.set(0.5, 1);
      tex.offset.set(0.5, 0);
      tex.needsUpdate = true;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.1 }));
      s.scale.set(0.75, 0.25, 1);
      const a = 0.8 + i * 0.9;
      s.position.set(this.wx(tx + Math.cos(a) * (R + 0.25)), H + 0.35, this.wz(tz + Math.sin(a) * (R + 0.25)));
      s.userData = { home: s.position.clone(), tex, flying: false, t: 0 };
      this.world.scene.add(s);
      this.ravens.push(s);
    }
  }

  buildBell() {
    const bx = 4.2, bz = -7.8;
    for (const side of [-1, 1]) {
      const post = this.box(0.22, 2.9, 0.22, this.mat.wood, bx + side * 0.85, 1.45, bz, { tile: 1 });
      post.rotation.z = side * 0.05;
    }
    this.box(2.1, 0.22, 0.26, this.mat.wood, bx, 2.85, bz, { tile: 1 });
    const pivot = new THREE.Group();
    pivot.position.set(bx, 2.75, bz);
    const bell = new THREE.Mesh(this.world.geo.bell, this.world.mat.bronze);
    bell.castShadow = true;
    pivot.add(bell);
    this.add(pivot);
    this.bell = pivot;
    this.block(bx - 1.1, bz - 0.3, bx + 1.1, bz + 0.3);
  }

  buildBanners() {
    const tex = T.pixelTexture(T.bannerCanvas(this.cloth, hashStr(this.project) % 4));
    this.banners = [-5.2, 5.2].map((x, i) => {
      const b = this.bannerMesh(tex, i * 1.7);
      b.mesh.position.set(x, 5.2, -9.45);
      this.add(b.mesh);
      return b;
    });
  }

  buildTorches() {
    this.torches = [];
    for (const x of [-7.0, 7.0]) {
      this.box(0.12, 0.5, 0.12, this.mat.iron, x, 3.0, -8.5, { tile: 1, rx: 0.4 });
      const flame = this.additiveSprite('#ff9a3a', 0.7, 0.95);
      flame.position.set(x, 3.4, -8.3);
      this.add(flame);
      const light = this.light(x, 3.4, -7.8, '#ff8a3a', 9, 1.6);
      const i = this.torches.length;
      this.torches.push({ flame, light, phase: x * 3.1 + this.slot, x });
      this.ambient(1.5, () => (this.lit(seedOf(this.slot, 30 + i)) < 0.3 ? null : {
        pos: [this.wx(x), 3.6, this.wz(-8.3)], spread: [0.08, 0.05, 0.08],
        vel: [0, 0.9, 0], velSpread: [0.15, 0.3, 0.15], color: ['#ff9a3a', '#ffd27a'], size: 0.05, life: 1.2, flicker: 1, intensity: 1.6,
      }));
    }
  }

  // --------------------------------------------------------------------------------------------
  // biome dressing

  tree(x, z, scale, kind) {
    const r = rng(this.seed + Math.round(x * 13 + z * 7));
    const g = new THREE.Group();
    const bark = kind === 'golden' ? this.world.mat.barkPale : this.biomeKey === 'crimson' ? this.world.mat.barkRed : this.mat.bark;
    if (kind === 'dead') {
      const branch = (len, rad, depth) => {
        const geo = new THREE.CylinderGeometry(rad * 0.6, rad, len, 5);
        geo.translate(0, len / 2, 0);
        const m = new THREE.Mesh(scaleCylUV(geo, rad, len, 1), bark);
        m.castShadow = true;
        if (depth > 0) {
          const n = depth > 2 ? 2 : 2 + (r() < 0.5 ? 1 : 0);
          for (let i = 0; i < n; i++) {
            const c = branch(len * (0.55 + r() * 0.2), rad * 0.6, depth - 1);
            c.position.y = len * (0.7 + r() * 0.3);
            c.rotation.z = (r() - 0.5) * 1.6;
            c.rotation.x = (r() - 0.5) * 0.8;
            m.add(c);
          }
        }
        return m;
      };
      g.add(branch(2.2 * scale, 0.22 * scale, 3));
    } else if (kind === 'pine') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.2 * scale, 1.6 * scale, 6), bark);
      trunk.position.y = 0.8 * scale;
      trunk.castShadow = true;
      g.add(trunk);
      for (let i = 0; i < 3; i++) {
        const rad = (1.3 - i * 0.32) * scale;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, 1.5 * scale, 7), this.world.mat.pine);
        cone.position.y = (1.4 + i * 0.9) * scale;
        cone.castShadow = true;
        g.add(cone);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.55, 0.5 * scale, 7), this.mat.snow);
        cap.position.y = (1.95 + i * 0.9) * scale;
        g.add(cap);
      }
    } else {
      const trunk = new THREE.Mesh(scaleCylUV(new THREE.CylinderGeometry(0.16 * scale, 0.26 * scale, 2.0 * scale, 6), 0.2, 2, 1), bark);
      trunk.position.y = 1.0 * scale;
      trunk.castShadow = true;
      g.add(trunk);
      const leaf = kind === 'golden' ? this.world.mat.leafGold : this.world.mat.leaf;
      for (let i = 0; i < 4; i++) {
        const blob = new THREE.Mesh(this.world.geo.blob, leaf);
        const s = (0.8 + r() * 0.5) * scale;
        blob.scale.set(s, s * 0.8, s);
        blob.position.set((r() - 0.5) * 1.2 * scale, (2.2 + r() * 0.8) * scale, (r() - 0.5) * 1.0 * scale);
        blob.rotation.set(r() * 3, r() * 3, 0);
        blob.castShadow = true;
        g.add(blob);
      }
    }
    g.position.set(x, 0, z);
    g.rotation.y = r() * 6;
    this.add(g);
    this.blockCircle(x, z, 0.45);
  }

  pool(x, z, w, d, deep, shine, dayDeep) {
    const u = {
      uTime: this.world.uTime, uDay: this.world.uDay, uTexels: { value: new THREE.Vector2(w * T.TEXELS, d * T.TEXELS) },
      uDeep: { value: new THREE.Color(deep) }, uDayDeep: { value: new THREE.Color(dayDeep) }, uShine: { value: new THREE.Color(shine) },
    };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.ShaderMaterial({
      vertexShader: UV_VERT, fragmentShader: POOL_FRAG, uniforms: u, transparent: true, depthWrite: false,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02, z);
    m.renderOrder = 2;
    this.add(m);
  }

  buildDecor() {
    const r = rng(this.seed + 555);
    const b = this.biome;
    const trees = [[-9.4, 6.8, 1.15], [13.0, 5.2, 1.0], [-14.0, 7.4, 0.9]];
    for (const [x, z, s] of trees) this.tree(x, z, s, b.tree);

    if (b.decor === 'graves' || b.decor === 'rot') {
      const graves = [[4.6, 5.8], [6.0, 6.8], [7.6, 5.6], [5.4, 7.8], [9.4, 7.2], [10.8, 6.2]];
      for (const [x, z] of graves) {
        const h = 0.6 + r() * 0.4;
        if (r() < 0.5) this.box(0.55, h, 0.15, this.mat.stoneMoss, x, h / 2, z, { ry: (r() - 0.5) * 0.3, rz: (r() - 0.5) * 0.2, tile: 1 });
        else {
          this.box(0.14, h + 0.3, 0.14, this.mat.stone, x, (h + 0.3) / 2, z, { rz: (r() - 0.5) * 0.25, tile: 1 });
          this.box(0.55, 0.13, 0.14, this.mat.stone, x, h * 0.8, z, { tile: 1 });
        }
        this.blockCircle(x, z, 0.35);
      }
      if (b.decor === 'rot') {
        this.pool(1.8, 6.6, 3.2, 1.8, '#3a0c0a', '#c0402a', '#6e1610');
        this.pool(12.4, 2.8, 2.4, 1.5, '#3a0c0a', '#c0402a', '#6e1610');
      }
    }
    if (b.decor === 'flowers') {
      for (const [x, z] of [[5.2, 6.4], [9.6, 6.8], [2.6, 7.6], [11.6, 3.2]]) {
        const bush = new THREE.Mesh(this.world.geo.blob, this.world.mat.leaf);
        const s = 0.55 + r() * 0.3;
        bush.scale.set(s * 1.3, s * 0.8, s);
        bush.position.set(x, s * 0.45, z);
        bush.castShadow = true;
        this.add(bush);
        this.blockCircle(x, z, s * 0.8);
      }
    }
    if (b.decor === 'cairns') {
      for (const [x, z] of [[5.0, 6.2], [9.8, 7.0], [11.4, 3.4], [2.4, 7.6]]) {
        let y = 0;
        for (let k = 0; k < 4; k++) {
          const s = 0.5 - k * 0.09;
          this.box(s * 1.2, s * 0.6, s, this.mat.stone, x + (r() - 0.5) * 0.08, y + s * 0.3, z, { ry: r() * 3, tile: 1 });
          y += s * 0.6;
        }
        this.box(0.32, 0.08, 0.28, this.mat.snow, x, y + 0.02, z, { tile: 1, cast: false });
        this.blockCircle(x, z, 0.45);
      }
    }
    if (b.decor === 'crystals') {
      this.crystals = [];
      for (const [x, z] of [[5.4, 6.0], [10.2, 6.8], [11.8, 3.0], [2.2, 7.4]]) {
        for (let k = 0; k < 4; k++) {
          const c = new THREE.Mesh(this.world.geo.crystal, this.world.mat.crystal);
          const s = 0.4 + r() * 0.5;
          c.scale.set(s * 0.5, s * 1.6, s * 0.5);
          c.position.set(x + (r() - 0.5) * 0.7, s * 0.7, z + (r() - 0.5) * 0.5);
          c.rotation.set((r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6);
          this.add(c);
        }
        this.blockCircle(x, z, 0.6);
        this.ambient(1, () => ({
          pos: [this.wx(x), 0.8, this.wz(z)], spread: [0.4, 0.4, 0.3], vel: [0, 0.3, 0], velSpread: [0.1, 0.1, 0.1],
          color: ['#7fc8ff', '#b4e2ff'], size: 0.05, life: 2.5, intensity: 2,
        }));
      }
      this.pool(1.6, 6.8, 3.6, 2.0, '#0b1a28', '#5a9ad8', '#3c74ab');
    }
    if (b.decor === 'statues') {
      for (const [x, z, face] of [[4.8, 6.4, -1], [10.6, 6.4, 1]]) {
        this.box(1.0, 0.8, 1.0, this.mat.stone, x, 0.4, z, { tile: 1 });
        this.box(0.5, 1.1, 0.35, this.mat.stoneMoss, x, 1.35, z, { tile: 1 });
        this.box(0.32, 0.32, 0.3, this.mat.stoneMoss, x + face * 0.03, 2.06, z, { tile: 1 });
        this.box(0.12, 1.2, 0.12, this.world.mat.gold, x + face * 0.38, 1.4, z + 0.05, { tile: 1, rz: face * -0.15 });
        this.blockCircle(x, z, 0.75);
      }
    }
    if (b.decor === 'graves' || b.decor === 'statues') {
      const col = new THREE.Mesh(scaleCylUV(new THREE.CylinderGeometry(0.45, 0.45, 3.2, 8), 0.45, 3.2, BRICK_TILE), this.mat.stoneMoss);
      col.rotation.z = Math.PI / 2;
      col.rotation.y = 0.5;
      col.position.set(3.4, 0.45, 2.8);
      col.castShadow = true;
      col.receiveShadow = true;
      this.add(col);
      this.block(2.1, 2.1, 4.7, 3.5);
    }

    // rubble along the walls
    for (let i = 0; i < 26; i++) {
      const alongBack = r() < 0.45;
      const side = r() < 0.5 ? -1 : 1;
      const x = alongBack ? side * (4.6 + r() * 10.5) : side * (14.6 + r() * 0.6);
      const z = alongBack ? -9.2 - r() * 0.3 : (r() < 0.5 ? -8.5 + r() * 6 : 3 + r() * 5);
      if (Math.hypot(x - 11.8, z + 6.8) < 2.6 || (x < -8.6 && x > -12.6 && z < -6.6)) continue;
      const s = 0.15 + r() * 0.3;
      this.box(s * 1.3, s, s, r() < 0.5 ? this.mat.stone : this.mat.stoneMoss, x, s / 2, z, { ry: r() * 3, rx: (r() - 0.5) * 0.4, tile: 1 });
    }

    // grass tufts as billboards, instanced per texture
    const dummy = new THREE.Object3D();
    const count = b.decor === 'flowers' ? 50 : 30;
    this.world.tuftMats(this.biomeKey).forEach((mat) => {
      const inst = new THREE.InstancedMesh(this.world.geo.tuft, mat, count);
      let placed = 0;
      for (let i = 0; i < count * 4 && placed < count; i++) {
        const x = (r() - 0.5) * 29;
        const z = -9 + r() * 18;
        const plaza = 1 - Math.hypot(x / 10, (z + 2) / 6.5);
        if (plaza > -0.15 || (Math.abs(x) < 2.4 && z < -3) || Math.abs(z - BRIDGE.z) < 1.4) continue;
        if (this.isBlocked(this.wx(x), this.wz(z), 0.2)) continue;
        dummy.position.set(x, 0, z);
        const s = 0.7 + r() * 0.6;
        dummy.scale.set(s * (r() < 0.5 ? -1 : 1), s, s);
        dummy.updateMatrix();
        inst.setMatrixAt(placed++, dummy.matrix);
      }
      inst.count = placed;
      inst.receiveShadow = true;
      this.add(inst);
    });
  }

  buildShafts() {
    this.shafts = [];
    for (const [x, rot] of [[-8.6, 0.5], [8.6, 0.45]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 8), new THREE.MeshBasicMaterial({
        map: this.world.tex.shaft, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
      m.position.set(x + 1.2, 2.4, -6.9);
      m.rotation.set(-0.95, 0, rot);
      m.renderOrder = 6;
      this.add(m);
      this.shafts.push(m);
    }
  }

  buildParticles() {
    const p = this.biome.particles;
    this.ambient(p.rate, () => ({
      pos: [this.wx((Math.random() - 0.5) * 30), p.falling ? 5 + Math.random() * 4 : p.low ? Math.random() * 1.5 : 0.3 + Math.random() * 3, this.wz(-9.5 + Math.random() * 19)],
      vel: p.vel, velSpread: [0.2, 0.15, 0.2],
      color: p.colors, size: p.size, life: p.life, drag: 0.05, flicker: p.flicker, intensity: p.intensity,
    }));
  }

  // --------------------------------------------------------------------------------------------
  // reactions

  setActivity(counts) {
    for (const k of Object.keys(this.activity)) this.activity[k] = counts[k] || 0;
  }

  ringBell() {
    this.bellSwing = Math.max(this.bellSwing, 0.6);
  }

  sendRaven() {
    const raven = this.ravens.find((rv) => !rv.userData.flying);
    if (!raven) return;
    const d = raven.userData;
    d.flying = true;
    d.t = 0;
    d.dir = Math.random() < 0.5 ? -1 : 1;
    d.from = raven.position.clone();
  }

  forgeStrike() {
    this.world.particles.emit({
      pos: [this.anvilTop.x, this.anvilTop.y, this.anvilTop.z], spread: [0.1, 0.02, 0.1],
      vel: [0, 2.2, 0], velSpread: [1.8, 1.2, 1.2], color: ['#ffd27a', '#ff9a3a', '#fff1b8'],
      size: 0.06, life: 0.6, gravity: 6, drag: 0.5, count: 14, intensity: 2.2,
    });
    this.forgeFlash = 1;
  }

  update(dt, t) {
    this.fogUniforms.uTime.value = t;
    const lerp = (k, target, speed = 2) => { this.level[k] += (target - this.level[k]) * Math.min(1, dt * speed); return this.level[k]; };
    const forge = lerp('forge', this.activity.forge ? 1 : 0);
    const script = lerp('scriptorium', this.activity.scriptorium ? 1 : 0);
    const ritual = lerp('ritual', this.activity.ritual ? 1 : 0);
    const tower = lerp('tower', this.activity.tower ? 1 : 0);
    const table = lerp('table', this.activity.table ? 1 : 0);
    const gate = lerp('gate', this.activity.gate ? 1 : 0);
    const grace = lerp('grace', Math.min(1, this.activity.grace / 3));
    const flick = (ph, sp = 9) => 0.85 + 0.1 * Math.sin(t * sp + ph) + 0.05 * Math.sin(t * 23 + ph * 2);

    this.forgeFlash = Math.max(0, this.forgeFlash - dt * 5);
    // while a great enemy is abroad its fires and its grace go out, each at its own moment
    // (Builder.lit), the flames sinking into their beds
    const id = this.slot;
    const lf = this.lit(seedOf(id, 1));
    this.smoke(this.forgeSmoke, lf, this.forgeAt.x, 1.1, this.forgeAt.z + 0.2);
    this.lights.forge.intensity = (18 + forge * 30 + this.forgeFlash * 40) * flick(1 + this.slot, 7) * lf;
    const fires = this.fires;
    if (fires) {
      // the mouth a deep ember glow, the fire in it rising and brightening while it's worked
      this.forgeMouth.material.color.setRGB(0.07 + forge * 0.1 + this.forgeFlash * 0.25, 0.012 + forge * 0.02, 0.004).multiplyScalar(lf);
      fires.forge.forEach((f, i) => {
        f.step(dt * (1 + forge * 0.6));
        const k = fires.forgeScales[i] * (0.88 + forge * 0.22 + this.forgeFlash * 0.2) * lf;
        f.mesh.scale.set(k, k, 1);
        f.mesh.visible = lf > 0.02;
        f.mesh.material.color.setScalar(1.1 + forge * 0.4 + this.forgeFlash * 0.6);
      });
      fires.candles.forEach((c, i) => {
        const lc = this.lit(seedOf(id, 10 + i));
        const e = c.flame.step(dt);
        c.flame.mesh.scale.setScalar(lc);
        c.flame.mesh.visible = lc > 0.02;
        c.glow.scale.setScalar(0.4 * (0.85 + 0.15 * e));
        c.glow.material.opacity = 0.22 * lc;
      });
    } else {
      this.forgeMouth.material.color.setRGB(1.0 + forge * 0.8 + this.forgeFlash, 0.4 + forge * 0.3, 0.1).multiplyScalar(lf);
      this.candles.forEach((c, i) => { c.scale.setScalar((0.24 + script * 0.08) * flick(i * 2, 13) * this.lit(seedOf(id, 10 + i))); });
    }
    this.lights.scriptorium.intensity = (6 + script * 12) * flick(2 + this.slot) * this.lit(seedOf(id, 10));
    this.ritualMat.opacity = 0.22 + ritual * 0.7 + Math.sin(t * 2) * 0.05;
    this.ritualCircle.rotation.z = t * (0.05 + ritual * 0.4);
    this.lights.ritual.intensity = ritual * 35 * flick(3, 5);
    this.towerWindowMat.color.setRGB(0.9 + tower * 2.2, 0.55 + tower * 1.1, 0.25 + tower * 0.3);
    if (!fires) this.tableFlame.scale.setScalar((0.26 + table * 0.1) * flick(4, 12) * this.lit(seedOf(id, 13)));
    this.fogUniforms.uIntensity.value = 0.65 + gate * 0.45;
    this.lights.gate.intensity = 4 + gate * 10;
    const gp = 0.92 + 0.08 * Math.sin(t * 2.1 + this.slot);
    const lg = this.lit(seedOf(id, 20));
    this.lights.grace.intensity = (8 + grace * 5) * gp * lg;
    this.grace.core.material.opacity = 0.65 * gp * lg;
    this.grace.halo.material.opacity = (0.14 + grace * 0.1) * gp * lg;
    this.grace.pillar.material.opacity = (0.4 + 0.18 * Math.sin(t * 1.3)) * lg;
    this.grace.figure.update(dt, gp * lg);
    this.torches.forEach((tc, i) => {
      const lt = this.lit(seedOf(id, 30 + i));
      this.smoke(tc, lt, tc.x, 3.5, -8.3);
      if (fires) {
        // the light rises and falls with how much fire the flame's frame holds
        const f = fires.torches[i];
        const e = f.step(dt);
        tc.level = (tc.level ?? 1) + (0.75 + 0.3 * e - (tc.level ?? 1)) * Math.min(1, dt * 12);
        tc.light.intensity = 8 * tc.level * lt;
        tc.flame.scale.set(1.0 * tc.level, 1.1 * tc.level, 1);
        tc.flame.material.opacity = 0.28 * lt;
        f.mesh.scale.setScalar(f.base * lt);
        f.mesh.visible = lt > 0.02;
        return;
      }
      const f = flick(tc.phase, 11);
      tc.light.intensity = 8 * f * lt;
      tc.flame.scale.set(0.6 * f * lt, 0.75 * f * lt, 1);
    });
    this.shafts.forEach((s, i) => { s.material.opacity = 0.045 + 0.02 * Math.sin(t * 0.4 + i * 1.3); });
    if (this.rising) this.stepRise(dt);
    if (this.sinking) this.stepSink(dt);
    if (!this.near) return;
    for (const b of this.banners) this.swayBanner(b, t);

    if (this.activity.gate && Math.random() < dt * 0.25) this.ringBell();
    this.bellSwing *= Math.max(0, 1 - dt * 0.6);
    this.bell.rotation.z = Math.sin(t * 5.5) * this.bellSwing;

    for (const rv of this.ravens) {
      const d = rv.userData;
      if (!d.flying) {
        d.tex.offset.x = 0.5;
        rv.position.y = d.home.y + Math.abs(Math.sin(t * 0.7 + d.home.x)) * 0.02;
        continue;
      }
      d.t += dt;
      const p = d.t / 6;
      d.tex.offset.x = Math.floor(d.t * 8) % 2 ? 0 : 0.5;
      if (p < 1) {
        rv.position.set(d.from.x + d.dir * Math.sin(p * Math.PI) * 9 - p * 6, d.from.y + p * 9 + Math.sin(p * 12) * 0.3, d.from.z - p * 30);
        rv.material.opacity = 1 - Math.max(0, p - 0.7) / 0.3;
      } else if (p < 1.6) {
        rv.material.opacity = 0;
      } else {
        rv.position.copy(d.home);
        rv.material.opacity = Math.min(1, (p - 1.6) * 3);
        if (p > 2) { d.flying = false; rv.material.opacity = 1; }
      }
    }
  }
}
