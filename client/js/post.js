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
    uTime: { value: 0 },
    uDay: { value: 0 },
    uVignette: { value: 0.45 },
    uGrain: { value: 0.035 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: TiltShiftShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uDay, uVignette, uGrain;
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
      vec2 q = vUv - 0.5;
      q.x *= uResolution.x / uResolution.y * 0.75;
      float v = 1.0 - smoothstep(0.2, 0.85, length(q));
      c *= mix(1.0 - uVignette, 1.0, v);
      c += (hash(vUv * uResolution + fract(uTime) * 100.0) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

export class Post {
  constructor(renderer, scene, camera) {
    const size = renderer.getSize(new THREE.Vector2());
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
    this.composer.addPass(this.grade);
    this.setSize(size.x, size.y, renderer.getPixelRatio());
  }

  setSize(w, h, ratio) {
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(w, h);
    const rw = w * ratio, rh = h * ratio;
    for (const p of [this.tiltH, this.tiltV]) p.uniforms.uResolution.value.set(rw, rh);
    this.grade.uniforms.uResolution.value.set(rw, rh);
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
    this.composer.render(dt);
  }
}
