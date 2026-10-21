// The tutorial's climb (tutorial.js): from the training yard (yard.js) a stair of stone up to a
// second yard, the rune rocks', and from that one another up to a third, the great dummy's, each
// higher than the last, in a line east of it. They're bare: a floor of grey brick (the rocks' ripples
// like the arena's under their shockwaves: ripple.js), a mossy lip open where a stair comes up or
// goes on, a rock of its own down into the mist, lanterns about the edge. Walls of fog (the arena's,
// arena.js), standing across each stair, close its foot till its yard's step is done, and its head
// behind thee once thou'st come up it. (The training yard's own stair up to the Hold is put away
// meanwhile: tutorial.js.) It's there only for the tutorial (world.climb while it is).

import * as THREE from 'three';
import * as T from './textures.js';
import { Builder } from './build.js';
import { YARD } from './yard.js';
import { FLOOR, discGeometry, fogWall } from './arena.js';
import { rippling } from './ripple.js';
import { addLevel, removeLevel } from './ground.js';

const Z = YARD.cz; // (its yards' middles all lie on the training yard's middle line, east of it)
// Its stairs: half as wide as they're walked, how far each runs and climbs, in how many steps.
const STAIR = { half: 1.4, run: 7.6, rise: 3.2, steps: 16 };
// Its yards, the training yard first: each's middle, its floor's height and its radius; where its
// lanterns stand round its edge (degrees from the east, round by the south: clear of its stairs).
const A = { cx: 0, y: YARD.y, R: YARD.halfW };
const B = { R: 14, lanterns: [-130, -50, 50, 130] };
const C = { R: 13, lanterns: [-130, -60, 0, 60, 130] };
B.y = A.y + STAIR.rise;
B.cx = A.cx + A.R + STAIR.run + B.R;
C.y = B.y + STAIR.rise;
C.cx = B.cx + B.R + STAIR.run + C.R;
// (each stair: where it leaves the yard below and comes up onto the one above, and their heights)
const STAIRS = [[A, B], [B, C]].map(([lo, hi]) => ({ x0: lo.cx + lo.R, x1: hi.cx - hi.R, y0: lo.y, y1: hi.y }));
export const CLIMB = { z: Z, yards: [A, B, C], stairs: STAIRS };
// The walls of fog across the stairs: how wide (across a stair, its posts and a little beyond) and
// tall; how quickly one wells up, and thins away; and the mist banked in it, soft puffs that seen
// from the side (as the camera sees a wall across a stair: edge on, thin) still read as fog: each
// one's place (across the stair, and up from the ground) and size, its colour, how thick at most.
const FOG = {
  w: 4.4, h: 4.2, up: 0.8, down: 1.4,
  puffs: [[-1.4, 1.0, 2.4], [0, 0.9, 2.6], [1.4, 1.0, 2.4], [-0.8, 2.3, 2.3], [0.8, 2.4, 2.3], [0, 3.4, 2.0]],
  mist: '#e4e0d8', thick: 0.55,
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Climb extends Builder {
  constructor(world) {
    super(world, 0, Z);
    this.name = ''; // (no place's title for it: ui.js)
    this.mat = world.matsFor('ashen');
    this.dark = new THREE.MeshLambertMaterial({ map: world.tex.wood, color: '#8a6c54' }); // (the lanterns' posts)
    this.lanterns = [];
    this.fogs = [];
    this.buildYard(B, [Math.PI, 0]);
    this.buildYard(C, [Math.PI]);
    STAIRS.forEach((s, k) => this.buildStair(s, k));
    // the fog across each stair's foot and head, between the stones either side of it (local
    // coordinates: the same x as the world's, z from the yards' middle line)
    this.stairs = STAIRS.map((s) => ({ ...s, foot: this.fog(s.x0 - 0.3, s.y0), head: this.fog(s.x1 + 0.3, s.y1) }));
    this.mergeStatic();
    // the ground: up each stair (before the training yard's own, which its foot lies in), and on
    // each yard and the air round it
    this.levels = [
      ...STAIRS.map((s) => addLevel({
        contains: (x, z) => x >= s.x0 - 0.3 && x <= s.x1 + 0.3 && Math.abs(z - Z) <= STAIR.half + 0.6,
        y: (x) => s.y0 + (s.y1 - s.y0) * clamp((x - s.x0) / (s.x1 - s.x0), 0, 1),
      }, true)),
      ...[B, C].map((Y) => addLevel({ contains: (x, z) => Math.hypot(x - Y.cx, z - Z) <= Y.R + 3, y: () => Y.y })),
    ];
    world.climb = this;
    world.version += 1;
  }

  // ------------------------------------------------------------------------------------------
  // where one may be

  // Its yards (k: 0 the training yard, 1 the rocks', 2 the great dummy's): on its floor.
  inYard(k, x, z) {
    const Y = [A, B, C][k];
    return !!Y && Math.hypot(x - Y.cx, z - Z) <= Y.R - 0.6;
  }

  // On the k-th stair (0: up from the training yard), and a little way onto the yards at its ends.
  onStair(k, x, z) {
    const s = STAIRS[k];
    return !!s && x >= s.x0 - 0.8 && x <= s.x1 + 0.8 && Math.abs(z - Z) <= STAIR.half - 0.25;
  }

  // Come up onto yard k: on its floor, past the head of the stair up to it.
  arrivedOn(k, x, z) {
    return k > 0 && this.inYard(k, x, z) && x > STAIRS[k - 1].x1 + 1.5;
  }

  // On one of its own yards (not the training yard): training there finds its dummies (training.js).
  inside(x, z) {
    return [B, C].some((Y) => Math.hypot(x - Y.cx, z - Z) <= Y.R + 0.2);
  }

  contains(x, z) {
    return this.inside(x, z) || STAIRS.some((s) => x >= s.x0 && x <= s.x1 && Math.abs(z - Z) <= STAIR.half + 0.6);
  }

  isWalk(x, z) {
    return this.inYard(1, x, z) || this.inYard(2, x, z) || this.onStair(0, x, z) || this.onStair(1, x, z);
  }

  // ------------------------------------------------------------------------------------------
  // building it

  buildYard(Y, openings) {
    const { stoneMoss } = this.mat;
    // its floor (finely divided, to ripple)
    const tex = T.pixelTexture(T.floorCanvas(Y.R * 2, Y.R * 2, (cx, cz) => (Math.hypot(cx - Y.R, cz - Y.R) < Y.R - 1.2 ? 1.1 : 0.35), FLOOR, 6100 + Y.R));
    const floor = new THREE.Mesh(discGeometry(Y.R, 0.25), rippling(new THREE.MeshLambertMaterial({ map: tex }), { lit: true }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(Y.cx, Y.y, 0);
    floor.receiveShadow = true;
    floor.userData.dynamic = true; // (never merged with anything: its material bends it)
    this.add(floor);
    // its mossy lip, open where a stair meets it (`openings`: their angles, from the east round by
    // the south)
    const gap = Math.asin((STAIR.half + 0.4) / (Y.R - 0.1));
    const opens = [...openings].sort((a, b) => a - b);
    opens.forEach((a, i) => {
      const start = a + gap;
      const end = (i + 1 < opens.length ? opens[i + 1] : opens[0] + Math.PI * 2) - gap;
      const rim = new THREE.TorusGeometry(Y.R - 0.1, 0.24, 4, Math.max(8, Math.round((56 * (end - start)) / (Math.PI * 2))), end - start);
      rim.rotateZ(start);
      const lip = new THREE.Mesh(rim, stoneMoss);
      lip.rotation.x = Math.PI / 2;
      lip.position.set(Y.cx, Y.y - 0.05, 0);
      this.add(lip);
    });
    // its rock, down into the mist
    const rock = this.mat.rockTex.clone();
    rock.repeat.set(Math.round(Y.R * 1.8), 13);
    rock.needsUpdate = true;
    const cliff = new THREE.Mesh(new THREE.CylinderGeometry(Y.R, Y.R - 2, 28, 40, 1, true), new THREE.MeshLambertMaterial({ map: rock }));
    cliff.position.set(Y.cx, Y.y - 14, 0);
    this.add(cliff);
    for (const deg of Y.lanterns) {
      const a = (deg * Math.PI) / 180;
      this.lantern(Y, Y.cx + Math.cos(a) * (Y.R - 0.9), Math.sin(a) * (Y.R - 0.9));
    }
  }

  // A stair of stone up from one yard to the next (as the training yard's from the Hold, yard.js):
  // its steps on a slab, a keel of mossy stone under it and a pier down into the mist, low stones
  // along its sides and a taller one either side of its foot and its head.
  buildStair(s, k) {
    const { stone, stoneMoss } = this.mat;
    const wide = STAIR.half * 2 + 0.5;
    const tread = (s.x1 - s.x0) / STAIR.steps;
    const rise = (s.y1 - s.y0) / STAIR.steps;
    const up = (x) => s.y0 + (s.y1 - s.y0) * clamp((x - s.x0) / (s.x1 - s.x0), 0, 1); // (how high it is at x)
    const v = (x, y) => new THREE.Vector3(x, y, 0);
    for (let i = 0; i < STAIR.steps; i++) {
      const top = s.y0 + rise * (i + 0.5);
      this.box(tread + 0.02, 0.6, wide, stone, s.x0 + tread * (i + 0.5), top - 0.3, 0);
    }
    this.beam(v(s.x0, s.y0 - 0.75), v(s.x1, s.y1 - 0.75), wide - 0.1, stone, 0.5);
    const keel = [s.x0 + 0.8, s.x1 - 0.8].map((x) => v(x, up(x) - 1.45));
    this.beam(keel[0], keel[1], 1.6, stoneMoss, 1.4);
    const pier = s.x0 + (s.x1 - s.x0) * 0.5;
    this.box(1.5, 16, 1.5, stoneMoss, pier, up(pier) - 1.9 - 8, 0);
    for (const side of [-1, 1]) {
      const z = side * (STAIR.half + 0.13);
      for (let i = 0; i < STAIR.steps; i += 2) {
        if (((i * 7 + k * 3 + (side > 0 ? 1 : 0)) % 9) === 4) continue; // (one missing here and there)
        const h = 0.5 + ((i * 13 + k) % 5) * 0.03;
        const foot = s.y0 + rise * (i + 0.5); // (on the lower of the two steps it stands on)
        this.box(tread * 2 - 0.08, h, 0.25, stoneMoss, s.x0 + tread * (i + 1), foot + h / 2, z);
      }
      this.box(0.5, 0.9, 0.4, stoneMoss, s.x0 - 0.3, s.y0 + 0.42, z);
      this.box(0.5, 0.9, 0.4, stoneMoss, s.x1 + 0.3, s.y1 + 0.42, z);
    }
  }

  // A lantern on a post (the training yard's, yard.js), hung from an arm reaching in over the floor
  // of yard Y.
  lantern(Y, x, z) {
    const { iron } = this.world.mat;
    const { dark } = this;
    const y = Y.y;
    this.box(0.18, 2.6, 0.18, dark, x, y + 1.3, z, { tile: 1 });
    const d = Math.hypot(x - Y.cx, z) || 1;
    const ax = (-(x - Y.cx) / d) * 0.45;
    const az = (-z / d) * 0.45;
    this.box(0.55, 0.1, 0.1, dark, x + ax / 2, y + 2.5, z + az / 2, { tile: 1, ry: Math.atan2(-az, ax) });
    this.box(0.03, 0.35, 0.03, iron, x + ax, y + 2.3, z + az, { tile: 1 });
    const cage = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.28), new THREE.MeshLambertMaterial({ color: '#2c2d33', emissive: '#ffb050', emissiveIntensity: 0.9 }));
    cage.position.set(x + ax, y + 1.98, z + az);
    cage.userData.dynamic = true;
    this.add(cage);
    const glow = this.additiveSprite('#ffb060', 1.5, 0.35);
    glow.position.set(x + ax, y + 1.98, z + az);
    this.add(glow);
    this.lanterns.push({ glow, light: this.light(x + ax, y + 2.1, z + az, '#ffb060', 11, 1.5), phase: x + z });
    this.blockCircle(x, z, 0.35);
  }

  // A wall of fog standing across a stair on the ground at (x, y), local, facing up and down it, and
  // the mist banked in it.
  fog(x, y) {
    const f = fogWall(FOG.w, FOG.h);
    f.mesh.rotation.y = Math.PI / 2;
    f.mesh.position.set(x, y + FOG.h / 2, 0);
    this.add(f.mesh);
    const puffs = FOG.puffs.map(([z, up, size], i) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.world.tex.glow, color: FOG.mist, transparent: true, opacity: 0, depthWrite: false }));
      sprite.scale.set(size, size, 1);
      sprite.renderOrder = 4;
      sprite.visible = false;
      this.add(sprite);
      return { sprite, z, up, phase: i * 1.7 + x };
    });
    const wall = { ...f, puffs, x, y, z: 0, on: false };
    this.fogs.push(wall);
    return wall;
  }

  // A wall of fog up, or thinning away (`now`: at once, as it's all set out in the dark); welling up,
  // it throws off a breath of mist.
  seal(wall, on, now = false) {
    if (now) wall.uniforms.uIntensity.value = on ? 1 : 0;
    if (wall.on === on) return;
    wall.on = on;
    if (!on || now) return;
    this.world.particles.emit({
      pos: [this.wx(wall.x), wall.y + 1.4, this.wz(wall.z)], spread: [0.3, 1.2, FOG.w / 2], vel: [0, 0.6, 0], velSpread: [0.5, 0.5, 0.5],
      color: ['#e8e4dc', '#c8c4bc', '#f2dca8'], size: 0.12, life: 1.6, count: 50, drag: 0.8, intensity: 1.1,
    });
  }

  update(dt, t) {
    // the walls of fog well up quickly, and thin away slowly, their mist with them, stirring
    for (const f of this.fogs) {
      const u = f.uniforms;
      u.uTime.value = t;
      u.uIntensity.value = clamp(u.uIntensity.value + (f.on ? dt / FOG.up : -dt / FOG.down), 0, 1);
      const k = u.uIntensity.value;
      const tall = 0.4 + 0.6 * Math.min(1, k * 1.5);
      f.mesh.visible = k > 0.01;
      f.mesh.scale.y = tall;
      f.mesh.position.y = f.y + (FOG.h / 2) * tall;
      for (const p of f.puffs) {
        p.sprite.visible = k > 0.01;
        p.sprite.material.opacity = FOG.thick * k * (0.75 + 0.25 * Math.sin(t * 0.9 + p.phase));
        p.sprite.position.set(f.x + 0.15 * Math.sin(t * 0.5 + p.phase), f.y + p.up * tall + 0.12 * Math.sin(t * 0.7 + p.phase * 2), p.z);
      }
    }
    // the lanterns' flames stir
    for (const l of this.lanterns) {
      const k = 0.85 + 0.15 * Math.sin(t * 7 + l.phase) * Math.sin(t * 3.1 + l.phase * 2);
      l.glow.material.opacity = 0.35 * k;
      l.light.intensity = 1.6 * k;
    }
  }

  // Gone (the tutorial over, or back at the Hold): its ground, its lights, all it was built of.
  remove() {
    const { world } = this;
    for (const l of this.levels) removeLevel(l);
    const lights = new Set(this.ownLights);
    world.lightSources = world.lightSources.filter((s) => !lights.has(s));
    for (const l of world.lightPool) if (lights.has(l.userData.src)) { l.userData.src = null; l.intensity = 0; }
    world.scene.remove(this.group);
    const shared = world.sharedMaterials();
    const sharedTex = new Set(Object.values(world.tex || {}));
    this.group.traverse((o) => {
      if (!o.isSprite) o.geometry?.dispose(); // (every sprite's is the one, three.js's)
      for (const m of [].concat(o.material || [])) {
        if (shared.has(m)) continue;
        for (const key of ['map', 'emissiveMap']) if (m[key] && !sharedTex.has(m[key])) m[key].dispose();
        m.dispose();
      }
    });
    if (world.climb === this) world.climb = null;
    world.version += 1;
  }
}
