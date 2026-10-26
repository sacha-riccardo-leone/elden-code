// The tutorial, on the first journey (main.js, begin): Maren at Roundtable Hold with nothing else
// about (no island risen, the training yard out of sight), and the Lands Between held back
// meanwhile (`holding`: no Tarnished at the Round Table, no session taken up, no phantoms, no great
// enemy coming: main.js). Step by step:
//   move     at the Hold: walking, W A S D or the arrows, till every way has been tried, and with
//            Shift held, sprinting;
//   dummies  through black, on the training yard, emptied of all but three straw dummies at its
//            west end (training.js, lessonStart): break them, with a left click (or a right one too,
//            for whoever casts: combat.js, canCast);
//   rocks    over to its east end, into the ring of its rune rocks (runerocks.js): in turn each one's
//            rune lights, it's lifted in blue magic, held up a second and dropped, and its shockwave
//            ripples out over the floor (ripple.js); a dodge (Space) through it, three in a row (one
//            that lands strikes as a great enemy's blow would, red and all, but takes no health);
//   boss     back to its west end, into the great dummy's sawdust ring: it comes, and blows on its
//            cracked ankle fill thine ultimate and hurt it no more, and once it's full, R breaks it
//            at a stroke (training.js, lesson); here too the hint for Q, the camera's focus on it (no
//            longer in a fight);
//   gesture  through black, back at the Hold: thy fan of gestures (B), and one of them, a click on
//            it or its number (1 to 8);
//   become   a hero rises from grace beside thee and waits: a click on them, then on "Become";
//   island   Maren, let go, sets out for an island that rises for her and works there (why they
//            go, and where they go with nothing to do); and it's done: again, or on into the world.
// On the yard (its stair up to the Hold put away), a step done, the golden arrow shows the way to the
// next (guide.js, route): come into its ring, and it begins. Each step lets through what it teaches
// and what came before (allows: main.js, input.js), and keeps thee to the place it's in (fence:
// pilot.js). "Skip tutorial", at the bottom right, ends it at any step. Done or skipped, it's
// remembered and comes no more of itself; it's walked again from the training yard's grace (main.js)
// or with "Do it again", the page loaded afresh for it (gate.js). The words to read are the user's
// own; the keys to press are drawn as keys (game.css, .key).

import * as THREE from 'three';
import { YARD, BOSS_DUMMY } from './yard.js';
import { canCast } from './combat.js';
import { groundAt } from './ground.js';
import { HUB_LAYOUT, REGION } from './config.js';
import { AGAIN } from './gate.js';
import { DODGES } from './runerocks.js';

const DONE = 'elden-code:tutorial'; // (localStorage: 'done', once walked or skipped)
// The black between steps: how long it takes to fall, and how long it holds before lifting.
const FADE = { out: 0.6, hold: 0.35 };
// Where thou standest: by the Hold's grace (as thou risest there), or on the training yard (from its
// middle) before its three straw dummies, which stand round `dummies` at its west end (clear of the
// great one's halberd: yard.js, BOSS_DUMMY); and how many of thy hits (blows or spells) break each
// (the training yard's own take four blows, or five spells: training.js).
const SPOT = { hold: [1.6, 1.8], dummies: [-7, -1], stand: [0, 5.5] };
const DUMMIES = [[-3.6, 1], [0, 0], [3.6, 1]];
const DUMMY_HITS = 2;
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
    this.dummies = null; // its straw dummies on the yard (training.js)
    this.great = null; // (and its great one)
    this.v = new THREE.Vector3();
    const root = document.getElementById('tutorial');
    this.el = {
      root,
      fade: document.getElementById('tut-fade'),
      prompt: root.querySelector('.tut-prompt'),
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

  // Only the place a step is in shows: the Hold, or the training yard (without its stair up to the
  // Hold); and thou keepest to it (on the yard, to its floor).
  show(place) {
    const { world } = this.ctx;
    world.hub.group.visible = place === 'hold';
    world.yard.group.visible = place === 'yard';
    world.yard.stair.visible = place !== 'yard';
    this.fence = place === 'yard' ? (x, z) => world.yard.inside(x, z) : (x, z) => world.hub.contains(x, z);
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
      case 'rocks': this.stepRocks(); break;
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

  // dummies: in the black, the training yard set out: three straw dummies before thee at its west
  // end, broken ones staying in pieces, and the great dummy, put away till thou comest to it.
  setDummies() {
    const { training } = this.ctx;
    const [cx, cz] = SPOT.dummies;
    const z0 = YARD.cz + cz;
    this.show('yard');
    this.place(cx + SPOT.stand[0], z0 + SPOT.stand[1]);
    this.dummies = DUMMIES.map(([x, z]) => training.addDummy(cx + x, z0 + z, { hits: DUMMY_HITS }));
    this.great = training.addDummy(BOSS_DUMMY.x, YARD.cz + BOSS_DUMMY.z, { great: true });
    this.great.putAway(true);
  }

  stepDummies() {
    if (!this.phase) {
      this.phase = 'strike';
      const parts = canCast(this.ctx.pilot.npc) ? ['Attack with', mouse('left'), 'or', mouse('right')] : ['Attack with', mouse('left')];
      this.say(parts, 'Destroy the three dummies');
    }
    if (this.phase === 'strike' && this.dummies.every((d) => d.broken)) {
      this.phase = 'done';
      this.doneAt = this.t;
    }
    if (this.phase === 'done' && this.t - this.doneAt > 1.4) this.onTo('rocks');
  }

  // ------------------------------------------------------------------------------------------
  // the yard

  // A step on the yard done: its words away, and on to the next, the golden arrow showing the way
  // there (route).
  onTo(step) {
    this.hush();
    this.markAt = null;
    this.go(step);
  }

  // The way on from where `me` stands, for the golden arrow (guide.js): to the ring of the rune
  // rocks, then to the great dummy's, till thou'rt in it.
  route(me) {
    if (!this.holding || this.busy || this.ending || !me || this.phase !== 'walk') return null;
    if (this.step === 'rocks') {
      const { x, z } = this.ctx.world.yard.ring();
      return [[x, z]];
    }
    if (this.step === 'boss' && this.great) return [[this.great.pos.x, this.great.pos.y]];
    return null;
  }

  // The yard as it was (back at the Hold, or the tutorial over): its dummies taken away, its rune
  // rocks at rest.
  leaveYard() {
    const { training } = this.ctx;
    for (const d of [...(this.dummies || []), ...(this.great ? [this.great] : [])]) training.removeDummy(d);
    this.dummies = null;
    this.great = null;
    training.ring.reset();
  }

  // rocks: over to their ring; in it, they take their turns, one after another (runerocks.js), till
  // three are dodged in a row; out of it again, they rest once the one up has come down, and the
  // arrow shows the way back.
  stepRocks() {
    const { ring } = this.ctx.training;
    if (!this.phase) {
      this.phase = 'walk';
      ring.open = true;
    }
    if (this.phase === 'walk' || this.phase === 'dodge') {
      const phase = ring.on ? 'dodge' : 'walk';
      if (phase !== this.phase) {
        this.phase = phase;
        if (phase === 'dodge') this.say(['Dodge with', key('Space', null, true), 'to not get hit']);
        else this.hush();
      }
      if (ring.dodged >= DODGES) {
        this.phase = 'done';
        ring.open = false;
      }
    } else if (this.phase === 'done' && !ring.busy) {
      this.phase = 'over';
      this.doneAt = this.t;
      this.hush();
    } else if (this.phase === 'over' && this.t - this.doneAt > 1.2) {
      this.onTo('boss');
    }
  }

  // boss: back to the great dummy's sawdust ring; come into it, and a moment after it comes, in a
  // puff of dust, and thine ultimate's bar with it, empty.
  stepBoss() {
    const { training, pilot, ults, rig } = this.ctx;
    const g = this.great;
    if (!g) { this.next('gesture', () => this.setHold()); return; }
    if (!this.phase) this.phase = 'walk';
    if (this.phase === 'walk') {
      const me = pilot.npc;
      if (!me || Math.hypot(me.pos.x - g.pos.x, me.pos.y - g.pos.y) > BOSS_DUMMY.ring) return;
      this.phase = 'come';
      this.cameAt = this.t;
    }
    if (this.phase === 'come') {
      if (this.t - this.cameAt < 0.7) return;
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

  // In the black, the yard as it was; back at the Hold, by its grace, as at first.
  setHold() {
    const { training } = this.ctx;
    if (training.lesson) training.lesson.ult = false;
    this.el.hint.hidden = true;
    this.leaveYard();
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

  // Where the camera looks (main.js): in the last step, the island and Maren on it, all of it in
  // view; else as ever (on the yard, with the rune rocks or by the great dummy: training.js).
  aim() {
    if (!this.holding || this.ending) return null;
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

  // Everything of the tutorial's taken away: its dummies, the training yard as it was (its rune rocks
  // open again: training.js, lessonEnd) and both places showing; the island gone again, Maren home at the Hold; its hero to the
  // Round Table (or, held by thee, there once thou lettest go); and thou at the Hold.
  clear() {
    const { world, training, director, pilot, ults, ui, nav } = this.ctx;
    const safe = (fn) => {
      try { fn(); } catch (err) { console.error('Clearing the tutorial away:', err); }
    };
    safe(() => ults.finish());
    safe(() => { director.select(null); ui.closeFan(); });
    safe(() => this.leaveYard());
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
