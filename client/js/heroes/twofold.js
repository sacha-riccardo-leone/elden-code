// The Twofold: one hero with two forms, turning with the day and night of daylight.js. By night the
// Red Hammer walks the Lands Between (champion.js), by day the Eternal Queen (queen.js); each has
// its own name. Halfway through dusk and dawn one becomes the other (director.js, updateForms):
// golden light gathers, the drawing of the change itself (half one, half the other) holds for a
// moment, then the new form bursts out under its own name.
//
// These are the two drawings of the change, brought to life as stills: they breathe, and every
// gold in them shimmers and flares.
// Source art: assets/hero/champion-to-queen.json (83x156, from champion-to-queen.webp) and
// queen-to-champion.json (78x148, from queen-to-champion.webp).

import { prepareStill, composeStill } from './core.js';

const GOLD = 'zxtqkmf';
const ANIMS = ['idle', 'walk', 'hammer', 'read', 'cast', 'send', 'kneel', 'sit', 'doze', 'bow', 'wave', 'point', 'cheer', 'pray', 'collapse', 'lifted', 'talk', 'stagger', 'kneelBow'];

function shiftRig({ id, form, art, frame, spec, seed }) {
  const poses = [0, 1, 1, 0].map((bob, i) => ({ bob, light: [1, 2, 2, 2][i] }));
  const groups = { shift: [0, 1, 2, 3] };
  return {
    id,
    src: import.meta.url, // (its module: what its baked sheet was made from, bake.js)
    pair: 'twofold',
    form,
    shift: true, // worn only while changing; the name stays the one it is changing from
    art,
    burst: ['#ffd75a', '#fffdf0'],
    frame,
    cols: 4,
    px: 2.7 / spec.ground, // about the height of both forms
    head: spec.ground,
    hits: {},
    glowIntensity: 1.6,
    glowColors: [[230, 160, 40], [255, 245, 200]],
    seed,
    prepare(a) {
      const white = a.addColor('#fffdf0');
      const gold = a.addColor('#ffd75a');
      return {
        still: prepareStill(a, spec),
        energy: {
          hot: new Set([...a.ids(GOLD), gold]),
          core: new Set([white]),
          soft: a.ids('zx'),
          dim: [a.code('k'), a.code('m')],
          flare: [gold, white],
          crackle: { main: a.code('t'), core: white, sparks: [a.code('t'), a.code('z'), gold] },
          odds: [[0.1, 0.35, 0.9], [0.05, 0.2, 0.75], [0.02, 0.08, 0.45]],
          bigOff: 'lit',
          keepAbove: 8,
          arcs: [1, 2, 4],
          sparks: [2, 5, 10],
          sparkReach: 12,
          sparkRise: 4,
        },
      };
    },
    compose: (ctx, p) => composeStill(ctx.still, p, frame),
    poses,
    groups,
    anims: Object.fromEntries(ANIMS.map((k) => [k, { frames: groups.shift, fps: 4 }])),
    groupFps: { shift: 4 },
  };
}

// at dawn: the Red Hammer becoming the Eternal Queen
export const dawn = shiftRig({
  id: 'twofold-dawn',
  form: 'dawn',
  art: '/assets/hero/champion-to-queen.json',
  frame: { w: 104, h: 160 },
  spec: { ground: 154, mid: 49, neck: 40, waist: 80 },
  seed: 9091,
});

// at dusk: the Eternal Queen becoming the Red Hammer
export const dusk = shiftRig({
  id: 'twofold-dusk',
  form: 'dusk',
  art: '/assets/hero/queen-to-champion.json',
  frame: { w: 100, h: 152 },
  spec: { ground: 146, mid: 42, neck: 38, waist: 76 },
  seed: 9137,
});
