// Great enemies, fought in the Arena of Trials north of Roundtable Hold (arena.js).
//
// One comes when summoned at the Round Table, invades by itself now and then, and answers a Claude
// Code session in trouble: tool calls failing one after another, a session ending in failure, or a
// single quest dragging on. The arena rises from the mist, and every Tarnished (all but the
// Twofold, who stand above such things) drops what it's doing and comes to fight; thou too, as
// whoever thou art. Thy blows and everyone's wear it down; a session that summoned it fells it at
// once by fulfilling its next quest. A Tarnished who falls is out of the fight for good: it goes by
// grace to the Hold and rests there until the fight is over. Fall thyself, and thou choosest one of
// the fighters still standing to carry on as; when nobody is left standing on the arena, the fight
// is lost. (The Bandit Knight, Elden Ring's Patches in all but name, never fights: he keeps as far
// from the enemy as he can.) Nothing here ever reaches Claude Code.
//
// The enemy is Fenrath, the Crimson Fang (heroes/boss.js). Every blow of his shows itself before
// it lands (bossfx.js): step out of its way, or dodge through it (Space).
//   swing – the greatsword raised and brought down: a crescent of red light flies on down his lane;
//   lunge – a thrust: a lance of light runs along the blade and far past its point;
//   slam  – a ring of light gathers round him for a moment, then fills: all inside it suffer;
//   leap  – beset (crowded, or battered) or rooted too long in one place, he crouches trembling,
//           marks where he'll come down, leaps, and lands in a crack of stone and flying debris.

import * as THREE from 'three';
import { ARENA, HUB, HUB_LAYOUT } from './config.js';
import { SpriteBody } from './npc.js';
import { ANIMS, makeLook, sheetForLook } from './sprites.js';
import { Crescent, Decal, Spike } from './bossfx.js';

// reach/radius: how far a blow may land from his middle (his long body runs from tail to snout);
// lane: how far out of his line (in depth) a swing or a lunge still catches someone
const BOSS = { hp: 3000, speed: 2.2, reach: 3.0, radius: 2.0, lane: 1.3 };
const DAMAGE = { player: 55, fighter: 12, quest: 0.5 }; // quest: the share of its health a fulfilled quest takes
const HURT = { swing: 22, lunge: 28, slam: 34, leap: 30 }; // to thee (of 100); fighters take as much
// Each move: its drawings and how long each is held (seconds; `true`: fixed, else it quickens
// when he's wounded); `danger`: the last step during which it can still be escaped.
const MOVES = {
  swing: { steps: [['swing-1', 0.6], ['swing-2', 0.25], ['swing-3', 0.6]], danger: 2 },
  lunge: { steps: [['lunge-1', 0.65], ['lunge-2', 0.35], ['lunge-3', 0.6]], danger: 1 },
  slam: { steps: [['slam-1', 1.2, true], ['slam-2', 0.45], ['slam-3', 0.7]], danger: 1 },
  leap: { steps: [['jump-1', 1, true], ['jump-2', 0.45, true], ['jump-3', 0.4, true], ['jump-4', 0.7]], danger: 3 },
};
const CRESCENT = { from: 1.2, y: 3, size: 6, speed: 15, life: 0.5, half: 1.6, lane: 1.6 }; // starts `from` ahead of him
const SPIKE = { from: 3.9, y: 3.2, len: 9, life: 0.75, slide: 2.2 }; // from the guard; he slides `slide` into it
const SLAM = { r: 5.5 };
const LEAP = { r: 3.2, height: 7, cooldown: 10 };
const TRIGGER = {
  failures: 3, failureWindow: 120, // tool failures in a row (seconds) that summon one
  longQuest: 600,                  // seconds a single quest may run before one comes
  invasion: [20 * 60, 40 * 60],    // seconds between invasions
  cooldown: 6 * 60,                // quiet time after a fight before anything (but a summons) brings another
  timeout: 8 * 60,                 // a fight left this long ends with the enemy withdrawing
};
const rand = (a, b) => a + Math.random() * (b - a);

// Whether a blow (its shape, where it lands) covers a point, with some slack: a disc, or a line
// running `dir`-ward from (x, z), `from`..`len` along it and `half` either side.
function covers(shape, x, z, opt, px, pz, slack = 0.3) {
  if (shape === 'line') {
    const along = (px - x) * opt.dir;
    return along >= opt.from - slack && along <= opt.len + slack && Math.abs(pz - z) <= opt.half + slack;
  }
  return Math.hypot(px - x, (pz - z) * 1.15) <= opt.r + slack;
}

// How close (px, pz) comes to the segment (ax, az)–(bx, bz).
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}

// On the arena or its bridge: anywhere north of the Hold's floor.
const north = (n) => n.pos.y < -HUB.walkRadius + 0.3;

// A decal's size for a mark of radius r (the textures leave a margin round their drawing).
const decalSize = (kind, r) => r * 2 * (kind === 'zone' ? 32 / 31 : 48 / 44);

// His shadow: far darker than anyone else's, nearly black at its heart.
let shadowTexture = null;
function shadowTex() {
  if (shadowTexture) return shadowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.97)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.9)');
  grad.addColorStop(0.82, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  shadowTexture = new THREE.CanvasTexture(c);
  return shadowTexture;
}

// The great enemy.
class Boss {
  constructor(ctx, x, z) {
    this.ctx = ctx;
    const sheet = ctx.bossSheet;
    this.standIn = !sheet; // a towering shade, should his art fail to load
    this.name = sheet ? `${sheet.rig.firstName}, ${sheet.rig.epithet}` : 'the Nameless Shade';
    this.body = new SpriteBody(ctx.scene, sheet || sheetForLook(makeLook('boss:shade', 'Shade', null)));
    if (this.standIn) {
      this.body.mesh.scale.setScalar(2.6);
      this.body.mat.color.setRGB(0.55, 0.36, 0.4);
    }
    this.body.mat.transparent = true;
    this.body.blob.material.map = shadowTex();
    this.body.blob.material.opacity = 1;
    this.pose('idle');
    this.pos = new THREE.Vector2(x, z);
    this.lift = 0;
    this.hp = BOSS.hp;
    this.max = BOSS.hp;
    this.fade = 0;
    this.state = 'enter'; // enter, ready, attack, staggered, dying, withdraw, gone
    this.t = 0;
    this.cd = 2.5; // until the next blow
    this.slamIn = rand(10, 14); // until he'd rather slam
    this.leapCd = LEAP.cooldown;
    this.idleT = 0; // since his last blow
    this.posture = 0;
    this.attack = null; // the move under way: { kind, step, t, dir, shape, x, z, opt, … }
    this.marks = []; // its marks on the floor (gone with it)
    this.hurtLog = []; // [time, amount]: what he's taken lately
    this.anchor = new THREE.Vector2(x, z); // where he's been standing, and for how long
    this.anchorT = 0;
  }

  get alive() { return this.state !== 'dying' && this.state !== 'withdraw' && this.state !== 'gone'; }

  // A drawing of his (or, for the stand-in, the nearest common pose).
  pose(name, restart = false) {
    if (this.standIn && !this.body.sheet.anims?.[name] && !ANIMS[name]) {
      name = { swing: 'hammer', lunge: 'hammer', slam: 'cast', jump: 'kneel' }[name.split('-')[0]] || 'idle';
    }
    this.body.play(name, restart);
  }

  damage(n) {
    if (!this.alive || this.state === 'enter') return 0;
    const dealt = Math.min(this.hp, n * (this.state === 'staggered' ? 1.5 : 1));
    this.hp -= dealt;
    this.posture += dealt;
    this.hurtLog.push([performance.now() / 1000, dealt]);
    const airborne = this.attack?.kind === 'leap' && this.attack.step >= 1 && this.attack.step <= 2;
    if (this.hp <= 0) {
      this.state = 'dying';
      this.t = 0;
      this.endMove();
      this.pose('collapse', true);
    } else if (this.posture > 420 && this.state !== 'staggered' && !airborne) {
      // his stance breaks: he reels, and takes more from every blow for a moment
      this.state = 'staggered';
      this.t = 0;
      this.posture = 0;
      this.lift = 0;
      this.endMove();
      this.pose('stagger', true);
    }
    return dealt;
  }

  // What he's taken in the last `secs` seconds.
  taken(secs) {
    const now = performance.now() / 1000;
    this.hurtLog = this.hurtLog.filter(([t]) => now - t < 10);
    return this.hurtLog.reduce((s, [t, n]) => s + (now - t < secs ? n : 0), 0);
  }

  endMove() {
    for (const m of this.marks) m.dispose();
    this.marks = [];
    this.attack = null;
  }

  dispose() {
    this.endMove();
    this.body.dispose();
  }
}

export class Fight {
  constructor(ctx) {
    this.ctx = ctx;
    this.state = 'idle'; // idle, rising, gathering, fighting, won, ending
    this.boss = null;
    this.fx = []; // his magic, living on by itself: flying crescents, lances, fading light, cracks
    this.cause = null;
    this.quietUntil = 0;
    this.trigger = { ...TRIGGER }; // (the public demo quickens it: pace())
    this.nextInvasion = rand(...this.trigger.invasion);
    this.failures = new Map(); // sid -> recent failure times
    this.longDone = new Set(); // quests (sid:start) that already brought one
    this.t = 0;
    this.clock = 0;
    this.lagHp = 0;
    this.ui = {
      boss: document.getElementById('boss'),
      bossName: document.querySelector('#boss h4'),
      bossHp: document.querySelector('#boss .hp'),
      bossLag: document.querySelector('#boss .lag'),
      bossDmg: document.querySelector('#boss .dmg'),
      hp: document.getElementById('hp'),
      hpBar: document.querySelector('#hp i'),
      hurt: document.getElementById('hurt'),
      carry: document.getElementById('carry'),
      carryList: document.querySelector('#carry .list'),
    };
    this.dmgShown = 0;
    this.dmgUntil = 0;
    this.fallen = 0; // Tarnished fallen (for good) in this fight
  }

  get active() { return this.state !== 'idle'; }

  // A livelier pace for the public demo: invasions sooner and more often, shorter rests between.
  pace({ first, invasion, cooldown }) {
    Object.assign(this.trigger, { invasion, cooldown });
    this.nextInvasion = this.clock + first;
  }

  // Why one can't be summoned now (or true).
  canSummon() {
    if (this.state === 'ending') return 'The arena is still settling';
    if (this.active) return 'A great enemy is already abroad';
    return true;
  }

  // ------------------------------------------------------------------------------------------
  // what brings one

  start(cause) {
    if (this.active) return false;
    const { ui, world } = this.ctx;
    this.cause = cause;
    this.fallen = 0;
    this.cowardsAlone = null;
    this.state = 'rising';
    this.t = 0;
    world.arena.raise();
    const why = {
      summon: 'Summoned at the Round Table',
      invasion: 'It came of its own accord',
      errors: cause.npc ? `Drawn by ${cause.npc.name.first}'s failing rites` : 'Drawn by failing rites',
      failure: cause.npc ? `Drawn by ${cause.npc.name.first}'s fall` : 'Drawn by a fall',
      long: cause.npc ? `Drawn by ${cause.npc.name.first}'s endless quest` : 'Drawn by an endless quest',
    }[cause.kind] || '';
    ui.banner('A Great Enemy Approaches', why, 'red');
    ui.log('The Arena of Trials rises north of Roundtable Hold', 'red', { region: world.arena });
    return true;
  }

  // From the director: a tool call failed.
  noteFailure(npc) {
    const now = this.clock;
    const list = (this.failures.get(npc.sid) || []).filter((t) => now - t < this.trigger.failureWindow);
    list.push(now);
    this.failures.set(npc.sid, list);
    if (list.length >= this.trigger.failures && this.auto()) {
      this.failures.delete(npc.sid);
      this.start({ kind: 'errors', npc, sid: npc.sid });
    }
  }

  noteFall(npc) {
    if (this.auto()) this.start({ kind: 'failure', npc, sid: npc.sid });
  }

  // From the director: a quest was fulfilled. If it's the session that brought the enemy, it reels.
  noteDone(npc) {
    const b = this.boss;
    if (!b || !b.alive || this.cause?.sid !== npc.sid) return;
    b.damage(b.max * DAMAGE.quest);
    this.ctx.ui.log(`${npc.name.first} fulfils the quest: the great enemy reels`, 'gold', npc);
  }

  auto() {
    return !this.active && this.clock >= this.quietUntil;
  }

  watchQuests() {
    const d = this.ctx.director;
    const now = performance.now() / 1000;
    for (const [sid, start] of d.questStart) {
      const key = `${sid}:${start}`;
      if (now - start < this.trigger.longQuest || this.longDone.has(key)) continue;
      this.longDone.add(key);
      const npc = d.npcs.get(sid);
      if (npc && this.auto()) this.start({ kind: 'long', npc, sid });
    }
  }

  // ------------------------------------------------------------------------------------------
  // everyone to the arena, and home again

  // Every Tarnished but the Twofold (and whoever thou art) drops what it's doing and comes.
  gather() {
    const { director, world } = this.ctx;
    const [ax, az] = world.arena.point('grace');
    let k = 0;
    for (const n of director.npcs.values()) {
      if (n.dead || n.piloted || n.forms || n.intent.kind === 'leave') continue;
      n.resume = n.intent.kind === 'fight' ? n.resume : n.intent;
      if (n.slot) n.releaseSlot();
      n.slot = null;
      n.path = [];
      n.goal = null;
      n.talk = null;
      n.inTalk = false;
      if (n.action?.kind !== 'transform') n.action = null;
      n.intent = { kind: 'fight' };
      n.fighter = {
        hp: 100, down: 0, cd: rand(1.5, 4), angle: (k * 2.4) % (Math.PI * 2),
        ring: 4.6 + (k % 3) * 0.8, dir: k % 2 ? 1 : -1, mode: 'circle', modeT: 0, vx: 0, vz: 0, speed: 0,
        coward: n.hero?.hero === 'bandit', // the Bandit Knight (Patches, really) never fights: he keeps his distance, and whines
      };
      k += 1;
      if (n.travel) continue;
      n.fastTravel(ax, az);
      if (Math.random() < 0.4) director.remark(n, 'battle', null, 1.6 + Math.random());
    }
  }

  // The fight is over: back to their own lives (as when the player lets go of someone).
  release() {
    for (const n of this.ctx.director.npcs.values()) {
      if (!n.fighter) continue;
      n.fighter = null;
      if (n.piloted) continue; // thou art them now: their life waits for thee to let go
      let want = n.resume && n.resume.kind !== 'fight' ? n.resume : { kind: 'wander' };
      n.resume = null;
      if (want.kind === 'gather') want = n.unbound ? { kind: 'journey', dest: 'hub' } : { kind: 'journey' };
      if (n.action?.kind === 'gesture' && n.action.anim === 'collapse') n.action = null;
      n.intent = { kind: 'none' };
      n.setIntent(want);
      this.leaveArena(n);
    }
  }

  // Off the arena by grace, toward wherever they're bound (or their home).
  leaveArena(n) {
    if (!north(n) || n.travel || n.piloted) return;
    const [x, z] = n.goal || [n.region.cx, n.region.cz ?? 0];
    n.fastTravel(x, z);
  }

  // Anyone (thee included) still on the arena or its bridge.
  occupied() {
    const me = this.ctx.pilot.npc;
    if (me && north(me)) return true;
    for (const n of this.ctx.director.npcs.values()) if (!n.dead && north(n)) return true;
    return false;
  }

  // ------------------------------------------------------------------------------------------
  // blows

  // Thy blow lands (pilot.js → director.strikeFrom): the enemy, if it stands in front of thee.
  strikeFrom(p) {
    const b = this.boss;
    if (!b || !b.alive || b.lift > 2) return false;
    const ahead = (b.pos.x - p.pos.x) * p.body.facing;
    if (ahead < -0.6 || ahead > BOSS.reach + BOSS.radius || Math.abs(b.pos.y - p.pos.y) > 1.9) return false;
    this.hit(b, DAMAGE.player);
    return true;
  }

  hit(b, n) {
    const dealt = b.damage(n);
    if (!dealt) return;
    this.dmgShown = this.clock < this.dmgUntil ? this.dmgShown + Math.round(dealt) : Math.round(dealt);
    this.dmgUntil = this.clock + 1.6;
    this.ctx.particles.emit({
      pos: [b.pos.x, 2.2, b.pos.y], spread: [0.5, 0.8, 0.3], vel: [0, 1.4, 0], velSpread: [1.4, 1, 0.8],
      color: ['#ff6a4a', '#ffd2a8', '#a01818'], size: 0.07, life: 0.6, count: 10, drag: 1.2, intensity: 2.2,
    });
  }

  // A blow lands on thee.
  hurtPlayer(dmg) {
    const pilot = this.ctx.pilot;
    const n = pilot.npc;
    if (!n || pilot.dead || n.travel || n.action?.kind === 'dodge') return; // nothing touches thee mid-dodge, or travelling by grace
    pilot.hp = Math.max(0, pilot.hp - dmg);
    this.ui.hurt.classList.remove('flash');
    void this.ui.hurt.offsetWidth;
    this.ui.hurt.classList.add('flash');
    if (pilot.hp <= 0) {
      pilot.dead = true;
      n.action = { kind: 'gesture', anim: 'collapse', t: 0, dur: Infinity };
      n.body.play('collapse', true);
      this.ctx.ui.banner('You Died', '', 'red');
      this.reviveAt = this.clock + 3.2;
      // fallen mid-fight: out of it for good, but another may carry on (offerCarry)
      if (this.state === 'gathering' || this.state === 'fighting') {
        this.fallen += 1;
        this.carry = { since: this.clock };
      }
    } else if (n.action?.kind !== 'attack') {
      n.action = { kind: 'hurt', anim: 'stagger', t: 0, dur: 0.45 };
      n.body.play('stagger', true);
    }
  }

  hurtFighter(n, dmg) {
    const f = n.fighter;
    if (!f || f.dead || n.travel) return;
    f.hp -= dmg;
    if (f.hp <= 0) {
      // fallen for good: a moment where they fell, then by grace to the Hold, out of this fight
      f.dead = true;
      f.down = 3;
      this.fallen += 1;
      n.collapse(3);
      this.ctx.ui.log(`${n.name.first} has fallen`, 'red', n);
    } else {
      n.stagger();
    }
  }

  // Everyone a blow covers (inside(x, z)): thee, and the fighters. `seen`: those it already struck
  // (a crescent strikes each only once on its way).
  strike(inside, dmg, seen = null) {
    const { pilot, director } = this.ctx;
    const take = (n) => {
      if (seen?.has(n) || !inside(n.pos.x, n.pos.y)) return false;
      seen?.add(n);
      return true;
    };
    const me = pilot.npc;
    if (me && !pilot.dead && this.inArena(me) && take(me)) this.hurtPlayer(dmg);
    for (const n of director.npcs.values()) if (n.fighter && !n.piloted && take(n)) this.hurtFighter(n, dmg);
  }

  inArena(n) {
    return this.ctx.world.areaAt(n.pos.x, n.pos.y) === this.ctx.world.arena;
  }

  // Thou art on the arena while he's abroad there: every click is a blow, and nobody can be
  // picked, inspected or carried off (input.js).
  inBattle() {
    const me = this.ctx.pilot.npc;
    return !!me && (this.state === 'gathering' || this.state === 'fighting') && north(me);
  }

  // Where the camera should look while thou fightest him on the arena (main.js), or null:
  // between thee and him, and high enough to keep him whole.
  aim(me) {
    const b = this.boss;
    if (!b || !b.alive || this.state !== 'fighting' || !this.inArena(me)) return null;
    return [me.pos.x + (b.pos.x - me.pos.x) * 0.45, 2.6, me.pos.y + (b.pos.y - me.pos.y) * 0.45];
  }

  // Everyone on the arena he could strike: thee (`me`), and the fighters still standing.
  foes() {
    const me = this.ctx.pilot.npc;
    const list = [];
    if (me && !this.ctx.pilot.dead && !me.travel && this.inArena(me)) list.push(me);
    for (const n of this.ctx.director.npcs.values()) {
      if (n.fighter && !n.piloted && !n.fighter.dead && !n.travel && this.inArena(n)) list.push(n);
    }
    return list;
  }

  foesWithin(b, r) {
    return this.foes().filter((n) => Math.hypot(n.pos.x - b.pos.x, (n.pos.y - b.pos.y) * 1.15) < r).length;
  }

  // The nearest foe (thee a little more than the others).
  target(b) {
    const me = this.ctx.pilot.npc;
    let best = null;
    let bd = Infinity;
    for (const n of this.foes()) {
      const d = Math.hypot(n.pos.x - b.pos.x, n.pos.y - b.pos.y) * (n === me ? 0.6 : 1);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  // ------------------------------------------------------------------------------------------
  // the enemy's mind

  stepBoss(b, dt, t) {
    b.t += dt;
    b.posture = Math.max(0, b.posture - dt * 40);
    const fast = b.hp < b.max / 2 ? 1.25 : 1; // wounded, he grows wild
    let moving = false;
    let jitter = 0;
    switch (b.state) {
      case 'enter':
        b.fade = Math.min(1, b.t / 2);
        if (b.t >= 2.2) { b.state = 'ready'; b.t = 0; }
        break;
      case 'staggered':
        if (b.t >= 2.2) { b.state = 'ready'; b.t = 0; b.pose('idle'); }
        break;
      case 'withdraw':
        // unbeaten, he fades into a red mist
        b.fade = Math.max(0, 1 - b.t / 2.5);
        if (Math.random() < dt * 24) {
          this.ctx.particles.emit({
            pos: [b.pos.x, 1 + Math.random() * 4, b.pos.y], spread: [1.8, 1, 0.4], vel: [0, 0.8, 0], velSpread: [0.8, 0.5, 0.4],
            color: ['#6a1414', '#2a0a0a', '#c0281e'], size: 0.12, life: 1.8, count: 6, drag: 0.6, intensity: 1.2,
          });
        }
        if (b.t >= 2.7) b.state = 'gone';
        break;
      case 'dying':
        b.fade = Math.max(0, 1 - b.t / 3);
        b.lift = Math.max(0, b.lift - dt * 14);
        if (Math.random() < dt * 20) {
          this.ctx.particles.emit({
            pos: [b.pos.x, 1.5 + Math.random() * 3, b.pos.y], spread: [1.6, 1, 0.4], vel: [0, 1.2, 0], velSpread: [0.6, 0.6, 0.4],
            color: ['#ffd27a', '#2a1a1a', '#fff1c0'], size: 0.09, life: 1.6, count: 6, drag: 0.6, intensity: 1.8,
          });
        }
        if (b.t >= 3.2) b.state = 'gone';
        break;
      case 'attack':
        jitter = this.stepMove(b, dt, t, fast);
        break;
      case 'ready':
        moving = this.think(b, dt, fast);
        break;
      default:
        break;
    }
    // where he's been standing: rooted too long and he'll want to leap elsewhere
    if (b.pos.distanceTo(b.anchor) > 3) { b.anchor.copy(b.pos); b.anchorT = 0; } else b.anchorT += dt;
    b.body.tick(dt, moving ? 0.8 * fast : 0.7);
    b.body.place(b.pos.x + jitter, 0, b.pos.y, b.lift);
    // his shadow: wide and deep (he's long, and heavy), a little smaller the higher he leaps
    const s = 1 - Math.min(0.3, b.lift * 0.045);
    b.body.blob.position.x = b.pos.x;
    b.body.blob.scale.set(3.6 * s, 2.6 * s, 1);
    b.body.blob.material.opacity = b.fade;
    b.body.mat.opacity = b.fade;
    b.body.mat.depthWrite = b.fade > 0.99;
  }

  // Ready: pick a foe, come into its lane a sword's length off, and choose a blow.
  think(b, dt, fast) {
    b.cd -= dt * fast;
    b.slamIn -= dt * fast;
    b.leapCd -= dt;
    b.idleT += dt;
    const tgt = this.target(b);
    if (!tgt) { b.pose('idle'); return false; }
    const dx = tgt.pos.x - b.pos.x;
    const dz = tgt.pos.y - b.pos.y;
    if (Math.abs(dx) > 0.4) b.body.facing = dx > 0 ? 1 : -1;
    const close = this.foesWithin(b, 4.2);
    // beset (crowded, or battered) or rooted: he leaps elsewhere
    const beset = close >= 3 || b.taken(5) > 250;
    if (b.leapCd <= 0 && b.cd <= 0.6 && (beset || b.anchorT > 12)) {
      this.begin(b, 'leap', beset);
      return false;
    }
    if (b.cd <= 0) {
      const ax = Math.abs(dx);
      const inLane = Math.abs(dz) < BOSS.lane;
      let move = null;
      if ((b.slamIn <= 0 || close >= 3) && this.foesWithin(b, SLAM.r) >= 1) move = 'slam';
      else if (inLane && ax < 5.5) move = Math.random() < (ax < 3.5 ? 0.7 : 0.35) ? 'swing' : 'lunge';
      else if (inLane && ax < 12) move = 'lunge';
      else if (b.idleT > 5 && this.foesWithin(b, SLAM.r) >= 1) move = 'slam';
      else if (b.idleT > 7 && b.leapCd <= 0) { this.begin(b, 'leap', false); return false; }
      if (move) {
        if (move === 'slam') b.slamIn = rand(11, 16);
        this.begin(b, move);
        return false;
      }
    }
    // into its lane, a sword's length to the side he's on (backing off if it's too close)
    const side = Math.sign(dx) || b.body.facing;
    const gx = tgt.pos.x - side * 4;
    const gz = tgt.pos.y;
    const d = Math.hypot(gx - b.pos.x, gz - b.pos.y);
    if (d < 0.3) { b.pose('idle'); return false; }
    const step = Math.min(d, BOSS.speed * fast * dt);
    this.shift(b, ((gx - b.pos.x) / d) * step, ((gz - b.pos.y) / d) * step);
    b.pose('walk');
    return true;
  }

  // Moves him, keeping him on the arena floor.
  shift(b, dx, dz) {
    const { cx, cz } = this.ctx.world.arena;
    let nx = b.pos.x + dx;
    let nz = b.pos.y + dz;
    const off = Math.hypot(nx - cx, nz - cz);
    const lim = ARENA.walkRadius - 2;
    if (off > lim) { nx = cx + ((nx - cx) / off) * lim; nz = cz + ((nz - cz) / off) * lim; }
    b.pos.set(nx, nz);
  }

  // A move begins: what it covers is known from the start (the fighters see it coming).
  begin(b, kind, beset = false) {
    const dir = b.body.facing;
    const a = { kind, step: -1, t: 0, dir, x: b.pos.x, z: b.pos.y, shape: 'disc', opt: { r: SLAM.r } };
    if (kind === 'swing') {
      a.shape = 'line';
      a.opt = { dir, from: -0.5, len: CRESCENT.from + CRESCENT.speed * CRESCENT.life + CRESCENT.half, half: CRESCENT.lane };
    } else if (kind === 'lunge') {
      a.shape = 'line';
      a.opt = { dir, from: -0.5, len: SPIKE.slide + SPIKE.from + SPIKE.len, half: BOSS.lane };
    } else if (kind === 'leap') {
      [a.x, a.z] = this.landing(b, beset);
      a.from = b.pos.clone();
      a.opt = { r: LEAP.r };
      if (Math.abs(a.x - b.pos.x) > 0.4) b.body.facing = a.x > b.pos.x ? 1 : -1;
      b.leapCd = LEAP.cooldown;
    }
    b.attack = a;
    b.state = 'attack';
    b.idleT = 0;
    this.nextStep(b);
  }

  // Where to leap: beset, away from the crowd; rooted, onto someone's doorstep (they'll have to
  // step aside); never just beside where he stands.
  landing(b, beset) {
    const { cx, cz } = this.ctx.world.arena;
    const foes = this.foes();
    let best = null;
    let bs = -Infinity;
    for (let i = 0; i < 24; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (ARENA.walkRadius - 2.5);
      const x = cx + Math.cos(ang) * r;
      const z = cz + Math.sin(ang) * r;
      const far = Math.hypot(x - b.pos.x, z - b.pos.y);
      if (far < 5) continue;
      const room = Math.min(6, ...foes.map((n) => Math.hypot(n.pos.x - x, n.pos.y - z)));
      const s = (beset ? room : -Math.abs(room - 1.5)) + Math.min(far, 10) * 0.2 + Math.random();
      if (s > bs) { bs = s; best = [x, z]; }
    }
    return best || [cx, cz];
  }

  // The move goes on: its marks pulse, he trembles, flies; at the end of each step, the next.
  stepMove(b, dt, t, fast) {
    const a = b.attack;
    const [, dur, fixed] = MOVES[a.kind].steps[a.step];
    a.t += dt;
    const k = Math.min(1, a.t / (fixed ? dur : dur / fast));
    let jitter = 0;
    if (a.kind === 'slam' && a.step === 0) {
      b.marks[0].opacity = (0.35 + 0.65 * k) * (0.8 + 0.2 * Math.sin(t * 30));
    } else if (a.kind === 'lunge' && a.step === 1) {
      if (a.slide > 0) {
        const s = Math.min(a.slide, dt * 16);
        a.slide -= s;
        this.shift(b, a.dir * s, 0);
      }
      a.spike.mesh.position.x = b.pos.x + a.dir * SPIKE.from; // the lance goes with the blade
    } else if (a.kind === 'leap') {
      if (a.step === 0) {
        // gathering himself: he trembles, side to side, and the ground stirs at his feet
        jitter = (Math.floor(a.t * 28) % 2 ? 1 : -1) * 0.09;
        if (Math.random() < dt * 14) {
          this.ctx.particles.emit({
            pos: [b.pos.x, 0.15, b.pos.y], spread: [2, 0.05, 0.6], vel: [0, 0.8, 0], velSpread: [0.8, 0.5, 0.4],
            color: ['#5a4a3e', '#3a2e28'], size: 0.1, life: 0.6, count: 3, drag: 1.5, intensity: 0.8,
          });
        }
      } else if (a.step === 1 || a.step === 2) {
        // up, and down onto the mark: his shadow runs along the ground beneath him
        const up = a.step === 1;
        b.lift = LEAP.height * (up ? 1 - (1 - k) ** 2 : 1 - k * k);
        const f = up ? 0.5 * k : 0.5 + 0.5 * k;
        b.pos.set(a.from.x + (a.x - a.from.x) * f, a.from.y + (a.z - a.from.y) * f);
      }
      if (b.marks[0] && a.step <= 2) b.marks[0].opacity = 0.7 + 0.3 * Math.sin(t * 18);
    }
    if (k >= 1) this.nextStep(b);
    return jitter;
  }

  // On to the move's next drawing, and what happens as it's struck.
  nextStep(b) {
    const a = b.attack;
    const { scene, particles, rig } = this.ctx;
    a.step += 1;
    a.t = 0;
    const steps = MOVES[a.kind].steps;
    if (a.step >= steps.length) {
      b.endMove();
      b.state = 'ready';
      b.cd = rand(0.9, 1.9);
      b.pose('idle');
      return;
    }
    b.pose(steps[a.step][0], true);
    const [x, z] = [b.pos.x, b.pos.y];
    const dir = a.dir;
    switch (`${a.kind}:${a.step}`) {
      case 'swing:1': {
        // the cut, and the crescent it throws: on down his lane, striking each it passes once
        const c = new Crescent(scene, x + dir * CRESCENT.from, CRESCENT.y, z + 0.12, dir, CRESCENT);
        this.strike((px, pz) => covers('line', x, z, { dir, from: -0.5, len: CRESCENT.from, half: CRESCENT.lane }, px, pz, 0), HURT.swing, c.hit);
        this.fx.push({
          step: (dt) => {
            const on = c.step(dt);
            this.strike((px, pz) => Math.abs(px - c.x) <= CRESCENT.half && Math.abs(pz - c.z) <= CRESCENT.lane, HURT.swing, c.hit);
            return on;
          },
          dispose: () => c.dispose(),
        });
        particles.emit({
          pos: [x + dir * 3, 1.2, z], spread: [1.2, 1, 0.3], vel: [dir * 4, 0.5, 0], velSpread: [2, 1.5, 0.6],
          color: ['#ff5a3a', '#ffd2a8', '#a01818'], size: 0.08, life: 0.5, count: 18, drag: 2, intensity: 2.2,
        });
        break;
      }
      case 'lunge:1': {
        // the thrust: he drives forward, and a lance of light runs along the blade and past it
        a.slide = SPIKE.slide;
        const s = new Spike(scene, x + dir * SPIKE.from, SPIKE.y, z, dir, SPIKE.len);
        a.spike = s;
        this.fx.push({ step: (dt) => s.step(dt, SPIKE.life), dispose: () => s.dispose() });
        this.strike((px, pz) => covers('line', x, z, a.opt, px, pz, 0), HURT.lunge);
        break;
      }
      case 'slam:0':
        b.marks.push(new Decal(scene, 'ring', x, z, decalSize('ring', SLAM.r), { opacity: 0.35 }));
        break;
      case 'slam:1': {
        // the blade into the ground: the ring fills with light, and all inside it suffer
        for (const m of b.marks) m.dispose();
        b.marks = [];
        const fill = new Decal(scene, 'fill', x, z, decalSize('fill', SLAM.r));
        let life = 0;
        this.fx.push({
          step: (dt) => { life += dt; fill.opacity = Math.max(0, 1 - life / 0.7); return life < 0.7; },
          dispose: () => fill.dispose(),
        });
        this.strike((px, pz) => covers('disc', x, z, { r: SLAM.r }, px, pz, 0), HURT.slam);
        particles.emit({
          pos: [x, 0.3, z], spread: [SLAM.r * 0.7, 0.2, SLAM.r * 0.55], vel: [0, 2.4, 0], velSpread: [1, 1.4, 1],
          color: ['#ff5a3a', '#ffd2a8', '#a01818'], size: 0.1, life: 0.8, count: 60, drag: 1.4, intensity: 2,
        });
        rig.shake?.(0.25);
        break;
      }
      case 'leap:0':
        b.marks.push(new Decal(scene, 'zone', a.x, a.z, decalSize('zone', LEAP.r)));
        break;
      case 'leap:1':
        particles.emit({
          pos: [x, 0.2, z], spread: [1.6, 0.1, 0.6], vel: [0, 2, 0], velSpread: [2, 1, 1],
          color: ['#6a5a4e', '#3a2e28'], size: 0.12, life: 0.7, count: 24, drag: 1.4, intensity: 0.9,
        });
        break;
      case 'leap:3': {
        // he lands: the stone cracks, debris flies, the ground shakes, and all on the mark suffer
        b.lift = 0;
        b.pos.set(a.x, a.z);
        for (const m of b.marks) m.dispose();
        b.marks = [];
        const crack = new Decal(scene, 'crack', a.x, a.z, LEAP.r * 2.6, { glow: false });
        let life = 0;
        this.fx.push({
          step: (dt) => { life += dt; crack.opacity = Math.min(1, Math.max(0, (7 - life) / 2)); return life < 7; },
          dispose: () => crack.dispose(),
        });
        this.strike((px, pz) => covers('disc', a.x, a.z, a.opt, px, pz, 0), HURT.leap);
        particles.emit({
          pos: [a.x, 0.3, a.z], spread: [LEAP.r * 0.5, 0.2, LEAP.r * 0.4], vel: [0, 6.5, 0], velSpread: [6, 3, 4],
          color: ['#7a6a5c', '#4a3e36', '#9a8a78', '#2a221e'], size: 0.2, life: 1.2, count: 46, gravity: 16, drag: 0.4, intensity: 0.9,
        });
        particles.emit({
          pos: [a.x, 0.4, a.z], spread: [LEAP.r * 0.6, 0.3, LEAP.r * 0.5], vel: [0, 2.5, 0], velSpread: [2.5, 1.5, 1.5],
          color: ['#ff5a3a', '#ffd2a8', '#a01818'], size: 0.08, life: 0.8, count: 30, drag: 1.2, intensity: 2.2,
        });
        particles.emit({
          pos: [a.x, 0.5, a.z], spread: [LEAP.r * 0.8, 0.3, LEAP.r * 0.6], vel: [0, 0.8, 0], velSpread: [2, 0.6, 1.4],
          color: ['#5a4a3e', '#3a2e28'], size: 0.16, life: 1.4, count: 30, drag: 1.6, intensity: 0.7,
        });
        rig.shake?.(0.4);
        break;
      }
      default:
        break;
    }
  }

  // ------------------------------------------------------------------------------------------
  // the fighters' minds (from Npc.pursue while their intent is 'fight')

  // They keep their own ring round the enemy, each going its own way round it; when ready one
  // rushes in, strikes and falls back. A blow marked on the ground is seen (after a moment) and
  // mostly escaped at a sprint; now and then someone is too slow. They move with momentum, keep
  // clear of one another and of the enemy's bulk, and face it as they go.
  driveFighter(n, dt) {
    const f = n.fighter;
    const b = this.boss;
    const { world } = this.ctx;
    if (!f) return false;
    if (f.dead) {
      // fallen: they lie a moment, then go by grace to the Hold and rest there till the fight is over
      if (f.down > 0) n.body.play('collapse');
      else if (north(n)) { if (!n.travel) n.fastTravel(...HUB_LAYOUT.grace); }
      else if (!n.travel) n.body.play('sit');
      return false;
    }
    if (!this.inArena(n)) {
      // arrived somewhere else (the arena was still rising): come by grace
      if (world.arena.risen && !n.travel) n.fastTravel(world.arena.cx, world.arena.cz);
      return false;
    }
    const live = b && b.alive && b.state !== 'enter';
    let goal;
    let speed = 3.4;
    let faceBoss = live;
    if (live) {
      const toX = n.pos.x - b.pos.x;
      const toZ = n.pos.y - b.pos.y;
      const dist = Math.hypot(toX, toZ) || 1;
      const a = b.state === 'attack' && b.attack.step <= MOVES[b.attack.kind].danger ? b.attack : null;
      if (a && a !== f.seen) {
        f.seen = a;
        f.react = rand(0.1, 0.4);
        f.willDodge = f.coward || Math.random() < 0.8; // the coward dodges everything
      }
      const danger = a && f.willDodge && covers(a.shape, a.x, a.z, a.opt, n.pos.x, n.pos.y, 0.8);
      if (danger) f.react -= dt;
      if (danger && f.react <= 0) {
        goal = this.escape(a, n);
        speed = 6.4;
        faceBoss = false;
        f.mode = 'circle';
      } else if (f.coward) {
        // the Bandit Knight: never a blow, only as far from the enemy as the arena allows (and some whining)
        goal = this.hideFrom(b, n, f, dt);
        speed = dist < 7 ? 5.6 : 3.6;
        faceBoss = dist > 8;
        f.whine = (f.whine ?? rand(2, 5)) - dt;
        if (dist < 6 && f.whine <= 0) {
          f.whine = rand(7, 12);
          this.ctx.director.remark(n, 'flee');
        }
      } else {
        f.cd -= dt;
        if (f.mode === 'circle' && f.cd <= 0 && !a) f.mode = 'engage';
        if (f.mode === 'engage') {
          const r = BOSS.radius + 1.4;
          goal = [b.pos.x + (toX / dist) * r, b.pos.y + (toZ / dist) * r * 0.8];
          speed = 4.8;
          if (dist < BOSS.reach + BOSS.radius + 0.2 && b.lift < 1) {
            const def = n.body.sheet.anims.hammer;
            n.action = { kind: 'fightAttack', anim: 'hammer', t: 0, dur: def.frames.length / def.fps, hitAt: (n.body.sheet.hits?.hammer ?? 2) / def.fps, hit: false };
            n.body.facing = b.pos.x > n.pos.x ? 1 : -1;
            n.body.play('hammer', true);
            f.mode = 'retreat';
            f.modeT = 0;
            f.cd = rand(2, 4.5);
            f.vx = 0;
            f.vz = 0;
            return false;
          }
        } else if (f.mode === 'retreat') {
          f.modeT += dt;
          goal = [b.pos.x + (toX / dist) * (f.ring + 0.6), b.pos.y + (toZ / dist) * (f.ring + 0.6) * 0.75];
          speed = 4.4;
          if (f.modeT > 1.2) f.mode = 'circle';
        } else {
          f.angle += dt * 0.35 * f.dir;
          goal = [b.pos.x + Math.cos(f.angle) * f.ring, b.pos.y + Math.sin(f.angle) * f.ring * 0.7];
        }
      }
    } else {
      // waiting for the enemy (or done with it): a loose crowd by the entrance
      const [ax, az] = world.arena.point('grace');
      goal = [ax + Math.cos(f.angle) * 3.5, az - 1.5 + Math.sin(f.angle) * 1.2];
      speed = 3;
    }
    // steer for the goal (easing in as it's reached), away from the others and the enemy's bulk
    const dx = goal[0] - n.pos.x;
    const dz = goal[1] - n.pos.y;
    const d = Math.hypot(dx, dz);
    let wx = 0;
    let wz = 0;
    if (d > 0.15) {
      const v = speed * Math.min(1, d / 0.8);
      wx = (dx / d) * v;
      wz = (dz / d) * v;
    }
    const me = this.ctx.pilot.npc;
    for (const o of this.ctx.director.npcs.values()) {
      if (o === n || (!o.fighter && o !== me) || o.fighter?.dead) continue;
      const ox = n.pos.x - o.pos.x;
      const oz = n.pos.y - o.pos.y;
      const od = Math.hypot(ox, oz);
      if (od > 0.01 && od < 1.4) { wx += (ox / od) * (1.4 - od) * 4; wz += (oz / od) * (1.4 - od) * 4; }
    }
    if (live) {
      const bx = n.pos.x - b.pos.x;
      const bz = n.pos.y - b.pos.y;
      const bd = Math.hypot(bx, bz);
      if (b.lift < 2 && bd > 0.01 && bd < BOSS.radius + 0.7) { wx += (bx / bd) * 6; wz += (bz / bd) * 6; }
    }
    const k = Math.min(1, dt * 7);
    f.vx += (wx - f.vx) * k;
    f.vz += (wz - f.vz) * k;
    const v = Math.hypot(f.vx, f.vz);
    let moving = false;
    if (v > 0.25) {
      const nx = n.pos.x + f.vx * dt;
      const nz = n.pos.y + f.vz * dt;
      const ok = (x, z) => world.isWalkArea(x, z) && !world.isBlocked(x, z, 0.2);
      if (ok(nx, nz)) n.pos.set(nx, nz);
      else if (ok(nx, n.pos.y)) n.pos.x = nx;
      else if (ok(n.pos.x, nz)) n.pos.y = nz;
      else { f.vx *= -0.3; f.vz *= -0.3; }
      moving = true;
    }
    f.speed = v;
    if (faceBoss) { if (Math.abs(b.pos.x - n.pos.x) > 0.3) n.body.facing = b.pos.x > n.pos.x ? 1 : -1; }
    else if (Math.abs(f.vx) > 0.3) n.body.facing = f.vx > 0 ? 1 : -1;
    n.body.play(moving ? 'walk' : 'idle');
    return moving;
  }

  // Where the Bandit Knight runs to: the spot by the arena's edge farthest from the enemy that he can reach
  // without brushing past him (and not too far off), chosen afresh twice a second.
  hideFrom(b, n, f, dt) {
    f.hideT = (f.hideT || 0) - dt;
    if (f.hide && f.hideT > 0) return f.hide;
    f.hideT = 0.5;
    const { cx, cz } = this.ctx.world.arena;
    const R = ARENA.walkRadius - 1.4;
    let best = null;
    let bs = -Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = cx + Math.cos(a) * R;
      const z = cz + Math.sin(a) * R;
      const near = segDist(b.pos.x, b.pos.y, n.pos.x, n.pos.y, x, z);
      const s = Math.hypot(x - b.pos.x, z - b.pos.y) - Math.max(0, 4 - near) * 4 - Math.hypot(x - n.pos.x, z - n.pos.y) * 0.15;
      if (s > bs) { bs = s; best = [x, z]; }
    }
    f.hide = best;
    return best;
  }

  // Where to run to get out from under a blow, staying on the arena floor: out of a swing's or a
  // lunge's lane (up or down, whichever is nearer and open), or straight away from where a slam
  // or a leap lands, past its edge.
  escape(a, n) {
    const { x, z, opt } = a;
    const { cx, cz } = this.ctx.world.arena;
    const lim = ARENA.walkRadius - 1;
    const clamp = ([ex, ez]) => {
      const off = Math.hypot(ex - cx, ez - cz);
      return off > lim ? [cx + ((ex - cx) / off) * lim, cz + ((ez - cz) / off) * lim] : [ex, ez];
    };
    if (a.shape === 'line') {
      const side = Math.sign(n.pos.y - z) || (Math.random() < 0.5 ? 1 : -1);
      for (const s of [side, -side]) {
        const [ex, ez] = clamp([n.pos.x, z + s * (opt.half + 1.4)]);
        if (!covers(a.shape, x, z, opt, ex, ez, 0.2)) return [ex, ez];
      }
      // no room up or down: behind him, then
      return clamp([x - opt.dir * 2.5, n.pos.y]);
    }
    let dx = n.pos.x - x;
    let dz = n.pos.y - z;
    let d = Math.hypot(dx, dz);
    if (d < 0.05) {
      const ang = Math.random() * Math.PI * 2;
      dx = Math.cos(ang);
      dz = Math.sin(ang);
      d = 1;
    }
    const out = opt.r + 1.4;
    return clamp([x + (dx / d) * out, z + (dz / d) * out]);
  }

  // ------------------------------------------------------------------------------------------

  update(dt, t) {
    this.clock += dt;
    const { world, director, ui, pilot } = this.ctx;
    this.t += dt;

    // thy health: back to full slowly out of a fight, quickly at grace
    const me = pilot.npc;
    if (me && !pilot.dead) {
      const atGrace = me.action?.kind === 'use' && me.action.anim === 'sit';
      pilot.hp = Math.min(pilot.maxHp, pilot.hp + dt * (atGrace ? 25 : this.active ? 0 : 6));
    }
    if (pilot.dead) {
      if (this.carry && (this.state === 'gathering' || this.state === 'fighting')) {
        // fallen mid-fight: after a moment, whom to carry on as (kept up to date)
        if (this.clock - this.carry.since > 2.5) this.offerCarry();
      } else if (this.clock >= (this.reviveAt || 0)) {
        // out of a fight, or once it's over: rise at the Hold's grace
        this.carry = null;
        this.closeCarry();
        pilot.dead = false;
        pilot.hp = pilot.maxHp;
        if (me) { me.action = null; pilot.travelTo(world.hub); }
      }
    }

    // the fallen lie a moment where they fell before going (counted here: they lie under a
    // collapse, not their mind); they don't get up again
    for (const n of director.npcs.values()) {
      const f = n.fighter;
      if (f && f.down > 0) f.down -= dt;
    }

    // what may bring one
    if (this.state === 'idle') {
      if (this.clock >= this.nextInvasion) {
        this.nextInvasion = this.clock + rand(...this.trigger.invasion);
        if (this.auto()) this.start({ kind: 'invasion' });
      }
      this.watchTimer = (this.watchTimer || 0) - dt;
      if (this.watchTimer <= 0) { this.watchTimer = 5; this.watchQuests(); }
    }

    switch (this.state) {
      case 'rising':
        if (world.arena.risen) {
          this.ctx.nav.sync();
          this.gather();
          this.state = 'gathering';
          this.t = 0;
        }
        break;
      case 'gathering':
        if (this.t >= 2.5) {
          const [bx, bz] = world.arena.point('boss');
          this.boss = new Boss(this.ctx, bx, bz);
          this.lagHp = this.boss.hp;
          this.ctx.particles.emit({
            pos: [bx, 1.5, bz], spread: [1.2, 2, 0.8], vel: [0, 1.5, 0], velSpread: [1, 1, 0.6],
            color: ['#2a1a1a', '#6a2a2a', '#ff5a3a'], size: 0.14, life: 2, count: 80, drag: 0.6, intensity: 1.4,
          });
          ui.log(`${this.boss.name[0].toUpperCase()}${this.boss.name.slice(1)} enters the Arena of Trials`, 'red', { region: world.arena });
          this.state = 'fighting';
          this.t = 0;
        }
        break;
      case 'fighting': {
        const b = this.boss;
        this.stepBoss(b, dt, t);
        // the fighters' blows land at the turn of their swing
        for (const n of director.npcs.values()) {
          const a = n.action;
          if (a?.kind === 'fightAttack' && !a.hit && a.t >= a.hitAt) {
            a.hit = true;
            if (b.lift < 2 && Math.hypot(b.pos.x - n.pos.x, b.pos.y - n.pos.y) < BOSS.reach + BOSS.radius + 0.4) this.hit(b, DAMAGE.fighter);
          }
        }
        if (b.state === 'gone' || !b.alive) {
          if (b.state === 'gone') this.win();
        } else if (this.lost()) {
          ui.banner('The Great Enemy Prevails', 'Every Tarnished has fallen', 'red');
          ui.log(`Every Tarnished has fallen: ${b.name} holds the Arena of Trials`, 'red', { region: world.arena });
          this.withdraw(b);
        } else if (this.t > this.trigger.timeout) {
          ui.banner('The Great Enemy Withdraws', 'Into the fog it goes', 'red');
          this.withdraw(b);
        }
        break;
      }
      case 'won':
        if (this.t >= 6) this.end();
        break;
      case 'ending': {
        // the arena sinks only once nobody at all is left on it or its bridge, thee included
        // (anyone else still there after a while is sent home by grace)
        if (!this.occupied()) {
          world.arena.lower();
          this.ctx.nav.sync();
          this.state = 'idle';
          this.quietUntil = this.clock + this.trigger.cooldown;
        } else if (this.t > 15) {
          for (const n of director.npcs.values()) this.leaveArena(n);
        }
        break;
      }
      default:
        break;
    }
    if (this.boss && this.state !== 'fighting' && this.boss.state !== 'gone') this.stepBoss(this.boss, dt, t);
    if (this.boss?.state === 'gone' && this.state !== 'fighting') { this.boss.dispose(); this.boss = null; }
    this.fx = this.fx.filter((e) => {
      if (e.step(dt)) return true;
      e.dispose();
      return false;
    });
    this.updateUi(dt);
  }

  win() {
    const { ui, director } = this.ctx;
    ui.banner('Great Enemy Felled', '', 'gold');
    ui.log('The great enemy is felled', 'gold', { region: this.ctx.world.arena });
    for (const n of director.npcs.values()) {
      if (!n.fighter || n.piloted || n.fighter.dead) continue;
      n.action = null;
      n.gesture('cheer', 'sparkle');
      if (Math.random() < 0.5) director.remark(n, 'victory', null, 0.5 + Math.random() * 1.5);
    }
    this.state = 'won';
    this.t = 0;
    this.boss.dispose();
    this.boss = null;
  }

  // Lost: nobody is left standing on the arena (every fighter fallen, and thou fallen or gone).
  // Not in the first moments, while everyone is still on the way.
  // If only the coward is left (running about, never striking), he can't win it: lost after a while
  // of him fleeing, unless thou art on the arena, or fallen and about to carry on as him.
  lost() {
    const { pilot, director } = this.ctx;
    if (!this.fallen && this.t < 20) return false;
    let cowards = 0;
    for (const n of director.npcs.values()) {
      const f = n.fighter;
      if (!f || n.piloted) continue;
      if (f.dead ? f.down > 0 : !f.coward) { this.cowardsAlone = null; return false; } // (the last to fall lies a moment first)
      if (!f.dead) cowards += 1;
    }
    const me = pilot.npc;
    if (me && !pilot.dead && this.inArena(me)) { this.cowardsAlone = null; return false; }
    if (!cowards) return true;
    if (this.carry) return false;
    this.cowardsAlone ??= this.clock;
    return this.clock - this.cowardsAlone > 20;
  }

  // He leaves the arena (unbeaten): he fades into red mist, and the fight is over.
  withdraw(b) {
    b.endMove();
    b.lift = 0;
    b.state = 'withdraw';
    b.t = 0;
    b.pose('idle');
    this.end();
  }

  // Fallen mid-fight: the fighters still standing, any of whom thou mayst carry on as (the panel
  // over the fight, rebuilt only when the list or their health changes).
  offerCarry() {
    const list = [...this.ctx.director.npcs.values()].filter((n) => n.fighter && !n.fighter.dead && !n.piloted && !n.dead);
    const key = list.map((n) => `${n.sid}:${Math.ceil(n.fighter.hp / 10)}`).join(',');
    if (key === this.carryKey) return;
    this.carryKey = key;
    const el = this.ui;
    el.carryList.replaceChildren(...list.map((n) => {
      const b = document.createElement('button');
      b.type = 'button';
      const name = document.createElement('span');
      name.textContent = n.name.first;
      const what = document.createElement('small');
      what.textContent = n.name.epithet || '';
      const hp = document.createElement('i');
      hp.style.width = `${Math.max(0, Math.min(100, n.fighter.hp))}%`;
      b.append(name, what, hp);
      b.addEventListener('click', () => this.carryOn(n));
      return b;
    }));
    el.carry.hidden = !list.length;
  }

  closeCarry() {
    this.ui.carry.hidden = true;
    this.carryKey = null;
  }

  // Thou carriest on as `npc`, with what health it has left. The body thou leavest is fallen like
  // any other: it lies a moment, then goes to rest at the Hold till the fight is over.
  carryOn(npc) {
    const { pilot, ui } = this.ctx;
    if (!pilot.dead || !this.carry || !npc.fighter || npc.fighter.dead || npc.piloted || npc.dead) return;
    const old = pilot.npc;
    if (old) old.fighter = { ...(old.fighter || {}), hp: 0, dead: true, down: 1.5, vx: 0, vz: 0, speed: 0 };
    pilot.dead = false;
    pilot.hp = Math.max(1, (npc.fighter.hp / 100) * pilot.maxHp);
    pilot.take(npc);
    this.carry = null;
    this.closeCarry();
    ui.log(`${npc.name.first} carries on the fight`, 'gold', npc);
  }

  end() {
    this.release();
    this.state = 'ending';
    this.t = 0;
  }

  updateUi(dt) {
    const b = this.boss;
    const el = this.ui;
    el.boss.hidden = !(b && (this.state === 'fighting'));
    if (b) {
      el.bossName.textContent = b.name;
      el.bossHp.style.width = `${(100 * b.hp) / b.max}%`;
      this.lagHp = Math.max(b.hp, this.lagHp - dt * b.max * 0.25);
      el.bossLag.style.width = `${(100 * this.lagHp) / b.max}%`;
      el.bossDmg.textContent = this.clock < this.dmgUntil ? String(this.dmgShown) : '';
    }
    const pilot = this.ctx.pilot;
    el.hp.hidden = !(this.active || pilot.hp < pilot.maxHp);
    el.hpBar.style.width = `${(100 * pilot.hp) / pilot.maxHp}%`;
  }
}
