// Morvane's frenzied flame, as it's drawn in his second form's fight (morvane.js), Sacha's drawings
// (fxart.js) and the game's light:
//   FRENZY       – its colours, white-hot to deep red-orange, his head of flame's (the crescent his
//                  slash throws is drawn in them: bossfx.js, Crescent);
//   FlameBall    – a ball of it in flight, a little copy of his head of flame, its tongues trailing
//                  behind it whichever way it goes;
//   FlameBurst   – a ball of it bursting where it lands: the flash, the full burst, the broken tongues;
//   Fang         – his gold fang thrown, spinning, wreathed in a ball of it (his flame throw);
//   BareFang     – his gold fang thrown bare, spinning, bigger than in his hand so that it's seen,
//                  stuck point-first in the floor where it lands (his fang throw);
//   Eye          – the Frenzied Eye, his head of flame grown huge, its tongues swirling;
//   Dropped      – his sword or his fang, let fall as he's felled, lying on the floor;
//   Inferno      – his arena once he's revealed: the world beyond it gone black, a ring of frenzied
//                  flame all round it, its light, heat shimmering, burning ash drifting.
// Each lights the world round it as it goes (lights.js). Without its drawing, each draws nothing
// (the particles and the light about it are still there).

import * as THREE from 'three';
import { glowing, canvasOf, texture } from './bossfx.js';
import { fxArt } from './fxart.js';
import { flash, carry } from './lights.js';
import { rng } from './pixel.js';

export const FRENZY = {
  core: [255, 253, 192],
  hot: [254, 244, 128],
  red: [252, 203, 37],
  deep: [250, 141, 0],
  dark: [201, 37, 0],
};
export const FRENZY_LIGHT = '#ffb030';

// A plane showing a drawing's frames (`art`), `px` world units to its pixel, its middle at its middle;
// or null without the drawing.
function plane(art, px, order = 6) {
  if (!art) return null;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(art.w * px, art.h * px), glowing(art.frames[0]));
  m.renderOrder = order;
  return m;
}

function drop(scene, m) {
  if (!m) return;
  scene.remove(m);
  m.material.dispose();
  m.geometry.dispose();
}

export class FlameBall {
  // at (x, y, z), `size` across, flying toward `dir` (±1: its tongues trail the other way); `turn`:
  // how far it's turned from flying level (radians; falling, a quarter turn down)
  constructor(scene, x, y, z, { size = 1.6, dir = 1, turn = 0, light = true } = {}) {
    const art = fxArt('morvane-flame-ball');
    this.mesh = plane(art, art ? size / art.w : 1);
    this.art = art;
    if (this.mesh) {
      this.mesh.scale.x = dir;
      this.mesh.rotation.z = turn * dir;
      scene.add(this.mesh);
    }
    this.light = light ? carry(scene, [x, y, z + 0.3], { color: FRENZY_LIGHT, power: 26, reach: 11, waver: 0.6 }) : null;
    Object.assign(this, { scene, t: 0 });
    this.at(x, y, z);
  }

  at(x, y, z) {
    this.mesh?.position.set(x, y, z);
    this.light?.at(x, y, z + 0.3);
  }

  // turned to fly toward `dir`, `turn` from level
  aim(dir, turn = 0) {
    if (!this.mesh) return;
    this.mesh.scale.x = dir;
    this.mesh.rotation.z = turn * dir;
  }

  // Turned to face the camera, flying `angle` (radians, on the screen: 0 to the right, up from there)
  // so that its tongues trail straight behind it, however it goes.
  point(angle, camera) {
    if (!this.mesh) return;
    this.mesh.scale.x = 1;
    this.mesh.quaternion.copy(camera.quaternion);
    this.mesh.rotateZ(angle);
  }

  set opacity(v) {
    if (this.mesh) this.mesh.material.opacity = v;
    if (this.light) this.light.level = v;
  }

  // its tongues flickering (its three drawings, over and over)
  step(dt) {
    this.t += dt;
    if (this.mesh) this.mesh.material.map = this.art.frames[Math.floor(this.t * 12) % this.art.frames.length];
  }

  dispose() {
    this.light?.end(0.1);
    drop(this.scene, this.mesh);
  }
}

export class FlameBurst {
  // at (x, y, z), `size` across: its three drawings played out over `life` seconds, the last fading;
  // its flash of light. Returns false from step once it's over.
  constructor(scene, x, y, z, { size = 3.2, life = 0.5, power = 70, reach = 14 } = {}) {
    const art = fxArt('morvane-flame-burst');
    this.mesh = plane(art, art ? size / art.w : 1);
    this.art = art;
    if (this.mesh) {
      this.mesh.position.set(x, y, z);
      this.mesh.scale.x = Math.random() < 0.5 ? -1 : 1;
      scene.add(this.mesh);
    }
    flash(scene, [x, y, z + 0.4], { color: FRENZY_LIGHT, power, reach, life: life * 1.2, flicker: 0.6, rise: 0.02 });
    Object.assign(this, { scene, life, t: 0 });
  }

  step(dt) {
    this.t += dt;
    const k = this.t / this.life;
    if (this.mesh) {
      const n = this.art.frames.length;
      this.mesh.material.map = this.art.frames[Math.min(n - 1, Math.floor(k * n * 1.3))];
      this.mesh.material.opacity = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
    }
    return this.t < this.life;
  }

  dispose() {
    drop(this.scene, this.mesh);
  }
}

export class Fang {
  // His fang in the air at (x, y, z), spinning, a ball of frenzied flame round it; or stuck in the
  // floor, point down.
  constructor(scene, x, y, z) {
    const art = fxArt('morvane-fang');
    this.mesh = plane(art, 2.31 / 91, 7); // (as big as in his hand: heroes/morvane-flame.js)
    if (this.mesh) scene.add(this.mesh);
    this.ball = new FlameBall(scene, x, y, z, { size: 2.1 });
    Object.assign(this, { scene, spin: 0, stuck: false });
    this.at(x, y, z);
  }

  at(x, y, z) {
    this.mesh?.position.set(x, y, z + 0.05);
    this.ball.at(x, y, z);
  }

  // flying `angle` on the screen (spinning, its flame's tongues trailing behind it: FlameBall.point),
  // or stuck in the floor (still, point down)
  step(dt, angle = 0, camera = null) {
    this.ball.step(dt);
    if (this.stuck) { if (this.mesh) this.mesh.rotation.z = 0; return; }
    if (camera) this.ball.point(angle, camera);
    if (!this.mesh) return;
    this.spin += dt * 18 * (Math.cos(angle) < 0 ? -1 : 1);
    this.mesh.rotation.z = -this.spin;
  }

  set opacity(v) {
    if (this.mesh) { this.mesh.material.transparent = true; this.mesh.material.opacity = v; }
    this.ball.opacity = v;
  }

  dispose() {
    this.ball.dispose();
    drop(this.scene, this.mesh);
  }
}

export class BareFang {
  // His fang alone in the air at (x, y, z), `scale` times as big as in his hand, spinning; or stuck
  // in the floor point-first (`stuck`: its point on the floor, where it's set).
  constructor(scene, x, y, z, scale = 1.6) {
    const art = fxArt('morvane-fang');
    this.mesh = plane(art, (2.31 / 91) * scale, 7);
    this.half = art ? (art.h * (2.31 / 91) * scale) / 2 : 0;
    if (this.mesh) scene.add(this.mesh);
    // (its gold catching his fire's light)
    this.light = carry(scene, [x, y, z + 0.3], { color: '#ffd27a', power: 8, reach: 5 });
    Object.assign(this, { scene, spin: 0, stuck: false });
    this.at(x, y, z);
  }

  at(x, y, z) {
    this.mesh?.position.set(x, this.stuck ? y + this.half * 0.8 : y, z);
    this.light.at(x, y, z + 0.3);
  }

  // flying (spinning, the way it goes: `dir`), or stuck (still, point down)
  step(dt, dir = 1) {
    if (!this.mesh) return;
    if (this.stuck) { this.mesh.rotation.z = 0; return; }
    this.spin += dt * 24 * dir;
    this.mesh.rotation.z = -this.spin;
  }

  set opacity(v) {
    if (this.mesh) { this.mesh.material.opacity = v; }
    this.light.level = v;
  }

  dispose() {
    this.light.end(0.1);
    drop(this.scene, this.mesh);
  }
}

export class Eye {
  // The Frenzied Eye, over his head of flame at (x, y, z): `size` across (its whole drawing, its
  // tongues' reach; the black hole in its middle a little over a quarter of that), its tongues
  // swirling round (its four drawings); white-hot as it's about to burst (`white`); its light, the
  // arena turning the colour of it, the stronger the bigger it grows.
  constructor(scene, x, y, z, size) {
    const art = fxArt('morvane-eye');
    this.mesh = plane(art, art ? 1 / art.w : 1, 8);
    this.art = art;
    if (this.mesh) scene.add(this.mesh);
    this.light = carry(scene, [x, y, z + 1], { color: FRENZY_LIGHT, power: 30, reach: 26, waver: 0.5 });
    Object.assign(this, { scene, t: 0, size, white: 0, x, y, z });
    this.place();
  }

  place() {
    if (this.mesh) {
      this.mesh.position.set(this.x, this.y, this.z);
      this.mesh.scale.setScalar(this.size);
      this.mesh.material.color.setRGB(1.3 + this.white, 1.05 + this.white, 1.05 + this.white * 1.3);
    }
    this.light.at(this.x, this.y, this.z + 1);
  }

  // `glow`: 0..1, how strongly it lights the arena
  step(dt, glow) {
    this.t += dt;
    if (this.mesh) this.mesh.material.map = this.art.frames[Math.floor(this.t * 9) % this.art.frames.length];
    this.light.level = 0.4 + glow * 3.2;
    this.place();
  }

  set opacity(v) {
    if (this.mesh) this.mesh.material.opacity = v;
  }

  dispose() {
    this.light.end(0.4);
    drop(this.scene, this.mesh);
  }
}

export class Dropped {
  // His sword or his fang (`key`: its drawing, fxart.js) lying on the floor at (x, z), turned `angle`
  // (radians) about the upright, as big as in his hand; fading out after `life` seconds. Returns
  // false from step once it's gone.
  constructor(scene, key, x, z, { angle = 0, life = 8 } = {}) {
    const art = fxArt(key);
    this.mesh = null;
    if (art) {
      const px = 2.31 / 91;
      this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(art.w * px, art.h * px), new THREE.MeshLambertMaterial({
        map: art.frames[0], transparent: true, alphaTest: 0.5, depthWrite: false,
      }));
      this.mesh.rotation.set(-Math.PI / 2, 0, angle);
      this.mesh.position.set(x, 0.04, z);
      this.mesh.renderOrder = 3;
      scene.add(this.mesh);
    }
    Object.assign(this, { scene, life, t: 0 });
  }

  step(dt) {
    this.t += dt;
    if (this.mesh) this.mesh.material.opacity = Math.max(0, Math.min(1, (this.life - this.t) / 1.5));
    return this.t < this.life;
  }

  dispose() {
    drop(this.scene, this.mesh);
  }
}

// ---------------------------------------------------------------------------------------------
// his arena, once he's revealed

// The ring of frenzied flame round it: how many tongues of it, how far out from the arena's middle
// (its floor ends at 19; its round, as its pillars stand, a little narrower front to back), each
// tongue's size (world units: its tips about three-quarters of the pillars' height) and its drawing's
// pixels, how many kinds of tongue and how many drawings each loops through, how fast, and how bright
// (the colour its drawing is multiplied by: past 1, the bloom catches it); toward thee (+z: the sine of
// its angle, from `from` to `to`) each lower and fainter, down to `low` and `faint`, so that it hides
// nobody. Its light: so many fires' worth round it, each so strong, reaching so far, so high, so far
// in from the flames. The burning ash drifting up over the arena: so many a second, living so long.
// And how long it all takes to come, and to go.
const INFERNO = {
  count: 72,
  radius: 19.7,
  squash: 0.94,
  width: 2.8,
  height: 5.6,
  px: [52, 112],
  kinds: 4,
  frames: 10,
  fps: 11,
  bright: [1.0, 0.9, 0.82],
  near: { from: -0.1, to: 0.6, low: 0.16, faint: 0.4 },
  lights: { count: 6, power: 46, reach: 30, y: 2.6, inset: 1.8 },
  ash: { rate: 60, life: [2.2, 3.8] },
  fadeIn: 1.2,
  fadeOut: 3,
};

// Value noise on a grid `gw` by `gh` cells, wrapping both ways (so that what scrolls through it loops).
function noiseOf(r, gw, gh) {
  const g = Array.from({ length: gw * gh }, () => r());
  const at = (i, j) => g[(((j % gh) + gh) % gh) * gw + (((i % gw) + gw) % gw)];
  return (x, y) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(i, j);
    const b = at(i + 1, j);
    const c = at(i, j + 1);
    const d = at(i + 1, j + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

// A tongue of frenzied flame, the `n` drawings of its loop, `w` by `h` pixels: a column of fire
// swaying in a wave that climbs it, ragged at its edges, breaking into licks toward its tip, its
// fire rising through it; white-hot at its root, then yellow, amber, orange, and deep red-orange at
// its edges and tips (FRENZY: his head of flame's colours). (The game draws it till Sacha does.)
function tongueFrames(seed, n, w, h) {
  const r = rng(seed);
  const big = noiseOf(r, Math.ceil(w / 8) + 1, h / 8);
  const fine = noiseOf(r, Math.ceil(w / 4) + 1, h / 4);
  const ph = [r() * Math.PI * 2, r() * Math.PI * 2, r() * Math.PI * 2];
  const P = FRENZY;
  return Array.from({ length: n }, (_, f) => {
    const t = f / n;
    return texture(canvasOf(w, h, (put) => {
      for (let y = 0; y < h; y++) {
        const u = (h - 1 - y) / (h - 1); // (0 at its root, 1 at its tip)
        const wave = Math.sin((t - u * 1.2) * Math.PI * 2 + ph[0]) * w * 0.16 * u ** 1.1
          + Math.sin((t * 2 - u * 2.6) * Math.PI * 2 + ph[1]) * w * 0.06 * u;
        const mid = w / 2 - 0.5 + wave;
        const half = w * 0.44 * (1 - u) ** 0.7 * (0.88 + 0.12 * Math.sin((t - u * 2) * Math.PI * 2 + ph[2])) + 0.6;
        for (let x = 0; x < w; x++) {
          const a = big(x / 8, (y + t * h) / 8);
          const b = fine(x / 4, (y + t * h * 2) / 4);
          const d = Math.abs(x - mid) / half + (a - 0.5) * 0.9 * u + (b - 0.5) * 0.25;
          if (d > 1) continue;
          if (u > 0.55 && a < (u - 0.55) * 1.6) continue; // (its tip broken into licks)
          const heat = (1 - d) * (1 - u * 0.75) + (b - 0.5) * 0.15;
          put(x, y, heat > 0.88 && u < 0.25 ? P.core : heat > 0.72 ? P.hot : heat > 0.52 ? P.red : heat > 0.3 ? P.deep : P.dark);
        }
      }
    }));
  });
}

export class Inferno {
  // Round the arena whose middle is (cx, cz) (`scene`: its floor, fight.js; `particles`: its floor's):
  // the ring of flame, its light, the ash; and, beyond, the world gone black (`daylight`'s frenzy) and
  // heat shimmering through the picture (`post`'s heat). Comes as it's made; goes out once ended
  // (end). Returns false from step once it's gone out.
  constructor({ scene, particles, cx, cz, daylight, post }) {
    const I = INFERNO;
    const L = I.lights;
    this.frames = Array.from({ length: I.kinds }, (_, k) => tongueFrames(7100 + k * 37, I.frames, I.px[0], I.px[1]));
    this.geo = new THREE.PlaneGeometry(I.width, I.height);
    this.geo.translate(0, I.height / 2, 0);
    const r = rng(907);
    this.tongues = [];
    for (let i = 0; i < I.count; i++) {
      const a = (i / I.count) * Math.PI * 2 + r() * 0.04;
      const s = Math.min(1, Math.max(0, (Math.sin(a) - I.near.from) / (I.near.to - I.near.from)));
      const near = s * s * (3 - 2 * s);
      const mat = glowing(this.frames[0][0], 0);
      mat.color.setRGB(...I.bright);
      mat.fog = false; // (its light, against the black: never dimmed by the fog)
      const m = new THREE.Mesh(this.geo, mat);
      m.position.set(cx + Math.cos(a) * I.radius, 0, cz + Math.sin(a) * I.radius * I.squash);
      m.scale.set((r() < 0.5 ? -1 : 1) * (0.9 + r() * 0.25), (0.85 + r() * 0.3) * (1 - near * (1 - I.near.low)), 1);
      m.renderOrder = 4;
      m.visible = false;
      scene.add(m);
      this.tongues.push({ m, kind: i % I.kinds, phase: r() * I.frames, speed: 0.85 + r() * 0.3, faint: 1 - near * (1 - I.near.faint) });
    }
    this.lights = Array.from({ length: L.count }, (_, k) => {
      const a = ((k + 0.5) / L.count) * Math.PI * 2;
      const R = I.radius - L.inset;
      return carry(scene, [cx + Math.cos(a) * R, L.y, cz + Math.sin(a) * R * I.squash], { color: FRENZY_LIGHT, power: L.power, reach: L.reach, waver: 0.7, level: 0 });
    });
    Object.assign(this, { scene, particles, cx, cz, daylight, post, t: 0, level: 0, ending: false, owed: 0 });
  }

  end() { this.ending = true; }

  step(dt) {
    const I = INFERNO;
    this.t += dt;
    this.level = this.ending ? Math.max(0, this.level - dt / I.fadeOut) : Math.min(1, this.level + dt / I.fadeIn);
    const k = this.level;
    this.daylight.frenzy = k;
    this.post.heat = k;
    for (const g of this.tongues) {
      g.m.visible = k > 0.01;
      g.m.material.map = this.frames[g.kind][Math.floor(this.t * I.fps * g.speed + g.phase) % I.frames];
      g.m.material.opacity = k * g.faint;
    }
    for (const L of this.lights) L.level = k;
    // burning ash, drifting up over the arena: small bright orange pixels, glinting
    this.owed += dt * I.ash.rate * k;
    for (; this.owed >= 1; this.owed -= 1) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * (I.radius - 1.5);
      this.particles.emit({
        pos: [this.cx + Math.cos(a) * rr, 0.3 + Math.random() * 4.5, this.cz + Math.sin(a) * rr * I.squash],
        vel: [(Math.random() - 0.5) * 0.8, 0.45 + Math.random() * 0.7, (Math.random() - 0.5) * 0.5], velSpread: [0.25, 0.2, 0.2],
        color: ['#ffb040', '#ff8a1a', '#ffd27a', '#ff6a10'], size: 0.045, life: I.ash.life[0] + Math.random() * (I.ash.life[1] - I.ash.life[0]),
        count: 1, drag: 0.2, flicker: 0.6, intensity: 3.2,
      });
    }
    return !(this.ending && k <= 0);
  }

  dispose() {
    this.daylight.frenzy = 0;
    this.post.heat = 0;
    for (const g of this.tongues) {
      this.scene.remove(g.m);
      g.m.material.dispose();
    }
    this.geo.dispose();
    for (const list of this.frames) for (const t of list) t.dispose();
    for (const L of this.lights) L.end(0.3);
  }
}
