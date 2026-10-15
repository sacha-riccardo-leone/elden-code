// The "HD-2D" look: HDR bloom on every light, a tilt-shift blur that keeps the middle of
// the courtyard crisp, then a grade with vignette and grain: cold shadows and old-gold highlights
// by night, fuller and sunnier colour by day (uDay, set by daylight.js).

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
// drawn there too, in black (so they stay grey), the depth deciding who is in front of whom.
const MASK_LAYER = 3;
const masks = { white: new WeakMap(), black: new WeakMap() };
function maskOf(src, white = true) {
  const kept = masks[white ? 'white' : 'black'];
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
  m.opacity = soft ? src.opacity ?? 1 : 1;
  return m;
}

export class Post {
  constructor(renderer, scene, camera) {
    const size = renderer.getSize(new THREE.Vector2());
    Object.assign(this, { renderer, scene, camera });
    this.spot = null; // an ultimate's spotlight: { desat 0..1, meshes kept in colour }
    this.maskRT = new THREE.WebGLRenderTarget(Math.max(1, size.x >> 1), Math.max(1, size.y >> 1));
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
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
    this.maskRT.setSize(Math.max(1, Math.round(rw / 2)), Math.max(1, Math.round(rh / 2)));
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
    if (desat > 0) this.renderMask();
    this.composer.render(dt);
  }

  // The spotlight's mask: white wherever what keeps its colour is drawn, black elsewhere.
  renderMask() {
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
      else m.material = maskOf(m.material, white);
      m.layers.enable(MASK_LAYER);
    };
    for (const m of this.spot.meshes) take(m, true);
    for (const m of this.spot.occluders || []) take(m, false);
    camera.layers.set(MASK_LAYER);
    r.setRenderTarget(this.maskRT);
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
