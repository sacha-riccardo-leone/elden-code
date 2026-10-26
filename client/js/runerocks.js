// The training yard's rune rocks (yard.js, ROCK_RING): three of them at its east end, standing on a
// ring of thin black cracks in its floor, where the dodge is practised. Step into the ring (or one
// training there steps in: training.js) and a small light kindles in the cracks and runs round
// them, rock to rock; as it passes under one, its rune lights, and it's lifted in blue magic, held
// up a second and dropped, and its shockwave ripples out over the floor (ripple.js). A crest that
// reaches thee strikes as a great enemy's blow would, red and all, but takes no health (fight.js,
// hurtPlayer), unless thou dodgest (Space) through it; those training hop it, as fighters hop the
// Golem's, and now and then mistime it and are thrown back. With nobody in the ring the light goes
// out and the cracks lie dark (the one up still comes down). The tutorial (tutorial.js) teaches the
// dodge on them: shut (`open`) but for its step, which counts thy dodges in a row at the foot of the
// screen (#dodge-count, `counting`) and is done at the third.

import * as THREE from 'three';
import { YARD, ROCK_RING } from './yard.js';
import { fxArt } from './fxart.js';
import { texture, canvasOf, Decal } from './bossfx.js';
import { addRipple, clearRipples, rippleAt, rippling } from './ripple.js';
import { carry, flash } from './lights.js';
import { rng } from './pixel.js';
import { TEXELS } from './textures.js';

// The rocks (fx/rune-rock-*.json: dark, and the rune alight): each one's drawing, in the order they
// stand round the ring (yard.js), how big they're drawn (world units to their drawing's pixel), how
// high each is lifted, and how long each part of its turn lasts (the rune lighting, lifted, held up,
// falling, its light dying away) and the pause after it; how long the tutorial's count stays once
// three are dodged; their blue light and motes; and where the camera looks from while thou'rt in
// the ring (how far back, how high, and how far north of its middle: aim).
const ROCKS = {
  art: ['rune-rock-2', 'rune-rock-1', 'rune-rock-3'],
  px: 0.038, lift: 2.4,
  light: 0.45, rise: 0.9, hold: 1, fall: 0.3, dim: 0.6, gap: 0.9, linger: 1.6,
  glow: '#53e8ff', motes: ['#7ff6ff', '#2fd8ff', '#c8fbff'],
  cam: { dist: 27, y: 1.6, z: -1.2 },
};
// (from one rune lighting to the next: as long as the light in the cracks takes from rock to rock,
// going round the way their turns go, the way the angle falls: from the north rock by the west)
const TURN = ROCKS.light + ROCKS.rise + ROCKS.hold + ROCKS.fall + ROCKS.dim + ROCKS.gap;
const TAU = Math.PI * 2;
const SPEED = TAU / ROCK_RING.spots.length / TURN; // (round the ring, a second)
// The cracks (CrackRing): drawn as finely as the floor (textures.js), a little way past the ring
// either side (`margin`), wandering this far off it as a crack does (slowly, and jagging this many
// of its pixels either way), short ones branching off it;
// black, with a shadow along the long one; the light that runs in them (their hearts the runes'
// cyan, the short ones the teal it tints their stone, a faint glow along the long one), its tail
// (how far round the ring it trails behind it), how long it takes from where it kindles to the
// first rock, how quickly it comes up and goes out; and its own light on the floor round it.
const CRACK = {
  px: TEXELS, margin: 0.9, wobble: 0.2, jag: 2.4, branches: 30,
  black: [14, 12, 12], shadow: [52, 46, 42], heart: [10, 250, 245], edge: [24, 176, 166],
  tail: 0.6, first: 1.4, up: 0.35, out: 0.6,
  lamp: { power: 7, reach: 4.5 },
};
// A rock's shockwave (ripple.js, as the Golem's, golem.js): how fast it runs (slower than his, to be
// learnt), how wide its crest strikes, between crests and how many, how high the first, and how far
// it rolls (over the whole of the yard's east end, wherever it starts: it strikes there alone, its
// round end, and past it all but dies away); how near its crest a dodge counts (one away from it
// outruns it a moment, and it would catch thee after); and the dodges in a row the tutorial asks.
const WAVE = { speed: 8, band: 1.2, length: 2.2, crests: 3, amp: 0.45, reach: YARD.halfW + 8, near: 1.8 };
export const DODGES = 3;
// Those training at the rocks (training.js): how many at once, and where they stand (inside the
// ring, toward the gaps between the rocks behind its middle: degrees from the east, round by the
// south, and how far out). They hop each shockwave as fighters do (fight.js): up and down again in
// `dur` seconds, pushing off `lead` seconds before it reaches them; but one time in `miss` too soon,
// `early` seconds before, and down again as it passes, thrown back as a struck fighter is (`knock`).
export const AT_ROCKS = { most: 2, posts: [[-150, 3.6], [-30, 3.6]] };
const HOP = { dur: 0.55, lead: 0.2, miss: 0.2, early: 0.75, knock: 0.175 };
// (how far out of the ring thou mayst stray before it's left: so its edge isn't crossed back and forth)
const OUT = 0.8;

const wrap = (a) => ((a % TAU) + TAU) % TAU;

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
    this.crack = null;
    this.open = true; // (shut, they take no turns: the tutorial's but for its step)
    this.counting = false; // (thy dodges in a row counted at the foot of the screen: the tutorial's step)
    this.mine = false; // thou'rt in the ring
    this.on = false; // someone is
    this.dodged = 0; // in a row (counting)
    this.turn = 0; // (whose is next)
    this.run = null; // the light running round the cracks: from one angle to the next, `dur` seconds
    this.head = 0; // (where it is, round the ring)
    this.level = 0; // (how bright: coming up, going out)
    this.waves = [];
    this.marks = []; // the cracks they leave
    this.hideIn = 0;
    this.el = document.getElementById('dodge-count');
  }

  start() {
    if (this.rocks) return;
    this.rocks = this.ctx.world.yard.rockSpots().map(([x, z], i) => new RuneRock(this, ROCKS.art[i], x, z));
    this.crack = new CrackRing(this);
  }

  // Where rock i stands round the ring (an angle, from the east, round by the south).
  angleOf(i) {
    return (ROCK_RING.spots[i] * Math.PI) / 180;
  }

  // Whether n stands in the ring (once in, `was`, a little way past its edge too).
  inside(n, was = false) {
    const { x, z, r } = this.ctx.world.yard.ring();
    return Math.hypot(n.pos.x - x, n.pos.y - z) < r + (was ? OUT : 0);
  }

  // Where those training stand at the rocks (training.js), facing in.
  posts() {
    const { x, z } = this.ctx.world.yard.ring();
    return AT_ROCKS.posts.map(([deg, d]) => {
      const a = (deg * Math.PI) / 180;
      const px = x + Math.cos(a) * d;
      return { x: px, z: z + Math.sin(a) * d, face: px < x ? 1 : -1 };
    });
  }

  // Whether one is still taking its turn, or its shockwave still rolling.
  get busy() {
    return this.waves.length > 0 || !!this.rocks?.some((r) => r.state !== 'rest');
  }

  update(dt) {
    if (!this.rocks) return;
    const { pilot } = this.ctx;
    const me = pilot.npc;
    const mine = this.open && !!me && !pilot.dead && !me.travel && this.inside(me, this.mine);
    if (mine !== this.mine) {
      this.mine = mine;
      if (mine) {
        this.dodged = 0;
        if (this.counting) this.tally(0);
      } else if (this.dodged < DODGES) this.hideIn = 0; // (three, and it stays a moment: met)
    }
    if (!(mine && this.counting) && this.el && !this.el.hidden) {
      this.hideIn -= dt;
      if (this.hideIn <= 0) this.el.hidden = true;
    }
    this.on = mine || (this.open && this.training.trainees().some((n) => n.trainee.post?.rocks && !n.travel && this.inside(n)));
    this.stepLight(dt);
    for (const r of this.rocks) r.step(dt);
    this.stepWaves(dt);
    this.stepHops(dt);
    this.marks = this.marks.filter((m) => {
      m.t += dt;
      m.crack.opacity = Math.max(0, Math.min(1, (5 - m.t) / 2));
      if (m.t < 5) return true;
      m.crack.dispose();
      return false;
    });
  }

  // The light in the cracks: kindled once someone's in the ring and every rock is at rest, a little
  // way before the next rock's; under each in turn, its rune lighting as it passes (RuneRock.go), on
  // to the next; going out where it is once nobody's in the ring.
  stepLight(dt) {
    let L = this.run;
    if (!L && this.on && this.rocks.every((r) => r.state === 'rest')) {
      const to = this.angleOf(this.turn % this.rocks.length);
      L = this.run = { from: to + SPEED * CRACK.first, to, t: 0, dur: CRACK.first, out: false };
    }
    if (L) {
      L.out = !this.on;
      L.t += dt;
      this.head = L.from + (L.to - L.from) * (L.out ? L.t / L.dur : Math.min(1, L.t / L.dur));
      if (!L.out && L.t >= L.dur) {
        this.rocks[this.turn % this.rocks.length].go();
        this.turn += 1;
        const ahead = wrap(L.to - this.angleOf(this.turn % this.rocks.length)) || TAU;
        this.run = { from: L.to, to: L.to - ahead, t: 0, dur: TURN, out: false };
      }
      this.level = L.out ? Math.max(0, this.level - dt / CRACK.out) : Math.min(1, this.level + dt / CRACK.up);
      if (L.out && this.level <= 0) this.run = null;
    }
    this.crack.set(this.head, this.level);
  }

  // A rock comes down: dust and blue light, a crack glowing its rune's cyan, the view jolted (if
  // thou'rt near), and its shockwave rolling out over the yard's floor (ripple.js); heard crashing.
  crash(rock) {
    const { rig, pilot, world } = this.ctx;
    const { scene, particles } = this.training.fxCtx;
    const { x, z } = rock;
    const ring = world.yard.ring();
    const me = pilot.npc;
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
    if (me && Math.hypot(me.pos.x - ring.x, me.pos.y - ring.z) < YARD.halfW) rig.shake?.(0.35);
    this.marks.push({ crack: new Decal(scene, 'runeCrack', x, z, 3.6, { glow: false }), t: 0 }); // (in its rune's cyan)
    addRipple(x, z, { ...WAVE, floor: 'yard' });
    this.waves.push({ x, z, t: 0, met: false, hops: new Map(), seen: new Set() });
  }

  // Each shockwave rolling out over the floor: as its first crest passes thee (in the yard's east
  // end), a dodge, or a blow; and those training there, hopping it as it comes (hop), or thrown
  // back if they're still on the ground as it passes them.
  stepWaves(dt) {
    const me = this.ctx.pilot.npc;
    const { particles } = this.training.fxCtx;
    const { yard } = this.ctx.world;
    const ring = yard.ring();
    const near = (n) => Math.hypot(n.pos.x - ring.x, n.pos.y - ring.z) < YARD.halfW;
    const theirs = this.training.trainees().filter((n) => !n.travel && !n.piloted && near(n));
    this.waves = this.waves.filter((w) => {
      w.t += dt;
      const r = WAVE.speed * w.t - WAVE.length / 4; // (its first crest, a quarter wavelength behind its front)
      if (r > WAVE.reach) return false;
      const passing = (d) => d <= r && d >= r - WAVE.band - WAVE.speed * dt;
      if (!w.met && me && !me.travel && near(me)) {
        const d = Math.hypot(me.pos.x - w.x, me.pos.y - w.z);
        if (me.action?.kind === 'dodge' && Math.abs(d - r) < WAVE.near) w.dodged = true;
        if (passing(d)) {
          w.met = true;
          this.met(me, w);
        }
      }
      for (const n of theirs) {
        const d = Math.hypot(n.pos.x - w.x, n.pos.y - w.z);
        const ahead = (d - r) / WAVE.speed; // (seconds till it reaches n)
        let when = w.hops.get(n);
        if (when == null && ahead > 0 && ahead < HOP.early) {
          when = Math.random() < HOP.miss ? 'soon' : 'lead';
          w.hops.set(n, when);
        }
        if (when === 'soon' || (when === 'lead' && ahead < HOP.lead)) {
          w.hops.set(n, 'done');
          this.hop(n);
        }
        if (!w.seen.has(n) && passing(d)) {
          w.seen.add(n);
          if (n.lift <= 0.3) this.thrown(n, w);
        }
      }
      // (dust thrown up along the crest, on the floor)
      const a = Math.random() * TAU;
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

  // A shockwave reaches thee: dodged as it came, one more in a row (counted, in the tutorial); else
  // it strikes (red, and thrown back, as a great enemy's blow, but nothing taken: fight.js) and the
  // count starts again.
  met(me, w) {
    const counting = this.counting && this.mine;
    if (w.dodged || me.action?.kind === 'dodge') {
      if (counting && this.dodged < DODGES) {
        this.dodged += 1;
        this.tally(this.dodged);
        if (this.dodged >= DODGES) this.hideIn = ROCKS.linger;
      }
      return;
    }
    this.ctx.fight.hurtPlayer(0, [w.x, w.z]);
    if (!counting) return;
    this.dodged = 0;
    this.tally(0, true);
  }

  // One training pushes off to hop a shockwave (not mid-hop, nor staggering from the last).
  hop(n) {
    if (!n.trainee.hop && !n.action) n.trainee.hop = { t: 0, dur: HOP.dur };
  }

  // Those training up in the air: up and down again as a fighter hops (fight.js), heard pushing off
  // and coming down.
  stepHops(dt) {
    for (const n of this.training.trainees()) {
      const hop = n.trainee.hop;
      if (!hop) continue;
      if (hop.t === 0) this.ctx.sound?.play('step-land', { at: [n.pos.x, n.pos.y], volume: 0.45 });
      hop.t += dt;
      const k = hop.t / hop.dur;
      n.hopLift = k < 1 ? 4 * 0.95 * k * (1 - k) : 0;
      if (k >= 1) {
        n.trainee.hop = null;
        this.ctx.sound?.play('step-land', { at: [n.pos.x, n.pos.y], volume: 0.7 });
      }
    }
  }

  // One training caught by a crest, its hop mistimed: white a moment and thrown back, staggering, as
  // a struck fighter is (fight.js, hurtFighter); nothing taken.
  thrown(n, w) {
    n.body.flash();
    n.body.knock(HOP.knock, Math.sign(n.pos.x - w.x) || -n.body.facing);
    n.stagger();
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
    if (!this.mine || !me) return null;
    const { x, z } = this.ctx.world.yard.ring();
    const k = 0.5;
    return { at: [me.pos.x + (x - me.pos.x) * k, YARD.y + ROCKS.cam.y, me.pos.y + (z + ROCKS.cam.z - me.pos.y) * k], dist: ROCKS.cam.dist, mode: 'rocks' };
  }

  // All of them at rest at once, the light out, their shockwaves and cracks gone, the count away
  // (the tutorial over, or skipped, mid-turn).
  reset() {
    for (const r of this.rocks || []) r.rest();
    for (const m of this.marks) m.crack.dispose();
    this.marks = [];
    this.waves = [];
    clearRipples('yard');
    this.run = null;
    this.level = 0;
    this.crack?.set(this.head, 0);
    this.dodged = 0;
    this.mine = false;
    this.on = false;
    this.counting = false;
    if (this.el) this.el.hidden = true;
  }
}

// The ring's cracks, as drawn (CrackRing): `black`, on the floor (the long one with a shadow along
// it), and `light`, the same in the runes' light (the long one's heart and a faint glow along it,
// the short ones paler); and `rho`, how far out the long one runs at each angle round the ring.
function crackCanvases(seed) {
  const r = rng(seed);
  const P = CRACK.px;
  const S = Math.ceil((ROCK_RING.r + CRACK.margin) * 2 * P);
  const c = S / 2;
  const waves = [[3, 0.5], [7, 0.3], [13, 0.2]].map(([k, w]) => [k, w, r() * TAU]);
  const rho = (a) => ROCK_RING.r + CRACK.wobble * waves.reduce((s, [k, w, ph]) => s + Math.sin(k * a + ph) * w, 0);
  // the long one, a pixel at a time round the ring, with a jag of its own (closing where it began)
  const key = (x, y) => y * S + x;
  const main = new Map();
  const steps = Math.ceil(TAU * ROCK_RING.r * P * 2);
  const jags = [];
  let jag = 0;
  for (let i = 0; i < steps; i++) {
    jag = Math.max(-CRACK.jag, Math.min(CRACK.jag, (jag + (r() - 0.5) * 0.8) * 0.985));
    jags.push(jag);
  }
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    const d = rho(a) * P + jags[i] - (jags[steps - 1] * i) / steps;
    const x = Math.round(c + Math.cos(a) * d - 0.5);
    const y = Math.round(c + Math.sin(a) * d - 0.5);
    main.set(key(x, y), [x, y]);
  }
  // and the short ones off it, slanting out or in
  const along = [...main.values()];
  const branch = new Map();
  for (let b = 0; b < CRACK.branches; b++) {
    let [x, y] = along[Math.floor(r() * along.length)];
    let a = Math.atan2(y - c, x - c) + (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 1.6;
    const len = 3 + Math.floor(r() * 9);
    for (let i = 0; i < len; i++) {
      a += (r() - 0.5) * 0.7;
      x += Math.cos(a);
      y += Math.sin(a);
      const k = key(Math.round(x), Math.round(y));
      if (!main.has(k)) branch.set(k, [Math.round(x), Math.round(y)]);
    }
  }
  const black = canvasOf(S, S, (put) => {
    for (const [x, y] of main.values()) if (!main.has(key(x + 1, y))) put(x + 1, y, CRACK.shadow);
    for (const [x, y] of [...main.values(), ...branch.values()]) put(x, y, CRACK.black);
  });
  const light = canvasOf(S, S, (put) => {
    for (const [x, y] of main.values()) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!main.has(key(x + dx, y + dy))) put(x + dx, y + dy, CRACK.heart, 70);
    }
    for (const [x, y] of branch.values()) put(x, y, CRACK.edge, 230);
    for (const [x, y] of main.values()) put(x, y, CRACK.heart);
  });
  return { black, light, rho };
}

// The ring of cracks the rocks stand on, black in the floor (crackCanvases), and the light that runs
// in them: their hearts lit cyan where it passes, a tail fading behind it (the cracks drawn again in
// light, shown only there: a window on them, round the ring from `uHead`), a glow over it and its own
// light on the floor round it. Both lie on the yard's floor in its group (out of sight with it),
// bending as it ripples.
class CrackRing {
  constructor(ring) {
    const { world } = ring.ctx;
    this.yard = world.yard;
    const { black, light, rho } = crackCanvases(71);
    this.rho = rho;
    const size = black.width / CRACK.px;
    const seg = Math.ceil(size / 0.5);
    const lay = (mat, up) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size, seg, seg), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(ROCK_RING.x, YARD.y + up, ROCK_RING.z);
      m.renderOrder = 3;
      this.yard.group.add(m);
      return m;
    };
    this.dark = lay(rippling(new THREE.MeshLambertMaterial({ map: texture(black), transparent: true, alphaTest: 0.5, depthWrite: false })), 0.016);
    this.uniforms = { uHead: { value: 0 }, uTail: { value: CRACK.tail }, uLit: { value: 0 } };
    const mat = rippling(new THREE.MeshBasicMaterial({ map: texture(light), transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.15, 1.3, 1.3) }));
    const bend = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader) => {
      bend(shader);
      Object.assign(shader.uniforms, this.uniforms);
      // (where each point of it lies round the ring: its plane, laid on the floor, has its y to the north)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vRing;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRing = vec2(position.x, -position.y);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uHead;\nuniform float uTail;\nuniform float uLit;\nvarying vec2 vRing;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          {
            // how far round the ring behind the light (it runs the way the angle falls), and ahead
            float behind = mod(atan(vRing.y, vRing.x) - uHead, 6.2831853);
            float ahead = 6.2831853 - behind;
            float lit = max(behind < uTail ? pow(1.0 - behind / uTail, 1.6) : 0.0, 1.0 - smoothstep(0.0, 0.035, ahead));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.6 * (1.0 - smoothstep(0.0, 0.08, behind)));
            diffuseColor.a *= lit * uLit;
          }`);
    };
    mat.customProgramCacheKey = () => 'ripple-crack-light';
    this.lit = lay(mat, 0.02);
    this.spark = new THREE.Sprite(new THREE.SpriteMaterial({
      map: world.tex.glow, color: ROCKS.glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.spark.scale.set(1.1, 1.1, 1);
    this.spark.renderOrder = 5;
    this.yard.group.add(this.spark);
    this.lamp = null;
    this.set(0, 0);
  }

  // Where the light is at angle `a` round the ring: [x, z] in the world.
  at(a) {
    const { x, z } = this.yard.ring();
    const d = this.rho(a);
    return [x + Math.cos(a) * d, z + Math.sin(a) * d];
  }

  // The light at `head` round the ring, `level` bright (0: out, the cracks dark).
  set(head, level) {
    const on = level > 0.001;
    this.uniforms.uHead.value = head;
    this.uniforms.uLit.value = level;
    this.lit.visible = on;
    this.spark.visible = on;
    if (!on) {
      this.lamp?.end(0.1);
      this.lamp = null;
      return;
    }
    const [x, z] = this.at(head);
    this.spark.position.set(x - this.yard.cx, YARD.y + 0.2, z - this.yard.cz);
    this.spark.material.opacity = 0.75 * level;
    this.lamp ??= carry(null, [x, YARD.y + 0.5, z], { color: ROCKS.glow, power: CRACK.lamp.power, reach: CRACK.lamp.reach, level: 0 });
    this.lamp.at(x, YARD.y + 0.5, z);
    this.lamp.level = level;
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
// walking off its spot); its turn (go, as the light in the cracks passes under it): its rune lit,
// its own blue light coming up round it, lifted, held up, dropped (RockRing.crash), and its light
// dying. Heard (audio.js, rock-…): its rune lighting, humming as it's lifted and held up (the hum
// hushed as it drops), rushing down.
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
