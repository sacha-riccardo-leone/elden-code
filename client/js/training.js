// Training in the yard below the Hold (yard.js): straw dummies to strike, and a great one in the
// middle, the Guardian Golem (golem.js) in wood, halberd and all. Each flashes white and wobbles as
// a blow, a spell or an ultimate lands on it; once it has taken enough, it bursts into pieces, lies
// in them a while, and stands whole again. As the Golem's stone does, the great one's wood turns
// every blow but those on its cracked ankle, low on its back leg, and it breaks after half the
// blows there that would have him fall (or a couple of ultimates). Each has its health over its
// head, shown once it's hurt and for a while after each blow. They never strike back.
//
// The Tarnished train there too: called at the yard's little grace (ask: the window that chooses
// companions for a great enemy, companions.js), as many at once as thou wilt, each sent back again
// with the button under its feet, or from the window; and one with nothing to do (no quest, or its
// session idle a while) comes now and then of itself, and goes again once its session has work for
// it, or it has stayed a while. Training, a Tarnished has stopped working: what its session wants
// waits till it leaves (npc.js, setIntent), and no sign of its work shows meanwhile (director.js),
// nor gestures, nor words of it. It comes by grace, takes a post (beside a straw dummy, behind the
// great one at its cracked ankle, or, a caster, off to one side), and strikes or casts there every
// so often, now and then going over to another dummy; and, rarely, looses its ultimate at it,
// quietly (ults.js, startQuiet: nothing stands still for it, nothing goes grey, and the camera
// stays with thee).
//
// Thy blows, spells and ultimates find a dummy as they find a great enemy on the arena (fight.js):
// a dummy has the few things of his they ask after (where it stands, its body, that it lives), and
// the training has the few things of the fight the ultimates ask after (ults.js: its clock, the
// point of him they fly at, the camera, the wounds they deal), so every ultimate plays here as it
// does there. On the yard thine ultimate is always full, and the world holds still for each one as
// ever, but it needn't wait for the last.
//
// The yard lies lower than the Hold (YARD.y): what's loosed on it is set in a group lowered to its
// floor, so that a spell flies at the height it flies at on the arena.
//
// The tutorial (tutorial.js) empties it of all but what it sets out (lessonStart): three straw
// dummies of its own, which stay in pieces once broken; and on the last of the yards it climbs to
// (climb.js, each floor higher than the last: setFloor), a great one of its own, whose cracked
// ankle fills thine ultimate instead of hurting it, and whom thine ultimate then breaks at a stroke.
// By the great one, Q turns the camera on it (toggleFocus), as on a great enemy.

import * as THREE from 'three';
import { YARD, DUMMY_SPOTS, BOSS_DUMMY } from './yard.js';
import { fxArt } from './fxart.js';
import { flashing } from './npc.js';
import { styleOf, castSpell, muzzleOf, stepStatus, RANGED, blow, casts, heroKey, AIM, aimOf, aimSpell, onAim, meets, wayOf, muzzleSpot, struckOf, reachOf } from './combat.js';
import { groundAt } from './ground.js';
import { Spark } from './spellfx.js';
import { GOLEM } from './golem.js';

// A dummy: its health, what a blow and a spell of thine take of it (an ultimate's blows take what
// they take, ults.js; a poison what it takes), how far in front of thee a blow finds it, its size
// (world units to its drawing's pixel), how long it bursts and how long it lies broken. `frames`:
// its drawing's frames (fx/dummy.json), whole, leaning back, leaning forward, bursting, in pieces.
const DUMMY = { hp: 100, blow: 26, spell: 22, reach: 2.6, radius: 0.55, px: 2.3 / 104, burst: 0.32, rest: 5 };
const F = { whole: 0, back: 1, forward: 2, burst: 3, broken: 4 };
// The great one (fx/boss-dummy.json: whole, leaning back, leaning forward, falling apart, in pieces;
// drawn as the Golem is, on his 3.6 px grid): its size (a little over seven world units tall, nine
// tenths of his eight), how far out of thy line a blow still finds it, and its shadow's radius (it
// takes up BOSS_DUMMY.radius of the floor, yard.js). Its cracked ankle, as his: where it is (art px
// from its place, forward and up), and how near a blow must land to it. Its health, counted as his
// ankle counts toward his fall (a blow of thine 1, a spell of thine 0.7, those training's half that:
// golem.js), half of what fells him; what an ultimate takes of it besides (though his ankle never
// feels one), its share of that health per point the ultimate deals (a whole one of thine deals
// some 800, combat.js: ultPower, and takes about half of it; one of theirs, about a third); how
// long it's falling apart, and lies in pieces; and the pitch it breaks at (a playback rate: below
// any a straw one's breaking is heard at, audio.js).
const GREAT = { px: 7.1 / 260, depth: 2, shadow: 2.2, ankle: { at: [-29.2, 40.5], r: 0.9 }, hp: GOLEM.ankle.need / 2, ult: 1 / 1600, burst: 0.45, rest: 6, pitch: 0.7 };
// What a hit on the great one's ankle counts (as on the Golem's): thy blow, thy spell, theirs.
const ANKLE = { blow: 1, spell: 0.7, theirs: GOLEM.ankle.weight };
// In the tutorial (tutorial.js): how much of thine ultimate each of those counts fills (five blows
// on the ankle fill it).
const LESSON = { charge: 0.2 };
// A dummy's health over its head (placeBars): shown for `show` seconds after each blow while it's
// hurt; what it just lost lingers `lag` seconds, then drains away.
const BAR = { show: 4, lag: 0.45 };
// Within `near` of it, the camera pulls back (`dist`) and looks a little higher (`y` above the
// floor), to keep the whole of it in view (aim).
const GREAT_CAM = { near: 11, dist: 28, y: 2.6 };
const TURNED = { spark: '#dcc8a4', reach: 1.5 }; // (a blow its wood turns: the spark, where the blow lands)
// A wobble, struck: leaning away from the blow, upright, leaning back toward it, upright (seconds).
const WOBBLE = [[0.12, 'away'], [0.2, 'whole'], [0.3, 'toward'], [0.42, 'whole']];
const STOP = { blow: 0.055, spell: 0.035 }; // (thy blows hold the world still a moment, as on the arena)
const CHIPS = ['#8a5a2a', '#b07a3e', '#e8dcc0', '#5a3a1c'];
const REACH = 40; // how far an ultimate finds a dummy: across the yard
const BTN_LINGER = 0.4; // (seconds a Dismiss button stays once the pointer has left the one training)
// Those training: how far beside a straw dummy a blade stands, and behind the great one's cracked
// ankle (a spear its farther reach the farther: combat.js, reachOf); the seconds between blows, and
// between spells; what a blow and a spell of theirs take of a
// dummy (of thine); how far off a caster stands; how long before each goes over to another dummy;
// and one that comes of itself: how long it stays, how many may at once, how long its session must
// have been idle first, how long after it last trained (or was sent back) before it comes again, and
// the chance of it, each look round, every `every` seconds. Their ultimates, rarely: seconds of
// training before the first, between one and the next, and between any two on the yard.
const TRAIN = {
  beside: 1.6, ankle: [2.0, 2.3],
  blow: [1.3, 2.8], cast: [2.2, 3.8], hurt: { blow: 0.6, spell: 0.5 },
  ring: [6, 8.5], swap: [25, 50],
  self: { stay: [60, 150], most: 3, idle: 40, rest: 180, chance: 0.04, every: 4 },
  ult: { first: [40, 100], every: [90, 180], gap: 20 },
};
const rand = (a, b) => a + Math.random() * (b - a);
// Where a blow of n's meets a straw dummy (`d`): a little in front of its middle (close up, partway
// to it), at the height of a blow.
const meetAt = (n, d) => {
  const k = Math.max(0.6, 1 - 0.35 / (Math.hypot(d.pos.x - n.pos.x, d.pos.y - n.pos.y) || 1));
  return [n.pos.x + (d.pos.x - n.pos.x) * k, 1.3, n.pos.y + (d.pos.y - n.pos.y) * k + 0.3];
};

class Dummy {
  // (`great`: the great one; `block`: what keeps others off its spot, on `on`, the place it stands
  // in (yard.js; the tutorial's yards, climb.js), its floor `y` high)
  constructor(training, x, z, great = false, block = null, { on = training.ctx.world.yard, y = YARD.y } = {}) {
    this.training = training;
    this.great = great;
    this.block = block;
    this.on = on;
    this.y = y;
    this.away = false; // (put away for the tutorial: putAway)
    this.pos = new THREE.Vector2(x, z);
    this.lift = 0;
    this.alive = true;
    this.state = 'idle';
    this.mind = null;
    this.kind = great ? { radius: BOSS_DUMMY.radius, reach: 0, depth: GREAT.depth } : { radius: DUMMY.radius, reach: 0, depth: 0.9 };
    this.max = 8000; // (an ultimate hits it as hard as a great enemy: combat.ultPower)
    this.hpMax = great ? GREAT.hp : DUMMY.hp; // (its own health: a straw one's in blows' worth, the great one's in its ankle's)
    this.hp = this.hpMax;
    this.lag = this.hpMax; // (its bar's: what it just lost, lingering)
    this.hitAt = -Infinity;
    this.bar = null; // (over its head: Training.placeBars)
    this.broken = null; // { t }: bursting, then lying in pieces
    this.wobble = null; // { t, dir }
    const sheet = fxArt(great ? 'boss-dummy' : 'dummy');
    this.sheet = sheet;
    const px = great ? GREAT.px : DUMMY.px;
    const mat = new THREE.MeshLambertMaterial({ map: sheet?.frames[0] || null, transparent: true, alphaTest: 0.5 });
    const { flash, onDraw } = flashing(mat); // (struck, white a moment, as a character is)
    const w = (sheet?.w || 106) * px;
    const h = (sheet?.h || 108) * px;
    this.mid = h / 2; // (where splinters fly from)
    // (the top of its head, standing: its bar goes over it)
    const top = sheet?.rows?.[0]?.findIndex((r) => /[^.]/.test(r)) ?? 0;
    this.top = sheet ? (sheet.h - Math.max(0, top)) * px : h;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.onBeforeRender = onDraw;
    // its foot (where its base meets the floor; the great one's, between its feet) on its place
    const foot = sheet ? (sheet.w / 2 - sheet.foot[0]) * px : 0;
    mesh.position.set(x + foot, y + h / 2 - 0.02, z);
    mesh.visible = !!sheet;
    const blob = new THREE.Mesh(new THREE.CircleGeometry(great ? GREAT.shadow : 0.62, 18), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.32, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.scale.y = 0.45;
    blob.position.set(x, y + 0.015, z + 0.05);
    blob.renderOrder = 1;
    this.blob = blob;
    training.ctx.scene.add(mesh, blob);
    // (the body the ultimates and the spotlight ask after, ults.js and post.js)
    this.body = { mesh, facing: -1, flash, knock() {}, shudder() {} };
    this.frame = -1;
    this.show(F.whole);
  }

  get standing() { return !this.broken && !this.away; }

  // Put away (the yard emptied for the tutorial, tutorial.js), or back again, whole: out of sight,
  // nothing standing on its spot, nothing finding it.
  putAway(on) {
    this.away = on;
    this.body.mesh.visible = !on && !!this.sheet;
    this.blob.visible = !on;
    if (this.block) this.block.off = on;
    this.broken = null;
    this.wobble = null;
    this.hp = this.hpMax;
    this.lag = this.hpMax;
    this.hitAt = -Infinity;
    this.show(F.whole);
  }

  // Gone for good (one of the tutorial's own: Training.addDummy).
  dispose() {
    this.training.ctx.scene.remove(this.body.mesh, this.blob);
    this.body.mesh.geometry.dispose();
    this.body.mesh.material.dispose();
    this.blob.geometry.dispose();
    this.blob.material.dispose();
    this.bar?.el.remove();
    if (this.block) this.on.unblock(this.block);
  }

  // The great one's cracked ankle: [x, height above the floor].
  ankle() {
    const [ax, ay] = GREAT.ankle.at;
    return [this.pos.x + ax * GREAT.px, ay * GREAT.px];
  }

  // Its frame shown, as a drawing in the world (spellfx.js pins what sticks in it to it), as a
  // character's is (npc.js, SpriteBody.drawing): never turned, standing where its mesh stands, its
  // middle its post (where its foot is).
  drawing() {
    const rows = this.sheet?.rows?.[this.frame];
    if (!rows) return null;
    const px = this.great ? GREAT.px : DUMMY.px;
    const { w, h } = this.sheet;
    const m = this.body.mesh;
    const left = m.position.x - (w / 2) * px;
    const base = m.position.y - (h / 2) * px;
    return {
      px, w, h, facing: 1, ax: left, base, z: m.position.z, mid: this.sheet.foot[0],
      opaque: (c, r) => c >= 0 && r >= 0 && c < w && r < h && rows[r][c] !== '.',
      x: (c) => left + (c + 0.5) * px,
      y: (r) => base + (h - r - 0.5) * px,
      col: (x) => Math.floor((x - left) / px),
      row: (y) => Math.floor(h - (y - base) / px),
    };
  }

  show(k) {
    if (k === this.frame || !this.sheet) return;
    this.frame = k;
    this.body.mesh.material.map = this.sheet.frames[k];
  }

  // Struck: it flashes (not as a poison or a bleeding ticks: `flash`), and wobbles away from the
  // blow (`dir`: the way the blow went), or bursts. A straw one takes `amount`; the great one, only
  // what the blow on its ankle counts (`ankle`: ANKLE), as the Golem's does, or, from an ultimate
  // (`ult`: its blows, its bleeding, its poison), its share of what that deals (GREAT.ult). In the
  // tutorial (Training.lesson) the great one takes nothing from a blow, its ankle filling thine
  // ultimate instead, and an ultimate breaks it at a stroke.
  struck(amount, dir, flash = true, ankle = 0, ult = false) {
    if (this.broken || this.away) return;
    if (flash) this.body.flash();
    let lost = !this.great ? amount : ult ? amount * GREAT.ult * this.hpMax : ankle;
    if (this.great && this.training.lesson) {
      if (!ult && ankle > 0) this.training.charge(ankle);
      lost = ult ? this.hp : 0;
    }
    if (lost > 0) {
      this.hp -= lost;
      this.hitAt = this.training.clock;
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.broken = { t: 0 };
      // (a straw one's each at a pitch of its own; the great one's lowest of all: audio.js)
      this.training.ctx.sound?.play('yard-break', { at: [this.pos.x, this.pos.y], volume: this.great ? 1.3 : 1, pitch: this.great ? GREAT.pitch : null });
      this.wobble = null;
      this.show(F.burst);
      this.training.chips(this, this.great ? 110 : 46, this.great ? 5 : 3.4);
      return;
    }
    this.wobble = { t: 0, dir: dir || 1 };
    this.training.chips(this, 6, 1.4);
  }

  step(dt) {
    if (this.away) return;
    // (its bar: what it just lost lingers a moment, then drains away)
    if (this.training.clock - this.hitAt > BAR.lag) this.lag = Math.max(this.hp, this.lag - dt * this.hpMax * 0.9);
    if (this.broken) {
      const b = this.broken;
      const T = this.great ? GREAT : DUMMY;
      b.t += dt;
      if (b.t < T.burst) return;
      this.show(F.broken);
      // (the tutorial's stay in pieces)
      if (b.t < T.burst + T.rest || this.training.lesson) return;
      // whole again, in a puff of dust
      this.broken = null;
      this.hp = this.hpMax;
      this.lag = this.hpMax;
      this.show(F.whole);
      this.training.dust(this);
      return;
    }
    const w = this.wobble;
    if (!w) return;
    w.t += dt;
    const step = WOBBLE.find(([until]) => w.t < until);
    if (!step) { this.wobble = null; this.show(F.whole); return; }
    // (leaning away: its head the way the blow went; its drawing leans forward to the right. The
    // great one, struck on its ankle, has its leg swept from under it: it tips back first, its leg
    // kicked up, then forward, whichever way the blow went)
    const away = this.great || w.dir <= 0 ? F.back : F.forward;
    const toward = away === F.back ? F.forward : F.back;
    this.show(step[1] === 'away' ? away : step[1] === 'toward' ? toward : F.whole);
  }
}

export class Training {
  constructor(ctx) {
    this.ctx = ctx;
    this.clock = 0;
    this.state = 'fighting'; // (an ultimate may be loosed here, ults.js)
    this.fx = [];
    this.stop = 0;
    this.boss = null; // the dummy an ultimate was last loosed at (ults.js asks after it)
    // what's loosed here, set on the yard's floor (its particles likewise; in the tutorial, on the
    // floor of whichever of its yards thou'rt on: setFloor)
    this.floorY = YARD.y;
    this.group = new THREE.Group();
    this.group.position.y = YARD.y;
    this.group.userData.floor = true; // (not the world's: post.js)
    ctx.scene.add(this.group);
    const lifted = (p) => [p[0], p[1] + this.floorY, p[2]];
    const particles = {
      emit: (o) => ctx.particles.emit({ ...o, pos: lifted(o.pos), attract: o.attract && { ...o.attract, y: o.attract.y + this.floorY } }),
    };
    this.fxCtx = { scene: this.group, particles, add: (e) => this.fx.push(e) };
    this.dummies = null; // (made once their drawing has loaded: start)
    this.lesson = null; // the tutorial's: { ult } (lessonStart)
    this.extra = []; // its own dummies (addDummy)
    this.focus = false; // the camera between thee and the great one (Q), or on thee
    this.told = new Set(); // (the hints in the log, each said once)
    this.lookIn = TRAIN.self.every; // (till it next looks for one with nothing to do: lookRound)
    this.lastUlt = -Infinity; // (when one training last loosed its ultimate)
    // the button under each one training, to send it back (placeButtons); each dummy's health over
    // its head (placeBars)
    this.btnRoot = document.getElementById('trainees');
    this.barRoot = document.getElementById('dummy-bars');
    this.btns = new Map();
    this.v = new THREE.Vector3();
  }

  // The dummies, once the effects' art has loaded (main.js).
  start() {
    if (this.dummies) return;
    const blocks = this.ctx.world.yard.blocks;
    this.dummies = [
      new Dummy(this, BOSS_DUMMY.x, YARD.cz + BOSS_DUMMY.z, true, blocks?.great),
      ...DUMMY_SPOTS.map(([x, z], i) => new Dummy(this, x, YARD.cz + z, false, blocks?.dummies[i])),
    ];
  }

  // Whether n is on the yard (its floor, not the stair; or, in the tutorial, on one of its yards
  // above: climb.js).
  has(n) {
    const { world } = this.ctx;
    return !!n && (!!world.yard?.inside(n.pos.x, n.pos.y) || !!world.climb?.inside(n.pos.x, n.pos.y));
  }

  // What's loosed here set on a floor `y` high (the tutorial's, as thou climbest its yards).
  setFloor(y) {
    this.floorY = y;
    this.group.position.y = y;
  }

  // Where the camera looks (main.js), near the great one: from farther back and a little higher, as
  // on the arena a great enemy is kept in view (fight.aim), and with the focus on it (Q), between
  // thee and it; elsewhere it follows thee as ever.
  aim(me) {
    const g = this.dummies?.find((d) => d.great && !d.away);
    if (!g || !this.has(me) || Math.hypot(me.pos.x - g.pos.x, me.pos.y - g.pos.y) > GREAT_CAM.near) return null;
    if (this.focus) return { at: [me.pos.x + (g.pos.x - me.pos.x) * 0.45, g.y + GREAT_CAM.y, me.pos.y + (g.pos.y - me.pos.y) * 0.45], dist: GREAT_CAM.dist, mode: 'great-focus' };
    return { at: [me.pos.x, g.y + GREAT_CAM.y, me.pos.y], dist: GREAT_CAM.dist, mode: 'great' };
  }

  // Q by the great one: the camera's focus on it, or back on thee (as on the arena: fight.js).
  // Whether it was by it to turn.
  toggleFocus(me) {
    if (!this.aim(me)) return false;
    this.focus = !this.focus;
    this.focusUsed = true; // (the tutorial's hint, shown till then: tutorial.js)
    return true;
  }

  // Whoever looses an ultimate here is watched (ults.js: the world stands still for it) if thou'rt here.
  facing(me) {
    return this.has(me);
  }

  // The dummy that a blow, spell or ultimate of n's would find: the nearest still standing, in front
  // of it (`dir`, [dx, dz]: the way it's aimed; a cone of `cos` either side), within `reach`.
  target(n, dir = [n.body.facing, 0], reach = REACH, cos = 0.5) {
    let best = null;
    let bd = Infinity;
    for (const d of this.dummies || []) {
      if (!d.standing) continue;
      const dx = d.pos.x - n.pos.x;
      const dz = d.pos.y - n.pos.y;
      const dist = Math.hypot(dx, dz) || 1;
      if (dist > reach || (dx * dir[0] + dz * dir[1]) / dist < cos) continue;
      if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  }

  // The nearest dummy standing on the line `dir` [dx, dz] from n, as an aimed ultimate finds its
  // mark (ults.js: ahead of it, and within `half` of the line), if one does.
  onLine(n, dir, half = 1.9) {
    let best = null;
    let bd = Infinity;
    for (const d of this.dummies || []) {
      if (!d.standing) continue;
      const dx = d.pos.x - n.pos.x;
      const dz = d.pos.y - n.pos.y;
      const along = dx * dir[0] + dz * dir[1];
      if (along > 0.5 && along < 16 && Math.abs(dx * dir[1] - dz * dir[0]) < half && along < bd) { bd = along; best = d; }
    }
    return best;
  }

  // The point of the dummy aimed at (`up` above its feet), where spells and ultimates fly (ults.js).
  bossPoint(up = 2) {
    const b = this.boss;
    return b ? [b.pos.x, b.lift + up, b.pos.y + 0.2] : [0, 0, 0];
  }

  // Thy blow lands (pilot.js → director.strikeFrom): the nearest dummy on its line within reach (a
  // spear's the farther: combat.js, reachOf), or a little off it (AIM); the great one only on its
  // cracked ankle, its wood turning it anywhere else.
  strikeFrom(p) {
    const way = wayOf(p);
    const far = reachOf(p);
    const g = this.dummies?.find((x) => x.great && x.standing); // (in pieces, a blow passes over it)
    if (g) {
      const [ax, ay] = g.ankle();
      if (onAim(p.pos.x, p.pos.y, way, ax, g.pos.y, GREAT.ankle.r, GREAT.ankle.r + 0.4, TURNED.reach + far, AIM.blow, 0.4) != null) {
        this.landed(p, g, [ax, ay, g.pos.y + 0.3]);
        return true;
      }
      if (onAim(p.pos.x, p.pos.y, way, g.pos.x, g.pos.y, g.kind.radius, g.kind.depth, DUMMY.reach + far, AIM.blow) != null) {
        this.turned(p, p.pos.x + way[0] * (TURNED.reach + far), p.pos.y + way[1] * (TURNED.reach + far));
        return true;
      }
    }
    let d = null;
    let best = Infinity;
    for (const x of this.dummies || []) {
      if (!x.standing || x.great) continue;
      const along = onAim(p.pos.x, p.pos.y, way, x.pos.x, x.pos.y, x.kind.radius, x.kind.depth, DUMMY.reach + far, AIM.blow);
      if (along != null && along < best) { best = along; d = x; }
    }
    if (!d) return false;
    this.landed(p, d, meetAt(p, d));
    return true;
  }

  // Thy blow on a dummy (`at`: where the blade meets it): a spark there, the world holding still a
  // moment, the view jolted the way the blow went.
  landed(p, d, at) {
    const dir = Math.sign(d.pos.x - p.pos.x) || p.body.facing;
    this.fx.push(new Spark(this.fxCtx, { color: styleOf(p).color, at, dir, size: 1.7 }));
    this.hitStop(STOP.blow);
    p.body.stretch?.();
    this.ctx.rig?.punch?.(dir * 0.12);
    d.struck(DUMMY.blow, dir, true, ANKLE.blow);
  }

  // A blow the great one's wood turns, as the Golem's stone turns one (golem.js, clang): splinters
  // and a spark, and nothing more (no flash, no wobble, no holding still); the striker (`p`)
  // bounces off it, its drawing thrown back the way it came. The first time (thine), a word on where
  // to strike it.
  turned(p, x, z, mine = true) {
    this.fxCtx.particles.emit({
      pos: [x, 1.2, z + 0.2], spread: [0.2, 0.3, 0.2], vel: [0, 1.2, 0], velSpread: [1.4, 1, 0.8],
      color: [...CHIPS, '#ffe6b0'], size: 0.06, life: 0.4, count: 10, drag: 1.6, intensity: 1.2,
    });
    this.fx.push(new Spark(this.fxCtx, { color: TURNED.spark, at: [x, 1.2, z + 0.3], dir: p.body.facing, size: 1.1 }));
    p.body.knock((p.body.sheet.lunge?.attack || 0) + 0.2, -p.body.facing);
    if (mine) this.tell('wood', 'Wood turns thy blows: strike the great dummy\'s cracked ankle, low on its back leg, as thou wouldst the Golem\'s');
  }

  tell(key, text) {
    if (this.told.has(key)) return;
    this.told.add(key);
    this.ctx.ui?.log(text, 'gold');
  }

  // Thy spell (pilot.js), the way thou pointest (combat.js, aimSpell): straight along thy line,
  // striking the first dummy it comes up to on it (or a little off it), else on into nothing. (The
  // great one it strikes on its cracked ankle, as a spell does the Golem: what rises, rises there.)
  playerCast(n, at) {
    const aim = aimSpell(n, at);
    const standing = () => (this.dummies || []).filter((d) => d.standing);
    aim.meets = (x, z, way = aim.dir, early = AIM.early) => {
      const d = standing().find((s) => meets(x, z, way, s.pos.x, s.pos.y, s.kind.radius, s.kind.depth, AIM.spell, early));
      return d ? struckOf(d) : null;
    };
    aim.first = (reach) => {
      let best = null;
      for (const d of standing()) {
        const along = onAim(aim.from[0], aim.from[2], aim.dir, d.pos.x, d.pos.y, d.kind.radius, d.kind.depth, reach, AIM.spell);
        if (along == null || (best && along >= best.along)) continue;
        best = { along: Math.max(0.5, along), x: d.great ? d.ankle()[0] : d.pos.x, z: d.pos.y + (d.great ? 0.2 : 0), struck: struckOf(d) };
      }
      return best;
    };
    castSpell(this.fxCtx, n, {
      aim,
      hit: (p, share, struck) => {
        const d = struck?.target;
        if (!d?.standing) return;
        this.hitStop(STOP.spell);
        d.struck(DUMMY.spell, Math.sign(d.pos.x - n.pos.x) || 1, true, ANKLE.spell);
      },
    });
  }

  // R: thine ultimate (always full here, but in the tutorial once its bar is), at the dummy in front
  // of thee (an aimed one: the way thou pointest, at the dummy on that line, if one stands there;
  // else it flies on past the nearest).
  playerUlt(at) {
    const { pilot, ults } = this.ctx;
    const n = pilot.npc;
    if (!n || pilot.dead || !this.has(n)) return false;
    if (n.travel || n.shift || (n.action && !['attack', 'cast', 'hurt', 'crouch', 'use', 'gesture'].includes(n.action.kind))) return false;
    let dir = null;
    let d = null;
    if (ults.of(n)?.aim) {
      dir = aimOf(n, at, muzzleSpot(n, 'ult')[1] + (n.lift || 0));
      d = this.onLine(n, dir) || this.target(n, dir, REACH, -1); // (else it flies on past)
    } else {
      const side = at ? [Math.sign(at.x - n.pos.x) || n.body.facing, 0] : [n.body.facing, 0];
      d = this.target(n, side, REACH, -0.2) || this.target(n, [-side[0], 0], REACH, -0.2);
    }
    if (!d || (this.lesson && (pilot.ult || 0) < 1)) return false;
    this.boss = d;
    if (!this.lesson) pilot.ult = 1;
    if (!ults.ready(n, true)) return false;
    return ults.start(n, { dir, player: true });
  }

  // An ultimate's blow lands on the dummy it was loosed at (thine: the one last aimed at; one of
  // those training: its own, `b`).
  ultHit(n, amount, at = null, b = this.boss) {
    if (!b) return;
    b.struck(amount, Math.sign(b.pos.x - n.pos.x) || 1, true, 0, true);
  }

  // The world holds still `secs` seconds as thy blow lands (main.js asks held).
  hitStop(secs) {
    this.stop = Math.max(this.stop, secs);
  }

  held(dt) {
    if (this.stop <= 0) return false;
    this.stop -= dt;
    return true;
  }

  // ------------------------------------------------------------------------------------------
  // the tutorial's (tutorial.js)

  // The yard emptied for it: every dummy put away (and whoever trains sent back), the dummies its
  // own (addDummy), and those broken staying in pieces. Its `lesson` says what it shows of the
  // great one once that's back: thine ultimate's bar (`ult`, fight.js), filled by its cracked ankle
  // alone (Dummy.struck, charge).
  lessonStart() {
    this.start();
    this.lesson = { ult: false };
    this.focus = false;
    for (const n of this.trainees()) this.dismiss(n);
    for (const d of this.dummies) d.putAway(true);
  }

  // The yard as it was: its own dummies back where they stood, whole.
  lessonEnd() {
    if (!this.lesson) return;
    for (const d of [...this.extra]) this.removeDummy(d);
    this.lesson = null;
    this.focus = false;
    this.setFloor(YARD.y);
    for (const d of this.dummies) d.putAway(false);
  }

  // A dummy of the tutorial's own, at (x, z): a straw one, or the great one (`great`); on the
  // training yard, or on `on`, one of its yards above (climb.js), whose floor is `y` high.
  addDummy(x, z, { great = false, on = this.ctx.world.yard, y = YARD.y } = {}) {
    const block = on.blockCircle(x - on.cx, z - on.cz, great ? BOSS_DUMMY.radius : 0.5);
    const d = new Dummy(this, x, z, great, block, { on, y });
    this.dummies.push(d);
    this.extra.push(d);
    return d;
  }

  removeDummy(d) {
    d.dispose();
    this.dummies = this.dummies.filter((x) => x !== d);
    this.extra = this.extra.filter((x) => x !== d);
  }

  // Thy blow (or spell) on the great one's cracked ankle, in the tutorial: thine ultimate fills.
  charge(ankle) {
    const pilot = this.ctx.pilot;
    pilot.ult = Math.min(1, (pilot.ult || 0) + ankle * LESSON.charge);
  }

  // ------------------------------------------------------------------------------------------
  // those training

  trainees() {
    return [...this.ctx.director.npcs.values()].filter((n) => n.trainee && !n.dead);
  }

  // At the yard's grace (interact.js): the window that chooses who trains (companions.js), with
  // whoever is training already in its slots and a spare one; whoever it leaves in them trains,
  // whoever it takes out goes back.
  ask() {
    const { companions, fight } = this.ctx;
    if (!companions || companions.shown) return;
    companions.ask({
      title: 'Choose who trains', foe: 'The Training Yard', why: 'call whoever thou wilt to train, or send them back, at any time',
      start: 'Train', pick: 'Choose who trains', party: this.trainees(), spare: true, remember: false,
      busy: (n) => (n.fighter ? 'In the Arena of Trials' : null),
    }).then((party) => { if (party) this.setTrainees(party); });
  }

  setTrainees(party) {
    const chosen = new Set(party);
    for (const n of this.trainees()) if (!chosen.has(n)) this.dismiss(n);
    for (const n of party) if (!n.trainee) this.invite(n);
  }

  // n comes to train (`self`: of itself, with nothing to do): it drops what it was doing, which
  // waits (with whatever its session wants meanwhile) till it goes back; no spirit ashes, no signs
  // over its head; it comes by grace.
  invite(n, self = false) {
    if (n.trainee || n.dead || n.spectre || n.fighter || n.intent.kind === 'leave') return;
    if (n.slot) n.releaseSlot();
    n.slot = null;
    n.path = [];
    n.goal = null;
    n.talk = null;
    n.inTalk = false;
    if (n.action && n.action.kind !== 'transform') n.action = null;
    const resume = n.piloted ? n.resume : n.intent;
    n.trainee = {
      self, resume, post: null, cd: rand(0.4, 1.6), swapAt: 0, until: self ? this.clock + rand(...TRAIN.self.stay) : Infinity,
      ultIn: rand(...TRAIN.ult.first),
    };
    if (n.piloted) { n.resume = { kind: 'train' }; return; } // (thou holdest it: it trains once thou lettest go)
    n.intent = { kind: 'none' };
    n.setIntent({ kind: 'train' });
    n.setSpirits(0);
    n.clearIcon();
    n.clearPersistentIcon();
    if (!this.has(n) && !n.travel) this.come(n);
  }

  // By grace to the yard's little grace (npc.js, fastTravel: it arrives in front of it).
  come(n) {
    const [gx, gz] = this.ctx.world.yard.graceSpot();
    n.fastTravel(gx, gz);
  }

  // n goes back to its own life (thy button under it, or the window; or, come of itself, its stay
  // over or work come for it: `want`): what its session wants now, else what it was doing, else
  // home.
  dismiss(n, want = null) {
    const t = n.trainee;
    if (!t) return;
    n.trainee = null;
    n.trainedAt = this.clock; // (it won't come again of itself for a while: lookRound)
    if (n.action?.kind === 'trainAttack' || n.action?.kind === 'trainCast') n.action = null;
    n.setSpirits(n.session?.spirits || 0);
    let next = want || t.resume || { kind: 'wander' };
    if (['gather', 'train', 'none', 'piloted', 'fight'].includes(next.kind)) next = n.unbound ? { kind: 'journey', dest: 'hub' } : { kind: 'journey' };
    if (n.piloted) { n.resume = next; return; } // (thou holdest it: its life waits for thee to let go)
    n.intent = { kind: 'none' };
    n.setIntent(next);
  }

  // One training, from moment to moment (npc.js, pursue): to the yard if it isn't on it; to its
  // post, facing the dummy; and there, a blow or a spell every so often while the dummy stands.
  drive(n, dt) {
    const t = n.trainee;
    if (!t) { n.intent = { kind: 'none' }; n.setIntent({ kind: 'wander' }); return false; }
    n.body.play('idle');
    if (!this.has(n)) {
      t.post = null;
      if (!n.travel) this.come(n);
      return false;
    }
    if (t.self && this.clock > t.until) { this.dismiss(n); return false; }
    let p = t.post;
    if (p && !p.dummy.standing) {
      p.down ??= this.clock; // (its dummy burst: another, unless it stands again soon)
      if (this.clock - p.down > 1.2) p = null;
    }
    if (!p || this.clock > t.swapAt) {
      p = this.post(n);
      t.post = p;
      t.swapAt = this.clock + rand(...TRAIN.swap);
      if (!p) return false;
    }
    if (Math.hypot(p.x - n.pos.x, p.z - n.pos.y) > 0.6) {
      // (to it; and if it can't get there, another)
      if (p.tries++ < 2) { n.goTo(p.x, p.z, false); return true; }
      t.post = null;
      return false;
    }
    n.body.facing = p.face;
    t.cd -= dt;
    t.ultIn -= dt;
    if (!p.dummy.standing) return false;
    // rarely, its ultimate (never two too close together on the yard)
    if (t.ultIn <= 0 && this.clock - this.lastUlt > TRAIN.ult.gap) {
      t.ultIn = rand(...TRAIN.ult.every);
      if (this.ultQuiet(n, p.dummy)) { this.lastUlt = this.clock; return false; }
    }
    if (t.cd > 0) return false;
    blow(n, p.cast ? 'trainCast' : 'trainAttack', { spell: p.cast, dummy: p.dummy });
    t.cd = rand(...(p.cast ? TRAIN.cast : TRAIN.blow));
    return false;
  }

  // Where n trains next: a caster, off to one side of a dummy; a blade, beside a straw dummy, or
  // behind the great one at its cracked ankle; never where another trains, nor off the floor; the
  // nearer, mostly, with a little chance in it, so that they spread over the yard.
  post(n) {
    const { nav, world } = this.ctx;
    const others = this.trainees().filter((m) => m !== n && m.trainee.post && !m.fighter).map((m) => m.trainee.post);
    const free = (x, z) => world.yard.isWalk(x, z) && nav.walkable(x, z) && others.every((o) => Math.hypot(o.x - x, o.z - z) > 1.3);
    const caster = casts(n) && (styleOf(n).range === 'far' || Math.random() < 0.5);
    const far = reachOf(n);
    const options = [];
    for (const d of this.dummies || []) {
      if (!d.standing) continue;
      if (caster) {
        for (const side of [-1, 1]) for (const dz of [-1.2, 0, 1.2]) options.push({ dummy: d, x: d.pos.x + side * rand(...TRAIN.ring), z: d.pos.y + dz, face: -side, cast: true });
      } else if (d.great) {
        const [ax] = d.ankle();
        for (const dz of [0, -0.8, 0.8]) options.push({ dummy: d, x: ax - rand(...TRAIN.ankle) - far, z: d.pos.y + dz, face: 1 });
      } else {
        const off = TRAIN.beside + far;
        options.push({ dummy: d, x: d.pos.x - off, z: d.pos.y, face: 1 }, { dummy: d, x: d.pos.x + off, z: d.pos.y, face: -1 });
      }
    }
    let best = null;
    let bs = Infinity;
    for (const o of options) {
      if (!free(o.x, o.z)) continue;
      const score = Math.hypot(o.x - n.pos.x, o.z - n.pos.y) + Math.random() * 10;
      if (score < bs) { bs = score; best = o; }
    }
    return best && { ...best, tries: 0 };
  }

  // One training looses its ultimate at its dummy, quietly (ults.js, startQuiet); but never Ulric's
  // spears, loosed by thy hand alone.
  ultQuiet(n, d) {
    const { ults } = this.ctx;
    const u = ults?.of(n);
    if (!u || heroKey(n) === 'bandit' || ults.active) return false;
    // (an aimed one straight at its dummy)
    const dx = d.pos.x - n.pos.x;
    const dz = d.pos.y - n.pos.y;
    const len = Math.hypot(dx, dz) || 1;
    const dir = u.aim ? [dx / len, dz / len] : null;
    return ults.startQuiet(n, { place: this, b: d, dir });
  }

  // A blow of one training lands, at the turn of its swing (update): on the great one's cracked
  // ankle, or its wood turns it; on a straw dummy beside it. No holding still, no jolt: those are
  // thine.
  npcBlow(n, d) {
    if (!d?.standing) return;
    const far = reachOf(n); // (a spear's reach: combat.js)
    if (d.great) {
      const [ax, ay] = d.ankle();
      const ahead = (ax - n.pos.x) * n.body.facing;
      if (ahead > -0.4 && ahead < TURNED.reach + far + GREAT.ankle.r && Math.abs(n.pos.y - d.pos.y) < GREAT.ankle.r + 0.4) this.npcLanded(n, d, [ax, ay, d.pos.y + 0.3]);
      else this.turned(n, n.pos.x + n.body.facing * (TURNED.reach + far), n.pos.y, false);
      return;
    }
    const ahead = (d.pos.x - n.pos.x) * n.body.facing;
    if (ahead > -0.6 && ahead < DUMMY.reach + far + d.kind.radius && Math.abs(d.pos.y - n.pos.y) < d.kind.depth) {
      this.npcLanded(n, d, meetAt(n, d));
    }
  }

  npcLanded(n, d, at) {
    const dir = Math.sign(d.pos.x - n.pos.x) || n.body.facing;
    this.fx.push(new Spark(this.fxCtx, { color: styleOf(n).color, at, dir, size: 1.4 }));
    d.struck(DUMMY.blow * TRAIN.hurt.blow, dir, true, ANKLE.blow * ANKLE.theirs);
  }

  // A spell of one training, loosed at the turn of its cast: at its dummy (the great one's ankle).
  npcCast(n, d) {
    if (!d?.standing) return;
    const from = muzzleOf(n);
    const dx = d.pos.x - from[0];
    const dz = d.pos.y - from[2];
    const len = Math.hypot(dx, dz) || 1;
    castSpell(this.fxCtx, n, {
      target: () => (d.great ? [...d.ankle(), d.pos.y + 0.2] : [d.pos.x, 1.3, d.pos.y + 0.2]),
      dir: [dx / len, dz / len],
      hit: () => { if (d.standing) d.struck(DUMMY.spell * TRAIN.hurt.spell, Math.sign(d.pos.x - n.pos.x) || 1, true, ANKLE.spell * ANKLE.theirs); },
    });
  }

  // Now and then one with nothing to do goes to train of itself (never while a great enemy is
  // abroad, nor more than a few at once): a hero of the Round Table without a quest, Maren when thou
  // art someone else, or one whose session has been idle a while, wandering or resting at home.
  lookRound() {
    const { director, fight, tutorial } = this.ctx;
    if (fight?.hunting?.() || fight?.active || tutorial?.holding) return;
    if (this.trainees().filter((n) => n.trainee.self).length >= TRAIN.self.most) return;
    const now = performance.now() / 1000;
    for (const n of [...director.heroes.values(), director.maren]) {
      if (!n || n.dead || n.spectre || n.piloted || n.fighter || n.trainee || n.travel || n.dragged || n.talk || n.inTalk || n.action || n.fade < 1) continue;
      if (this.clock - (n.trainedAt ?? -Infinity) < TRAIN.self.rest) continue;
      const idle = n.unbound
        ? ['gather', 'wander'].includes(n.intent.kind)
        : n.session?.state === 'idle' && ['wander', 'rest', 'visit'].includes(n.intent.kind) && now - (n.idleSince ?? now) > TRAIN.self.idle;
      if (!idle || Math.random() > TRAIN.self.chance) continue;
      this.invite(n, true);
      return; // (one at a time)
    }
  }

  // The button under each one training, to send it back, kept under its feet (main.js, every
  // frame, after the camera); shown only while the pointer is on it or on them (or a moment after,
  // BTN_LINGER, so that it can be reached from them), or while they're the one inspected (on a
  // screen without a pointer, tapped); never while it's on its way, held by thee, carried, behind
  // the camera, or seen from afar.
  placeButtons() {
    const { ui, rig } = this.ctx;
    if (!this.btnRoot) return;
    const now = performance.now() / 1000;
    for (const n of this.trainees()) {
      let b = this.btns.get(n);
      const show = this.has(n) && !n.travel && !n.piloted && !n.dragged && n.fade >= 1 && rig.dist < 40;
      if (!show) { if (b) b.hidden = true; continue; }
      if (!b) { b = this.button(n); this.btns.set(n, b); }
      const p = ui.project(this.v.set(n.pos.x, groundAt(n.pos.x, n.pos.y) + n.lift, n.pos.y));
      b.hidden = p.behind;
      b.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y) + 20}px) translate(-50%, 0)`;
      if (n.hovered || b.over || ui.selected === n) b.wanted = now;
      b.classList.toggle('shown', now - (b.wanted ?? -Infinity) < BTN_LINGER);
    }
    for (const [n, b] of this.btns) if (!n.trainee || n.dead) { b.remove(); this.btns.delete(n); }
  }

  // Each dummy's health, a bar over its head (its own, not the screen's: it stays with it): shown
  // only while it's hurt and for a while (BAR.show) after the blow that last hurt it; never while it
  // lies in pieces, behind the camera, or seen from afar.
  placeBars() {
    if (!this.barRoot || !this.dummies) return;
    const { ui, rig } = this.ctx;
    for (const d of this.dummies) {
      const want = d.standing && d.hp < d.hpMax && this.clock - d.hitAt < BAR.show && rig.dist < 40;
      if (!want && !d.bar) continue;
      if (!d.bar) d.bar = this.makeBar(d);
      d.bar.el.classList.toggle('shown', want);
      if (!want) continue;
      const p = ui.project(this.v.set(d.pos.x, d.y + d.top + 0.3, d.pos.y));
      d.bar.el.hidden = p.behind;
      d.bar.el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
      d.bar.hp.style.width = `${(100 * d.hp) / d.hpMax}%`;
      d.bar.lag.style.width = `${(100 * d.lag) / d.hpMax}%`;
    }
  }

  makeBar(d) {
    const el = document.createElement('div');
    el.className = d.great ? 'bar great' : 'bar';
    const lag = document.createElement('i');
    lag.className = 'lag';
    const hp = document.createElement('i');
    hp.className = 'hp';
    el.append(lag, hp);
    this.barRoot.append(el);
    return { el, hp, lag };
  }

  button(n) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dismiss';
    b.textContent = 'Dismiss';
    b.title = `Send ${n.name.first} back`;
    b.setAttribute('aria-label', `Send ${n.displayName} back from training`);
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('pointerenter', () => { b.over = true; });
    b.addEventListener('pointerleave', () => { b.over = false; });
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismiss(n);
      b.blur();
    });
    this.btnRoot.append(b);
    return b;
  }

  // Splinters and straw flying off a dummy struck (`count` of them, `force`: how hard).
  chips(d, count, force) {
    this.fxCtx.particles.emit({
      pos: [d.pos.x, d.mid, d.pos.y + 0.1], spread: [0.25, 0.5, 0.15], vel: [0, force * 0.6, 0], velSpread: [force, force * 0.6, force * 0.4],
      color: CHIPS, size: 0.07, life: 0.8, count, gravity: 9, drag: 0.6, intensity: 0.9,
    });
  }

  dust(d) {
    this.fxCtx.particles.emit({
      pos: [d.pos.x, 0.3, d.pos.y], spread: [0.5, 0.2, 0.3], vel: [0, 0.8, 0], velSpread: [0.8, 0.4, 0.4],
      color: ['#b8b0a0', '#8a8278', '#e0d8c8'], size: 0.1, life: 0.9, count: 22, drag: 1.2, intensity: 0.7,
    });
  }

  update(dt) {
    this.clock += dt;
    if (!this.dummies) return;
    const { pilot } = this.ctx;
    // on the yard, thine ultimate is always full (but in the tutorial: charge)
    if (this.has(pilot.npc) && !this.lesson) pilot.ult = 1;
    for (const d of this.dummies) {
      d.step(dt);
      // (a poison or a bleeding wobbles it as it ticks)
      stepStatus(d, this.clock, dt, { hit: (amount) => d.struck(amount, 1, false, 0, true), shift: () => {}, particles: this.fxCtx.particles });
    }
    // the blows and spells of those training, at the turn of each
    for (const n of this.ctx.director.npcs.values()) {
      const a = n.action;
      if (!n.trainee || !a || a.hit || a.t < a.hitAt) continue;
      if (a.kind === 'trainAttack') { a.hit = true; this.npcBlow(n, a.dummy); }
      else if (a.kind === 'trainCast') { a.hit = true; this.npcCast(n, a.dummy); }
    }
    this.lookIn -= dt;
    if (this.lookIn <= 0) {
      this.lookIn = TRAIN.self.every;
      this.lookRound();
    }
    const fx = this.fx;
    this.fx = [];
    for (const e of fx) {
      if (e.step(dt)) this.fx.push(e);
      else e.dispose();
    }
  }
}
