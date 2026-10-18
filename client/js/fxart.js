// Effects drawn by hand for the Tarnished's ultimates and spells, and Fenrath's great attack
// (assets/fx/<name>.json: a sheet
// split with scripts/split-sheet.mjs --grid, extracted with extract-hero.mjs --keep and packed
// with pack-frames.mjs, so its frames stay in register; see README). Each is loaded once, its
// frames as pixel textures. An effect whose art is missing draws itself as before (spellfx.js).

import { texture } from './bossfx.js';

const ART = {
  'maren-bolt': '/assets/fx/maren-bolt.json',
  'maren-great-bolt': '/assets/fx/maren-great-bolt.json',
  'fortuna-shard': '/assets/fx/fortuna-shard.json',
  'fortuna-spikes': '/assets/fx/fortuna-spikes.json',
  'fortuna-icicle': '/assets/fx/fortuna-icicle.json',
  'fortuna-shatter': '/assets/fx/fortuna-shatter.json',
  'vael-pool': '/assets/fx/vael-pool.json',
  'vael-orb': '/assets/fx/vael-orb.json',
  'vael-spikes': '/assets/fx/vael-spikes.json',
  'vael-lash': '/assets/fx/vael-lash.json',
  'jorvik-tome': '/assets/fx/jorvik-tome.json',
  'jorvik-runes': '/assets/fx/jorvik-runes.json',
  'jorvik-pillar': '/assets/fx/jorvik-pillar.json',
  'jorvik-circle': '/assets/fx/jorvik-circle.json',
  'corisande-pebble': '/assets/fx/corisande-pebble.json',
  'corisande-shards': '/assets/fx/corisande-shards.json',
  'corisande-great-shard': '/assets/fx/corisande-great-shard.json',
  'corisande-arrow': '/assets/fx/corisande-arrow.json',
  'solenne-wall': '/assets/fx/solenne-wall.json',
  'solenne-lance': '/assets/fx/solenne-lance.json',
  'solenne-halo': '/assets/fx/solenne-halo.json',
  'solenne-light': '/assets/fx/solenne-light.json',
  'aurelion-wave': '/assets/fx/aurelion-wave.json',
  'ulric-spear': '/assets/fx/ulric-spear.json',
  // Fenrath's great attack (fight.js, wrath): the ghost of his sword, the ring's eruption
  'fenrath-sword': '/assets/fx/fenrath-sword.json',
  'fenrath-eruption': '/assets/fx/fenrath-eruption.json',
};

const sheets = new Map();

// { frames: [texture…], w, h, foot: [x, y] }, in art pixels; `foot` is where it meets the ground,
// the middle of its lowest rows (a bolt's strike), at its bottom edge.
function sheetOf(json) {
  const rgb = json.palette.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const { w, h } = json.frames[0];
  let sum = 0;
  let count = 0;
  const frames = json.frames.map((f) => {
    const c = document.createElement('canvas');
    c.width = f.w;
    c.height = f.h;
    const g = c.getContext('2d');
    const img = g.createImageData(f.w, f.h);
    f.rows.forEach((row, y) => {
      for (let x = 0; x < f.w; x++) {
        if (row[x] === '.') continue;
        img.data.set([...rgb[json.alphabet.indexOf(row[x])], 255], (y * f.w + x) * 4);
        if (y >= f.h - 6) { sum += x; count += 1; }
      }
    });
    g.putImageData(img, 0, 0);
    return texture(c);
  });
  return { frames, w, h, foot: [count ? sum / count + 0.5 : w / 2, h] };
}

export async function loadFxArt() {
  await Promise.all(Object.entries(ART).map(async ([key, url]) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      sheets.set(key, sheetOf(await res.json()));
    } catch (err) {
      console.warn(`Effect art ${key} unavailable`, err);
    }
  }));
}

export const fxArt = (key) => sheets.get(key) || null;

// A drawn effect as the look of something flying, `px` world units to its pixel: one of its frames
// (`pick`: the k-th of a sheet of designs, Jorvik's runes; { map, w, h }), or its frames to flip
// through at `fps` (`order`: the frames' order, a flap there and back; { frames, fps, w, h }); or
// `fallback` without its art.
export function lookOf(key, px, fallback, { fps = 0, pick = 0, order = null } = {}) {
  const s = sheets.get(key);
  if (!s) return fallback;
  const size = { w: s.w * px, h: s.h * px };
  if (fps) return { frames: order ? order.map((k) => s.frames[k]) : s.frames, fps, ...size };
  return { map: s.frames[pick % s.frames.length], ...size };
}
