// The "HD-2D" look: HDR bloom on every light, a tilt-shift blur that keeps the middle of
// the courtyard crisp, then a grade with vignette and grain: cold shadows and old-gold highlights
// by night, fuller and sunnier colour by day (uDay, set by daylight.js). And, before the bloom,
// Fenrath's great attack (fight.js, wrath): the world gone black round what's drawn on it, and
// the shockwaves of his roar bending the picture round his head; and the heat of the frenzied flame
// round Morvane's arena shimmering through it (frenzyfx.js): all DarkShader.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    uDir: { value: new THREE.Vector2(1, 0) },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uFocus: { value: 0.5 },
    uBand: { value: 0.16 },
    uFalloff: { value: 0.32 },
    uMaxBlur: { value: 3.2 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uDir;
    uniform vec2 uResolution;
    uniform float uFocus, uBand, uFalloff, uMaxBlur;
    varying vec2 vUv;
    void main() {
      float d = abs(vUv.y - uFocus);
      float amount = smoothstep(uBand, uBand + uFalloff, d) * uMaxBlur;
      vec2 step = uDir / uResolution * amount;
      vec4 sum = texture2D(tDiffuse, vUv) * 0.2270270270;
      sum += texture2D(tDiffuse, vUv + step * 1.3846153846) * 0.3162162162;
      sum += texture2D(tDiffuse, vUv - step * 1.3846153846) * 0.3162162162;
      sum += texture2D(tDiffuse, vUv + step * 3.2307692308) * 0.0702702703;
      sum += texture2D(tDiffuse, vUv - step * 3.2307692308) * 0.0702702703;
      gl_FragColor = sum;
    }
  `,
};

// The dark of his great attack: the world (tDark: black wherever no character, mark or effect is
// drawn) gone black behind a front spreading out from uDarkAt (uDarkR: its radius, in screen
// heights) and lit again behind another (uLightR); and his roar's shockwaves (uRings: each a ring
// round [x, y] of radius z, pushing the picture out by w and smearing it along the push). The heat
// haze (uHeat, 0..1): the picture wavering a little, as through heat rising, the more toward its
// edges and its foot (where the ring of flame stands), never so much that the fight blurs.
const DarkShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDark: { value: null },
    uDark: { value: 0 },
    uDarkAt: { value: new THREE.Vector2(0.5, 0.5) },
    uDarkR: { value: 0 },
    uLightR: { value: 0 },
    uAspect: { value: 1 },
    uRings: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    uHeat: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tDark;
    uniform float uDark, uDarkR, uLightR, uAspect, uHeat, uTime;
    uniform vec2 uDarkAt;
    uniform vec4 uRings[4];
    varying vec2 vUv;
    void main() {
      vec2 aspect = vec2(uAspect, 1.0);
      vec2 push = vec2(0.0);
      for (int i = 0; i < 4; i++) {
        vec4 R = uRings[i];
        if (R.w <= 0.0) continue;
        vec2 d = (vUv - R.xy) * aspect;
        float len = length(d);
        float band = 1.0 - smoothstep(0.0, 0.03 + 0.09 * R.z, abs(len - R.z));
        if (len > 1e-4) push += d / len / aspect * band * R.w;
      }
      vec2 uv = vUv - push; // (the picture pushed outward)
      if (uHeat > 0.0) {
        // (heat rising: fine waves climbing the picture, crossed by slower ones)
        float edge = smoothstep(0.2, 0.75, length((vUv - 0.5) * aspect));
        float foot = 1.0 - smoothstep(0.0, 0.55, vUv.y);
        float m = uHeat * (0.25 + 0.75 * max(edge, foot));
        vec2 w = vec2(sin(vUv.y * 95.0 - uTime * 7.0 + sin(vUv.x * 31.0 + uTime * 1.7) * 2.0),
                      cos(vUv.x * 73.0 + uTime * 5.0 + sin(vUv.y * 23.0 - uTime * 2.3) * 2.0));
        uv += w * vec2(0.0008, 0.0012) * m;
      }
      vec3 c = texture2D(tDiffuse, uv).rgb;
      if (dot(push, push) > 1e-8) {
        // smeared along the push
        vec2 s = push * 0.7;
        c = c * 0.36 + (texture2D(tDiffuse, uv + s).rgb + texture2D(tDiffuse, uv - s).rgb) * 0.22
          + (texture2D(tDiffuse, uv + s * 2.0).rgb + texture2D(tDiffuse, uv - s * 2.0).rgb) * 0.1;
      }
      if (uDark > 0.0) {
        float r = length((vUv - uDarkAt) * aspect);
        float fall = 1.0 - smoothstep(uDarkR - 0.14, uDarkR, r);
        float rise = uLightR > 0.0 ? 1.0 - smoothstep(uLightR - 0.14, uLightR, r) : 0.0;
        c *= 1.0 - uDark * fall * (1.0 - rise) * (1.0 - texture2D(tDark, uv).r);
      }
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tMask: { value: null },
    uTime: { value: 0 },
    uDay: { value: 0 },
    uDesat: { value: 0 },
    uVignette: { value: 0.45 },
    uGrain: { value: 0.035 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: TiltShiftShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tMask;
    uniform float uTime, uDay, uDesat, uVignette, uGrain;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // night: desaturate a touch, push shadows toward slate blue and highlights toward old gold;
      // day: richer colour, cool shadows, sunlit highlights
      c = mix(vec3(l), c, mix(0.86, 1.12, uDay));
      c += mix(vec3(-0.012, 0.0, 0.022), vec3(-0.01, 0.004, 0.018), uDay) * (1.0 - smoothstep(0.0, 0.45, l));
      c += mix(vec3(0.035, 0.018, -0.02), vec3(0.03, 0.022, -0.012), uDay) * smoothstep(0.45, 1.0, l);
      c = pow(max(c, 0.0), vec3(mix(1.06, 1.0, uDay)));
      // an ultimate (ults.js): the world in black and white, but for whoever looses it (tMask)
      if (uDesat > 0.0) {
        float g = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(c, vec3(g * 0.92), uDesat * (1.0 - texture2D(tMask, vUv).r));
      }
      vec2 q = vUv - 0.5;
      q.x *= uResolution.x / uResolution.y * 0.75;
      float v = 1.0 - smoothstep(0.2, 0.85, length(q));
      c *= mix(1.0 - uVignette, 1.0, v);
      c += (hash(vUv * uResolution + fract(uTime) * 100.0) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

// While an ultimate is loosed (ults.js), what keeps its colour is drawn white into a mask: its
// meshes on a layer of their own, each in a white copy of its material (or, a ShaderMaterial with
// a uMask uniform, the material itself told to draw its mask). Whoever stands in front of it is
// drawn there too, in black (so they stay grey), the depth deciding who is in front of whom. The
// dark of his great attack has a mask of its own, of everything drawn but the world: there a soft
// light (a mark on the floor, the ghost sword) counts whole wherever it's drawn (`lit`), its
// light kept rather than dimmed with what's behind it.
const MASK_LAYER = 3;
const masks = { white: new WeakMap(), black: new WeakMap(), lit: new WeakMap() };
function maskOf(src, white = true, lit = false) {
  const kept = masks[lit ? 'lit' : white ? 'white' : 'black'];
  let m = kept.get(src);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ toneMapped: false, depthWrite: true, depthTest: true });
    const rgb = white ? 'vec3(1.0)' : 'vec3(0.0)';
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\n\tdiffuseColor.rgb = ${rgb};`);
    };
    m.customProgramCacheKey = () => `ult-mask-${white}`;
    kept.set(src, m);
  }
  m.map = src.map || null;
  m.side = src.side;
  // (a soft light keeps its softness; a sprite is cut out by its alpha, and hides what's behind it)
  const soft = !!src.transparent && !src.alphaTest;
  m.transparent = soft;
  m.alphaTest = soft ? 0 : src.alphaTest || 0.5;
  m.depthWrite = !soft;
  // (a soft light, lit: whole once it's a little more than faint; gone as it fades out)
  m.opacity = soft ? Math.min(1, (src.opacity ?? 1) * (lit ? 2.5 : 1)) : 1;
  return m;
}

// What the dark of his great attack leaves lit: everything drawn but the world itself (the
// islands, the hub, the arena, the skyline: the groups at the top of the scene; the sky and the
// mist, `world`) and the shadows under the characters (`shade`).
const litByDark = (o) => (o.isMesh || o.isPoints) && o.visible && !o.userData.world && !o.userData.shade;
// (what's loosed on a floor of its own, raised or lowered with it, is in a group of its own at the
// top of the scene, `floor`: the arena's, fight.js, and the training yard's, training.js)
const darkLit = (scene) => scene.children.flatMap((o) => (o.userData.floor ? o.children.filter(litByDark) : litByDark(o) ? [o] : []));

export class Post {
  constructor(renderer, scene, camera) {
    const size = renderer.getSize(new THREE.Vector2());
    Object.assign(this, { renderer, scene, camera });
    this.spot = null; // an ultimate's spotlight: { desat 0..1, meshes kept in colour }
    this.dark = null; // his great attack's dark: { amount 0..1, at: [u, v] on screen, front, light } (fight.js)
    this.rings = []; // his roar's shockwaves: [u, v, radius, push] (fight.js)
    this.heat = 0; // the heat haze round Morvane's arena, 0..1 (frenzyfx.js)
    this.maskRT = new THREE.WebGLRenderTarget(Math.max(1, size.x >> 1), Math.max(1, size.y >> 1));
    this.darkRT = new THREE.WebGLRenderTarget(Math.max(1, size.x >> 1), Math.max(1, size.y >> 1));
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.darkPass = new ShaderPass(DarkShader);
    this.darkPass.uniforms.tDark.value = this.darkRT.texture;
    this.darkPass.enabled = false;
    this.composer.addPass(this.darkPass);
    this.bloom = new UnrealBloomPass(size.clone(), 0.6, 0.55, 0.9);
    this.composer.addPass(this.bloom);
    this.tiltH = new ShaderPass(TiltShiftShader);
    this.tiltV = new ShaderPass(TiltShiftShader);
    this.tiltV.uniforms.uDir.value.set(0, 1);
    this.composer.addPass(this.tiltH);
    this.composer.addPass(this.tiltV);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.grade.uniforms.tMask.value = this.maskRT.texture;
    this.composer.addPass(this.grade);
    this.setSize(size.x, size.y, renderer.getPixelRatio());
  }

  setSize(w, h, ratio) {
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(w, h);
    const rw = w * ratio, rh = h * ratio;
    for (const p of [this.tiltH, this.tiltV]) p.uniforms.uResolution.value.set(rw, rh);
    this.grade.uniforms.uResolution.value.set(rw, rh);
    this.darkPass.uniforms.uAspect.value = rw / Math.max(1, rh);
    for (const rt of [this.maskRT, this.darkRT]) rt.setSize(Math.max(1, Math.round(rw / 2)), Math.max(1, Math.round(rh / 2)));
  }

  // Multisampling of the scene buffer (4 smooths block edges; 0 is much cheaper on weak GPUs).
  setSamples(n) {
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (rt.samples === n) continue;
      rt.samples = n;
      rt.dispose();
    }
  }

  render(dt, t) {
    this.grade.uniforms.uTime.value = t;
    const desat = this.spot?.desat || 0;
    this.grade.uniforms.uDesat.value = desat;
    if (desat > 0) this.renderMask(this.maskRT, this.spot.meshes, this.spot.occluders);
    // his great attack: the dark, and the shockwaves of his roar
    const dark = this.dark?.amount || 0;
    const rings = this.rings || [];
    this.darkPass.enabled = dark > 0 || rings.length > 0 || this.heat > 0;
    if (this.darkPass.enabled) {
      const u = this.darkPass.uniforms;
      u.uDark.value = dark;
      u.uHeat.value = this.heat;
      u.uTime.value = t;
      if (dark > 0) {
        u.uDarkAt.value.set(...this.dark.at);
        u.uDarkR.value = this.dark.front;
        u.uLightR.value = this.dark.light || 0;
        this.renderMask(this.darkRT, darkLit(this.scene), [], true);
      }
      u.uRings.value.forEach((v, i) => (rings[i] ? v.set(...rings[i]) : v.set(0, 0, 0, 0)));
    }
    this.composer.render(dt);
  }

  // A mask (into `target`): white wherever `meshes` are drawn, black elsewhere (and where the
  // `occluders` stand in front of them); `lit`: soft lights count whole (maskOf).
  renderMask(target, meshes, occluders = [], lit = false) {
    const { renderer: r, scene, camera } = this;
    const prev = r.getRenderTarget();
    const clear = r.getClearColor(new THREE.Color());
    const clearAlpha = r.getClearAlpha();
    const { background, fog } = scene;
    const shadows = r.shadowMap.autoUpdate;
    scene.background = null;
    scene.fog = null;
    r.shadowMap.autoUpdate = false;
    const swapped = [];
    const take = (m, white) => {
      if (!m || !m.parent || !m.visible) return;
      const own = m.material.uniforms?.uMask;
      swapped.push([m, m.material, own]);
      if (own) own.value = 1;
      else m.material = maskOf(m.material, white, lit && white);
      m.layers.enable(MASK_LAYER);
    };
    for (const m of meshes) take(m, true);
    for (const m of occluders || []) take(m, false);
    camera.layers.set(MASK_LAYER);
    r.setRenderTarget(target);
    r.setClearColor(0x000000, 1);
    r.clear();
    r.render(scene, camera);
    camera.layers.set(0);
    for (const [m, mat, own] of swapped) {
      if (own) own.value = 0;
      else m.material = mat;
      m.layers.disable(MASK_LAYER);
    }
    scene.background = background;
    scene.fog = fog;
    r.shadowMap.autoUpdate = shadows;
    r.setClearColor(clear, clearAlpha);
    r.setRenderTarget(prev);
  }
}
