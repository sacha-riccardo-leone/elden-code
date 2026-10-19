// Great enemies, fought in the Arena of Trials north of Roundtable Hold (arena.js).
//
// One comes when summoned at the Round Table, invades by itself now and then, and answers a Claude
// Code session in trouble: tool calls failing one after another, a session ending in failure, or a
// single quest dragging on. As it comes, thou choosest who fights beside thee (up to four, or more
// if thou wilt: companions.js), and only once thou callest for the fight does the arena rise from
// the mist; then thy companions drop what they're doing and come, thou too, as whoever thou art
// (the others carry on with their work). The mages keep their distance and cast
// (the Rune Lord, the Glintstone Witch, Vael, the Eternal Queen), the rest close in with blade,
// spear or hammer, and Fortuna does both (combat.js; thou, as a mage, castest with a click, and as
// Fortuna with the right button). Every blow that lands fills the striker's ultimate, loosed (R,
// for thee) in a moment when the world stands still (ults.js). Thy blows and everyone's wear it
// down, but whoever keeps wounding Fenrath from afar draws him: he goes for them, and comes down
// on them with his leap (HUNT). A session that summoned it fells it at once by fulfilling its next
// quest. A Tarnished who falls is out of the fight for good: it goes by
// grace to the Hold and rests there until the fight is over. Fall thyself, and thou choosest one of
// the fighters still standing to carry on as; when nobody is left standing on the arena, the fight
// is lost. (The Bandit Knight, Elden Ring's Patches in all but name, never fights: he keeps as far
// from the enemy as he can.) Nothing here ever reaches Claude Code.
//
// Two great enemies, one or the other by chance (KINDS): Fenrath, the Crimson Fang, below, and the
// Guardian Golem, whose fight is golem.js. Fenrath (heroes/boss.js): every blow of his shows itself
// before it lands (bossfx.js): step out of its way, or dodge through it (Space).
//   swing – the greatsword raised and brought down: a crescent of red light flies on down his lane;
//   lunge – a thrust: a lance of light runs along the blade and far past its point;
//   slam  – a ring of light gathers round him for a moment, then fills: all inside it suffer;
//   leap  – beset (crowded, or battered) or rooted too long in one place, he crouches trembling,
//           marks where he'll come down, leaps, and lands in a crack of stone and flying debris;
//   wrath – his great attack, now and then: he roars at the sky (shockwaves bending the air round
//           his head, and the world going black round everyone on the arena and the marks on
//           its floor), leaps up over the middle of the arena and hangs there facing thee, while
//           a ghost of his greatsword, red and
//           see-through, grows huge beside him and cuts down one half of the arena, then the
//           other (each marked first: get across, or dodge through it); then he comes down into
//           the middle, and the ring round him erupts: only the golden circle by him is safe.

import * as THREE from 'three';
import { ARENA, HUB, HUB_LAYOUT, CROWD, LINE, BOSS_CAM } from './config.js';
import { SpriteBody } from './npc.js';
import { Crescent, Decal, Spike, GhostSword, Eruption, RED_LIGHT } from './bossfx.js';
import { flash } from './lights.js';
import { fxArt } from './fxart.js';
import { Spark } from './spellfx.js';
import { GOLEM, GOLEM_MOVES, GolemMind } from './golem.js';
import { setFoe } from './voices.js';
import { clearRipples, rippleAt, stepRipples } from './ripple.js';
import { groundAt } from './ground.js';
import { styleOf, blow, castSpell, muzzleOf, SPELL, RANGED, ultFill, heldAt, paceAt, rootedAt, stepStatus, standOff, castPause, AIM, aimOf, aimSpell, onAim, meets, wayOf, muzzleSpot, struckOf } from './combat.js';

// reach/radius: how far a blow may land from his middle (his long body runs from tail to snout);
// lane: how far out of his line (in depth) a swing or a lunge still catches someone
const BOSS = { hp: 8000, speed: 2.2, reach: 3.0, radius: 2.0, lane: 1.3 };
const DAMAGE = { player: 55, fighter: 16, quest: 0.5 }; // quest: the share of its health a fulfilled quest takes
// Whoever keeps wounding Fenrath from afar (`from` metres off, or more) draws him: what they've
// dealt him so lately (halving every `half` seconds), `per` metre for each point, brings them up
// to `most` metres nearer in his eyes (target); past `leap` of it, and `far` off, he comes down on
// them with his leap (think).
const HUNT = { from: 5.5, half: 5, per: 0.04, most: 8, leap: 60, far: 7 };
const HURT = { swing: 22, lunge: 28, slam: 34, leap: 30, cut: 26, ring: 34 }; // to thee (of 100); fighters take as much
// How a blow shows (impact): how far his drawing is knocked back (world units: by thy blow, by
// another's, by a spell or an ultimate's, by a heavy one), how long the world holds still (seconds:
// for thy blow, thy spell, a heavy one), how far the view is pushed, how hard it shakes on a heavy
// one, and what makes an ultimate's blow heavy (its share of his health). Struck thyself (wounded):
// thy drawing knocked back, the world held, the view pushed and shaken (a fighter: knocked back).
const IMPACT = {
  knock: { mine: 0.2, blow: 0.1, spell: 0.1, ult: 0.15, heavy: 0.32 },
  stop: { blow: 0.055, spell: 0.035, heavy: 0.11 },
  punch: { blow: 0.12, spell: 0.06, ult: 0, heavy: 0.22 },
  shake: 0.18,
  heavy: 0.02,
  lag: 0.55, // (seconds the chunk he just lost waits, white, on his bar after the last wound…)
  most: 1.4, // (…and at most after the first)
  wounded: { knock: 0.25, stop: 0.08, punch: 0.2, shake: 0.22 },
};
// Each move: its drawings and how long each is held (seconds; `true`: fixed, else it quickens
// when he's wounded); `danger`: the last step during which it can still be escaped.
const MOVES = {
  swing: { steps: [['swing-1', 0.6], ['swing-2', 0.25], ['swing-3', 0.6]], danger: 2 },
  lunge: { steps: [['lunge-1', 0.65], ['lunge-2', 0.35], ['lunge-3', 0.6]], danger: 1 },
  slam: { steps: [['slam-1', 1.2, true], ['slam-2', 0.45], ['slam-3', 0.7]], danger: 1 },
  leap: { steps: [['jump-1', 1, true], ['jump-2', 0.45, true], ['jump-3', 0.4, true], ['jump-4', 0.7]], danger: 3 },
  // the roar; he crouches and leaps up over the middle of the arena; there the ghost sword grows and
  // the first half is marked; the cut; it swings over to the other side, marked; the cut; the ring
  // marked round the golden circle; down he comes; landed, the ring pulsing; it erupts
  wrath: {
    steps: [
      ['roar', 2, true], ['jump-1', 0.45, true], ['jump-2', 0.55, true],
      ['float', 1.8, true], ['float', 0.35, true], ['float', 1.8, true], ['float', 0.35, true], ['float', 0.6, true],
      ['jump-3', 0.5, true], ['jump-4', 1.9, true], ['jump-4', 0.9, true],
    ],
    danger: 10,
  },
};
const CRESCENT = { from: 1.2, y: 3, size: 6, speed: 15, life: 0.5, half: 1.6, lane: 1.6 }; // starts `from` ahead of him
const SPIKE = { from: 3.9, y: 3.2, len: 9, life: 0.75, slide: 2.2 }; // from the guard; he slides `slide` into it
const SLAM = { r: 5.5 };
// What Fenrath says, seldom: as he enters, now and then while he stalks, a grunt now and then as
// he leaps and lands, and, left facing only the Bandit Knight, his disbelief (*asterisks*: a sound
// or a look rather than words).
const SAYS = {
  enter: ['Thy death resteth close at hand.', 'Another Tarnished, come to die.'],
  stalk: ['*grunts*', '*heavy breathing*', 'Serve my will alone, O blade.', 'Thy death resteth close at hand.', '*a low, rumbling growl*', 'Kneel, Tarnished.'],
  leap: ['*grunts*'],
  alone: ['*looks in disbelief*', 'Coward…'],
};
const pickOf = (list) => list[Math.floor(Math.random() * list.length)];
const LEAP = { r: 3.2, height: 7, cooldown: 10 };
// His great attack (wrath): `first` seconds into the fight, then every `every`. He hangs `height`
// up over the middle of the arena. The ghost of his sword turns about its pommel, `pivot` [aside,
// up] from him; it grows from his own sword's length to `len`, is held ready `ready` (radians) out
// from straight up, and cuts down to `down`. The circle by him that the ring spares: `safe`; the
// ring erupts at `spots` places, each `height` tall, rippling out from it over `ripple` seconds.
// `cam`: how far back the camera pulls meanwhile, to show the whole arena. His roar: a shockwave
// out from his head (`head`: [ahead, up] of his feet) every `every` seconds of it, `count` in all,
// each `life` long, out to `reach` (screen heights), pushing the picture out by `push` (of the
// screen) at first, and jolting the camera (`shake`). The dark (post.js): it falls over `fall`
// seconds from his first roar, slowly at first, each shockwave bending the world still lit ahead
// of it, then rushing out behind the last; it lifts `after` seconds after the ring erupts, over
// `lift`.
const WRATH = {
  first: [30, 40], every: [45, 60],
  roar: { head: [0.3, 7], every: 0.5, count: 4, life: 0.6, reach: 1.1, push: 0.045, shake: 0.3 },
  dark: { fall: 2.2, after: 0.45, lift: 1 },
  height: 3.2,
  sword: { pivot: [2.6, 3.6], len: 15.5, ready: 0.9, down: 2.4, grow: 0.6, swap: 0.6, opacity: 0.42 },
  safe: 5.5,
  erupt: { spots: 110, height: 2.8, ripple: 0.3 },
  cam: 38,
};
// (the marks on the arena floor: drawn out to its edge, a little past where anyone walks)
const FLOOR_R = ARENA.walkRadius + 0.6;

// Why one came, as the banner and the window choosing companions say it.
const WHY = {
  summon: () => 'Summoned at the Round Table',
  invasion: () => 'It came of its own accord',
  errors: (c) => (c.npc ? `Drawn by ${c.npc.name.first}'s failing rites` : 'Drawn by failing rites'),
  failure: (c) => (c.npc ? `Drawn by ${c.npc.name.first}'s fall` : 'Drawn by a fall'),
  long: (c) => (c.npc ? `Drawn by ${c.npc.name.first}'s endless quest` : 'Drawn by an endless quest'),
};
const whyOf = (cause) => WHY[cause.kind]?.(cause) || '';

// The great enemies (Fight.call picks one by chance, of those whose art loaded): his art
// (ctx[sheet]), health, pace and bulk (reach/radius/lane as BOSS's; depth: how far out of his
// line, in depth, thy blow still lands on him; spacing: how far off he stands to strike; crowd:
// his circle on the floor, crowd.js; shadow: its width and depth, and how far behind his feet it
// lies), his moves, the camera as it frames him (how far back it pulls, how high it looks) and what
// he says. `Mind`: his own fight, where it isn't Fenrath's.
const KINDS = {
  fenrath: {
    sheet: 'bossSheet', ...BOSS, depth: 1.9, spacing: 4, crowd: CROWD.bossRadius, shadow: [3.6, 2.6, 0.55],
    cam: { far: BOSS_CAM.far, y: 2.6 }, moves: MOVES, says: SAYS,
  },
  golem: {
    sheet: 'golemSheet', hp: GOLEM.hp, speed: GOLEM.speed, reach: 3.4, radius: 2.0, lane: 1.6, depth: 2.2, spacing: 4.4,
    crowd: CROWD.golemRadius, shadow: [4.4, 3.0], cam: { far: BOSS_CAM.far * 1.3, y: 3.6 }, moves: GOLEM_MOVES, says: {},
    Mind: GolemMind,
    ultFill: 0.6, // (his stone takes little from blows: ultimates, which wound him whole, fill sooner)
  },
};
const TRIGGER = {
  failures: 3, failureWindow: 120, // tool failures in a row (seconds) that summon one
  longQuest: 600,                  // seconds a single quest may run before one comes
  invasion: [20 * 60, 40 * 60],    // seconds between invasions
  cooldown: 6 * 60,                // quiet time after a fight before anything (but a summons) brings another
  timeout: 8 * 60,                 // a fight left this long ends with the enemy withdrawing
  noShow: 150,                     // seconds the enemy waits for thee to reach the arena before turning away
};
const rand = (a, b) => a + Math.random() * (b - a);

// Whether a blow (its shape, where it lands) covers a point, with some slack: a disc, a line
// running `dir`-ward from (x, z), `from`..`len` along it and `half` either side, a scatter of
// discs (`spots`, each of radius r), one half of the arena, its middle line through (x, z) (`side`:
// -1 the left, 1 the right), or all of it but the circle round (x, z) (a ring: `safe`, its radius).
function covers(shape, x, z, opt, px, pz, slack = 0.3) {
  // (the Golem's shockwaves: no running from them, they're hopped, golem.js; his roll: nothing to run from)
  if (shape === 'wave' || shape === 'none') return false;
  if (shape === 'spots') return opt.spots.some(([sx, sz]) => Math.hypot(px - sx, pz - sz) <= opt.r + slack);
  if (shape === 'half') return (px - x) * opt.side >= -slack;
  if (shape === 'ring') return Math.hypot(px - x, pz - z) >= opt.safe - slack;
  if (shape === 'line') {
    const along = (px - x) * opt.dir;
    return along >= opt.from - slack && along <= opt.len + slack && Math.abs(pz - z) <= opt.half + slack;
  }
  return Math.hypot(px - x, (pz - z) * 1.15) <= opt.r + slack;
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
  constructor(ctx, x, z, kind) {
    this.ctx = ctx;
    this.kind = KINDS[kind];
    const sheet = ctx[this.kind.sheet]; // (no fight is ever started without it: Fight.start)
    this.name = sheet.rig.epithet ? `${sheet.rig.firstName}, ${sheet.rig.epithet}` : sheet.rig.firstName;
    // (a drawing whose middle isn't his: the frame is set that far ahead of him, heroes/golem.js)
    this.offset = (sheet.rig.offset || 0) * sheet.px;
    this.body = new SpriteBody(ctx.scene, sheet);
    this.body.mat.transparent = true;
    this.body.blob.material.map = shadowTex();
    this.body.blob.material.opacity = 1;
    this.pose('idle');
    this.pos = new THREE.Vector2(x, z);
    this.lift = 0;
    this.hp = this.kind.hp;
    this.max = this.kind.hp;
    this.fade = 0;
    this.state = 'enter'; // enter, ready, attack, staggered, dying, withdraw, gone (the Golem: falling, down, rising too)
    this.mind = null; // his own fight, where it isn't Fenrath's (Fight.update)
    this.t = 0;
    this.cd = 2.5; // until the next blow
    this.slamIn = rand(10, 14); // until he'd rather slam
    this.wrathIn = rand(...WRATH.first); // until his great attack
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
  get dead() { return this.state === 'gone'; }

  // Where his words show (ui.say): over his head, wherever his leap has him.
  head() {
    const s = this.body.sheet;
    return new THREE.Vector3(this.pos.x, groundAt(this.pos.x, this.pos.y) + this.lift + s.head * s.px, this.pos.y);
  }

  // One of his drawings.
  pose(name, restart = false) {
    this.body.play(name, restart);
  }

  damage(n) {
    if (!this.alive || this.state === 'enter' || this.mind?.immune()) return 0;
    const dealt = Math.min(this.hp, n * (this.state === 'staggered' ? 1.5 : 1));
    this.hp -= dealt;
    this.posture += dealt;
    this.hurtLog.push([performance.now() / 1000, dealt]);
    const airborne = (this.attack?.kind === 'leap' && this.attack.step >= 1 && this.attack.step <= 2) || !!this.attack?.air;
    if (this.hp <= 0) {
      const lying = this.mind?.lying;
      this.mind?.dies?.(lying);
      this.state = 'dying';
      this.t = 0;
      this.endMove();
      this.mind?.closeHeart();
      this.pose(lying ? 'down' : 'collapse', true);
    } else if (!this.mind && this.posture > 420 && this.state !== 'staggered' && !airborne) {
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
    this.mind?.endMove();
  }

  dispose() {
    this.endMove();
    this.mind?.dispose();
    this.body.dispose();
  }
}

export class Fight {
  constructor(ctx) {
    this.ctx = ctx;
    this.state = 'idle'; // idle, rising, gathering, fighting, won, ending
    this.sealed = false; // thou in the arena with him, the way out walled with fog (update)
    this.focus = false; // the camera on him (Q), or on thee
    this.introUntil = 0; // till then, as he enters, it shows him
    this.boss = null;
    this.fx = []; // his magic, living on by itself: flying crescents, lances, fading light, cracks
    this.rings = []; // his roar's shockwaves (stepDark)
    this.dark = null; // his great attack's dark, falling or lifting (stepDark)
    // The arena's floor stands higher than the Hold's (ARENA.y): what's loosed on it is set in a
    // group raised to it, and its particles are raised to the ground under them (ground.js), so
    // that all of it is placed from the floor, as ever (the Golem's too, golem.js).
    const floor = new THREE.Group();
    floor.position.y = ARENA.y;
    floor.userData.floor = true; // (lit through his great attack's dark, post.js)
    ctx.scene.add(floor);
    const raised = (p) => [p[0], p[1] + groundAt(p[0], p[2]), p[2]];
    this.floor = {
      scene: floor,
      particles: {
        emit: (o) => ctx.particles.emit({ ...o, pos: raised(o.pos), attract: o.attract && { ...o.attract, y: o.attract.y + groundAt(o.attract.x, o.attract.z) } }),
      },
    };
    // (and the Tarnished's spells and ultimates, spellfx.js: they're handed this to live in; thine
    // off the arena, one set at the ground under thee: fxFor)
    this.fxCtx = { scene: floor, particles: this.floor.particles, add: (e) => this.fx.push(e) };
    this.loose = new Map(); // ground height -> its fxCtx
    this.cause = null;
    this.calling = null; // one coming, while thou choosest thy companions: { cause, kind, at }
    this.companions = new Set(); // those thou took with thee into the fight
    this.quietUntil = 0;
    this.trigger = { ...TRIGGER }; // (the public demo quickens it: pace())
    this.nextInvasion = rand(...this.trigger.invasion);
    this.failures = new Map(); // sid -> recent failure times
    this.longDone = new Set(); // quests (sid:start) that already brought one
    this.t = 0;
    this.clock = 0;
    this.lagHp = 0;
    this.lastHurt = -9; // when he was last wounded (the chunk lost waits a moment on his bar)
    this.stop = 0; // the world held still a moment for a blow (hit-stop: held), in real seconds
    this.ui = {
      boss: document.getElementById('boss'),
      bossName: document.querySelector('#boss h4'),
      bossHp: document.querySelector('#boss .hp'),
      bossLag: document.querySelector('#boss .lag'),
      bossDmg: document.querySelector('#boss .dmg'),
      hp: document.getElementById('hp'),
      hpBar: document.querySelector('#hp i'),
      ult: document.getElementById('ult'),
      ultBar: document.querySelector('#ult i'),
      party: document.getElementById('party'),
      focusHint: document.getElementById('focus-hint'),
      hurt: document.getElementById('hurt'),
      carry: document.getElementById('carry'),
      carryList: document.querySelector('#carry .list'),
    };
    this.ui.focusHint.addEventListener('click', () => this.toggleFocus());
    this.dmgShown = 0;
    this.dmgUntil = 0;
    this.fallen = 0; // Tarnished fallen (for good) in this fight
    this.partyRows = new Map(); // npc -> its row under thy health (updateParty)
    this.says = []; // his words to come: { at, text } (say)
  }

  get active() { return this.state !== 'idle'; }

  // A great enemy abroad, still to be fought: from his coming till he's beaten, wins or goes.
  hunting() {
    return this.state === 'rising' || this.state === 'gathering' || this.state === 'fighting';
  }

  // Where the way to him ends: the arena's arrival point, once it has risen (till then, the foot of
  // its bridge on the Hold's north edge).
  destination() {
    const arena = this.ctx.world.arena;
    return arena.risen ? arena.point('grace') : [0, -HUB.walkRadius + 1];
  }

  // A livelier pace for the public demo: invasions sooner and more often, shorter rests between.
  pace({ first, invasion, cooldown }) {
    Object.assign(this.trigger, { invasion, cooldown });
    this.nextInvasion = this.clock + first;
  }

  // Why one can't be summoned now (or true).
  canSummon() {
    if (!this.kinds().length) return 'No great enemy walks these lands';
    if (this.state === 'ending') return 'The arena is still settling';
    if (this.active) return 'A great enemy is already abroad';
    if (this.calling) return 'A great enemy is already coming';
    return true;
  }

  // The great enemies whose art loaded (should one's fail, only the other comes).
  kinds() {
    return Object.keys(KINDS).filter((k) => this.ctx[KINDS[k].sheet]);
  }

  // ------------------------------------------------------------------------------------------
  // what brings one

  // One is coming (summoned at the Round Table, or of its own accord): first, whom thou takest with
  // thee (companions.js, which tells who it is and why it came). The arena rises only once thou
  // callest for the fight. Turned down, a summons is simply let be; one that came of its own accord,
  // turned down or left unanswered as long as it would wait on the arena (update), turns away.
  call(cause) {
    // only the user's own great enemies ever come: without their art (it failed to load), none do
    const kinds = this.kinds();
    if (this.active || this.calling || !kinds.length) return false;
    const kind = pickOf(kinds); // (an even chance of either)
    const rig = this.ctx[KINDS[kind].sheet]?.rig;
    const foe = rig ? [rig.firstName, rig.epithet].filter(Boolean).join(', ') : 'A great enemy';
    const call = { cause, kind, at: this.clock };
    this.calling = call;
    this.ctx.companions.ask({ foe, why: whyOf(cause) }).then((party) => {
      if (this.calling !== call) return;
      this.calling = null;
      if (party) this.start(cause, party, kind);
      else if (cause.kind !== 'summon') this.turnAway();
    });
    return true;
  }

  // Unanswered: it goes its way, and the Lands Between are left in peace a while.
  turnAway() {
    const { ui, world } = this.ctx;
    ui.banner('The Great Enemy Turns Away', 'No challenger came', 'red');
    ui.log('No challenger came: the great enemy turns away', 'dim', { region: world.arena });
    this.quietUntil = this.clock + this.trigger.cooldown;
  }

  // The fight is called: the arena rises, and `party` (thy companions) will come to it.
  start(cause, party = [], kind = null) {
    const kinds = this.kinds();
    if (this.active || !kinds.length) return false;
    const { ui, world } = this.ctx;
    this.kind = kinds.includes(kind) ? kind : pickOf(kinds);
    setFoe(this.kind); // (the Tarnished's lines about him, voices.js)
    this.companions = new Set(party);
    this.cause = cause;
    this.fallen = 0;
    this.cowardsAlone = null;
    this.hinted = false;
    this.state = 'rising';
    this.t = 0;
    if (this.kind === 'golem') this.ctx.sound?.load('golem'); // (his sounds, ready by the time he comes: golem.js)
    world.arena.raise();
    ui.banner('A Great Enemy Approaches', `${whyOf(cause)} · Face it in the Arena of Trials`, 'red');
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
      this.call({ kind: 'errors', npc, sid: npc.sid });
    }
  }

  noteFall(npc) {
    if (this.auto()) this.call({ kind: 'failure', npc, sid: npc.sid });
  }

  // From the director: a quest was fulfilled. If it's the session that brought the enemy, it reels.
  noteDone(npc) {
    const b = this.boss;
    if (!b || !b.alive || this.cause?.sid !== npc.sid) return;
    b.damage(b.max * DAMAGE.quest);
    this.ctx.ui.log(`${npc.name.first} fulfils the quest: the great enemy reels`, 'gold', npc);
  }

  auto() {
    return !this.active && !this.calling && this.clock >= this.quietUntil;
  }

  watchQuests() {
    const d = this.ctx.director;
    const now = performance.now() / 1000;
    for (const [sid, start] of d.questStart) {
      const key = `${sid}:${start}`;
      if (now - start < this.trigger.longQuest || this.longDone.has(key)) continue;
      this.longDone.add(key);
      const npc = d.npcs.get(sid);
      if (npc && this.auto()) this.call({ kind: 'long', npc, sid });
    }
  }

  // ------------------------------------------------------------------------------------------
  // everyone to the arena, and home again

  // Thy companions drop what they're doing and come (thou, whoever thou art, comest on foot).
  gather() {
    const { director, world } = this.ctx;
    const [ax, az] = world.arena.point('grace');
    let k = 0;
    for (const n of director.npcs.values()) {
      if (!this.companions.has(n) || n.dead || n.piloted || n.spectre || n.intent.kind === 'leave') continue;
      n.resume = n.intent.kind === 'fight' ? n.resume : n.intent;
      if (n.slot) n.releaseSlot();
      n.slot = null;
      n.path = [];
      n.goal = null;
      n.talk = null;
      n.inTalk = false;
      if (n.action?.kind !== 'transform') n.action = null;
      n.intent = { kind: 'fight' };
      n.setSpirits(0); // (the spirit ashes of its work wait out the fight)
      n.clearIcon(); // (and the signs over its head: the "!" of one kneeling at its gate comes back after)
      n.clearPersistentIcon();
      n.fighter = {
        line: k, // their place in the line they wait in (lineSpot)
        hp: 100, down: 0, cd: rand(1.5, 4), angle: (k * 2.4) % (Math.PI * 2),
        ring: 4.6 + (k % 3) * 0.8, dir: k % 2 ? 1 : -1, mode: 'circle', modeT: 0, vx: 0, vz: 0, speed: 0,
        coward: n.hero?.hero === 'bandit', // the Bandit Knight (Patches, really) never fights: he keeps his distance, and whines
        ult: 0, // its ultimate, filling with every blow that lands (ults.js)
        ranged: Math.random() < 0.5, // (Fortuna: frost from afar next, or her blade)
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
      n.setSpirits(n.session?.spirits || 0);
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

  // Thy blow lands (pilot.js → director.strikeFrom): the enemy, if he stands on its line within
  // reach (or a little off it: combat.js, AIM).
  strikeFrom(p) {
    const b = this.boss;
    if (!b || !b.alive || b.lift > 2) return false;
    if (b.mind) return b.mind.playerBlow(p); // (the Golem: only his weak points, golem.js)
    if (onAim(p.pos.x, p.pos.y, wayOf(p), b.pos.x, b.pos.y, b.kind.radius, b.kind.depth, b.kind.reach, AIM.blow) == null) return false;
    this.hit(b, DAMAGE.player, null, p, true, 'blow');
    return true;
  }

  // A blow wounds him (`at`: where it shows, if not his middle); `src`, whoever struck it, has
  // its ultimate filled by what it took (`charge`: not by an ultimate's own wounds, nor a poison's).
  // `how` it was dealt ('blow', 'spell', 'ult'; none for a bleeding or a poison) shows on him (impact).
  hit(b, n, at = null, src = null, charge = true, how = null) {
    const steady = b.state !== 'staggered';
    if (this.lagHp - b.hp < 0.5) this.chunkSince = this.clock; // (a new chunk on his bar begins)
    const dealt = b.damage(n);
    if (!dealt) return;
    this.dmgShown = this.clock < this.dmgUntil ? this.dmgShown + Math.round(dealt) : Math.round(dealt);
    this.dmgUntil = this.clock + 1.6;
    this.lastHurt = this.clock;
    if (how) this.impact(b, src, at, how, dealt, steady && b.state === 'staggered');
    this.floor.particles.emit({
      pos: at || [b.pos.x, 2.2, b.pos.y], spread: [0.5, 0.8, 0.3], vel: [0, 1.4, 0], velSpread: [1.4, 1, 0.8],
      color: ['#ff6a4a', '#ffd2a8', '#a01818'], size: 0.07, life: 0.6, count: 10, drag: 1.2, intensity: 2.2,
    });
    if (charge) this.charge(src, dealt);
    if (charge && src && !b.mind) this.pelted(b, src, dealt);
  }

  // How a blow on him shows (IMPACT): he flashes white and his drawing is knocked back the way it
  // went, and a spark flies where a blade or a fist struck; thine (and the great blows of an
  // ultimate, and the one that breaks his stance) besides hold the world still a moment, as he
  // shudders, and jolt the view the way the blow went. `broke`: it broke his stance.
  impact(b, src, at, how, dealt, broke) {
    const me = this.ctx.pilot.npc;
    const mine = !!src && src === me;
    const dir = src ? Math.sign(b.pos.x - src.pos.x) || src.body.facing : 1; // (the way the blow went)
    const heavy = broke || (how === 'ult' && dealt >= b.max * IMPACT.heavy);
    b.body.flash();
    b.body.knock(heavy ? IMPACT.knock.heavy : mine ? IMPACT.knock.mine : IMPACT.knock[how] ?? IMPACT.knock.blow, dir);
    if (how === 'blow' && src) {
      // (where the blade meets him: between the striker and him, a little nearer him, at the height
      // of the striker's middle)
      const spot = at ? [at[0], at[1], at[2] + 0.3] : [src.pos.x + (b.pos.x - src.pos.x) * 0.6, 1.3 + (src.lift || 0), (src.pos.y + b.pos.y) / 2 + 0.3];
      this.fx.push(new Spark(this.fxCtx, { color: styleOf(src).color, at: spot, dir, size: mine ? 1.7 : 1.2 }));
    }
    const stop = heavy ? IMPACT.stop.heavy : mine ? IMPACT.stop[how] ?? 0 : 0;
    if (stop) {
      this.hitStop(stop);
      b.body.shudder(stop);
      src?.body.stretch(); // (the striker, or the caster whose spell lands as it's cast, held at full stretch meanwhile)
    }
    if (mine || heavy) this.ctx.rig?.punch?.(dir * (heavy ? IMPACT.punch.heavy : IMPACT.punch[how] ?? 0));
    if (heavy) this.ctx.rig?.shake?.(IMPACT.shake);
  }

  // The world holds still `secs` seconds (of real time) as a blow lands (main.js asks held).
  hitStop(secs) {
    this.stop = Math.max(this.stop, secs);
  }

  // Whether the world is held still for a blow just now (counting down the real time `dt`).
  held(dt) {
    if (this.stop <= 0) return false;
    this.stop -= dt;
    return true;
  }

  // How much `n` has lately wounded him from afar (what it dealt, halving every HUNT.half seconds).
  peltOf(b, n) {
    const p = b.pelt?.get(n);
    return p ? p.v * 0.5 ** ((this.clock - p.at) / HUNT.half) : 0;
  }

  pelted(b, n, dealt) {
    if (Math.hypot(n.pos.x - b.pos.x, n.pos.y - b.pos.y) < HUNT.from) return;
    if (!b.pelt) b.pelt = new Map();
    b.pelt.set(n, { v: this.peltOf(b, n) + dealt, at: this.clock });
  }

  // Fills src's ultimate by `amount` (what its blow took; or, where his stone takes little, what
  // the blow was worth: golem.js).
  charge(src, amount) {
    if (!src || amount <= 0) return;
    const pilot = this.ctx.pilot;
    if (src === pilot.npc) pilot.ult = Math.min(1, (pilot.ult || 0) + amount / ultFill(this.boss, true));
    else if (src.fighter && !src.fighter.dead) src.fighter.ult = Math.min(1, src.fighter.ult + amount / ultFill(this.boss));
  }

  // What an ordinary blow (or spell) of n's is worth, toward its ultimate.
  blowWorth(n, spell = false) {
    const mine = n === this.ctx.pilot.npc;
    return spell ? (mine ? SPELL.player : SPELL.npc) : mine ? DAMAGE.player : DAMAGE.fighter;
  }

  // The point of him a spell flies at: his middle (the Golem: his cracked ankle while he stands,
  // the fire in his chest as he lies felled), and his middle at a height, for the ultimates.
  spellPoint() {
    const b = this.boss;
    if (!b) return [0, 0, 0];
    return b.mind?.spellPoint ? b.mind.spellPoint() : [b.pos.x, b.lift + 2.2, b.pos.y + 0.2];
  }

  bossPoint(up = 2) {
    const b = this.boss;
    return b ? [b.pos.x, b.lift + up, b.pos.y + 0.2] : [0, 0, 0];
  }

  // A spell lands on him: as a blow, but from afar (the Golem: on his ankle, or the fire in his
  // chest, golem.js). `share`: how much of an ordinary spell it is; `player`: thine.
  spellHit(n, share, at, player = false) {
    const b = this.boss;
    if (!b || !b.alive) return;
    if (b.mind) b.mind.spellBlow(n, share, player);
    else this.hit(b, share * (player ? SPELL.player : SPELL.npc), at ? [at.x, at.y, at.z] : null, n, true, 'spell');
  }

  // An ultimate wounds him, wherever he stands and whatever he is (but spitting fire, untouchable).
  ultHit(n, amount, at = null) {
    const b = this.boss;
    if (!b || !b.alive) return;
    this.hit(b, amount, at ? [at.x, at.y, at.z] : null, n, false, 'ult');
  }

  // A fighter mage's spell: its own blow played (the staff swung, the fist clenched), the spell
  // loosed at its turn (update, castFrom).
  startCast(n) {
    n.body.facing = this.boss.pos.x > n.pos.x ? 1 : -1;
    blow(n, 'fightCast', { spell: true });
    n.fighter.vx = 0;
    n.fighter.vz = 0;
  }

  castFrom(n) {
    if (!this.boss?.alive) return;
    castSpell(this.fxCtx, n, { target: () => this.spellPoint(), hit: (at, share) => this.spellHit(n, share, at) });
  }

  // Thy spell (pilot.js), the way thou pointest (combat.js, aimSpell): straight along thy line,
  // striking him if he stands on it (or a little off it), else on into nothing.
  playerCast(n, at) {
    const b = this.boss;
    const aim = aimSpell(n, at);
    const live = () => !!b && b.alive && b.state !== 'enter' && this.state === 'fighting' && this.inArena(n) && (b.lift || 0) <= 2;
    const struck = b && struckOf(b);
    aim.meets = (x, z) => (live() && meets(x, z, aim.dir, b.pos.x, b.pos.y, b.kind.radius, b.kind.depth, AIM.spell, AIM.early) ? struck : null);
    aim.first = (reach) => {
      if (!live()) return null;
      const along = onAim(aim.from[0], aim.from[2], aim.dir, b.pos.x, b.pos.y, b.kind.radius, b.kind.depth, reach, AIM.spell);
      if (along == null) return null;
      const [px, , pz] = this.spellPoint(); // (what rises, rises under where a spell strikes him)
      return { along: Math.max(0.5, along), x: px, z: pz, struck };
    };
    castSpell(this.fxFor(n), n, { aim, hit: (p, share) => this.spellHit(n, share, p, true) });
  }

  // Where a spell of thine is set (spellfx.js places all of it from the floor): on the arena's floor,
  // in its group (fxCtx); off it (in the Hold, on a bridge, on the stair up), in one set at the ground
  // under thee, so that it flies at the height it flies at from there, not the arena floor's height
  // above it.
  fxFor(n) {
    const y = Math.round(groundAt(n.pos.x, n.pos.y) * 20) / 20;
    if (Math.abs(y - ARENA.y) < 0.03) return this.fxCtx;
    let fx = this.loose.get(y);
    if (!fx) {
      const g = new THREE.Group();
      g.position.y = y;
      this.ctx.scene.add(g);
      g.updateMatrixWorld(true);
      fx = { scene: g, particles: this.floor.particles, add: (e) => this.fx.push(e) };
      this.loose.set(y, fx);
    }
    return fx;
  }

  // R: thine ultimate, full, loosed (an aimed one the way thou pointest: it finds him only if he
  // stands on that line, or near it).
  playerUlt(at) {
    const { pilot, ults } = this.ctx;
    const n = pilot.npc;
    if (!n || pilot.dead || (pilot.ult || 0) < 1 || !this.inArena(n) || !ults?.ready(n, true)) return false;
    if (n.travel || n.shift || (n.action && !['attack', 'cast', 'hurt', 'crouch', 'use', 'gesture'].includes(n.action.kind))) return false;
    // (an aimed one along the line to the pointer, at the height it goes at)
    const dir = ults.of(n)?.aim ? aimOf(n, at, muzzleSpot(n, 'ult')[1] + (n.lift || 0)) : null;
    return ults.start(n, { dir, player: true });
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
    // (thy drawing white a moment and knocked back, the world held still, the view jolted)
    const away = this.boss ? Math.sign(n.pos.x - this.boss.pos.x) || -n.body.facing : -n.body.facing;
    const W = IMPACT.wounded;
    n.body.flash();
    n.body.knock(W.knock, away);
    this.hitStop(W.stop);
    this.ctx.rig?.punch?.(away * W.punch);
    this.ctx.rig?.shake?.(W.shake);
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
    // (its drawing white a moment and knocked back)
    n.body.flash();
    n.body.knock(IMPACT.wounded.knock * 0.7, this.boss ? Math.sign(n.pos.x - this.boss.pos.x) || -n.body.facing : -n.body.facing);
    if (f.hp <= 0) {
      // fallen for good: a moment where they fell, then by grace to the Hold, out of this fight
      f.dead = true;
      f.down = 3;
      this.fallen += 1;
      n.collapse(3);
      this.ctx.ui.log(`${n.name.first} has fallen`, 'red', n);
      for (const o of this.ctx.director.npcs.values()) {
        if (o !== n && o.fighter?.coward && !o.fighter.dead && !o.piloted) this.ctx.director.remark(o, 'fallen', n, 0.8);
      }
    } else {
      n.stagger();
    }
  }

  // Everyone a blow covers (inside(x, z)): thee, and the fighters. `seen`: those it already struck
  // (a crescent strikes each only once on its way). `ground`: it runs along the floor (a
  // shockwave), passing under whoever is in the air.
  strike(inside, dmg, seen = null, ground = false) {
    const { pilot, director } = this.ctx;
    const take = (n) => {
      if (seen?.has(n) || !inside(n.pos.x, n.pos.y)) return false;
      if (ground && n.lift > 0.3) return false;
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

  // On the ring itself, past the way in (not still on the end of the bridge).
  onRing(n) {
    const { cx, cz } = this.ctx.world.arena;
    return Math.hypot(n.pos.x - cx, n.pos.y - cz) <= ARENA.walkRadius - 0.4;
  }

  // The i-th fighter's place in the line they wait in: right and left wings by turns, outward
  // from the aisle, along a curve that follows the arena's round just inside the way in.
  lineSpot(i) {
    const { cx, cz } = this.ctx.world.arena;
    const r = ARENA.walkRadius - LINE.inset;
    const side = i % 2 ? -1 : 1;
    const s = LINE.aisle / 2 + Math.floor(i / 2) * LINE.spacing;
    const a = Math.PI / 2 - side * (s / r); // (the way in lies due south of the centre: +z)
    return [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
  }

  // Thou art on the arena while he's abroad there: every click is a blow, and nobody can be
  // picked, inspected or carried off (input.js).
  inBattle() {
    const me = this.ctx.pilot.npc;
    return !!me && (this.state === 'gathering' || this.state === 'fighting') && north(me);
  }

  // Where the camera should look while thou fightest him on the arena (main.js), or null:
  // between thee and him, and high enough to keep him whole.
  // While thou fightest him on the arena: as he enters, him; then, with the focus on him (Q), between
  // thee and him; otherwise null (the camera follows thee, as ever). `dist`: how far back it pulls.
  aim(me) {
    const b = this.boss;
    if (!this.facing(me)) return null;
    // his great attack: him as he roars, then the whole arena, from farther back, till the ring
    // has erupted
    if (b.attack?.kind === 'wrath') {
      if (b.attack.step === 0) return { at: [b.pos.x, ARENA.y + 4.2, b.pos.y], dist: BOSS_CAM.far, mode: 'roar' };
      const { cx, cz } = this.ctx.world.arena;
      return { at: [cx, ARENA.y + 2.5, cz], dist: WRATH.cam, mode: 'wide' };
    }
    const { far } = b.kind.cam;
    const y = ARENA.y + b.kind.cam.y; // (above the arena's floor)
    if (this.clock < this.introUntil) return { at: [b.pos.x, y, b.pos.y], dist: far };
    if (this.focus) return { at: [me.pos.x + (b.pos.x - me.pos.x) * 0.45, y, me.pos.y + (b.pos.y - me.pos.y) * 0.45], dist: far };
    return { at: null, dist: BOSS_CAM.near };
  }

  // Thou, up against him on the arena.
  facing(me) {
    const b = this.boss;
    return !!(me && b && b.alive && this.state === 'fighting' && !this.ctx.pilot.dead && this.inArena(me));
  }

  // He says `text` (over his head, in red), `delay` seconds from now. A passing sound or word
  // never cuts short what he said a moment ago, nor his disbelief; an `important` one always comes.
  say(text, delay = 0, important = false) {
    this.says.push({ at: this.clock + delay, text, important });
  }

  stepSays() {
    const b = this.boss;
    if (!b || b.state === 'gone') { this.says = []; return; }
    this.says = this.says.filter((s) => {
      if (this.clock < s.at) return true;
      if (b.state === 'dying' || b.fade < 0.5) return false;
      if (!s.important && (this.clock < (this.hushUntil ?? 0) || this.clock - (this.saidAt ?? -9) < 3)) return false;
      this.ctx.ui.say(b, s.text, Math.min(5, 1.8 + s.text.length * 0.045), 'boss');
      b.lastSaid = s.text;
      this.saidAt = this.clock;
      return false;
    });
  }

  // Q: the camera's focus on him, or back on thee (as he enters: straight to the focus on him).
  toggleFocus() {
    if (!this.facing(this.ctx.pilot.npc)) return;
    this.focusLearned = true; // (thou know'st the key now: the hint is no longer shown)
    if (this.clock < this.introUntil) { this.introUntil = 0; this.focus = true; return; }
    this.focus = !this.focus;
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

  // The nearest foe (thee a little more than the others); and to Fenrath, whoever has been
  // wounding him from afar, the more the more they've dealt (HUNT).
  target(b) {
    const me = this.ctx.pilot.npc;
    let best = null;
    let bd = Infinity;
    for (const n of this.foes()) {
      let d = Math.hypot(n.pos.x - b.pos.x, n.pos.y - b.pos.y) * (n === me ? 0.6 : 1);
      if (!b.mind) d -= Math.min(HUNT.most, this.peltOf(b, n) * HUNT.per);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  // ------------------------------------------------------------------------------------------
  // the enemy's mind

  stepBoss(b, dt, t) {
    // what the ultimates do to him (combat.js): bleeding, poisoned, knocked back, kept in a pool;
    // held still or dazed, he does nothing; slowed, everything he does is slow
    const now = this.clock;
    stepStatus(b, now, dt, { hit: (amount, src) => this.hit(b, amount, null, src, false), shift: (dx, dz) => this.shift(b, dx, dz), particles: this.floor.particles });
    const held = heldAt(b, now) && b.alive;
    const dazed = held && now < b.status.stunUntil;
    const pace = paceAt(b, now);
    const bdt = held ? 0 : dt * pace;
    if (dazed && Math.random() < dt * 14) {
      const a = now * 5 + Math.random();
      this.floor.particles.emit({
        pos: [b.pos.x + Math.cos(a) * 1.1, b.lift + b.body.sheet.head * b.body.sheet.px * 0.85, b.pos.y + Math.sin(a) * 0.4], spread: [0.05, 0.05, 0.05],
        vel: [0, 0.3, 0], velSpread: [0.2, 0.1, 0.2], color: ['#fff3c4', '#ffd75a'], size: 0.09, life: 0.5, count: 1, drag: 1, intensity: 2.6,
      });
    }
    b.t += bdt;
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
          this.floor.particles.emit({
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
          this.floor.particles.emit({
            pos: [b.pos.x, 1.5 + Math.random() * 3, b.pos.y], spread: [1.6, 1, 0.4], vel: [0, 1.2, 0], velSpread: [0.6, 0.6, 0.4],
            color: ['#ffd27a', '#2a1a1a', '#fff1c0'], size: 0.09, life: 1.6, count: 6, drag: 0.6, intensity: 1.8,
          });
        }
        if (b.t >= 3.2) b.state = 'gone';
        break;
      case 'attack':
        if (!held) jitter = b.mind ? b.mind.stepMove(bdt, t, fast) : this.stepMove(b, bdt, t, fast);
        break;
      case 'ready': {
        if (held) {
          if (dazed) b.pose(b.body.sheet.anims.stagger ? 'stagger' : 'idle');
          break;
        }
        moving = b.mind ? b.mind.think(bdt, fast) : this.think(b, bdt, fast);
        // now and then, between blows, a word or a sound (from those that speak)
        const stalk = b.kind.says.stalk;
        b.talkIn = (b.talkIn ?? rand(10, 16)) - dt;
        if (stalk && b.talkIn <= 0) {
          b.talkIn = rand(14, 24);
          this.say(pickOf(stalk.filter((x) => x !== b.lastSaid)));
        }
        break;
      }
      default:
        b.mind?.stepState(bdt); // (the Golem falling, felled, getting up)
        break;
    }
    // where he's been standing: rooted too long and he'll want to leap elsewhere
    if (b.pos.distanceTo(b.anchor) > 3) { b.anchor.copy(b.pos); b.anchorT = 0; } else b.anchorT += dt;
    // (held, he's still as stone; dazed, he sways; slowed, all of him is slow)
    const frame = b.body.tick(held ? (dazed ? dt * 0.4 : 0) : dt * pace, moving ? 0.8 * fast : 0.7);
    if (frame != null) b.mind?.onFrame?.(b.body.anim?.name, frame); // (the Golem's feet set down, his body hitting the floor)
    b.body.place(b.pos.x + jitter + b.body.facing * b.offset, groundAt(b.pos.x, b.pos.y) + rippleAt(b.pos.x, b.pos.y), b.pos.y, b.lift);
    // his shadow: wide and deep (he's long, and heavy), a little smaller the higher he leaps (and
    // longer, the Golem lying on his face); Fenrath's set back under his paws, so they stand in it
    const s = 1 - Math.min(0.3, b.lift * 0.045);
    const [sw, sd, back = 0] = b.kind.shadow;
    const lying = b.mind?.lying ? 1.6 : 1;
    b.body.blob.position.x = b.pos.x + (lying > 1 ? b.body.facing * 1.4 : 0);
    b.body.blob.position.z = b.pos.y + 0.05 - back;
    b.body.blob.position.y = groundAt(b.body.blob.position.x, b.pos.y) + rippleAt(b.body.blob.position.x, b.pos.y) + 0.015;
    b.body.blob.scale.set(sw * s * lying, sd * s, 1);
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
    // beset (crowded, or battered) or rooted: he leaps elsewhere (not out of a pool of blood,
    // combat.js); wounded again and again from afar: he comes down on whoever's doing it
    const beset = close >= 3 || b.taken(5) > 250;
    const prey = this.peltOf(b, tgt) >= HUNT.leap && Math.hypot(dx, dz) > HUNT.far ? tgt : null;
    const stuck = rootedAt(b, this.clock);
    if (stuck) b.leapCd = Math.max(b.leapCd, 0.5);
    // now and then, his great attack (not while a pool of blood keeps him in)
    b.wrathIn -= dt * fast;
    if (b.wrathIn <= 0 && b.cd <= 0.6 && !stuck) {
      b.wrathIn = rand(...WRATH.every);
      this.begin(b, 'wrath');
      return false;
    }
    if (b.leapCd <= 0 && b.cd <= 0.6 && (beset || prey || b.anchorT > 12)) {
      this.begin(b, 'leap', beset && !prey, prey);
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
  begin(b, kind, beset = false, prey = null) {
    const dir = b.body.facing;
    const a = { kind, step: -1, t: 0, dir, x: b.pos.x, z: b.pos.y, shape: 'disc', opt: { r: SLAM.r } };
    if (kind === 'swing') {
      a.shape = 'line';
      a.opt = { dir, from: -0.5, len: CRESCENT.from + CRESCENT.speed * CRESCENT.life + CRESCENT.half, half: CRESCENT.lane };
    } else if (kind === 'lunge') {
      a.shape = 'line';
      a.opt = { dir, from: -0.5, len: SPIKE.slide + SPIKE.from + SPIKE.len, half: BOSS.lane };
    } else if (kind === 'leap') {
      [a.x, a.z] = this.landing(b, beset, prey);
      a.from = b.pos.clone();
      a.opt = { r: LEAP.r };
      if (Math.abs(a.x - b.pos.x) > 0.4) b.body.facing = a.x > b.pos.x ? 1 : -1;
      b.leapCd = LEAP.cooldown;
    } else if (kind === 'wrath') {
      // over the whole arena, from its middle: nothing to get out of yet (marked as it goes on);
      // the half with the more foes in it is cut first (thee counting double)
      const { cx, cz } = this.ctx.world.arena;
      Object.assign(a, { shape: 'none', x: cx, z: cz, opt: {}, from: b.pos.clone() });
      const me = this.ctx.pilot.npc;
      let lean = 0;
      for (const n of this.foes()) lean += Math.sign(n.pos.x - cx) * (n === me ? 2 : 1);
      a.side = lean > 0 ? 1 : lean < 0 ? -1 : Math.random() < 0.5 ? -1 : 1;
      b.leapCd = Math.max(b.leapCd, 4);
    }
    b.attack = a;
    b.state = 'attack';
    b.idleT = 0;
    this.nextStep(b);
  }

  // Where to leap: beset, away from the crowd; rooted, onto someone's doorstep (they'll have to
  // step aside); after whoever's been wounding him from afar, right on top of them (a step short:
  // they've a moment to get out from under him); never just beside where he stands.
  landing(b, beset, prey = null) {
    const { cx, cz } = this.ctx.world.arena;
    for (let i = 0; prey && i < 12; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = 0.8 + Math.random() * 1.2;
      const x = prey.pos.x + Math.cos(ang) * r;
      const z = prey.pos.y + Math.sin(ang) * r;
      if (Math.hypot(x - cx, z - cz) <= ARENA.walkRadius - 2.5) return [x, z];
    }
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
          this.floor.particles.emit({
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
    } else if (a.kind === 'wrath') {
      jitter = this.stepWrath(b, a, k, dt, t);
    }
    if (k >= 1) this.nextStep(b);
    return jitter;
  }

  // His great attack as it goes on: he roars, trembling; flies up over the middle of the arena and
  // hangs there, bobbing, while the ghost of his sword grows, is held ready (quivering), cuts, and
  // swings over to the other side; he comes down. Its marks pulse.
  stepWrath(b, a, k, dt, t) {
    const { cx, cz } = this.ctx.world.arena;
    const S = WRATH.sword;
    let jitter = 0;
    if (a.step === 0) {
      jitter = (Math.floor(a.t * 24) % 2 ? 1 : -1) * 0.05;
      if (Math.random() < dt * 30) {
        this.floor.particles.emit({
          pos: [b.pos.x + b.body.facing * 0.2, 6.8, b.pos.y + 0.3], spread: [0.6, 0.4, 0.3], vel: [0, 2.6, 0], velSpread: [1.4, 1, 0.6],
          color: ['#ff5a3a', '#a01818', '#2a0a0a'], size: 0.11, life: 0.9, count: 3, drag: 0.8, intensity: 2,
        });
      }
      // the roar's shockwaves, one after another
      const R = WRATH.roar;
      a.roars ??= 0;
      if (a.roars < R.count && a.t >= a.roars * R.every) {
        a.roars += 1;
        this.roarRing(b);
      }
    } else if (a.step === 2) {
      // up, and over the middle of the arena
      b.lift = WRATH.height * (1 - (1 - k) ** 2);
      b.pos.set(a.from.x + (cx - a.from.x) * k, a.from.y + (cz - a.from.y) * k);
    } else if (a.step >= 3 && a.step <= 7) {
      b.lift = WRATH.height + Math.sin(t * 2.2) * 0.12;
    } else if (a.step === 8) {
      b.lift = WRATH.height * (1 - k * k);
    }
    // the ghost sword: its angle from straight down, counter-clockwise; held ready (`ready` out from
    // straight up) on side s it's at π - s·ready, and cuts down to π - s·down
    const g = a.ghost;
    if (g) {
      const at = (s, u) => Math.PI - s * u;
      const quiver = Math.sin(t * 23) * 0.015;
      let side = a.side;
      g.trail = 0;
      if (a.step === 3) {
        const e = Math.min(1, a.t / S.grow);
        g.len = a.swordLen + (S.len - a.swordLen) * (1 - (1 - e) ** 3);
        g.opacity = WRATH.sword.opacity * e;
        g.angle = at(side, S.ready) + quiver;
      } else if (a.step === 4 || a.step === 6) {
        if (a.step === 6) side = -a.side;
        g.angle = at(side, S.ready + (S.down - S.ready) * k * k);
        g.trail = -side * 0.13 * Math.min(1, k * 3);
      } else if (a.step === 5) {
        // back up and over to the other side, its pivot with it, then held ready there
        const e = Math.min(1, a.t / S.swap);
        const s = e * e * (3 - 2 * e);
        g.angle = at(a.side, S.down) + (at(-a.side, S.ready) - at(a.side, S.down)) * s + (e >= 1 ? quiver : 0);
        side = s < 0.5 ? a.side : -a.side;
        a.pivotX = cx + a.side * S.pivot[0] * (1 - 2 * s);
        if (e >= 1 && !a.mark) this.markHalf(b, a, -a.side);
      } else if (a.step === 7) {
        side = -a.side;
        g.opacity = WRATH.sword.opacity * (1 - k);
        g.angle = at(side, S.down);
      }
      const px = a.pivotX ?? cx + side * S.pivot[0];
      for (const m of [g.mesh, ...g.copies]) m.position.set(px, b.lift + S.pivot[1], cz + 0.5);
      g.place();
    }
    for (const m of b.marks) if (m.pulse) m.opacity = m.pulse * (0.7 + 0.3 * Math.sin(t * 9));
    return jitter;
  }

  // On to the move's next drawing, and what happens as it's struck.
  nextStep(b) {
    const a = b.attack;
    const { scene, particles } = this.floor;
    const { rig } = this.ctx;
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
        flash(scene, [x, 1.2, z + 0.4], { color: RED_LIGHT, power: 100, reach: SLAM.r * 3, life: 0.7, rise: 0.03 });
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
        if (Math.random() < 0.4) this.say(pickOf(SAYS.leap)); // (a grunt as he springs, now and then)
        particles.emit({
          pos: [x, 0.2, z], spread: [1.6, 0.1, 0.6], vel: [0, 2, 0], velSpread: [2, 1, 1],
          color: ['#6a5a4e', '#3a2e28'], size: 0.12, life: 0.7, count: 24, drag: 1.4, intensity: 0.9,
        });
        break;
      case 'leap:3': {
        // he lands: the stone cracks, debris flies, the ground shakes, and all on the mark suffer
        b.lift = 0;
        if (Math.random() < 0.4) this.say(pickOf(SAYS.leap), 0.15); // (and now and then as he lands)
        b.pos.set(a.x, a.z);
        for (const m of b.marks) m.dispose();
        b.marks = [];
        const crack = new Decal(scene, 'crack', a.x, a.z, LEAP.r * 2.6, { glow: false });
        flash(scene, [a.x, 1, a.z + 0.4], { color: RED_LIGHT, power: 40, reach: 12, life: 0.45 }); // (the red at the cracks' hearts)
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
        if (a.kind === 'wrath') this.wrathStep(b, a);
        break;
    }
  }

  // His great attack, at the turn of each of its steps (nextStep).
  wrathStep(b, a) {
    const { scene, particles } = this.floor;
    const { rig } = this.ctx;
    const { cx, cz } = this.ctx.world.arena;
    switch (a.step) {
      case 0: {
        // he roars at the sky, and the world goes dark round everyone (stepDark)
        const R = WRATH.roar;
        // (seen on the screen: his head, and the arena's middle, as high as they stand)
        const head = new THREE.Vector3(b.pos.x + b.body.facing * R.head[0], R.head[1] + ARENA.y, b.pos.y);
        this.dark = { t: 0, at: head, mid: new THREE.Vector3(cx, 1 + ARENA.y, cz), liftIn: null, lift: null };
        particles.emit({
          pos: [b.pos.x, 0.25, b.pos.y], spread: [3, 0.1, 1.6], vel: [0, 1.2, 0], velSpread: [3.5, 0.6, 2],
          color: ['#5a4a3e', '#3a2e28', '#6a2a2a'], size: 0.14, life: 1, count: 40, drag: 1.4, intensity: 0.9,
        });
        break;
      }
      case 2:
        // up he springs
        a.air = true;
        if (Math.random() < 0.4) this.say(pickOf(SAYS.leap));
        particles.emit({
          pos: [b.pos.x, 0.2, b.pos.y], spread: [1.6, 0.1, 0.6], vel: [0, 2, 0], velSpread: [2, 1, 1],
          color: ['#6a5a4e', '#3a2e28'], size: 0.12, life: 0.7, count: 24, drag: 1.4, intensity: 0.9,
        });
        break;
      case 3: {
        // the ghost of his sword grows beside him, and the half it'll cut is marked
        const art = fxArt('fenrath-sword');
        if (art) {
          a.swordLen = art.h * b.body.sheet.px;
          a.ghost = new GhostSword(scene, art, cx, b.lift + WRATH.sword.pivot[1], cz + 0.5);
          b.marks.push(a.ghost);
        }
        this.markHalf(b, a, a.side);
        this.tell(b, 'cut', 'A ghost of his sword will cut down half the arena: get across to the other half, or dodge through it (Space)');
        break;
      }
      case 4:
        this.hopCut(a.side);
        break;
      case 5:
        // (the other half is marked once the sword has swung over to it: stepWrath)
        this.cutHalf(b, a, a.side);
        Object.assign(a, { shape: 'none', opt: {} });
        break;
      case 6:
        this.hopCut(-a.side);
        break;
      case 7: {
        this.cutHalf(b, a, -a.side);
        // the ring round the golden circle in the middle, about to erupt
        const ring = new Decal(scene, 'annulus', cx, cz, FLOOR_R * 2 * 96 / 92, { opacity: 0.4, arg: WRATH.safe / FLOOR_R });
        const safe = new Decal(scene, 'heart', cx, cz, WRATH.safe * 2 * 48 / 45, { opacity: 0.9 });
        ring.pulse = 0.45;
        safe.pulse = 0.95;
        a.rings = [ring, safe];
        b.marks.push(ring, safe);
        Object.assign(a, { shape: 'ring', opt: { safe: WRATH.safe }, phase: 3 });
        this.tell(b, 'ring', 'The ring round him will erupt: get into the golden circle by his side');
        break;
      }
      case 8:
        // down he comes (the ghost gone)
        if (a.ghost) this.unmark(b, a.ghost);
        a.ghost = null;
        break;
      case 9: {
        // he lands in the middle: the stone cracks, debris flies, the ground shakes
        b.lift = 0;
        a.air = false;
        b.pos.set(cx, cz);
        const crack = new Decal(scene, 'crack', cx, cz, LEAP.r * 2.6, { glow: false });
        let life = 0;
        this.fx.push({
          step: (dt) => { life += dt; crack.opacity = Math.min(1, Math.max(0, (7 - life) / 2)); return life < 7; },
          dispose: () => crack.dispose(),
        });
        particles.emit({
          pos: [cx, 0.3, cz], spread: [2, 0.2, 1.4], vel: [0, 5.5, 0], velSpread: [5, 2.5, 3.5],
          color: ['#7a6a5c', '#4a3e36', '#9a8a78', '#2a221e'], size: 0.2, life: 1.1, count: 40, gravity: 16, drag: 0.4, intensity: 0.9,
        });
        rig.shake?.(0.4);
        break;
      }
      case 10:
        this.erupt(b, a);
        if (this.dark) this.dark.liftIn = WRATH.dark.after; // (and then the dark lifts)
        break;
      default:
        break;
    }
  }

  // A shockwave of his roar, out from his head (post.js bends the picture round it), jolting the camera.
  roarRing(b) {
    const R = WRATH.roar;
    this.rings.push({ t: 0, at: new THREE.Vector3(b.pos.x + b.body.facing * R.head[0], R.head[1] + ARENA.y, b.pos.y) });
    this.ctx.rig.shake?.(R.shake);
  }

  // His roar's shockwaves and his great attack's dark, as they go on (drawn by post.js, on the
  // screen): each shockwave grows out from his head and fades; the dark falls behind a front
  // spreading out from his head as he roars, and lifts behind one spreading out from the middle
  // of the arena once the ring has erupted (at once, if the attack is cut short).
  stepDark(dt) {
    const { post, rig } = this.ctx;
    if (!post) return;
    const cam = rig.camera;
    cam.updateMatrixWorld(); // (where the camera is this frame, not where it was last drawn)
    const screen = (p) => {
      const v = p.clone().project(cam);
      return [(v.x + 1) / 2, (v.y + 1) / 2];
    };
    // (how far from there the farthest corner of the screen is, in screen heights)
    const reach = ([u, v]) => Math.hypot(Math.max(u, 1 - u) * cam.aspect, Math.max(v, 1 - v)) + 0.15;
    const ease = (k) => k * k * (3 - 2 * k);
    const R = WRATH.roar;
    this.rings = this.rings.filter((r) => (r.t += dt) < R.life);
    post.rings = this.rings.map((r) => {
      const k = r.t / R.life;
      return [...screen(r.at), 0.04 + (R.reach - 0.04) * (1 - (1 - k) ** 2), R.push * (1 - k) ** 1.5];
    });
    const d = this.dark;
    if (!d) { post.dark = null; return; }
    const D = WRATH.dark;
    d.t += dt;
    const b = this.boss;
    const going = !!b?.alive && b.attack?.kind === 'wrath';
    if (!d.lift && (d.liftIn != null ? (d.liftIn -= dt) <= 0 : !going)) d.lift = { t: 0 };
    if (d.lift) {
      d.lift.t += dt;
      const k = Math.min(1, d.lift.t / D.lift);
      const at = screen(d.mid);
      post.dark = { amount: 1, at, front: 99, light: reach(at) * ease(k) };
      if (k >= 1) { this.dark = null; post.dark = null; }
      return;
    }
    const k = Math.min(1, d.t / D.fall);
    const at = screen(d.at);
    post.dark = { amount: 1, at, front: k >= 1 ? 99 : reach(at) * k * k, light: 0 };
  }

  // A word of advice in the log, the first time it's called for in a fight.
  tell(b, key, text) {
    b.told ??= new Set();
    if (b.told.has(key)) return;
    b.told.add(key);
    this.ctx.ui.log(text, 'gold', { region: this.ctx.world.arena });
  }

  // One of his marks, gone before the move is over.
  unmark(b, m) {
    m.dispose();
    const i = b.marks.indexOf(m);
    if (i >= 0) b.marks.splice(i, 1);
  }

  // Half the arena about to be cut (side: -1 the left, 1 the right), marked: what the fighters run from.
  markHalf(b, a, side) {
    const { cx, cz } = this.ctx.world.arena;
    const m = new Decal(this.floor.scene, 'half', cx, cz, FLOOR_R * 2 * 96 / 92, { opacity: 0.38 });
    m.mesh.scale.x = side < 0 ? 1 : -1; // (drawn as the left half)
    m.pulse = 0.42;
    a.mark = m;
    b.marks.push(m);
    Object.assign(a, { shape: 'half', opt: { side }, phase: side === a.side ? 1 : 2 });
  }

  // The cut about to land on that side: the fighters on it who can't get across hop it, mostly (as
  // they hop the Golem's shockwaves).
  hopCut(side) {
    const { cx } = this.ctx.world.arena;
    for (const n of this.ctx.director.npcs.values()) {
      const f = n.fighter;
      if (!f || f.dead || n.travel || n.piloted || f.hop || (n.pos.x - cx) * side < -0.3) continue;
      if (Math.random() < (f.coward ? 0.95 : 0.7)) f.hop = { t: 0, dur: 0.55 };
    }
  }

  // The cut lands: all on that side of the arena (not dodging, nor in the air) suffer; the floor
  // there flares and fades, red embers fly, the ground shakes.
  cutHalf(b, a, side) {
    const { scene, particles } = this.floor;
    const { rig } = this.ctx;
    const { cx, cz } = this.ctx.world.arena;
    if (a.mark) this.unmark(b, a.mark);
    a.mark = null;
    this.strike((px, pz) => covers('half', cx, cz, { side }, px, pz, 0), HURT.cut, null, true);
    const lit = new Decal(scene, 'half', cx, cz, FLOOR_R * 2 * 96 / 92);
    lit.mesh.scale.x = side < 0 ? 1 : -1;
    flash(scene, [cx + side * FLOOR_R * 0.45, 3, cz + 0.5], { color: RED_LIGHT, power: 140, reach: FLOOR_R * 1.4, life: 0.6, rise: 0.03 });
    let life = 0;
    this.fx.push({
      step: (dt) => { life += dt; lit.opacity = Math.max(0, 1 - life / 0.6); return life < 0.6; },
      dispose: () => lit.dispose(),
    });
    particles.emit({
      pos: [cx + side * 9, 0.4, cz], spread: [8, 0.3, 12], vel: [0, 3, 0], velSpread: [2, 2, 2],
      color: ['#ff5a3a', '#ffd2a8', '#a01818'], size: 0.12, life: 0.9, count: 120, drag: 1.2, intensity: 2.2,
    });
    rig.shake?.(0.4);
  }

  // The ring erupts: red light tears up out of the floor all over it, rippling out from the golden
  // circle to the edge; all on it (not dodging, nor in the air) suffer; the ground shakes.
  erupt(b, a) {
    const { scene, particles } = this.floor;
    const { rig } = this.ctx;
    const { cx, cz } = this.ctx.world.arena;
    const E = WRATH.erupt;
    const R = ARENA.walkRadius;
    const inner = WRATH.safe;
    for (const m of a.rings || []) this.unmark(b, m);
    a.rings = null;
    this.strike((px, pz) => covers('ring', cx, cz, { safe: inner }, px, pz, 0), HURT.ring, null, true);
    const lit = new Decal(scene, 'annulus', cx, cz, FLOOR_R * 2 * 96 / 92, { arg: inner / FLOOR_R });
    // (the ring's light all round it: four flashes about it, between the golden circle and the edge)
    const mid = (inner + R) / 2;
    for (let k = 0; k < 4; k++) {
      const ang = (k / 4) * Math.PI * 2 + Math.PI / 4;
      flash(scene, [cx + Math.cos(ang) * mid, 2, cz + Math.sin(ang) * mid * 0.8 + 0.4], { color: RED_LIGHT, power: 80, reach: 20, life: 0.9, rise: 0.05 });
    }
    let life = 0;
    this.fx.push({
      step: (dt) => { life += dt; lit.opacity = Math.max(0, 1 - life / 0.9); return life < 0.9; },
      dispose: () => lit.dispose(),
    });
    const art = fxArt('fenrath-eruption');
    if (art) {
      const spots = [];
      for (let i = 0; i < E.spots; i++) {
        const r = Math.sqrt(inner ** 2 + Math.random() * (R ** 2 - inner ** 2));
        const ang = Math.random() * Math.PI * 2;
        spots.push([cx + Math.cos(ang) * r, cz + Math.sin(ang) * r, ((r - inner) / (R - inner)) * E.ripple + Math.random() * 0.1]);
      }
      const e = new Eruption(scene, art, spots, { height: E.height });
      this.fx.push({ step: (dt) => e.step(dt), dispose: () => e.dispose() });
    }
    particles.emit({
      pos: [cx, 0.5, cz], spread: [R * 0.75, 0.3, R * 0.75], vel: [0, 3.5, 0], velSpread: [1.5, 2, 1.5],
      color: ['#ff5a3a', '#ffd2a8', '#a01818', '#60060a'], size: 0.12, life: 1.1, count: 160, drag: 1, intensity: 2.2,
    });
    rig.shake?.(0.45);
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
      const a = b.state === 'attack' && b.attack.step <= b.kind.moves[b.attack.kind].danger ? b.attack : null;
      if (a && (a !== f.seen || a.phase !== f.phase)) {
        f.seen = a;
        f.phase = a.phase; // (his great attack: each of its marks is seen afresh)
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
        // the Bandit Knight: never a blow, only as far from the enemy as the arena allows, and
        // never a quiet moment: begging when it comes near, and from his hiding place, cowering
        // asides and brave words shouted from a safe distance
        goal = this.hideFrom(b, n, f);
        speed = dist < 7 ? 5.6 : 3.6;
        faceBoss = dist > 8;
        f.whine = (f.whine ?? rand(1.5, 3.5)) - dt;
        if (f.whine <= 0) {
          const near = dist < 6.5;
          f.whine = near ? rand(3, 5) : rand(4.5, 8);
          this.ctx.director.remark(n, near ? 'flee' : Math.random() < 0.6 ? 'cower' : 'taunt');
        }
      } else if (f.ult >= 1 && this.ctx.ults?.ready(n)) {
        // its ultimate full: loosed (ults.js); an aimed one only from his line, level with him,
        // so it walks into that first
        const ults = this.ctx.ults;
        if (!ults.of(n).aim) { ults.start(n); return false; }
        const side = Math.sign(n.pos.x - b.pos.x) || 1;
        goal = [b.pos.x + side * 6.5, b.pos.y];
        speed = 4.6;
        const ax = Math.abs(n.pos.x - b.pos.x);
        if (Math.abs(n.pos.y - b.pos.y) < 0.6 && ax > 3 && ax < 11) {
          ults.start(n, { dir: [-side, 0] });
          return false;
        }
      } else if (styleOf(n).range === 'far' || (styleOf(n).range === 'both' && f.ranged && b.state !== 'down')) {
        // a mage (or Fortuna, casting): well off him, going slowly round, a spell now and then
        // (combat.js)
        f.cd -= dt;
        goal = standOff(b, n, f, dt);
        speed = 3.6;
        if (f.cd <= 0 && dist < RANGED.reach && b.lift < 3) {
          this.startCast(n);
          f.cd = castPause();
          if (styleOf(n).range === 'both') f.ranged = Math.random() < 0.5;
          return false;
        }
      } else {
        f.cd -= dt;
        // (the Golem's weak points: where to strike, if anywhere just now, golem.js)
        const spot = b.mind ? b.mind.strikeSpot(n) : null;
        // (felled, he's rushed at once)
        if (b.state === 'down' && spot && f.mode === 'circle') f.mode = 'engage';
        if (f.mode === 'circle' && f.cd <= 0 && !a && (spot || !b.mind)) f.mode = 'engage';
        if (f.mode === 'engage' && b.mind && !spot) f.mode = 'circle';
        if (f.mode === 'engage') {
          const r = b.kind.radius + 1.4;
          goal = spot ? spot.goal : [b.pos.x + (toX / dist) * r, b.pos.y + (toZ / dist) * r * 0.8];
          speed = 4.8;
          // (felled, they stay in the circle, striking again after a breath)
          const felled = b.state === 'down';
          if ((spot ? spot.ready && (!felled || f.cd <= 0) : dist < b.kind.reach + b.kind.radius + 0.2) && b.lift < 1) {
            const faceX = spot ? spot.face : b.pos.x;
            n.body.facing = faceX > n.pos.x ? 1 : -1;
            blow(n, 'fightAttack');
            f.mode = felled ? 'engage' : 'retreat';
            f.modeT = 0;
            f.cd = felled ? rand(0.7, 1.3) : rand(2, 4.5);
            f.vx = 0;
            f.vz = 0;
            if (styleOf(n).range === 'both') f.ranged = Math.random() < 0.5; // (Fortuna: frost next, or the blade again)
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
      // waiting for the enemy (or done with it): in their place in the line by the way in
      goal = this.lineSpot(f.line);
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
    // (crowd.js keeps anyone from walking into anyone; this keeps them a little apart besides)
    const me = this.ctx.pilot.npc;
    const room = CROWD.fightSpacing;
    for (const o of this.ctx.director.npcs.values()) {
      if (o === n || (!o.fighter && o !== me) || o.fighter?.dead) continue;
      const ox = n.pos.x - o.pos.x;
      const oz = n.pos.y - o.pos.y;
      const od = Math.hypot(ox, oz);
      if (od > 0.01 && od < room) { wx += (ox / od) * (room - od) * 4; wz += (oz / od) * (room - od) * 4; }
    }
    if (live) {
      const bx = n.pos.x - b.pos.x;
      const bz = n.pos.y - b.pos.y;
      const bd = Math.hypot(bx, bz);
      const bulk = b.mind?.lying ? b.kind.radius * 0.6 : b.kind.radius;
      if (b.lift < 2 && bd > 0.01 && bd < bulk + 0.7) { wx += (bx / bd) * 6; wz += (bz / bd) * 6; }
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
    else if (!live) n.body.facing = n.pos.x < world.arena.cx ? 1 : -1; // (in line, facing the aisle)
    // (the Bandit Knight, still in his hiding place with the enemy well away, crouches out of sight)
    n.body.play(moving ? 'walk' : f.coward && live && Math.hypot(n.pos.x - b.pos.x, n.pos.y - b.pos.y) > 9 ? 'kneel' : 'idle');
    return moving;
  }

  // Where the Bandit Knight runs to: one of his three hiding places, the left or the right end of
  // the arena on its middle line, or its top (north) end among the pillars. He keeps to one till
  // the enemy comes for him (or nears it), or till he's sat there long enough to grow uneasy, then
  // runs for whichever lies farthest from it (now and then the other, to keep it guessing), round
  // the enemy rather than past its nose.
  hideFrom(b, n, f) {
    const { cx, cz } = this.ctx.world.arena;
    const R = ARENA.walkRadius - 1.4;
    const spots = [[cx - R, cz], [cx + R, cz], [cx, cz - R]];
    const from = (i) => Math.hypot(spots[i][0] - b.pos.x, spots[i][1] - b.pos.y);
    const farthest = (list) => list.sort((i, j) => from(j) - from(i));
    if (f.spot == null) { f.spot = farthest([0, 1, 2])[0]; f.movedAt = -9; f.stayUntil = this.clock + rand(12, 22); }
    const close = Math.hypot(n.pos.x - b.pos.x, n.pos.y - b.pos.y) < 6.5;
    // (and, it being too quiet where he is, now and then he scurries off to another anyway)
    const restless = this.clock > f.stayUntil;
    if ((close || from(f.spot) < 8 || restless) && this.clock - f.movedAt > 2.5) {
      const others = farthest([0, 1, 2].filter((i) => i !== f.spot));
      f.spot = Math.random() < (restless ? 0.6 : 0.8) ? others[0] : others[1];
      f.movedAt = this.clock;
      f.stayUntil = this.clock + rand(12, 22);
    }
    const [sx, sz] = spots[f.spot];
    let dx = sx - n.pos.x;
    let dz = sz - n.pos.y;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    // the enemy stands in his way: round it, on the side away from it
    const bx = b.pos.x - n.pos.x;
    const bz = b.pos.y - n.pos.y;
    const along = bx * dx + bz * dz;
    const off = bx * -dz + bz * dx;
    if (along > 0 && along < len && Math.abs(off) < 4.5) {
      const side = off > 0 ? -1 : 1;
      let wx = b.pos.x - dz * side * 5.5;
      let wz = b.pos.y + dx * side * 5.5;
      const r = Math.hypot(wx - cx, wz - cz);
      const lim = ARENA.walkRadius - 1.5;
      if (r > lim) { wx = cx + ((wx - cx) / r) * lim; wz = cz + ((wz - cz) / r) * lim; }
      return [wx, wz];
    }
    return [sx, sz];
  }

  // Where to run to get out from under a blow, staying on the arena floor: out of a swing's or a
  // lunge's lane (up or down, whichever is nearer and open), straight away from where a slam or a
  // leap lands, past its edge, across the middle line from half the arena about to be cut, or in
  // toward him, into the golden circle by him, from the ring about to erupt.
  escape(a, n) {
    const { x, z, opt } = a;
    const { cx, cz } = this.ctx.world.arena;
    const lim = ARENA.walkRadius - 1;
    const clamp = ([ex, ez]) => {
      const off = Math.hypot(ex - cx, ez - cz);
      return off > lim ? [cx + ((ex - cx) / off) * lim, cz + ((ez - cz) / off) * lim] : [ex, ez];
    };
    if (a.shape === 'half') return clamp([x - opt.side * 4, n.pos.y]);
    if (a.shape === 'ring') {
      const dx = n.pos.x - x;
      const dz = n.pos.y - z;
      const d = Math.hypot(dx, dz) || 1;
      const r = opt.safe - 1.6;
      return [x + (dx / d) * r, z + (dz / d) * r];
    }
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
    stepRipples(dt); // (the ground rippling where the Golem struck it, ripple.js)
    const { world, director, ui, pilot } = this.ctx;
    this.t += dt;
    // from the moment he's announced till he's felled, prevails or withdraws, every fire and grace
    // in the Lands Between goes out but the arena's (world.douse), and an arrow shows thee the way
    // there (guide.js)
    world.dousing = this.hunting();
    // once thou'st stepped onto the arena to face him, a wall of fog seals the way out behind thee
    // till the fight is over (and the map strip at the bottom gives way to his health, ui.js)
    const me0 = pilot.npc;
    this.sealed = this.state === 'fighting' || (this.state === 'gathering' && !!me0 && !pilot.dead && this.onRing(me0));
    world.arena.seal(this.sealed);

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
        if (me) { me.action = null; pilot.travelTo(world.hub, true); }
      }
    }

    // the fallen lie a moment where they fell before going (counted here: they lie under a
    // collapse, not their mind); they don't get up again. And a fighter hopping a shockwave
    // (golem.js) rises and comes down.
    for (const n of director.npcs.values()) {
      const f = n.fighter;
      if (f && f.down > 0) f.down -= dt;
      if (f?.hop) {
        f.hop.t += dt;
        const k = f.hop.t / f.hop.dur;
        n.hopLift = k < 1 ? 4 * 0.95 * k * (1 - k) : 0;
        if (k >= 1) f.hop = null;
      } else if (n.hopLift) n.hopLift = 0;
    }

    // one that came of its own accord waits no longer for thee to choose than it would on the arena
    const c = this.calling;
    if (c && c.cause.kind !== 'summon' && this.clock - c.at > this.trigger.noShow) this.ctx.companions.close();
    // what may bring one
    if (this.state === 'idle') {
      if (this.clock >= this.nextInvasion) {
        this.nextInvasion = this.clock + rand(...this.trigger.invasion);
        if (this.auto()) this.call({ kind: 'invasion' });
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
      case 'gathering': {
        // the great enemy comes only once thou standest on the arena to face it (and the others
        // have had a moment to gather); if thou never comest, it turns away
        const me = pilot.npc;
        const here = me && !pilot.dead && this.inArena(me);
        if (!here) {
          if (this.t > this.trigger.noShow) {
            ui.banner('The Great Enemy Turns Away', 'No challenger came to the arena', 'red');
            ui.log('No challenger came: the great enemy turns away', 'dim', { region: world.arena });
            this.end();
          } else if (this.t > 3 && !this.hinted) {
            this.hinted = true;
            ui.log('The great enemy awaits thee in the Arena of Trials, north of Roundtable Hold', 'red', { region: world.arena });
          }
          break;
        }
        if (this.t >= 2.5) {
          const [bx, bz] = world.arena.point('boss');
          this.boss = new Boss(this.ctx, bx, bz, this.kind);
          const Mind = this.boss.kind.Mind;
          if (Mind) this.boss.mind = new Mind(this, this.boss);
          this.lagHp = this.boss.hp;
          this.focus = false;
          this.introUntil = this.clock + BOSS_CAM.intro; // (the camera shows him a moment, then thee)
          this.says = [];
          const enter = this.boss.kind.says.enter;
          if (enter) this.say(pickOf(enter), 1.4, true);
          this.boss.talkIn = rand(10, 16);
          this.floor.particles.emit({
            pos: [bx, 1.5, bz], spread: [1.2, 2, 0.8], vel: [0, 1.5, 0], velSpread: [1, 1, 0.6],
            color: ['#2a1a1a', '#6a2a2a', '#ff5a3a'], size: 0.14, life: 2, count: 80, drag: 0.6, intensity: 1.4,
          });
          ui.log(`${this.boss.name[0].toUpperCase()}${this.boss.name.slice(1)} enters the Arena of Trials`, 'red', { region: world.arena });
          this.state = 'fighting';
          this.t = 0;
        }
        break;
      }
      case 'fighting': {
        const b = this.boss;
        this.stepBoss(b, dt, t);
        // the fighters' blows land at the turn of their swing (a mage's spell is loosed there)
        for (const n of director.npcs.values()) {
          const a = n.action;
          if (a?.kind === 'fightAttack' && !a.hit && a.t >= a.hitAt) {
            a.hit = true;
            if (b.mind) b.mind.fighterBlow(n);
            else if (b.lift < 2 && Math.hypot(b.pos.x - n.pos.x, b.pos.y - n.pos.y) < b.kind.reach + b.kind.radius + 0.4) this.hit(b, DAMAGE.fighter, null, n, true, 'blow');
          } else if (a?.kind === 'fightCast' && !a.hit && a.t >= a.hitAt) {
            a.hit = true;
            this.castFrom(n);
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
    // (an effect may start another as it goes, a meteor its crack: those join the new list)
    const fx = this.fx;
    this.fx = [];
    for (const e of fx) {
      if (e.step(dt)) this.fx.push(e);
      else e.dispose();
    }
    this.stepDark(dt);
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
    if (this.cowardsAlone == null) {
      // none left to face him but the Bandit Knight, cowering: he can't believe it
      this.cowardsAlone = this.clock;
      this.hushUntil = this.clock + 6; // (nothing else from him meanwhile)
      const alone = this.boss?.kind.says.alone;
      if (alone) {
        this.say(alone[0], 0.8, true);
        this.say(alone[1], 4.6, true);
      }
    }
    return this.clock - this.cowardsAlone > 20;
  }

  // He leaves the arena (unbeaten): he fades into red mist, and the fight is over.
  withdraw(b) {
    const lying = b.mind?.lying; // (the Golem, felled, fades where he lies)
    b.endMove();
    b.mind?.closeHeart();
    b.lift = 0;
    b.state = 'withdraw';
    b.t = 0;
    b.pose(lying ? 'down' : 'idle');
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
    clearRipples();
    this.ctx.ults?.finish(); // (an ultimate under way ends with it)
    this.release();
    this.state = 'ending';
    this.t = 0;
  }

  updateUi(dt) {
    this.stepSays();
    const b = this.boss;
    const el = this.ui;
    el.boss.hidden = !(b && (this.state === 'fighting'));
    if (b) {
      el.bossName.textContent = b.name;
      el.bossHp.style.width = `${(100 * b.hp) / b.max}%`;
      // (the chunk he just lost: white a moment after the last wound, then drawn down to his health;
      // never held longer than IMPACT.most, however the blows keep coming)
      const quiet = this.clock - this.lastHurt > IMPACT.lag;
      const long = this.clock - (this.chunkSince ?? -9) > IMPACT.most;
      if (quiet || long) this.lagHp += (b.hp - this.lagHp) * Math.min(1, dt * 7);
      this.lagHp = Math.max(b.hp, this.lagHp);
      el.bossLag.style.width = `${(100 * this.lagHp) / b.max}%`;
      el.bossDmg.textContent = this.clock < this.dmgUntil ? String(this.dmgShown) : '';
    }
    const pilot = this.ctx.pilot;
    // the floating hint, once he's been shown, till thou'st used it once (Q, or a click on it)
    el.focusHint.hidden = !(this.facing(pilot.npc) && this.clock >= this.introUntil && !this.focusLearned) || !!this.ctx.ults?.active;
    el.hp.hidden = !(this.active || pilot.hp < pilot.maxHp);
    el.hpBar.style.width = `${(100 * pilot.hp) / pilot.maxHp}%`;
    // thine ultimate, under thy health, while thou fightest: R once it's full
    const me = pilot.npc;
    const ult = pilot.ult || 0;
    el.ult.hidden = !(this.state === 'fighting' && me && !pilot.dead && this.inArena(me) && this.ctx.ults?.of(me));
    el.ultBar.style.width = `${100 * ult}%`;
    el.ult.classList.toggle('full', ult >= 1);
    this.updateParty();
  }

  // Under thy health, the others in the fight: each one's name and health, in the order they
  // lined up, the fallen greyed and struck through (out for good).
  updateParty() {
    const el = this.ui.party;
    const allies = [...this.ctx.director.npcs.values()].filter((n) => n.fighter && !n.piloted).sort((a, b) => a.fighter.line - b.fighter.line);
    el.hidden = !this.active || !allies.length;
    const seen = new Set(allies);
    for (const [n, row] of this.partyRows) if (!seen.has(n)) { row.el.remove(); this.partyRows.delete(n); }
    if (el.hidden) return;
    allies.forEach((n, i) => {
      let row = this.partyRows.get(n);
      if (!row) {
        const div = document.createElement('div');
        div.className = 'ally';
        const name = document.createElement('span');
        name.className = 'ally-name';
        name.textContent = n.name.first;
        const bars = document.createElement('div');
        bars.className = 'ally-bars';
        const bar = document.createElement('div');
        bar.className = 'ally-bar';
        const fill = document.createElement('i');
        bar.append(fill);
        // (and its ultimate, filling, under its health)
        const ult = document.createElement('div');
        ult.className = 'ally-ult';
        const charge = document.createElement('i');
        ult.append(charge);
        bars.append(bar, ult);
        div.append(name, bars);
        row = { el: div, fill, ult, charge };
        this.partyRows.set(n, row);
      }
      if (el.children[i] !== row.el) el.insertBefore(row.el, el.children[i] || null);
      const f = n.fighter;
      row.el.classList.toggle('fallen', !!f.dead);
      row.fill.style.width = `${Math.max(0, f.hp)}%`;
      row.charge.style.width = `${100 * (f.ult || 0)}%`;
      row.ult.classList.toggle('full', (f.ult || 0) >= 1);
    });
  }
}
