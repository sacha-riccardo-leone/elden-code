// Things thou canst use (E) when standing by them: every station the sessions' characters work at
// (the forge, the scriptorium, the war table, the ritual circle, the raven tower, the fog gate, the
// site of grace) on every island, in Roundtable Hold the Round Table, with its great grace at its
// heart (taking a seat there rests at grace; it can also summon a great enemy to the arena), and
// on the training yard its little grace, where thou callest the Tarnished to train (training.js).
// A prompt shows over the nearest one in reach.
// Using a station works it as the characters do: the forge glows and throws sparks at each blow,
// the ritual circle spins up, a raven takes wing, the bell rings at the fog gate. Walking off (or E
// again) stops.

import * as THREE from 'three';
import { HUB_LAYOUT } from './config.js';
import { groundAt } from './ground.js';

// How each station is used, and how close one must stand.
const USES = {
  forge: { label: 'Work the forge', anim: 'hammer', reach: 2.8 },
  scriptorium: { label: 'Read the scrolls', anim: 'read', reach: 2.4 },
  table: { label: 'Study the war table', anim: 'point', reach: 2.8 },
  ritual: { label: 'Invoke the ritual circle', anim: 'cast', reach: 2.6 },
  tower: { label: 'Send a raven', anim: 'send', reach: 3.4 },
  gate: { label: 'Kneel at the fog gate', anim: 'kneel', reach: 3.8 },
  grace: { label: 'Rest at grace', anim: 'sit', reach: 2.4 },
};

export class Interact {
  constructor(ctx) {
    this.ctx = ctx;
    this.near = null;
    this.el = document.getElementById('prompt');
    this.label = this.el.querySelector('span');
    this.v = new THREE.Vector3();
  }

  // Everything usable in the area thou standest in: { x, z, reach, label, use }.
  spots(area) {
    const { world } = this.ctx;
    if (!area) return [];
    if (area === world.hub) {
      const [tx, tz] = HUB_LAYOUT.table;
      return [{ x: tx, z: tz, reach: 3.4, label: 'The Round Table', use: () => this.ctx.ui.openTable() }];
    }
    if (area === world.yard) {
      const [gx, gz] = world.yard.graceSpot();
      return [{ x: gx, z: gz, reach: 2.6, label: 'Call to training', use: () => this.ctx.training.ask() }];
    }
    if (!area.point || area.isArena) return [];
    return Object.keys(USES).map((station) => {
      const [x, z] = area.point(station);
      return { x, z, reach: USES[station].reach, label: USES[station].label, use: (n) => this.work(n, area, station, x) };
    });
  }

  // Work a station: face it and keep at it (as an action the pilot stops when thou walkest off).
  work(n, region, station, x) {
    const u = USES[station];
    if (Math.abs(x - n.pos.x) > 0.3) n.body.facing = x > n.pos.x ? 1 : -1;
    n.action = { kind: 'use', anim: u.anim, t: 0, dur: Infinity };
    n.using = region ? { region, station } : null;
    n.body.play(u.anim, true);
    if (region && station === 'tower') { region.sendRaven(); n.lastRaven = performance.now() / 1000; }
    if (region && station === 'gate') region.ringBell();
  }

  // E: use what's in reach, or stop using it.
  press() {
    const n = this.ctx.pilot.npc;
    if (!n || this.ctx.pilot.busy(n) && n.action?.kind !== 'use') return;
    if (n.action?.kind === 'use') { n.action = null; n.using = null; return; }
    if (this.near) this.near.use(n);
  }

  update() {
    const n = this.ctx.pilot.npc;
    let best = null;
    if (n && !n.travel && !n.dragged && n.action?.kind !== 'use') {
      const area = this.ctx.world.areaAt(n.pos.x, n.pos.y);
      let bd = Infinity;
      for (const s of this.spots(area)) {
        const d = Math.hypot(s.x - n.pos.x, s.z - n.pos.y);
        if (d <= s.reach && d < bd) { bd = d; best = s; }
      }
    }
    this.near = best;
    this.el.hidden = !best;
    if (!best) return;
    this.label.textContent = best.label;
    const p = this.ctx.ui.project(this.v.set(best.x, groundAt(best.x, best.z) + 2.2, best.z));
    this.el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
  }
}

