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
import { glowing } from './bossfx.js';
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

// The ring of frenzied flame round it, Sacha's band of it (fxart.js: four drawings of one wall of
// flame, black inside, its fire round the black) stood in copies all round, each bent to the round:
// how far out from the arena's middle (its floor ends at 19; its round, as its pillars stand, a
// little narrower front to back), how tall a copy stands (world units: its tallest tongues about
// three-quarters of the pillars' height; each a little taller or shorter, up to `vary` either way),
// how far along from one copy the next stands (a share of its width: they overlap, so that one's
// dying ends meet the next one's middle), and how bright (the colour its drawing is multiplied by:
// past 1, the bloom catches it); a second row behind, so far further out, taller, darker, standing
// between the first's copies, and only where it's seen over the first (its angle's sine below
// `upTo`: not toward thee); how fast a copy flips through its drawings (each at its own moment of
// them, a little quicker or slower than the next); toward thee (+z: the sine of its angle, from `from`
// to `to`) each lower and fainter, down to `low` and `faint`, so that it hides nobody. Its light: so
// many fires' worth round it, each so strong, reaching so far, so high, so far in from the flames. The
// burning ash drifting up over the arena: so many a second, living so long. And how long it all takes
// to come, and to go.
const INFERNO = {
  radius: 19.9,
  squash: 0.94,
  height: 5.6,
  vary: 0.1,
  spacing: 0.55,
  bright: [1.15, 1.0, 0.9],
  back: { out: 1.2, size: 1.05, tint: 0.7, upTo: 0.35 },
  fps: 6,
  near: { from: -0.1, to: 0.6, low: 0.16, faint: 0.4 },
  lights: { count: 6, power: 46, reach: 30, y: 2.6, inset: 1.8 },
  ash: { rate: 60, life: [2.2, 3.8] },
  fadeIn: 1.2,
  fadeOut: 3,
};

// A stretch of the round `r` out, `h` tall, `w` along it, bent to it: its middle at its foot is its
// origin, the round's middle `r` behind it (-z), its drawing as drawn when seen from within.
function bent(r, h, w) {
  const arc = w / r;
  const g = new THREE.CylinderGeometry(r, r, h, Math.max(4, Math.ceil(arc * 24)), 1, true, -arc / 2, arc);
  g.translate(0, h / 2, -r);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  return g;
}

export class Inferno {
  // Round the arena whose middle is (cx, cz) (`scene`: its floor, fight.js; `particles`: its floor's):
  // the ring of flame, its light, the ash; and, beyond, the world gone black (`daylight`'s frenzy) and
  // heat shimmering through the picture (`post`'s heat). Comes as it's made; goes out once ended
  // (end). Returns false from step once it's gone out.
  constructor({ scene, particles, cx, cz, daylight, post }) {
    const I = INFERNO;
    const L = I.lights;
    this.art = fxArt('morvane-frenzy-band');
    // (the round squashed front to back as a whole, each copy stood on it facing its middle)
    this.round = new THREE.Group();
    this.round.position.set(cx, 0, cz);
    this.round.scale.z = I.squash;
    scene.add(this.round);
    this.copies = [];
    this.geos = [];
    const art = this.art;
    if (art) {
      const r = rng(907);
      const rows = [
        { radius: I.radius, size: 1, tint: 1, order: 4, shift: 0, upTo: 2 },
        { radius: I.radius + I.back.out, size: I.back.size, tint: I.back.tint, order: 3, shift: 0.5, upTo: I.back.upTo },
      ];
      for (const row of rows) {
        const h = I.height * row.size;
        const w = (h * art.w) / art.h;
        const geo = bent(row.radius, h, w);
        this.geos.push(geo);
        const n = Math.round((Math.PI * 2 * row.radius) / (w * I.spacing));
        for (let i = 0; i < n; i++) {
          const a = ((i + row.shift) / n) * Math.PI * 2 + (r() - 0.5) * 0.06;
          if (Math.sin(a) > row.upTo) continue;
          const s = Math.min(1, Math.max(0, (Math.sin(a) - I.near.from) / (I.near.to - I.near.from)));
          const near = s * s * (3 - 2 * s);
          const mat = glowing(art.frames[0], 0);
          mat.color.setRGB(...I.bright.map((c) => c * row.tint));
          mat.fog = false; // (its light, against the black: never dimmed by the fog)
          mat.side = THREE.DoubleSide;
          const m = new THREE.Mesh(geo, mat);
          m.position.set(Math.cos(a) * row.radius, 0, Math.sin(a) * row.radius);
          m.rotation.y = Math.PI / 2 - a; // (facing the arena's middle)
          m.scale.set(r() < 0.5 ? -1 : 1, (1 + (r() * 2 - 1) * I.vary) * (1 - near * (1 - I.near.low)), 1);
          m.renderOrder = row.order;
          m.visible = false;
          this.round.add(m);
          this.copies.push({ m, phase: r() * art.frames.length, speed: 0.8 + r() * 0.4, faint: 1 - near * (1 - I.near.faint) });
        }
      }
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
    for (const c of this.copies) {
      c.m.visible = k > 0.01;
      c.m.material.map = this.art.frames[Math.floor(this.t * I.fps * c.speed + c.phase) % this.art.frames.length];
      c.m.material.opacity = k * c.faint;
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
    this.scene.remove(this.round);
    for (const c of this.copies) c.m.material.dispose();
    for (const g of this.geos) g.dispose();
    for (const L of this.lights) L.end(0.3);
  }
}
