// Ultimates, in a fight with a great enemy (fight.js). Every blow a Tarnished lands fills its
// ultimate (combat.js, ULT); full, it may loose it: thou with R, the others when they see fit (a
// while apart, never two at once). As one is loosed the world stands still and turns grey, all but
// whoever looses it; the camera closes on them and an aura of their own light shines round them;
// then they strike, and the world moves and colours again (about two seconds in all).
//
// Some are aimed: loosed one of the four ways (thou: toward the pointer), they find him only if he
// stands in their line; the rest find him wherever he is.
//   Jorvik, the Rune Lord – Flight of Tomes: golden tomes take wing and dash into him, each spent
//                          as it strikes
//   Corisande            – Glintstone Arrow: a crystal arrow trailing light, that finds its mark
//   Vael                 – Crimson Mire: a pool of blood under him: he slows, can't get out of it,
//                          and bleeds, on a while after it dries
//   Solenne              – Wall of Dawn (aimed): a curved wall of golden light that strikes him
//                          once, hard, and drives him back
//   Ruadan               – Hammerfall: up into the air and down at his feet, hammer first, in a
//                          burst of gold
//   Maren                – Red Storm: red lightning raining on him, and one great bolt to end it
//   Aurelion             – Radiant Verdict: a great slash of light that leaves him dazed, unable
//                          to fight or move
//   Wynn, the Ronin      – Iaijutsu: a breath, then cut after cut through him from every side as
//                          he stands held; nothing, till the blade is sheathed: then all at once
//   Ulric                – Tenfold Spears (aimed): ten spears that stick in him, poisoned, then
//                          fall away
//   Fortuna              – Frostfall: four great icicles dropping on him one after another

import * as THREE from 'three';
import { Particles } from './particles.js';
import { Aura, Missile, Wall, Pool, Slash, Cut, Drop, Bolt, Burst, StuckSpear, TEX, motesOf } from './spellfx.js';
import { ULT, ultPower, heroKey, styleOf, muzzleOf, statusOf, addDot, interrupt } from './combat.js';
import { lookOf } from './fxart.js';

// The moments of one: grey within `grey`, the aura from `aura`, the blow at `release`, colour back
// within `back` of it; the camera this close meanwhile (or as far back as a tall pose needs to be
// seen whole: `fit` world units away for each unit of its height).
const CINE = { grey: 0.3, aura: 0.45, release: 1.85, back: 0.55, close: 7.5, fit: 2.6 };

const rand = (a, b) => a + Math.random() * (b - a);

// How tall a pose stands (the frames of `anim` on body's sheet): from the feet to the top of the
// drawing, in world units (a spear raised to the sky counts).
function poseHeight(body, anim) {
  const s = body.sheet;
  const W = s.frameW * s.cols;
  let top = s.frameH;
  for (const i of s.anims[anim]?.frames || []) {
    const ox = (i % s.cols) * s.frameW;
    const oy = Math.floor(i / s.cols) * s.frameH;
    for (let y = 0; y < top; y++) {
      let ink = false;
      for (let x = 0; x < s.frameW && !ink; x++) ink = s.alpha[((oy + y) * W + ox + x) * 4 + 3] > 0;
      if (ink) top = y;
    }
  }
  return (s.frameH - top) * s.px;
}

// what runs as a fight effect (fight.fx): step(dt) → still going?
const effect = (step, dispose = () => {}) => ({ step, dispose });

// ---------------------------------------------------------------------------------------------
// each one: its name, the pose held as it gathers (an animation, and a frame to hold, or none to
// play it), whether it's aimed, and what it does (u: { fight, fx, n, b, dir, hit(share, at) })

export const ULTS = {
  runelord: {
    name: 'Flight of Tomes', pose: ['ult'],
    run({ fight, fx, n, hit }) {
      // (his tomes drawn at his own pixel size, their covers beating there and back)
      const look = lookOf('jorvik-tome', n.body.sheet.px, { frames: [TEX.tome(0), TEX.tome(1), TEX.tome(2), TEX.tome(1)], fps: 12, w: 0.8, h: 0.62 }, { fps: 14, order: [0, 1, 2, 3, 2, 1] });
      for (let i = 0; i < 7; i++) {
        const a = (i / 6 - 0.5) * 2.6;
        const from = [n.pos.x + Math.sin(a) * 1.5, 2.3 + Math.cos(a) * 0.9, n.pos.y + 0.1];
        const up = 1.4 + (i % 3) * 0.6;
        fx.add(new Missile(fx, {
          ...look, upright: true, from,
          to: () => fight.bossPoint(up), speed: 8.5, turn: 4, rise: 2.5, delay: i * 0.11, life: 5, trail: motesOf('rune'),
          onHit: (at) => {
            hit(3.2, at);
            fx.add(new Burst(fx, { school: 'rune', at: [at.x, at.y, at.z], size: 1.7, ring: false, sparks: 16 }));
            fx.particles.emit({
              pos: [at.x, at.y, at.z], spread: [0.2, 0.2, 0.2], vel: [0, 1, 0], velSpread: [1.6, 1.4, 1],
              color: ['#faf4e2', '#e4dcc4', '#ffde78'], size: 0.09, life: 0.8, count: 12, drag: 1.2, gravity: 2, intensity: 1.4,
            });
          },
        }));
      }
    },
  },
  sorceress: {
    name: 'Glintstone Arrow', pose: ['cast'],
    run({ fight, fx, n, hit }) {
      fx.add(new Missile(fx, {
        map: TEX.arrow(), w: 2.1, h: 0.69, from: muzzleOf(n), to: () => fight.bossPoint(2), speed: 14, turn: 3, life: 4,
        trail: [...motesOf('glintstone'), '#ffffff'], trailRate: 160, trailSize: 0.09,
        onHit: (at) => {
          hit(22, at);
          fx.add(new Burst(fx, { school: 'glintstone', at: [at.x, at.y, at.z], size: 4, sparks: 60 }));
          fight.ctx.rig?.shake?.(0.35);
        },
      }));
    },
  },
  bloodbender: {
    name: 'Crimson Mire', pose: ['ult'],
    run({ fight, fx, n, b }) {
      const now = fight.clock;
      const r = 3.2;
      fx.add(new Pool(fx, { x: b.pos.x, z: b.pos.y, r, life: 7, art: 'vael-pool' }));
      const s = statusOf(b);
      s.slowUntil = now + 7;
      s.slow = 0.35;
      s.rootUntil = now + 7;
      s.root = { x: b.pos.x, z: b.pos.y, r: r - 0.9 };
      addDot(b, { kind: 'bleed', dps: 14, until: now + 11, src: n });
      fx.particles.emit({
        pos: [b.pos.x, 0.3, b.pos.y], spread: [1.6, 0.1, 1.2], vel: [0, 2.2, 0], velSpread: [1.2, 1.2, 1],
        color: motesOf('blood'), size: 0.09, life: 0.8, count: 50, drag: 1.2, gravity: 3, intensity: 2,
      });
    },
  },
  queen: {
    name: 'Wall of Dawn', pose: ['send'], aim: true,
    run({ fight, fx, n, b, dir, hit }) {
      // it strikes him if it reaches him in its lane
      const lane = 2.4;
      fx.add(new Wall(fx, {
        x: n.pos.x + dir[0] * 0.8, z: n.pos.y + dir[1] * 0.8, dir,
        hits: (x, z) => b.alive && (dir[0] ? Math.abs(b.pos.y - z) < lane && (b.pos.x - x) * dir[0] < 0.6 : Math.abs(b.pos.x - x) < lane && (b.pos.y - z) * dir[1] < 0.6),
        onHit: (at) => {
          hit(26, at);
          fx.add(new Burst(fx, { school: 'holy', at: [b.pos.x, 2, b.pos.y], size: 4, sparks: 50 }));
          if (!b.mind?.lying) {
            interrupt(fight, b);
            statusOf(b).knock = { dx: dir[0], dz: dir[1], left: 4, speed: 12 };
          }
          fight.ctx.rig?.shake?.(0.3);
        },
      }));
    },
  },
  champion: {
    name: 'Hammerfall', pose: ['hammer', 1],
    run({ fight, fx, n, b, hit }) {
      // up, and down onto his feet: a leap the fight's own effects carry him through
      const from = n.pos.clone();
      const side = Math.sign(n.pos.x - b.pos.x) || 1;
      const to = new THREE.Vector2(b.pos.x + side * (b.kind.radius * 0.6 + 0.6), b.pos.y + 0.2);
      const dur = 0.9;
      const H = 4.2;
      let t = 0;
      n.action = { kind: 'ult', anim: 'hammer', t: 0, dur: dur + 0.5 };
      n.body.facing = -side;
      fx.add(effect((dt) => {
        t += dt;
        const k = Math.min(1, t / dur);
        // a long climb, a swift fall
        n.ultLift = k < 0.62 ? H * (1 - (1 - k / 0.62) ** 2) : H * (1 - ((k - 0.62) / 0.38) ** 2);
        const e = k < 0.62 ? 0.5 * (k / 0.62) : 0.5 + 0.5 * ((k - 0.62) / 0.38);
        n.pos.set(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
        // (raised high on the way up, coming down on the way down: frames of his own blow)
        const blow = n.body.sheet.anims.hammer?.frames || [];
        if (blow.length) n.body.setFrame(blow[Math.min(blow.length - 1, k < 0.62 ? 1 : 2)], n.body.facing);
        if (k < 1) return true;
        n.ultLift = null;
        hit(28, new THREE.Vector3(to.x, 1, to.y));
        fx.add(new Burst(fx, { school: 'holy', at: [to.x, 0.9, to.y], size: 5.5, sparks: 80 }));
        fx.add(new Burst(fx, { school: 'rune', at: [to.x, 1.6, to.y], size: 3.6, ring: false, sparks: 40 }));
        fx.particles.emit({
          pos: [to.x, 0.2, to.y], spread: [1.5, 0.1, 1], vel: [0, 2.6, 0], velSpread: [2.6, 1.6, 1.6],
          color: ['#7a6a5c', '#4a3e36', '#9a8a78'], size: 0.14, life: 1, count: 40, gravity: 12, drag: 0.4, intensity: 0.9,
        });
        fight.ctx.rig?.shake?.(0.7);
        return false;
      }, () => { n.ultLift = null; }));
    },
  },
  knight: {
    name: 'Red Storm', pose: ['ult'],
    run({ fight, fx, b, hit }) {
      let t = 0;
      let k = 0;
      const times = Array.from({ length: 12 }, (_, i) => 0.05 + i * 0.14 + rand(0, 0.05));
      fx.add(effect((dt) => {
        t += dt;
        while (k < times.length && t >= times[k]) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * 2.6;
          // (her bolts, drawn at twice her own pixel size: tall enough to fall from out of sight)
          fx.add(new Bolt(fx, { x: b.pos.x + Math.cos(a) * r, z: b.pos.y + Math.sin(a) * r * 0.7, k, life: 0.3, art: 'maren-bolt', px: 0.06, onHit: (at) => hit(1, at) }));
          fight.ctx.rig?.shake?.(0.12);
          k += 1;
        }
        if (t < 2) return true;
        fx.add(new Bolt(fx, { x: b.pos.x, z: b.pos.y + 0.1, wide: true, height: 18, life: 0.5, art: 'maren-great-bolt', px: 0.075, onHit: (at) => hit(14, at) }));
        fx.add(new Burst(fx, { school: 'storm', at: [b.pos.x, 1.5, b.pos.y], size: 4.4, sparks: 70 }));
        fight.ctx.rig?.shake?.(0.75);
        return false;
      }));
    },
  },
  paladin: {
    name: 'Radiant Verdict', pose: ['send'],
    run({ fight, fx, n, b, hit }) {
      fx.add(new Slash(fx, {
        school: 'holy', size: 6.5, from: [n.pos.x + n.body.facing * 1.2, 2.2, n.pos.y + 0.1], to: () => fight.bossPoint(2.2), speed: 15,
        onHit: (at) => {
          hit(20, at);
          fx.add(new Burst(fx, { school: 'holy', at: [at.x, at.y, at.z], size: 3.2, sparks: 40 }));
          if (!b.mind?.lying) {
            interrupt(fight, b);
            statusOf(b).stunUntil = fight.clock + 5;
          }
          fight.ctx.rig?.shake?.(0.3);
        },
      }));
    },
  },
  ronin: {
    name: 'Iaijutsu', pose: ['kneel'],
    run({ fight, fx, n, b, hit }) {
      // he holds still while the cuts are made: from every side through him, a blink each
      const s = statusOf(b);
      s.holdUntil = fight.clock + 3.2;
      interrupt(fight, b);
      const home = n.pos.clone();
      const c = new THREE.Vector2(b.pos.x, b.pos.y);
      const R = 3;
      const ways = [0, Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, (5 * Math.PI) / 4, (3 * Math.PI) / 4, -Math.PI / 4];
      const PASS = 0.13;
      const GAP = 0.06;
      const cuts = [];
      let t = 0;
      let done = false;
      n.action = { kind: 'ult', anim: 'hammer', t: 0, dur: ways.length * (PASS + GAP) + 1.1 };
      fx.add(effect((dt) => {
        t += dt;
        const i = Math.floor(t / (PASS + GAP));
        if (i < ways.length) {
          const a = ways[i];
          const p = new THREE.Vector2(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R * 0.6);
          const q = new THREE.Vector2(c.x - Math.cos(a) * R, c.y - Math.sin(a) * R * 0.6);
          const k = Math.min(1, (t - i * (PASS + GAP)) / PASS);
          n.pos.set(p.x + (q.x - p.x) * k, p.y + (q.y - p.y) * k);
          n.body.facing = q.x >= p.x ? 1 : -1;
          n.body.play('hammer');
          if (!cuts[i]) {
            // (each cut drawn across him at the angle of its pass, in front of him)
            const ax = Math.cos(a) * R;
            const ay = Math.sin(a) * 1.6;
            cuts[i] = new Cut(fx, { a: [c.x + ax, 2 + ay, c.y + 0.4], b: [c.x - ax, 2 - ay, c.y + 0.4] });
            fx.add(cuts[i]);
          }
          if (Math.random() < dt * 60) {
            fx.particles.emit({
              pos: [n.pos.x, 1.2, n.pos.y], spread: [0.1, 0.5, 0.1], vel: [0, 0.2, 0], velSpread: [0.2, 0.2, 0.2],
              color: ['#ffffff', '#d8ecff'], size: 0.07, life: 0.25, count: 3, drag: 2, intensity: 2.4,
            });
          }
          return true;
        }
        // back where he began, the blade sheathed: and only now it all lands
        const after = t - ways.length * (PASS + GAP);
        n.pos.lerp(home, Math.min(1, dt * 14));
        n.body.facing = c.x >= n.pos.x ? 1 : -1;
        n.body.play('idle');
        if (after < 0.55) return true;
        if (!done) {
          done = true;
          for (const cut of cuts) cut.flare();
          hit(32, new THREE.Vector3(c.x, 2, c.y));
          fx.add(new Burst(fx, { school: 'steel', at: [c.x, 2, c.y], size: 5, sparks: 70 }));
          fight.ctx.rig?.shake?.(0.6);
        }
        return false;
      }));
    },
  },
  bandit: {
    name: 'Tenfold Spears', pose: ['hammer', 1], aim: true,
    run({ fight, fx, n, b, dir, hit }) {
      // does his line cross him?
      const along = (b.pos.x - n.pos.x) * dir[0] + (b.pos.y - n.pos.y) * dir[1];
      const off = Math.abs((b.pos.x - n.pos.x) * dir[1] - (b.pos.y - n.pos.y) * dir[0]);
      const onLine = along > 0.5 && along < 16 && off < 1.9;
      const facing = dir[0] || n.body.facing;
      for (let i = 0; i < 10; i++) {
        const oy = 1.1 + (i % 4) * 0.45;
        const oz = ((i % 3) - 1) * 0.25;
        const from = [n.pos.x + dir[0] * 0.6, 1.5 + (i % 3) * 0.2, n.pos.y + dir[1] * 0.6 + oz];
        fx.add(new Missile(fx, {
          map: TEX.spear(), w: 2.1, h: 2.1 * 9 / 70, from, speed: 20, delay: i * 0.07, life: onLine ? 3 : 1.1,
          to: onLine ? () => [b.pos.x - facing * 0.5, b.lift + oy, b.pos.y + oz] : null, dir: onLine ? null : dir, turn: 6, near: 0.3,
          onHit: () => {
            hit(0.8, new THREE.Vector3(b.pos.x, oy, b.pos.y));
            addDot(b, { kind: 'poison', dps: 3, until: fight.clock + 4, src: n });
            fx.add(new StuckSpear(fx, { follow: () => [b.pos.x, b.lift, b.pos.y], off: [-facing * 0.9, oy, oz + 0.2], dir: facing, until: 4 }));
          },
        }));
      }
    },
  },
  fortuna: {
    name: 'Frostfall', pose: ['ult'],
    run({ fx, n, b, hit }) {
      // (her great icicles, drawn as tall as she is at her own pixel size, shattering at twice it)
      const px = n.body.sheet.px;
      const icicle = TEX.shard('frost', 34, 6);
      [0, 0.35, 0.7, 1.05].forEach((delay, i) => {
        const x = b.pos.x + (i - 1.5) * 0.6;
        const z = b.pos.y + (i % 2 ? 0.3 : -0.2);
        const d = new Drop(fx, {
          school: 'frost', x, z, art: 'fortuna-icicle', px, shatter: 'fortuna-shatter', shatterPx: px * 2,
          map: icicle, w: 3.4, h: 0.68, span: 3.4, height: 6.5, dur: 0.5, delay,
          onHit: (at) => hit(i === 3 ? 11.5 : 5.5, at),
        });
        if (!d.drawn) d.mesh.rotation.z = -Math.PI / 2; // (the shard points along x: turned to point down)
        fx.add(d);
      });
    },
  },
};

// ---------------------------------------------------------------------------------------------

export class Ults {
  constructor(ctx) {
    this.ctx = ctx;
    // its own motes: they go on while the world stands still
    this.particles = new Particles(ctx.scene, 800);
    this.active = null; // { n, u, key, t, dir, player, aura, released, saved }
    this.lastEnd = -Infinity;
    this.clock = 0;
    const el = document.getElementById('ult-title');
    this.title = { el, who: el?.querySelector('.who'), name: el?.querySelector('.name') };
  }

  // The world stands still (main.js): from the moment one is loosed till it strikes.
  get frozen() { return !!this.active && !this.active.released; }

  // What n's ultimate is, if it has one.
  of(n) { return ULTS[heroKey(n)] || null; }

  // Whether n may loose its ultimate now (`player`: thou, who wait on nobody's but one under way).
  ready(n, player = false) {
    const f = this.ctx.fight;
    const b = f?.boss;
    if (this.active || !b || !b.alive || b.state === 'enter' || f.state !== 'fighting' || !this.of(n)) return false;
    if (n.dead || n.travel || n.fighter?.dead) return false;
    return player || this.clock - this.lastEnd >= ULT.gap;
  }

  // n looses its ultimate (`dir` [dx, dz]: the way an aimed one goes).
  start(n, { dir = null, player = false } = {}) {
    const u = this.of(n);
    const { fight, post, rig } = this.ctx;
    const b = fight.boss;
    if (!u || !b) return false;
    if (u.aim && !dir) dir = [Math.sign(b.pos.x - n.pos.x) || n.body.facing, 0];
    n.body.facing = dir?.[0] ? (dir[0] > 0 ? 1 : -1) : b.pos.x >= n.pos.x ? 1 : -1;
    // nobody watching (thou art not on the arena, fallen and resting at the Hold): it's simply
    // loosed, the world going on as it was
    if (!player && !fight.facing(this.ctx.pilot.npc)) {
      if (n.fighter) n.fighter.ult = 0;
      u.run({ fight, fx: fight.fxCtx, n, b, dir, hit: (share, at) => fight.ultHit(n, share * ultPower(b), at) });
      this.lastEnd = this.clock;
      return true;
    }
    n.action = { kind: 'ult', anim: u.pose[0], t: 0, dur: Infinity };
    n.body.play(u.pose[0], true);
    const key = heroKey(n);
    const color = styleOf(n).color;
    const aura = new Aura(this.ctx.scene, this.particles, n.body, color, { radius: key === 'sorceress' ? 4.5 : 2.5 });
    const tall = Math.max(2.5, poseHeight(n.body, u.pose[0]));
    this.active = { n, u, key, t: 0, dir, player, aura, released: false, saved: rig.distGoal, tall };
    // (everyone else, and him, hide it where they stand in front of it: they stay grey)
    const others = [...this.ctx.director.npcs.values()].filter((o) => o !== n && !o.dead && o.body?.mesh).map((o) => o.body.mesh);
    post.spot = { desat: 0, meshes: [n.body.mesh, ...aura.meshes, this.particles.points], occluders: [...others, b.body.mesh] };
    if (player) this.ctx.pilot.ult = 0;
    else if (n.fighter) n.fighter.ult = 0;
    if (this.title.el) {
      this.title.who.textContent = n.name.first;
      this.title.name.textContent = u.name;
      this.title.el.style.setProperty('--ult', color);
      this.title.el.hidden = false;
      this.title.el.classList.remove('out');
    }
    this.ctx.ui.log(`${n.name.first} looses ${u.name}`, 'gold', { region: this.ctx.world.arena });
    return true;
  }

  // Where the camera looks, while it's on whoever looses one: their middle, close (a tall pose, a
  // little below its middle, from far enough back to show it whole above the bars at the bottom).
  shot() {
    const a = this.active;
    if (!a || a.released) return null;
    const p = a.n.pos;
    return { at: [p.x, Math.max(1.25, a.tall * 0.42) + (a.n.lift || 0), p.y], dist: Math.max(CINE.close, a.tall * CINE.fit) };
  }

  update(dt) {
    this.clock += dt;
    this.particles.update(dt, this.clock);
    const a = this.active;
    if (!a) return;
    const { post, rig, fight } = this.ctx;
    // (the fight over, or they've gone: it ends here)
    if (!fight.boss || a.n.dead || !a.n.body?.mesh?.parent) { this.finish(); return; }
    a.t += dt;
    if (!a.released) {
      rig.distGoal = this.shot().dist;
      const [anim, hold] = a.u.pose;
      const body = a.n.body;
      if (hold != null) {
        body.play(anim);
        const frames = body.sheet.anims[anim]?.frames || [];
        body.setFrame(frames[Math.min(hold, frames.length - 1)] ?? 0, body.facing);
      } else {
        body.play(anim);
        body.tick(dt);
      }
      if (a.t >= CINE.release) this.release(a);
    }
    post.spot.desat = a.released ? Math.max(0, 1 - (a.t - CINE.release) / CINE.back) : Math.min(1, a.t / CINE.grey);
    a.aura.step(dt, a.t > CINE.aura && a.t < CINE.release + 0.25 ? 1 : 0);
    if (a.released && a.t >= CINE.release + CINE.back + 0.2) this.finish();
  }

  // It strikes: the world moves again.
  release(a) {
    a.released = true;
    const { fight, rig } = this.ctx;
    rig.distGoal = a.saved;
    if (this.title.el) this.title.el.classList.add('out');
    const b = fight.boss;
    const n = a.n;
    // (the pose held: let go of it, unless the ultimate carries them on itself)
    n.action = { kind: 'ult', anim: a.u.pose[0], t: 0, dur: 0.35 };
    if (!b || !b.alive) return;
    const power = ultPower(b, a.player);
    a.u.run({ fight, fx: fight.fxCtx, n, b, dir: a.dir, hit: (share, at) => fight.ultHit(n, share * power, at) });
    rig.shake?.(0.15);
  }

  finish() {
    const a = this.active;
    if (!a) return;
    a.aura.dispose();
    this.ctx.post.spot = null;
    if (!a.released) this.ctx.rig.distGoal = a.saved;
    if (a.n.action?.kind === 'ult' && a.n.action.dur === Infinity) a.n.action = null;
    if (this.title.el) this.title.el.hidden = true;
    this.lastEnd = this.clock;
    this.active = null;
  }
}
