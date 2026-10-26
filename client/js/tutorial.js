// The tutorial, on the first journey (main.js, begin): Maren at Roundtable Hold with nothing else
// about (no island risen, the training yard out of sight), and the Lands Between held back
// meanwhile (`holding`: no Tarnished at the Round Table, no session taken up, no phantoms, no great
// enemy coming: main.js). Step by step:
//   move     at the Hold: walking, W A S D or the arrows, till every way has been tried, and with
//            Shift held, sprinting;
//   dummies  through black, on the training yard, emptied of all but three straw dummies
//            (training.js, lessonStart): break them, with a left click (or a right one too, for
//            whoever casts: combat.js, canCast);
//   rocks    up a stair to the next yard (climb.js), three rune rocks round its middle: in turn each
//            one's rune lights, it's lifted in blue magic, held up a second and dropped, and its
//            shockwave ripples out over the whole floor (ripple.js); a dodge (Space) through it,
//            three in a row (one that lands strikes as a great enemy's blow would, red and all, but
//            takes no health);
//   boss     up another to the last yard, the great dummy: blows on its cracked ankle fill thine
//            ultimate and hurt it no more, and once it's full, R breaks it at a stroke (training.js,
//            lesson); here too the hint for Q, the camera's focus on it (no longer in a fight);
//   gesture  through black, back at the Hold: thy fan of gestures (B), and one of them, a click on
//            it or its number (1 to 8);
//   become   a hero rises from grace beside thee and waits: a click on them, then on "Become";
//   island   Maren, let go, sets out for an island that rises for her and works there (why they
//            go, and where they go with nothing to do); and it's done: again, or on into the world.
// The yards are climbed on foot (climb.js): a yard's step done, the fog at the foot of the stair up
// from it thins away and the golden arrow shows the way (guide.js, route); come up onto the next, the
// fog closes behind thee, and its step begins. Each step lets through what it teaches and what came
// before (allows: main.js, input.js), and keeps thee to the place it's in (fence: pilot.js). "Skip
// tutorial", at the bottom right, ends it at any step. Done or skipped, it's remembered and comes no
// more of itself; it's walked again from the training yard's grace (main.js) or with "Do it again",
// the page loaded afresh for it (gate.js). The words to read are the user's own; the keys to press
// are drawn as keys (game.css, .key).

import * as THREE from 'three';
import { YARD } from './yard.js';
import { fxArt } from './fxart.js';
import { texture, Decal } from './bossfx.js';
import { addRipple, rippleBounds, rippleAt, clearRipples } from './ripple.js';
import { carry, flash } from './lights.js';
import { canCast } from './combat.js';
import { groundAt } from './ground.js';
import { HUB_LAYOUT, ARENA, REGION } from './config.js';
import { AGAIN } from './gate.js';
import { Climb, CLIMB } from './climb.js';

const DONE = 'elden-code:tutorial'; // (localStorage: 'done', once walked or skipped)
// The black between steps: how long it takes to fall, and how long it holds before lifting.
const FADE = { out: 0.6, hold: 0.35 };
// The yards climbed (climb.js): the training yard, the rocks', the great dummy's.
const [, ROCK_YARD, GREAT_YARD] = CLIMB.yards;
// Where thou standest: by the Hold's grace (as thou risest there), or from the training yard's
// middle; the straw dummies' spots before thee, and how many of thy hits (blows or spells) break
// each (the training yard's own take four blows, or five spells: training.js).
const SPOT = { hold: [1.6, 1.8], dummies: [0, 5.5] };
const DUMMIES = [[-3.6, 1], [0, 0], [3.6, 1]];
const DUMMY_HITS = 2;
// The rune rocks (fx/rune-rock-*.json: dark, and the rune alight): each one's drawing and where it
// stands round the middle of its yard (degrees from the east, round by the south, `spread` out from
// the middle), how big they're drawn (world units to their drawing's pixel), how much of the floor
// each takes up (of its width), how high it's lifted, and how long each part of its turn lasts (the
// rune lighting, lifted, held up, falling, its light dying away), the pause before the next one's,
// and before the first, once thou'rt shut in; its blue light and motes; and where the camera looks
// from meanwhile (how far back, how high, and how far north of the yard's middle: aim).
const ROCKS = {
  spots: [['rune-rock-2', -90], ['rune-rock-1', 150], ['rune-rock-3', 30]], spread: 7.6,
  px: 0.038, block: 0.34, lift: 2.4,
  cam: { dist: 27, y: 1.6, z: -1.2 },
  light: 0.45, rise: 0.9, hold: 1, fall: 0.3, dim: 0.6, gap: 0.9, first: 1,
  glow: '#53e8ff', motes: ['#7ff6ff', '#2fd8ff', '#c8fbff'],
};
// A rock's shockwave (ripple.js, as the Golem's, golem.js): how fast it runs (slower than his, to be
// learnt), how wide its crest strikes, between crests and how many, how high the first, and how far
// it rolls (over the whole floor, wherever it starts); how near its crest a dodge counts (one away
// from it outruns it a moment, and it would catch thee after); and the dodges in a row it takes.
const WAVE = { speed: 8, band: 1.2, length: 2.2, crests: 3, amp: 0.45, reach: ROCK_YARD.R + 8, near: 1.8 };
const DODGES = 3;
// The island Maren sets out for (its project's name), and how much more than it the camera takes in.
const ISLAND = { project: 'your-project', margin: 4 };
// The ways to walk, each by its letter and its arrow.
const WAYS = { KeyW: 'up', ArrowUp: 'up', KeyA: 'left', ArrowLeft: 'left', KeyS: 'down', ArrowDown: 'down', KeyD: 'right', ArrowRight: 'right' };
// What each step lets through (and the sound's key, always: allows).
const ALLOWS = {
  move: ['move'],
  dummies: ['move', 'attack', 'spell'],
  rocks: ['move', 'attack', 'spell', 'dodge'],
  boss: ['move', 'attack', 'spell', 'dodge', 'ult', 'focus'],
  gesture: ['move', 'fan', 'emote'],
  become: ['move', 'pick'],
  island: [],
};

function h(tag, cls, ...kids) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) e.append(k);
  return e;
}
// A key, drawn as the keys over the screen are (game.css, .key; `way`: the way it walks); four of
// them as on a keyboard (W over A S D, or the arrows); the mouse, its left or right button lit.
function key(label, way = null, wide = false) {
  const k = h('kbd', wide ? 'key wide' : 'key', label);
  if (way) k.dataset.way = way;
  return k;
}
const cluster = (keys) => h('span', 'keys', ...keys.map(([label, way]) => key(label, way)));
const mouse = (button) => h('span', `mouse ${button}`, h('i', 'left'), h('i', 'right'));

function remember() {
  try { localStorage.setItem(DONE, 'done'); } catch {}
}

export class Tutorial {
  constructor(ctx, { again = false } = {}) {
    this.ctx = ctx;
    this.again = again;
    let seen = false;
    try { seen = localStorage.getItem(DONE) === 'done'; } catch {}
    // (asked for again, or by ?tutorial in the address; else on the first journey only)
    this.holding = again || new URLSearchParams(window.location.search).has('tutorial') || !seen;
    this.step = null;
    this.phase = null;
    this.t = 0;
    this.busy = false; // (between steps, in the black: nothing gets through)
    this.fading = null; // 'out' (falling), 'dark' (held)
    this.fence = null; // where thou mayst stand (pilot.js)
    this.markAt = null; // where the mark over what's to be struck or clicked goes (placeMark)
    this.climb = null; // its yards above the training yard (climb.js), while thou'rt on them
    this.at = 0; // the yard thou'rt on (0: the training yard, 1: the rocks', 2: the great dummy's)
    this.open = false; // its way up open (its step done)
    this.rocks = null;
    this.great = null; // (the great dummy, on the last yard: training.js)
    this.waves = [];
    this.marks = []; // the cracks the rocks leave
    this.v = new THREE.Vector3();
    const root = document.getElementById('tutorial');
    this.el = {
      root,
      fade: document.getElementById('tut-fade'),
      prompt: root.querySelector('.tut-prompt'),
      count: root.querySelector('.tut-count'),
      mark: root.querySelector('.tut-mark'),
      card: root.querySelector('.tut-card'),
      skip: root.querySelector('.tut-skip'),
      hint: document.getElementById('focus-hint'),
    };
    // (asked for again, the page comes up black, and begin brings the world in)
    if (again) this.el.fade.classList.add('on');
    this.el.skip.addEventListener('click', () => { this.el.skip.blur(); this.finish(); });
    this.el.hint.addEventListener('click', () => ctx.training.toggleFocus(ctx.pilot.npc));
    window.addEventListener('keydown', (e) => this.key(e));
  }

  // Whether `kind` may be done just now (input.js, main.js): anything, but in the tutorial what its
  // step allows, and nothing in the black between steps (the sound, V, always).
  allows(kind) {
    if (!this.holding || kind === 'sound') return true;
    if (this.busy || !this.step) return false;
    return ALLOWS[this.step].includes(kind);
  }

  // Whether `npc` may be clicked (inspected, its fan opened) and become: in the tutorial, its hero.
  pickable(npc) {
    return !this.holding || (this.step === 'become' && npc === this.hero);
  }

  // Thou risest at grace (main.js): the first step, the yard emptied and out of sight.
  begin() {
    if (!this.holding) return;
    document.body.classList.add('tutorial');
    this.el.root.hidden = false;
    this.ctx.training.lessonStart();
    this.show('hold');
    this.go('move');
    if (this.again) setTimeout(() => this.el.fade.classList.remove('on'), 300);
  }

  // Only the place a step is in shows: the Hold, or the yards (the training yard, without its stair
  // up to the Hold, and those climbed from it); and thou keepest to it (on the yards, to the one
  // thou'rt on, and once its step is done, the stair up from it and the yard it comes up onto:
  // onClimb).
  show(place) {
    const { world } = this.ctx;
    world.hub.group.visible = place === 'hold';
    world.yard.group.visible = place === 'yards';
    world.yard.stair.visible = place !== 'yards';
    this.fence = place === 'yards' ? (x, z) => this.onClimb(x, z) : (x, z) => world.hub.contains(x, z);
  }

  onClimb(x, z) {
    const c = this.climb;
    if (!c) return this.ctx.world.yard.inside(x, z);
    if (c.inYard(this.at, x, z)) return true;
    return this.open && (c.onStair(this.at, x, z) || c.inYard(this.at + 1, x, z));
  }

  go(step) {
    this.step = step;
    this.phase = null;
    this.said = null; // (what its words last said)
    this.t = 0;
  }

  // On to the next step, through the black: `setup` in it (where thou standest, what's set out).
  next(step, setup) {
    this.hush();
    this.markAt = null;
    this.fade(() => {
      setup();
      this.go(step);
    });
  }

  // The screen goes black, `between` is done in the black, and it lifts. Asked for again while it
  // falls, the last asked is done in that black instead; while it's held, at once.
  fade(between) {
    const run = (fn) => {
      try { fn(); } catch (err) { console.error('The tutorial stumbled (it carries on):', err); }
    };
    if (this.fading === 'dark') { run(between); return; }
    this.between = between;
    if (this.fading) return;
    this.fading = 'out';
    this.busy = true;
    this.ctx.pilot.keys.clear();
    const el = this.el.fade;
    el.classList.add('on');
    setTimeout(() => {
      this.fading = 'dark';
      const fn = this.between;
      this.between = null;
      run(fn);
      setTimeout(() => {
        el.classList.remove('on');
        this.fading = null;
        this.busy = false;
      }, FADE.hold * 1000);
    }, FADE.out * 1000);
  }

  // Thou, set down at (x, z), the camera with thee at once.
  place(x, z, facing = 1) {
    const { pilot, rig, world } = this.ctx;
    const n = pilot.npc;
    if (!n) return;
    n.action = null;
    n.path = [];
    n.goal = null;
    n.pos.set(x, z);
    n.body.facing = facing;
    const here = world.areaAt(x, z);
    if (n.isMaren && here?.walkRect) n.region = here;
    rig.target.set(x, groundAt(x, z) + 0.8, z - 0.6);
    rig.snap();
  }

  // By the Hold's grace, where thou risest.
  holdSpot() {
    const [gx, gz] = HUB_LAYOUT.grace;
    return this.ctx.nav.clampToWalkable(gx + SPOT.hold[0], gz + SPOT.hold[1]);
  }

  // What to do, at the foot of the screen: words, and the keys to press drawn as keys, on a line of
  // their own after each '\n' (`above`: a smaller line over them).
  say(parts, above = '') {
    const p = this.el.prompt;
    p.replaceChildren();
    if (above) p.append(h('small', '', above));
    let line = h('div', 'line');
    p.append(line);
    for (const x of parts) {
      if (x === '\n') {
        line = h('div', 'line');
        p.append(line);
      } else line.append(typeof x === 'string' ? h('span', '', x) : x);
    }
    p.hidden = false;
    p.classList.remove('in');
    void p.offsetWidth;
    p.classList.add('in');
  }

  hush() {
    this.el.prompt.hidden = true;
    this.el.count.hidden = true;
  }

  // ------------------------------------------------------------------------------------------
  // each frame (main.js): `dt` the world's time (still while it's held, a blow landing or an
  // ultimate gathering), `real` the time that's passed

  update(dt, real = dt) {
    if (!this.holding || !this.step || this.ending) return;
    if (this.busy) return;
    this.t += real;
    switch (this.step) {
      case 'move': this.stepMove(); break;
      case 'dummies': this.stepDummies(); break;
      case 'rocks': this.stepRocks(dt); break;
      case 'boss': this.stepBoss(); break;
      case 'gesture': this.stepGesture(); break;
      case 'become': this.stepBecome(); break;
      case 'island': this.stepIsland(); break;
      default: break;
    }
  }

  // move: the keys shown once Maren has risen at grace, each way lit as it's tried, and Shift once
  // thou'st sprinted with it; on once all have been.
  stepMove() {
    const { pilot } = this.ctx;
    if (!this.phase && this.t > 1.6) {
      this.phase = 'keys';
      this.ways = new Set();
      this.say([
        'Move around with', cluster([['W', 'up'], ['A', 'left'], ['S', 'down'], ['D', 'right']]), 'or', cluster([['↑', 'up'], ['←', 'left'], ['↓', 'down'], ['→', 'right']]),
        '\n', 'Hold', key('Shift', 'sprint', true), 'to sprint',
      ]);
    }
    if (this.phase === 'keys' && pilot.moving && pilot.heading().run) this.lit('sprint');
    if (this.phase === 'keys' && this.ways.size === 5) {
      this.phase = 'done';
      this.doneAt = this.t;
    }
    if (this.phase === 'done' && this.t - this.doneAt > 0.9) this.next('dummies', () => this.setDummies());
  }

  key(e) {
    if (this.step !== 'move' || this.phase !== 'keys' || this.busy || e.ctrlKey || e.metaKey || e.altKey) return;
    if (WAYS[e.code]) this.lit(WAYS[e.code]);
  }

  // A way tried (or the sprint): its keys lit.
  lit(way) {
    if (this.ways.has(way)) return;
    this.ways.add(way);
    for (const k of this.el.prompt.querySelectorAll(`[data-way="${way}"]`)) k.classList.add('on');
  }

  // dummies: in the black, the yards to climb set out (climb.js): on the training yard three straw
  // dummies before thee, broken ones staying in pieces; on the next the rune rocks; on the last the
  // great dummy, put away till thou comest up to it. Every way off the training yard is shut in fog.
  setDummies() {
    const { training, world } = this.ctx;
    this.climb = new Climb(world);
    this.at = 0;
    this.open = false;
    this.seal(true);
    this.show('yards');
    this.place(SPOT.dummies[0], CLIMB.z + SPOT.dummies[1]);
    this.dummies = DUMMIES.map(([x, z]) => training.addDummy(x, CLIMB.z + z, { hits: DUMMY_HITS }));
    this.rocks = ROCKS.spots.map(([k, deg]) => {
      const a = (deg * Math.PI) / 180;
      return new RuneRock(this, k, ROCK_YARD.cx + Math.cos(a) * ROCKS.spread, CLIMB.z + Math.sin(a) * ROCKS.spread, ROCK_YARD);
    });
    this.great = training.addDummy(GREAT_YARD.cx, CLIMB.z, { great: true, on: this.climb, y: GREAT_YARD.y });
    this.great.putAway(true);
  }

  stepDummies() {
    if (this.phase === 'climb') { this.climbOn(); return; }
    if (!this.phase) {
      this.phase = 'strike';
      const parts = canCast(this.ctx.pilot.npc) ? ['Attack with', mouse('left'), 'or', mouse('right')] : ['Attack with', mouse('left')];
      this.say(parts, 'Destroy the three dummies');
    }
    if (this.phase === 'strike' && this.dummies.every((d) => d.broken)) {
      this.phase = 'done';
      this.doneAt = this.t;
    }
    if (this.phase === 'done' && this.t - this.doneAt > 1.4) this.openUp();
  }

  // ------------------------------------------------------------------------------------------
  // the climb (climb.js)

  // The walls of fog as things stand: at the foot of each stair up still ahead (gone from the one up
  // from thy yard once its step is done), and at the head of each come up, behind thee (`now`: at
  // once).
  seal(now = false) {
    const c = this.climb;
    if (!c) return;
    c.stairs.forEach((s, k) => {
      c.seal(s.foot, k > this.at || (k === this.at && !this.open), now);
      c.seal(s.head, k < this.at, now);
    });
  }

  // A yard's step done: the fog at the foot of the stair up from it thins away, and the golden arrow
  // shows the way (route).
  openUp() {
    this.open = true;
    this.phase = 'climb';
    this.hush();
    this.markAt = null;
    this.seal();
  }

  // On the way up: come up onto the next yard, and its step begins (reach).
  climbOn() {
    const me = this.ctx.pilot.npc;
    if (me && this.climb?.arrivedOn(this.at + 1, me.pos.x, me.pos.y)) this.reach(this.at + 1);
  }

  // Up onto yard k: the fog closes behind thee, what's done on the yard is set on its floor
  // (training.js), and its step begins: the rocks (the floor rippling under their shockwaves:
  // ripple.js), then the great dummy.
  reach(k) {
    const { training, world } = this.ctx;
    const Y = CLIMB.yards[k];
    this.at = k;
    this.open = false;
    this.seal();
    training.setFloor(Y.y);
    clearRipples();
    if (k === 1) {
      rippleBounds(Y.cx, CLIMB.z, Y.R);
      this.go('rocks');
    } else {
      rippleBounds(world.arena.cx, world.arena.cz, ARENA.radius);
      this.go('boss');
    }
  }

  // The way on from where `me` stands, for the golden arrow (guide.js): up the stair from thy yard
  // onto the next, once its step is done; only what's still ahead of thee (the stair's foot, passed,
  // would turn the arrow back down it: the way runs east, so a point behind is one west of thee).
  route(me) {
    if (!this.holding || !this.climb || !this.open || this.busy || this.ending || !me) return null;
    const s = CLIMB.stairs[this.at];
    const way = [[s.x0 - 0.6, CLIMB.z], [s.x1 + 0.6, CLIMB.z], [s.x1 + 3, CLIMB.z]];
    return way.filter(([x], i) => x > me.pos.x + 0.3 || i === way.length - 1);
  }

  // The climb taken away (back at the Hold, or the tutorial over): its rocks, its dummies, its
  // yards; what's done on the yard set on the training yard's floor again, which ripples no more.
  leaveClimb() {
    const { training, world } = this.ctx;
    this.clearRocks();
    for (const d of [...(this.dummies || []), ...(this.great ? [this.great] : [])]) training.removeDummy(d);
    this.dummies = null;
    this.great = null;
    training.setFloor(YARD.y);
    rippleBounds(world.arena.cx, world.arena.cz, ARENA.radius);
    this.climb?.remove();
    this.climb = null;
    this.at = 0;
    this.open = false;
  }

  // rocks: shut in on their yard, its ways out in fog, three rune rocks round its middle take their
  // turns, one after another.
  stepRocks(dt) {
    if (!this.phase) {
      this.phase = 'dodge';
      this.waves = [];
      this.dodged = 0;
      this.turn = 0;
      this.wait = ROCKS.first;
      this.say(['Dodge with', key('Space', null, true), 'to not get hit']);
      this.tally(0);
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
    if (this.phase === 'climb') { this.climbOn(); return; }
    const going = this.rocks.some((r) => r.state !== 'rest');
    if (this.phase === 'dodge') {
      if (this.dodged >= DODGES) { this.phase = 'done'; return; }
      // (one at a time, a moment apart)
      if (going) return;
      this.wait -= dt;
      if (this.wait > 0) return;
      this.rocks[this.turn % this.rocks.length].go();
      this.turn += 1;
      this.wait = ROCKS.gap;
    } else if (this.phase === 'done' && !going) {
      this.phase = 'over';
      this.doneAt = this.t;
    } else if (this.phase === 'over' && this.t - this.doneAt > 1.2) {
      this.openUp();
    }
  }

  // A rock comes down: dust and blue light, a crack, the view jolted, and its shockwave; heard crashing.
  crash(rock) {
    const { training, rig } = this.ctx;
    const { scene, particles } = training.fxCtx;
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
    flash(null, [x, rock.Y.y + 0.8, z + 0.3], { color: ROCKS.glow, power: 26, reach: 10, life: 0.45 });
    rig.shake?.(0.35);
    this.marks.push({ crack: new Decal(scene, 'crack', x, z, 3.6, { glow: false }), t: 0 });
    this.waves.push({ ripple: addRipple(x, z, WAVE), x, z, met: false });
  }

  // Each shockwave rolling out over the floor: as its first crest passes thee, a dodge, or a blow.
  stepWaves(dt) {
    const me = this.ctx.pilot.npc;
    const { particles } = this.ctx.training.fxCtx;
    this.waves = this.waves.filter((w) => {
      const r = w.ripple.front - WAVE.length / 4; // (the first crest, a quarter wavelength behind the front)
      if (r > WAVE.reach) return false;
      if (!w.met && me && !me.travel) {
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
      if (r > 0 && Math.random() < 0.9 && Math.hypot(px - ROCK_YARD.cx, pz - CLIMB.z) < ROCK_YARD.R - 0.6) {
        particles.emit({
          pos: [px, rippleAt(px, pz) + 0.15, pz], spread: [0.3, 0.1, 0.3], vel: [Math.cos(a) * 2, 1.4, Math.sin(a) * 2],
          velSpread: [0.6, 0.6, 0.6], color: ['#8a7a6a', '#5a4a3e', '#c8b8a0'], size: 0.14, life: 0.7, count: 3, drag: 1.4, intensity: 0.9,
        });
      }
      return true;
    });
  }

  // A shockwave reaches thee: dodged as it came, one more in a row; else it strikes (red, and thrown
  // back, as a great enemy's blow, but nothing taken: fight.js) and the count starts again.
  met(me, w) {
    if (this.phase !== 'dodge') return;
    if (w.dodged || me.action?.kind === 'dodge') {
      this.dodged += 1;
      this.tally(this.dodged);
      return;
    }
    this.dodged = 0;
    this.tally(0, true);
    this.ctx.fight.hurtPlayer(0, [w.x, w.z]);
  }

  // The dodges in a row, under the words: 0 / 3, and a pip for each.
  tally(n, struck = false) {
    const c = this.el.count;
    const pips = h('span', 'pips', ...Array.from({ length: DODGES }, (_, i) => h('i', i < n ? 'on' : '')));
    c.replaceChildren(h('b', '', String(n)), h('span', '', ` / ${DODGES}`), pips);
    c.hidden = false;
    c.classList.remove('struck', 'up');
    void c.offsetWidth;
    if (struck) c.classList.add('struck');
    else if (n) c.classList.add('up');
  }

  clearRocks() {
    for (const r of this.rocks || []) r.dispose();
    this.rocks = null;
    for (const m of this.marks) m.crack.dispose();
    this.marks = [];
    this.waves = [];
    clearRipples();
  }

  // boss: shut in on the last yard, the great dummy comes a moment after, in a puff of dust, and
  // thine ultimate's bar with it, empty.
  stepBoss() {
    const { training, pilot, ults, rig } = this.ctx;
    const g = this.great;
    if (!g) { this.next('gesture', () => this.setHold()); return; }
    if (!this.phase) {
      if (this.t < 0.7) return;
      g.putAway(false);
      training.dust(g);
      rig.shake?.(0.25);
      pilot.ult = 0;
      training.lesson.ult = true;
      training.focusUsed = false;
      this.phase = 'ankle';
      this.said = null;
    }
    const full = (pilot.ult || 0) >= 1;
    if (this.phase === 'ankle' || this.phase === 'ult') {
      if (g.broken) {
        this.phase = 'broken';
        this.doneAt = this.t;
        this.hush();
        this.markAt = null;
      } else {
        this.phase = full || ults.active ? 'ult' : 'ankle';
      }
    }
    // the words for what's to do now (said again only when that changes)
    if (this.phase !== this.said && this.phase !== 'broken') {
      this.said = this.phase;
      if (this.phase === 'ankle') {
        this.say(['Strike its cracked ankle'], 'The great dummy');
        this.markAt = () => {
          const [ax, ay] = g.ankle();
          return [ax, g.y + ay + 0.35, g.pos.y + 0.3];
        };
      } else {
        this.say(['Use your ultimate attack with', key('R')]);
        this.markAt = null;
      }
    }
    this.el.hint.hidden = this.phase !== 'ankle' || !!training.focusUsed || !!ults.active;
    if (this.phase === 'broken' && this.t - this.doneAt > 2.4) this.next('gesture', () => this.setHold());
  }

  // In the black, the yards taken away; back at the Hold, by its grace, as at first.
  setHold() {
    const { training } = this.ctx;
    if (training.lesson) training.lesson.ult = false;
    this.el.hint.hidden = true;
    this.leaveClimb();
    this.show('hold');
    const [x, z] = this.holdSpot();
    this.place(x, z);
  }

  // gesture: thy fan of gestures over thy head, opened with B (ui.js), and one of them made (a click
  // on it, or its number); a moment to see it, and on to the hero rising (no black: the same place).
  stepGesture() {
    const { pilot, ui } = this.ctx;
    const me = pilot.npc;
    if (!this.phase) {
      if (this.t < 0.6) return;
      this.phase = 'open';
    }
    if (this.phase === 'open' || this.phase === 'pick') {
      if (me?.action?.kind === 'gesture') {
        this.phase = 'done';
        this.doneAt = this.t;
        this.hush();
        return;
      }
      const phase = ui.fanOwner && ui.fanOwner === me ? 'pick' : 'open';
      if (phase !== this.said) {
        this.said = phase;
        this.say(phase === 'pick' ? ['Choose a gesture with', mouse('left'), 'or', key('1'), '–', key('8')] : ['Open your gestures with', key('B')]);
      }
      this.phase = phase;
    }
    if (this.phase === 'done' && this.t - this.doneAt > 1.6) {
      ui.closeFan();
      this.go('become');
    }
  }

  // become: a hero rises from grace beside thee, and waits to be clicked, and become.
  stepBecome() {
    const { pilot, ui } = this.ctx;
    if (!this.phase) {
      if (this.t < 0.5) return;
      this.hero = this.raiseHero();
      if (!this.hero) { this.finish(); return; } // (no hero's art: nothing to become)
      this.phase = 'rise';
    }
    const n = this.hero;
    if (pilot.npc === n) {
      this.markAt = null;
      this.go('island');
      return;
    }
    if (this.phase === 'rise' && this.t > 2.4) this.phase = 'click';
    if (this.phase === 'click' || this.phase === 'fan') {
      const phase = ui.fanOwner === n ? 'fan' : 'click';
      if (phase !== this.said) {
        this.said = phase;
        const name = n.name.first;
        this.say(phase === 'fan' ? [mouse('left'), `Now click “Become ${name}”`] : [mouse('left'), `Click on ${name} to become them`]);
        this.markAt = phase === 'fan' ? null : () => {
          const p = n.head();
          return [p.x, p.y + 0.5, p.z];
        };
      }
      this.phase = phase;
    }
  }

  // A hero of the Round Table (one not two in one: the Twofold, the Witch), at random: rising from
  // grace beside thee (npc.js, spawn), and waiting there for thee (npc.js, 'stand').
  raiseHero() {
    const { director, nav, pilot } = this.ctx;
    const ids = (this.ctx.heroSheets || []).filter((s) => !s.rig.pair).map((s) => s.hero);
    const me = pilot.npc;
    if (!ids.length || !me) return null;
    const id = ids[Math.floor(Math.random() * ids.length)];
    director.start((x) => x === id);
    const n = director.heroes.get(id);
    if (!n) return null;
    const [x, z] = nav.clampToWalkable(me.pos.x + 3.4, me.pos.y + 0.4);
    n.releaseSlot();
    n.pos.set(x, z);
    n.setIntent({ kind: 'stand' });
    n.body.facing = me.pos.x < x ? -1 : 1;
    n.spawn(true);
    return n;
  }

  // island: Maren, let go, waits as an island rises for her, then sets out to work there; then why,
  // and it's done.
  stepIsland() {
    const { world, director, nav, ui } = this.ctx;
    const maren = director.maren;
    const free = maren && !maren.piloted && !maren.dead;
    if (!this.phase) {
      this.phase = 'rise';
      this.hush();
      const { region, created } = world.regionFor(ISLAND.project);
      this.island = region;
      if (created) {
        region.sink();
        nav.sync();
        this.ctx.onWorldGrew?.();
      }
      director.queueRise(region, true, true);
      if (free) {
        maren.setIntent({ kind: 'stand' });
        maren.body.facing = region.cx > maren.pos.x ? 1 : -1;
        director.remark(maren, 'depart', null, 0.8);
      }
    }
    if (this.phase === 'rise' && this.island.risen) {
      this.phase = 'work';
      this.doneAt = this.t;
      if (free) {
        maren.region = this.island;
        maren.setIntent({ kind: 'work', station: 'forge' });
        ui.log(`${maren.name.first} takes up a quest in ${this.island.project}`, 'gold', maren);
      }
    }
    if (this.phase === 'work' && this.t - this.doneAt > 1.4) {
      this.phase = 'why';
      this.card('why');
    }
  }

  // The cards over the island: why the Tarnished go to the islands (and where with nothing to do);
  // then done, again or on.
  card(kind) {
    const c = this.el.card;
    c.replaceChildren();
    if (kind === 'why') {
      c.append(
        h('h3', '', 'Islands and quests'),
        h('p', '', 'Every island is a project you work on with Claude Code. When one of its sessions starts, a Tarnished takes up the quest and goes there to work: at the forge while Claude edits files, in the scriptorium while it reads, at the ritual circle while it runs commands. Maren has just gone to work on this one.'),
        h('p', '', 'Those with no quest of their own rest at grace or sit at the Round Table, and now and then go down to the training yard to train.'),
        h('div', 'tut-actions', this.button('Continue', () => this.card('done'))),
      );
    } else {
      this.el.skip.hidden = true;
      c.append(
        h('h3', '', 'Tutorial completed'),
        h('p', '', 'You can walk it again whenever you like, at the grace of the training yard.'),
        h('div', 'tut-actions', this.button('Do it again', () => this.replay()), this.button('Move on', () => this.finish())),
      );
    }
    c.hidden = false;
    c.classList.remove('in');
    void c.offsetWidth;
    c.classList.add('in');
  }

  button(text, act) {
    const b = h('button', '', text);
    b.type = 'button';
    b.addEventListener('click', () => {
      b.blur();
      act();
    });
    return b;
  }

  // Where the camera looks (main.js): with the rocks, between thee and the middle of their yard,
  // from far enough back that one lifted stays in the clear middle of the view; in the last step,
  // the island and Maren on it, all of it in view; else as ever.
  aim(me) {
    if (!this.holding || this.ending) return null;
    if (this.step === 'rocks' && this.phase !== 'climb' && me) {
      const Y = ROCK_YARD;
      const k = 0.5;
      return { at: [me.pos.x + (Y.cx - me.pos.x) * k, Y.y + ROCKS.cam.y, me.pos.y + (CLIMB.z + ROCKS.cam.z - me.pos.y) * k], dist: ROCKS.cam.dist, mode: 'rocks' };
    }
    const r = this.island;
    if (this.step !== 'island' || !r) return null;
    const cam = this.ctx.rig.camera;
    const across = 2 * Math.tan((cam.fov * Math.PI) / 360) * cam.aspect; // (the width seen, per unit away)
    const dist = Math.min(80, Math.max(30, (2 * REGION.halfW + ISLAND.margin) / across));
    return { at: [r.cx, 1, r.cz], dist, mode: 'island' };
  }

  // The mark over what's to be struck or clicked, kept there as the camera moves (main.js, each
  // frame, after the camera).
  placeMark() {
    const m = this.el.mark;
    const at = this.holding && !this.busy && this.markAt?.();
    if (!at) { m.hidden = true; return; }
    const p = this.ctx.ui.project(this.v.set(at[0], at[1], at[2]));
    m.hidden = p.behind;
    m.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
  }

  // ------------------------------------------------------------------------------------------
  // the end

  // Again, from the start (the end's "Do it again", or the training yard's grace): the page loads
  // afresh for it (gate.js), from black.
  replay() {
    remember();
    try { sessionStorage.setItem(AGAIN, '1'); } catch {}
    this.el.card.hidden = true;
    this.el.fade.classList.add('on');
    setTimeout(() => window.location.reload(), FADE.out * 1000);
  }

  // Over (moved on, or skipped): remembered; all of it taken away in the black, thou at the Hold
  // whoever thou art, and the Lands Between set going (main.js, onDone).
  finish() {
    if (!this.holding || this.ending) return;
    this.ending = true;
    remember();
    this.hush();
    this.markAt = null;
    this.el.card.hidden = true;
    this.el.skip.hidden = true;
    this.el.hint.hidden = true;
    this.fade(() => {
      this.clear();
      this.holding = false;
      this.step = null;
      this.el.root.hidden = true;
      document.body.classList.remove('tutorial');
      this.onDone?.();
    });
  }

  // Everything of the tutorial's taken away: its yards, rocks and dummies, the training yard as it
  // was and both places showing; the island gone again, Maren home at the Hold; its hero to the
  // Round Table (or, held by thee, there once thou lettest go); and thou at the Hold.
  clear() {
    const { world, training, director, pilot, ults, ui, nav } = this.ctx;
    const safe = (fn) => {
      try { fn(); } catch (err) { console.error('Clearing the tutorial away:', err); }
    };
    safe(() => ults.finish());
    safe(() => { director.select(null); ui.closeFan(); });
    safe(() => this.leaveClimb());
    safe(() => training.lessonEnd());
    world.hub.group.visible = true;
    world.yard.group.visible = true;
    world.yard.stair.visible = true;
    this.fence = null;
    safe(() => this.clearIsland());
    safe(() => {
      const n = this.hero;
      if (!n || n.dead) return;
      if (n.piloted) n.resume = { kind: 'gather' };
      else n.setIntent({ kind: 'gather' });
    });
    safe(() => {
      const me = pilot.npc;
      if (me && !world.hub.contains(me.pos.x, me.pos.y)) {
        const [x, z] = this.holdSpot();
        this.place(x, z);
      }
    });
    nav.sync();
  }

  clearIsland() {
    const { world, director, nav } = this.ctx;
    const r = this.island;
    const maren = director.maren;
    if (maren && !maren.piloted && !maren.dead && (maren.region === r || !world.hub.contains(maren.pos.x, maren.pos.y))) {
      maren.releaseSlot();
      maren.travel = null;
      maren.fade = 1;
      maren.region = world.hub;
      const [gx, gz] = HUB_LAYOUT.grace;
      const [x, z] = nav.clampToWalkable(gx - 2.4, gz + 2.2);
      maren.pos.set(x, z);
      maren.setIntent({ kind: 'wander' });
    }
    if (!r) return;
    director.rises = director.rises.filter((q) => q.region !== r);
    world.removeRegion(r);
    this.island = null;
    nav.sync();
    this.ctx.onWorldGrew?.();
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

// A rune rock of the tutorial's, standing at (x, z) on the floor of its yard `Y` (climb.js), drawn
// as the dummies are (lit by the world's light, a shadow at its foot), solid; its turn (go): its
// rune lit, its own blue light coming up round it, lifted, held up, dropped (Tutorial.crash), and
// its light dying. Heard (audio.js, rock-…): its rune lighting, humming as it's lifted and held up
// (the hum hushed as it drops), rushing down.
class RuneRock {
  constructor(tutorial, key, x, z, Y) {
    const { ctx } = tutorial;
    this.tutorial = tutorial;
    this.x = x;
    this.z = z;
    this.Y = Y;
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
    this.blob.position.set(x, Y.y + 0.015, z + 0.05);
    this.blob.renderOrder = 1;
    ctx.scene.add(this.mesh, this.blob);
    const on = tutorial.climb;
    this.on = on;
    this.block = on.blockCircle(x - on.cx, z - on.cz, this.w * ROCKS.block);
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

  // One of its sounds (audio.js), where it stands; what's sounding of it, or null.
  sound(name) {
    return this.tutorial.ctx.sound?.play(name, { at: [this.x, this.z] }) || null;
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
    return [this.x, this.Y.y + this.lift + this.h * 0.3, this.z + 1.6];
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
        this.tutorial.crash(this);
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
    const { particles } = this.tutorial.ctx.training.fxCtx;
    particles.emit({
      pos: [this.x, this.lift + 0.3, this.z + 0.3], spread: [this.w * 0.42, 0.3, 0.4], vel: [0, 1.6, 0], velSpread: [0.5, 0.8, 0.3],
      color: ROCKS.motes, size: 0.07, life: 1.1, count: 4, drag: 0.6, intensity: 2.4,
    });
  }

  place() {
    this.mesh.position.set(this.x + this.foot, this.Y.y + this.h / 2 - 0.02 + this.lift, this.z);
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

  dispose() {
    this.light?.end(0.1);
    this.hush(0.1);
    this.tutorial.ctx.scene.remove(this.mesh, this.blob);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.glow?.dispose();
    this.blob.geometry.dispose();
    this.blob.material.dispose();
    this.on.unblock(this.block);
  }
}
