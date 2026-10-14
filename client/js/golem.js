// The Guardian Golem's fight (fight.js hands him over to this; his drawings are heroes/golem.js).
//
// Stone turns every blow but those on his cracked ankle, low on his back leg, and those do him
// little harm. Enough of them, though (thine, and the fighters', which count for half), and the
// next time he walks the ankle gives way: he passes out and falls on his face, and for a few
// seconds the fire in his ribcage lies open, a golden circle on the floor beside it. Blows struck
// from inside the circle wound him deeply, from anywhere else not at all. Then he gets up (his fall
// played backwards), the ankle whole again.
//
// His blows are slow, and what hurts most is what they shake loose: shockwaves rolling out over the
// floor, far wider than the axe. Dodge through one (Space) as it reaches thee; the fighters hop
// them, mostly.
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
// He says nothing.

import { ARENA } from './config.js';
import { SpriteBody } from './npc.js';
import { AirWave, Decal, Meteor, Shockwave } from './bossfx.js';
import { SPOTS } from './heroes/golem.js';

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
  wave: { speed: 15, band: 1.1, swing: 8, slam: 10, last: 34 }, // shockwaves: their pace, and how far each rolls
  swing: { r: 2.2 }, // where the axe lands
  lunge: { half: 1.3, air: { speed: 20, life: 0.7, half: 1.7 } },
  meteor: { r: 1.6, every: [0.14, 0.24], fall: 0.9, aimed: 0.35 }, // `aimed`: the share falling about a foe
  slamEvery: [15, 21],
  fireEvery: [26, 36],
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
};

const rand = (a, b) => a + Math.random() * (b - a);
const FIRE = ['#fff6c8', '#ffd24a', '#ff8a14', '#e0380a'];
const STONE = ['#7a7068', '#4a423c', '#a49a8e'];

export class GolemMind {
  constructor(fight, b) {
    this.fight = fight;
    this.b = b;
    this.ctx = fight.ctx;
    this.px = b.body.sheet.px;
    this.ankle = 0; // blows on the ankle since he last got up
    this.weakT = 0; // how long he's walked on it, given way
    this.tgt = null; // the foe he's after (think), kept a while
    this.retarget = 0;
    this.turnT = 0; // how long it has been behind him
    this.sinceTurn = 9; // since he last turned round
    this.walking = false;
    this.heart = null; // felled: the circle by his chest { x, z, r, decal }
    this.axe = null; // his axe, planted in the ground (the fire)
    this.slamIn = rand(12, 16);
    this.fireIn = rand(20, 28);
    this.told = new Set(); // (the hints in the log, each said once)
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

  // Thy blow (fight.strikeFrom): whether it landed on him, whatever it did.
  playerBlow(p) {
    return this.blow(p, GOLEM.ankle.player, 1, GOLEM.heart.player);
  }

  // A fighter's blow, at the turn of its swing.
  fighterBlow(n) {
    return this.blow(n, GOLEM.ankle.fighter, GOLEM.ankle.weight, GOLEM.heart.fighter);
  }

  blow(n, ankleDmg, weight, heartDmg) {
    const b = this.b;
    if (!b.alive || b.state === 'enter' || b.lift > 2) return false;
    const reach = n.pos.x + n.body.facing * 1.5; // where the blow lands
    if (b.state === 'down' && this.heart) {
      const h = this.heart;
      if (Math.hypot(n.pos.x - h.x, n.pos.y - h.z) <= h.r) {
        // from inside the circle: into the fire
        const [, hy] = this.spot(SPOTS.heart);
        this.fight.hit(b, heartDmg, [h.x, hy + 0.3, b.pos.y + 0.2]);
        this.ctx.particles.emit({
          pos: [h.x, hy + 0.4, b.pos.y + 0.3], spread: [0.4, 0.3, 0.3], vel: [0, 2.6, 0], velSpread: [1.6, 1.4, 1],
          color: FIRE, size: 0.1, life: 0.7, count: 22, drag: 1.2, intensity: 2.8,
        });
        return true;
      }
      // the stone of his back: nothing
      if (Math.abs(reach - b.pos.x) < 5 && Math.abs(n.pos.y - b.pos.y) < 2.4) { this.clang(reach, n.pos.y); return true; }
      return false;
    }
    if (this.lying) return false;
    // the cracked ankle: within the blow's reach, just ahead of the striker
    const [ax, ay] = this.spot(SPOTS.ankle);
    const ahead = (ax - n.pos.x) * n.body.facing;
    if (ahead > -0.4 && ahead < 1.5 + GOLEM.ankle.r && Math.abs(n.pos.y - b.pos.y) < GOLEM.ankle.r + 0.4) {
      const was = this.weak;
      this.ankle += weight;
      this.fight.hit(b, ankleDmg, [ax, ay, b.pos.y + 0.2]);
      this.ctx.particles.emit({
        pos: [ax, ay, b.pos.y + 0.3], spread: [0.2, 0.2, 0.2], vel: [0, 1.6, 0], velSpread: [1.6, 1.2, 0.8],
        color: FIRE, size: 0.07, life: 0.5, count: 14, drag: 1.4, intensity: 2.6,
      });
      if (!was && this.weak) this.tell('weak', 'The Golem\'s cracked ankle buckles: one more walk on it and it gives way', 'red');
      return true;
    }
    // anywhere else on him: the stone turns it
    const front = (b.pos.x - n.pos.x) * n.body.facing;
    if (front > -0.6 && front < b.kind.reach + b.kind.radius && Math.abs(b.pos.y - n.pos.y) < b.kind.depth) {
      this.clang(reach, n.pos.y);
      this.tell('stone', 'Stone turns thy blows: strike the Golem\'s cracked ankle, low on his back leg');
      return true;
    }
    return false;
  }

  // A blow turned by the stone: grey chips and a spark, and nothing more.
  clang(x, z) {
    this.ctx.particles.emit({
      pos: [x, 1.2, z + 0.2], spread: [0.2, 0.3, 0.2], vel: [0, 1.2, 0], velSpread: [1.4, 1, 0.8],
      color: [...STONE, '#ffe6b0'], size: 0.06, life: 0.4, count: 10, drag: 1.6, intensity: 1.2,
    });
  }

  // Where a fighter goes to strike, and whether it's there: beside the cracked ankle (behind him),
  // or, while he lies felled, into the circle by his chest.
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
    const gx = ax - b.body.facing * 1.1;
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
      if (this.fireIn <= 0) move = 'fire';
      else if (this.slamIn <= 0 || f.foesWithin(b, 5) >= 3) move = 'slam';
      else if (ahead && inLane && ax < 7.5) move = Math.random() < 0.65 ? 'swing' : 'lunge';
      else if (ahead && inLane && ax < 15) move = 'lunge';
      else if (b.idleT > 6) move = 'slam';
      if (move) {
        if (move === 'fire') { this.fireIn = rand(...GOLEM.fireEvery); this.slamIn = Math.max(this.slamIn, 8); }
        if (move === 'slam') this.slamIn = rand(...GOLEM.slamEvery);
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
    this.ctx.particles.emit({
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
    this.tell('fall', 'The Golem falls! Strike the fire in his chest from within the golden circle', 'gold');
  }

  // Falling, felled, getting up (fight.stepBoss, for these states).
  stepState(dt) {
    const b = this.b;
    const { rig } = this.ctx;
    if (b.state === 'falling') {
      if (b.t >= 1.35) {
        b.state = 'down';
        b.t = 0;
        b.pose('down');
        rig.shake?.(0.35);
        this.dust(this.spot(SPOTS.heart)[0], b.pos.y, 3.5, 60);
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
    this.heart = { x, z, r, decal: new Decal(this.ctx.scene, 'heart', x, z, r * 2 * 96 / 90) };
  }

  closeHeart() {
    this.heart?.decal.dispose();
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
    } else {
      // the slam, and the fire (which begins as one): shockwaves no running escapes; hop them
      [a.ix] = this.spot(SPOTS.slam);
    }
    b.attack = a;
    b.state = 'attack';
    b.idleT = 0;
    this.nextStep();
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
    if (a.kind === 'fire' && a.step === 2) {
      // gathering the fire: he shakes side to side
      jitter = (Math.floor(a.t * 20) % 2 ? 1 : -1) * 0.12;
      if (Math.random() < dt * 20) {
        const [cx, cy] = this.spot(SPOTS.chest);
        this.ctx.particles.emit({
          pos: [cx, cy, b.pos.y + 0.3], spread: [0.6, 0.6, 0.3], vel: [0, 1.5, 0], velSpread: [1, 1, 0.6],
          color: FIRE, size: 0.08, life: 0.5, count: 4, drag: 1, intensity: 2.4,
        });
      }
    }
    if (a.kind === 'fire' && a.step === 3) this.spit(dt, a);
    if (k >= 1) this.nextStep();
    return jitter;
  }

  nextStep() {
    const b = this.b;
    const a = b.attack;
    const { scene, rig } = this.ctx;
    a.step += 1;
    a.t = 0;
    const steps = GOLEM_MOVES[a.kind].steps;
    if (a.step >= steps.length) {
      b.endMove();
      b.state = 'ready';
      b.cd = rand(1.2, 2.2);
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
        for (const m of b.marks) m.dispose();
        b.marks = [];
        this.fight.strike((px, pz) => Math.hypot(px - a.ix, pz - z) <= GOLEM.swing.r, H.swing);
        this.groundHit(a.ix, z, GOLEM.wave.swing, H.wave, 0.35);
        break;
      }
      case 'lunge:1': {
        // the thrust, to the point and far past it: a shock in the air flying on
        const [tip, ty] = this.spot(SPOTS.lunge);
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
        this.ctx.particles.emit({
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
        for (const m of b.marks) m.dispose();
        b.marks = [];
        this.groundHit(a.ix, z, GOLEM.wave.slam, H.slam, 0.3);
        break;
      case 'slam:5':
        // the last: the whole arena
        this.groundHit(a.ix, z, GOLEM.wave.last, H.last, 0.6);
        break;
      case 'fire:1': {
        // the pole driven into the ground, and left there: no shockwave, only the crack
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
      case 'fire:5':
        // he takes it up again
        this.dropAxe();
        break;
      default:
        break;
    }
  }

  // Where the axe (or the pole) strikes the ground: a crack, dust, a shake, and a shockwave.
  groundHit(x, z, R, dmg, shake) {
    this.crack(x, z, 7);
    this.dust(x, z, 1.6, 50);
    this.ctx.rig.shake?.(shake);
    this.wave(x, z, R, dmg);
  }

  crack(x, z, life) {
    const crack = new Decal(this.ctx.scene, 'crack', x, z, 4.6, { glow: false });
    let t = 0;
    this.fight.fx.push({
      step: (dt) => { t += dt; crack.opacity = Math.min(1, Math.max(0, (life - t) / 2)); return t < life; },
      dispose: () => crack.dispose(),
    });
  }

  dust(x, z, r, count) {
    this.ctx.particles.emit({
      pos: [x, 0.3, z], spread: [r, 0.2, r * 0.6], vel: [0, 2.2, 0], velSpread: [3, 1.6, 2],
      color: ['#6a5a4e', '#3a2e28', '#8a7a6a'], size: 0.16, life: 1.1, count, drag: 1.3, intensity: 0.8,
    });
  }

  // A shockwave rolling out from (x, z) to radius R: each it reaches as it passes is hurt once,
  // unless dodging (thee) or in the air (a fighter hopping it, which most do).
  wave(x, z, R, dmg) {
    const { speed, band } = GOLEM.wave;
    const w = new Shockwave(this.ctx.scene, x, z, R, { speed });
    const seen = new Set();
    const decided = new Set();
    const fight = this.fight;
    const { particles, director } = this.ctx;
    this.fight.fx.push({
      step: (dt) => {
        const on = w.step(dt);
        const r = w.r;
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
        // dust thrown up along its front
        if (on && Math.random() < 0.9) {
          const ang = Math.random() * Math.PI * 2;
          particles.emit({
            pos: [x + Math.cos(ang) * r, 0.2, z + Math.sin(ang) * r], spread: [0.3, 0.1, 0.3], vel: [Math.cos(ang) * 2, 1.4, Math.sin(ang) * 2],
            velSpread: [0.6, 0.6, 0.6], color: ['#8a7a6a', '#5a4a3e', '#c8b8a0'], size: 0.14, life: 0.7, count: 3, drag: 1.4, intensity: 0.9,
          });
        }
        return on;
      },
      dispose: () => w.dispose(),
    });
  }

  // Spitting fire: a fountain of it from his chest, and meteors falling all over the arena.
  spit(dt, a) {
    const b = this.b;
    const [cx, cy] = this.spot(SPOTS.chest);
    if (Math.random() < dt * 40) {
      this.ctx.particles.emit({
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
    const { scene, particles, world, rig } = this.ctx;
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
          // it lands: fire bursts, the stone cracks, and all on the mark suffer
          landed = true;
          rock.mesh.visible = false;
          const i = a.opt.spots.indexOf(spot);
          if (i >= 0) a.opt.spots.splice(i, 1);
          this.fight.strike((px, pz) => Math.hypot(px - x, pz - z) <= M.r, GOLEM.hurt.meteor);
          particles.emit({
            pos: [x, 0.4, z], spread: [0.6, 0.3, 0.5], vel: [0, 4, 0], velSpread: [3.5, 2.5, 2.5],
            color: FIRE, size: 0.14, life: 0.8, count: 34, gravity: 7, drag: 0.6, intensity: 2.8,
          });
          this.crack(x, z, 4);
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
  }

  dispose() {
    this.dropAxe();
    this.closeHeart();
  }
}

// Whether the lunge's thrust (`a`, out to `reach`) covers a point.
function covers(a, px, pz, reach) {
  const along = (px - a.x) * a.dir;
  return along >= -0.5 && along <= reach && Math.abs(pz - a.z) <= GOLEM.lunge.half;
}
