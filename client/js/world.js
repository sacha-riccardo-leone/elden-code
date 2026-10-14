// The world: a chain of floating islands over a misty abyss, spires on the far horizon, under a
// starry night sky or a blue day sky (daylight.js turns one into the other). Roundtable Hold sits
// in the middle; each project gets its own region, created the first time one of its sessions
// appears, joined by stone bridges.
//
// Lights are pooled: every brazier, torch and grace registers a light source, and only the
// dozen closest to the camera become real PointLights, so the world can grow without the
// shaders slowing down. The moon's shadow box follows the camera for the same reason.

import * as THREE from 'three';
import { REGION, HUB, BRIDGE, DOUSE, slotCenterX, innerSlot } from './config.js';
import * as T from './textures.js';
import { rng, hashStr, shade } from './pixel.js';
import { buildRaven } from './sprites.js';
import { BIOMES, BIOME_KEYS } from './biomes.js';
import { Region } from './region.js';
import { Hub } from './hub.js';
import { Arena } from './arena.js';
import { Builder, NOISE_GLSL, UV_VERT, glowTexture, scaleBoxUV, BRICK_TILE } from './build.js';

const LIGHT_POOL = 12;
const BIOME_MEMORY = 'elden-code:biomes';

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// Night: near-black with stars. Day: deep blue overhead paling to haze at the horizon, with soft
// clouds drifting across it. Dusk and dawn: a warm glow along the horizon.
const SKY_FRAG = /* glsl */ `
  uniform float uDay;
  uniform float uDusk;
  uniform float uTime;
  varying vec3 vDir;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  ${NOISE_GLSL}
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 top = vec3(0.004, 0.005, 0.009);
    vec3 haze = vec3(0.014, 0.014, 0.019);
    vec3 abyss = vec3(0.006, 0.006, 0.009);
    vec3 night = h > 0.0 ? mix(haze, top, smoothstep(0.0, 0.5, h)) : mix(haze, abyss, 1.0 - smoothstep(-0.45, 0.0, h));
    vec3 cell = floor(d * 380.0);
    float star = step(0.9975, hash(cell)) * smoothstep(0.05, 0.4, h);
    night += vec3(0.6, 0.65, 0.8) * star * 0.6;
    vec3 col = night;
    if (uDay > 0.0) {
      vec3 day = h > 0.0 ? mix(vec3(0.5, 0.68, 0.92), vec3(0.1, 0.3, 0.8), smoothstep(0.0, 0.55, h)) : mix(vec3(0.5, 0.68, 0.92), vec3(0.2, 0.42, 0.85), smoothstep(0.0, 0.5, -h));
      if (h > 0.01) {
        vec2 p = d.xz / (h + 0.1) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
        float cloud = smoothstep(0.48, 0.78, fbm(p)) * smoothstep(0.01, 0.2, h);
        day = mix(day, vec3(1.0, 0.98, 0.94), cloud * 0.8);
      }
      col = mix(night, day, uDay);
    }
    col += vec3(0.75, 0.3, 0.12) * uDusk * (1.0 - smoothstep(0.0, 0.35, abs(h - 0.02)));
    gl_FragColor = vec4(col, 1.0);
  }
`;

// A sea of slow cloud far below the islands: dark by night; by day white clouds drifting over
// the blue of the sky below.
const MIST_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uDay;
  uniform float uDusk;
  uniform vec2 uOffset;
  varying vec2 vUv;
  ${NOISE_GLSL}
  void main() {
    vec2 p = (vUv * vec2(700.0, 360.0) + uOffset) * 0.025;
    float n = fbm(p + vec2(uTime * 0.02, uTime * 0.012));
    float n2 = fbm(p * 2.3 - vec2(uTime * 0.015, 0.0));
    float m = smoothstep(0.35, 0.9, n * 0.7 + n2 * 0.4);
    vec3 col = mix(vec3(0.008, 0.009, 0.013), vec3(0.05, 0.048, 0.06), m);
    float cloud = smoothstep(0.3, 0.75, n * 0.7 + n2 * 0.4);
    col = mix(col, mix(vec3(0.24, 0.45, 0.85), vec3(0.97, 0.97, 0.99), cloud), uDay);
    col = mix(col, vec3(0.85, 0.48, 0.42) * (0.4 + 0.6 * cloud), uDusk * 0.55); // lit pink at dusk and dawn
    // by day its far edges would show against the sky: fade them out
    vec2 e = min(vUv, 1.0 - vUv);
    float edge = mix(1.0, smoothstep(0.0, 0.3, e.y) * smoothstep(0.0, 0.12, e.x), uDay);
    gl_FragColor = vec4(col, mix(0.55 + 0.4 * m, 0.25 + 0.75 * cloud, uDay) * edge);
  }
`;

function canvasOf(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

export class World {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.uTime = { value: 0 };
    this.uDay = { value: 0 }; // 0 night .. 1 day, for the shaders that change with it (daylight.js)
    this.regions = new Map();
    this.bridges = [];
    this.lightSources = [];
    this.lightPool = [];
    this.lampLevel = 1; // how much the pooled lights count (less by day; see daylight.js)
    this.sunFrom = new THREE.Vector3(-10, 24, -9); // where the moon (or sun) shines from
    this.focus = new THREE.Vector3();
    this.version = 0;
    this.biomeCache = {};
    this.tuftCache = {};
    try { this.biomeMemory = JSON.parse(localStorage.getItem(BIOME_MEMORY) || '{}') || {}; } catch { this.biomeMemory = {}; }
    this.biomeSeen = {}; // design -> when an island last took it (a count of islands made)
    this.biomeTick = 0;
    // While a great enemy is abroad every fire and grace goes out but the arena's (fight.js sets
    // `dousing`); `douse` runs 0..1 as they go out one after another, and back as they're lit again.
    this.dousing = false;
    this.douse = 0;

    this.buildShared();
    this.buildSky();
    this.buildMist();
    this.buildLights();
    this.particles.addAmbient(5, () => ({
      pos: [this.focus.x + (Math.random() - 0.5) * 40, 0.5 + Math.random() * 5, this.focus.z + (Math.random() - 0.5) * 20],
      vel: [0.05, 0.02, 0], velSpread: [0.05, 0.05, 0.05],
      color: ['#9aa3b8', '#c8c0a8'], size: 0.04, life: 9, intensity: 0.5,
    }));
    this.hub = new Hub(this);
    this.arena = new Arena(this);
  }

  // --------------------------------------------------------------------------------------------
  // shared textures, materials and geometry

  buildShared() {
    const px = (c, repeat) => T.pixelTexture(c, repeat ? { repeat: [1, 1] } : {});
    const raven = new THREE.CanvasTexture(buildRaven());
    raven.magFilter = THREE.NearestFilter;
    raven.colorSpace = THREE.SRGBColorSpace;
    const runes = new THREE.CanvasTexture(T.runeCircleCanvas());
    runes.magFilter = THREE.NearestFilter;
    this.tex = {
      glow: glowTexture(),
      pillar: new THREE.CanvasTexture(canvasOf(8, 64, (ctx) => {
        const g = ctx.createLinearGradient(0, 64, 0, 0);
        g.addColorStop(0, 'rgba(255,220,140,0.9)');
        g.addColorStop(1, 'rgba(255,200,110,0)');
        ctx.fillStyle = g;
        ctx.fillRect(2, 0, 4, 64);
      })),
      shaft: new THREE.CanvasTexture(canvasOf(32, 128, (ctx) => {
        const grad = ctx.createLinearGradient(0, 0, 0, 128);
        grad.addColorStop(0, 'rgba(255,220,160,0.55)');
        grad.addColorStop(1, 'rgba(255,220,160,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 128);
        const side = ctx.createLinearGradient(0, 0, 32, 0);
        side.addColorStop(0, 'rgba(0,0,0,1)');
        side.addColorStop(0.3, 'rgba(0,0,0,0)');
        side.addColorStop(0.7, 'rgba(0,0,0,0)');
        side.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = side;
        ctx.fillRect(0, 0, 32, 128);
      })),
      rug: px(canvasOf(48, 32, (rc) => {
        rc.fillStyle = '#3a1418'; rc.fillRect(0, 0, 48, 32);
        rc.fillStyle = '#5a2228'; rc.fillRect(3, 3, 42, 26);
        rc.fillStyle = '#3a1418'; rc.fillRect(6, 6, 36, 20);
        rc.fillStyle = '#8a6a3a';
        for (let i = 0; i < 48; i += 4) { rc.fillRect(i, 1, 2, 1); rc.fillRect(i, 30, 2, 1); }
        rc.fillRect(22, 14, 4, 4);
      })),
      rugRound: px(canvasOf(64, 64, (rc) => {
        const ring = (r, col) => { rc.fillStyle = col; rc.beginPath(); rc.arc(32, 32, r, 0, Math.PI * 2); rc.fill(); };
        ring(32, '#3a1418'); ring(29, '#8a6a3a'); ring(27, '#4a1a1f'); ring(20, '#5a2228'); ring(18, '#8a6a3a'); ring(17, '#3a1418');
      })),
      shelfA: px(T.shelfCanvas(11)),
      shelfB: px(T.shelfCanvas(12)),
      parchment: px(T.parchmentCanvas()),
      runes,
      raven,
      wood: px(T.woodCanvas(), true),
      slate: px(T.slateCanvas(), true),
      bark: px(T.barkCanvas(), true),
    };
    const lambert = (o) => new THREE.MeshLambertMaterial(o);
    this.mat = {
      wood: lambert({ map: this.tex.wood }),
      slate: lambert({ map: this.tex.slate }),
      bark: lambert({ map: this.tex.bark }),
      barkPale: lambert({ map: this.tex.bark, color: '#d8c090' }),
      barkRed: lambert({ map: this.tex.bark, color: '#d07060' }),
      iron: lambert({ color: '#2c2d33' }),
      bronze: lambert({ color: '#8a6630', emissive: '#2a1a08' }),
      gold: lambert({ color: '#b8923a', emissive: '#3a2a08' }),
      wax: lambert({ color: '#d8ccb0' }),
      doorway: lambert({ color: '#120d0a' }),
      // foliage: one colour each, softly shaded
      leaf: lambert({ color: '#3f5c2c' }),
      leafGold: lambert({ color: '#c49a4c', emissive: '#3a2a08' }),
      pine: lambert({ color: '#213526' }),
      crystal: lambert({ color: '#5aa0e8', emissive: '#2a6ac8', emissiveIntensity: 1.3, flatShading: true }),
    };
    const bellPts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      bellPts.push(new THREE.Vector2(0.12 + Math.pow(t, 1.6) * 0.48 + (t > 0.92 ? 0.05 : 0), -t * 1.0));
    }
    const tuft = new THREE.PlaneGeometry(1, 0.75);
    tuft.translate(0, 0.37, 0);
    this.geo = {
      bell: new THREE.LatheGeometry(bellPts, 12),
      blob: new THREE.IcosahedronGeometry(1, 0),
      crystal: new THREE.OctahedronGeometry(0.5, 0),
      tuft,
    };
    for (const g of Object.values(this.geo)) g.userData.shared = true;
  }

  matsFor(key) {
    if (this.biomeCache[key]) return this.biomeCache[key];
    const b = BIOMES[key];
    const seed = hashStr(key);
    const rockBase = b.stone.map((c) => shade(c, -0.35));
    const m = {
      stone: new THREE.MeshLambertMaterial({ map: T.pixelTexture(T.brickCanvas(seed % 97, { moss: 0.12, base: b.stone, mossColors: b.mossColors }), { repeat: [1, 1] }) }),
      stoneMoss: new THREE.MeshLambertMaterial({ map: T.pixelTexture(T.brickCanvas((seed % 97) + 1, { moss: Math.min(1, b.moss + 0.35), base: b.stone, mossColors: b.mossColors }), { repeat: [1, 1] }) }),
      rockTex: T.pixelTexture(T.rockCanvas(seed % 89, rockBase), { repeat: [1, 1] }),
      snow: new THREE.MeshLambertMaterial({ color: '#dfe6ee' }),
      wood: this.mat.wood,
      slate: this.mat.slate,
      bark: this.mat.bark,
      iron: this.mat.iron,
    };
    if (key === 'frost') for (const k of ['stone', 'stoneMoss', 'snow']) this.snowByDay(m[k]);
    this.biomeCache[key] = m;
    return m;
  }

  tuftMats(key) {
    if (!this.tuftCache[key]) {
      this.tuftCache[key] = [1, 2, 3].map((s) => new THREE.MeshLambertMaterial({
        map: T.pixelTexture(T.tuftCanvas(s + hashStr(key) % 50, BIOMES[key].tufts)), alphaTest: 0.5,
      }));
      if (key === 'frost') this.tuftCache[key].forEach((mat) => this.snowByDay(mat));
    }
    return this.tuftCache[key];
  }

  // Snow under the day's sun burns out to plain white (and the bloom makes it glow), so by day
  // its pale colours are toned down and cooled; darker colours (the stone) and the night are
  // untouched. For the Frostbound Heights' ground, walls, tufts and snow caps.
  snowByDay(mat) {
    const uDay = this.uDay;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uDay = uDay;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uDay;')
        .replace('#include <map_fragment>', `#include <map_fragment>
  float snowL = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.62, 0.66, 0.72), uDay * smoothstep(0.3, 0.6, snowL));`);
    };
    mat.customProgramCacheKey = () => 'snow-by-day';
    return mat;
  }

  // --------------------------------------------------------------------------------------------
  // sky, far skyline, mist

  buildSky() {
    this.skyUniforms = { uDay: this.uDay, uDusk: { value: 0 }, uTime: this.uTime };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(600, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: this.skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      }),
    );
    sky.renderOrder = -10;
    this.sky = sky;
    this.scene.add(sky);

    // Dark spires on the far horizon follow the camera like a skybox element, so they always sit
    // in the strip of sky above the walls whatever the zoom.
    const skyline = new THREE.Group();
    const spireMat = new THREE.MeshBasicMaterial({ color: '#0d0e13', fog: false, transparent: true, depthWrite: false });
    this.spireMat = spireMat;
    const sr = rng(99);
    for (let i = 0; i < 14; i++) {
      const x = (i - 7) * 26 + (sr() - 0.5) * 14;
      const h = 30 + sr() * 50;
      const w = 4 + sr() * 6;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), spireMat);
      m.position.set(x, -40 + h / 2 - 20, 120 + sr() * 30);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.75, h * 0.35, 4), spireMat);
      cap.position.set(x, m.position.y + h / 2 + h * 0.17, m.position.z);
      cap.rotation.y = Math.PI / 4;
      skyline.add(m, cap);
    }
    this.skyline = skyline;
    this.scene.add(skyline);
  }

  buildMist() {
    this.mistUniforms = { uTime: this.uTime, uDay: this.uDay, uDusk: { value: 0 }, uOffset: { value: new THREE.Vector2() } };
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(700, 360), new THREE.ShaderMaterial({
      vertexShader: UV_VERT, fragmentShader: MIST_FRAG, uniforms: this.mistUniforms, transparent: true, depthWrite: false,
    }));
    mist.rotation.x = -Math.PI / 2;
    mist.position.y = -16;
    mist.renderOrder = -5;
    this.mist = mist;
    this.scene.add(mist);
  }

  placeSkyElements(camera) {
    this.sky.position.copy(camera.position);
    const pitch = Math.atan2(camera.position.y - camera.userData.target.y, camera.position.z - camera.userData.target.z);
    const topAngle = pitch - THREE.MathUtils.degToRad(camera.fov / 2);
    const dist = 320;
    const y = -Math.tan(topAngle + THREE.MathUtils.degToRad(6.5)) * dist;
    this.skyline.position.set(camera.position.x - 30, camera.position.y + y - 45, camera.position.z - dist);
    this.mist.position.x = Math.round(camera.position.x / 10) * 10;
    this.mist.position.z = Math.round((camera.position.z - 120) / 10) * 10;
    this.mistUniforms.uOffset.value.set(this.mist.position.x, -this.mist.position.z);
  }

  // --------------------------------------------------------------------------------------------
  // lights

  buildLights() {
    this.hemi = new THREE.HemisphereLight('#6a7799', '#2a2119', 2.3);
    this.scene.add(this.hemi);
    const moon = new THREE.DirectionalLight('#9fb2e0', 2.3); // the sun by day
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.bias = -0.0006;
    moon.shadow.normalBias = 0.03;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 80;
    this.scene.add(moon, moon.target);
    this.moon = moon;
    this.shadowHalf = 0;
    const fill = new THREE.DirectionalLight('#7f8fb8', 0.8);
    fill.position.set(4, 10, 24);
    this.scene.add(fill);
    this.fill = fill;
    for (let i = 0; i < LIGHT_POOL; i++) {
      const l = new THREE.PointLight('#ffffff', 0, 10, 1.5);
      l.userData.src = null;
      this.scene.add(l);
      this.lightPool.push(l);
    }
  }

  addLightSource(src) {
    this.lightSources.push(src);
    return src;
  }

  updateLights(focus) {
    const picks = [];
    for (const s of this.lightSources) {
      if (s.intensity <= 0.01) continue;
      const d = Math.hypot(s.pos.x - focus.x, s.pos.z - focus.z);
      if (d > 54) continue;
      const fade = 1 - THREE.MathUtils.smoothstep(d, 34, 52);
      picks.push({ s, fade, w: (s.intensity * fade) / (1 + (d * d) / 400) });
    }
    picks.sort((a, b) => b.w - a.w);
    const chosen = new Map(picks.slice(0, LIGHT_POOL).map((p) => [p.s, p.fade]));
    const free = [];
    for (const l of this.lightPool) {
      if (l.userData.src && chosen.has(l.userData.src)) continue;
      l.userData.src = null;
      free.push(l);
    }
    const taken = new Set(this.lightPool.map((l) => l.userData.src).filter(Boolean));
    for (const s of chosen.keys()) if (!taken.has(s) && free.length) free.pop().userData.src = s;
    for (const l of this.lightPool) {
      const s = l.userData.src;
      if (!s) { l.intensity = 0; continue; }
      l.position.copy(s.pos);
      l.color.copy(s.color);
      l.distance = s.distance;
      l.decay = s.decay;
      l.intensity = s.intensity * (chosen.get(s) ?? 0) * this.lampLevel;
    }
  }

  followShadow(focus, camDist) {
    const half = THREE.MathUtils.clamp(Math.round(camDist * 0.9), 20, 52);
    const sc = this.moon.shadow.camera;
    if (half !== this.shadowHalf) {
      this.shadowHalf = half;
      sc.left = -half; sc.right = half; sc.top = half * 0.8; sc.bottom = -half * 0.8;
      sc.updateProjectionMatrix();
    }
    const snap = (v) => Math.round(v / 0.5) * 0.5;
    const fx = snap(focus.x);
    const fz = snap(focus.z);
    this.moon.position.set(fx + this.sunFrom.x, this.sunFrom.y, fz + this.sunFrom.z);
    this.moon.target.position.set(fx, 0, fz);
  }

  // --------------------------------------------------------------------------------------------
  // islands

  // The design (biome) a new island takes: never one an island already standing has. The
  // project's own (the one it had before, kept across reloads) if that's free; else whichever free
  // one appeared longest ago (or never yet); and with all six standing, the one that appeared
  // longest ago.
  pickBiome(project) {
    const used = new Set([...this.regions.values()].map((r) => r.biomeKey));
    const remembered = this.biomeMemory[project];
    let key;
    if (BIOMES[remembered] && !used.has(remembered)) key = remembered;
    else {
      const free = BIOME_KEYS.filter((k) => !used.has(k));
      const pool = free.length ? free : BIOME_KEYS;
      const start = hashStr(`biome:${project}`) % BIOME_KEYS.length; // (ties: the project's own order)
      const order = (k) => (BIOME_KEYS.indexOf(k) - start + BIOME_KEYS.length) % BIOME_KEYS.length;
      key = [...pool].sort((a, b) => (this.biomeSeen[a] ?? -1) - (this.biomeSeen[b] ?? -1) || order(a) - order(b))[0];
    }
    this.biomeSeen[key] = ++this.biomeTick;
    if (!BIOMES[remembered]) {
      this.biomeMemory[project] = key;
      try { localStorage.setItem(BIOME_MEMORY, JSON.stringify(this.biomeMemory)); } catch {}
    }
    return key;
  }

  regionFor(project) {
    let region = this.regions.get(project);
    if (region) return { region, created: false };
    // the first free place in the chain (an island that sank leaves its place, the outermost, free)
    const used = new Set([...this.regions.values()].map((r) => r.slot));
    let slot = 1;
    while (used.has(slot)) slot += 1;
    region = new Region(this, project, slot, this.pickBiome(project));
    this.regions.set(project, region);
    region.bridge = this.buildBridge(innerSlot(slot), slot, region);
    this.version += 1;
    return { region, created: true };
  }

  regionList() {
    return [...this.regions.values()].sort((a, b) => a.cx - b.cx);
  }

  // Whether no island lies beyond this one (only those may sink: the others hold up a bridge).
  isOutermost(region) {
    return ![...this.regions.values()].some((r) => r.slot === region.slot + 2);
  }

  // An island that has sunk is taken away, with its bridge, lights and particles.
  removeRegion(region) {
    this.regions.delete(region.project);
    this.bridges = this.bridges.filter((b) => b.region !== region);
    if (region.bridge) {
      this.scene.remove(region.bridge);
      region.bridge.traverse((o) => o.geometry?.dispose());
    }
    const lights = new Set(region.ownLights);
    this.lightSources = this.lightSources.filter((s) => !lights.has(s));
    for (const l of this.lightPool) if (lights.has(l.userData.src)) { l.userData.src = null; l.intensity = 0; }
    const ambient = new Set(region.ownAmbient);
    this.particles.ambient = this.particles.ambient.filter((e) => !ambient.has(e));
    region.dispose(this.sharedMaterials());
    this.version += 1;
  }

  // The materials every island shares (never freed with one of them).
  sharedMaterials() {
    const set = new Set();
    const add = (v) => {
      if (!v || typeof v !== 'object' || v.isTexture) return;
      if (v.isMaterial) set.add(v);
      else Object.values(v).forEach(add);
    };
    add(this.mat);
    add(this.biomeCache);
    add(this.tuftCache);
    return set;
  }

  edgeX(slot, towardX) {
    const c = slotCenterX(slot);
    const half = slot === 0 ? HUB.radius - 0.4 : REGION.halfW;
    return c + Math.sign(towardX - c) * half;
  }

  buildBridge(slotA, slotB, region = null) {
    const ca = slotCenterX(slotA);
    const cb = slotCenterX(slotB);
    const x0 = this.edgeX(slotA, cb);
    const x1 = this.edgeX(slotB, ca);
    const lo = Math.min(x0, x1) - 0.4;
    const hi = Math.max(x0, x1) + 0.4;
    const len = hi - lo;
    const mid = (lo + hi) / 2;
    const z = BRIDGE.z;
    const stone = this.matsFor('ashen').stone;
    const moss = this.matsFor('ashen').stoneMoss;
    const g = new THREE.Group();
    const box = (w, h, d, mat, x, y, zz) => {
      const m = new THREE.Mesh(scaleBoxUV(new THREE.BoxGeometry(w, h, d), w, h, d, BRICK_TILE), mat);
      m.position.set(x, y, zz);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    box(len, 0.6, 2.8, stone, mid, -0.28, z);
    box(len * 0.7, 1.4, 1.6, moss, mid, -1.2, z);
    const r = rng(slotB * 31);
    for (const side of [-1, 1]) {
      for (let x = lo + 0.3; x < hi - 0.3; x += 1.1) {
        if (r() < 0.2) continue;
        box(0.9, 0.5 + r() * 0.15, 0.25, moss, x + 0.45, 0.27, z + side * 1.28);
      }
    }
    Builder.prototype.mergeStatic.call({ group: g });
    this.scene.add(g);
    // the walkable strip runs on through each island's gate to its courtyard floor
    this.bridges.push({ x0: lo - 1.6, x1: hi + 1.6, z0: z - BRIDGE.halfWidth, z1: z + BRIDGE.halfWidth, region });
    return g;
  }

  areaAt(x, z) {
    if (this.hub.contains(x, z)) return this.hub;
    if (this.arena.contains(x, z)) return this.arena;
    for (const r of this.regions.values()) if (r.contains(x, z)) return r;
    return null;
  }

  isWalkArea(x, z) {
    if (x * x + z * z <= HUB.walkRadius * HUB.walkRadius) return true;
    if (this.arena.isWalk(x, z)) return true;
    // an island (and its bridge) still below the mist can't be walked on
    for (const r of this.regions.values()) {
      if (!r.risen) continue;
      const w = r.walkRect();
      if (x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ) return true;
    }
    for (const b of this.bridges) {
      if (b.region && !b.region.risen) continue;
      if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return true;
    }
    return false;
  }

  isBlocked(x, z, pad = 0) {
    const area = this.areaAt(x, z);
    return area ? area.isBlocked(x, z, pad) : false;
  }

  extent() {
    let minX = -HUB.radius;
    let maxX = HUB.radius;
    for (const r of this.regions.values()) {
      minX = Math.min(minX, r.cx - REGION.halfW);
      maxX = Math.max(maxX, r.cx + REGION.halfW);
    }
    return { minX, maxX };
  }

  update(dt, t, camera, camDist, hubResting = 0) {
    this.uTime.value = t;
    this.douse = Math.max(0, Math.min(1, this.douse + (this.dousing ? dt / DOUSE.out : -dt / DOUSE.in)));
    this.focus.copy(camera.userData.target);
    this.placeSkyElements(camera);
    const reach = 26 + camDist;
    for (const r of this.regions.values()) {
      r.near = Math.abs(r.cx - this.focus.x) < reach;
      r.update(dt, t);
    }
    this.hub.near = Math.abs(this.focus.x) < reach;
    this.hub.update(dt, t, Math.min(1, hubResting / 3));
    this.arena.update(dt, t);
    this.updateLights(this.focus);
    this.followShadow(this.focus, camDist);
  }
}
