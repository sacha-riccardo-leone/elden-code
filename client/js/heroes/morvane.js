// Morvane, the last great enemy of the Arena of Trials (fight.js, morvane.js), in his first form: a
// withered old lord, a little smaller than Maren, a greatsword of twisted gold driven down through his
// skull and its spikes out through his ribs, his mustard drapes in rags. Every drawing is Sacha's own
// (art/bosses/Morvane): standing, fleeing (four), out of breath (two), each also drawn facing left
// (not a mirror: one of his eyes is covered in dead skin, and it keeps its side); and his change:
// gripping the sword in his skull, ripping his own head off with it, kneeling headless from behind,
// and standing so. His second form, the Lord of Frenzied Flame, is heroes/morvane-flame.js.
//
// Source art: assets/morvane/morvane.json (69x122, from morvane-idle.png on its 11.821 px grid) and
// morvane-<drawing>.json, all on its palette. The drawings come at other sizes, so each was sampled
// on the grid that makes the brooch on his chest the master's size: the run at 4.85 source px per art
// pixel, the out of breath at 7.27, the grip at 11.82, the pull at 11.49; and the two from behind,
// where the brooch doesn't show, by his body: kneeling at 10.5, standing at 11.1.
//
// Every drawing is set in the frame by his chest (the brooch, or from behind, between his shoulders)
// on its middle column, its ground on the frame's last row. One drawn facing left is set in mirrored,
// so that the sheet's own flip as he faces left (npc.js) shows it as drawn: the body plays an
// animation's `left` frames whenever he faces left.

import { Img, NONE } from './core.js';

const FRAME = { w: 192, h: 124 };
const MID = FRAME.w / 2;

// Each drawing (assets/morvane/morvane-<name>.json; the standing one is the master, morvane.json): its
// chest's column, its ground row, the row his breathing sinks above (`heave`), and whether it's drawn
// facing left.
const ART = {
  idle: { mid: 47.6, ground: 120, heave: 92 },
  'idle-left': { mid: 21.3, ground: 120, heave: 92, left: true },
  run: { mid: 97.4, ground: 103 },
  'run-left': { mid: 49, ground: 104, left: true },
  pant: { mid: 67.7, ground: 113 },
  'pant-left': { mid: 46.5, ground: 113, left: true },
  grip: { mid: 37.8, ground: 119 },
  pull: { mid: 38.5, ground: 119 },
  pulled: { mid: 37.3, ground: 68 },
  back: { mid: 23, ground: 80, heave: 52 },
};
const EXTRA = Object.keys(ART).filter((k) => k !== 'idle');

// The sword's gold, in his skull and through his ribs, and the spikes in his cheeks: a steady glow of
// its own (the frenzied flame inside him), never flickering.
const GOLD = 'UYbfimpsxz123';

function prepare(art, more = {}) {
  return {
    arts: { idle: art.frames, ...Object.fromEntries(EXTRA.map((k) => [k, more[k]?.frames])) },
    energy: {
      hot: new Set(),
      core: new Set(),
      soft: new Set(),
      dim: [NONE, NONE],
      flare: [NONE, NONE],
      crackle: { main: NONE, core: NONE, sparks: [NONE] },
      arcs: [0, 0, 0],
      sparks: [0, 0, 0],
      faint: art.ids(GOLD),
    },
  };
}

// A drawing in the frame (`p.frame`: which of its frames), its upper body sunk `p.heave` px as he
// breathes; one drawn facing left, mirrored.
function compose(ctx, p) {
  const f = new Img(FRAME.w, FRAME.h);
  const a = ART[p.art];
  const img = ctx.arts[p.art][p.frame || 0];
  const left = !!a.left;
  const ox = Math.round(MID - (left ? img.w - 1 - a.mid : a.mid));
  const oy = FRAME.h - 1 - a.ground;
  const heave = p.heave || 0;
  for (let y = 0; y < img.h; y++) {
    const dy = a.heave != null && y < a.heave ? heave : 0;
    for (let x = 0; x < img.w; x++) {
      const v = img.c[y * img.w + x];
      if (v !== NONE) f.set(ox + (left ? img.w - 1 - x : x), oy + y + dy, v);
    }
  }
  return f;
}

// ---------------------------------------------------------------------------------------------
// the animation set

const poses = [];
const groups = {};
function anim(name, list) {
  groups[name] = list.map((p) => { poses.push(p); return poses.length - 1; });
}
const seq = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));

// standing, he breathes: his chest and head sink a pixel and rise
for (const k of ['idle', 'idle-left']) anim(k, seq(4, (i) => ({ art: k, heave: [0, 0, 1, 1][i] })));
for (const k of ['run', 'run-left']) anim(k, seq(4, (i) => ({ art: k, frame: i })));
for (const k of ['pant', 'pant-left']) anim(k, seq(2, (i) => ({ art: k, frame: i })));
for (const k of ['grip', 'pull', 'pulled']) anim(k, [{ art: k }]);
// headless, his back to us, heaving for breath
anim('back', seq(4, (i) => ({ art: 'back', heave: [1, 0, 1, 2][i] })));

const G = groups;
export default {
  id: 'morvane',
  src: import.meta.url, // (its module: what its baked sheet was made from, bake.js; and where a worker draws it, core.js)
  art: '/assets/morvane/morvane.json',
  extraArt: Object.fromEntries(EXTRA.map((k) => [k, `/assets/morvane/morvane-${k}.json`])),
  firstName: 'Morvane',
  epithet: '',
  title: 'Great Enemy',
  frame: FRAME,
  cols: 6,
  px: 2.31 / 91, // world units per art pixel: 2.31 from his soles to the top of his skull, 0.95 of Maren (to her helm's top)
  head: 110,
  hits: {},
  glowIntensity: 1,
  glowColors: [[255, 180, 60], [255, 230, 160], [235, 150, 40]],
  seed: 5150,
  prepare,
  compose,
  poses,
  groups,
  anims: {
    idle: { frames: G.idle, left: G['idle-left'], fps: 2.5 },
    run: { frames: G.run, left: G['run-left'], fps: 10 },
    pant: { frames: G.pant, left: G['pant-left'], fps: 1.6 },
    stagger: { frames: G.pant, left: G['pant-left'], fps: 3 }, // (dazed by an ultimate: out of breath)
    grip: { frames: G.grip, fps: 1 },
    pull: { frames: G.pull, fps: 1 },
    pulled: { frames: G.pulled, fps: 1 },
    back: { frames: G.back, fps: 3 },
  },
  groupFps: {},
};
