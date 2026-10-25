// Morvane's second form, the Lord of Frenzied Flame (morvane.js; his first, heroes/morvane.js): the
// same withered body, grown three times as tall, floating, his head a ring of frenzied flame round a
// pitch-black hole, the sword he tore out of himself in his right hand and a gold fang in his left,
// his drapes burning at their ragged edges. Sacha's own drawings (art/bosses/Morvane): at rest
// (morvane-flame-idle, the master), revealed, facing thee, arms spread (morvane-flame-reveal), and
// his fight: flying (fly), the lunge (coiled, and thrust: lunge-1, -2), the slash (raised, the cut,
// its follow-through: swing-1 to -3), the fang thrown (drawn back, flung, the hand held out for it to
// come back: throw-1 to -3), and felled (on his knees, then slumped: death). Every one but the
// reveal and the fall is drawn facing left too, not mirrored: drawn turned toward us, his hands would
// swap in a mirror (the sword is always in the hand on the picture-left, the fang in the other).
//
// Source art: assets/morvane/morvane-flame.json (173x301, from morvane-flame-idle.png on its
// 4.959 x 4.995 px grid) and morvane-flame-<drawing>.json, all on its palette. The reveal is sampled
// at 4.72 x 4.76; the fight's drawings, which came at about two-thirds the master's size, at 3.33 (his
// height from the hole in his head of flame to his toes the master's); the two flights, drawn bigger,
// at 4.8 and 5.1 (his body as long as the lunge's). Each is set in the frame by the brooch on his
// belly (BROOCH: the frame's anchor column, and row BROOCH), so that whatever he does his body stays
// where it was; the fallen ones by the ground they kneel on (the frame's last row). The drawings
// that reach far out (a sword at full stretch, a flight) are in frames of their own (BIG).

import { Img, NONE } from './core.js';

const FRAME = { w: 336, h: 325, anchor: 169 };
const BIG = { w: 600, h: 325, anchor: 278 };
const BROOCH = 158; // (the brooch's row: 166 rows above the frame's last, room for the sword below his toes)

// Each drawing (assets/morvane/morvane-flame-<name>.json; at rest, the master, morvane-flame.json):
// its brooch (column, row), or for the fallen ones the row they kneel on (`ground`); whether it's
// drawn facing left, and whether it's one of the big frames'.
const ART = {
  idle: { mid: 107.5, row: 149.4 },
  'idle-left': { mid: 130.5, row: 147.1, left: true },
  reveal: { mid: 98.6, row: 139.7 },
  fly: { mid: 202.7, row: 98.8, big: true },
  'fly-left': { mid: 115.5, row: 94.2, left: true, big: true },
  'lunge-1': { mid: 224, row: 144.5, big: true },
  'lunge-1-left': { mid: 275.7, row: 148.2, left: true, big: true },
  'lunge-2': { mid: 176.9, row: 94, big: true },
  'lunge-2-left': { mid: 313.5, row: 95.2, left: true, big: true },
  'swing-1': { mid: 230.8, row: 141, big: true },
  'swing-1-left': { mid: 77.6, row: 148.1, left: true },
  'swing-2': { mid: 175.4, row: 147.9, big: true },
  'swing-2-left': { mid: 287, row: 147.6, left: true, big: true },
  'swing-3': { mid: 275.5, row: 155.6, big: true },
  'swing-3-left': { mid: 241.4, row: 152, left: true, big: true },
  'throw-1': { mid: 144.1, row: 152 },
  'throw-1-left': { mid: 160.6, row: 143.6, left: true },
  'throw-2': { mid: 145.3, row: 145.5 },
  'throw-2-left': { mid: 145.7, row: 149.4, left: true },
  'throw-3': { mid: 121.1, row: 150 },
  'throw-3-left': { mid: 143.7, row: 148.4, left: true },
  'death-1': { mid: 132.2, ground: 214 },
  'death-2': { mid: 110.5, ground: 127 },
};
const EXTRA = Object.keys(ART).filter((k) => k !== 'idle');

// What burns: the head of flame, the burning edges of his drapes, the cracks in his chest and the
// sword's gold, all of it glowing orange (none white-hot: that would bloom the head of flame into a
// blot, its black hole lost), always lit as drawn (never dimmed nor flared, which would paint the
// head of flame over in one colour: its flicker is the game's, morvane.js), with embers flying up
// off it.
const HOT = 'OTUWabdfhjkoptuvxyz023456789+/';

function prepare(art, more = {}) {
  const { ids, code } = art;
  return {
    arts: { idle: art.frames, ...Object.fromEntries(EXTRA.map((k) => [k, more[k]?.frames])) },
    energy: {
      hot: ids(HOT),
      core: new Set(),
      soft: new Set(),
      dim: [code('L'), code('o')],
      flare: [code('0'), code('/')],
      crackle: { main: code('x'), core: code('9'), sparks: [code('t'), code('z'), code('4')] },
      odds: [[0, 0, 1], [0, 0, 1], [0, 0, 1]],
      arcs: [0, 0, 0],
      sparks: [1, 3, 5],
      sparkReach: 10,
      sparkRise: 5,
    },
  };
}

// A drawing in its frame: its brooch on the frame's anchor column and row BROOCH (a fallen one, the
// row it kneels on on the frame's last); one drawn facing left, mirrored, so that the sheet's own flip
// as he faces left (npc.js) shows it as drawn: the body plays an animation's `left` frames then.
function compose(ctx, p) {
  const a = ART[p.art];
  const frame = a.big ? BIG : FRAME;
  const f = new Img(frame.w, frame.h);
  const img = ctx.arts[p.art][0];
  const left = !!a.left;
  const ox = Math.round(frame.anchor - (left ? img.w - 1 - a.mid : a.mid));
  const oy = a.ground != null ? frame.h - 1 - a.ground : Math.round(BROOCH - a.row);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const v = img.c[y * img.w + x];
      if (v !== NONE) f.set(ox + (left ? img.w - 1 - x : x), oy + y, v);
    }
  }
  return f;
}

// ---------------------------------------------------------------------------------------------
// the animation set: at rest, his flames flickering; the rest as drawn

const poses = [];
const groups = {};
function anim(name, list) {
  groups[name] = list.map((p) => { poses.push(p); return poses.length - 1; });
}
for (const k of ['idle', 'idle-left']) anim(k, [1, 2, 1, 0, 1, 2].map((light) => ({ art: k, light })));
anim('reveal', [1, 2, 1, 2].map((light) => ({ art: 'reveal', light })));
const ONE = ['fly', 'lunge-1', 'lunge-2', 'swing-1', 'swing-2', 'swing-3', 'throw-1', 'throw-2', 'throw-3'];
for (const k of ONE) for (const s of [k, `${k}-left`]) anim(s, [{ art: s, light: 2, big: !!ART[s].big }]);
anim('death', ['death-1', 'death-2'].map((k) => ({ art: k, light: 1 })));

const G = groups;
export default {
  id: 'morvane-flame',
  src: import.meta.url,
  art: '/assets/morvane/morvane-flame.json',
  extraArt: Object.fromEntries(EXTRA.map((k) => [k, `/assets/morvane/morvane-flame-${k}.json`])),
  firstName: 'Morvane',
  epithet: 'Lord of Frenzied Flame',
  title: 'Great Enemy',
  frame: FRAME,
  bigFrame: BIG,
  cols: 5,
  bigCols: 4,
  px: 2.31 / 91, // (the same as his first form's: three times as tall, in three times the pixels; 7 units, flame to toes)
  head: 318,
  hits: {},
  glowIntensity: 0.3, // (no more: the head of flame is drawn bright, and blooms past it)
  glowColors: [[255, 150, 40], [255, 240, 190], [255, 190, 80]],
  seed: 6160,
  prepare,
  compose,
  poses,
  groups,
  anims: {
    idle: { frames: G.idle, left: G['idle-left'], fps: 7 },
    stagger: { frames: G.idle, left: G['idle-left'], fps: 3 }, // (dazed by an ultimate: at rest, slowly)
    reveal: { frames: G.reveal, fps: 7 },
    ...Object.fromEntries(ONE.map((k) => [k, { frames: G[k], left: G[`${k}-left`], fps: 1 }])),
    collapse: { frames: G.death, fps: 0.9, once: true }, // (felled: fight.js)
  },
  groupFps: {},
};
