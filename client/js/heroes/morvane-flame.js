// Morvane's second form, the Lord of Frenzied Flame (morvane.js; his first, heroes/morvane.js): the
// same withered body, grown three times as tall, floating, his head a ring of frenzied flame round a
// pitch-black hole, the sword he tore out of himself in one hand and a gold fang in the other, his
// drapes burning at their ragged edges. Sacha's own drawings (art/bosses/Morvane): at rest
// (morvane-flame-idle, the master) and revealed, facing thee, arms spread (morvane-flame-reveal).
//
// Source art: assets/morvane/morvane-flame.json (173x301, from morvane-flame-idle.png on its
// 4.959 x 4.995 px grid) and morvane-flame-reveal.json, on its palette, sampled at 4.72 x 4.76 (the
// brooch, the head of flame and the body measured against the master's). Both are set in the frame by
// the brooch on his chest (its middle column) and his toes, which float a little above its last row:
// the sword hangs below them.

import { Img, NONE } from './core.js';

const FRAME = { w: 216, h: 302 };
const MID = FRAME.w / 2;
const BELOW = 24; // (rows under his toes, for the sword hanging below them)

// Each drawing: its file, the brooch's column, its toes' row.
const ART = {
  idle: { mid: 107.5, toes: 276 },
  reveal: { mid: 98, toes: 267 },
};

// What burns: the head of flame, the burning edges of his drapes, the cracks in his chest and the
// sword's gold, all of it glowing orange (none white-hot: that would bloom the head of flame into a
// blot, its black hole lost), always lit as drawn (never dimmed nor flared, which would paint the
// head of flame over in one colour: its flicker is the game's, morvane.js), with embers flying up
// off it.
const HOT = 'OTUWabdfhjkoptuvxyz023456789+/';

function prepare(art, more = {}) {
  const { ids, code } = art;
  return {
    arts: { idle: art.frames, reveal: more.reveal?.frames },
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

function compose(ctx, p) {
  const f = new Img(FRAME.w, FRAME.h);
  const a = ART[p.art];
  const img = ctx.arts[p.art][0];
  const ox = Math.round(MID - a.mid);
  const oy = FRAME.h - 1 - BELOW - a.toes;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const v = img.c[y * img.w + x];
      if (v !== NONE) f.set(ox + x, oy + y, v);
    }
  }
  return f;
}

// ---------------------------------------------------------------------------------------------
// the animation set: each drawing as it is, its flames flickering

const poses = [];
const groups = {};
function anim(name, list) {
  groups[name] = list.map((p) => { poses.push(p); return poses.length - 1; });
}
anim('idle', [1, 2, 1, 0, 1, 2].map((light) => ({ art: 'idle', light })));
anim('reveal', [1, 2, 1, 2].map((light) => ({ art: 'reveal', light })));

const G = groups;
export default {
  id: 'morvane-flame',
  src: import.meta.url,
  art: '/assets/morvane/morvane-flame.json',
  extraArt: { reveal: '/assets/morvane/morvane-flame-reveal.json' },
  firstName: 'Morvane',
  epithet: 'Lord of Frenzied Flame',
  title: 'Great Enemy',
  frame: FRAME,
  cols: 4,
  px: 2.31 / 91, // (the same as his first form's: three times as tall, in three times the pixels; 7 units, flame to toes)
  head: 290,
  below: BELOW, // (rows under his toes in every frame: morvane.js floats him by them)
  hits: {},
  glowIntensity: 0.3, // (no more: the head of flame is drawn bright, and blooms past it)
  glowColors: [[255, 150, 40], [255, 240, 190], [255, 190, 80]],
  seed: 6160,
  prepare,
  compose,
  poses,
  groups,
  anims: {
    idle: { frames: G.idle, fps: 7 },
    reveal: { frames: G.reveal, fps: 7 },
  },
  groupFps: {},
};
