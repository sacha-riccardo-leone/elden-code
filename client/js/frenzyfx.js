// Morvane's frenzied flame, as it's drawn in his second form's fight (morvane.js), Sacha's drawings
// (fxart.js) and the game's light:
//   FRENZY       – its colours, white-hot to deep red-orange, his head of flame's (the crescent his
//                  slash throws is drawn in them: bossfx.js, Crescent);
//   FlameBall    – a ball of it in flight, a little copy of his head of flame, its tongues trailing;
//   FlameBurst   – a ball of it bursting where it lands: the flash, the full burst, the broken tongues;
//   Fang         – his gold fang thrown, spinning, wreathed in a ball of it;
//   Eye          – the Frenzied Eye, his head of flame grown huge, its tongues swirling;
//   Dropped      – his sword or his fang, let fall as he's felled, lying on the floor.
// Each lights the world round it as it goes (lights.js). Without its drawing, each draws nothing
// (the particles and the light about it are still there).

import * as THREE from 'three';
import { glowing } from './bossfx.js';
import { fxArt } from './fxart.js';
import { flash, carry } from './lights.js';

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
  // His fang in the air at (x, y, z), spinning, a ball of frenzied flame round it (`burning`); or
  // stuck in the floor, point down, its flame low.
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

  // flying toward `dir` (spinning), or stuck in the floor (still, point down)
  step(dt, dir = 1) {
    this.ball.step(dt);
    if (!this.mesh) return;
    if (this.stuck) { this.mesh.rotation.z = 0; return; }
    this.spin += dt * 18 * dir;
    this.mesh.rotation.z = -this.spin;
    this.ball.aim(dir);
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
