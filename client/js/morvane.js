// Morvane's fight (fight.js hands him over to this; his drawings are heroes/morvane.js, and once
// he's changed, heroes/morvane-flame.js). The last great enemy of the Arena of Trials, met only once
// the Guardian Golem and Fenrath have been beaten (fight.js, ORDER).
//
// His first form, the withered lord, won't fight: he flees all round the arena, away from whoever's
// near, and every so often stops, out of breath. Thy blade reaches him only then (as an ultimate
// does); what thou loosest from afar (a spell, a thrown spear, Ruadan's maul) reaches him running
// too. Nearly done for, he makes one last run, to the middle
// of the arena, and stays there out of breath till thou finishest him: so his change, and his reveal,
// come there. He's thine alone: thy companions wait in their places by the way in, watching, for his second
// form (waits). His health he wears over his head, as the training yard's dummies do theirs
// (fight.updateUi): the great enemy's bar shows only once he's the Lord of Frenzied Flame. His bar
// emptied, he
// changes (CHANGE), the camera on him and everyone holding still: he kneels and grips the sword in
// his skull, screaming; he pulls, and the sword, stuck fast, drags his head up on a stretching neck
// till he rips it off, a burst of frenzied flame swallowing it; from behind, he kneels headless, the
// sword dragging; he stands, flames rising from his neck, and grows under them to three times his
// height; the screen goes black; and he turns round, the Lord of Frenzied Flame, his head a ring of
// frenzied flame, arms spread. His title, and his second bar filling; and the fight is his.
//
// His second form floats, and never stays where he is: he drifts about his foe, into its lane, a
// little off it, and comes at it quick as thought (FLAME, MORVANE_MOVES). Every blow shows itself
// first, his flame flaring as he draws back:
//   blink – he bursts into frenzied flame and is gone, and back a moment later somewhere else: behind
//           his foe, to slash it, or across the arena from it, to lunge at it;
//   slash – the sword raised high, and brought down and across: all before him to its point suffer,
//           and a crescent of frenzied flame flies on down his lane;
//   lunge – coiled in the air, he shoots forward low, the sword thrust out at arm's length, half the
//           arena long; two or three times running (turning, or vanishing into his foe's lane, between);
//   fly   – drawn back, he streaks across the whole arena flat out, head first, burning all in his path;
//   throw – his gold fang hurled at where his foe stands (marked as he draws back): it flies fast and
//           flat and stabs point-first into the floor, stays a moment, and flies back to his hand,
//           cutting all in its way again; once to three times running;
//   eye   – his great attack, as his second bar falls to two-thirds, and again at one-third: gone, he
//           rises over the middle of the arena facing thee, arms spread, and his head of flame swells
//           into a huge burning eye, the arena turning the colour of it, dragging everyone toward him
//           while flames rain down all round; at its biggest it bursts over the whole arena, the harder
//           the nearer him: only a dodge as it bursts escapes it (the fighters hop it, mostly);
//   pillar – every half-minute or so: gone, he's back at one side of the arena facing across it, leans
//           back drawing breath (the band it'll burn marked on the floor), and breathes out a pillar of
//           yellow flame the whole length of the arena and two-thirds of its width (only the strips
//           along its near and far edges escape it); then he's spent, his arms hanging and his head
//           bowed, five seconds: the moment to strike him;
//   clone  – about once a minute (never just after the Eye): gone, his sword and fang let fall, he's
//           back over the middle of the arena facing thee, his empty hands raised to the sky, begging;
//           his head of flame swells, and a clone of it as big parts from it (his own shrinking back)
//           and races round the arena, burning all it passes: only the golden circle by him is out of
//           its reach; then his sword and fang rise off the floor and fly back into his hands.
// From the moment he's revealed, his arena is his (frenzyfx.js, Inferno): the world beyond it gone
// black, a ring of frenzied flame all round it lighting it, heat shimmering, burning ash drifting;
// it all dies away as he's felled. Every blade reaches him whenever he's there to be reached (not
// vanished, nor high over the arena), and thy companions are at him now. Felled, he falls to his knees, his flame shrinking, and slumps,
// his sword and his fang let fall on the floor.
//
// He's heard (audio.js, Sacha's recordings: README): breaking into a run, out of breath, every
// moment of his change; and in his second form vanishing and coming back, flying, his blade, his fang
// drawn back and thrown, the Eye swelling and dragging (for now, till he has his own, the Golem's
// meteor and fire for what bursts). The pillar and the clone borrow his other moves' sounds till they
// have their own (README): the slash's wind-up as he leans back, the Eye's burst and his flight's rush
// as he breathes the pillar out; the Eye's swelling and its drone for the clone, a woosh as it races
// past thee, his blade's woosh as his sword and fang fly back.

import * as THREE from 'three';
import { SpriteBody } from './npc.js';
import { flash, carry } from './lights.js';
import { onAim, wayOf, AIM, reachOf } from './combat.js';
import { ARENA, BOSS_CAM } from './config.js';
import { Crescent, Decal } from './bossfx.js';
import { FRENZY, FRENZY_LIGHT, FlameBall, FlameBurst, BareFang, Eye, Dropped, Inferno, Head, Loose, Pillar } from './frenzyfx.js';
import { holeOf, spotOf, HANDS } from './heroes/morvane-flame.js';

export const MORVANE = {
  hp: 1000, // his first bar
  flameHp: 6000, // his second, filling as he's revealed
  speed: 5.6, // fleeing (a little slower than thou runnest)
  run: [3.5, 6], // seconds he runs before he must stop
  pant: [2.6, 3.4], // seconds out of breath: the only time he can be struck
  leg: 7, // how far he'd rather each dash take him
  shy: 2.6, // a foe this near, he runs elsewhere
  last: 0.15, // this much of his bar left, he makes one last run, to the middle of the arena, and stays there out of breath
  wheeze: 5.6, // (and wheezes on and on there: his panting heard again every so often)
  hover: 0, // how high his second form floats over where it's drawn floating (heroes/morvane-flame.js), bobbing
  // felled: his fall seen whole so long (on his knees, then slumped), then all of him (body, head of
  // flame, sword and fang, his light, his arena's fire) fading out together over so long (fight.js)
  felled: { hold: 3.5, fade: 1.5 },
};

// His change, in seconds from his first bar emptying: the grip (C), heard pulling from the moment he
// grips the sword, its tearing coming in halfway through that (`tear`: the pull's clip is 6.9 s long);
// the pull (D); his head ripped off once his scream (the tearing's clip) has been heard to its end
// (`rip`: 6.45 s after `tear`), kneeling headless from behind (D2), standing so
// (E) and growing (from `grow` to
// `grown`, GROW times his size), the screen black (from `black`, gone again at `reveal`), revealed (F),
// his title and his second bar filling over FILL seconds, at rest (master 2), and at `fight`, the
// fight his. `cam`: how far back the camera stands for each (it pulls back as he grows).
const CHANGE = {
  grip: 0, pull: 2.6, tear: 3.45, rip: 9.9, pulled: 10.15, back: 12.9, grow: 13.3, grown: 17.1,
  black: 17.5, reveal: 21, title: 22.3, idle: 24.3, fight: 26.1,
  cam: { near: 15, grown: 25, reveal: 30 },
};
const GROW = 2.1; // (his body, from his soles to his neck, as tall again as the Lord of Frenzied Flame's)
const FILL = 1.6;
const FLAME = ['#fff4b0', '#ffd23a', '#ff9a1a', '#ff6a10']; // (frenzied flame: white-hot to orange)
// Where, in his drawings, things are (art pixels over their frame's last row: up): the fire, his head as
// he grips and pulls, his neck once it's torn off, his middle, the top of him (his bar over it); in his
// second form, his head of flame (at rest; revealed, the Eye over it), his middle, his hand as it flings
// the fang and as it's held out for it to come back (and how far before him those are: AHEAD).
const AT = {
  grip: 150, pull: 170, pulled: 134, back: 158, middle: 96, top: 243,
  flame: 258, eye: 252, flameMiddle: 175, hand: 231, catch: 221,
};
const AHEAD = { hand: 122, catch: 118 };

// His second form's fight: how fast he drifts between his moves, how far off his foe he keeps (in
// its lane) meanwhile, his pause between moves (quicker wounded: fight.js), how often he vanishes
// unbidden, how many lunges and throws he chains, and at what shares of his second bar the Eye comes.
// How far his sword reaches before him, slashing and lunging (world units), how low he swoops to lunge
// and to fly (his lift: coiled, thrusting, flying), how far a lunge carries him, how fast he flies,
// how far either side of his lane his blade and his body sweep, his slash's crescent (from where
// before him, how high, how big, how fast, how long, how wide what it strikes), his fang's flight
// (the circle it stabs, how fast it flies, straight there and straight back, how long it stays, how
// many times as big as in his hand); how often his pillar of flame and his clone flame come (seconds
// between one and the next, the first so long into his second form's fight), and how long at least
// after the Eye or each other; and what each blow takes from thee (of 100; the fighters as much), the
// Eye's the most beside him, the least at the arena's edge (the clone's each time it passes).
const FLAME_FIGHT = {
  drift: 4.2,
  keep: [5.5, 7],
  pause: [0.5, 1.1],
  blink: [7, 11],
  chain: [2, 3],
  throws: [1, 3],
  eye: [2 / 3, 1 / 3],
  reach: { slash: 6.4, lunge: 9 },
  low: { coil: -0.8, thrust: -1.9, fly: -2.3 },
  dash: [5, 11],
  fly: 24,
  half: { slash: 1.6, lunge: 1.4, fly: 1.4, fang: 0.9 },
  crescent: { from: 2.4, y: 2.4, size: 5.2, speed: 17, life: 0.5, half: 1.7 },
  fang: { r: 0.9, speed: 45, stay: 0.4, size: 1.6 },
  every: { pillar: [28, 40], clone: [52, 68] },
  first: { pillar: [16, 24], clone: [38, 50] },
  apart: 12,
  hurt: { slash: 24, crescent: 18, lunge: 22, fly: 26, stab: 18, back: 12, rain: 14, eye: 46, eyeEdge: 28, pillar: 32, clone: 18 },
};
// The Frenzied Eye: how high he rises over the middle of the arena, how big it grows (across, its
// whole drawing, from his head of flame's size: its black hole as big as his head's), how hard it
// drags everyone toward him (world units a second, from its first moment to its biggest), how often a
// flame falls (seconds), the share falling about a foe, each one's circle and how long it takes to
// fall; and how far back the camera pulls meanwhile, to show the whole arena.
const EYE = { height: 3.4, size: [2.3, 17], pull: [0.6, 3.4], rain: [0.16, 0.3], aimed: 0.35, r: 1.5, fall: 0.75, cam: 38 };
// His second form's sounds, timed (seconds): how far into the teleport's recording its burst comes
// (heard from where it falls as he's gone, a blink's second step), how far into the flight's three
// wooshes their rush comes (begun that long before a lunge's thrust, so that the two come together),
// into the fang's whirr its crest (begun that long before he throws), and into a falling flame's
// burst its crest (begun so that it comes as the flame lands, EYE.fall on).
const HEARD = { burst: 0.45, rush: 0.3, whirr: 0.145, flame: 0.71 };
// The pillar of flame: how far out from the middle of the arena he breathes it from (on its middle
// line), how far either side of that line it burns (two-thirds of the arena's width), how far out it
// runs (to the fire round the arena, frenzyfx.js), and how low he sags, spent.
const PILLAR = { out: 14.2, half: (ARENA.walkRadius * 2) / 3, reach: 19.4, sag: -0.15 };
// Spent after it, his breaths, each so many seconds into the 5 s he's spent: in, out, in, out.
const SPENT = [['in', 0], ['out', 1.5], ['in', 2.5], ['out', 4]];
// The clone flame: the circle round him it can't reach, how far out it races round, how high, how big
// (the Eye's drawing, across: as big as his head of flame swells), how far from its middle it burns
// (to the arena's edge), and how long a lap takes (seconds).
const CLONE = { safe: 5, r: 11.5, y: 5.4, size: 15, hurt: 6.4, lap: 1.15 };
// Where his sword and his fang are as he holds them at rest (their middles, in his drawing at rest:
// where he lets them fall from), and where in their own drawings he grips them.
const HELD = { sword: [109, 226], fang: [151, 194] };
const GRIP = { sword: [14, 20], fang: [8, 6] };
const FLOOR = ARENA.walkRadius + 0.6; // (the round of the arena's floor, as its marks are drawn: fight.js)
// The camera from far back, the whole arena seen, through these steps of these moves (aim).
const WIDE = { eye: [2, 6], pillar: [2, 4], clone: [2, 6] };

// His second form's moves: each one's drawings and how long each is held (seconds; `true`: fixed,
// else quicker when he's wounded: fight.js), a move's own (`dur`) where it says; `danger`: the last
// step during which it can still be escaped (the fighters see it coming till then: fight.driveFighter).
export const MORVANE_MOVES = {
  // the flame gathering round him; gone; back (nothing drawn: the bursts are the game's)
  blink: { steps: [['idle', 0.3, true], ['idle', 0.3, true], ['idle', 0.26, true]], danger: -1 },
  slash: { steps: [['swing-1', 0.55], ['swing-2', 0.1, true], ['swing-3', 0.5]], danger: 1 },
  // coiled; the thrust; his recovery (the slash's follow-through)
  lunge: { steps: [['lunge-1', 0.5], ['lunge-2', 0.28, true], ['swing-3', 0.4]], danger: 1 },
  // drawn back, his flame flaring; the flight, as long as it takes; upright again
  fly: { steps: [['lunge-1', 0.6], ['fly', 1, true], ['idle', 0.4, true]], danger: 1 },
  // drawn back; flung; the hand held out till the fang's back in it
  throw: { steps: [['throw-1', 0.6], ['throw-2', 0.3, true], ['throw-3', 3, true]], danger: 2 },
  // gathering; gone; back over the middle of the arena; rising; the Eye swelling; about to burst; the
  // burst; down again
  eye: {
    steps: [
      ['idle', 0.3, true], ['idle', 0.3, true], ['reveal', 0.35, true], ['reveal', 1, true],
      ['reveal', 5.2, true], ['reveal', 0.8, true], ['reveal', 0.6, true], ['reveal', 1, true],
    ],
    danger: 6,
  },
  // gathering; gone; back at one side of the arena, facing across it; leaning back, drawing breath;
  // breathing out the pillar; spent, his arms hanging, his head bowed; upright again
  pillar: {
    steps: [['idle', 0.3, true], ['idle', 0.35, true], ['lean', 0.35, true], ['lean', 1.3, true], ['breathe', 1.9, true], ['spent', 5, true], ['idle', 0.45, true]],
    danger: 4,
  },
  // gathering; gone, his sword and fang let fall; back over the middle of the arena, his hands raised
  // to the sky; his head of flame swelling; the clone parting from it; racing round the arena; dying
  // away; his sword and fang flying back to his hands, as long as that takes
  clone: {
    steps: [['idle', 0.35, true], ['idle', 0.45, true], ['beg', 0.4, true], ['beg', 1.8, true], ['beg', 0.7, true], ['beg', 6, true], ['beg', 0.6, true], ['beg', 3, true]],
    danger: 5,
  },
};
// His bulk in his second form, read off him by the fight (his first form's is KINDS's, fight.js): how
// far a blow may land from his middle, and out of his line, how far before him he's struck, his lane,
// how far off he stands, his circle on the floor (crowd.js), and the camera: framing him (Q), and
// following thee, pulled back far enough to show most of his height and where he's coming from.
const BULK = { radius: 1.3, depth: 1.6, reach: 2.2, lane: 1.5, spacing: 6, crowd: 1.5, cam: { far: BOSS_CAM.far * 1.25, y: 3.6, near: 31 } };

const rand = (a, b) => a + Math.random() * (b - a);
const SCREEN = [new THREE.Vector3(), new THREE.Vector3()]; // (screenAngle's)

export class MorvaneMind {
  constructor(fight, b) {
    this.fight = fight;
    this.b = b;
    this.ctx = fight.ctx;
    this.floor = fight.floor; // (the arena's floor: what he looses is set on it, fight.js)
    this.mode = 'run'; // run, pant (his first form); his change (b.state 'change'); his second form ('flame')
    this.t = 0;
    this.until = rand(...MORVANE.run);
    this.goal = null;
    this.veerAt = -9;
    this.told = new Set(); // (the hints in the log, each said once)
    this.voices = {}; // what's heard and must be cut short (his panting, the pull and tearing, the reveal, the Eye)
    this.fire = null; // (his arena's fire, heard while it burns: blaze)
    this.form = 1;
    this.light = null; // the frenzied flame's light, from his head torn off to the end
    this.black = document.getElementById('black');
    // his second form's: the Eyes loosed so far, till he next vanishes unbidden, vanished just now, his
    // foe (kept a while), since he last turned round, how long it's been out of his lane, his bobbing
    this.eyes = 0;
    this.blinkIn = rand(...FLAME_FIGHT.blink);
    this.gone = false;
    this.tgt = null;
    this.retarget = 0;
    this.sinceTurn = 9;
    this.offLane = 0;
    this.bobT = 0;
    this.bob = 0;
    this.flaring = 0;
    this.pillarIn = rand(...FLAME_FIGHT.first.pillar);
    this.cloneIn = rand(...FLAME_FIGHT.first.clone);
  }

  // A sound of his (audio.js, SOUNDS: morvane-…): where he is, or, `cine`, wherever thou art.
  sound(name, cine = false, opts = {}) {
    const b = this.b;
    return this.ctx.sound?.play(`morvane-${name}`, cine ? opts : { at: [b.pos.x, b.pos.y], ...opts }) || null;
  }

  hush(key, fade = 0.3) {
    this.voices[key]?.stop(fade);
    delete this.voices[key];
  }

  tell(key, text, tone = 'gold') {
    if (this.told.has(key)) return;
    this.told.add(key);
    this.ctx.ui.log(text, tone, { region: this.ctx.world.arena });
  }

  // ------------------------------------------------------------------------------------------
  // what the fight asks of him

  // Out of breath: the only time his first form can be struck.
  open() { return this.b.state === 'ready' && this.form === 1 && this.mode === 'pant'; }
  // (his first form out of breath, anything wounds him; running, only what thou loosest from afar:
  // struck, `through`. His second, anything, unless he's vanished, or changing still)
  immune() {
    const b = this.b;
    if (this.form === 2) return b.state === 'change' || this.gone;
    return !this.open() && !(this.through && b.state === 'ready');
  }
  felled() { return MORVANE.felled; }
  // His health over his head, in his first form and his change, till he's named the Lord of Frenzied
  // Flame (fight.updateUi): where it goes.
  ownBar() { return !this.titled; }
  barAt() { return this.b.lift + this.up('top') + 0.25; }
  get lying() { return false; }
  // (and everyone holding still, the camera on him, while he changes and as he's revealed)
  holds() { return this.b.state === 'change'; }
  // (the fighters wait in their places by the way in through his first form and his change: his
  // second form's fight is where they join it, fight.driveFighter)
  waits() { return this.form === 1 || this.b.state === 'change'; }
  // His circle on the floor (crowd.js): none while he sweeps through them, lunging or flying, nor
  // while he's vanished.
  crowdRadius(r) {
    if (this.form === 1) return r * 1.25;
    const a = this.b.attack;
    if (this.gone || (a && (a.kind === 'lunge' || a.kind === 'fly') && a.step === 1)) return 0;
    return this.b.kind.crowd;
  }
  shadow() { return this.form === 2 ? [4.5, 2.4] : null; }

  // How high a spot of his (AT) stands over his feet, in the drawings he's in just now.
  up(k) { return AT[k] * this.b.body.sheet.px; }

  // Thy blow (fight.strikeFrom): along the line thou aimed it, within reach, while his first form is
  // out of breath, or his second there to be struck.
  playerBlow(p) {
    const b = this.b;
    if (onAim(p.pos.x, p.pos.y, wayOf(p), b.pos.x, b.pos.y, b.kind.radius, b.kind.depth, b.kind.reach + reachOf(p), AIM.blow) == null) return false;
    if (this.form === 1 && !this.open()) { this.slip(); return false; }
    if (this.immune()) return false;
    this.struck(p, this.fight.blowWorth(p), 'blow');
    return true;
  }

  // A fighter's blow, at the turn of its swing.
  fighterBlow(n) {
    const b = this.b;
    if (b.lift > 2 || Math.hypot(b.pos.x - n.pos.x, b.pos.y - n.pos.y) > b.kind.reach + b.kind.radius + 0.4 + reachOf(n)) return false;
    if (this.form === 1 ? !this.open() : this.immune()) return false;
    this.struck(n, this.fight.blowWorth(n), 'blow');
    return true;
  }

  // Where a spell flies at him (his middle), and a spell landing (`share` of an ordinary one).
  spellPoint() {
    const b = this.b;
    return [b.pos.x, b.lift + this.up(this.form === 1 ? 'middle' : 'flameMiddle'), b.pos.y + 0.2];
  }

  // (thine reaches his first form running too: a spell, a spear or the maul thrown, a thunderbolt;
  // another's only as he stands out of breath. His second form, any, whenever he's there to be struck)
  spellBlow(n, share, player) {
    if (this.form === 1 && !this.open() && !player) return false;
    if (this.form === 2 && (this.immune() || this.b.lift > 2)) return false;
    this.struck(n, this.fight.blowWorth(n, true) * share, 'spell', player, share);
    return true;
  }

  // (`hits`: what it counts toward n's ultimate, fight.charge)
  struck(n, amount, how, through = false, hits = 1) {
    const b = this.b;
    this.through = through;
    this.fight.hit(b, amount, null, n, hits, how);
    this.through = false;
    this.sound('hit'); // (heard: audio.js)
    const mid = this.form === 1 ? this.up('middle') : b.lift + this.up('flameMiddle');
    this.floor.particles.emit({
      pos: [b.pos.x, mid, b.pos.y + 0.2], spread: [0.3, 0.4, 0.2], vel: [0, 1, 0], velSpread: [1, 0.8, 0.6],
      color: ['#7a1a10', '#c8a070', '#2a0808'], size: 0.05, life: 0.5, count: 8, drag: 1.4, intensity: 1,
    });
  }

  // A blow of thine, while he runs: it passes him by (said once).
  slip() {
    this.tell('slip', 'Morvane slips away from thy blade: strike him from afar as he runs, or when he stops, out of breath');
  }

  // Where a fighter goes to strike: beside him, on its own side, while his first form is out of breath
  // (nowhere while he runs: they go round him, after him), and his second whenever he's there to be
  // struck (a step farther off: he's bigger).
  strikeSpot(n) {
    const b = this.b;
    if (this.form === 1 ? !this.open() : this.immune() || b.lift > 1.5 || (b.state !== 'ready' && b.state !== 'attack')) return null;
    const side = Math.sign(n.pos.x - b.pos.x) || 1;
    n.fighter.slot ??= Math.random() * Math.PI * 2;
    const gx = b.pos.x + side * ((this.form === 1 ? 0.9 : 1.9) + reachOf(n));
    const gz = b.pos.y + Math.sin(n.fighter.slot) * (this.form === 1 ? 0.5 : 0.9);
    return { goal: [gx, gz], ready: Math.abs(n.pos.x - gx) < 0.6 && Math.abs(n.pos.y - gz) < 0.7, face: b.pos.x };
  }

  // ------------------------------------------------------------------------------------------
  // his first form: fleeing, and out of breath

  think(dt, fast) {
    if (this.form === 2) return this.hunt(dt, fast);
    const b = this.b;
    this.t += dt;
    if (!this.last && b.hp <= b.max * MORVANE.last) this.lastRun();
    if (this.last) return this.stepLast(dt);
    if (this.mode === 'pant') {
      b.pose('pant');
      if (this.t >= this.until) this.run();
      return false;
    }
    if (this.t >= this.until) { this.stop(); return false; }
    // off somewhere new: there, or a foe coming too near (not more often than he can turn)
    const f = this.fight;
    const crowd = f.foes().some((n) => Math.hypot(n.pos.x - b.pos.x, n.pos.y - b.pos.y) < MORVANE.shy);
    if (!this.goal || Math.hypot(this.goal[0] - b.pos.x, this.goal[1] - b.pos.y) < 0.6 || (crowd && f.clock - this.veerAt > 0.8)) {
      this.goal = this.away();
      this.veerAt = f.clock;
    }
    const [gx, gz] = this.goal;
    const d = Math.hypot(gx - b.pos.x, gz - b.pos.y);
    const step = Math.min(d, MORVANE.speed * dt);
    f.shift(b, ((gx - b.pos.x) / d) * step, ((gz - b.pos.y) / d) * step);
    if (Math.abs(gx - b.pos.x) > 0.2) b.body.facing = gx > b.pos.x ? 1 : -1;
    b.pose('run');
    return true;
  }

  // Where to run: well away from everyone (thee most), a dash's length off, not past anyone on the way.
  away() {
    const b = this.b;
    const { cx, cz } = this.ctx.world.arena;
    const me = this.ctx.pilot.npc;
    const foes = this.fight.foes();
    let best = null;
    let bs = -Infinity;
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (ARENA.walkRadius - 3);
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const len = Math.hypot(x - b.pos.x, z - b.pos.y);
      if (len < 3) continue;
      let room = 12;
      let past = 0;
      for (const n of foes) {
        room = Math.min(room, Math.hypot(n.pos.x - x, n.pos.y - z) * (n === me ? 0.8 : 1));
        // (someone standing on his way there)
        const t = Math.max(0, Math.min(1, ((n.pos.x - b.pos.x) * (x - b.pos.x) + (n.pos.y - b.pos.y) * (z - b.pos.y)) / (len * len)));
        if (Math.hypot(b.pos.x + (x - b.pos.x) * t - n.pos.x, b.pos.y + (z - b.pos.y) * t - n.pos.y) < 1.6) past += 1;
      }
      const s = room - Math.abs(len - MORVANE.leg) * 0.35 - past * 6 + Math.random() * 1.5;
      if (s > bs) { bs = s; best = [x, z]; }
    }
    return best || [cx, cz];
  }

  // Off again (breaking into a run), or stopping, out of breath.
  run() {
    this.mode = 'run';
    this.t = 0;
    this.until = rand(...MORVANE.run);
    this.goal = this.away();
    this.hush('pant', 0.4);
    this.sound('run');
  }

  stop() {
    this.mode = 'pant';
    this.t = 0;
    this.until = rand(...MORVANE.pant);
    this.goal = null;
    this.b.pose('pant', true);
    this.voices.pant = this.sound('pant');
    this.tell('pant', 'Morvane stops, out of breath: strike him now!');
  }

  // Nearly done for: one last run, to the middle of the arena (whoever's in the way), and there, out
  // of breath for good, wheezing on till he's finished (or he can get no nearer: there, then).
  lastRun() {
    const { cx, cz } = this.ctx.world.arena;
    this.last = 'run';
    this.mode = 'run';
    this.goal = [cx, cz];
    this.closest = Infinity;
    this.stuckT = 0;
    this.hush('pant', 0.4);
    this.sound('run');
    this.tell('last', 'Morvane staggers to the middle of the arena, out of breath: finish him!', 'red');
  }

  stepLast(dt) {
    const b = this.b;
    if (this.last === 'there') {
      b.pose('pant');
      this.wheeze = (this.wheeze || 0) + dt;
      if (this.wheeze >= MORVANE.wheeze) { this.wheeze = 0; this.voices.pant = this.sound('pant'); }
      return false;
    }
    const [gx, gz] = this.goal;
    const d = Math.hypot(gx - b.pos.x, gz - b.pos.y);
    // (no nearer for a while: someone stands where he'd be)
    if (d < this.closest - 0.05) { this.closest = d; this.stuckT = 0; } else this.stuckT += dt;
    if (d < 0.4 || this.stuckT > 1.2) {
      this.last = 'there';
      this.mode = 'pant';
      this.wheeze = 0;
      b.pose('pant', true);
      this.voices.pant = this.sound('pant');
      return false;
    }
    const step = Math.min(d, MORVANE.speed * dt);
    this.fight.shift(b, ((gx - b.pos.x) / d) * step, ((gz - b.pos.y) / d) * step);
    if (Math.abs(gx - b.pos.x) > 0.2) b.body.facing = gx > b.pos.x ? 1 : -1;
    b.pose('run');
    return true;
  }

  // His bare feet as they're set down, running (the run's first and third drawings).
  onFrame(name, i) {
    if (name === 'run' && (i === 0 || i === 2)) this.ctx.sound?.play('step-bare', { at: [this.b.pos.x, this.b.pos.y], volume: 2.2 });
  }

  // ------------------------------------------------------------------------------------------
  // his change

  // His first bar emptied (Fight's Boss.damage): not his end, but his change.
  change() {
    if (this.form !== 1 || this.b.state === 'change') return false;
    const b = this.b;
    b.endMove();
    b.state = 'change';
    b.t = 0;
    b.hp = 0;
    this.t = 0;
    this.step = 0;
    this.hush('pant', 0.2);
    b.body.facing = 1; // (the change is drawn facing thee, and from behind: as drawn)
    this.ctx.ui.log('Morvane falls to his knees, his hands on the sword in his skull…', 'red', { region: this.ctx.world.arena });
    return true;
  }

  // The camera on him as he changes: close, pulling back as he grows, and his whole height revealed;
  // and through the Frenzied Eye, the pillar of flame and the clone flame, from far back, the whole
  // arena.
  aim() {
    const b = this.b;
    const a = b.attack;
    const wide = a && WIDE[a.kind];
    if (wide && a.step >= wide[0] && a.step <= wide[1]) {
      const { cx, cz } = this.ctx.world.arena;
      return { at: [cx, ARENA.y + 3, cz], dist: EYE.cam, mode: 'wide' };
    }
    if (b.state !== 'change') return null;
    const t = this.t;
    const C = CHANGE;
    const k = Math.max(0, Math.min(1, (t - C.grow) / (C.grown - C.grow)));
    let dist = C.cam.near + (C.cam.grown - C.cam.near) * k;
    let y = this.up('middle') * (1.1 + 1.6 * k);
    if (this.form === 2) { dist = C.cam.reveal; y = this.up('flameMiddle'); }
    return { at: [b.pos.x, ARENA.y + y, b.pos.y], dist, mode: 'change', close: true };
  }

  // Each moment of it, in order, as its time comes (stepState); returns how far he trembles.
  stepChange(dt) {
    const b = this.b;
    const C = CHANGE;
    this.t += dt;
    const t = this.t;
    const at = (s) => this.step === s && t >= C[s];
    const head = (h) => [b.pos.x, h * (b.body.zoom || 1), b.pos.y + 0.15];
    if (this.step === 0) {
      b.pose('grip', true);
      this.voices.pull = this.sound('pull', true);
      this.step = 'pull';
    }
    if (at('pull')) {
      b.pose('pull', true);
      this.step = 'tear';
    }
    if (at('tear')) {
      this.voices.tear = this.sound('tear', true);
      this.step = 'rip';
    }
    if (at('rip')) {
      // his head ripped off: a burst of frenzied flame swallows it, and it's never seen again
      this.hush('pull', 0.4);
      this.hush('tear', 0.8);
      this.sound('rip', true);
      this.burst(head(this.up('pull')), 1.7, 90);
      flash(this.floor.scene, head(this.up('pull')), { color: FRENZY_LIGHT, power: 60, reach: 16, life: 0.7 });
      this.ctx.rig?.shake?.(0.25);
      this.light = carry(this.floor.scene, head(this.up('pull')), { color: FRENZY_LIGHT, power: 22, reach: 9, waver: 0.5 });
      this.step = 'pulled';
    }
    if (at('pulled')) {
      b.pose('pulled', true);
      this.step = 'back';
    }
    if (at('back')) {
      b.pose('back', true);
      this.step = 'grow';
    }
    if (at('grow')) {
      this.sound('grow', true);
      this.step = 'black';
    }
    if (at('black')) {
      this.dark(true, 0.4);
      this.voices.black = this.sound('black', true);
      this.step = 'swap';
    }
    // (in the dark, his second form takes his place)
    if (this.step === 'swap' && t >= C.black + 0.6) {
      this.becomeFlame();
      this.step = 'reveal';
    }
    if (at('reveal')) {
      this.dark(false, 0.7);
      b.pose('reveal', true);
      this.voices.reveal = this.sound('reveal', true);
      this.voices.low = this.sound('reveal-low', true);
      this.burst(head(this.up('flame')), 3.2, 140);
      flash(this.floor.scene, head(this.up('flame')), { color: FRENZY_LIGHT, power: 45, reach: 22, life: 0.8 });
      this.ctx.rig?.shake?.(0.3);
      this.step = 'title';
    }
    if (at('title')) {
      b.name = 'Morvane, Lord of Frenzied Flame';
      this.titled = true; // (the great enemy's bar, filling: fight.updateUi)
      b.max = MORVANE.flameHp;
      this.ctx.ui.banner('Morvane', 'Lord of Frenzied Flame', 'gold');
      this.ctx.ui.log('Morvane, Lord of Frenzied Flame, is revealed', 'red', { region: this.ctx.world.arena });
      this.step = 'idle';
    }
    if (this.step === 'idle' || this.step === 'fight') {
      // his second bar filling
      b.hp = b.max * Math.min(1, (t - C.title) / FILL);
      this.fight.lagHp = b.hp;
    }
    if (at('idle')) {
      b.pose('idle', true);
      this.step = 'fight';
    }
    if (at('fight')) {
      this.step = 'done';
      this.wake();
      return 0;
    }
    // as it goes: he trembles as he grips and pulls (harder as he tears), embers rise off him, the
    // flames rise from his neck as he grows, the light of the flame wavers
    let jitter = 0;
    if (t < C.rip) {
      const hard = t < C.pull ? 0.02 : t < C.tear ? 0.035 : 0.05;
      jitter = (Math.floor(t * 30) % 2 ? 1 : -1) * hard;
    }
    if (t < C.rip && Math.random() < dt * (t < C.pull ? 6 : 14)) {
      this.floor.particles.emit({
        pos: head(this.up(t < C.pull ? 'grip' : 'pull')), spread: [0.15, 0.2, 0.1], vel: [0, 0.7, 0], velSpread: [0.3, 0.3, 0.2],
        color: FLAME, size: 0.04, life: 0.7, count: 2, drag: 1, intensity: 2.2,
      });
    }
    if (t >= C.pulled && t < C.black) {
      // (the neck smoulders as he kneels, and blazes up as he stands and grows)
      const grow = t >= C.back;
      if (Math.random() < dt * (grow ? 40 : 12)) {
        this.floor.particles.emit({
          pos: head(this.up(grow ? 'back' : 'pulled')), spread: [0.12, 0.05, 0.08], vel: [0, grow ? 2.2 : 1, 0], velSpread: [0.35, 0.6, 0.3],
          color: FLAME, size: grow ? 0.09 : 0.06, life: grow ? 0.9 : 0.6, count: grow ? 4 : 2, drag: 0.8, intensity: 2.8,
        });
      }
    }
    if (t >= C.back && this.form === 1) {
      const k = Math.max(0, Math.min(1, (t - C.grow) / (C.grown - C.grow)));
      b.body.setZoom(1 + (GROW - 1) * k * k * (3 - 2 * k));
    }
    if (this.form === 2) this.float(dt);
    this.flicker(t);
    return jitter;
  }

  // The frenzied flame's light, from his head torn off: wavering, brighter as he grows; and once he's
  // revealed, low in front of him, lighting the floor and those round him rather than the head of
  // flame itself (which it would burn out to a blot): brighter a moment as his flame flares, faint
  // while he's vanished.
  flicker(t) {
    const b = this.b;
    if (!this.light) return;
    if (this.form === 2) this.light.at(b.pos.x, Math.max(1.2, b.lift + 1.4), b.pos.y + 2.6);
    else this.light.at(b.pos.x, (t >= CHANGE.back ? this.up('back') * (b.body.zoom || 1) : this.up('pulled')), b.pos.y + 0.6);
    const base = this.form === 2 ? (this.gone ? 0.15 : 1 + (this.flaring > 0 ? 0.7 : 0)) : t >= CHANGE.back ? 0.5 + 0.7 * Math.min(1, (t - CHANGE.back) / 4) : 0.35;
    this.light.level = base * (0.85 + 0.15 * Math.sin(t * 17) + 0.1 * Math.sin(t * 41));
  }

  // A burst of frenzied flame at `at` [x, height, z], `r` across.
  burst(at, r, count) {
    this.floor.particles.emit({
      pos: at, spread: [r * 0.3, r * 0.3, r * 0.2], vel: [0, 1.6, 0], velSpread: [r * 1.6, r * 1.2, r * 0.8],
      color: FLAME, size: 0.1, life: 1.1, count, drag: 1.1, intensity: 3,
    });
  }

  // The screen going black, or the dark lifting, over `secs`.
  dark(on, secs) {
    if (!this.black) return;
    this.black.style.transitionDuration = `${secs}s`;
    this.black.classList.toggle('on', on);
  }

  // In the dark: the Lord of Frenzied Flame in his place, at his own size, floating, facing thee.
  becomeFlame() {
    const b = this.b;
    const sheet = this.ctx.morvaneFlameSheet;
    if (!sheet) return;
    const old = b.body;
    const body = new SpriteBody(this.ctx.scene, sheet);
    body.mat.transparent = true;
    body.blob.material.map = old.blob.material.map;
    body.blob.material.opacity = 1;
    body.facing = 1;
    old.dispose();
    b.body = body;
    b.pose('reveal', true);
    b.lift = MORVANE.hover;
    this.form = 2;
    this.light?.end(0.1);
    this.light = carry(this.floor.scene, [b.pos.x, 1.4, b.pos.y + 2.6], { color: FRENZY_LIGHT, power: 16, reach: 14, waver: 0.6 });
    // (his head of flame alight, and his arena his, coming while the screen is still black: frenzyfx.js)
    this.head = new Head(body.scene, () => this.holeAt()); // (in the world his body's in, not the arena floor's raised group)
    this.fight.fx.push(this.head);
    this.burn();
  }

  // His arena his: the world beyond it black, the ring of flame round it (frenzyfx.js, Inferno).
  burn() {
    const { daylight, post, world } = this.ctx;
    if (!daylight || !post) return;
    this.inferno = new Inferno({ scene: this.floor.scene, particles: this.floor.particles, cx: world.arena.cx, cz: world.arena.cz, daylight, post });
    this.fight.fx.push(this.inferno);
    this.blaze();
  }

  // His arena's fire heard, on and on while it burns (audio.js: heard wherever thou art, it's all round
  // thee), dying away as it does (dies, dispose).
  blaze() {
    this.fire?.stop(0.3);
    this.fire = this.sound('fire', true);
  }

  // Straight to his second form, as if just revealed (no first form, no change): ?felled's loop
  // (felled-loop.js).
  flameNow() {
    const b = this.b;
    b.endMove();
    this.becomeFlame();
    this.step = 'done';
    b.name = 'Morvane, Lord of Frenzied Flame';
    this.titled = true;
    b.max = MORVANE.flameHp;
    b.hp = b.max;
    this.fight.lagHp = b.hp;
    b.fade = 1;
    b.pose('idle', true);
    this.wake();
  }

  // Up again after his fall, whole, fading in where he fell: what's left of the fall gone at once (his
  // dropped sword and fang, his dying light), his own light and his arena's fire burning again.
  // ?felled's loop (felled-loop.js).
  rise() {
    const b = this.b;
    if (this.fall) this.fall.over = true;
    this.fall = null;
    b.attack = null;
    b.state = 'enter'; // (fading in: fight.js)
    b.t = 0;
    b.fade = 0;
    b.hp = b.max;
    this.fight.lagHp = b.hp;
    b.lift = MORVANE.hover;
    b.pose('idle', true);
    this.gone = false;
    if (this.inferno?.ending && this.inferno.level > 0) this.inferno.ending = false; // (flaring up again)
    else if (!this.inferno || this.inferno.ending) this.burn();
    if (!this.fire || this.fire.done) this.blaze(); // (and heard again)
    this.light?.end(0.1);
    this.light = carry(this.floor.scene, [b.pos.x, 1.4, b.pos.y + 2.6], { color: FRENZY_LIGHT, power: 16, reach: 14, waver: 0.6 });
  }

  // Where the hole in his head of flame is just now (whichever drawing he shows, his body where it
  // stands, facing, lifted, grown): { x, y, z } in the world, how wide, how much of him is seen; null
  // while it isn't to be seen (vanished, or the Frenzied Eye open over it), and from the moment he's
  // felled (his fall's drawings show their own head of flame, shrinking): frenzyfx.js, Head.
  holeAt() {
    const b = this.b;
    const body = b.body;
    const seen = Math.min(1, b.fade ?? 1);
    if (this.form !== 2 || this.gone || !b.alive || b.attack?.eye || seen <= 0.01) return null;
    const h = holeOf(body.frame);
    if (!h) return null;
    const k = body.sheet.px * body.zoom;
    const m = body.mesh.position;
    return { x: m.x + body.facing * (h.x - h.frame.w / 2) * k, y: m.y + (h.frame.h - h.y) * k, z: m.z + 0.06, d: h.d * k, opacity: seen };
  }

  // The drawing he shows for `pose` (its first, the facing-left one if he faces left).
  drawn(pose) {
    const body = this.b.body;
    const g = body.sheet.anims[pose];
    return (body.facing < 0 && g.left ? g.left : g.frames)[0];
  }

  // A spot in a drawing's frame (as spotOf and holeOf give it), from the arena's floor ([x, y, z]): his
  // body where it stands, facing, lifted.
  framed(s) {
    const b = this.b;
    const k = b.body.sheet.px * (b.body.zoom ?? 1);
    return [b.pos.x + b.body.facing * (s.x + 0.5 - s.frame.anchor) * k, b.lift + (s.frame.h - s.y - 0.5) * k, b.pos.y];
  }

  // Where a spot of one of his drawings is (`at`: [column, row] in the one he shows for `pose`), and
  // the hole in his head of flame, from the arena's floor.
  spot(pose, at) { return this.framed(spotOf(this.drawn(pose), at)); }
  headIn(pose) { return this.framed(holeOf(this.drawn(pose))); }

  // His reveal over: the fight is his. Everyone free again, the camera back on thee, thy companions
  // coming at him now; the reveal's music dying away under the fight's.
  wake() {
    const b = this.b;
    b.state = 'ready';
    b.t = 0;
    b.cd = 1.2;
    b.kind = { ...b.kind, ...BULK };
    this.hush('reveal', 3);
    this.hush('low', 3);
    this.hush('black', 3);
    this.ctx.ui.log('Morvane, Lord of Frenzied Flame, comes for thee', 'red', { region: this.ctx.world.arena });
    this.tell('flame', 'Morvane strikes fast and never stays where he is: watch for his flame flaring, and dodge through his blows (Space)');
  }

  // ------------------------------------------------------------------------------------------
  // his second form

  // Floating, bobbing gently (as he hovers: `lift`, unless a move has him lower or higher; back from
  // one, easing up into it), embers rising off his head of flame wherever it is.
  float(dt, lift = true) {
    const b = this.b;
    this.bobT += dt;
    this.bob = MORVANE.hover + 0.12 * Math.sin(this.bobT * 1.6);
    if (lift) b.lift = Math.abs(b.lift - this.bob) < 0.05 ? this.bob : b.lift + (this.bob - b.lift) * Math.min(1, dt * 5);
    const at = this.holeAt();
    if (at && Math.random() < dt * 16) {
      const y = b.lift + at.y - b.body.mesh.position.y; // (from the floor, as what's loosed on it is placed)
      this.floor.particles.emit({
        pos: [at.x, y + at.d * 0.9, at.z + 0.04], spread: [at.d * 1.3, at.d, 0.3], vel: [0, 1.6, 0], velSpread: [0.5, 0.6, 0.3],
        color: FLAME, size: 0.06, life: 1.1, count: 3, drag: 0.7, intensity: 2.6,
      });
    }
  }

  // His lift brought toward `to`, `rate` of the way a second.
  ease(to, dt, rate) {
    this.b.lift += (to - this.b.lift) * Math.min(1, dt * rate);
  }

  // His flame flaring (a move about to come): it blazes up off his head, and its light with it.
  flare(dt) {
    const b = this.b;
    this.flaring = 0.25;
    if (Math.random() < dt * 40) {
      this.floor.particles.emit({
        pos: [b.pos.x, b.lift + this.up('flame'), b.pos.y + 0.2], spread: [0.8, 0.6, 0.3], vel: [0, 2.6, 0], velSpread: [1.2, 1.2, 0.5],
        color: FLAME, size: 0.1, life: 0.6, count: 3, drag: 0.8, intensity: 3,
      });
    }
  }

  // The flame gathering round all of him (about to vanish).
  gather(dt) {
    const b = this.b;
    this.flaring = 0.25;
    if (Math.random() < dt * 60) {
      const mid = b.lift + this.up('flameMiddle');
      this.floor.particles.emit({
        pos: [b.pos.x, mid, b.pos.y + 0.2], spread: [1.4, 2.4, 0.4], vel: [0, 1.8, 0], velSpread: [1.4, 1.4, 0.6],
        color: FLAME, size: 0.09, life: 0.5, count: 4, drag: 1.2, intensity: 3,
      });
    }
  }

  // Flame streaming off him as he sweeps along, lunging or flying.
  trail(dt) {
    const b = this.b;
    if (Math.random() > dt * 50) return;
    const a = b.attack;
    this.floor.particles.emit({
      pos: [b.pos.x - a.dir * 1.5, b.lift + this.up('flameMiddle'), b.pos.y + 0.2], spread: [1.6, 0.6, 0.3], vel: [-a.dir * 3, 0.8, 0], velSpread: [1.2, 0.8, 0.4],
      color: FLAME, size: 0.1, life: 0.6, count: 4, drag: 1.4, intensity: 2.8,
    });
  }

  // How far he can go along his lane (x) from (x, z) toward `dir` before the edge of the arena.
  room(x, z, dir) {
    const { cx, cz } = this.ctx.world.arena;
    const R = ARENA.walkRadius - 2.2;
    const half = Math.sqrt(Math.max(0, R * R - (z - cz) ** 2));
    return Math.max(0, (cx + dir * half - x) * dir);
  }

  // (x, z), brought inside the arena, `pad` short of its edge.
  inside(x, z, pad) {
    const { cx, cz } = this.ctx.world.arena;
    const lim = ARENA.walkRadius - pad;
    const d = Math.hypot(x - cx, z - cz);
    return d > lim ? [cx + ((x - cx) / d) * lim, cz + ((z - cz) / d) * lim] : [x, z];
  }

  // Ready (fight.stepBoss): the Eye when its time comes, a move when he's ready for one (choose); else
  // he drifts about his foe, into its lane, a little off it on the side he's on, facing it.
  hunt(dt, fast) {
    const b = this.b;
    const f = this.fight;
    this.t += dt;
    this.flaring = Math.max(0, this.flaring - dt);
    this.float(dt);
    this.flicker(this.t);
    b.cd -= dt * fast;
    this.blinkIn -= dt;
    this.sinceTurn += dt;
    // the Eye, as his bar falls to two-thirds, and again to one-third
    if (this.eyes < FLAME_FIGHT.eye.length && b.hp <= b.max * FLAME_FIGHT.eye[this.eyes] && b.cd <= 0.4) {
      this.eyes += 1;
      this.begin('eye');
      return false;
    }
    // his foe, kept a while (unless it's left the fight)
    this.retarget -= dt;
    if (!this.tgt || this.retarget <= 0 || !f.foes().includes(this.tgt)) {
      this.tgt = f.target(b);
      this.retarget = rand(2, 3.5);
    }
    const tgt = this.tgt;
    if (!tgt) { b.pose('idle'); return false; }
    // his pillar of flame and his clone flame, each in its time, once he's ready
    this.pillarIn -= dt;
    this.cloneIn -= dt;
    if (b.cd <= 0 && ((this.cloneIn <= 0 && this.begin('clone')) || (this.pillarIn <= 0 && this.begin('pillar')))) return false;
    const dx = tgt.pos.x - b.pos.x;
    const dz = tgt.pos.y - b.pos.y;
    this.offLane = Math.abs(dz) < 1.2 ? 0 : this.offLane + dt;
    // (turned to it at once, near enough: he's quick)
    if (dx * b.body.facing < -0.5 && this.sinceTurn > 0.35) {
      b.body.facing = -b.body.facing;
      this.sinceTurn = 0;
    }
    if (b.cd <= 0 && this.choose(tgt, dx, dz)) return false;
    // into its lane, a little off it on the side he's on
    this.keep ??= rand(...FLAME_FIGHT.keep);
    const side = Math.sign(-dx) || -b.body.facing;
    const gx = tgt.pos.x + side * this.keep;
    const gz = tgt.pos.y;
    const d = Math.hypot(gx - b.pos.x, gz - b.pos.y);
    b.pose('idle');
    if (d < 0.3) return false;
    const step = Math.min(d, FLAME_FIGHT.drift * fast * dt);
    f.shift(b, ((gx - b.pos.x) / d) * step, ((gz - b.pos.y) / d) * step);
    return true;
  }

  // A move against his foe, if there's one to make from where he is (begun): whether one was.
  choose(tgt, dx, dz) {
    const b = this.b;
    const ax = Math.abs(dx);
    const inLane = Math.abs(dz) < 1.2;
    const ahead = dx * b.body.facing > 0;
    const r = Math.random();
    // unbidden now and then, or hemmed in: gone, and back behind it (to slash it) or across from it
    // (to lunge at it)
    if (this.blinkIn <= 0 || this.fight.foesWithin(b, 3.6) >= 3) {
      this.blinkIn = rand(...FLAME_FIGHT.blink);
      if (this.blinkAt(tgt, r < 0.5 ? 'behind' : 'across')) return true;
    }
    if (inLane && ahead) {
      if (ax < FLAME_FIGHT.reach.slash - 0.6) return this.start(r < 0.75 ? 'slash' : 'throw');
      if (ax < 13) return this.start(r < 0.5 ? 'lunge' : r < 0.78 ? 'throw' : 'fly') || this.start('lunge');
      return this.start(r < 0.45 ? 'fly' : r < 0.75 ? 'lunge' : 'throw') || this.start('lunge');
    }
    // kept out of his lane a while: the fang finds it there, or he's gone into it
    if (this.offLane > 1.6 && ax > 3) {
      this.offLane = 0;
      return r < 0.55 ? this.start('throw') : this.blinkAt(tgt, 'across');
    }
    return false;
  }

  // A move, with what it takes: how many lunges and throws, for those.
  start(kind) {
    if (kind === 'lunge') return this.begin('lunge', { chain: Math.round(rand(...FLAME_FIGHT.chain)) });
    if (kind === 'throw') return this.begin('throw', { throws: Math.round(rand(...FLAME_FIGHT.throws)) });
    return this.begin(kind);
  }

  // Vanishing, to come back behind his foe (and slash it) or across the arena from it, in its lane
  // (and lunge at it); `next`: the move he'll make there, if not that one.
  blinkAt(tgt, where, next = null) {
    const { cx, cz } = this.ctx.world.arena;
    const lim = ARENA.walkRadius - 2.5;
    const room = (x, z) => Math.hypot(x - cx, z - cz) <= lim;
    let to = null;
    if (where === 'behind') {
      const back = -(tgt.body.facing || 1);
      for (const s of [back, -back]) {
        const x = tgt.pos.x + s * 3.4;
        if (room(x, tgt.pos.y)) { to = [x, tgt.pos.y]; break; }
      }
    } else {
      for (const s of Math.random() < 0.5 ? [1, -1] : [-1, 1]) {
        const x = tgt.pos.x + s * rand(9, 11);
        if (room(x, tgt.pos.y)) { to = [x, tgt.pos.y]; break; }
      }
    }
    if (!to) return false;
    const then = next || (where === 'behind' ? { kind: 'slash' } : { kind: 'lunge', opts: { chain: Math.round(rand(...FLAME_FIGHT.chain)) } });
    return this.begin('blink', { to, then });
  }

  // A move begins: what it covers is known from the start (the fighters see it coming), facing his foe.
  begin(kind, o = {}) {
    const b = this.b;
    const tgt = this.tgt;
    const { cx, cz } = this.ctx.world.arena;
    let dir = b.body.facing;
    if (tgt && kind !== 'blink' && kind !== 'eye' && Math.abs(tgt.pos.x - b.pos.x) > 0.3) dir = Math.sign(tgt.pos.x - b.pos.x);
    const a = { kind, step: -1, t: 0, dir, x: b.pos.x, z: b.pos.y, shape: 'none', opt: {}, dur: {}, ...o };
    if (kind === 'slash') {
      a.shape = 'line';
      a.opt = { dir, from: -1, len: FLAME_FIGHT.reach.slash + FLAME_FIGHT.crescent.speed * FLAME_FIGHT.crescent.life, half: FLAME_FIGHT.half.slash };
    } else if (kind === 'lunge') {
      const want = tgt ? Math.abs(tgt.pos.x - b.pos.x) - 1.5 : FLAME_FIGHT.dash[1];
      const dash = Math.min(this.room(b.pos.x, b.pos.y, dir), Math.max(FLAME_FIGHT.dash[0], Math.min(FLAME_FIGHT.dash[1], want)));
      a.toX = b.pos.x + dir * dash;
      a.shape = 'line';
      a.opt = { dir, from: -0.5, len: dash + FLAME_FIGHT.reach.lunge, half: FLAME_FIGHT.half.lunge };
    } else if (kind === 'fly') {
      // across the whole arena, through his foe's lane, from where he is to its far edge
      const lane = tgt ? tgt.pos.y : b.pos.y;
      const room = this.room(b.pos.x, lane, dir);
      if (room < 8) return false;
      a.z = lane;
      a.toX = b.pos.x + dir * room;
      a.dur[1] = Math.max(0.5, Math.min(1.3, room / FLAME_FIGHT.fly));
      a.shape = 'line';
      a.opt = { dir, from: -1, len: room + 3, half: FLAME_FIGHT.half.fly };
    } else if (kind === 'throw') {
      // his fang, at where his foe stands, marked as he draws back
      if (!tgt) return false;
      const [tx, tz] = this.inside(tgt.pos.x, tgt.pos.y, 1.5);
      if (Math.abs(tx - b.pos.x) > 0.3) a.dir = Math.sign(tx - b.pos.x);
      Object.assign(a, { x: tx, z: tz, shape: 'disc', opt: { r: FLAME_FIGHT.fang.r } });
    } else if (kind === 'eye') {
      Object.assign(a, { to: [cx, cz], opt: { spots: [] }, rainIn: 0.6 });
    } else if (kind === 'pillar') {
      // to one side of the arena, the other from his foe's, to breathe it across at it
      const side = Math.sign((tgt ? tgt.pos.x : b.pos.x) - cx) || (Math.random() < 0.5 ? 1 : -1);
      const x = cx - side * PILLAR.out;
      Object.assign(a, { dir: side, to: [x, cz], x, z: cz, shape: 'band', opt: { dir: side, from: -1.5, half: PILLAR.half } });
    } else if (kind === 'clone') {
      Object.assign(a, { to: [cx, cz], x: cx, z: cz, shape: 'ring', opt: { safe: CLONE.safe } });
    }
    // (none of his great moves comes too soon after another)
    const F = FLAME_FIGHT;
    if (kind === 'eye' || kind === 'pillar' || kind === 'clone') {
      this.pillarIn = kind === 'pillar' ? rand(...F.every.pillar) : Math.max(this.pillarIn, F.apart);
      this.cloneIn = kind === 'clone' ? rand(...F.every.clone) : Math.max(this.cloneIn, F.apart);
    }
    b.body.facing = a.dir;
    b.attack = a;
    b.state = 'attack';
    b.idleT = 0;
    if (!['blink', 'eye', 'pillar', 'clone'].includes(kind)) this.hush('teleport', 0.3); // (his vanishing dies away as he moves on: never heard under a lunge)
    this.nextStep();
    return true;
  }

  // The move goes on: he swoops and sweeps along, his flame flares, the Eye swells; at the end of each
  // step, the next. Returns how far he trembles (fight.stepBoss).
  stepMove(dt, t, fast) {
    const b = this.b;
    const a = b.attack;
    const [, dur0, fixed] = MORVANE_MOVES[a.kind].steps[a.step];
    const dur = a.dur[a.step] ?? dur0;
    a.t += dt;
    this.t += dt;
    this.flaring = Math.max(0, this.flaring - dt);
    const span = fixed ? dur : dur / fast;
    let k = Math.min(1, a.t / span);
    let lift = true; // (bobbing as he floats, unless the move has him lower or higher)
    if (a.kind === 'slash' && a.step === 0) this.flare(dt);
    else if (a.kind === 'lunge') lift = this.stepLunge(a, k, dt, span - a.t);
    else if (a.kind === 'fly') lift = this.stepFly(a, k, dt);
    else if (a.kind === 'blink') this.stepBlink(a, k, dt);
    else if (a.kind === 'throw') {
      if (a.step === 0) {
        this.flare(dt);
        if (a.mark) a.mark.opacity = (0.35 + 0.6 * k) * (0.8 + 0.2 * Math.sin(t * 24));
        const left = span - a.t;
        if (!a.whirred && left <= HEARD.whirr) {
          a.whirred = true;
          this.sound('windup', false, { offset: Math.max(0, HEARD.whirr - left) });
        }
      }
      if (a.step === 2 && a.caught) k = 1; // (the fang back in his hand)
    } else if (a.kind === 'eye') lift = this.stepEye(a, k, dt, t);
    else if (a.kind === 'pillar') lift = this.stepPillar(a, k, dt);
    else if (a.kind === 'clone') {
      lift = this.stepClone(a, k, dt);
      if (a.step === 7 && a.loose?.every((l) => l.home)) k = 1; // (his sword and fang both back in his hands)
    }
    // (what's marked on the floor pulsing: what's about to burn, and where it can't reach)
    for (const m of b.marks) if (m.pulse) m.opacity = m.pulse * (0.7 + 0.3 * Math.sin(t * 9));
    this.float(dt, lift);
    this.flicker(this.t);
    if (k >= 1) this.nextStep();
    return 0;
  }

  // The lunge: coiled, he sinks a little, his flame flaring, the rush of his flight heard coming (`left`:
  // the seconds till he thrusts); thrusting, he shoots forward low, all on his way to his sword's point
  // suffering; recovering, he rises again.
  stepLunge(a, k, dt, left) {
    const b = this.b;
    const L = FLAME_FIGHT.low;
    if (a.step === 0) {
      this.flare(dt);
      this.ease(L.coil, dt, 6);
      if (!a.rushed && left <= HEARD.rush) {
        a.rushed = true;
        this.sound('fly', false, { offset: Math.max(0, HEARD.rush - left) });
      }
    } else if (a.step === 1) {
      const e = 1 - (1 - k) ** 2; // (fastest as it begins)
      this.fight.shift(b, a.x + (a.toX - a.x) * e - b.pos.x, 0);
      b.lift = L.thrust;
      const tip = b.pos.x + a.dir * FLAME_FIGHT.reach.lunge;
      if (this.sweep(a, (px, pz) => Math.abs(pz - a.z) <= FLAME_FIGHT.half.lunge && (px - a.x) * a.dir >= -0.5 && (px - tip) * a.dir <= 0, FLAME_FIGHT.hurt.lunge)) this.sound('sword-hit');
      this.trail(dt);
    } else {
      this.ease(this.bob, dt, 4);
    }
    return false;
  }

  // The flight: drawn back, into his foe's lane and down low, his flame flaring; then across the arena
  // flat out, head first, burning all in his path (his body's length about his middle); upright again.
  stepFly(a, k, dt) {
    const b = this.b;
    if (a.step === 0) {
      this.flare(dt);
      const dz = a.z - b.pos.y;
      this.fight.shift(b, 0, Math.sign(dz) * Math.min(Math.abs(dz), 7 * dt));
      this.ease(FLAME_FIGHT.low.coil, dt, 5);
    } else if (a.step === 1) {
      const e = k * k * (3 - 2 * k);
      this.fight.shift(b, a.x + (a.toX - a.x) * e - b.pos.x, a.z - b.pos.y);
      this.ease(FLAME_FIGHT.low.fly, dt, 10);
      const head = b.pos.x + a.dir * 2.7;
      const tail = b.pos.x - a.dir * 4.4;
      this.sweep(a, (px, pz) => Math.abs(pz - a.z) <= FLAME_FIGHT.half.fly && (px - tail) * a.dir >= 0 && (px - head) * a.dir <= 0, FLAME_FIGHT.hurt.fly);
      this.trail(dt);
    } else {
      this.ease(this.bob, dt, 4);
    }
    return false;
  }

  // Vanishing: the flame gathering round him; gone; fading back in where he's come.
  stepBlink(a, k, dt) {
    if (a.step === 0) this.gather(dt);
    else if (a.step === 2) this.b.fade = k;
  }

  // All his body or his blade passes through just now (`inside`), each only once in the move: how
  // many it wounded.
  sweep(a, inside, dmg) {
    a.seen ??= new Set();
    return this.fight.strike(inside, dmg, a.seen);
  }

  // On to the move's next drawing, and what happens as it's struck.
  nextStep() {
    const b = this.b;
    const a = b.attack;
    a.step += 1;
    a.t = 0;
    const steps = MORVANE_MOVES[a.kind].steps;
    if (a.step >= steps.length) {
      this.done(a);
      return;
    }
    b.pose(steps[a.step][0], true);
    switch (`${a.kind}:${a.step}`) {
      case 'slash:0':
        this.sound('anticipation');
        break;
      case 'slash:1':
        this.cut(a);
        break;
      case 'lunge:1':
        this.sound('woosh');
        break;
      case 'fly:1':
        this.sound('fly');
        break;
      case 'throw:0':
        a.mark = new Decal(this.floor.scene, 'zone', a.x, a.z, a.opt.r * 2 * 32 / 31, { opacity: 0.4 });
        b.marks.push(a.mark);
        break;
      case 'throw:1':
        this.fling(a);
        break;
      case 'blink:0':
      case 'eye:0':
      case 'pillar:0':
      case 'clone:0':
        this.voices.teleport = this.sound('teleport', false, { offset: Math.max(0, HEARD.burst - MORVANE_MOVES[a.kind].steps[0][1]) });
        break;
      case 'blink:1':
      case 'eye:1':
      case 'pillar:1':
        this.vanish(a.to);
        break;
      case 'clone:1':
        this.letGo(a);
        this.vanish(a.to);
        break;
      case 'blink:2':
      case 'eye:2':
        // (over the arena, facing thee: as he's drawn revealed)
        if (a.kind === 'eye') b.body.facing = 1;
        this.appear();
        break;
      case 'eye:3':
        this.sound('eye-position', true);
        break;
      case 'eye:4':
        this.swell(a);
        break;
      case 'eye:5':
        this.warn(a);
        break;
      case 'eye:6':
        this.burstEye(a);
        break;
      case 'pillar:2':
        b.body.facing = a.dir; // (facing across the arena)
        this.appear();
        this.markBand(a);
        break;
      case 'pillar:3':
        this.voices.inhale = this.sound('inhale');
        this.tell('pillar', 'Morvane will breathe a pillar of flame across the arena: get out of the band it will burn, to its near or its far edge', 'red');
        break;
      case 'pillar:4':
        this.breathe(a);
        break;
      case 'pillar:5':
        a.pillar?.stop();
        a.shape = 'none';
        this.tell('spent', 'Spent, Morvane hangs his head: strike him now');
        break;
      case 'clone:2':
        b.body.facing = 1; // (facing thee, as he's drawn begging)
        this.appear();
        this.markRing(a);
        break;
      case 'clone:3':
        this.swellClone(a);
        break;
      case 'clone:4':
        this.split(a);
        break;
      case 'clone:5':
        // (his own head of flame his own again)
        a.eye?.dispose();
        a.eye = null;
        break;
      case 'clone:6':
        this.hush('eye', 1.2);
        this.hush('during', 0.6);
        a.shape = 'none';
        for (const m of a.rings || []) this.fight.unmark(b, m);
        a.rings = null;
        break;
      case 'clone:7':
        a.clone?.dispose();
        a.clone = null;
        this.callBack(a);
        break;
      default:
        break;
    }
  }

  // A move over: the next of a chain (another lunge, another throw), the move a blink was for, or
  // ready again after a pause.
  done(a) {
    const b = this.b;
    b.endMove();
    b.state = 'ready';
    b.cd = rand(...FLAME_FIGHT.pause);
    b.pose('idle');
    const tgt = this.tgt && this.fight.foes().includes(this.tgt) ? this.tgt : null;
    if (!tgt) return;
    if (a.kind === 'blink' && a.then) this.begin(a.then.kind, a.then.opts || {});
    else if (a.kind === 'lunge' && a.chain > 1) {
      const more = { kind: 'lunge', opts: { chain: a.chain - 1 } };
      // (it's left his lane: into it, from across the arena)
      if (Math.abs(tgt.pos.y - b.pos.y) > 1.6) { if (!this.blinkAt(tgt, 'across', more)) b.cd = 0.2; } else this.begin('lunge', more.opts);
    } else if (a.kind === 'throw' && a.throws > 1) this.begin('throw', { throws: a.throws - 1 });
  }

  // Gone in a burst of frenzied flame (and moved meanwhile, unseen, to `to`), to face his foe there.
  vanish(to) {
    const b = this.b;
    const mid = b.lift + this.up('flameMiddle');
    this.fight.fx.push(new FlameBurst(this.floor.scene, b.pos.x, mid, b.pos.y + 0.3, { size: 6, life: 0.55 }));
    this.burst([b.pos.x, mid, b.pos.y], 2.4, 60);
    this.gone = true;
    b.fade = 0;
    if (to) b.pos.set(to[0], to[1]);
    const tgt = this.tgt;
    if (tgt && Math.abs(tgt.pos.x - b.pos.x) > 0.3) b.body.facing = Math.sign(tgt.pos.x - b.pos.x);
  }

  // Back, in a burst of frenzied flame (fading in: stepBlink, stepEye).
  appear() {
    const b = this.b;
    this.gone = false;
    const mid = b.lift + this.up('flameMiddle');
    this.fight.fx.push(new FlameBurst(this.floor.scene, b.pos.x, mid, b.pos.y + 0.3, { size: 6, life: 0.55 }));
    this.burst([b.pos.x, mid, b.pos.y], 2.4, 60);
  }

  // The slash's cut: all before him to his sword's point suffer, and a crescent of frenzied flame
  // flies on down his lane, striking each it passes (once, either).
  cut(a) {
    const b = this.b;
    const { scene, particles } = this.floor;
    const C = FLAME_FIGHT.crescent;
    const H = FLAME_FIGHT.half.slash;
    const [x, z, dir] = [b.pos.x, b.pos.y, a.dir];
    this.sound('woosh');
    const c = new Crescent(scene, x + dir * C.from, C.y, z + 0.12, dir, { size: C.size, speed: C.speed, life: C.life, palette: FRENZY, light: FRENZY_LIGHT });
    const cuts = (px, pz) => Math.abs(pz - z) <= H && (px - x) * dir >= -1 && (px - x) * dir <= FLAME_FIGHT.reach.slash;
    if (this.fight.strike(cuts, FLAME_FIGHT.hurt.slash, c.hit)) this.sound('sword-hit'); // (his blade landing: audio.js)
    this.fight.fx.push({
      step: (dt) => {
        const on = c.step(dt);
        this.fight.strike((px, pz) => Math.abs(px - c.x) <= C.half && Math.abs(pz - c.z) <= H, FLAME_FIGHT.hurt.crescent, c.hit);
        return on;
      },
      dispose: () => c.dispose(),
    });
    particles.emit({
      pos: [x + dir * 3, 3, z + 0.2], spread: [1.8, 1.2, 0.3], vel: [dir * 5, -1, 0], velSpread: [2, 1.5, 0.6],
      color: FLAME, size: 0.09, life: 0.5, count: 26, drag: 2, intensity: 2.6,
    });
    this.ctx.rig?.shake?.(0.15);
  }

  // The fang flung from his hand (throw-2's, before him) at the marked spot: straight there and very
  // fast, point first, never turning, stabbing into the floor at the slant it came in at; then back to
  // his hand (held out: throw-3's), as straight and as fast, grip first, cutting all in its way again;
  // caught, the throw is over (stepMove). Gold sparks stream off it as it goes. He gone meanwhile, it
  // fades where it is.
  fling(a) {
    const b = this.b;
    const fight = this.fight;
    const F = FLAME_FIGHT.fang;
    const px = b.body.sheet.px;
    const reach = (key) => [b.pos.x + b.body.facing * AHEAD[key] * px, b.lift + this.up(key), b.pos.y];
    const from = reach('hand');
    const to = [a.x, 0, a.z];
    const scene = this.floor.scene;
    const fang = new BareFang(scene, from[0], from[1], from[2] + 0.3, F.size);
    const camera = this.ctx.rig?.camera;
    fang.aim(this.screenAngle(from, to), camera); // (pointing at the mark, and so it stays)
    const out = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) / F.speed;
    this.sound('woosh', false, { volume: 0.8 });
    let phase = 'out';
    let t = 0;
    let gone = 0;
    let last = from;
    const seen = new Set();
    // (there, streaming sparks)
    const move = (p, dt) => {
      fang.at(p[0], p[1], p[2] + 0.3);
      fang.step(dt);
      this.streak(p, last, dt);
      last = p;
    };
    fight.fx.push({
      step: (dt) => {
        t += dt;
        if (!b.alive) {
          gone += dt;
          fang.opacity = Math.max(0, 1 - gone / 0.4);
          return gone < 0.4;
        }
        if (phase === 'out') {
          const k = Math.min(1, t / out);
          move([from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, from[2] + (to[2] - from[2]) * k], dt);
          if (k >= 1) {
            phase = 'stuck';
            t = 0;
            fang.stuck = true;
            fang.at(to[0], to[1], to[2] + 0.3);
            this.fangLands(a, to);
          }
          return true;
        }
        if (phase === 'stuck') {
          fang.step(dt);
          if (t >= F.stay) {
            phase = 'back';
            t = 0;
            fang.stuck = false;
            this.ctx.sound?.play('morvane-woosh', { at: [to[0], to[2]], volume: 0.5, pitch: 1.15 });
          }
          return true;
        }
        // back to his hand, wherever it is now
        const goal = reach('catch');
        const back = Math.hypot(goal[0] - to[0], goal[1] - to[1], goal[2] - to[2]) / F.speed;
        const k = Math.min(1, t / back);
        const p = [to[0] + (goal[0] - to[0]) * k, to[1] + (goal[1] - to[1]) * k, to[2] + (goal[2] - to[2]) * k];
        move(p, dt);
        fight.strike((qx, qz) => Math.abs(qx - p[0]) <= 0.9 && Math.abs(qz - p[2]) <= FLAME_FIGHT.half.fang, FLAME_FIGHT.hurt.back, seen);
        if (k < 1) return true;
        if (b.attack === a) a.caught = true;
        return false;
      },
      dispose: () => fang.dispose(),
    });
  }

  // Which way on the screen something goes from `p` to `q` ([x, height, z] over the arena's floor):
  // radians, 0 to the right, up from there.
  screenAngle(p, q) {
    const cam = this.ctx.rig?.camera;
    if (!cam) return Math.atan2(q[1] - p[1], q[0] - p[0]);
    const a = SCREEN[0].set(p[0], ARENA.y + p[1], p[2]).project(cam);
    const c = SCREEN[1].set(q[0], ARENA.y + q[1], q[2]).project(cam);
    return Math.atan2(c.y - a.y, (c.x - a.x) * cam.aspect);
  }

  // What streams off the thrown fang behind it, going from `q` to `p`: gold sparks.
  streak(p, q, dt) {
    if (Math.random() > dt * 40) return;
    const d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
    const len = Math.hypot(d[0], d[1], d[2]) || 1;
    this.floor.particles.emit({
      pos: [p[0], p[1], p[2] + 0.2], spread: [0.15, 0.15, 0.1],
      vel: [(-d[0] / len) * 2.2, (-d[1] / len) * 2.2 + 0.3, (-d[2] / len) * 2.2], velSpread: [0.5, 0.5, 0.3],
      color: ['#fff2b0', '#ffd24a', '#e8a020'], size: 0.05, life: 0.35, count: 2, drag: 1.4, intensity: 2.8,
    });
  }

  // The fang lands: point-first in the floor, all inside its mark suffer, the stone cracks, gold
  // sparks fly (heard stabbing into it).
  fangLands(a, [x, , z]) {
    const b = this.b;
    const { scene, particles } = this.floor;
    if (a.mark && b.marks.includes(a.mark)) this.fight.unmark(b, a.mark);
    a.mark = null;
    a.shape = 'none';
    this.fight.strike((px, pz) => Math.hypot(px - x, (pz - z) * 1.1) <= FLAME_FIGHT.fang.r, FLAME_FIGHT.hurt.stab);
    const crack = new Decal(scene, 'goldCrack', x, z, 2.6, { glow: false });
    let life = 0;
    this.fight.fx.push({
      step: (dt) => { life += dt; crack.opacity = Math.min(1, Math.max(0, (3 - life) / 1.2)); return life < 3; },
      dispose: () => crack.dispose(),
    });
    particles.emit({
      pos: [x, 0.3, z], spread: [0.2, 0.1, 0.2], vel: [0, 2.6, 0], velSpread: [2.4, 1.8, 1.6],
      color: ['#fff2b0', '#ffd24a', '#e8a020', '#ffffff'], size: 0.06, life: 0.5, count: 26, gravity: 7, drag: 0.8, intensity: 3,
    });
    flash(scene, [x, 0.8, z + 0.3], { color: '#ffd27a', power: 35, reach: 8, life: 0.3 });
    this.ctx.sound?.play('morvane-fang-hit', { at: [x, z] });
    this.ctx.rig?.shake?.(0.08);
  }

  // The Frenzied Eye as it goes on: gathering, he vanishes; back over the middle of the arena, fading
  // in; rising; the Eye swelling, dragging everyone in, flames raining; at its biggest, white-hot and
  // quivering; bursting, gone in a flash; down he comes again.
  stepEye(a, k, dt, t) {
    const b = this.b;
    if (a.step === 0) { this.gather(dt); return true; }
    if (a.step === 2) { b.fade = k; return true; }
    if (a.step === 3) {
      b.lift = this.bob + (EYE.height - this.bob) * (1 - (1 - k) ** 2);
      return false;
    }
    if (a.step >= 4 && a.step <= 6) {
      b.lift = EYE.height + this.bob;
      const e = a.eye;
      if (a.step === 4) {
        const g = k * k; // (slowly at first)
        e.size = EYE.size[0] + (EYE.size[1] - EYE.size[0]) * g;
        e.white = 0;
        this.pull(dt, EYE.pull[0] + (EYE.pull[1] - EYE.pull[0]) * k);
        this.rain(a, dt);
        e.step(dt, g);
      } else if (a.step === 5) {
        e.size = EYE.size[1] * (1 + 0.04 * Math.sin(t * 40));
        e.white = 0.5 + 0.5 * Math.sin(t * 30);
        this.pull(dt, EYE.pull[1]);
        this.rain(a, dt);
        e.step(dt, 1);
        // (the fighters see it coming, and hop it, mostly, just as it bursts)
        if (!a.hopped && a.t >= MORVANE_MOVES.eye.steps[5][1] - 0.25) {
          a.hopped = true;
          this.hopAll();
        }
      } else {
        e.size = EYE.size[1] * (1 + k * 0.5);
        e.opacity = Math.max(0, 1 - k * 2.5);
        e.step(dt, 1 - k);
      }
      e.x = b.pos.x;
      e.y = b.lift + this.up('eye');
      e.z = b.pos.y + 0.4;
      return false;
    }
    if (a.step === 7) {
      this.ease(this.bob, dt, 2.5);
      return false;
    }
    return true;
  }

  // The Eye opens over his head of flame and begins to swell: it drags, and flames begin to fall.
  swell(a) {
    const b = this.b;
    a.eye = new Eye(this.floor.scene, b.pos.x, b.lift + this.up('eye'), b.pos.y + 0.4, EYE.size[0]);
    a.shape = 'spots';
    this.voices.eye = this.sound('eye', true);
    this.voices.during = this.sound('eye-during', true);
    this.tell('eye', 'The Frenzied Eye drags everyone in while flames rain down: keep off their marks, and dodge (Space) the moment it bursts', 'red');
  }

  // About to burst: white-hot, quivering, and a sharp cue to dodge.
  warn(a) {
    const e = a.eye;
    this.sound('dodge', true);
    flash(this.floor.scene, [e.x, e.y, e.z + 1], { color: '#fff4c0', power: 90, reach: 30, life: 0.5 });
  }

  // It bursts over the whole arena: all on it suffer (the nearer him the harder; not thee dodging, nor
  // a fighter hopping it), the arena flashing white-gold, the ground shaking.
  burstEye(a) {
    const b = this.b;
    const { cx, cz } = this.ctx.world.arena;
    const R = ARENA.walkRadius;
    const H = FLAME_FIGHT.hurt;
    this.hurtAll((n) => Math.round(H.eyeEdge + (H.eye - H.eyeEdge) * Math.max(0, 1 - Math.hypot(n.pos.x - cx, n.pos.y - cz) / R)));
    this.hush('during', 0.3);
    this.sound('eye-burst', true);
    const e = a.eye;
    for (let k = 0; k < 4; k++) {
      const ang = (k / 4) * Math.PI * 2 + Math.PI / 4;
      flash(this.floor.scene, [cx + Math.cos(ang) * R * 0.5, 2.5, cz + Math.sin(ang) * R * 0.4], { color: FRENZY_LIGHT, power: 90, reach: 24, life: 0.9, rise: 0.04 });
    }
    flash(this.floor.scene, [e.x, e.y, e.z + 1], { color: '#fff4c0', power: 160, reach: 40, life: 0.8 });
    this.burst([b.pos.x, e.y, b.pos.y + 0.5], 7, 220);
    this.floor.particles.emit({
      pos: [cx, 0.5, cz], spread: [R * 0.75, 0.3, R * 0.7], vel: [0, 3.2, 0], velSpread: [1.6, 2, 1.6],
      color: FLAME, size: 0.12, life: 1.1, count: 160, drag: 1, intensity: 2.8,
    });
    this.ctx.rig?.shake?.(0.5);
    a.shape = 'none';
    a.opt.spots = [];
  }

  // Everyone on the arena dragged toward him (thee unless mid-dodge), `speed` world units a second, no
  // nearer than a little off him.
  pull(dt, speed) {
    const { pilot, director, world } = this.ctx;
    const b = this.b;
    const drag = (n, ok) => {
      const dx = b.pos.x - n.pos.x;
      const dz = b.pos.y - n.pos.y;
      const d = Math.hypot(dx, dz);
      if (d < 2.5) return;
      const s = Math.min(d - 2.5, speed * dt);
      const x = n.pos.x + (dx / d) * s;
      const z = n.pos.y + (dz / d) * s;
      if (ok(x, z)) n.pos.set(x, z);
    };
    const me = pilot.npc;
    if (me && !pilot.dead && !me.travel && this.fight.inArena(me) && me.action?.kind !== 'dodge') drag(me, (x, z) => pilot.canStand(x, z));
    for (const n of director.npcs.values()) {
      if (!n.fighter || n.fighter.dead || n.piloted || n.travel) continue;
      drag(n, (x, z) => world.isWalkArea(x, z) && !world.isBlocked(x, z, 0.2));
    }
  }

  // A flame falling out of the sky now and then, onto a marked spot (some about a foe): it bursts there,
  // and all on the mark suffer. (The marks are what the fighters run from: `spots`.)
  rain(a, dt) {
    a.rainIn -= dt;
    if (a.rainIn > 0) return;
    a.rainIn = rand(...EYE.rain);
    const { scene, particles } = this.floor;
    const { cx, cz } = this.ctx.world.arena;
    const foes = this.fight.foes();
    let x;
    let z;
    if (foes.length && Math.random() < EYE.aimed) {
      const n = foes[Math.floor(Math.random() * foes.length)];
      x = n.pos.x + rand(-1.4, 1.4);
      z = n.pos.y + rand(-1.1, 1.1);
    } else {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (ARENA.walkRadius - 1.5);
      x = cx + Math.cos(ang) * r;
      z = cz + Math.sin(ang) * r;
    }
    const spot = [x, z];
    a.opt.spots.push(spot);
    const mark = new Decal(scene, 'zone', x, z, EYE.r * 2 * 32 / 31, { opacity: 0.55 });
    const drift = (Math.random() < 0.5 ? -1 : 1) * 3;
    const ball = new FlameBall(scene, x - drift, 15, z, { size: 1.9, turn: -Math.PI / 2 });
    // (heard from the moment it falls, its burst's crest as it lands: HEARD)
    this.ctx.sound?.play('morvane-burst', { at: [x, z], volume: 0.4, delay: Math.max(0, EYE.fall - HEARD.flame) });
    let t = 0;
    let landed = false;
    this.fight.fx.push({
      step: (dt) => {
        t += dt;
        if (!landed) {
          const k = Math.min(1, t / EYE.fall);
          const e = k * k; // (speeding up as it falls)
          ball.at(x - drift * (1 - e), 0.6 + 14.4 * (1 - e), z);
          ball.step(dt);
          mark.opacity = 0.45 + 0.4 * Math.sin(t * 30);
          if (k < 1) return true;
          landed = true;
          t = 0;
          ball.opacity = 0;
          const i = a.opt.spots.indexOf(spot);
          if (i >= 0) a.opt.spots.splice(i, 1);
          this.fight.strike((px, pz) => Math.hypot(px - x, (pz - z) * 1.1) <= EYE.r, FLAME_FIGHT.hurt.rain);
          this.fight.fx.push(new FlameBurst(scene, x, 1.1, z + 0.3, { size: 3.4, life: 0.45, power: 45, reach: 10 }));
          particles.emit({
            pos: [x, 0.4, z], spread: [0.5, 0.3, 0.4], vel: [0, 3, 0], velSpread: [2.4, 2, 2],
            color: FLAME, size: 0.1, life: 0.6, count: 18, gravity: 6, drag: 0.6, intensity: 2.6,
          });
        }
        mark.opacity = Math.max(0, 1 - t / 0.25);
        return t < 0.25;
      },
      dispose: () => { ball.dispose(); mark.dispose(); },
    });
  }

  // ------------------------------------------------------------------------------------------
  // his pillar of flame

  // As it goes on: gathering, he vanishes; back at one side of the arena, fading in; leaning back,
  // drawing breath, his flame flaring; breathing it out, all it covers suffering (each once; not thee
  // while dodging, only till the dodge is over: there's no dodging through it), embers flying off it;
  // spent, sagging a little as its tail flows away, breathing in and out (SPENT); upright again.
  stepPillar(a, k, dt) {
    const b = this.b;
    if (a.step === 0) this.gather(dt);
    else if (a.step === 2) b.fade = k;
    else if (a.step === 3) this.flare(dt);
    const p = a.pillar;
    if (p && (a.step === 4 || a.step === 5)) {
      this.fight.strike((px, pz) => p.covers(px, pz), FLAME_FIGHT.hurt.pillar, a.seen);
      const me = this.ctx.pilot.npc;
      if (me?.action?.kind === 'dodge') a.seen.delete(me);
      this.embers(p, dt);
    }
    if (a.step === 4) this.flaring = 0.25;
    if (a.step !== 5) return true;
    a.breaths ??= 0;
    while (a.breaths < SPENT.length && a.t >= SPENT[a.breaths][1]) this.voices.spent = this.sound(`spent-${SPENT[a.breaths++][0]}`);
    this.ease(PILLAR.sag, dt, 3);
    return false;
  }

  // The band the pillar will burn, marked on the floor in his flame's light: what the fighters run
  // from.
  markBand(a) {
    const { cx, cz } = this.ctx.world.arena;
    const m = new Decal(this.floor.scene, 'band', cx, cz, (FLOOR * 2 * 96) / 92, { opacity: 0.4, arg: PILLAR.half / FLOOR, palette: FRENZY });
    m.pulse = 0.45;
    a.mark = m;
    this.b.marks.push(m);
  }

  // He breathes it out: the pillar pours out of his head of flame across the arena (frenzyfx.js), its
  // mark gone under it; its flash, its roar heard (wherever thou art), the ground shaking.
  breathe(a) {
    const b = this.b;
    const { cx, cz } = this.ctx.world.arena;
    if (a.mark) this.fight.unmark(b, a.mark);
    a.mark = null;
    const [x, y, z] = this.headIn('breathe');
    a.seen = new Set();
    a.pillar = new Pillar(this.floor.scene, { from: [x, y, z + 0.3], dir: a.dir, cx, cz, r: PILLAR.reach, half: PILLAR.half });
    this.fight.fx.push(a.pillar); // (flowing away on its own once he stops breathing it)
    flash(this.floor.scene, [x, y, z + 1], { color: FRENZY_LIGHT, power: 120, reach: 30, life: 0.6 });
    this.voices.breath = this.sound('breath', true);
    this.ctx.rig?.shake?.(0.35);
  }

  // Embers flying off the pillar as it burns, carried along with its flame.
  embers(p, dt) {
    if (Math.random() > dt * 40) return;
    const [a, b] = p.span();
    const s = a + Math.random() * (Math.min(b, p.long) - a);
    const { cz } = this.ctx.world.arena;
    this.floor.particles.emit({
      pos: [p.from[0] + p.dir * s, 0.4 + Math.random() * 2.6, cz + (Math.random() * 2 - 1) * PILLAR.half * Math.min(1, s / 5)], spread: [0.6, 0.3, 0.6],
      vel: [p.dir * 6, 1.6, 0], velSpread: [2, 1.2, 0.8], color: FLAME, size: 0.08, life: 0.6, count: 4, drag: 1, intensity: 2.8,
    });
  }

  // ------------------------------------------------------------------------------------------
  // his clone flame

  // As it goes on: gathering, he vanishes, his sword and fang falling (heard landing); back over the
  // middle of the arena, fading in; his head of flame swelling; the clone parting from it and racing
  // out to its round, his own shrinking back; racing round and round; dying away; his sword and fang
  // flying back to his hands (stepMove: the move over once both are there).
  stepClone(a, k, dt) {
    const b = this.b;
    (a.loose || []).forEach((l, i) => {
      if (!l.landed || l.heard) return;
      l.heard = true;
      this.ctx.sound?.play(i === 0 ? 'morvane-drop-sword' : 'morvane-drop-fang', { at: l.land });
    });
    if (a.step === 0) this.gather(dt);
    else if (a.step === 2) b.fade = k;
    else if (a.step === 3) {
      this.follow(a.eye, EYE.size[0] + (CLONE.size - EYE.size[0]) * k * k, dt, k); // (slowly at first)
      this.flaring = 0.25;
    } else if (a.step === 4) {
      this.follow(a.eye, CLONE.size + (EYE.size[0] - CLONE.size) * (1 - (1 - k) ** 2), dt, 1 - k);
      this.orbit(a, dt, k);
    } else if (a.step === 5) this.orbit(a, dt, 1);
    else if (a.step === 6) this.orbit(a, dt, 1 - 0.5 * k, 1 - k);
    return true;
  }

  // His head of flame swollen (an Eye over it, `size` across), kept on it.
  follow(e, size, dt, glow) {
    const [x, y, z] = this.headIn('beg');
    Object.assign(e, { x, y, z: z + 0.4, size });
    e.step(dt, glow);
  }

  // His sword and his fang let fall from his hands as he vanishes (frenzyfx.js, Loose: they drop and
  // lie on the floor where he was, beside him, as when he's felled).
  letGo(a) {
    const b = this.b;
    const f = b.body.facing;
    const scene = this.floor.scene;
    const from = (key) => {
      const [x, y, z] = this.spot('idle', HELD[key]);
      return [x, y, z + 0.2];
    };
    a.loose = [
      new Loose(scene, 'morvane-sword', from('sword'), this.inside(b.pos.x - f * 1.4, b.pos.y + 0.5, 1.5), { angle: f * 0.5, grip: GRIP.sword }),
      new Loose(scene, 'morvane-fang', from('fang'), this.inside(b.pos.x + f * 1.6, b.pos.y + 0.7, 1.5), { angle: -f * 1.2, grip: GRIP.fang }),
    ];
    for (const l of a.loose) this.fight.fx.push(l);
  }

  // The ring the clone will race round, marked on the floor in his flame's light, and the golden
  // circle by him it can't reach: what the fighters run from, and to.
  markRing(a) {
    const b = this.b;
    const { cx, cz } = this.ctx.world.arena;
    const ring = new Decal(this.floor.scene, 'annulus', cx, cz, (FLOOR * 2 * 96) / 92, { opacity: 0.4, arg: CLONE.safe / FLOOR, palette: FRENZY });
    const safe = new Decal(this.floor.scene, 'heart', cx, cz, (CLONE.safe * 2 * 48) / 45, { opacity: 0.9 });
    ring.pulse = 0.45;
    safe.pulse = 0.95;
    a.rings = [ring, safe];
    b.marks.push(ring, safe);
  }

  // His head of flame begins to swell (the Frenzied Eye's drawing over it, his own hidden meanwhile:
  // holeAt), heard swelling.
  swellClone(a) {
    const [x, y, z] = this.headIn('beg');
    a.eye = new Eye(this.floor.scene, x, y, z + 0.4, EYE.size[0]);
    this.voices.eye = this.sound('eye', true);
    this.tell('clone', 'A clone of his flame will race round the arena: get in close to Morvane, into the golden circle by him', 'red');
  }

  // A clone of his swollen head of flame parts from it, racing out to its round (out behind him first,
  // away from thee, either way round), and his own shrinks back (a second Eye over it, till it's his
  // own again: nextStep); heard bursting off, and racing round on and on till it dies away (nextStep).
  split(a) {
    const [x, y, z] = this.headIn('beg');
    a.clone = a.eye;
    a.eye = new Eye(this.floor.scene, x, y, z + 0.4, CLONE.size);
    Object.assign(a, { spin: Math.random() < 0.5 ? 1 : -1, turn: -Math.PI / 2, out: 0, lap: null, high: y, seen: new Set() });
    this.burst([x, y, z], 3, 90);
    this.sound('burst', false, { offset: HEARD.flame - 0.05 }); // (at its crest at once)
    this.voices.during = this.sound('clone', true);
  }

  // The clone racing round (`speed`: its share of full speed; `seen`: how much of it is left): out from
  // his head of flame to its round as it parts from it, then round and round, flame streaming off it;
  // once it's out there, all it passes suffer (each once a lap: not thee dodging it as it passes), while
  // it's whole; a woosh as it races past thee.
  orbit(a, dt, speed, seen = 1) {
    const C = CLONE;
    const c = a.clone;
    const { cx, cz } = this.ctx.world.arena;
    const before = a.turn;
    a.turn += a.spin * speed * dt * ((2 * Math.PI) / C.lap);
    a.out = Math.min(1, a.out + dt / MORVANE_MOVES.clone.steps[4][1]);
    const e = 1 - (1 - a.out) ** 2;
    const at = (turn) => [cx + Math.cos(turn) * C.r * e, cz + Math.sin(turn) * C.r * e];
    const [x, z] = at(a.turn);
    Object.assign(c, { x, y: a.high + (C.y - a.high) * e, z, size: C.size * (0.7 + 0.3 * seen) });
    c.opacity = seen;
    c.step(dt, seen);
    // (each lap round, each it passes may suffer again)
    const lap = Math.floor((a.turn * a.spin) / (2 * Math.PI));
    if (lap !== a.lap) {
      a.lap = lap;
      a.seen = new Set();
    }
    if (seen > 0.5 && e > 0.95) {
      // (where it's been since the last moment, a few steps along: it's so fast)
      for (let i = 1; i <= 3; i++) {
        const [qx, qz] = at(before + ((a.turn - before) * i) / 3);
        this.fight.strike((px, pz) => Math.hypot(px - qx, pz - qz) <= C.hurt, FLAME_FIGHT.hurt.clone, a.seen);
      }
    }
    const me = this.ctx.pilot.npc;
    if (me && e >= 1) {
      const wrap = (v) => Math.atan2(Math.sin(v), Math.cos(v));
      const mine = Math.atan2(me.pos.y - cz, me.pos.x - cx);
      if (Math.sign(wrap(before - mine)) !== Math.sign(wrap(a.turn - mine)) && Math.abs(wrap(a.turn - mine)) < 1) this.ctx.sound?.play('morvane-woosh', { at: [x, z], volume: seen });
    }
    if (Math.random() < dt * 40 * seen) {
      const [tx, tz] = [-Math.sin(a.turn) * a.spin, Math.cos(a.turn) * a.spin]; // (the way it's going)
      this.floor.particles.emit({
        pos: [x, c.y, z + 0.5], spread: [C.size * 0.25, C.size * 0.25, 0.5], vel: [-tx * 6, 1.2, -tz * 6], velSpread: [1.5, 1.2, 1],
        color: FLAME, size: 0.12, life: 0.7, count: 6, drag: 1.2, intensity: 2.8,
      });
    }
  }

  // His sword and his fang rise off the floor and fly back into his raised hands (each its grip in a
  // palm: the sword in his right, on the picture-left), heard flying.
  callBack(a) {
    for (const [l, key] of [[a.loose[0], 'sword'], [a.loose[1], 'fang']]) {
      l.call(() => {
        const [x, y, z] = this.spot('beg', HANDS.beg[key]);
        return [x, y, z + 0.3];
      });
    }
    this.sound('woosh', false, { volume: 0.7 });
  }

  // The fighters about to be caught by the Eye's burst hop it, mostly (as they hop Fenrath's cuts).
  hopAll() {
    for (const n of this.ctx.director.npcs.values()) {
      const f = n.fighter;
      if (!f || f.dead || n.travel || n.piloted || f.hop) continue;
      if (Math.random() < (f.coward ? 0.95 : 0.78)) f.hop = { t: 0, dur: 0.55 };
    }
  }

  // All on the arena struck, each as hard as `dmgOf` says (not thee dodging, fight.hurtPlayer; nor a
  // fighter in the air).
  hurtAll(dmgOf) {
    const { pilot, director } = this.ctx;
    const f = this.fight;
    const me = pilot.npc;
    if (me && !pilot.dead && f.inArena(me)) f.hurtPlayer(dmgOf(me));
    for (const n of director.npcs.values()) if (n.fighter && !n.piloted && !(n.lift > 0.3)) f.hurtFighter(n, dmgOf(n));
  }

  // His states of his own (fight.stepBoss): changing, to his reveal and the fight. Returns how far he
  // trembles.
  stepState(dt) {
    return this.b.state === 'change' ? this.stepChange(dt) : 0;
  }

  // A move over, or cut short (Boss.endMove): the Eye or the clone gone, their sounds dying away; the
  // pillar flowing away; his sword and fang, if still let go of, fading where they are; and he's back,
  // if he'd vanished.
  endMove() {
    const a = this.b.attack;
    if (a?.eye) {
      a.eye.dispose();
      a.eye = null;
    }
    if (a?.clone) {
      a.clone.dispose();
      a.clone = null;
    }
    if (a?.kind === 'eye' || a?.kind === 'clone') {
      this.hush('eye', 1.2);
      this.hush('during', 0.3);
    }
    a?.pillar?.stop();
    for (const l of a?.loose || []) if (!l.home) l.fade(0.4);
    if (this.gone) {
      this.gone = false;
      this.b.fade = 1;
    }
  }

  // Felled (fight.js, his second bar emptied): on his knees, his flame shrinking, and slumped, seen
  // whole a while (MORVANE.felled), then fading away (the fight fades him); his sword and his fang let
  // fall on the floor beside him (heard where each lies), fading as he does; heard falling
  // (morvane_felled and 2); his light and his arena's fire burning on till he fades, and dying with him.
  dies() {
    const b = this.b;
    for (const k of Object.keys(this.voices)) this.hush(k, 0.6);
    const { scene } = this.floor;
    const f = b.body.facing;
    // (all of his fall that outlasts him, done with at once should he stand again: rise)
    const fall = { over: false };
    this.fall = fall;
    const seen = () => (fall.over ? 0 : b.fade);
    const sword = [b.pos.x - f * 1.4, b.pos.y + 0.5];
    const fang = [b.pos.x + f * 1.6, b.pos.y + 0.7];
    this.fight.fx.push(new Dropped(scene, 'morvane-sword', ...sword, { angle: f * 0.5, seen }));
    this.fight.fx.push(new Dropped(scene, 'morvane-fang', ...fang, { angle: -f * 1.2, seen }));
    this.sound('felled');
    this.ctx.sound?.play('morvane-drop-sword', { at: sword });
    this.ctx.sound?.play('morvane-drop-fang', { at: fang });
    const { hold, fade } = MORVANE.felled;
    const light = this.light;
    this.light = null;
    const level = light?.level ?? 0;
    let faded = false;
    this.fight.fx.push({
      step: () => {
        if (fall.over) return false;
        if (light) light.level = level * b.fade;
        if (!faded && b.t >= hold) {
          faded = true;
          this.inferno?.end(fade); // (his arena's fire dying with him, and its roar)
          this.fire?.stop(fade);
        }
        return !faded || b.fade > 0;
      },
      dispose: () => light?.end(0.1),
    });
    this.ctx.ui.log('Morvane, Lord of Frenzied Flame, falls to his knees, his flame guttering out', 'gold', { region: this.ctx.world.arena });
  }

  closeHeart() {}

  dispose() {
    for (const k of Object.keys(this.voices)) this.hush(k, 0.5);
    this.light?.end(0.5);
    this.light = null;
    this.inferno?.end();
    this.inferno = null;
    this.fire?.stop(0.5);
    this.fire = null;
    this.head?.end();
    this.head = null;
    this.dark(false, 0.3);
  }
}
