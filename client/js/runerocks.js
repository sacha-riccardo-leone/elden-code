// The training yard's rune rocks (yard.js, ROCK_RING): three of them round a ring of cyan light at
// its east end, where the dodge is practised. Step into the ring and they take their turns, one
// after another: each one's rune lights, it's lifted in blue magic, held up a second and dropped,
// and its shockwave ripples out over the floor (ripple.js); a dodge (Space) through it counts, three
// in a row, at the foot of the screen (#dodge-count); one that lands strikes as a great enemy's blow
// would, red and all, but takes no health (fight.js, hurtPlayer), and the count starts again. Three
// in a row, a moment's rest, and from nothing again. Step out of the ring and they rest, once the
// one up has come down. The tutorial (tutorial.js) teaches the dodge on them: shut (`open`) but for
// its step, which is done at the third in a row.

import * as THREE from 'three';
import { YARD } from './yard.js';
import { fxArt } from './fxart.js';
import { texture, Decal } from './bossfx.js';
import { addRipple, rippleBounds, rippleAt } from './ripple.js';
import { carry, flash } from './lights.js';
import { ARENA } from './config.js';

// The rocks (fx/rune-rock-*.json: dark, and the rune alight): each one's drawing, in the order they
// stand round the ring (yard.js), how big they're drawn (world units to their drawing's pixel), how
// high each is lifted, and how long each part of its turn lasts (the rune lighting, lifted, held up,
// falling, its light dying away); the pause before the next one's, before the first once thou'rt in
// the ring, and after a third dodged in a row; how long the count stays once they rest with three;
// their blue light and motes; and where the camera looks from meanwhile (how far back, how high, and
// how far north of the ring's middle: aim).
const ROCKS = {
  art: ['rune-rock-2', 'rune-rock-1', 'rune-rock-3'],
  px: 0.038, lift: 2.4,
  light: 0.45, rise: 0.9, hold: 1, fall: 0.3, dim: 0.6, gap: 0.9, first: 1, again: 2.4, linger: 1.6,
  glow: '#53e8ff', motes: ['#7ff6ff', '#2fd8ff', '#c8fbff'],
  cam: { dist: 27, y: 1.6, z: -1.2 },
};
// A rock's shockwave (ripple.js, as the Golem's, golem.js): how fast it runs (slower than his, to be
// learnt), how wide its crest strikes, between crests and how many, how high the first, and how far
// it rolls (over the whole of the yard's east end, wherever it starts: it strikes there alone, its
// round end, and past it all but dies away); how near its crest a dodge counts (one away from it
// outruns it a moment, and it would catch thee after); and the dodges in a row they ask.
const WAVE = { speed: 8, band: 1.2, length: 2.2, crests: 3, amp: 0.45, reach: YARD.halfW + 8, near: 1.8 };
export const DODGES = 3;
// (how far out of the ring thou mayst stray before it's left: so its edge isn't crossed back and forth)
const OUT = 0.8;

function h(tag, cls, ...kids) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) e.append(k);
  return e;
}

export class RockRing {
  constructor(training) {
    this.training = training;
    this.ctx = training.ctx;
    this.rocks = null; // (made once their drawing has loaded: start)
    this.open = true; // (shut, they take no turns: the tutorial's but for its step)
    this.on = false; // thou'rt in the ring, and they take their turns
    this.dodged = 0; // in a row
    this.turn = 0; // (whose is next)
    this.wait = 0; // (till then)
    this.waves = [];
    this.marks = []; // the cracks they leave
    this.bounded = false; // (the ripples kept to the yard's floor: crash)
    this.hideIn = 0;
    this.el = document.getElementById('dodge-count');
  }

  start() {
    if (this.rocks) return;
    this.rocks = this.ctx.world.yard.rockSpots().map(([x, z], i) => new RuneRock(this, ROCKS.art[i], x, z));
  }

  // Whether n stands in the ring (once in, a little way past its edge too).
  inside(n) {
    const { x, z, r } = this.ctx.world.yard.ring();
    return Math.hypot(n.pos.x - x, n.pos.y - z) < r + (this.on ? OUT : 0);
  }

  // Whether one is still taking its turn, or its shockwave still rolling.
  get busy() {
    return this.waves.length > 0 || !!this.rocks?.some((r) => r.state !== 'rest');
  }

  update(dt) {
    if (!this.rocks) return;
    const { pilot, world } = this.ctx;
    const me = pilot.npc;
    const on = this.open && !!me && !pilot.dead && !me.travel && this.inside(me);
    if (on !== this.on) {
      this.on = on;
      if (on) {
        this.dodged = 0;
        this.wait = ROCKS.first;
        this.tally(0);
      } else this.hideIn = this.dodged >= DODGES ? ROCKS.linger : 0;
    }
    if (!on && this.el && !this.el.hidden) {
      this.hideIn -= dt;
      if (this.hideIn <= 0) this.el.hidden = true;
    }
    for (const r of this.rocks) r.step(dt);
    this.stepWaves(dt);
    this.marks = this.marks.filter((m) => {
      m.t += dt;
      m.crack.opacity = Math.max(0, Math.min(1, (5 - m.t) / 2));
      if (m.t < 5) return true;
      m.crack.dispose();
      return false;
    });
    // (the ripples, spent, back on the arena's floor alone)
    if (this.bounded && !this.waves.length) {
      rippleBounds(world.arena.cx, world.arena.cz, ARENA.radius);
      this.bounded = false;
    }
    // (the ring burning brighter while they take their turns: yard.js)
    world.yard.glow += ((on ? 1 : 0) - world.yard.glow) * Math.min(1, dt * 3);
    // one at a time, a moment apart; three dodged in a row, a moment longer, and from nothing again
    if (!on || this.rocks.some((r) => r.state !== 'rest')) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    if (this.dodged >= DODGES) {
      this.dodged = 0;
      this.tally(0);
    }
    this.rocks[this.turn % this.rocks.length].go();
    this.turn += 1;
    this.wait = ROCKS.gap;
  }

  // A rock comes down: dust and blue light, a crack glowing its rune's cyan, the view jolted, and its
  // shockwave, the whole of the yard's floor bending under it (ripple.js); heard crashing.
  crash(rock) {
    const { rig, world } = this.ctx;
    const { scene, particles } = this.training.fxCtx;
    const { x, z } = rock;
    this.ctx.sound?.play('rock-impact', { at: [x, z] });
    particles.emit({
      pos: [x, 0.3, z], spread: [1.3, 0.2, 0.8], vel: [0, 2.2, 0], velSpread: [3, 1.6, 2],
      color: ['#6a5a4e', '#3a2e28', '#8a7a6a'], size: 0.16, life: 1.1, count: 46, drag: 1.3, intensity: 0.8,
    });
    particles.emit({
      pos: [x, 0.5, z], spread: [0.8, 0.3, 0.5], vel: [0, 2.6, 0], velSpread: [3.2, 1.6, 2.4],
      color: ROCKS.motes, size: 0.09, life: 0.8, count: 40, drag: 1.2, intensity: 2.6,
    });
    flash(null, [x, YARD.y + 0.8, z + 0.3], { color: ROCKS.glow, power: 26, reach: 10, life: 0.45 });
    rig.shake?.(0.35);
    this.marks.push({ crack: new Decal(scene, 'runeCrack', x, z, 3.6, { glow: false }), t: 0 }); // (in its rune's cyan)
    const { yard } = world;
    rippleBounds(yard.cx, yard.cz, YARD.halfW, YARD.halfL - YARD.halfW);
    this.bounded = true;
    this.waves.push({ ripple: addRipple(x, z, WAVE), x, z, met: false });
  }

  // Each shockwave rolling out over the floor: as its first crest passes thee (in the yard's east
  // end), a dodge, or a blow.
  stepWaves(dt) {
    const me = this.ctx.pilot.npc;
    const { particles } = this.training.fxCtx;
    const { yard } = this.ctx.world;
    const ring = yard.ring();
    this.waves = this.waves.filter((w) => {
      const r = w.ripple.front - WAVE.length / 4; // (the first crest, a quarter wavelength behind the front)
      if (r > WAVE.reach) return false;
      if (!w.met && me && !me.travel && Math.hypot(me.pos.x - ring.x, me.pos.y - ring.z) < YARD.halfW) {
        const d = Math.hypot(me.pos.x - w.x, me.pos.y - w.z);
        if (me.action?.kind === 'dodge' && Math.abs(d - r) < WAVE.near) w.dodged = true;
        if (d <= r && d >= r - WAVE.band - WAVE.speed * dt) {
          w.met = true;
          this.met(me, w);
        }
      }
      // (dust thrown up along the crest, on the floor)
      const a = Math.random() * Math.PI * 2;
      const px = w.x + Math.cos(a) * r;
      const pz = w.z + Math.sin(a) * r;
      if (r > 0 && Math.random() < 0.9 && yard.onFloor(px, pz, 0.6)) {
        particles.emit({
          pos: [px, rippleAt(px, pz) + 0.15, pz], spread: [0.3, 0.1, 0.3], vel: [Math.cos(a) * 2, 1.4, Math.sin(a) * 2],
          velSpread: [0.6, 0.6, 0.6], color: ['#8a7a6a', '#5a4a3e', '#c8b8a0'], size: 0.14, life: 0.7, count: 3, drag: 1.4, intensity: 0.9,
        });
      }
      return true;
    });
  }

  // A shockwave reaches thee: dodged as it came, one more in a row (thou in the ring); else it
  // strikes (red, and thrown back, as a great enemy's blow, but nothing taken: fight.js) and the
  // count starts again.
  met(me, w) {
    if (w.dodged || me.action?.kind === 'dodge') {
      if (!this.on || this.dodged >= DODGES) return;
      this.dodged += 1;
      this.tally(this.dodged);
      if (this.dodged >= DODGES) this.wait = ROCKS.again;
      return;
    }
    this.ctx.fight.hurtPlayer(0, [w.x, w.z]);
    if (!this.on) return;
    this.dodged = 0;
    this.tally(0, true);
  }

  // The dodges in a row, at the foot of the screen: 0 / 3, and a pip for each.
  tally(n, struck = false) {
    const c = this.el;
    if (!c) return;
    const pips = h('span', 'pips', ...Array.from({ length: DODGES }, (_, i) => h('i', i < n ? 'on' : '')));
    c.replaceChildren(h('b', '', String(n)), h('span', '', ` / ${DODGES}`), pips);
    c.hidden = false;
    c.classList.remove('struck', 'up');
    void c.offsetWidth;
    if (struck) c.classList.add('struck');
    else if (n) c.classList.add('up');
  }

  // Where the camera looks (training.aim) while thou'rt in the ring: between thee and its middle,
  // from far enough back that one lifted stays in the clear middle of the view.
  aim(me) {
    if (!this.on || !me) return null;
    const { x, z } = this.ctx.world.yard.ring();
    const k = 0.5;
    return { at: [me.pos.x + (x - me.pos.x) * k, YARD.y + ROCKS.cam.y, me.pos.y + (z + ROCKS.cam.z - me.pos.y) * k], dist: ROCKS.cam.dist, mode: 'rocks' };
  }

  // All of them at rest at once, their shockwaves and cracks gone, the count away (the tutorial
  // over, or skipped, mid-turn).
  reset() {
    for (const r of this.rocks || []) r.rest();
    for (const m of this.marks) m.crack.dispose();
    this.marks = [];
    this.waves = [];
    this.dodged = 0;
    this.on = false;
    if (this.el) this.el.hidden = true;
  }
}

// What glows of frame `k` of a drawing: its rune's cyan light (the stone it tints, the less the
// less) on black, for a rune rock's emissive map.
function glowCanvas(sheet, k) {
  const c = document.createElement('canvas');
  c.width = sheet.w;
  c.height = sheet.h;
  const g = c.getContext('2d');
  const img = g.createImageData(sheet.w, sheet.h);
  sheet.rows[k].forEach((row, y) => {
    for (let x = 0; x < sheet.w; x++) {
      if (row[x] === '.') continue;
      const [r, gr, b] = sheet.rgb[sheet.alphabet.indexOf(row[x])];
      const w = Math.max(0, Math.min(1, ((gr + b) / 2 - r - 12) / 110));
      img.data.set([r * w, gr * w, b * w, 255], (y * sheet.w + x) * 4);
    }
  });
  g.putImageData(img, 0, 0);
  return c;
}

// A rune rock standing at (x, z) on the yard's floor (in its group, out of sight with it), drawn as
// the dummies are (lit by the world's light, a shadow at its foot), solid (yard.js keeps those
// walking off its spot); its turn (go): its rune lit, its own blue light coming up round it, lifted,
// held up, dropped (RockRing.crash), and its light dying. Heard (audio.js, rock-…): its rune
// lighting, humming as it's lifted and held up (the hum hushed as it drops), rushing down.
class RuneRock {
  constructor(ring, key, x, z) {
    this.ring = ring;
    this.x = x;
    this.z = z;
    const { yard } = ring.ctx.world;
    this.yard = yard;
    const sheet = fxArt(key);
    this.sheet = sheet;
    this.w = (sheet?.w || 80) * ROCKS.px;
    this.h = (sheet?.h || 76) * ROCKS.px;
    this.glow = sheet ? texture(glowCanvas(sheet, 1)) : null;
    const mat = new THREE.MeshLambertMaterial({ map: sheet?.frames[0] || null, transparent: true, alphaTest: 0.5, emissive: '#ffffff', emissiveMap: this.glow, emissiveIntensity: 0 });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.w, this.h), mat);
    this.mesh.visible = !!sheet;
    this.foot = sheet ? (sheet.w / 2 - sheet.foot[0]) * ROCKS.px : 0; // (its foot on its spot)
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(this.w * 0.46, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.34, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.set(x - yard.cx, YARD.y + 0.015, z - yard.cz + 0.05);
    this.blob.renderOrder = 1;
    yard.group.add(this.mesh, this.blob);
    this.state = 'rest';
    this.s = 0;
    this.lift = 0;
    this.lit = 0;
    this.light = null;
    this.mote = 0;
    this.hum = []; // (what's heard of it while it's up: hushed as it drops)
    this.place();
  }

  go() {
    this.then('light');
    if (this.sheet) this.mesh.material.map = this.sheet.frames[1];
    this.light = carry(null, this.lightAt(), { color: ROCKS.glow, power: 9, reach: 7, level: 0 });
    this.sound('rock-rune');
  }

  // Down and dark at once, wherever it was in its turn.
  rest() {
    this.light?.end(0.1);
    this.light = null;
    this.hush(0.1);
    if (this.sheet) this.mesh.material.map = this.sheet.frames[0];
    this.lift = 0;
    this.lit = 0;
    this.then('rest');
    this.place();
  }

  // One of its sounds (audio.js), where it stands; what's sounding of it, or null.
  sound(name) {
    return this.ring.ctx.sound?.play(name, { at: [this.x, this.z] }) || null;
  }

  hush(fade) {
    for (const v of this.hum) v.stop(fade);
    this.hum = [];
  }

  then(state) {
    this.state = state;
    this.s = 0;
  }

  // (its light a little way in front of it and low, so that it lights the floor and thee round it
  // more than its own face)
  lightAt() {
    return [this.x, YARD.y + this.lift + this.h * 0.3, this.z + 1.6];
  }

  step(dt) {
    if (this.state === 'rest') return;
    const R = ROCKS;
    this.s += dt;
    const k = (d) => Math.min(1, this.s / d);
    if (this.state === 'light') {
      this.lit = k(R.light);
      if (this.s >= R.light) {
        this.then('rise');
        this.hum = [this.sound('rock-levitate'), this.sound('rock-levitate-under')].filter(Boolean);
      }
    } else if (this.state === 'rise') {
      this.lift = R.lift * (1 - (1 - k(R.rise)) ** 3);
      if (this.s >= R.rise) this.then('hold');
    } else if (this.state === 'hold') {
      this.lift = R.lift + Math.sin(this.s * 6) * 0.07;
      if (this.s >= R.hold) {
        this.from = this.lift;
        this.then('fall');
        this.hush(0.2);
        this.sound('rock-fall');
      }
    } else if (this.state === 'fall') {
      this.lift = this.from * (1 - k(R.fall) ** 2);
      if (this.s >= R.fall) {
        this.lift = 0;
        this.ring.crash(this);
        this.then('dim');
      }
    } else if (this.state === 'dim') {
      this.lit = 1 - k(R.dim);
      if (this.s >= R.dim) {
        if (this.sheet) this.mesh.material.map = this.sheet.frames[0];
        this.light?.end(0.2);
        this.light = null;
        this.lit = 0;
        this.then('rest');
      }
    }
    // the blue magic about it, while it's lit and up
    if (this.state === 'light' || this.state === 'rise' || this.state === 'hold') this.motes(dt);
    this.place();
  }

  motes(dt) {
    this.mote -= dt;
    if (this.mote > 0) return;
    this.mote = 0.04;
    const { particles } = this.ring.training.fxCtx;
    particles.emit({
      pos: [this.x, this.lift + 0.3, this.z + 0.3], spread: [this.w * 0.42, 0.3, 0.4], vel: [0, 1.6, 0], velSpread: [0.5, 0.8, 0.3],
      color: ROCKS.motes, size: 0.07, life: 1.1, count: 4, drag: 0.6, intensity: 2.4,
    });
  }

  place() {
    const { yard } = this;
    this.mesh.position.set(this.x - yard.cx + this.foot, YARD.y + this.h / 2 - 0.02 + this.lift, this.z - yard.cz);
    this.mesh.material.emissiveIntensity = this.glow ? this.lit * 1.2 : 0;
    // (its shadow smaller and fainter the higher it's lifted)
    const up = Math.min(1, this.lift / ROCKS.lift);
    this.blob.scale.set(1 - up * 0.35, (1 - up * 0.35) * 0.45, 1);
    this.blob.material.opacity = 0.34 * (1 - up * 0.45);
    if (this.light) {
      this.light.level = this.lit;
      this.light.at(...this.lightAt());
    }
  }
}
