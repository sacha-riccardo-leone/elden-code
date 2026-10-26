// Morvane's frenzied flame, as it's drawn in his second form's fight (morvane.js), Sacha's drawings
// (fxart.js) and the game's light:
//   FRENZY       – its colours, white-hot to deep red-orange, his head of flame's (the crescent his
//                  slash throws is drawn in them: bossfx.js, Crescent);
//   FlameBall    – a ball of it in flight, a little copy of his head of flame, its tongues trailing
//                  behind it whichever way it goes;
//   FlameBurst   – a ball of it bursting where it lands: the flash, the full burst, the broken tongues;
//   BareFang     – his gold fang thrown bare, point first and never turning, bigger than in his hand
//                  so that it's seen, stuck in the floor where it lands (his fang throw);
//   Eye          – the Frenzied Eye, his head of flame grown huge, its tongues swirling;
//   Head         – his head of flame alight, its tongues swirling, over the one in his drawings;
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

export class BareFang {
  // His fang alone in the air, its point at (x, y, z), `scale` times as big as in his hand, pointing
  // where it's aimed (aim) and never turning, whichever way it goes; or stuck in the floor (`stuck`:
  // its point a little way into it, where it's set).
  constructor(scene, x, y, z, scale = 1.6) {
    const art = fxArt('morvane-fang');
    this.mesh = plane(art, (2.31 / 91) * scale, 7);
    this.half = art ? (art.h * (2.31 / 91) * scale) / 2 : 0;
    if (this.mesh) scene.add(this.mesh);
    // (its gold catching his fire's light)
    this.light = carry(scene, [x, y, z + 0.3], { color: '#ffd27a', power: 8, reach: 5 });
    this.point = new THREE.Vector3(0, -1, 0); // (the way its point is turned, in the world: its drawing's bottom)
    Object.assign(this, { scene, stuck: false, angle: -Math.PI / 2, camera: null });
    this.at(x, y, z);
  }

  // Its point turned toward `angle` on the screen, facing `camera`, and so it stays.
  aim(angle, camera) {
    Object.assign(this, { angle, camera });
    this.face();
  }

  face() {
    if (!this.mesh || !this.camera) return;
    this.mesh.quaternion.copy(this.camera.quaternion);
    this.mesh.rotateZ(this.angle + Math.PI / 2); // (its point, drawn at the bottom, that way)
    this.point.set(0, -1, 0).applyQuaternion(this.mesh.quaternion);
  }

  at(x, y, z) {
    const back = this.half * (this.stuck ? 0.8 : 1); // (its middle behind its point; stuck, its point sunk in a little)
    this.mesh?.position.set(x - this.point.x * back, y - this.point.y * back, z - this.point.z * back);
    this.light.at(x, y, z + 0.3);
  }

  // flying or stuck: it never turns (only kept facing the camera)
  step() {
    this.face();
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
  // (radians) about the upright, as big as in his hand; fading out after `life` seconds, or as much
  // of it seen as `seen()` says (his own fade: morvane.js). Returns false from step once it's gone.
  constructor(scene, key, x, z, { angle = 0, life = 8, seen = null } = {}) {
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
    Object.assign(this, { scene, life, seen, t: 0 });
  }

  step(dt) {
    this.t += dt;
    const v = Math.max(0, Math.min(1, this.seen ? this.seen() : (this.life - this.t) / 1.5));
    if (this.mesh) {
      this.mesh.material.opacity = v;
      this.mesh.material.alphaTest = Math.max(0.01, v * 0.5); // (fading as a whole, not gone at once at half)
    }
    return this.seen ? v > 0 : this.t < this.life;
  }

  dispose() {
    drop(this.scene, this.mesh);
  }
}

// ---------------------------------------------------------------------------------------------
// his head of flame, alight

// Sacha's drawing of his head of flame alone, its tongues swirling (the Frenzied Eye's four frames, cut
// at his body's pixel size: fxart.js), set over the one drawn in whichever of his drawings he shows,
// the hole in its middle on the hole in theirs: where that hole is in its frames, how wide (art
// pixels), how much wider than theirs it's set (so that its fire reaches as far out as their tongues
// do: they reach further from the hole than its own), how fast it flips through its frames, how it
// swells and shrinks as it burns (two beats: each so much either way, so many radians a second), and
// how bright.
const HEAD = { hole: [56.4, 58.5], d: 26.5, over: 1.15, fps: 10, beat: [0.04, 5.3, 0.02, 13.1], bright: 0.95 };

export class Head {
  // In `scene`, the world his body is drawn in (not the arena floor's raised group: what's placed there
  // is placed from the floor). `where()`, each moment (after his body is set where it stands: fight.js):
  // where the hole in his head of flame is ({ x, y, z } in the world), how wide (`d`, world units), how
  // much of him is seen (`opacity`); or null while it isn't to be seen. On till ended (end).
  constructor(scene, where) {
    this.art = fxArt('morvane-head');
    Object.assign(this, { scene, where, t: 0, ending: false, mesh: null });
    if (!this.art) return;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowing(this.art.frames[0]));
    this.mesh.material.color.setScalar(HEAD.bright);
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  end() { this.ending = true; }

  step(dt) {
    this.t += dt;
    if (this.ending) return false;
    if (!this.mesh) return true;
    const at = this.where();
    this.mesh.visible = !!at;
    if (!at) return true;
    const A = this.art;
    const [b1, w1, b2, w2] = HEAD.beat;
    const s = ((at.d * HEAD.over) / HEAD.d) * (1 + b1 * Math.sin(this.t * w1) + b2 * Math.sin(this.t * w2)); // (world units to its pixel)
    this.mesh.scale.set(A.w * s, A.h * s, 1);
    this.mesh.position.set(at.x - (HEAD.hole[0] - A.w / 2) * s, at.y + (HEAD.hole[1] - A.h / 2) * s, at.z);
    this.mesh.material.map = A.frames[Math.floor(this.t * HEAD.fps) % A.frames.length];
    this.mesh.material.opacity = at.opacity;
    return true;
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
// dying ends meet the next one's middle), only on the far half of the round (the sine of a copy's
// angle at most `upTo`: none on thy side, +z, where it would stand between thee and the fight), and
// how bright (the colour its drawing is multiplied by: past 1, the bloom catches it); a second row
// behind, so far further out, taller, darker, standing between the first's copies, ending a little
// sooner; how fast a copy flips through its drawings (each at its own moment of them, a little
// quicker or slower than the next). Its light: so many fires' worth round it, each so strong,
// reaching so far, so high, so far in from the flames. The burning ash drifting up over the arena:
// so many a second, living so long. And how long it all takes to come, and to go.
const INFERNO = {
  radius: 19.9,
  squash: 0.94,
  height: 5.6,
  vary: 0.1,
  spacing: 0.55,
  upTo: 0.05,
  bright: [1.15, 1.0, 0.9],
  back: { out: 1.2, size: 1.05, tint: 0.7, upTo: -0.1 },
  fps: 6,
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
        { radius: I.radius, size: 1, tint: 1, order: 4, shift: 0, upTo: I.upTo },
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
          const mat = glowing(art.frames[0], 0);
          mat.color.setRGB(...I.bright.map((c) => c * row.tint));
          mat.fog = false; // (its light, against the black: never dimmed by the fog)
          mat.side = THREE.DoubleSide;
          const m = new THREE.Mesh(geo, mat);
          m.position.set(Math.cos(a) * row.radius, 0, Math.sin(a) * row.radius);
          m.rotation.y = Math.PI / 2 - a; // (facing the arena's middle)
          m.scale.set(r() < 0.5 ? -1 : 1, 1 + (r() * 2 - 1) * I.vary, 1);
          m.renderOrder = row.order;
          m.visible = false;
          this.round.add(m);
          this.copies.push({ m, phase: r() * art.frames.length, speed: 0.8 + r() * 0.4 });
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

  // (going out over `secs`: the first time it's told to)
  end(secs = INFERNO.fadeOut) {
    if (this.ending) return;
    this.ending = true;
    this.out = secs;
  }

  step(dt) {
    const I = INFERNO;
    this.t += dt;
    this.level = this.ending ? Math.max(0, this.level - dt / this.out) : Math.min(1, this.level + dt / I.fadeIn);
    const k = this.level;
    this.daylight.frenzy = k;
    this.post.heat = k;
    for (const c of this.copies) {
      c.m.visible = k > 0.01;
      c.m.material.map = this.art.frames[Math.floor(this.t * I.fps * c.speed + c.phase) % this.art.frames.length];
      c.m.material.opacity = k;
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
