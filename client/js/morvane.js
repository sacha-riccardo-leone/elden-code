// Morvane's fight (fight.js hands him over to this; his drawings are heroes/morvane.js, and once
// he's changed, heroes/morvane-flame.js). The last great enemy of the Arena of Trials, met only once
// the Guardian Golem and Fenrath have been beaten (fight.js, ORDER).
//
// His first form, the withered lord, won't fight: he flees all round the arena, away from whoever's
// near, and every so often stops, out of breath. Thy blade reaches him only then (as an ultimate
// does); what thou loosest from afar (a spell, a thrown spear, Ruadan's maul) reaches him running
// too. His wounds barely fill thine ultimate. Nearly done for, he makes one last run, to the middle
// of the arena, and stays there out of breath till thou finishest him: so his change, and his reveal,
// come there. He's thine alone: thy companions wait in their places by the way in, watching, for his second
// form (waits). His health he wears over his head, as the training yard's dummies do theirs
// (fight.updateUi): the great enemy's bar shows only once he's the Lord of Frenzied Flame. His bar
// emptied, he
// changes (CHANGE), the camera on him and everyone holding still: he kneels and grips the sword in
// his skull, screaming; he pulls, and the sword, stuck fast, drags his head up on a stretching neck
// till he rips it off, a burst of frenzied flame swallowing it; from behind, he kneels headless, the
// sword dragging; he stands, flames rising from his neck, and grows under them to three times his
// height; the screen goes black; and he turns round, the Lord of Frenzied Flame, his head a ring of
// frenzied flame, arms spread. His title, and his second bar filling. His second form's fight is
// still to come: for now he hangs there a moment, and the encounter ends, to be continued
// (fight.halt): neither won nor lost, and he's met again next time.
//
// He's heard (audio.js, Sacha's recordings: README): breaking into a run, out of breath, and every
// moment of his change, each on its drawing.

import { SpriteBody } from './npc.js';
import { flash, carry } from './lights.js';
import { onAim, wayOf, AIM, reachOf } from './combat.js';
import { ARENA } from './config.js';

export const MORVANE = {
  hp: 1500, // his first bar
  flameHp: 9000, // his second, filling as he's revealed (his second form's fight is still to come)
  speed: 5.6, // fleeing (a little slower than thou runnest)
  run: [3.5, 6], // seconds he runs before he must stop
  pant: [2.6, 3.4], // seconds out of breath: the only time he can be struck
  leg: 7, // how far he'd rather each dash take him
  shy: 2.6, // a foe this near, he runs elsewhere
  last: 0.15, // this much of his bar left, he makes one last run, to the middle of the arena, and stays there out of breath
  wheeze: 5.6, // (and wheezes on and on there: his panting heard again every so often)
  // what his first form's wounds fill thine ultimate with: a twentieth of what they would (all of his
  // first bar, a quarter of it: the annoying part of him)
  ultFill: 20,
  hover: 0.35, // how high his second form floats (over the toes' place in his drawing), bobbing
};

// His change, in seconds from his first bar emptying: the grip (C), heard pulling from the moment he
// grips the sword, its tearing coming in halfway through that (`tear`: the pull's clip is 6.9 s long);
// the pull (D), heard as he pulls; his head ripped off, kneeling headless from behind (D2), standing so
// (E) and growing (from `grow` to
// `grown`, GROW times his size), the screen black (from `black`, gone again at `reveal`), revealed (F),
// his title and his second bar filling over FILL seconds, at rest (master 2), and at `halt`, to be
// continued. `cam`: how far back the camera stands for each (it pulls back as he grows).
const CHANGE = {
  grip: 0, pull: 2.6, tear: 3.45, rip: 6.2, pulled: 6.45, back: 9.2, grow: 9.6, grown: 13.4,
  black: 13.8, reveal: 17.3, title: 18.6, idle: 20.6, halt: 25,
  cam: { near: 15, grown: 25, reveal: 30 },
};
const GROW = 2.1; // (his body, from his soles to his neck, as tall again as the Lord of Frenzied Flame's)
const FILL = 1.6;
const FLAME = ['#fff4b0', '#ffd23a', '#ff9a1a', '#ff6a10']; // (frenzied flame: white-hot to orange)
const FLAME_LIGHT = '#ffb030';
// Where, in his drawings, things are (art pixels over his feet: up): the fire, his head as he grips and
// pulls, his neck once it's torn off, the head of flame; his middle, where a spell strikes, in either
// form.
const AT = { grip: 150, pull: 170, pulled: 134, back: 158, flame: 241, middle: 96, flameMiddle: 160, top: 243 };

const rand = (a, b) => a + Math.random() * (b - a);

export class MorvaneMind {
  constructor(fight, b) {
    this.fight = fight;
    this.b = b;
    this.ctx = fight.ctx;
    this.floor = fight.floor; // (the arena's floor: what he looses is set on it, fight.js)
    this.mode = 'run'; // run, pant (his first form); his change (b.state 'change'); his second form ('flame')
    this.t = 0;
    this.until = rand(...MORVANE.run);
    this.goal = null;
    this.veerAt = -9;
    this.told = new Set(); // (the hints in the log, each said once)
    this.voices = {}; // what's heard and must be cut short (his panting, the pull and tearing, the reveal)
    this.form = 1;
    this.light = null; // the frenzied flame's light, from his head torn off to the end
    this.black = document.getElementById('black');
  }

  // A sound of his (audio.js, SOUNDS: morvane-…): where he is, or, `cine`, wherever thou art.
  sound(name, cine = false, opts = {}) {
    const b = this.b;
    return this.ctx.sound?.play(`morvane-${name}`, cine ? opts : { at: [b.pos.x, b.pos.y], ...opts }) || null;
  }

  hush(key, fade = 0.3) {
    this.voices[key]?.stop(fade);
    delete this.voices[key];
  }

  tell(key, text, tone = 'gold') {
    if (this.told.has(key)) return;
    this.told.add(key);
    this.ctx.ui.log(text, tone, { region: this.ctx.world.arena });
  }

  // ------------------------------------------------------------------------------------------
  // what the fight asks of him

  // Out of breath: the only time he can be struck.
  open() { return this.b.state === 'ready' && this.form === 1 && this.mode === 'pant'; }
  // (out of breath, anything wounds him; running, only what thou loosest from afar: struck, `through`)
  immune() { return !this.open() && !(this.through && this.b.state === 'ready' && this.form === 1); }
  // (how hard his wounds fill an ultimate: his first form's barely, combat.js)
  ultFill() { return this.form === 1 ? MORVANE.ultFill : 1; }
  // His health over his head, in his first form and his change, till he's named the Lord of Frenzied
  // Flame (fight.updateUi): where it goes.
  ownBar() { return !this.titled; }
  barAt() { return this.b.lift + this.up('top') + 0.25; }
  get lying() { return false; }
  // (and everyone holding still, the camera on him, while he changes and as he's revealed)
  holds() { return this.b.state === 'change'; }
  // (the fighters wait in their places by the way in through his first form and his change: his
  // second form's fight, when it's made, is where they join it, fight.driveFighter)
  waits() { return this.form === 1 || this.b.state === 'change'; }
  crowdRadius(r) { return this.form === 1 ? r * 1.25 : r * 3.4; }
  shadow() { return this.form === 2 ? [4.5, 2.4] : null; }

  // How high a spot of his (AT) stands over his feet, in the drawings he's in just now.
  up(k) { return AT[k] * this.b.body.sheet.px; }

  // Thy blow (fight.strikeFrom): along the line thou aimed it, within reach, while he's out of breath.
  playerBlow(p) {
    const b = this.b;
    if (onAim(p.pos.x, p.pos.y, wayOf(p), b.pos.x, b.pos.y, b.kind.radius, b.kind.depth, b.kind.reach + reachOf(p), AIM.blow) == null) return false;
    if (!this.open()) { this.slip(); return false; }
    this.struck(p, this.fight.blowWorth(p), 'blow');
    return true;
  }

  // A fighter's blow, at the turn of its swing.
  fighterBlow(n) {
    const b = this.b;
    if (Math.hypot(b.pos.x - n.pos.x, b.pos.y - n.pos.y) > b.kind.reach + b.kind.radius + 0.4 + reachOf(n)) return false;
    if (!this.open()) return false;
    this.struck(n, this.fight.blowWorth(n), 'blow');
    return true;
  }

  // Where a spell flies at him (his middle), and a spell landing (`share` of an ordinary one).
  spellPoint() {
    const b = this.b;
    return [b.pos.x, b.lift + this.up(this.form === 1 ? 'middle' : 'flameMiddle'), b.pos.y + 0.2];
  }

  // (thine reaches him running too: a spell, a spear or the maul thrown, a thunderbolt; another's only
  // as he stands out of breath)
  spellBlow(n, share, player) {
    if (!this.open() && !player) return false;
    this.struck(n, this.fight.blowWorth(n, true) * share, 'spell', player);
    return true;
  }

  struck(n, amount, how, through = false) {
    const b = this.b;
    this.through = through;
    this.fight.hit(b, amount, null, n, true, how);
    this.through = false;
    // (heard: thine own cry as thou art struck, higher, the nearest there is to his own till he has one)
    this.ctx.sound?.play('player-hurt', { at: [b.pos.x, b.pos.y], volume: 0.55, pitch: 1.2 });
    this.floor.particles.emit({
      pos: [b.pos.x, this.up('middle'), b.pos.y + 0.2], spread: [0.3, 0.4, 0.2], vel: [0, 1, 0], velSpread: [1, 0.8, 0.6],
      color: ['#7a1a10', '#c8a070', '#2a0808'], size: 0.05, life: 0.5, count: 8, drag: 1.4, intensity: 1,
    });
  }

  // A blow of thine, while he runs: it passes him by (said once).
  slip() {
    this.tell('slip', 'Morvane slips away from thy blade: strike him from afar as he runs, or when he stops, out of breath');
  }

  // Where a fighter goes to strike: beside him, on its own side, while he's out of breath; nowhere
  // while he runs (they go round him, after him).
  strikeSpot(n) {
    if (!this.open()) return null;
    const b = this.b;
    const side = Math.sign(n.pos.x - b.pos.x) || 1;
    n.fighter.slot ??= Math.random() * Math.PI * 2;
    const gx = b.pos.x + side * (0.9 + reachOf(n));
    const gz = b.pos.y + Math.sin(n.fighter.slot) * 0.5;
    return { goal: [gx, gz], ready: Math.abs(n.pos.x - gx) < 0.6 && Math.abs(n.pos.y - gz) < 0.7, face: b.pos.x };
  }

  // ------------------------------------------------------------------------------------------
  // his first form: fleeing, and out of breath

  think(dt) {
    const b = this.b;
    this.t += dt;
    if (!this.last && b.hp <= b.max * MORVANE.last) this.lastRun();
    if (this.last) return this.stepLast(dt);
    if (this.mode === 'pant') {
      b.pose('pant');
      if (this.t >= this.until) this.run();
      return false;
    }
    if (this.t >= this.until) { this.stop(); return false; }
    // off somewhere new: there, or a foe coming too near (not more often than he can turn)
    const f = this.fight;
    const crowd = f.foes().some((n) => Math.hypot(n.pos.x - b.pos.x, n.pos.y - b.pos.y) < MORVANE.shy);
    if (!this.goal || Math.hypot(this.goal[0] - b.pos.x, this.goal[1] - b.pos.y) < 0.6 || (crowd && f.clock - this.veerAt > 0.8)) {
      this.goal = this.away();
      this.veerAt = f.clock;
    }
    const [gx, gz] = this.goal;
    const d = Math.hypot(gx - b.pos.x, gz - b.pos.y);
    const step = Math.min(d, MORVANE.speed * dt);
    f.shift(b, ((gx - b.pos.x) / d) * step, ((gz - b.pos.y) / d) * step);
    if (Math.abs(gx - b.pos.x) > 0.2) b.body.facing = gx > b.pos.x ? 1 : -1;
    b.pose('run');
    return true;
  }

  // Where to run: well away from everyone (thee most), a dash's length off, not past anyone on the way.
  away() {
    const b = this.b;
    const { cx, cz } = this.ctx.world.arena;
    const me = this.ctx.pilot.npc;
    const foes = this.fight.foes();
    let best = null;
    let bs = -Infinity;
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (ARENA.walkRadius - 3);
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const len = Math.hypot(x - b.pos.x, z - b.pos.y);
      if (len < 3) continue;
      let room = 12;
      let past = 0;
      for (const n of foes) {
        room = Math.min(room, Math.hypot(n.pos.x - x, n.pos.y - z) * (n === me ? 0.8 : 1));
        // (someone standing on his way there)
        const t = Math.max(0, Math.min(1, ((n.pos.x - b.pos.x) * (x - b.pos.x) + (n.pos.y - b.pos.y) * (z - b.pos.y)) / (len * len)));
        if (Math.hypot(b.pos.x + (x - b.pos.x) * t - n.pos.x, b.pos.y + (z - b.pos.y) * t - n.pos.y) < 1.6) past += 1;
      }
      const s = room - Math.abs(len - MORVANE.leg) * 0.35 - past * 6 + Math.random() * 1.5;
      if (s > bs) { bs = s; best = [x, z]; }
    }
    return best || [cx, cz];
  }

  // Off again (breaking into a run), or stopping, out of breath.
  run() {
    this.mode = 'run';
    this.t = 0;
    this.until = rand(...MORVANE.run);
    this.goal = this.away();
    this.hush('pant', 0.4);
    this.sound('run');
  }

  stop() {
    this.mode = 'pant';
    this.t = 0;
    this.until = rand(...MORVANE.pant);
    this.goal = null;
    this.b.pose('pant', true);
    this.voices.pant = this.sound('pant');
    this.tell('pant', 'Morvane stops, out of breath: strike him now!');
  }

  // Nearly done for: one last run, to the middle of the arena (whoever's in the way), and there, out
  // of breath for good, wheezing on till he's finished (or he can get no nearer: there, then).
  lastRun() {
    const { cx, cz } = this.ctx.world.arena;
    this.last = 'run';
    this.mode = 'run';
    this.goal = [cx, cz];
    this.closest = Infinity;
    this.stuckT = 0;
    this.hush('pant', 0.4);
    this.sound('run');
    this.tell('last', 'Morvane staggers to the middle of the arena, out of breath: finish him!', 'red');
  }

  stepLast(dt) {
    const b = this.b;
    if (this.last === 'there') {
      b.pose('pant');
      this.wheeze = (this.wheeze || 0) + dt;
      if (this.wheeze >= MORVANE.wheeze) { this.wheeze = 0; this.voices.pant = this.sound('pant'); }
      return false;
    }
    const [gx, gz] = this.goal;
    const d = Math.hypot(gx - b.pos.x, gz - b.pos.y);
    // (no nearer for a while: someone stands where he'd be)
    if (d < this.closest - 0.05) { this.closest = d; this.stuckT = 0; } else this.stuckT += dt;
    if (d < 0.4 || this.stuckT > 1.2) {
      this.last = 'there';
      this.mode = 'pant';
      this.wheeze = 0;
      b.pose('pant', true);
      this.voices.pant = this.sound('pant');
      return false;
    }
    const step = Math.min(d, MORVANE.speed * dt);
    this.fight.shift(b, ((gx - b.pos.x) / d) * step, ((gz - b.pos.y) / d) * step);
    if (Math.abs(gx - b.pos.x) > 0.2) b.body.facing = gx > b.pos.x ? 1 : -1;
    b.pose('run');
    return true;
  }

  // His bare feet as they're set down, running (the run's first and third drawings).
  onFrame(name, i) {
    if (name === 'run' && (i === 0 || i === 2)) this.ctx.sound?.play('step-bare', { at: [this.b.pos.x, this.b.pos.y], volume: 2.2 });
  }

  // ------------------------------------------------------------------------------------------
  // his change

  // His first bar emptied (Fight's Boss.damage): not his end, but his change.
  change() {
    if (this.form !== 1 || this.b.state === 'change') return false;
    const b = this.b;
    b.endMove();
    b.state = 'change';
    b.t = 0;
    b.hp = 0;
    this.t = 0;
    this.step = 0;
    this.hush('pant', 0.2);
    b.body.facing = 1; // (the change is drawn facing thee, and from behind: as drawn)
    this.ctx.ui.log('Morvane falls to his knees, his hands on the sword in his skull…', 'red', { region: this.ctx.world.arena });
    return true;
  }

  // The camera on him as he changes: close, pulling back as he grows, and his whole height revealed.
  aim() {
    const b = this.b;
    if (b.state !== 'change' && b.state !== 'flame') return null;
    const t = this.t;
    const C = CHANGE;
    const k = Math.max(0, Math.min(1, (t - C.grow) / (C.grown - C.grow)));
    let dist = C.cam.near + (C.cam.grown - C.cam.near) * k;
    let y = this.up('middle') * (1.1 + 1.6 * k);
    if (this.form === 2) { dist = C.cam.reveal; y = this.up('flameMiddle'); }
    return { at: [b.pos.x, ARENA.y + y, b.pos.y], dist, mode: 'change', close: true };
  }

  // Each moment of it, in order, as its time comes (stepState); returns how far he trembles.
  stepChange(dt) {
    const b = this.b;
    const C = CHANGE;
    this.t += dt;
    const t = this.t;
    const at = (s) => this.step === s && t >= C[s];
    const head = (h) => [b.pos.x, h * (b.body.zoom || 1), b.pos.y + 0.15];
    if (this.step === 0) {
      b.pose('grip', true);
      this.voices.grip = this.sound('grip', true);
      this.voices.pull = this.sound('pull', true);
      this.step = 'pull';
    }
    if (at('pull')) {
      b.pose('pull', true);
      this.sound('headless', true);
      this.step = 'tear';
    }
    if (at('tear')) {
      this.voices.tear = this.sound('tear', true);
      this.step = 'rip';
    }
    if (at('rip')) {
      // his head ripped off: a burst of frenzied flame swallows it, and it's never seen again
      this.hush('pull', 0.4);
      this.hush('tear', 0.8);
      this.sound('rip', true);
      this.burst(head(this.up('pull')), 1.7, 90);
      flash(this.floor.scene, head(this.up('pull')), { color: FLAME_LIGHT, power: 60, reach: 16, life: 0.7 });
      this.ctx.rig?.shake?.(0.25);
      this.light = carry(this.floor.scene, head(this.up('pull')), { color: FLAME_LIGHT, power: 22, reach: 9, waver: 0.5 });
      this.step = 'pulled';
    }
    if (at('pulled')) {
      b.pose('pulled', true);
      this.step = 'back';
    }
    if (at('back')) {
      b.pose('back', true);
      this.step = 'grow';
    }
    if (at('grow')) {
      this.sound('grow', true);
      this.step = 'black';
    }
    if (at('black')) {
      this.dark(true, 0.4);
      this.voices.black = this.sound('black', true);
      this.step = 'swap';
    }
    // (in the dark, his second form takes his place)
    if (this.step === 'swap' && t >= C.black + 0.6) {
      this.becomeFlame();
      this.step = 'reveal';
    }
    if (at('reveal')) {
      this.dark(false, 0.7);
      b.pose('reveal', true);
      this.voices.reveal = this.sound('reveal', true);
      this.voices.low = this.sound('reveal-low', true);
      this.burst(head(this.up('flame')), 3.2, 140);
      flash(this.floor.scene, head(this.up('flame')), { color: FLAME_LIGHT, power: 45, reach: 22, life: 0.8 });
      this.ctx.rig?.shake?.(0.3);
      this.step = 'title';
    }
    if (at('title')) {
      b.name = 'Morvane, Lord of Frenzied Flame';
      this.titled = true; // (the great enemy's bar, filling: fight.updateUi)
      b.max = MORVANE.flameHp;
      this.ctx.ui.banner('Morvane', 'Lord of Frenzied Flame', 'gold');
      this.ctx.ui.log('Morvane, Lord of Frenzied Flame, is revealed', 'red', { region: this.ctx.world.arena });
      this.step = 'idle';
    }
    if (this.step === 'idle' || this.step === 'halt') {
      // his second bar filling
      b.hp = b.max * Math.min(1, (t - C.title) / FILL);
      this.fight.lagHp = b.hp;
    }
    if (at('idle')) {
      b.pose('idle', true);
      this.step = 'halt';
    }
    if (at('halt')) {
      this.step = 'done';
      this.fight.halt(b);
      return 0;
    }
    // as it goes: he trembles as he grips and pulls (harder as he tears), embers rise off him, the
    // flames rise from his neck as he grows, the light of the flame wavers
    let jitter = 0;
    if (t < C.rip) {
      const hard = t < C.pull ? 0.02 : t < C.tear ? 0.035 : 0.05;
      jitter = (Math.floor(t * 30) % 2 ? 1 : -1) * hard;
    }
    if (t < C.rip && Math.random() < dt * (t < C.pull ? 6 : 14)) {
      this.floor.particles.emit({
        pos: head(this.up(t < C.pull ? 'grip' : 'pull')), spread: [0.15, 0.2, 0.1], vel: [0, 0.7, 0], velSpread: [0.3, 0.3, 0.2],
        color: FLAME, size: 0.04, life: 0.7, count: 2, drag: 1, intensity: 2.2,
      });
    }
    if (t >= C.pulled && t < C.black) {
      // (the neck smoulders as he kneels, and blazes up as he stands and grows)
      const grow = t >= C.back;
      if (Math.random() < dt * (grow ? 40 : 12)) {
        this.floor.particles.emit({
          pos: head(this.up(grow ? 'back' : 'pulled')), spread: [0.12, 0.05, 0.08], vel: [0, grow ? 2.2 : 1, 0], velSpread: [0.35, 0.6, 0.3],
          color: FLAME, size: grow ? 0.09 : 0.06, life: grow ? 0.9 : 0.6, count: grow ? 4 : 2, drag: 0.8, intensity: 2.8,
        });
      }
    }
    if (t >= C.back && this.form === 1) {
      const k = Math.max(0, Math.min(1, (t - C.grow) / (C.grown - C.grow)));
      b.body.setZoom(1 + (GROW - 1) * k * k * (3 - 2 * k));
    }
    if (this.form === 2) this.float(dt);
    this.flicker(t);
    return jitter;
  }

  // The frenzied flame's light, from his head torn off: wavering, brighter as he grows; and once he's
  // revealed, low in front of him, lighting the floor and those round him rather than the head of
  // flame itself (which it would burn out to a blot).
  flicker(t) {
    const b = this.b;
    if (!this.light) return;
    if (this.form === 2) this.light.at(b.pos.x, 1.4, b.pos.y + 2.6);
    else this.light.at(b.pos.x, (t >= CHANGE.back ? this.up('back') * (b.body.zoom || 1) : this.up('pulled')), b.pos.y + 0.6);
    const base = this.form === 2 ? 1 : t >= CHANGE.back ? 0.5 + 0.7 * Math.min(1, (t - CHANGE.back) / 4) : 0.35;
    this.light.level = base * (0.85 + 0.15 * Math.sin(t * 17) + 0.1 * Math.sin(t * 41));
  }

  // A burst of frenzied flame at `at` [x, height, z], `r` across.
  burst(at, r, count) {
    this.floor.particles.emit({
      pos: at, spread: [r * 0.3, r * 0.3, r * 0.2], vel: [0, 1.6, 0], velSpread: [r * 1.6, r * 1.2, r * 0.8],
      color: FLAME, size: 0.1, life: 1.1, count, drag: 1.1, intensity: 3,
    });
  }

  // The screen going black, or the dark lifting, over `secs`.
  dark(on, secs) {
    if (!this.black) return;
    this.black.style.transitionDuration = `${secs}s`;
    this.black.classList.toggle('on', on);
  }

  // In the dark: the Lord of Frenzied Flame in his place, at his own size, floating, facing thee.
  becomeFlame() {
    const b = this.b;
    const sheet = this.ctx.morvaneFlameSheet;
    if (!sheet) return;
    const old = b.body;
    const body = new SpriteBody(this.ctx.scene, sheet);
    body.mat.transparent = true;
    body.blob.material.map = old.blob.material.map;
    body.blob.material.opacity = 1;
    body.facing = 1;
    old.dispose();
    b.body = body;
    b.pose('reveal', true);
    b.lift = MORVANE.hover;
    this.form = 2;
    this.light?.end(0.1);
    this.light = carry(this.floor.scene, [b.pos.x, 1.4, b.pos.y + 2.6], { color: FLAME_LIGHT, power: 16, reach: 14, waver: 0.6 });
  }

  // ------------------------------------------------------------------------------------------
  // his second form (its fight is still to come)

  // His second form floating, bobbing gently, embers rising off his head of flame.
  float(dt) {
    const b = this.b;
    this.bob = (this.bob || 0) + dt;
    b.lift = MORVANE.hover + 0.12 * Math.sin(this.bob * 1.6);
    if (Math.random() < dt * 10) {
      this.floor.particles.emit({
        pos: [b.pos.x, b.lift + this.up('flame'), b.pos.y + 0.1], spread: [0.9, 0.7, 0.4], vel: [0, 1.3, 0], velSpread: [0.4, 0.5, 0.3],
        color: FLAME, size: 0.06, life: 1.2, count: 3, drag: 0.7, intensity: 2.6,
      });
    }
  }

  // His states of his own (fight.stepBoss): changing (to his reveal and a moment after), and
  // vanishing into frenzied flame as the encounter ends. Returns how far he trembles.
  stepState(dt) {
    const b = this.b;
    if (b.state === 'change') return this.stepChange(dt);
    if (b.state === 'vanish') {
      this.float(dt);
      this.flicker(CHANGE.halt + b.t);
      b.fade = Math.max(0, 1 - b.t / 1.4);
      if (this.light) this.light.level = b.fade;
      if (Math.random() < dt * 30) this.burst([b.pos.x, 1 + Math.random() * this.up('flame') * 0.9, b.pos.y], 1.8, 6);
      if (b.t >= 1.6) b.state = 'gone';
    }
    return 0;
  }

  // To be continued (fight.halt): he vanishes in a burst of frenzied flame, his sounds dying away.
  vanish() {
    const b = this.b;
    b.state = 'vanish';
    b.t = 0;
    this.burst([b.pos.x, this.up('flame') * 0.6, b.pos.y], 4, 160);
    flash(this.floor.scene, [b.pos.x, this.up('flame'), b.pos.y], { color: FLAME_LIGHT, power: 70, reach: 22, life: 0.9 });
    this.hush('reveal', 2.5);
    this.hush('low', 2.5);
    this.hush('black', 2.5);
  }

  stepMove() { return 0; }
  begin() {}
  endMove() {}
  closeHeart() {}
  dies() {}

  dispose() {
    for (const k of Object.keys(this.voices)) this.hush(k, 0.5);
    this.light?.end(0.5);
    this.light = null;
    this.dark(false, 0.3);
  }
}
