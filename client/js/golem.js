// The Guardian Golem's fight (fight.js hands him over to this; his drawings are heroes/golem.js).
//
// Stone turns every blow but those on his cracked ankle, low on his back leg, and those do him
// little harm. Enough of them, though (thine, and the fighters', which count for half), and the
// next time he walks the ankle gives way: he passes out and falls on his face, and for a few
// seconds the fire in his ribcage lies open, a golden circle on the floor beside it. Blows struck
// from inside the circle wound him deeply, from anywhere else not at all. Then he gets up (his fall
// played backwards), the ankle whole again.
//
// His blows are slow, and what hurts most is what they shake loose: the stone floor rippling like
// water where the axe or the pole strikes it (ripple.js), far wider than the axe, its first crest
// hurting each it reaches. Dodge through it (Space) as it reaches thee; the fighters hop it,
// mostly. (Each meteor of his fire makes a little ripple of its own, harmless.)
//   swing – the axe raised behind him and brought over and down: where it lands the stone cracks
//           and a shockwave rolls out;
//   lunge – the axe driven out at full stretch (his size gives it a great reach), and a shock in
//           the air flying on past its point;
//   slam  – the pole raised high and held two seconds, driven into the ground twice, fast, held
//           again a second and driven down a last time: three shockwaves, the last over the
//           whole arena; then he settles;
//   fire  – it begins as the slam, but the pole goes into the ground and stays there. He shakes
//           (two seconds), then spits fire from his chest while meteors rain down all over the
//           arena (five seconds, nothing hurting him meanwhile), settles, and takes up his axe.
// Hemmed in again soon after a slam, he doesn't slam again: he rolls out of the crowd into open
// ground (a somersault over his axe, blows passing over him meanwhile), and turns back on them
// with his other blows.
// He says nothing; but he's heard (audio.js; Sacha's recordings, cut and levelled: README), each sound
// on the very moment of what makes it: each foot as it's set down (the walk's frames where it lands),
// the axe or the pole raised (its whoosh) and striking (the boom), a blow his stone turns (a clang),
// his stone crumbling as he falls, passing out (two sounds, the second coming in on top of the first
// halfway through his fall, and his stone giving way as he tips over), hushed as his body hits the
// floor on the frame it does (that heard then, and his stone crumbling, the ground shaking and the
// dust flying then too), the fire roaring up as he spits it (begun a moment before, so that it's at
// its loudest as the fire comes) and burning on while he does, the swarm of meteors as it begins,
// and each meteor flung up out of him and landing.

import { ARENA } from './config.js';
import { SpriteBody } from './npc.js';
import { AirWave, Decal, Meteor, FIRE_LIGHT } from './bossfx.js';
import { flash, carry } from './lights.js';
import { addRipple, rippleAt } from './ripple.js';
import { SPOTS } from './heroes/golem.js';
import { rootedAt, onAim, wayOf, AIM, reachOf } from './combat.js';
import { Spark } from './spellfx.js';

export const GOLEM = {
  hp: 4500,
  speed: 1.6,
  // the cracked ankle: what a blow on it does, how many it takes for the next walk to fell him
  // (a fighter's counts for `weight` of one), and how near a blow must land to it
  ankle: { player: 12, fighter: 3, need: 15, weight: 0.5, r: 1.2 },
  // the fire in his chest, felled: what a blow from inside its circle does, the circle, and how
  // long he lies there
  heart: { player: 110, fighter: 22, r: 2.1, down: 6 },
  // how he turns (think): he keeps to one foe `keep` seconds; one more than `dead` behind him he
  // turns round to once it has stayed there `after` seconds, and never twice within `every`
  turn: { keep: [3, 5], dead: 1.2, after: 0.7, every: 1.6 },
  hurt: { swing: 26, lunge: 26, wave: 12, air: 14, slam: 14, last: 20, meteor: 18 }, // to thee (of 100)
  // shockwaves, rippling the ground (ripple.js): their pace, the distance between crests and how
  // many, how far each rolls, and how high its first crest stands
  wave: {
    speed: 15, band: 1.1, length: 2.2, crests: 3,
    swing: 8, slam: 10, last: 34, amp: { swing: 0.45, slam: 0.5, last: 0.7 },
  },
  swing: { r: 2.2 }, // where the axe lands
  lunge: { half: 1.3, air: { speed: 20, life: 0.7, half: 1.7 } },
  // `aimed`: the share falling about a foe; `ripple`: the little one each makes where it lands
  meteor: { r: 1.6, every: [0.14, 0.24], fall: 0.9, aimed: 0.35, ripple: { amp: 0.16, length: 1.0, crests: 2, speed: 7, reach: 3.2 } },
  slamEvery: [15, 21],
  fireEvery: [18, 26],
  // the roll: hemmed in (`crowd` foes within `near`) within `after` seconds of a slam, he rolls
  // `dist` away instead of slamming again (not twice within `every`)
  roll: { crowd: 3, near: 5, after: 15, every: 8, dist: 6.5 },
};

// His moves: drawings and how long each is held (`true`: fixed, else quicker when he's wounded);
// `danger`: the last step during which it can still be escaped.
export const GOLEM_MOVES = {
  // (the axe raised a long moment; then the swing itself only a blink, so the axe seems to sweep
  // through it straight down onto the ground)
  swing: { steps: [['swing-1', 1.0], ['swing-2', 0.07, true], ['swing-3', 0.9]], danger: 2 },
  lunge: { steps: [['lunge-1', 1.0], ['lunge-2', 0.5], ['lunge-3', 0.8]], danger: 1 },
  slam: {
    steps: [['slam-1', 2, true], ['slam-2', 0.2, true], ['slam-1', 0.22, true], ['slam-2', 0.2, true], ['slam-1', 1, true], ['slam-2', 0.6, true], ['slam-3', 1]],
    danger: 5,
  },
  fire: {
    steps: [['slam-1', 2, true], ['slam-2', 0.5, true], ['fire-1', 2, true], ['fire-2', 5, true], ['fire-3', 0.9, true], ['slam-3', 0.6, true]],
    danger: 3,
  },
  // standing; bending, hands to the ground; over (his back to the sky); curled; pushing up, the
  // axe planted; on his knees, leaning on it; standing. He travels in the middle five.
  roll: {
    steps: [['stand', 0.1, true], ['roll-1', 0.12, true], ['roll-2', 0.1, true], ['roll-3', 0.12, true], ['roll-4', 0.14, true], ['roll-5', 0.16, true], ['stand', 0.12, true]],
    danger: -1,
  },
};

const rand = (a, b) => a + Math.random() * (b - a);
// (seconds into his fall, passing out, that the second of its sounds comes in on top of the first:
// about halfway to his body hitting the floor; and how long before he spits his fire its roar begins,
// so that it's at its loudest as the fire comes)
const PASSING = 0.7;
const ROAR_EARLY = 0.3;
// how long he travels as he rolls: through its middle five drawings
const ROLL_TRAVEL = GOLEM_MOVES.roll.steps.slice(1, 6).reduce((t, [, d]) => t + d, 0);
const FIRE = ['#fff6c8', '#ffd24a', '#ff8a14', '#e0380a'];
const STONE = ['#7a7068', '#4a423c', '#a49a8e'];
const STONE_SPARK = '#cfc6b8'; // (a blow turned by the stone: its spark, grey)

export class GolemMind {
  constructor(fight, b) {
    this.fight = fight;
    this.b = b;
    this.ctx = fight.ctx;
    this.floor = fight.floor; // (the arena's floor: what he looses is set on it, fight.js)
    this.px = b.body.sheet.px;
    this.ankle = 0; // blows on the ankle since he last got up
    this.weakT = 0; // how long he's walked on it, given way
    this.tgt = null; // the foe he's after (think), kept a while
    this.retarget = 0;
    this.turnT = 0; // how long it has been behind him
    this.sinceTurn = 9; // since he last turned round
    this.walking = false;
    this.lastSlam = -99; // (fight clock) when he last slammed
    this.rollIn = 0; // till he may roll again
    this.heart = null; // felled: the circle by his chest { x, z, r, decal }
    this.axe = null; // his axe, planted in the ground (the fire)
    this.slamIn = rand(12, 16);
    this.fireIn = rand(20, 28);
    this.told = new Set(); // (the hints in the log, each said once)
  }

  // A sound of his (audio.js, SOUNDS: golem-…), where he is (or at x, z), `delay` seconds from now.
  sound(name, x = this.b.pos.x, z = this.b.pos.y, volume = 1, delay = 0) {
    return this.ctx.sound?.play(`golem-${name}`, { at: [x, z], volume, delay }) || null;
  }

  // Passing out (or dying): his stone crumbling as he falls, the first of its sounds at once and the
  // second coming in on top of it halfway through his fall (PASSING); both hushed as his body hits
  // the floor (onFrame).
  passOut() {
    this.hushFall(0.1);
    this.passing = [this.sound('fall-start-1'), this.sound('fall-start-2', this.b.pos.x, this.b.pos.y, 1, PASSING)];
    this.sound('tip');
  }

  hushFall(fade) {
    for (const v of this.passing || []) v?.stop(fade);
    this.passing = null;
  }

  // One of his drawings comes up (fight.js): a foot set down as he walks (the front one on the walk's
  // first frame, the back one halfway: heroes/golem.js), and, passing out or dying, his body on the
  // floor (the fall's last drawing): the ground shakes and the dust flies, then, as it's heard.
  onFrame(name, i) {
    const b = this.b;
    if (name === 'walk' && (i === 0 || i === 4)) {
      this.sound('step', b.pos.x + b.body.facing * (i === 0 ? 0.35 : -0.35));
    } else if ((name === 'fall' || name === 'collapse') && i === 4) {
      this.hushFall(0.12); // (down: no more crumbling as he falls, and his stone crumbling as he lands)
      this.sound('fall-hit', this.spot(SPOTS.heart)[0]);
      this.sound('crumble', this.spot(SPOTS.heart)[0]);
      this.ctx.rig.shake?.(0.35);
      this.dust(this.spot(SPOTS.heart)[0], b.pos.y, 3.5, 60);
    }
  }

  // Felled for good (fight.js): as he passes out, unless he lies felled already (and if he was
  // still falling, he's down at once: his body on the floor, no more crumbling).
  dies(lying) {
    if (!lying) this.passOut();
    else if (this.passing) {
      this.hushFall(0.12);
      this.sound('fall-hit', this.spot(SPOTS.heart)[0]);
      this.sound('crumble', this.spot(SPOTS.heart)[0]);
    }
  }

  // A spot of his (SPOTS: art px from his middle, forward and up) in the world: [x, height].
  spot([x, y]) {
    return [this.b.pos.x + this.b.body.facing * x * this.px, y * this.px];
  }

  get weak() { return this.ankle >= GOLEM.ankle.need; }
  get lying() { return this.b.state === 'falling' || this.b.state === 'down' || this.b.state === 'rising'; }

  // Spitting fire, nothing hurts him.
  immune() {
    const a = this.b.attack;
    return !!a && a.kind === 'fire' && a.step === 3;
  }

  // His circle on the floor, for crowd.js: smaller lying on his face (they may stand by his chest).
  crowdRadius(r) { return this.lying ? r * 0.6 : r; }

  tell(key, text, tone = 'gold') {
    if (this.told.has(key)) return;
    this.told.add(key);
    this.ctx.ui.log(text, tone, { region: this.ctx.world.arena });
  }

  // ------------------------------------------------------------------------------------------
  // blows on him

  // Thy blow (fight.strikeFrom): whether it landed on him, whatever it did (along the line thou
  // aimed it, and a little off it: combat.js, AIM).
  playerBlow(p) {
    return this.blow(p, GOLEM.ankle.player, 1, GOLEM.heart.player, AIM.blow);
  }

  // A fighter's blow, at the turn of its swing (the way it faces).
  fighterBlow(n) {
    return this.blow(n, GOLEM.ankle.fighter, GOLEM.ankle.weight, GOLEM.heart.fighter);
  }

  blow(n, ankleDmg, weight, heartDmg, margin = 0) {
    const b = this.b;
    if (!b.alive || b.state === 'enter' || b.lift > 2) return false;
    if (b.attack?.kind === 'roll') return false; // (rolling, he's never where the blow lands)
    const way = wayOf(n);
    const far = reachOf(n); // (a spear reaches farther: combat.js)
    const [rx, rz] = [n.pos.x + way[0] * (1.5 + far), n.pos.y + way[1] * (1.5 + far)]; // where the blow lands
    if (b.state === 'down' && this.heart) {
      const h = this.heart;
      if (Math.hypot(n.pos.x - h.x, n.pos.y - h.z) <= h.r) {
        // from inside the circle: into the fire
        const [, hy] = this.spot(SPOTS.heart);
        this.fight.hit(b, heartDmg, [h.x, hy + 0.3, b.pos.y + 0.2], n, true, 'blow');
        this.floor.particles.emit({
          pos: [h.x, hy + 0.4, b.pos.y + 0.3], spread: [0.4, 0.3, 0.3], vel: [0, 2.6, 0], velSpread: [1.6, 1.4, 1],
          color: FIRE, size: 0.1, life: 0.7, count: 22, drag: 1.2, intensity: 2.8,
        });
        return true;
      }
      // the stone of his back: nothing
      if (Math.abs(rx - b.pos.x) < 5 && Math.abs(rz - b.pos.y) < 2.4) { this.clang(rx, rz, n); return true; }
      return false;
    }
    if (this.lying) return false;
    // the cracked ankle: within the blow's reach, on its line
    const [ax, ay] = this.spot(SPOTS.ankle);
    if (onAim(n.pos.x, n.pos.y, way, ax, b.pos.y, GOLEM.ankle.r, GOLEM.ankle.r + 0.4, 1.5 + far, margin, 0.4) != null) {
      const was = this.weak;
      this.ankle += weight;
      this.fight.hit(b, ankleDmg, [ax, ay, b.pos.y + 0.2], n, true, 'blow');
      this.sound('ankle', ax); // (the crack struck: audio.js)
      // (it takes little, but the blow counts in full toward the striker's ultimate)
      this.fight.charge(n, this.fight.blowWorth(n) - ankleDmg);
      this.floor.particles.emit({
        pos: [ax, ay, b.pos.y + 0.3], spread: [0.2, 0.2, 0.2], vel: [0, 1.6, 0], velSpread: [1.6, 1.2, 0.8],
        color: FIRE, size: 0.07, life: 0.5, count: 14, drag: 1.4, intensity: 2.6,
      });
      if (!was && this.weak) this.tell('weak', 'The Golem\'s cracked ankle buckles: one more walk on it and it gives way', 'red');
      return true;
    }
    // anywhere else on him: the stone turns it
    if (onAim(n.pos.x, n.pos.y, way, b.pos.x, b.pos.y, b.kind.radius, b.kind.depth, b.kind.reach + far, margin) != null) {
      this.clang(rx, rz, n);
      this.tell('stone', 'Stone turns thy blows: strike the Golem\'s cracked ankle, low on his back leg');
      return true;
    }
    return false;
  }

  // Where a spell flies at him (fight.spellPoint): his cracked ankle while he stands, the fire in
  // his chest as he lies felled, his middle as he falls or rises.
  spellPoint() {
    const b = this.b;
    if (b.state === 'down' && this.heart) {
      const [, hy] = this.spot(SPOTS.heart);
      return [this.heart.x, hy + 0.3, b.pos.y + 0.2];
    }
    if (this.lying) return [b.pos.x, 1.2, b.pos.y + 0.2];
    const [ax, ay] = this.spot(SPOTS.ankle);
    return [ax, ay, b.pos.y + 0.2];
  }

  // A spell lands (fight.spellHit), `share` of an ordinary one (`player`: thine): on the cracked
  // ankle as a blow there would (though it counts a little less toward felling him), and on the
  // fire in his chest for half what a blow from inside the circle takes. Rolling, it misses him;
  // lying but not yet open to it, the stone turns it.
  spellBlow(n, share, player) {
    const b = this.b;
    if (!b.alive || b.state === 'enter' || b.lift > 2 || b.attack?.kind === 'roll') return false;
    if (b.state === 'down' && this.heart) {
      const [, hy] = this.spot(SPOTS.heart);
      this.fight.hit(b, (player ? GOLEM.heart.player : GOLEM.heart.fighter) * 0.5 * share, [this.heart.x, hy + 0.3, b.pos.y + 0.2], n, true, 'spell');
      return true;
    }
    if (this.lying) { this.clang(b.pos.x, b.pos.y); return false; }
    const [ax, ay] = this.spot(SPOTS.ankle);
    const was = this.weak;
    this.ankle += (player ? 1 : GOLEM.ankle.weight) * 0.7 * share;
    const dmg = (player ? GOLEM.ankle.player : GOLEM.ankle.fighter) * share;
    this.fight.hit(b, dmg, [ax, ay, b.pos.y + 0.2], n, true, 'spell');
    this.sound('ankle', ax);
    this.fight.charge(n, this.fight.blowWorth(n, true) * share - dmg);
    if (!was && this.weak) this.tell('weak', 'The Golem\'s cracked ankle buckles: one more walk on it and it gives way', 'red');
    return true;
  }

  // A blow turned by the stone: grey chips and a spark, and nothing more: no flash, no holding
  // still. The striker (`n`) bounces off it: its drawing thrown back the way it came, past the
  // lunge its blow began (npc.js).
  clang(x, z, n = null) {
    this.sound('clang', x, z);
    this.floor.particles.emit({
      pos: [x, 1.2, z + 0.2], spread: [0.2, 0.3, 0.2], vel: [0, 1.2, 0], velSpread: [1.4, 1, 0.8],
      color: [...STONE, '#ffe6b0'], size: 0.06, life: 0.4, count: 10, drag: 1.6, intensity: 1.2,
    });
    if (!n) return;
    this.fight.fx.push(new Spark(this.fight.fxCtx, { color: STONE_SPARK, at: [x, 1.2, z + 0.3], dir: n.body.facing, size: 1.1 }));
    n.body.knock((n.body.sheet.lunge?.attack || 0) + 0.2, -n.body.facing);
  }

  // Where a fighter goes to strike, and whether it's there: beside the cracked ankle (behind him; a
  // spear its length the farther back, combat.js), or, while he lies felled, into the circle by his
  // chest.
  strikeSpot(n) {
    const b = this.b;
    const f = n.fighter;
    f.slot ??= Math.random() * Math.PI * 2;
    if (b.state === 'down' && this.heart) {
      const h = this.heart;
      const gx = h.x + Math.cos(f.slot) * h.r * 0.5;
      const gz = h.z + Math.sin(f.slot) * h.r * 0.4;
      return { goal: [gx, gz], ready: Math.hypot(n.pos.x - h.x, n.pos.y - h.z) < h.r - 0.25, face: b.pos.x + b.body.facing * 2 };
    }
    if (this.lying) return null;
    const [ax] = this.spot(SPOTS.ankle);
    const gx = ax - b.body.facing * (1.1 + reachOf(n));
    const gz = b.pos.y + Math.sin(f.slot) * 0.6;
    return { goal: [gx, gz], ready: Math.abs(n.pos.x - gx) < 0.7 && Math.abs(n.pos.y - gz) < 0.9, face: ax };
  }

  // ------------------------------------------------------------------------------------------
  // his mind

  // Ready: a foe to face, a blow to choose, or a walk into its lane (and, given way, a fall). He's
  // slow to change his mind (GOLEM.turn): he keeps to one foe a few seconds rather than whoever
  // happens to be nearest (the fighters run round him for his ankle), turns round only once it
  // has stayed behind him a moment, and not again straight after; and he sets off only for a
  // place well away from him (a little short of it is near enough).
  think(dt, fast) {
    const b = this.b;
    const f = this.fight;
    const T = GOLEM.turn;
    b.cd -= dt * fast;
    this.slamIn -= dt * fast;
    this.fireIn -= dt * fast;
    this.rollIn -= dt;
    b.idleT += dt;
    this.sinceTurn += dt;
    if (this.weak) this.smoulder(dt);
    // his foe: kept a while, unless it's left the fight
    this.retarget -= dt;
    if (!this.tgt || this.retarget <= 0 || !f.foes().includes(this.tgt)) {
      this.tgt = f.target(b);
      this.retarget = rand(...T.keep);
    }
    const tgt = this.tgt;
    if (!tgt) { this.walking = false; b.pose('idle'); return false; }
    const dx = tgt.pos.x - b.pos.x;
    const dz = tgt.pos.y - b.pos.y;
    // turning round to it, once it has stayed behind him a moment
    const behind = dx * b.body.facing < -T.dead;
    this.turnT = behind ? this.turnT + dt : 0;
    if (behind && this.turnT >= T.after && this.sinceTurn >= T.every) {
      b.body.facing = -b.body.facing;
      this.turnT = 0;
      this.sinceTurn = 0;
      return false;
    }
    // (his swing and lunge go where he faces; the slam and the fire, all round him)
    const ahead = dx * b.body.facing > 0;
    if (!this.weak && b.cd <= 0) {
      const ax = Math.abs(dx);
      const inLane = Math.abs(dz) < b.kind.lane;
      let move = null;
      const R = GOLEM.roll;
      const hemmed = f.foesWithin(b, R.near) >= R.crowd;
      // (hemmed in, he slams; but not again so soon after the last: he rolls out of the crowd
      // instead, or, not yet able to roll again, turns his other blows on them)
      const slammed = f.clock - this.lastSlam < R.after;
      if (this.fireIn <= 0) move = 'fire';
      else if (hemmed && slammed && this.rollIn <= 0 && !rootedAt(b, f.clock)) move = 'roll'; // (not out of a pool of blood, combat.js)
      else if (!slammed && (this.slamIn <= 0 || hemmed)) move = 'slam';
      else if (ahead && inLane && ax < 7.5) move = Math.random() < 0.65 ? 'swing' : 'lunge';
      else if (ahead && inLane && ax < 15) move = 'lunge';
      else if (b.idleT > 6 && !slammed) move = 'slam';
      if (move) {
        if (move === 'fire') { this.fireIn = rand(...GOLEM.fireEvery); this.slamIn = Math.max(this.slamIn, 8); }
        if (move === 'slam') { this.slamIn = rand(...GOLEM.slamEvery); this.lastSlam = f.clock; }
        if (move === 'roll') this.rollIn = R.every;
        this.walking = false;
        this.begin(move);
        return false;
      }
    }
    // his place: in its lane, the swing's distance short of it (waiting, while it's behind him,
    // to turn round first); given way, he shifts on anyway (and soon falls)
    let gx = tgt.pos.x - b.body.facing * b.kind.spacing;
    let gz = tgt.pos.y;
    if (this.weak && Math.hypot(gx - b.pos.x, gz - b.pos.y) < 1.5) { gx = b.pos.x + b.body.facing * 3; gz = b.pos.y; }
    else if (behind && !this.weak) { gx = b.pos.x; gz = b.pos.y; }
    const d = Math.hypot(gx - b.pos.x, gz - b.pos.y);
    if (d < (this.walking ? 0.35 : 1.2)) { this.walking = false; b.pose('idle'); return false; }
    this.walking = true;
    // walking on the cracked ankle, given way: a few steps, and down he goes
    if (this.weak) {
      this.weakT += dt;
      if (this.weakT > 0.7) { this.fall(); return false; }
    }
    // (backing off from a foe too close in front, he goes slower)
    const back = (gx - b.pos.x) * b.body.facing < -0.3 ? 0.6 : 1;
    const step = Math.min(d, b.kind.speed * back * fast * dt);
    f.shift(b, ((gx - b.pos.x) / d) * step, ((gz - b.pos.y) / d) * step);
    b.pose('walk');
    return true;
  }

  // The ankle, given way, smoulders: embers off the crack.
  smoulder(dt) {
    if (Math.random() > dt * 10) return;
    const [ax, ay] = this.spot(SPOTS.ankle);
    this.floor.particles.emit({
      pos: [ax, ay, this.b.pos.y + 0.3], spread: [0.15, 0.15, 0.1], vel: [0, 1.2, 0], velSpread: [0.5, 0.6, 0.3],
      color: FIRE, size: 0.06, life: 0.6, count: 3, drag: 1, intensity: 2.4,
    });
  }

  // He passes out: falls on his face, the fire in his chest laid open.
  fall() {
    const b = this.b;
    b.endMove();
    b.state = 'falling';
    b.t = 0;
    this.weakT = 0;
    b.pose('fall', true);
    this.passOut();
    this.tell('fall', 'The Golem falls! Strike the fire in his chest from within the golden circle', 'gold');
  }

  // Falling, felled, getting up (fight.stepBoss, for these states).
  stepState(dt) {
    const b = this.b;
    if (b.state === 'falling') {
      // (once his body has hit the floor, on the fall's last drawing: onFrame shook it)
      const a = b.body.anim;
      if (b.t >= 1.35 && (a?.name !== 'fall' || a.index >= a.def.frames.length - 1)) {
        b.state = 'down';
        b.t = 0;
        b.pose('down');
        this.openHeart();
      }
    } else if (b.state === 'down') {
      if (this.heart) this.heart.decal.opacity = 0.75 + 0.25 * Math.sin(b.t * 6);
      if (b.t >= GOLEM.heart.down) {
        b.state = 'rising';
        b.t = 0;
        b.pose('rise', true);
        this.closeHeart();
      }
    } else if (b.state === 'rising') {
      if (b.t >= 1.75) {
        b.state = 'ready';
        b.t = 0;
        this.ankle = 0;
        b.cd = rand(0.8, 1.5);
        b.idleT = 0;
        b.pose('idle');
      }
    }
  }

  openHeart() {
    const b = this.b;
    const [x] = this.spot(SPOTS.heart);
    const r = GOLEM.heart.r;
    const z = b.pos.y + 0.7; // (on the floor just in front of him)
    // (and its light, the fire in his chest laid open)
    const light = carry(this.floor.scene, [x, 1, z + 0.4], { color: FIRE_LIGHT, power: 32, reach: 13, waver: 0.8, keep: true });
    this.heart = { x, z, r, decal: new Decal(this.floor.scene, 'heart', x, z, r * 2 * 96 / 90), light };
  }

  closeHeart() {
    this.heart?.decal.dispose();
    this.heart?.light.end(0.6);
    this.heart = null;
  }

  // ------------------------------------------------------------------------------------------
  // his blows

  begin(kind) {
    const b = this.b;
    const dir = b.body.facing;
    const a = { kind, step: -1, t: 0, dir, x: b.pos.x, z: b.pos.y, shape: 'wave', opt: {} };
    if (kind === 'swing') {
      [a.ix] = this.spot(SPOTS.swing);
      a.x = a.ix;
      a.shape = 'disc';
      a.opt = { r: GOLEM.wave.swing };
    } else if (kind === 'lunge') {
      const reach = SPOTS.lunge[0] * this.px;
      a.shape = 'line';
      a.opt = { dir, from: -0.5, len: reach + GOLEM.lunge.air.speed * GOLEM.lunge.air.life, half: GOLEM.lunge.air.half };
    } else if (kind === 'roll') {
      // out of the crowd, rolling over in the way he faces
      a.shape = 'none';
      a.from = [b.pos.x, b.pos.y];
      a.to = this.rollTo();
      a.rolled = 0;
      if (Math.abs(a.to[0] - b.pos.x) > 0.4) b.body.facing = a.to[0] > b.pos.x ? 1 : -1;
      a.dir = b.body.facing;
    } else {
      // the slam, and the fire (which begins as one): shockwaves no running escapes; hop them
      [a.ix] = this.spot(SPOTS.slam);
    }
    b.attack = a;
    b.state = 'attack';
    b.idleT = 0;
    this.nextStep();
    if (kind !== 'roll') this.sound('windup'); // (the axe or the pole raised)
  }

  // The move goes on: the marks pulse, he shakes, spits fire; at the end of each step, the next.
  stepMove(dt, t, fast) {
    const b = this.b;
    const a = b.attack;
    const [, dur, fixed] = GOLEM_MOVES[a.kind].steps[a.step];
    a.t += dt;
    const k = Math.min(1, a.t / (fixed ? dur : dur / fast));
    let jitter = 0;
    // (the marks brighten as the blow gathers; the reach of a shockwave stays faint)
    if (b.marks.length && a.step === 0) for (const m of b.marks) if (!m.faint) m.opacity = (0.2 + 0.45 * k) * (0.8 + 0.2 * Math.sin(t * 24));
    if (a.kind === 'fire' && (a.step === 2 || a.step === 3)) {
      // the fire's light from his chest: coming up as it gathers, full as he spits it
      const [cx, cy] = this.spot(SPOTS.chest);
      a.fire ??= carry(this.floor.scene, [cx, cy, b.pos.y + 0.8], { color: FIRE_LIGHT, power: 45, reach: 20, waver: 1, level: 0 });
      a.fire.at(cx, cy, b.pos.y + 0.8);
      a.fire.level = a.step === 2 ? 0.5 * k : 1;
    } else if (a.fire) {
      a.fire.end(0.5);
      a.fire = null;
    }
    if (a.kind === 'fire' && a.step === 2 && !a.roar && a.t >= dur - ROAR_EARLY) this.roar(a);
    if (a.roar && !(a.kind === 'fire' && (a.step === 2 || a.step === 3))) this.hush(a);
    if (a.kind === 'fire' && a.step === 2) {
      // gathering the fire: he shakes side to side
      jitter = (Math.floor(a.t * 20) % 2 ? 1 : -1) * 0.12;
      if (Math.random() < dt * 20) {
        const [cx, cy] = this.spot(SPOTS.chest);
        this.floor.particles.emit({
          pos: [cx, cy, b.pos.y + 0.3], spread: [0.6, 0.6, 0.3], vel: [0, 1.5, 0], velSpread: [1, 1, 0.6],
          color: FIRE, size: 0.08, life: 0.5, count: 4, drag: 1, intensity: 2.4,
        });
      }
    }
    if (a.kind === 'fire' && a.step === 3) this.spit(dt, a);
    if (a.kind === 'roll' && a.step >= 1 && a.step <= 5) {
      const span = ROLL_TRAVEL;
      a.rolled = Math.min(span, a.rolled + dt);
      const e = (1 - Math.cos((Math.PI * a.rolled) / span)) / 2; // (easing in and out)
      b.pos.set(a.from[0] + (a.to[0] - a.from[0]) * e, a.from[1] + (a.to[1] - a.from[1]) * e);
      if (Math.random() < dt * 14) this.dust(b.pos.x, b.pos.y, 1.2, 4);
    }
    if (k >= 1) this.nextStep();
    return jitter;
  }

  nextStep() {
    const b = this.b;
    const a = b.attack;
    const { scene } = this.floor;
    const { rig } = this.ctx;
    a.step += 1;
    a.t = 0;
    const steps = GOLEM_MOVES[a.kind].steps;
    if (a.step >= steps.length) {
      b.endMove();
      b.state = 'ready';
      b.cd = a.kind === 'roll' ? 0.35 : rand(1.2, 2.2);
      b.pose('idle');
      return;
    }
    b.pose(steps[a.step][0], true);
    const z = b.pos.y;
    const H = GOLEM.hurt;
    switch (`${a.kind}:${a.step}`) {
      case 'swing:0':
        // where the axe will land, and how far its shockwave will roll
        b.marks.push(new Decal(scene, 'zone', a.ix, z, GOLEM.swing.r * 2 * 32 / 31, { opacity: 0.5 }));
        b.marks.push(Object.assign(new Decal(scene, 'ring', a.ix, z, GOLEM.wave.swing * 2 * 48 / 44, { opacity: 0.22 }), { faint: true }));
        break;
      case 'swing:2': {
        this.sound('strike', a.ix);
        for (const m of b.marks) m.dispose();
        b.marks = [];
        this.fight.strike((px, pz) => Math.hypot(px - a.ix, pz - z) <= GOLEM.swing.r, H.swing);
        this.groundHit(a.ix, z, GOLEM.wave.swing, H.wave, 0.35, GOLEM.wave.amp.swing);
        break;
      }
      case 'lunge:1': {
        // the thrust, to the point and far past it: a shock in the air flying on
        const [tip, ty] = this.spot(SPOTS.lunge);
        this.sound('strike', tip, z, 0.75);
        this.fight.strike((px, pz) => covers(a, px, pz, Math.abs(tip - b.pos.x)), H.lunge);
        const w = new AirWave(scene, tip, ty, z, a.dir, GOLEM.lunge.air);
        this.fight.fx.push({
          step: (dt) => {
            const on = w.step(dt);
            this.fight.strike((px, pz) => Math.abs(px - w.x) <= 1 && Math.abs(pz - z) <= GOLEM.lunge.air.half, H.air, w.hit);
            return on;
          },
          dispose: () => w.dispose(),
        });
        this.floor.particles.emit({
          pos: [tip, ty, z + 0.2], spread: [0.3, 0.5, 0.3], vel: [a.dir * 6, 0, 0], velSpread: [2, 1, 0.6],
          color: ['#f0e6d8', '#c8bcae'], size: 0.09, life: 0.4, count: 18, drag: 2, intensity: 1.2,
        });
        rig.shake?.(0.15);
        break;
      }
      case 'slam:0':
      case 'fire:0':
        // the pole raised high: the ring of the shockwave to come
        b.marks.push(new Decal(scene, 'ring', a.ix, z, GOLEM.wave.slam * 2 * 48 / 44, { opacity: 0.3 }));
        break;
      case 'slam:1':
      case 'slam:3':
        this.sound('strike', a.ix);
        for (const m of b.marks) m.dispose();
        b.marks = [];
        this.groundHit(a.ix, z, GOLEM.wave.slam, H.slam, 0.3, GOLEM.wave.amp.slam);
        break;
      case 'slam:5':
        // the last: the whole arena
        this.sound('strike', a.ix, z, 1.15);
        this.groundHit(a.ix, z, GOLEM.wave.last, H.last, 0.6, GOLEM.wave.amp.last);
        break;
      case 'fire:1': {
        // the pole driven into the ground, and left there: no shockwave, only the crack
        this.sound('strike', a.ix);
        for (const m of b.marks) m.dispose();
        b.marks = [];
        this.crack(a.ix, z, 5);
        this.dust(a.ix, z, 1.4, 30);
        rig.shake?.(0.2);
        break;
      }
      case 'fire:2': {
        // his axe stands planted; he lets go of it
        const body = new SpriteBody(scene, b.body.sheet);
        body.blob.visible = false;
        body.play('axe');
        body.facing = b.body.facing;
        body.tick(0);
        body.place(b.pos.x + b.body.facing * b.offset, 0, b.pos.y + 0.08);
        this.axe = body;
        // what falls from the sky is seen, and run from
        a.shape = 'spots';
        a.opt = { r: GOLEM.meteor.r, spots: [] };
        a.spit = 0;
        break;
      }
      case 'fire:3':
        // (the fire's roar, if it hasn't begun yet: stepMove begins it a moment before; and the
        // burst of it as it comes out of him)
        if (!a.roar) this.roar(a);
        this.sound('explosion', this.spot(SPOTS.chest)[0]);
        break;
      case 'roll:6':
        this.slamIn = Math.max(this.slamIn, 6);
        this.sinceTurn = GOLEM.turn.every;
        this.retarget = 0;
        break;
      case 'fire:5':
        // he takes it up again
        this.dropAxe();
        break;
      default:
        break;
    }
  }

  // Where to roll to: away from the foes about him, into the most open ground within reach on
  // the arena floor (across rather than up or down, as a roll reads best that way); against its
  // edge, toward the middle.
  rollTo() {
    const b = this.b;
    const R = GOLEM.roll;
    const { cx, cz } = this.ctx.world.arena;
    const foes = this.fight.foes();
    let ax = 0;
    let az = 0;
    for (const n of foes) {
      if (Math.hypot(n.pos.x - b.pos.x, n.pos.y - b.pos.y) > R.near + 1) continue;
      ax += n.pos.x - b.pos.x;
      az += n.pos.y - b.pos.y;
    }
    const away = Math.hypot(ax, az) > 0.5 ? Math.atan2(-az, -ax) : Math.random() * Math.PI * 2;
    let best = null;
    let bs = -Infinity;
    for (let k = -4; k <= 4; k++) {
      const ang = away + k * 0.3;
      const x = b.pos.x + Math.cos(ang) * R.dist;
      const z = b.pos.y + Math.sin(ang) * R.dist * 0.8;
      if (Math.hypot(x - cx, z - cz) > ARENA.walkRadius - 2.5) continue;
      const room = Math.min(8, ...foes.map((n) => Math.hypot(n.pos.x - x, n.pos.y - z)));
      const s = room + Math.abs(Math.cos(ang)) * 3.5 - Math.abs(k) * 0.15;
      if (s > bs) { bs = s; best = [x, z]; }
    }
    if (best) return best;
    const d = Math.hypot(cx - b.pos.x, cz - b.pos.y) || 1;
    const k = Math.min(R.dist, d) / d;
    return [b.pos.x + (cx - b.pos.x) * k, b.pos.y + (cz - b.pos.y) * k];
  }

  // Where the axe (or the pole) strikes the ground: a crack, dust, a shake, and a shockwave.
  groundHit(x, z, R, dmg, shake, amp) {
    this.crack(x, z, 7);
    this.dust(x, z, 1.6, 50);
    this.ctx.rig.shake?.(shake);
    this.wave(x, z, R, dmg, amp);
  }

  crack(x, z, life) {
    const crack = new Decal(this.floor.scene, 'crack', x, z, 4.6, { glow: false });
    let t = 0;
    this.fight.fx.push({
      step: (dt) => { t += dt; crack.opacity = Math.min(1, Math.max(0, (life - t) / 2)); return t < life; },
      dispose: () => crack.dispose(),
    });
  }

  dust(x, z, r, count) {
    this.floor.particles.emit({
      pos: [x, 0.3, z], spread: [r, 0.2, r * 0.6], vel: [0, 2.2, 0], velSpread: [3, 1.6, 2],
      color: ['#6a5a4e', '#3a2e28', '#8a7a6a'], size: 0.16, life: 1.1, count, drag: 1.3, intensity: 0.8,
    });
  }

  // A shockwave from (x, z) out to radius R: the ground ripples like water (ripple.js), its first
  // crest `amp` high, and each that crest reaches as it passes is hurt once, unless dodging (thee)
  // or in the air (a fighter hopping it, which most do).
  wave(x, z, R, dmg, amp) {
    const { speed, band, length, crests } = GOLEM.wave;
    const ripple = addRipple(x, z, { amp, length, crests, speed, reach: R });
    const seen = new Set();
    const decided = new Set();
    const fight = this.fight;
    const { particles } = this.floor;
    const { director } = this.ctx;
    this.fight.fx.push({
      step: (dt) => {
        const r = ripple.front - length / 4; // (the first crest, a quarter wavelength behind the front)
        const on = r < R;
        // the fighters it's about to reach decide: hop it, or brace (and take it)
        for (const n of director.npcs.values()) {
          const f = n.fighter;
          if (!f || f.dead || n.travel || n.piloted || decided.has(n)) continue;
          const d = Math.hypot(n.pos.x - x, n.pos.y - z);
          if (d > r && d - r < speed * 0.2) {
            decided.add(n);
            if (Math.random() < (f.coward ? 0.95 : 0.85)) f.hop = { t: 0, dur: 0.55 };
          }
        }
        fight.strike((px, pz) => {
          const d = Math.hypot(px - x, pz - z);
          return d <= r && d >= r - band - speed * dt;
        }, dmg, seen, true);
        // dust thrown up along the crest
        if (on && r > 0 && Math.random() < 0.9) {
          const ang = Math.random() * Math.PI * 2;
          const px = x + Math.cos(ang) * r;
          const pz = z + Math.sin(ang) * r;
          particles.emit({
            pos: [px, rippleAt(px, pz) + 0.15, pz], spread: [0.3, 0.1, 0.3], vel: [Math.cos(ang) * 2, 1.4, Math.sin(ang) * 2],
            velSpread: [0.6, 0.6, 0.6], color: ['#8a7a6a', '#5a4a3e', '#c8b8a0'], size: 0.14, life: 0.7, count: 3, drag: 1.4, intensity: 0.9,
          });
        }
        return on;
      },
      dispose: () => {},
    });
  }

  // Spitting fire: a fountain of it from his chest, and meteors falling all over the arena.
  spit(dt, a) {
    const b = this.b;
    const [cx, cy] = this.spot(SPOTS.chest);
    if (Math.random() < dt * 40) {
      this.floor.particles.emit({
        pos: [cx, cy, b.pos.y + 0.3], spread: [0.3, 0.3, 0.2], vel: [b.body.facing * 3, 10, 0], velSpread: [3, 3, 2],
        color: FIRE, size: 0.16, life: 1.0, count: 8, gravity: 6, drag: 0.4, intensity: 2.8,
      });
    }
    a.spit -= dt;
    if (a.spit > 0) return;
    a.spit = rand(...GOLEM.meteor.every);
    this.meteor(a);
  }

  meteor(a) {
    const { scene, particles } = this.floor;
    const { world, rig } = this.ctx;
    const M = GOLEM.meteor;
    const { cx, cz } = world.arena;
    let x;
    let z;
    const foes = this.fight.foes();
    if (foes.length && Math.random() < M.aimed) {
      const n = foes[Math.floor(Math.random() * foes.length)];
      x = n.pos.x + rand(-1.5, 1.5);
      z = n.pos.y + rand(-1.2, 1.2);
    } else {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (ARENA.walkRadius - 1.5);
      x = cx + Math.cos(ang) * r;
      z = cz + Math.sin(ang) * r;
    }
    const spot = [x, z];
    a.opt.spots.push(spot);
    // (flung up out of him; and the first of them, the swarm of them all as it begins: audio.js)
    this.sound('throw', this.spot(SPOTS.chest)[0]);
    if (!a.swarm) { a.swarm = true; this.sound('swarm', this.spot(SPOTS.chest)[0]); }
    const mark = new Decal(scene, 'zone', x, z, M.r * 2 * 32 / 31, { opacity: 0.6 });
    const rock = new Meteor(scene, x, z, { dur: M.fall, drift: (Math.random() < 0.5 ? -1 : 1) * 4 });
    let landed = false;
    let after = 0;
    this.fight.fx.push({
      step: (dt) => {
        if (!landed) {
          mark.opacity = 0.5 + 0.4 * Math.sin(rock.t * 30);
          const on = rock.step(dt);
          const p = rock.pos;
          particles.emit({
            pos: [p.x, p.y, p.z], spread: [0.2, 0.2, 0.2], vel: [0, 1.5, 0], velSpread: [0.6, 0.6, 0.4],
            color: FIRE, size: 0.12, life: 0.4, count: 2, drag: 1, intensity: 2.6,
          });
          if (on) return true;
          // it lands: fire bursts (a flash of it), the stone cracks, and all on the mark suffer
          landed = true;
          rock.land();
          this.sound('meteor', x, z);
          flash(scene, [x, 1, z + 0.3], { color: FIRE_LIGHT, power: 90, reach: 14, life: 0.45, flicker: 1, rise: 0.02 });
          const i = a.opt.spots.indexOf(spot);
          if (i >= 0) a.opt.spots.splice(i, 1);
          this.fight.strike((px, pz) => Math.hypot(px - x, pz - z) <= M.r, GOLEM.hurt.meteor);
          particles.emit({
            pos: [x, 0.4, z], spread: [0.6, 0.3, 0.5], vel: [0, 4, 0], velSpread: [3.5, 2.5, 2.5],
            color: FIRE, size: 0.14, life: 0.8, count: 34, gravity: 7, drag: 0.6, intensity: 2.8,
          });
          this.crack(x, z, 4);
          addRipple(x, z, { ...M.ripple, minor: true }); // (a little ripple of the ground, harmless)
          rig.shake?.(0.08);
        }
        after += dt;
        mark.opacity = Math.max(0, 1 - after / 0.3);
        return after < 0.3;
      },
      dispose: () => { rock.dispose(); mark.dispose(); },
    });
  }

  dropAxe() {
    this.axe?.dispose();
    this.axe = null;
  }

  // (from Boss.endMove: a move cut short, or over)
  endMove() {
    this.dropAxe();
    const a = this.b.attack;
    if (a?.fire) { a.fire.end(0.5); a.fire = null; }
    if (a?.roar) this.hush(a);
  }

  // The fire roars up out of his chest, and burns on while he spits it (hush, as it ends).
  roar(a) {
    a.roar = [this.sound('fire-start'), this.sound('fire')];
  }

  // The fire's roar dies away (its move over, or cut short).
  hush(a) {
    for (const v of a.roar || []) v?.stop(0.6);
    a.roar = null;
  }

  dispose() {
    this.dropAxe();
    this.closeHeart();
    if (this.b.attack?.roar) this.hush(this.b.attack);
    this.hushFall(0.5);
  }
}

// Whether the lunge's thrust (`a`, out to `reach`) covers a point.
function covers(a, px, pz, reach) {
  const along = (px - a.x) * a.dir;
  return along >= -0.5 && along <= reach && Math.abs(pz - a.z) <= GOLEM.lunge.half;
}
