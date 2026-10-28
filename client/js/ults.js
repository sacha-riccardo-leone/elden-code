// Ultimates, in a fight with a great enemy (fight.js). Every blow a Tarnished lands fills its
// ultimate (combat.js, ULT); full, it may loose it: thou with R, the others when they see fit (a
// while apart, never two at once). As one is loosed the world stands still and turns grey, all but
// whoever looses it; the camera closes on them and an aura of their own light shines round them;
// then they strike, and the world moves and colours again (about two seconds in all).
//
// Some are aimed: loosed the way thou pointest (anyone else's, straight at him), they find him
// only if he stands on their line, or near it; the rest find him wherever he is. (The Guardian
// Golem lying felled, they all go to the fire in his chest (fight.bossPoint); loosed at him as he
// stands, one hurts him no more than a blow on his ankle: golem.js.)
// Those training on the yard loose theirs now and then at their dummies, quietly (startQuiet): in
// their pose, their aura round them, as long as ever, but the world goes on, in its colours, and
// the camera stays where it is, not even jolted.
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
//   Wynn, the Ronin      – Iaijutsu: a breath, the blade loosed with a glare, then cut after cut
//                          through him from every side as he stands held; nothing, till, his back
//                          to him, the blade is sheathed: then all at once
//   Ulric                – Tenfold Spears (aimed): ten spears that stick in him, poisoned, then
//                          fall away
//   Fortuna              – Frostfall: three great icicles dropping on him one after another,
//                          then a huge mass of ice, taller than he is

import * as THREE from 'three';
import { Particles } from './particles.js';
import { Aura, Stand, Missile, Wall, Pool, Slash, Cut, Drop, Bolt, Burst, StuckSpear, Splash, TEX, motesOf, shine } from './spellfx.js';
import { ULT, ultPower, heroKey, styleOf, muzzleOf, statusOf, addDot, interrupt, meets, AIM, struckOf, bodyOf } from './combat.js';
import { lookOf, fxArt } from './fxart.js';
import { groundAt } from './ground.js';

// The moments of one: grey within `grey`, the aura from `aura`, the blow at `release` (or its own
// `at`), colour back within `back` of it; the camera this close meanwhile (or as far back as a tall
// pose needs to be seen whole: `fit` world units away for each unit of its height).
const CINE = { grey: 0.3, aura: 0.45, release: 1.85, back: 0.55, close: 7.5, fit: 2.6, side: 0.35 };
// An ultimate's own music (its `theme`: Aurelion's): how long it goes on once its blow has struck,
// and how long it takes to die away then (s).
const THEME = { after: 0.25, fade: 0.6 };

const rand = (a, b) => a + Math.random() * (b - a);

// The light Maren's bolts give off as they strike (spellfx.js, Bolt; world.flash): a red flash
// over the floor and everyone near, flickering out; the great bolt's far brighter, farther and
// longer.
const RED_STORM = {
  bolt: { color: '#ff4a3a', power: 80, reach: 18, life: 0.32, flicker: 1, up: 2 },
  great: { color: '#ff5a44', power: 280, reach: 40, life: 0.8, flicker: 2, up: 3 },
};
// And the golden explosion Ruadan's maul raises (spellfx.js, Splash): a great flash, flickering.
const RUADAN_LIGHT = { color: '#ffc040', power: 180, reach: 30, life: 0.8, flicker: 1, rise: 0.04 };

// How tall a pose stands (the frames of `anim` on body's sheet): from the feet to the top of the
// drawing, in world units (a spear raised to the sky counts).
function poseHeight(body, anim) {
  const s = body.sheet;
  let tall = 0;
  for (const i of s.anims[anim]?.frames || []) {
    const FH = s.slots?.[i]?.big ? s.big.frameH : s.frameH;
    tall = Math.max(tall, (FH - (s.tops?.[i] ?? 0)) * s.px);
  }
  return tall;
}

// How far a pose reaches behind and ahead of whoever holds it (the frames of `anim` on body's
// sheet, facing right), from their middle, in world units.
function poseSpan(body, anim) {
  const s = body.sheet;
  let behind = 0;
  let ahead = 0;
  for (const i of s.anims[anim]?.frames || []) {
    const grid = s.slots?.[i]?.big ? s.big : s;
    const [lo, hi] = s.spans?.[i] || [0, grid.frameW - 1];
    const mid = grid.anchor ?? grid.frameW / 2;
    behind = Math.max(behind, (mid - lo) * s.px);
    ahead = Math.max(ahead, (hi + 1 - mid) * s.px);
  }
  return [behind, ahead];
}

// The pose an ultimate is held in, on n's sheet: its own (pose), or, on a sheet without it (a hero
// of two looks drawn in one of them only), the one it falls back on.
const poseOf = (u, n) => (n.body.sheet.anims[u.pose[0]] ? u.pose : u.fallback || ['send']);

// what runs as a fight effect (fight.fx): step(dt) → still going?
const effect = (step, dispose = () => {}) => ({ step, dispose });

// The way from n straight at b, [dx, dz] (an aimed one loosed by anyone but thee).
function straightAt(n, b) {
  const dx = b.pos.x - n.pos.x;
  const dz = b.pos.y - n.pos.y;
  const d = Math.hypot(dx, dz);
  return d > 0.05 ? [dx / d, dz / d] : [n.body.facing, 0];
}

// ---------------------------------------------------------------------------------------------
// each one: its name, the pose held as it gathers (an animation, and a frame to hold, or none to
// play it), the pose it's loosed in (`release`: an animation, drawn; else the held one is let go),
// when it's loosed (`at`, seconds in, if not at CINE.release), a giant of their own light behind
// them (`stand`: { scale }, spellfx.js), whether it's aimed, what's heard of it (`heard`, audio.js:
// as it begins, as the camera closes, as the giant rises and strikes, and as it's loosed, `loose`,
// begun `lead` seconds before so that it's at its loudest then), and what it does (u: { fight, fx,
// n, b, dir, hit(share, at, last) }: `last` false for each of its blows but its last, which the
// tutorial's great dummy breaks on, training.js)

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
        fight.ctx.sound?.play('runelord-book', { at: [from[0], from[2]], delay: i * 0.11 }); // (as it springs up: audio.js)
        fx.add(new Missile(fx, {
          ...look, upright: true, from,
          to: () => fight.bossPoint(up), speed: 8.5, turn: 4, rise: 2.5, delay: i * 0.11, life: 5, trail: motesOf('rune'), light: shine('rune', 8, 7),
          onHit: (at) => {
            hit(3.2, at, i === 6);
            fight.ctx.sound?.play('runelord-book-hit', { at: [at.x, at.z] }); // (striking: audio.js)
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
    // (her drawn pose is masked, as she fights; bare-faced she raises the staff as she casts)
    name: 'Glintstone Arrow', pose: ['ult'], fallback: ['cast'],
    // (as it begins, and the arrow loosed: its sound begun a moment before, so that it's at its
    // loudest, 0.13 s into its clip, as the arrow leaves her: cut-sfx.mjs)
    heard: { start: 'sorceress-ult-start', loose: 'sorceress-ult-loose' }, lead: 0.13,
    run({ fight, fx, n, hit }) {
      // (the arrow drawn at her own pixel size, laid along the staff she aims like a bow, its head
      // at the crystal, and loosed; it keeps upright, its light on top)
      const look = lookOf('corisande-arrow', n.body.sheet.px, { map: TEX.arrow(), w: 2.1, h: 0.69 });
      const [x, y, z] = muzzleOf(n, 'ult');
      fx.add(new Missile(fx, {
        ...look, upright: true, from: [x - n.body.facing * look.w * 0.45, y, z], to: () => fight.bossPoint(2), speed: 14, turn: 3, life: 4,
        trail: [...motesOf('glintstone'), '#ffffff'], trailRate: 160, trailSize: 0.09, light: shine('glintstone', 45, 15),
        onHit: (at) => {
          hit(22, at);
          fight.ctx.sound?.play('sorceress-ult-hit', { at: [at.x, at.z] });
          fx.add(new Burst(fx, { school: 'glintstone', at: [at.x, at.y, at.z], size: 4, sparks: 60 }));
          fight.ctx.rig?.shake?.(0.35);
        },
      }));
    },
  },
  bloodbender: {
    name: 'Crimson Mire', pose: ['ult'],
    heard: { start: 'bloodbender-ult-start' }, // (her heart beating as she gathers it: audio.js)
    run({ fight, fx, n, b }) {
      const now = fight.clock;
      const r = 3.2;
      fx.add(new Pool(fx, { x: b.pos.x, z: b.pos.y, r, life: 7, art: 'vael-pool' }));
      fight.ctx.sound?.play('bloodbender-ult-pool', { at: [b.pos.x, b.pos.y] }); // (bubbling as long as it lasts)
      const s = statusOf(b);
      s.slowUntil = now + 7;
      s.slow = 0.35;
      s.rootUntil = now + 7;
      s.root = { x: b.pos.x, z: b.pos.y, r: r - 0.9 };
      addDot(b, { kind: 'bleed', dps: 14, until: now + 11, src: n, heard: 'bloodbender-ult-hit' }); // (a wound of it heard about once a second)
      fx.particles.emit({
        pos: [b.pos.x, 0.3, b.pos.y], spread: [1.6, 0.1, 1.2], vel: [0, 2.2, 0], velSpread: [1.2, 1.2, 1],
        color: motesOf('blood'), size: 0.09, life: 0.8, count: 50, drag: 1.2, gravity: 3, intensity: 2,
      });
    },
  },
  queen: {
    // (wound up, the light gathered between her palms, and loosed, thrust out: drawn; else she
    // raises her ring)
    name: 'Wall of Dawn', pose: ['ult'], fallback: ['send'], release: 'loose', aim: true,
    heard: { start: 'holy-ult-start' }, // (as it begins: audio.js)
    run({ fight, fx, n, b, dir, hit }) {
      // it strikes him if it reaches him in its lane (any way it goes); drawn, it leaves her palms
      // (heard rushing out, and striking him: audio.js)
      const lane = 2.4;
      const [ahead] = n.body.sheet.rig.muzzles?.ult || [0.8];
      fight.ctx.sound?.play('holy-ult-wall', { at: [n.pos.x + dir[0] * ahead, n.pos.y + dir[1] * ahead] });
      fx.add(new Wall(fx, {
        x: n.pos.x + dir[0] * ahead, z: n.pos.y + dir[1] * ahead, dir, art: 'solenne-wall', height: 4.2,
        // (the felled Golem: at his chest, fight.bossPoint)
        hits: (x, z) => {
          if (!b.alive) return false;
          const dx = fight.bossPoint()[0] - x;
          const dz = b.pos.y - z;
          return Math.abs(dx * dir[1] - dz * dir[0]) < lane && dx * dir[0] + dz * dir[1] < 0.6;
        },
        onHit: (at) => {
          hit(26, at);
          const [mx, my] = fight.bossPoint(2);
          fight.ctx.sound?.play('holy-ult-hit', { at: [mx, b.pos.y] });
          fx.add(new Burst(fx, { school: 'holy', at: [mx, my, b.pos.y], size: 4, sparks: 50 }));
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
    // (gathering himself in a crouch, leaping with the maul raised, the slam, and the golden
    // explosion it raises: drawn; else frames of his own blow, and bursts of light)
    name: 'Hammerfall', pose: ['crouch'], fallback: ['hammer', 1],
    // (his leap: its sound begun a moment before he springs, so that it's at its loudest, 0.22 s
    // into its clip, as he does: cut-sfx.mjs)
    heard: { loose: 'champion-jump' }, lead: 0.22,
    run({ fight, fx, n, b, hit }) {
      // up, and down onto his feet: a leap the fight's own effects carry him through (beside the
      // felled Golem's chest, fight.bossPoint)
      const from = n.pos.clone();
      const [mx] = fight.bossPoint();
      const side = Math.sign(n.pos.x - mx) || 1;
      const to = new THREE.Vector2(mx + side * (b.kind.radius * 0.6 + 0.6), b.pos.y + 0.2);
      const dur = 0.9;
      const H = 4.2;
      let t = 0;
      const { anims, px } = n.body.sheet;
      const drawn = !!(anims.airborne && anims.slam);
      n.action = { kind: 'ult', anim: drawn ? 'airborne' : 'hammer', t: 0, dur: dur + (drawn ? 0.75 : 0.5) };
      n.body.facing = -side;
      fx.add(effect((dt) => {
        t += dt;
        const k = Math.min(1, t / dur);
        // a long climb, a swift fall
        n.ultLift = k < 0.62 ? H * (1 - (1 - k / 0.62) ** 2) : H * (1 - ((k - 0.62) / 0.38) ** 2);
        const e = k < 0.62 ? 0.5 * (k / 0.62) : 0.5 + 0.5 * ((k - 0.62) / 0.38);
        n.pos.set(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
        // (in the air, the maul raised over him: drawn; else raised high on the way up and coming
        // down on the way down, frames of his own blow)
        const blow = anims.hammer?.frames || [];
        if (drawn) n.body.setFrame(anims.airborne.frames[0], n.body.facing);
        else if (blow.length) n.body.setFrame(blow[Math.min(blow.length - 1, k < 0.62 ? 1 : 2)], n.body.facing);
        if (k < 1) return true;
        n.ultLift = null;
        hit(28, new THREE.Vector3(to.x, 1, to.y));
        fight.ctx.sound?.play('champion-land', { at: [to.x, to.y] });
        if (drawn) {
          // he lands kneeling, the maul driven into the floor before him; where its head strikes, the
          // ground explodes in gold, stones flying (drawn, its pixels twice his; just behind him, so
          // that he's seen kneeling in front of it)
          n.action = { kind: 'ult', anim: 'slam', t: 0, dur: 0.75 };
          n.body.play('slam', true);
          const head = [to.x + n.body.facing * 37 * px, to.y - 0.25];
          if (fxArt('ruadan-explosion')) fx.add(new Splash(fx, { art: 'ruadan-explosion', x: head[0], z: head[1], px: px * 2, fps: 10, light: RUADAN_LIGHT }));
          else fx.add(new Burst(fx, { school: 'holy', at: [head[0], 0.9, head[1]], size: 5.5, sparks: 80 }));
          fx.add(new Burst(fx, { school: 'holy', at: [head[0], 0.6, head[1]], size: 2.6, ring: false, sparks: 50 }));
        } else {
          fx.add(new Burst(fx, { school: 'holy', at: [to.x, 0.9, to.y], size: 5.5, sparks: 80 }));
          fx.add(new Burst(fx, { school: 'rune', at: [to.x, 1.6, to.y], size: 3.6, ring: false, sparks: 40 }));
        }
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
    heard: { zoom: 'knight-ult-zoom' }, // (the camera closing on her)
    run({ fight, fx, b, hit }) {
      let t = 0;
      let k = 0;
      const times = Array.from({ length: 12 }, (_, i) => 0.05 + i * 0.14 + rand(0, 0.05));
      fx.add(effect((dt) => {
        t += dt;
        // (round the felled Golem's chest, fight.bossPoint)
        const [mx] = fight.bossPoint();
        while (k < times.length && t >= times[k]) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * 2.6;
          // (her bolts, drawn at twice her own pixel size: tall enough to fall from out of sight)
          fx.add(new Bolt(fx, { x: mx + Math.cos(a) * r, z: b.pos.y + Math.sin(a) * r * 0.7, k, life: 0.3, art: 'maren-bolt', px: 0.06, light: RED_STORM.bolt, onHit: (at) => hit(1, at, false) }));
          fight.ctx.sound?.play('knight-bolt', { at: [mx, b.pos.y] });
          fight.ctx.rig?.shake?.(0.12);
          k += 1;
        }
        if (t < 2) return true;
        fx.add(new Bolt(fx, { x: mx, z: b.pos.y + 0.1, wide: true, height: 18, life: 0.5, art: 'maren-great-bolt', px: 0.075, light: RED_STORM.great, onHit: (at) => hit(14, at) }));
        fight.ctx.sound?.play('knight-great', { at: [mx, b.pos.y] });
        fx.add(new Burst(fx, { school: 'storm', at: [mx, 1.5, b.pos.y], size: 4.4, sparks: 70, light: false })); // (the great bolt's own light is there)
        fight.ctx.rig?.shake?.(0.75);
        return false;
      }));
    },
  },
  paladin: {
    // (he strikes his pose, drawn, and holds it; behind him a giant of his own light swings the
    // Verdict: the giant blade of light raised back over its shoulder, then the sweep it ends in,
    // `stand`; else he raises his sword to the sky, the giant raising its own as he does)
    name: 'Radiant Verdict', pose: ['pose'], fallback: ['send'], release: 'pose', stand: { scale: 1.8, gather: 'ult', release: 'sweep' },
    heard: { start: 'paladin-ult', stand: 'paladin-stand', strike: 'paladin-stand-hit' }, // (as it's loosed, as the giant rises, and as it strikes: audio.js)
    theme: 'paladin-theme', // (his own music, from the moment it's loosed: Ults.theme)
    run({ fight, fx, n, b, hit, theme }) {
      // drawn, the wave leaves the giant's blade swept low ahead of him (never from past the enemy)
      const drawn = !!n.body.sheet.anims.sweep;
      const [ahead] = (drawn && n.body.sheet.rig.muzzles?.ult) || [1.2];
      const lead = Math.max(0.6, Math.min(ahead * (drawn ? this.stand.scale : 1), Math.abs(fight.bossPoint()[0] - n.pos.x) - 0.8));
      fx.add(new Slash(fx, {
        school: 'holy', size: 6.5, art: drawn ? 'aurelion-wave' : null, px: 0.031,
        from: [n.pos.x + n.body.facing * lead, 2.2, n.pos.y + 0.1], to: () => fight.bossPoint(2.2), speed: 15,
        onHit: (at) => {
          hit(20, at);
          theme?.stop(THEME.fade, THEME.after); // (struck: his music goes on a moment, and dies away)
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
    // (as it's loosed, the drawing stance, half a second, then his blade loosed from the scabbard a
    // hand's breadth, a glare flashing on it, half a second, and only then the cuts; the dash,
    // every pass; back where he began, turned the other way, the blade loosed again, the glare,
    // and home in its scabbard with all of it landing: drawn; else his kneel, his own blow, and
    // standing)
    name: 'Iaijutsu', pose: ['draw'], fallback: ['kneel'], at: 1,
    run({ fight, fx, n, b, hit }) {
      // he holds still while the cuts are made: from every side through him, a blink each
      const s = statusOf(b);
      s.holdUntil = fight.clock + 3.2;
      interrupt(fight, b);
      const home = n.pos.clone();
      const facing = n.body.facing; // (the way he faced as he drew; he ends turned from it)
      const c = new THREE.Vector2(fight.bossPoint()[0], b.pos.y); // (the felled Golem: about his chest)
      const R = 3;
      const ways = [0, Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, (5 * Math.PI) / 4, (3 * Math.PI) / 4, -Math.PI / 4];
      const PASS = 0.08; // (each pass through him, and the breath before the next: eight in 0.9 s)
      const GAP = 0.03;
      const LOOSED = 0.5; // (back home, the blade loosed this long before it's home in its scabbard)
      const HELD = 0.6; // (and the stance held this long after)
      const cuts = [];
      let t = 0;
      let done = false;
      const { anims } = n.body.sheet;
      const drawn = !!(anims.dash && anims.loosed);
      const pass = drawn ? 'dash' : 'hammer';
      n.action = { kind: 'ult', anim: pass, t: 0, dur: ways.length * (PASS + GAP) + LOOSED + HELD };
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
          n.body.play(pass);
          if (!cuts[i]) {
            // (each cut drawn across him at the angle of its pass, in front of him: drawn, Sacha's
            // cuts at twice his pixel size; and heard, audio.js)
            const ax = Math.cos(a) * R;
            const ay = Math.sin(a) * 1.6;
            cuts[i] = new Cut(fx, { a: [c.x + ax, 2 + ay, c.y + 0.4], b: [c.x - ax, 2 - ay, c.y + 0.4], art: 'wynn-cuts', px: n.body.sheet.px * 2 });
            fx.add(cuts[i]);
            fight.ctx.sound?.play('ronin-cut', { at: [c.x, c.y] });
          }
          if (Math.random() < dt * 60) {
            fx.particles.emit({
              pos: [n.pos.x, 1.2, n.pos.y], spread: [0.1, 0.5, 0.1], vel: [0, 0.2, 0], velSpread: [0.2, 0.2, 0.2],
              color: ['#ffffff', '#d8ecff'], size: 0.07, life: 0.25, count: 3, drag: 2, intensity: 2.4,
            });
          }
          return true;
        }
        // back where he began, turned the other way, the blade loosed, the glare on it; and as it
        // goes home in its scabbard, only then it all lands
        const after = t - ways.length * (PASS + GAP);
        n.pos.lerp(home, Math.min(1, dt * 14));
        n.body.facing = -facing;
        if (after < LOOSED) {
          n.body.play(drawn ? 'loosed' : 'idle');
          return true;
        }
        n.body.play(drawn ? 'stance' : 'idle');
        if (!done) {
          done = true;
          for (const cut of cuts) cut.flare();
          fight.ctx.sound?.play('ronin-damage', { at: [c.x, c.y] }); // (heard as it lands, audio.js)
          hit(32, new THREE.Vector3(c.x, 2, c.y));
          fx.add(new Burst(fx, { school: 'steel', at: [c.x, 2, c.y], size: 5, sparks: 70 }));
          fight.ctx.rig?.shake?.(0.6);
        }
        return after < LOOSED + HELD;
      }));
    },
  },
  bandit: {
    // (the spear cocked back like a javelin, then thrown, his hand open: drawn; else his spear
    // drawn back)
    name: 'Tenfold Spears', pose: ['ult'], fallback: ['hammer', 1], release: 'throw', aim: true,
    run({ fight, fx, n, b, dir, hit }) {
      // straight along his line, each sticking in him if it comes up to him on it (or a little off
      // it: combat.js, AIM), else flying on past
      const facing = Math.sign(dir[0]) || n.body.facing;
      // drawn, they leave his open hand (the rig's muzzles: on his line, out to it, nearer him as the
      // line turns into the view or out of it), each his own spear at his own pixel size
      const sheet = n.body.sheet;
      const [ahead, up] = (sheet.anims.throw && sheet.rig.muzzles?.ult) || [0.6, 1.7];
      const reach = ahead * Math.abs(dir[0]) + 0.35 * Math.abs(dir[1]);
      const look = lookOf('ulric-spear', sheet.px, { map: TEX.spear(), w: 2.1, h: 2.1 * 9 / 70 });
      for (let i = 0; i < 10; i++) {
        const oy = 1.1 + (i % 4) * 0.45; // (how high in him it's meant to bite: it drifts to it as it flies)
        const oz = ((i % 3) - 1) * 0.25;
        const from = [n.pos.x + dir[0] * reach, up + ((i % 3) - 1) * 0.2, n.pos.y + dir[1] * reach + oz];
        fight.ctx.sound?.play('bandit-woosh', { at: [from[0], from[2]], delay: i * 0.07 }); // (as it leaves his hand)
        fx.add(new Missile(fx, {
          ...look, from, dir, guide: { from: [from[0], oy, from[2]], dir }, speed: 20, delay: i * 0.07, life: 0.8, turn: 6,
          strike: (x, z) => {
            if (!b.alive) return null;
            const o = bodyOf(b); // (the felled Golem: about his chest, and they go there)
            return meets(x, z, dir, o.x, o.z, o.rx, o.rz, AIM.spell, AIM.early) ? struckOf(b) : null;
          },
          land: 0.9, // (onto his drawing, its point in him: spellfx.js, pinOn)
          onHit: (at, struck, pin) => {
            hit(0.8, new THREE.Vector3(at.x, at.y, at.z), i === 9);
            fight.ctx.sound?.play('bandit-hit', { at: [at.x, at.z] }); // (biting: audio.js)
            addDot(b, { kind: 'poison', dps: 3, until: fight.clock + 4, src: n });
            // (stuck in his drawing, moving and turning with it; else where it bit, moving with him)
            if (pin) fx.add(new StuckSpear(fx, { pin, dir: facing, until: 4, look }));
            else fx.add(new StuckSpear(fx, { follow: () => [b.pos.x, b.lift || 0, b.pos.y], off: [at.x - b.pos.x, at.y - (b.lift || 0), at.z - b.pos.y + 0.2], dir: facing, way: dir, until: 4, look }));
          },
        }));
      }
    },
  },
  fortuna: {
    name: 'Frostfall', pose: ['ult'],
    heard: { start: 'frost-ult-start' }, // (swelling as she gathers it, at its loudest as she looses it: audio.js)
    run({ fight, fx, n, b, hit }) {
      // (her great icicles, drawn as tall as she is at her own pixel size, shattering at twice it;
      // and, a beat after them, a mass of ice HUGE times that, taller than him, coming down slower
      // onto his middle, driven into the floor a moment, then bursting wide)
      const px = n.body.sheet.px;
      const icicle = TEX.shard('frost', 34, 6);
      const HUGE = 3.2;
      const [mx] = fight.bossPoint(); // (onto the felled Golem's chest)
      [0, 0.35, 0.7, 1.3].forEach((delay, i) => {
        const huge = i === 3;
        const s = huge ? HUGE : 1;
        const x = huge ? mx : mx + (i - 1) * 0.7;
        const z = b.pos.y + (huge ? 0.25 : i % 2 ? 0.3 : -0.2);
        const d = new Drop(fx, {
          school: 'frost', x, z, art: 'fortuna-icicle', px: px * s, shatter: 'fortuna-shatter', shatterPx: px * (huge ? 4.5 : 2),
          map: icicle, w: 3.4 * s, h: 0.68 * s, span: 3.4 * s, height: huge ? 9.5 : 6.5, dur: huge ? 0.85 : 0.5, delay,
          stick: huge ? 0.4 : 0, sink: 0.9,
          onHit: (at) => {
            hit(huge ? 11.5 : 5.5, at, false); // (the mass wounds him again as it bursts, the last: onShatter)
            if (!huge) { fight.ctx.sound?.play('frost-icicle', { at: [x, z] }); return; } // (shattering: audio.js)
            // (the floor struck: a flash and chips of stone and ice at its foot)
            fx.add(new Burst(fx, { school: 'frost', at: [x, 0.3, z], size: 2.6, sparks: 30 }));
            fx.particles.emit({
              pos: [x, 0.2, z], spread: [0.8, 0.1, 0.4], vel: [0, 2.4, 0], velSpread: [3, 1.4, 1.4],
              color: ['#7a6a5c', '#cff2ff', '#9a8a78'], size: 0.1, life: 0.7, count: 30, gravity: 12, drag: 0.4, intensity: 0.9,
            });
            fight.ctx.rig?.shake?.(0.7);
          },
          // (and, as it bursts, its ice flung out every way)
          onShatter: huge ? () => {
            hit(11.5, new THREE.Vector3(x, 1.6, z), true); // (and again, on the very moment it bursts)
            fight.ctx.sound?.play('frost-ult-end', { at: [x, z] });
            fx.add(new Burst(fx, { school: 'frost', at: [x, 1.6, z], size: 4.5, sparks: 70 }));
            fx.particles.emit({
              pos: [x, 2, z], spread: [0.8, 1.6, 0.5], vel: [0, 3.5, 0], velSpread: [5, 3, 2.4],
              color: ['#ffffff', '#cff2ff', '#8fe0ff', '#4a9ee0'], size: 0.16, life: 1.1, count: 70, gravity: 14, drag: 0.3, intensity: 1.6,
            });
            fight.ctx.rig?.shake?.(0.4);
          } : null,
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
    this.active = null; // { n, u, key, t, at (when it is loosed), dir, player, aura, released, saved }
    this.quiet = []; // those loosed quietly (startQuiet): { n, u, pose, t, at, dir, aura, stand, place, b, released }
    this.lastEnd = -Infinity;
    this.clock = 0;
    const el = document.getElementById('ult-title');
    this.title = { el, who: el?.querySelector('.who'), name: el?.querySelector('.name') };
  }

  // The world stands still (main.js): from the moment one is loosed till it strikes.
  get frozen() { return !!this.active && !this.active.released; }

  // What n's ultimate is, if it has one.
  of(n) { return ULTS[heroKey(n)] || null; }

  // Where n looses it: the training yard below the Hold while it's on it (training.js: a dummy
  // stands in for him there), else the arena's fight.
  placeOf(n) {
    const { training, fight } = this.ctx;
    return training?.has(n) ? training : fight;
  }

  // Whether n may loose its ultimate now (`player`: thou, who wait on nobody's but one under way).
  ready(n, player = false) {
    const f = this.placeOf(n);
    const b = f?.boss;
    if (this.active || !b || !b.alive || b.state === 'enter' || f.state !== 'fighting' || !this.of(n)) return false;
    if (n.dead || n.travel || n.fighter?.dead) return false;
    if (n.maulOut) return false; // (Ruadan's maul out of his hand, thrown: combat.js)
    return player || this.clock - this.lastEnd >= ULT.gap;
  }

  // n looses its ultimate (`dir` [dx, dz]: the way an aimed one goes).
  start(n, { dir = null, player = false } = {}) {
    const u = this.of(n);
    const { post, rig } = this.ctx;
    const fight = this.placeOf(n);
    const b = fight?.boss;
    if (!u || !b) return false;
    this.heard(n, u.heard?.start);
    if (u.aim && !dir) dir = straightAt(n, b);
    n.body.facing = dir?.[0] ? (dir[0] > 0 ? 1 : -1) : b.pos.x >= n.pos.x ? 1 : -1;
    // nobody watching (thou art not on the arena, fallen and resting at the Hold): it's simply
    // loosed, the world going on as it was
    if (!player && !fight.facing(this.ctx.pilot.npc)) {
      if (n.fighter) n.fighter.ult = 0;
      this.heard(n, u.heard?.loose);
      fight.loosed?.(n); // (the Golem minds how he lies as it's loosed: golem.js)
      u.run({ fight, fx: fight.fxCtx, n, b, dir, hit: (share, at, last = true) => fight.ultHit(n, share * ultPower(b), at, { last }) });
      this.lastEnd = this.clock;
      return true;
    }
    const pose = poseOf(u, n);
    n.action = { kind: 'ult', anim: pose[0], t: 0, dur: Infinity };
    n.body.play(pose[0], true);
    const key = heroKey(n);
    const color = styleOf(n).color;
    const aura = new Aura(this.ctx.scene, this.particles, n.body, color, { radius: key === 'sorceress' ? 4.5 : 2.5 });
    const stand = u.stand ? new Stand(this.ctx.scene, n.body, u.stand) : null;
    // (the giant swings a pose of its own, drawn: Aurelion's; the camera takes that in)
    const own = stand && u.stand.gather && pose[0] === u.pose[0] && n.body.sheet.anims[u.stand.gather] ? u.stand.gather : null;
    if (own) stand.play(own);
    const tall = Math.max(2.5, poseHeight(n.body, own || pose[0]));
    const span = poseSpan(n.body, own || pose[0]);
    this.active = { n, u, pose, key, t: 0, at: u.at ?? CINE.release, dir, player, aura, stand, fight, released: false, saved: rig.distGoal, tall, span };
    this.active.still = this.ctx.sound?.play('cine-focus') || null; // (the world standing still, anyone's: audio.js)
    this.active.theme = this.theme(n, u);
    this.heard(n, u.heard?.zoom); // (the camera closing on them: shot)
    // (everyone else, and him, hide it where they stand in front of it: they stay grey)
    const others = [...this.ctx.director.npcs.values()].filter((o) => o !== n && !o.dead && o.body?.mesh).map((o) => o.body.mesh);
    post.spot = { desat: 0, meshes: [n.body.mesh, ...aura.meshes, ...(stand?.meshes || []), this.particles.points], occluders: [...others, b.body.mesh] };
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
  // little below its middle, from far enough back to show it whole above the bars at the bottom;
  // a pose too wide for that, a staff held level far out ahead, centred and taken in whole; a giant
  // of their light behind them, Aurelion's, from as far back, but with them in the middle).
  shot() {
    const a = this.active;
    if (!a || a.released) return null;
    const p = a.n.pos;
    const s = a.stand?.scale || 1;
    const tall = a.tall * s;
    let x = p.x;
    let dist = Math.max(CINE.close, tall * CINE.fit);
    const [behind, ahead] = a.span.map((v) => v * s);
    const cam = this.ctx.rig.camera;
    const across = Math.tan((cam.fov * Math.PI) / 360) * cam.aspect; // (half the width seen, per unit away)
    if (Math.max(behind, ahead) + CINE.side > dist * across) {
      if (!a.stand) x += (a.n.body.facing * (ahead - behind)) / 2;
      dist = Math.max(dist, ((behind + ahead) / 2 + CINE.side) / across);
    }
    return { at: [x, Math.max(1.25, tall * 0.42) + (a.n.lift || 0) + groundAt(p.x, p.y), p.y], dist };
  }

  // n looses its ultimate quietly (one training on the yard, training.js): at `b` (its dummy, on
  // `place`), the way `dir` says if it's aimed. It gathers in its pose with its aura round it (and
  // Aurelion's giant behind him) as long as one watched would, and strikes; but nothing stands still
  // for it, nothing goes grey, and the camera neither closes on it nor shakes.
  startQuiet(n, { place, b, dir = null }) {
    const u = this.of(n);
    if (!u || !b || n.dead) return false;
    this.heard(n, u.heard?.start);
    if (u.aim && !dir) dir = straightAt(n, b);
    n.body.facing = dir?.[0] ? (dir[0] > 0 ? 1 : -1) : b.pos.x >= n.pos.x ? 1 : -1;
    const pose = poseOf(u, n);
    const at = u.at ?? CINE.release;
    n.action = { kind: 'ult', anim: pose[0], t: 0, dur: at + 0.05 };
    n.body.play(pose[0], true);
    const aura = new Aura(this.ctx.scene, this.particles, n.body, styleOf(n).color, { radius: heroKey(n) === 'sorceress' ? 4.5 : 2.5 });
    const stand = u.stand ? new Stand(this.ctx.scene, n.body, u.stand) : null;
    const own = stand && u.stand.gather && pose[0] === u.pose[0] && n.body.sheet.anims[u.stand.gather] ? u.stand.gather : null;
    if (own) stand.play(own);
    // (what it's loosed on: its place, but with the camera left out of it, and its own dummy
    // where the place's aimed point would be)
    const quiet = Object.create(place);
    quiet.ctx = { ...place.ctx, rig: null };
    quiet.bossPoint = (up = 2) => [b.pos.x, (b.lift || 0) + up, b.pos.y + 0.2];
    this.quiet.push({ n, u, pose, t: 0, at, dir, aura, stand, place, quiet, b, released: false, theme: this.theme(n, u) });
    return true;
  }

  // A quiet one, on the world's time (`dt`: none while it stands still for thine): still while it
  // gathers (a held pose kept on its frame), then loosed, then its light fading.
  stepQuiet(q, dt) {
    const { n, u } = q;
    if (n.dead || !n.body?.mesh?.parent) {
      q.aura.dispose();
      q.stand?.dispose();
      q.theme?.stop(0.3);
      return false;
    }
    q.t += dt;
    if (!q.released) {
      const [anim, hold] = q.pose;
      if (hold != null) {
        const frames = n.body.sheet.anims[anim]?.frames || [];
        n.body.setFrame(frames[Math.min(hold, frames.length - 1)] ?? 0, n.body.facing);
      }
      if (!q.looseHeard && q.t >= q.at - (u.lead || 0)) { q.looseHeard = true; this.heard(n, u.heard?.loose); }
      if (q.t >= q.at) {
        q.released = true;
        const loose = u.release && n.body.sheet.anims[u.release] ? u.release : null;
        n.action = { kind: 'ult', anim: loose || q.pose[0], t: 0, dur: loose ? 0.6 : 0.35 };
        if (loose) n.body.play(loose, true);
        if (q.stand?.anim && u.stand.release) q.stand.play(u.stand.release);
        if (q.stand) this.heard(n, u.heard?.strike); // (and the giant strikes)
        const power = ultPower(q.b);
        u.run({ fight: q.quiet, fx: q.place.fxCtx, n, b: q.b, dir: q.dir, theme: q.theme, hit: (share, at, last = true) => q.place.ultHit(n, share * power, at, { b: q.b, last }) });
      }
    }
    q.aura.step(dt, q.t > CINE.aura && q.t < q.at + 0.25 ? 1 : 0);
    if (q.stand && !q.standHeard && q.t > CINE.grey) { q.standHeard = true; this.heard(n, u.heard?.stand); }
    q.stand?.step(dt, q.t > CINE.grey && q.t < q.at + 0.35 ? 1 : 0, n.action?.kind === 'ult');
    if (q.released && q.t >= q.at + CINE.back + 0.2) {
      q.aura.dispose();
      q.stand?.dispose();
      return false;
    }
    return true;
  }

  // (`wdt`: the world's time, standing still while an ultimate is gathered or a blow lands, for the
  // quiet ones)
  update(dt, wdt = dt) {
    this.clock += dt;
    this.particles.update(dt, this.clock);
    if (this.quiet.length) this.quiet = this.quiet.filter((q) => this.stepQuiet(q, wdt));
    const a = this.active;
    if (!a) return;
    const { post, rig } = this.ctx;
    // (the fight over, or they've gone: it ends here)
    if (!a.fight.boss || a.n.dead || !a.n.body?.mesh?.parent) { this.finish(); return; }
    a.t += dt;
    if (!a.released) {
      rig.distGoal = this.shot().dist;
      const [anim, hold] = a.pose;
      const body = a.n.body;
      if (hold != null) {
        body.play(anim);
        const frames = body.sheet.anims[anim]?.frames || [];
        body.setFrame(frames[Math.min(hold, frames.length - 1)] ?? 0, body.facing);
      } else {
        body.play(anim);
        body.tick(dt);
      }
      if (!a.looseHeard && a.t >= a.at - (a.u.lead || 0)) { a.looseHeard = true; this.heard(a.n, a.u.heard?.loose); }
      if (a.t >= a.at) this.release(a);
    }
    post.spot.desat = a.released ? Math.max(0, 1 - (a.t - a.at) / CINE.back) : Math.min(1, a.t / CINE.grey);
    a.aura.step(dt, a.t > CINE.aura && a.t < a.at + 0.25 ? 1 : 0);
    // (the giant rises as the world goes grey, swings with them, and goes once the blow is struck,
    // keeping the pose it struck in)
    if (a.stand && !a.standHeard && a.t > CINE.grey) { a.standHeard = true; this.heard(a.n, a.u.heard?.stand); }
    a.stand?.step(dt, a.t > CINE.grey && a.t < a.at + 0.35 ? 1 : 0, a.n.action?.kind === 'ult');
    if (a.released && a.t >= a.at + CINE.back + 0.2) this.finish();
  }

  // One of an ultimate's sounds (its `heard`: audio.js), where n stands.
  heard(n, name) {
    if (name) this.ctx.sound?.play(name, { at: [n.pos.x, n.pos.y] });
  }

  // Its own music, if it has one (`theme`: Aurelion's), from the moment it's loosed, the world's
  // held down meanwhile (audio.js); its run lets it go once it has struck (THEME), or it's stopped
  // if it never does.
  theme(n, u) {
    return (u.theme && this.ctx.sound?.play(u.theme, { at: [n.pos.x, n.pos.y] })) || null;
  }

  // It strikes: the world moves again.
  release(a) {
    a.released = true;
    a.still?.stop(0.1); // (the world moves again: audio.js)
    const { rig } = this.ctx;
    const { fight } = a;
    rig.distGoal = a.saved;
    if (this.title.el) this.title.el.classList.add('out');
    const b = fight.boss;
    const n = a.n;
    // (the pose held: let go of it, unless the ultimate carries them on itself; or, drawn, the
    // pose it's loosed in, held a moment)
    const loose = a.u.release && n.body.sheet.anims[a.u.release] ? a.u.release : null;
    n.action = { kind: 'ult', anim: loose || a.pose[0], t: 0, dur: loose ? 0.6 : 0.35 };
    if (loose) n.body.play(loose, true);
    if (a.stand?.anim && a.u.stand.release) a.stand.play(a.u.stand.release); // (and the giant strikes)
    if (a.stand) this.heard(n, a.u.heard?.strike);
    if (!b || !b.alive) { a.theme?.stop(0.4); return; }
    const power = ultPower(b, a.player);
    fight.loosed?.(n); // (the Golem minds how he lies as it's loosed: golem.js)
    a.u.run({ fight, fx: fight.fxCtx, n, b, dir: a.dir, theme: a.theme, hit: (share, at, last = true) => fight.ultHit(n, share * power, at, { last }) });
    rig.shake?.(0.15);
  }

  finish() {
    const a = this.active;
    if (!a) return;
    a.still?.stop(0.1);
    if (!a.released) a.theme?.stop(0.3); // (over before it struck)
    a.aura.dispose();
    a.stand?.dispose();
    this.ctx.post.spot = null;
    if (!a.released) this.ctx.rig.distGoal = a.saved;
    if (a.n.action?.kind === 'ult' && a.n.action.dur === Infinity) a.n.action = null;
    if (this.title.el) this.title.el.hidden = true;
    this.lastEnd = this.clock;
    this.active = null;
  }
}
