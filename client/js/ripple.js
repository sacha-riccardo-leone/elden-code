// The ground rippling like still water when the Guardian Golem's axe or pole strikes it (golem.js):
// from where it struck, a ring-shaped crest runs outward over the arena floor, two or three lower
// ones following with troughs between, the whole ripple flattening as it spreads and dying out
// at its reach. The floor (arena.js) and whatever lies flat on it (bossfx.js's decals) bend with
// it on the graphics card (`rippling` patches their materials); characters ride it (npc.js,
// fight.js), the same formula evaluated here (`rippleAt`). Only on the arena floor (or the training
// yard's, under its rune rocks: runerocks.js), never at its rim (it meets the lip and the cliff
// there).
//
// One ripple, a distance d from where it began, its front having run out to F:
//   s = F - d (how far behind the front), u = s / length (in wavelengths)
//   height = amp * (1 - u / crests) * sin(2 pi u) * 1 / sqrt(1 + d / 8)    for 0 < u < crests
// so it rises from nothing at the front to its first crest a quarter wavelength behind, then a
// trough, a lower crest, …; `amp` itself fades as the front nears the ripple's reach.

import * as THREE from 'three';

const MAX = 12; // ripples at once (more, and the faintest goes)

const list = []; // { x, z, amp, length, crests, speed, reach, t, front, minor }

export const RIPPLES = {
  uRipA: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) }, // x, z, front, amp now
  uRipB: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) }, // length, crests
  uRipN: { value: 0 },
  uRipArena: { value: new THREE.Vector4(0, 0, -1, 0) }, // its middle (x, z), radius, and `along` (rippleBounds)
  uRipTint: { value: new THREE.Color(0.1, 0.085, 0.06) }, // a hint of dusty light on a crest
};

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Where the arena floor is (arena.js), or the training yard's (yard.js, a pill: `along`, half the
// length of the line down its middle, west to east, its every edge `radius` from that line):
// ripples bend nothing else.
export function rippleBounds(cx, cz, radius, along = 0) {
  RIPPLES.uRipArena.value.set(cx, cz, radius, along);
}

// A ripple from (x, z): its first crest's height, the distance between crests, how many, how fast
// its front runs and how far before it has died away. `minor` ones (a meteor's) give way first.
export function addRipple(x, z, { amp, length = 2.2, crests = 3, speed = 15, reach, minor = false }) {
  if (list.length >= MAX) {
    const i = list.findIndex((r) => r.minor);
    list.splice(i >= 0 ? i : 0, 1);
  }
  const r = { x, z, amp, length, crests, speed, reach, minor, t: 0, front: 0 };
  list.push(r);
  return r;
}

// Each frame (fight.js): the fronts run on; spent ripples go.
export function stepRipples(dt) {
  for (const r of list) {
    r.t += dt;
    r.front = r.speed * r.t;
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    if (r.front > r.reach + r.crests * r.length) list.splice(i, 1);
  }
  const { uRipA, uRipB, uRipN } = RIPPLES;
  list.forEach((r, i) => {
    uRipA.value[i].set(r.x, r.z, r.front, ampOf(r));
    uRipB.value[i].set(r.length, r.crests, 0, 0);
  });
  uRipN.value = list.length;
}

export function clearRipples() {
  list.length = 0;
  RIPPLES.uRipN.value = 0;
}

const ampOf = (r) => r.amp * (1 - smoothstep(0.55 * r.reach, r.reach, r.front));

// The ground's height at (x, z): every ripple under way, none at the floor's rim or off it.
export function rippleAt(x, z) {
  if (!list.length) return 0;
  const [cx, cz, R, along] = RIPPLES.uRipArena.value.toArray();
  const rim = Math.hypot(Math.max(0, Math.abs(x - cx) - along), z - cz);
  if (rim > R) return 0;
  let h = 0;
  for (const r of list) {
    const d = Math.hypot(x - r.x, z - r.z);
    const s = r.front - d;
    if (s <= 0 || s >= r.length * r.crests) continue;
    const u = s / r.length;
    h += ampOf(r) * (1 - u / r.crests) * Math.sin(2 * Math.PI * u) / Math.sqrt(1 + d / 8);
  }
  return h * (1 - smoothstep(R - 1.6, R - 0.2, rim));
}

// The same, on the graphics card.
const GLSL = /* glsl */ `
uniform vec4 uRipA[${MAX}];
uniform vec4 uRipB[${MAX}];
uniform int uRipN;
uniform vec4 uRipArena;
float ripOne(vec2 p, vec4 a, vec4 b) {
  float d = distance(p, a.xy);
  float s = a.z - d;
  if (s <= 0.0 || s >= b.x * b.y) return 0.0;
  float u = s / b.x;
  return a.w * (1.0 - u / b.y) * sin(6.2831853 * u) * inversesqrt(1.0 + d / 8.0);
}
float ripAt(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uRipN) break;
    h += ripOne(p, uRipA[i], uRipB[i]);
  }
  vec2 rq = p - uRipArena.xy;
  float rim = length(vec2(max(0.0, abs(rq.x) - uRipArena.w), rq.y));
  return h * (1.0 - smoothstep(uRipArena.z - 1.6, uRipArena.z - 0.2, rim));
}
`;

// Bends a material's flat mesh (the floor, a mark lying on it) with the ripples. `lit`: it's lit,
// so its slopes turn to the light (and its crests catch a little dusty light of their own).
export function rippling(material, { lit = false } = {}) {
  material.customProgramCacheKey = () => (lit ? 'ripple-lit' : 'ripple');
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, RIPPLES);
    let v = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL}\nvarying float vRipH;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 rpW = (modelMatrix * vec4(position, 1.0)).xyz;
          float rpH = uRipN > 0 ? ripAt(rpW.xz) : 0.0;
          vRipH = rpH;
          transformed += normalize(transpose(mat3(modelMatrix)) * vec3(0.0, 1.0, 0.0)) * rpH;
        }`);
    if (lit) {
      // the slope, from the heights a step either side of here
      v = v.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        if (uRipN > 0) {
          vec3 rnW = (modelMatrix * vec4(position, 1.0)).xyz;
          float e = 0.15;
          float hx = (ripAt(rnW.xz + vec2(e, 0.0)) - ripAt(rnW.xz - vec2(e, 0.0))) / (2.0 * e);
          float hz = (ripAt(rnW.xz + vec2(0.0, e)) - ripAt(rnW.xz - vec2(0.0, e))) / (2.0 * e);
          // (the slope steepened for the light alone, so the bend reads even by night)
          objectNormal = normalize(transpose(mat3(modelMatrix)) * normalize(vec3(-hx * 2.5, 1.0, -hz * 2.5)));
        }`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uRipTint;\nvarying float vRipH;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uRipTint * clamp(vRipH * 1.4, 0.0, 1.0);');
    }
    shader.vertexShader = v;
  };
  return material;
}
