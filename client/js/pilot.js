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
// quick dash that no blow can touch.

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

  canStand(x, z) {
    return this.ctx.world.isWalkArea(x, z) && !this.ctx.world.isBlocked(x, z, PAD);
  }

  // One step along the held direction, sliding along whatever blocks the way. Walking into
  // someone shoves them aside (crowd.js), and slows thee down the heavier they are.
  walk(n, dt, h) {
    const len = Math.hypot(h.x, h.z);
    const speed = (h.run ? RUN : WALK) * (this.ctx.crowd?.shoveFactor(n, h.x / len, h.z / len) ?? 1);
    const sx = (h.x / len) * speed * dt;
    const sz = (h.z / len) * speed * dt;
    const { x, y: z } = n.pos;
    if (this.canStand(x + sx, z + sz) || !this.canStand(x, z)) n.pos.set(x + sx, z + sz);
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
        if (h.x) n.pos.y += d;
        else n.pos.x += d;
        return true;
      }
    }
    return false;
  }

  // Busy: travelling, changing form, or in the middle of something that isn't a crouch.
  busy(n) {
    return !n || this.dead || n.travel || n.shift || n.dragged || (n.action && n.action.kind !== 'crouch');
  }

  // Space: a quick dash where the keys point (or straight ahead); no blow can touch thee in it.
  dodge() {
    const n = this.npc;
    const now = performance.now() / 1000;
    if (!n || this.dead || n.travel || n.shift || n.dragged || now < this.dodgeReady) return;
    if (n.action && !['use', 'crouch', 'hurt', 'gesture'].includes(n.action.kind)) return;
    const h = this.heading();
    const len = Math.hypot(h.x, h.z);
    const [dx, dz] = len ? [h.x / len, h.z / len] : [n.body.facing, 0];
    if (dx) n.body.facing = dx > 0 ? 1 : -1;
    n.action = { kind: 'dodge', anim: 'walk', t: 0, dur: DODGE.time, dx, dz };
    n.using = null;
    n.body.play('walk', true);
    this.dodgeReady = now + DODGE.cooldown;
    this.ctx.particles.emit({
      pos: [n.pos.x, 0.25, n.pos.y], spread: [0.3, 0.1, 0.2], vel: [-dx * 1.5, 0.6, -dz * 1.5], velSpread: [0.6, 0.4, 0.4],
      color: ['#b8b0a0', '#8a8278', '#e0d8c8'], size: 0.08, life: 0.5, count: 14, drag: 1.5, intensity: 0.8,
    });
  }

  // One blow (the character's own strike) toward where the click landed; whoever stands in front
  // staggers.
  attack(targetX = null) {
    const n = this.npc;
    if (this.busy(n)) return;
    if (targetX != null && Math.abs(targetX - n.pos.x) > 0.2) n.body.facing = targetX > n.pos.x ? 1 : -1;
    const def = n.body.sheet.anims.hammer;
    n.action = {
      kind: 'attack', anim: 'hammer', t: 0, dur: def.frames.length / def.fps,
      hitAt: (n.body.sheet.hits?.hammer ?? 2) / def.fps, hit: false,
    };
    n.body.play('hammer', true);
  }

  // Kneel down (C), and get up again (C, or setting off).
  toggleCrouch() {
    const n = this.npc;
    if (n?.action?.kind === 'crouch') {
      n.action = null;
      return;
    }
    if (this.busy(n) || n.action) return;
    n.action = { kind: 'crouch', anim: 'kneel', t: 0, dur: Infinity };
    n.body.play('kneel', true);
  }

  // Travel by grace to an area (hub or region): dissolve and reappear at its Site of Grace.
  travelTo(area) {
    const n = this.npc;
    if (!n || n.travel || n.shift || !area) return;
    n.action = null;
    n.goal = null;
    n.path = [];
    n.fastTravel(area.cx, area.cz ?? 0);
    if (n.isMaren && area.walkRect) n.region = area;
  }

  // One frame of the held character (from its update): its action (a blow, a crouch, a gesture,
  // its change of form) or a step where the keys point. Returns whether it moved.
  drive(n, dt) {
    const h = this.heading();
    const going = !!(h.x || h.z);
    // setting off cuts a gesture or a crouch short (not a blow, nor rising from grace, nor a change of form)
    if (going && n.action && !['spawn', 'attack', 'transform', 'dodge', 'hurt'].includes(n.action.kind) && !n.shift && !this.dead) n.action = null;
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
            pos: [n.pos.x, 0.3, n.pos.y], spread: [0.2, 0.2, 0.1], vel: [-a.dx, 0.4, -a.dz], velSpread: [0.3, 0.3, 0.3],
            color: ['#b8b0a0', '#e0d8c8'], size: 0.07, life: 0.4, count: 3, drag: 2, intensity: 0.8,
          });
        }
      }
      if (a.kind === 'attack' && !a.hit && a.t >= a.hitAt) {
        a.hit = true;
        this.ctx.director.strikeFrom(n);
        const burst = n.hero?.rig?.burst || ['#ffd27a', '#fff1b8'];
        this.ctx.particles.emit({
          pos: [n.pos.x + n.body.facing * 1.7, 1.1, n.pos.y], spread: [0.25, 0.3, 0.2], vel: [n.body.facing * 1.5, 0.8, 0],
          velSpread: [1, 1, 0.6], color: [...burst, burst[0]], size: 0.06, life: 0.5, count: 18, drag: 1.5, intensity: 2.6,
        });
      }
      if (a.t >= a.dur) n.action = null;
    } else if (going && !n.shift && !this.dead) {
      moving = this.walk(n, dt, h);
    }
    if (n.action?.kind !== 'use') n.using = null; // walked off the station
    if (!n.action && !n.shift) n.body.play(moving ? 'walk' : 'idle');
    this.moving = moving;
    return moving;
  }
}
