// Characters are solid. Every Tarnished, thou, and a great enemy each stand on a circle on the
// ground (config CROWD) that nobody else may walk into; only the Noble Sorcerers' spectres float
// through everything (and anyone travelling by grace, carried off, or fallen in a fight).
//
// It sits on the movement already there: everyone still moves their own way (NPCs along their nav
// paths, npc.js; thou with the keys, pilot.js; fighters and the enemy, fight.js). Then, once a
// frame (main.js), this pass parts whoever overlaps, by weight: the heavier moves less, a great
// enemy not at all, and NPCs never move thee (they steer round thee: `steer`). Walking into
// someone shoves them out of thy way, slowing thee by their weight (`shoveFactor`). No push ever
// takes anyone into a wall, off a ledge or off the walkable ground (the tests thine own steps
// use); what one of the two can't take, a wall at its back, the other does.

import { CROWD } from './config.js';

const MAX_R = Math.max(CROWD.radius, CROWD.bossRadius, CROWD.golemRadius);

export class Crowd {
  constructor(ctx) {
    this.ctx = ctx;
    this.bodies = []; // the solid ones this frame: { who, pos, r, w, player, boss }
  }

  weightOf(n) {
    const id = n.hero?.hero?.split('-')[0]; // (the Twofold weighs the same at dawn and at dusk)
    return CROWD.weight[id] ?? CROWD.weight.default;
  }

  // Whether a Tarnished (or thou) is solid just now.
  solid(n) {
    if (n.spectre || n.dead || n.travel || n.dragged || n.fade < 0.6 || n.lift > 0.5) return false;
    if (n.fighter?.dead) return false; // lying where they fell, then gone by grace
    if (n.piloted && this.ctx.pilot.dead) return false;
    if (n.intent.kind === 'leave' && n.arrived) return false; // walking into the fog
    return true;
  }

  gather() {
    const { director, pilot, fight } = this.ctx;
    const list = [];
    for (const n of director.npcs.values()) {
      if (!this.solid(n)) continue;
      const player = n === pilot.npc;
      list.push({ who: n, pos: n.pos, r: CROWD.radius, w: player ? CROWD.playerWeight : this.weightOf(n), player, boss: false });
    }
    // a great enemy, once he's come and while he's not in the air
    const b = fight?.boss;
    if (b && b.alive && b.fade > 0.5 && b.lift < 1) {
      const r = b.mind ? b.mind.crowdRadius(b.kind.crowd) : b.kind.crowd;
      list.push({ who: b, pos: b.pos, r, w: Infinity, player: false, boss: true });
    }
    this.bodies = list;
  }

  // The pass: part everyone who overlaps (sweeping along x), a few times over, then note how
  // fast each is going (others' steering foresees where they're heading from it).
  resolve(dt) {
    this.gather();
    const list = this.bodies;
    for (let pass = 0; pass < CROWD.passes && list.length > 1; pass++) {
      list.sort((a, b) => a.pos.x - b.pos.x);
      let parted = false;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          if (b.pos.x - a.pos.x >= a.r + MAX_R) break;
          if (this.part(a, b)) parted = true;
        }
      }
      if (!parted) break;
    }
    this.track(dt);
  }

  part(a, b) {
    let nx = b.pos.x - a.pos.x;
    let nz = b.pos.y - a.pos.y;
    const min = a.r + b.r;
    const d2 = nx * nx + nz * nz;
    if (d2 >= min * min) return false;
    const d = Math.sqrt(d2);
    if (d > 1e-4) { nx /= d; nz /= d; } else { nx = (a.who.rank ?? 0) <= (b.who.rank ?? 0) ? 1 : -1; nz = 0; }
    let pen = min - d;
    // thou walking into someone: they're sent partly aside, out of thy way, not just on ahead of thee
    const p = a.player ? a : b.player ? b : null;
    const v = p && !a.boss && !b.boss ? p.who.vel : null;
    const sp = v ? Math.hypot(v.x, v.z) : 0;
    if (sp > 0.5) {
      const ux = v.x / sp;
      const uz = v.z / sp;
      const s = p === a ? 1 : -1; // (from thee to them)
      const tx = nx * s;
      const tz = nz * s;
      const ahead = tx * ux + tz * uz;
      if (ahead > 0) {
        const side = tx * -uz + tz * ux >= 0 ? 1 : -1; // which side of thy way they stand
        let mx = tx - uz * side * CROWD.aside * ahead;
        let mz = tz + ux * side * CROWD.aside * ahead;
        const m = Math.hypot(mx, mz);
        mx /= m;
        mz /= m;
        pen /= Math.max(0.5, mx * tx + mz * tz); // as far along it as clears them
        nx = mx * s;
        nz = mz * s;
      }
    }
    // shares by weight: a great enemy is never moved, and an NPC never moves thee
    const ia = a.boss || (a.player && !b.boss) ? 0 : 1 / a.w;
    const ib = b.boss || (b.player && !a.boss) ? 0 : 1 / b.w;
    if (!ia && !ib) return false;
    const sa = ia / (ia + ib);
    const wantB = pen * (1 - sa);
    const gotB = wantB > 0 ? this.move(b, nx * wantB, nz * wantB) : 0;
    // what one can't take (a wall at its back), the other does, if it can be moved at all
    const wantA = pen * sa + (a.boss ? 0 : wantB - gotB);
    const gotA = wantA > 0 ? this.move(a, -nx * wantA, -nz * wantA) : 0;
    const rest = wantA - gotA;
    if (rest > 1e-4 && !b.boss) this.move(b, nx * rest, nz * rest);
    return true;
  }

  // Moves a body by (dx, dz) if it can stand there, else slides along what's in the way; returns
  // how far it went along the push.
  move(b, dx, dz) {
    const p = b.pos;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return 0;
    const x = p.x;
    const z = p.y;
    // someone already nearer a wall than wallPad (an NPC rounding a corner on its path) is only
    // kept out of the wall itself
    const pad = this.ground(x, z) ? CROWD.wallPad : 0;
    const ok = (px, pz) => this.ground(px, pz, pad);
    if (ok(x + dx, z + dz)) { p.set(x + dx, z + dz); return len; }
    if (Math.abs(dx) > 1e-6 && ok(x + dx, z)) { p.x = x + dx; return (dx * dx) / len; }
    if (Math.abs(dz) > 1e-6 && ok(x, z + dz)) { p.y = z + dz; return (dz * dz) / len; }
    if (ok(x + dx / 2, z + dz / 2)) { p.set(x + dx / 2, z + dz / 2); return len / 2; }
    return 0;
  }

  // Ground one may stand on: walkable, and clear of walls and furniture by `pad`.
  ground(x, z, pad = CROWD.wallPad) {
    const w = this.ctx.world;
    return w.isWalkArea(x, z) && !w.isBlocked(x, z, pad);
  }

  // Whether a step from (x, z) to (nx, nz) keeps to the ground (by the same rule as a push).
  canStep(x, z, nx, nz) {
    return this.ground(nx, nz, this.ground(x, z) ? CROWD.wallPad : 0);
  }

  track(dt) {
    if (dt <= 0) return;
    const k = Math.min(1, dt * 10);
    for (const b of this.bodies) {
      const w = b.who;
      const vel = (w.vel ??= { x: 0, z: 0 });
      const last = w.lastAt;
      let vx = 0;
      let vz = 0;
      if (last) {
        vx = (b.pos.x - last.x) / dt;
        vz = (b.pos.y - last.z) / dt;
        if (vx * vx + vz * vz > 144) { vx = 0; vz = 0; } // a jump (by grace, into a seat), not a pace
      }
      vel.x += (vx - vel.x) * k;
      vel.z += (vz - vel.z) * k;
      w.lastAt = { x: b.pos.x, z: b.pos.y };
    }
  }

  // ------------------------------------------------------------------------------------------

  // The velocity an NPC heading (ux, uz) at `speed` should take to get past those about it: from
  // where each will be (they're foreseen along their way, not only where they stand) it turns
  // aside from any it would come too close to, always to its own right when two meet head on (so
  // both pass, never both the same way), and eases off behind someone close in its way.
  steer(n, ux, uz, speed) {
    if (!this.solid(n)) return [ux * speed, uz * speed];
    const H = CROWD.avoidHorizon;
    const range2 = CROWD.avoidRange * CROWD.avoidRange;
    const px = -uz; // its right hand
    const pz = ux;
    const r = CROWD.radius;
    let sx = 0;
    let sz = 0;
    let ease = 1;
    for (const o of this.bodies) {
      if (o.who === n) continue;
      const rx = o.pos.x - n.pos.x;
      const rz = o.pos.y - n.pos.y;
      const dist2 = rx * rx + rz * rz;
      if (dist2 > range2) continue;
      const dist = Math.sqrt(dist2);
      const ahead = rx * ux + rz * uz;
      if (ahead < -(r + o.r)) continue; // behind it now
      const R = r + o.r + CROWD.avoidMargin;
      // where it'll be, from here, when they're nearest
      const ov = o.who.vel || { x: 0, z: 0 };
      const wx = ov.x - ux * speed;
      const wz = ov.z - uz * speed;
      const w2 = wx * wx + wz * wz;
      const t = w2 > 1e-6 ? Math.max(0, Math.min(H, -(rx * wx + rz * wz) / w2)) : 0;
      const cx = rx + wx * t;
      const cz = rz + wz * t;
      const cd = Math.hypot(cx, cz);
      if (cd < R) {
        const urgency = (1 - t / H) * (1 - cd / R) + (dist < r + o.r ? 1 : 0);
        const lateral = cx * px + cz * pz; // > 0: it'll be on its right
        let side = Math.abs(lateral) < 0.2 * R ? 1 : lateral > 0 ? -1 : 1;
        // (keeping to the right, but not into a wall or a table: round the other side, if it's
        // more or less in the middle of the way and there's room there)
        if (Math.abs(lateral) < 0.5 * R && this.walled(n, px * side, pz * side) && !this.walled(n, -px * side, -pz * side)) side = -side;
        sx += px * side * urgency;
        sz += pz * side * urgency;
      }
      // someone close in its way: it eases off rather than walking into them
      const across = Math.abs(rx * px + rz * pz);
      if (ahead > 0 && across < r + o.r) {
        const gap = dist - r - o.r;
        if (gap < 0.6) ease = Math.min(ease, Math.max(0.25, gap / 0.6));
      }
    }
    if (!sx && !sz && ease === 1) return [ux * speed, uz * speed];
    // onward (eased), and aside
    const k = CROWD.avoidStrength;
    let vx = ux * ease + sx * k;
    let vz = uz * ease + sz * k;
    const m = Math.hypot(vx, vz);
    if (m > 1) { vx /= m; vz /= m; }
    return [vx * speed, vz * speed];
  }

  // Whether there's no ground to step aside onto, a body's width toward (dx, dz) (a unit vector).
  walled(n, dx, dz) {
    const d = CROWD.radius + CROWD.avoidMargin;
    return !this.ground(n.pos.x + dx * d, n.pos.y + dz * d, 0);
  }

  // How much of thy pace is left walking (ux, uz) into whoever's just ahead: shoving them slows
  // thee, the more the heavier they are. (A great enemy nobody shoves: the pass holds thee off him.)
  shoveFactor(n, ux, uz) {
    let k = 1;
    for (const b of this.bodies) {
      if (b.who === n || b.boss) continue;
      const rx = b.pos.x - n.pos.x;
      const rz = b.pos.y - n.pos.y;
      const d = Math.hypot(rx, rz);
      if (d < 1e-4 || d > CROWD.radius + b.r + 0.1) continue;
      const ahead = (rx * ux + rz * uz) / d;
      if (ahead <= 0) continue;
      const pace = Math.min(1, (CROWD.shove * CROWD.playerWeight) / (CROWD.playerWeight + b.w));
      k = Math.min(k, 1 - (1 - pace) * ahead);
    }
    return k;
  }

  // Whoever (but `n`) stands on (x, z), so that `n` couldn't stand there too.
  occupant(x, z, n) {
    for (const b of this.bodies) {
      if (b.who === n) continue;
      if (Math.hypot(b.pos.x - x, b.pos.y - z) < b.r + CROWD.radius - 0.05) return b;
    }
    return null;
  }

  // Those right in the way of `n` going (ux, uz): touching it, or nearly, ahead of it.
  blockers(n, ux, uz) {
    const out = [];
    for (const b of this.bodies) {
      if (b.who === n) continue;
      const rx = b.pos.x - n.pos.x;
      const rz = b.pos.y - n.pos.y;
      const d = Math.hypot(rx, rz);
      if (d > CROWD.radius + b.r + 0.6 || d < 1e-4) continue;
      if ((rx * ux + rz * uz) / d > 0.2) out.push(b);
    }
    return out;
  }
}
