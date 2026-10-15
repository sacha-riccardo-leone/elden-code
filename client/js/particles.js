// One pooled, additive particle system for every spark, ember, mote and rune in the world.
// Particles are small soft squares so they sit well next to the pixel art.

import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.0, aSize * uScale / -mv.z);
    vAlpha = aAlpha;
    vColor = aColor;
  }
`;

const FRAG = /* glsl */ `
  uniform float uMask; // drawing a mask of what keeps its colour (post.js): white
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = max(abs(c.x), abs(c.y));
    float a = vAlpha * (1.0 - smoothstep(0.3, 0.5, d));
    if (a < 0.01) discard;
    gl_FragColor = uMask > 0.5 ? vec4(vec3(a), a) : vec4(vColor * a, a);
  }
`;

export class Particles {
  constructor(scene, max = 4000) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.flicker = new Float32Array(max);
    this.attract = new Array(max).fill(null);

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aColor', this.colAttr);
    geo.setAttribute('aSize', this.sizeAttr);
    geo.setAttribute('aAlpha', this.alphaAttr);
    geo.setDrawRange(0, 0);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: 600 }, uMask: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    this.geo = geo;
    this.tmp = new THREE.Color();
    this.ambient = [];
  }

  setViewport(height, fovDeg) {
    this.material.uniforms.uScale.value = height / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  // opts: pos [x,y,z], spread [x,y,z], vel [x,y,z], velSpread, color (hex or array), size, life, gravity, drag, count, attract
  emit(o) {
    const n = o.count || 1;
    const colors = Array.isArray(o.color) ? o.color : [o.color || '#ffd27a'];
    for (let k = 0; k < n; k++) {
      if (this.count >= this.max) return;
      const i = this.count++;
      const s = o.spread || [0, 0, 0];
      this.pos[i * 3] = o.pos[0] + (Math.random() - 0.5) * 2 * s[0];
      this.pos[i * 3 + 1] = o.pos[1] + (Math.random() - 0.5) * 2 * s[1];
      this.pos[i * 3 + 2] = o.pos[2] + (Math.random() - 0.5) * 2 * s[2];
      const v = o.vel || [0, 0, 0];
      const vs = o.velSpread || [0, 0, 0];
      this.vel[i * 3] = v[0] + (Math.random() - 0.5) * 2 * vs[0];
      this.vel[i * 3 + 1] = v[1] + (Math.random() - 0.5) * 2 * vs[1];
      this.vel[i * 3 + 2] = v[2] + (Math.random() - 0.5) * 2 * vs[2];
      this.tmp.set(colors[Math.floor(Math.random() * colors.length)]);
      this.col[i * 3] = this.tmp.r * (o.intensity || 1);
      this.col[i * 3 + 1] = this.tmp.g * (o.intensity || 1);
      this.col[i * 3 + 2] = this.tmp.b * (o.intensity || 1);
      const size = (o.size || 0.08) * (0.6 + Math.random() * 0.8);
      this.baseSize[i] = size;
      this.size[i] = size;
      const life = (o.life || 1) * (0.7 + Math.random() * 0.6);
      this.life[i] = life;
      this.maxLife[i] = life;
      this.gravity[i] = o.gravity || 0;
      this.drag[i] = o.drag || 0;
      this.flicker[i] = o.flicker || 0;
      this.attract[i] = o.attract || null;
    }
  }

  kill(i) {
    const last = --this.count;
    if (i === last) return;
    for (let a = 0; a < 3; a++) {
      this.pos[i * 3 + a] = this.pos[last * 3 + a];
      this.vel[i * 3 + a] = this.vel[last * 3 + a];
      this.col[i * 3 + a] = this.col[last * 3 + a];
    }
    this.size[i] = this.size[last];
    this.baseSize[i] = this.baseSize[last];
    this.alpha[i] = this.alpha[last];
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
    this.gravity[i] = this.gravity[last];
    this.drag[i] = this.drag[last];
    this.flicker[i] = this.flicker[last];
    this.attract[i] = this.attract[last];
  }

  // Continuous emitters: { rate, emit: () => opts }
  addAmbient(rate, factory) {
    const e = { rate, factory, acc: 0 };
    this.ambient.push(e);
    return e;
  }

  update(dt, t) {
    for (const e of this.ambient) {
      e.acc += e.rate * dt;
      while (e.acc >= 1) {
        e.acc -= 1;
        const o = e.factory(t);
        if (o) this.emit(o);
      }
    }
    for (let i = this.count - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.kill(i); continue; }
      const k = i * 3;
      const at = this.attract[i];
      if (at) {
        const dx = at.x - this.pos[k], dy = at.y - this.pos[k + 1], dz = at.z - this.pos[k + 2];
        const d = Math.hypot(dx, dy, dz) + 0.001;
        this.vel[k] += (dx / d) * at.strength * dt + (-dz / d) * (at.swirl || 0) * dt;
        this.vel[k + 1] += (dy / d) * at.strength * dt;
        this.vel[k + 2] += (dz / d) * at.strength * dt + (dx / d) * (at.swirl || 0) * dt;
        if (d < 0.15) { this.life[i] = Math.min(this.life[i], 0.05); }
      }
      this.vel[k + 1] -= this.gravity[i] * dt;
      const damp = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[k] *= damp; this.vel[k + 1] *= damp; this.vel[k + 2] *= damp;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const p = this.life[i] / this.maxLife[i];
      const fade = Math.min(1, p * 3) * Math.min(1, (1 - p) * 8);
      const fl = this.flicker[i] ? 0.6 + 0.4 * Math.sin(t * 20 + i * 1.7) : 1;
      this.alpha[i] = fade * fl;
      this.size[i] = this.baseSize[i] * (0.5 + 0.5 * p);
    }
    this.geo.setDrawRange(0, this.count);
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }
}
