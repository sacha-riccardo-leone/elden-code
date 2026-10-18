// Training in the yard below the Hold (yard.js): straw dummies to strike, and a great one of wood
// with a halberd in the middle. Each flashes white and wobbles as a blow, a spell or an ultimate
// lands on it; a straw one, once it has taken enough, bursts into pieces, lies in them a while, and
// stands whole again; the great one never breaks. They never strike back.
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

import * as THREE from 'three';
import { YARD, DUMMY_SPOTS, BOSS_DUMMY } from './yard.js';
import { fxArt } from './fxart.js';
import { flashing } from './npc.js';
import { styleOf, castSpell, muzzleOf, stepStatus, RANGED } from './combat.js';
import { Spark } from './spellfx.js';

// A dummy: its health, what a blow and a spell of thine take of it (an ultimate's blows take what
// they take, ults.js; a poison what it takes), how far in front of thee a blow finds it, its size
// (world units to its drawing's pixel), how long it bursts and how long it lies broken. `frames`:
// its drawing's frames (fx/dummy.json), whole, leaning back, leaning forward, bursting, in pieces.
const DUMMY = { hp: 100, blow: 26, spell: 22, reach: 2.6, radius: 0.55, px: 2.3 / 104, burst: 0.32, rest: 5 };
const F = { whole: 0, back: 1, forward: 2, burst: 3, broken: 4 };
// The great one (fx/boss-dummy.json: whole, leaning back, leaning forward): its size (a little over
// five world units tall, under Fenrath's six), how far out of thy line a blow still finds it, and its
// shadow's radius. It takes up BOSS_DUMMY.radius of the floor (yard.js).
const GREAT = { px: 5.2 / 164, depth: 1.6, shadow: 1.7 };
// A wobble, struck: leaning away from the blow, upright, leaning back toward it, upright (seconds).
const WOBBLE = [[0.12, 'away'], [0.2, 'whole'], [0.3, 'toward'], [0.42, 'whole']];
const STOP = { blow: 0.055, spell: 0.035 }; // (thy blows hold the world still a moment, as on the arena)
const CHIPS = ['#8a5a2a', '#b07a3e', '#e8dcc0', '#5a3a1c'];
const REACH = 40; // how far an ultimate finds a dummy: across the yard

class Dummy {
  // (`great`: the great one, that never breaks)
  constructor(training, x, z, great = false) {
    this.training = training;
    this.great = great;
    this.pos = new THREE.Vector2(x, z);
    this.lift = 0;
    this.alive = true;
    this.state = 'idle';
    this.mind = null;
    this.kind = great ? { radius: BOSS_DUMMY.radius, reach: 0, depth: GREAT.depth } : { radius: DUMMY.radius, reach: 0, depth: 0.9 };
    this.max = 8000; // (an ultimate hits it as hard as a great enemy: combat.ultPower)
    this.hp = DUMMY.hp;
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
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.onBeforeRender = onDraw;
    // its foot (where its base meets the floor; the great one's, between its feet) on its place
    const foot = sheet ? (sheet.w / 2 - sheet.foot[0]) * px : 0;
    mesh.position.set(x + foot, YARD.y + h / 2 - 0.02, z);
    mesh.visible = !!sheet;
    const blob = new THREE.Mesh(new THREE.CircleGeometry(great ? GREAT.shadow : 0.62, 18), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.32, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.scale.y = 0.45;
    blob.position.set(x, YARD.y + 0.015, z + 0.05);
    blob.renderOrder = 1;
    training.ctx.scene.add(mesh, blob);
    // (the body the ultimates and the spotlight ask after, ults.js and post.js)
    this.body = { mesh, facing: -1, flash, knock() {}, shudder() {} };
    this.frame = -1;
    this.show(F.whole);
  }

  get standing() { return !this.broken; }

  show(k) {
    if (k === this.frame || !this.sheet) return;
    this.frame = k;
    this.body.mesh.material.map = this.sheet.frames[k];
  }

  // Struck: it flashes (not as a poison or a bleeding ticks: `flash`), and wobbles away from the
  // blow (`dir`: the way the blow went), or bursts (never the great one).
  struck(amount, dir, flash = true) {
    if (this.broken) return;
    if (flash) this.body.flash();
    if (!this.great) this.hp -= amount;
    if (this.hp <= 0) {
      this.broken = { t: 0 };
      this.wobble = null;
      this.show(F.burst);
      this.training.chips(this, 46, 3.4);
      return;
    }
    this.wobble = { t: 0, dir: dir || 1 };
    this.training.chips(this, 6, 1.4);
  }

  step(dt) {
    if (this.broken) {
      const b = this.broken;
      b.t += dt;
      if (b.t < DUMMY.burst) return;
      this.show(F.broken);
      if (b.t < DUMMY.burst + DUMMY.rest) return;
      // whole again, in a puff of dust
      this.broken = null;
      this.hp = DUMMY.hp;
      this.show(F.whole);
      this.training.dust(this);
      return;
    }
    const w = this.wobble;
    if (!w) return;
    w.t += dt;
    const step = WOBBLE.find(([until]) => w.t < until);
    if (!step) { this.wobble = null; this.show(F.whole); return; }
    // (leaning away: its head the way the blow went; its drawing leans forward to the right)
    const away = w.dir > 0 ? F.forward : F.back;
    const toward = w.dir > 0 ? F.back : F.forward;
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
    // what's loosed here, set on the yard's floor (its particles likewise)
    this.group = new THREE.Group();
    this.group.position.y = YARD.y;
    this.group.userData.floor = true; // (not the world's: post.js)
    ctx.scene.add(this.group);
    const lifted = (p) => [p[0], p[1] + YARD.y, p[2]];
    const particles = {
      emit: (o) => ctx.particles.emit({ ...o, pos: lifted(o.pos), attract: o.attract && { ...o.attract, y: o.attract.y + YARD.y } }),
    };
    this.fxCtx = { scene: this.group, particles, add: (e) => this.fx.push(e) };
    this.dummies = null; // (made once their drawing has loaded: start)
  }

  // The dummies, once the effects' art has loaded (main.js).
  start() {
    if (this.dummies) return;
    this.dummies = [
      new Dummy(this, BOSS_DUMMY.x, YARD.cz + BOSS_DUMMY.z, true),
      ...DUMMY_SPOTS.map(([x, z]) => new Dummy(this, x, YARD.cz + z)),
    ];
  }

  // Whether n is on the yard (its floor, not the stair).
  has(n) {
    return !!n && !!this.ctx.world.yard?.inside(n.pos.x, n.pos.y);
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

  // The point of the dummy aimed at (`up` above its feet), where spells and ultimates fly (ults.js).
  bossPoint(up = 2) {
    const b = this.boss;
    return b ? [b.pos.x, b.lift + up, b.pos.y + 0.2] : [0, 0, 0];
  }

  // Thy blow lands (pilot.js → director.strikeFrom): the dummy in front of thee, if one stands there.
  strikeFrom(p) {
    const d = (this.dummies || []).find((x) => {
      if (!x.standing) return false;
      const ahead = (x.pos.x - p.pos.x) * p.body.facing;
      return ahead > -0.6 && ahead < DUMMY.reach + x.kind.radius && Math.abs(x.pos.y - p.pos.y) < x.kind.depth;
    });
    if (!d) return false;
    const dir = Math.sign(d.pos.x - p.pos.x) || p.body.facing;
    this.fx.push(new Spark(this.fxCtx, { color: styleOf(p).color, at: [p.pos.x + (d.pos.x - p.pos.x) * 0.6, 1.3, (p.pos.y + d.pos.y) / 2 + 0.3], dir, size: 1.7 }));
    this.hitStop(STOP.blow);
    p.body.stretch?.();
    this.ctx.rig?.punch?.(dir * 0.12);
    d.struck(DUMMY.blow, dir);
    return true;
  }

  // Thy spell (pilot.js), toward where thou pointest: it finds the dummy that way, if one stands
  // there, else flies on into nothing.
  playerCast(n, at) {
    const from = muzzleOf(n);
    let dir = [n.body.facing, 0];
    if (at) {
      const dx = at.x - from[0];
      const dz = at.z - from[2];
      const d = Math.hypot(dx, dz);
      if (d > 0.2) dir = [dx / d, dz / d];
    }
    const d = this.target(n, dir, RANGED.reach + 4, 0.8);
    const target = d ? () => [d.pos.x, 1.3, d.pos.y + 0.2] : null;
    castSpell(this.fxCtx, n, {
      target, dir,
      hit: () => {
        if (!d) return;
        this.hitStop(STOP.spell);
        d.struck(DUMMY.spell, Math.sign(d.pos.x - n.pos.x) || 1);
      },
    });
  }

  // R: thine ultimate (always full here), at the dummy in front of thee (an aimed one: the way
  // thou pointest, one of the four).
  playerUlt(at) {
    const { pilot, ults } = this.ctx;
    const n = pilot.npc;
    if (!n || pilot.dead || !this.has(n)) return false;
    if (n.travel || n.shift || (n.action && !['attack', 'cast', 'hurt', 'crouch', 'use', 'gesture'].includes(n.action.kind))) return false;
    let dir = null;
    let d = null;
    if (ults.of(n)?.aim) {
      const dx = (at ? at.x : n.pos.x + n.body.facing) - n.pos.x;
      const dz = (at ? at.z : n.pos.y) - n.pos.y;
      dir = Math.abs(dx) >= Math.abs(dz) ? [Math.sign(dx) || n.body.facing, 0] : [0, Math.sign(dz)];
      d = this.target(n, dir, REACH, 0.3);
    } else {
      const side = at ? [Math.sign(at.x - n.pos.x) || n.body.facing, 0] : [n.body.facing, 0];
      d = this.target(n, side, REACH, -0.2) || this.target(n, [-side[0], 0], REACH, -0.2);
    }
    if (!d) return false;
    this.boss = d;
    pilot.ult = 1;
    if (!ults.ready(n, true)) return false;
    return ults.start(n, { dir, player: true });
  }

  // An ultimate's blow lands on the dummy it was loosed at.
  ultHit(n, amount) {
    const b = this.boss;
    if (!b) return;
    b.struck(amount, Math.sign(b.pos.x - n.pos.x) || 1);
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
    // on the yard, thine ultimate is always full
    if (this.has(pilot.npc)) pilot.ult = 1;
    for (const d of this.dummies) {
      d.step(dt);
      // (a poison or a bleeding wobbles it as it ticks)
      stepStatus(d, this.clock, dt, { hit: (amount) => d.struck(amount, 1, false), shift: () => {}, particles: this.fxCtx.particles });
    }
    const fx = this.fx;
    this.fx = [];
    for (const e of fx) {
      if (e.step(dt)) this.fx.push(e);
      else e.dispose();
    }
  }
}
