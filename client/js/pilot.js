// Thee: the character the player holds. Maren the Stormbound at first, but any Tarnished can be
// taken over ("Become …" in its fan of gestures); whoever is let go goes back to their own life,
// Maren included: she then wanders the Lands Between, sits at the Round Table and talks like
// everyone else, until the player takes her back. The one held walks with WASD or the arrows
// (Shift to run), crosses the bridges, strikes with a left click, crouches with C, gestures with
// B or 1–8, and travels by grace (Q / E / H). Their blows only make others stagger.
//
// While held, a Claude Code session's character stops going where its session needs it; what the
// session wants is kept (npc.resume) and taken up once the player lets go. The Twofold can't move
// while it changes form at dusk and dawn.
//
// The player also has health (for fights against great enemies, fight.js) and a dodge (Space): a
// quick dash that no blow can touch. A mage casts its spells with a click (and Fortuna, who also
// has her blade, with the right button; combat.js; Ulric, with the right button, throws his spear),
// and an ultimate, once full, is loosed with R (ults.js).

import { styleOf, blow, canCast, aimOf, middleOf, muzzleSpot } from './combat.js';
import { groundAt } from './ground.js';

const WALK = 3.4;
const RUN = 6.2;
const DODGE = { speed: 9.5, time: 0.32, cooldown: 0.7 };
const PAD = 0.25; // keep this far from walls and furniture

const MOVE = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};
export const MOVE_KEYS = new Set([...Object.keys(MOVE), 'ShiftLeft', 'ShiftRight']);

export class Pilot {
  // keys: the Set of held key codes, kept up to date by the input handler.
  constructor(ctx, keys) {
    this.ctx = ctx;
    this.keys = keys;
    this.npc = null;
    this.speed = WALK;
    this.moving = false;
    this.hp = 100;
    this.maxHp = 100;
    this.dead = false;
    this.dodgeReady = 0;
    this.blowReady = 0; // when thy next blow (or spell) may come (paced)
    this.ult = 0; // thine ultimate, filling as thy blows land (fight.js, ults.js)
  }

  // Take hold of `npc`, letting go of whoever was held before.
  take(npc) {
    if (!npc || npc === this.npc || npc.dead || npc.spectre) return; // spectres can't be taken up
    if (this.npc) this.letGo(this.npc);
    this.npc = npc;
    if (npc.intent.kind !== 'fight') npc.resume = npc.intent; // a fighter's own life is already kept
    if (npc.slot) npc.releaseSlot();
    npc.slot = null;
    npc.path = [];
    npc.goal = null;
    npc.arrived = true;
    npc.yielding = null;
    npc.talk = null;
    npc.inTalk = false;
    if (npc.action && npc.action.kind !== 'transform') npc.action = null;
    npc.intent = { kind: 'piloted' };
    npc.piloted = true;
    npc.body.play('idle');
  }

  // Back to their own life: what their session wants now, or (Maren) a wander where she stands.
  // Someone who was at the Round Table walks back to it rather than reappearing in a seat.
  letGo(npc) {
    npc.piloted = false;
    // let go in the middle of a fight, a fighter fights on
    if (npc.fighter && this.ctx.fight?.active) { npc.action = null; npc.intent = { kind: 'fight' }; return; }
    if (npc.action && (npc.action.kind === 'attack' || npc.action.kind === 'crouch')) npc.action = null;
    let want = npc.resume && npc.resume.kind !== 'piloted' ? npc.resume : { kind: 'wander' };
    npc.resume = null;
    if (want.kind === 'gather') want = npc.unbound ? { kind: 'journey', dest: 'hub' } : { kind: 'journey' };
    npc.intent = { kind: 'none' };
    npc.setIntent(want);
  }

  heading() {
    let x = 0;
    let z = 0;
    for (const code of this.keys) {
      const m = MOVE[code];
      if (m) { x += m[0]; z += m[1]; }
    }
    return { x: Math.sign(x), z: Math.sign(z), run: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') };
  }

  // (and, in the tutorial, only within the place its step is in: tutorial.js, fence)
  canStand(x, z) {
    return this.ctx.world.isWalkArea(x, z) && !this.ctx.world.isBlocked(x, z, PAD) && (this.ctx.tutorial?.fence?.(x, z) ?? true);
  }

  // One step along the held direction, sliding along whatever blocks the way. Walking into
  // someone shoves them aside (crowd.js), and slows thee down the heavier they are.
  walk(n, dt, h) {
    const len = Math.hypot(h.x, h.z);
    const speed = (h.run ? RUN : WALK) * (this.ctx.crowd?.shoveFactor(n, h.x / len, h.z / len) ?? 1);
    const sx = (h.x / len) * speed * dt;
    const sz = (h.z / len) * speed * dt;
    const { x, y: z } = n.pos;
    // (somewhere thou mayst not stand, in a wall or outside the tutorial's fence, thou mayst walk
    // out of it any way, but never off the ground)
    if (this.canStand(x + sx, z + sz) || (!this.canStand(x, z) && this.ctx.world.isWalkArea(x + sx, z + sz))) n.pos.set(x + sx, z + sz);
    else if (sx && this.canStand(x + sx, z)) n.pos.x += sx;
    else if (sz && this.canStand(x, z + sz)) n.pos.y += sz;
    else if (!this.nudge(n, speed * dt, h)) return false;
    if (h.x) n.body.facing = h.x > 0 ? 1 : -1;
    this.speed = speed;
    // Maren lives wherever she is (an island or the Hold, never the arena); a session's character
    // keeps its home island
    if (n.isMaren) {
      const here = this.ctx.world.areaAt(n.pos.x, n.pos.y);
      if (here?.walkRect) n.region = here;
    }
    return true;
  }

  // Walking straight into a wall just beside an opening (a bridge, a gate)? Slide toward the
  // opening, so getting onto a bridge doesn't take pixel-perfect aim.
  nudge(n, step, h) {
    if (h.x && h.z) return false;
    const { x, y: z } = n.pos;
    for (let k = 1; k <= 10; k++) {
      for (const sign of [1, -1]) {
        const o = sign * k * 0.25;
        const [px, pz] = h.x ? [x, z + o] : [x + o, z];
        const ahead = h.x ? [px + h.x * 0.4, pz] : [px, pz + h.z * 0.4];
        if (!this.canStand(px, pz) || !this.canStand(ahead[0], ahead[1])) continue;
        const d = Math.min(step, Math.abs(o)) * sign;
        const [lx, lz] = h.x ? [x, z + d] : [x + d, z];
        if (!this.canStand(lx, lz)) continue; // (nor slides into what stands between: a pillar)
        n.pos.set(lx, lz);
        return true;
      }
    }
    return false;
  }

  // How n walks and stands: Ruadan, his maul thrown and not yet back, without it (combat.js).
  walkOf(n) { return n.maulOut && n.body.sheet.anims.walkBare ? 'walkBare' : 'walk'; }
  idleOf(n) { return n.maulOut && n.body.sheet.anims.idleBare ? 'idleBare' : 'idle'; }

  // Busy: travelling, changing form, or in the middle of something that isn't a crouch.
  busy(n) {
    return !n || this.dead || n.travel || n.shift || n.dragged || (n.action && n.action.kind !== 'crouch') || this.held();
  }

  // Everyone holding still while a great enemy changes (fight.js, holds: Morvane's, morvane.js).
  held() {
    return !!this.ctx.fight?.holds?.();
  }

  // Space: a quick dash where the keys point (or straight ahead); no blow can touch thee in it.
  dodge() {
    const n = this.npc;
    const now = performance.now() / 1000;
    if (!n || this.dead || n.travel || n.shift || n.dragged || now < this.dodgeReady || this.held()) return;
    if (n.action && !['use', 'crouch', 'hurt', 'gesture'].includes(n.action.kind)) return;
    const h = this.heading();
    const len = Math.hypot(h.x, h.z);
    const [dx, dz] = len ? [h.x / len, h.z / len] : [n.body.facing, 0];
    if (dx) n.body.facing = dx > 0 ? 1 : -1;
    const walk = this.walkOf(n);
    n.action = { kind: 'dodge', anim: walk, t: 0, dur: DODGE.time, dx, dz };
    n.using = null;
    n.body.play(walk, true);
    this.dodgeReady = now + DODGE.cooldown;
    this.ctx.sound?.play('step-land', { at: [n.pos.x, n.pos.y], volume: 0.6 }); // (pushing off: audio.js)
    this.ctx.particles.emit({
      pos: [n.pos.x, groundAt(n.pos.x, n.pos.y) + 0.25, n.pos.y], spread: [0.3, 0.1, 0.2], vel: [-dx * 1.5, 0.6, -dz * 1.5], velSpread: [0.6, 0.4, 0.4],
      color: ['#b8b0a0', '#8a8278', '#e0d8c8'], size: 0.08, life: 0.5, count: 14, drag: 1.5, intensity: 0.8,
    });
  }

  // One blow (the character's own strike) the way thou pointest (`at`: where, input.js): along the
  // line on the screen from thy middle to the pointer (combat.js, aimOf), finding whoever stands on
  // it within reach (they stagger), or a little off it. A mage casts instead (cast).
  attack(at = null) {
    const n = this.npc;
    if (styleOf(n).range === 'far') { this.cast(at); return; }
    if (this.busy(n) || n.maulOut || !this.paced(n)) return; // (Ruadan's maul thrown: nothing to strike with)
    const aim = aimOf(n, at, middleOf(n));
    if (Math.abs(aim[0]) > 0.05) n.body.facing = aim[0] > 0 ? 1 : -1;
    blow(n, 'attack', { aim });
  }

  // Whether thy next blow (or spell) may come yet; if so, when the one after it may. A drawn blow
  // (combat.js, blow) is over far sooner than the rig's old strike, but thy blows still come at
  // that strike's pace: the great enemies are measured against it.
  paced(n) {
    const now = performance.now() / 1000;
    if (now < this.blowReady) return false;
    const old = n.body.sheet.anims.hammer;
    this.blowReady = now + (old ? old.frames.length / old.fps : 0);
    return true;
  }

  // A spell toward where the click landed (right click; a mage's left click too): for those who
  // cast (combat.js), Fortuna among them, and Ulric, who throws his spear. It's loosed at the turn
  // of the character's blow (drive).
  cast(at = null) {
    const n = this.npc;
    if (this.busy(n) || n.maulOut || !canCast(n) || !this.paced(n)) return;
    // (turned the way it goes: along the line to the pointer, at the height it flies at)
    const aim = aimOf(n, at, muzzleSpot(n)[1] + (n.lift || 0));
    if (Math.abs(aim[0]) > 0.05) n.body.facing = aim[0] > 0 ? 1 : -1;
    blow(n, 'cast', { spell: true, at });
  }

  // Kneel down (C), and get up again (C, or setting off).
  toggleCrouch() {
    const n = this.npc;
    if (n?.action?.kind === 'crouch') {
      n.action = null;
      return;
    }
    if (this.busy(n) || n.action || n.maulOut) return;
    n.action = { kind: 'crouch', anim: 'kneel', t: 0, dur: Infinity };
    n.body.play('kneel', true);
  }

  // Where one may travel by grace: Roundtable Hold always, and the training yard below it; an island
  // once it has risen (not while
  // it's still under the mist, nor once it's sinking back into it); while a great enemy is abroad,
  // nowhere but the Hold (the way to the arena is on foot, guide.js); and sealed in the arena
  // with him, nowhere at all till the fight is over.
  canTravelTo(area) {
    const { world, fight } = this.ctx;
    if (fight?.sealed && this.npc && fight.inArena(this.npc)) return false;
    if (area === world.hub || area === world.yard) return true;
    return !!area?.walkRect && area.risen && !area.sinking && !fight?.hunting();
  }

  // Travel by grace to an area (hub or region): dissolve and reappear at its Site of Grace.
  // (`forced`: rising again at the Hold after falling, wherever one fell.)
  travelTo(area, forced = false) {
    const n = this.npc;
    if (!n || n.travel || n.shift || !area || (!forced && !this.canTravelTo(area))) return;
    n.action = null;
    n.goal = null;
    n.path = [];
    n.fastTravel(area.cx, area.cz ?? 0);
    if (n.isMaren && area.walkRect) n.region = area;
  }

  // Standing on nothing, off the edge of the world (which no step, dodge or push should ever
  // allow): back onto the nearest ground, or from far out, by grace to the Hold.
  reground(n) {
    const [x, z] = this.ctx.nav.clampToWalkable(n.pos.x, n.pos.y);
    if (this.ctx.world.isWalkArea(x, z)) n.pos.set(x, z);
    else this.travelTo(this.ctx.world.hub, true);
  }

  // One frame of the held character (from its update): its action (a blow, a crouch, a gesture,
  // its change of form) or a step where the keys point. Returns whether it moved.
  drive(n, dt) {
    if (!n.action && !n.travel && !n.dragged && !n.shift && !this.dead && !this.ctx.world.isWalkArea(n.pos.x, n.pos.y)) this.reground(n);
    if (this.held() && !n.action) {
      n.body.play(this.idleOf(n));
      this.moving = false;
      return false;
    }
    const h = this.heading();
    const going = !!(h.x || h.z);
    // setting off cuts a gesture or a crouch short (not a blow, nor rising from grace, nor a change of
    // form, nor Ruadan holding his hand out for his maul as it comes back: combat.js)
    if (going && n.action && !['spawn', 'attack', 'cast', 'ult', 'transform', 'dodge', 'hurt', 'catch'].includes(n.action.kind) && !n.shift && !this.dead) n.action = null;
    let moving = false;
    if (n.action) {
      const a = n.action;
      a.t += dt;
      if (a.kind === 'dodge') {
        const step = DODGE.speed * dt;
        const x = n.pos.x + a.dx * step;
        const z = n.pos.y + a.dz * step;
        if (this.canStand(x, z)) { n.pos.set(x, z); moving = true; }
        if (Math.random() < dt * 30) {
          this.ctx.particles.emit({
            pos: [n.pos.x, groundAt(n.pos.x, n.pos.y) + 0.3, n.pos.y], spread: [0.2, 0.2, 0.1], vel: [-a.dx, 0.4, -a.dz], velSpread: [0.3, 0.3, 0.3],
            color: ['#b8b0a0', '#e0d8c8'], size: 0.07, life: 0.4, count: 3, drag: 2, intensity: 0.8,
          });
        }
      }
      if (a.kind === 'attack' && !a.hit && a.t >= a.hitAt) {
        a.hit = true;
        this.ctx.director.strikeFrom(n);
        const burst = n.hero?.rig?.burst || ['#ffd27a', '#fff1b8'];
        this.ctx.particles.emit({
          pos: [n.pos.x + n.body.facing * 1.7, groundAt(n.pos.x, n.pos.y) + 1.1, n.pos.y], spread: [0.25, 0.3, 0.2], vel: [n.body.facing * 1.5, 0.8, 0],
          velSpread: [1, 1, 0.6], color: [...burst, burst[0]], size: 0.06, life: 0.5, count: 18, drag: 1.5, intensity: 2.6,
        });
      }
      // thy spell, loosed at the turn of the blow (fight.js)
      if (a.kind === 'cast' && !a.hit && a.t >= a.hitAt) {
        a.hit = true;
        // (on the training yard, at its dummies: training.js)
        const place = this.ctx.training?.has(n) ? this.ctx.training : this.ctx.fight;
        place?.playerCast(n, a.at);
      }
      if (a.t >= a.dur) {
        if (a.kind === 'dodge') this.ctx.sound?.play('step-land', { at: [n.pos.x, n.pos.y] }); // (coming down: audio.js)
        n.action = null;
      }
    } else if (going && !n.shift && !this.dead) {
      moving = this.walk(n, dt, h);
    }
    if (n.action?.kind !== 'use') n.using = null; // walked off the station
    if (!n.action && !n.shift) n.body.play(moving ? this.walkOf(n) : this.idleOf(n));
    this.moving = moving;
    return moving;
  }
}
