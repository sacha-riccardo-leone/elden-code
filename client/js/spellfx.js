// The Tarnished's sorcery and ultimates in a fight with a great enemy (combat.js, ults.js), drawn
// as pixel art in each one's own light, as the great enemies' own magic is (bossfx.js):
//   Missile – anything flying: a bolt, a shard, a rune, a halo, a tome, a spear, a crystal arrow;
//             homing on its mark or flying straight on, turned the way it flies, motes trailing
//   Beam    – a lance of light (or a lash of blood) from the caster to its mark, there at once
//   Rise    – something out of the floor under the mark (a pillar of light, spikes of blood or
//             ice), the floor marked a moment first
//   Bolt    – lightning out of the sky
//   Burst   – a flash, a ring on the floor and sparks, where something strikes home
//   Wall    – a tall curved wall of light, flying on
//   Pool    – a pool of blood on the floor
//   Slash   – a crescent of light flying at its mark; Cut, a cut left hanging in the air
//   Drop    – an icicle falling out of the sky onto its mark
//   Aura    – a shining outline round whoever looses an ultimate, a glow behind them
// Each is { step(dt) → still going?, dispose() }, kept in fight.fx. What shines lights the world
// round it too (lights.js), in its school's light (SHINE): what flies, for as long as it flies; a
// burst, a bolt, a beam, a pillar, for a moment as they strike.

import * as THREE from 'three';
import { rng } from './pixel.js';
import { canvasOf, texture } from './bossfx.js';
import { rippling } from './ripple.js';
import { fxArt } from './fxart.js';
import { flash, carry } from './lights.js';

// Each school's light, white-hot to dark: [core, hot, mid, deep, dark].
export const LIGHT = {
  rune: [[255, 250, 224], [255, 222, 120], [244, 172, 52], [176, 104, 24], [96, 52, 10]],
  glintstone: [[244, 252, 255], [185, 232, 255], [111, 195, 255], [47, 108, 240], [22, 44, 128]],
  blood: [[255, 214, 214], [255, 96, 104], [214, 24, 44], [140, 8, 24], [70, 4, 12]],
  holy: [[255, 253, 240], [255, 236, 160], [255, 215, 90], [240, 160, 32], [150, 90, 20]],
  frost: [[248, 255, 255], [200, 244, 255], [143, 224, 255], [70, 150, 220], [30, 70, 130]],
  storm: [[255, 240, 240], [255, 120, 110], [242, 40, 34], [176, 12, 16], [96, 6, 10]],
  poison: [[236, 255, 200], [180, 240, 90], [120, 200, 50], [60, 130, 30], [30, 70, 16]],
  steel: [[255, 255, 255], [224, 240, 255], [180, 210, 240], [120, 150, 190], [60, 80, 110]],
};
const hex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
// a school's light as particle colours, hottest first
export const motesOf = (school) => LIGHT[school].slice(0, 4).map(hex);

// Each school's light as it falls on the world round it (lights.js), and how much of it there is
// (blood and poison barely shine); `shine(school, power, reach, more)`: a look for flash or carry.
const SHINE = {
  rune: ['#ffc862', 1], glintstone: ['#78c0ff', 1], blood: ['#ff3a44', 0.45], holy: ['#ffd870', 1],
  frost: ['#94e2ff', 0.9], storm: ['#ff4a3a', 1], poison: ['#a8e060', 0.4], steel: ['#e6efff', 0.9],
};
export const shine = (school, power, reach, more = {}) => {
  const [color, k] = SHINE[school] || SHINE.steel;
  return { color, power: power * k, reach, ...more };
};

// Light: drawn over what's behind it, a little past white so the bloom catches it (untinted, unlike
// the great enemy's red light, bossfx.js).
const lit = (map, opacity = 1) => new THREE.MeshBasicMaterial({
  map, transparent: true, depthWrite: false, opacity, toneMapped: false, color: new THREE.Color(1.22, 1.22, 1.22),
});

// heat 0..1 → a colour of the school's light
const heat = (pal, k) => (k > 0.86 ? pal[0] : k > 0.62 ? pal[1] : k > 0.38 ? pal[2] : k > 0.16 ? pal[3] : pal[4]);

// ---------------------------------------------------------------------------------------------
// drawings (each made once and kept, but for those drawn anew each time for variety)

const made = new Map();
const once = (key, draw) => {
  if (!made.has(key)) made.set(key, draw());
  return made.get(key);
};

// A ball of light: a white heart, ragged at the edge.
function orbCanvas(pal, r, seed) {
  const g = rng(seed);
  const s = r * 2 + 4;
  return canvasOf(s, s, (put) => {
    const c = s / 2 - 0.5;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const d = Math.hypot(x - c, y - c) + (g() - 0.5) * 1.6;
        if (d > r) continue;
        put(x, y, heat(pal, 1 - d / r));
      }
    }
  });
}

// A crystal shard pointing right (+x): two facets, lit above, darker below, outlined.
function shardCanvas(pal, len, half, seed = 1) {
  const g = rng(seed);
  const h = half * 2 + 3;
  return canvasOf(len + 2, h, (put) => {
    const cy = (h - 1) / 2;
    const widest = Math.round(len * 0.32);
    for (let x = 0; x <= len; x++) {
      const w = x < widest ? (x / widest) * half : ((len - x) / (len - widest)) * half;
      const top = Math.round(cy - w);
      const bot = Math.round(cy + w);
      for (let y = top; y <= bot; y++) {
        const edge = y === top || y === bot;
        const upper = y < cy;
        put(x + 1, y, edge ? pal[3] : upper ? (g() < 0.85 ? pal[1] : pal[0]) : pal[2]);
      }
      if (x > widest && x < len - 1) put(x + 1, Math.round(cy - 0.5), pal[0]); // the bright ridge
    }
  });
}

// The crystal arrow: a long glintstone shaft, a broad head, crystal barbs at the back.
function arrowCanvas(pal) {
  const L = 52;
  const H = 17;
  return canvasOf(L, H, (put) => {
    const cy = 8;
    // the shaft
    for (let x = 6; x < 36; x++) {
      put(x, cy - 1, pal[1]);
      put(x, cy, pal[0]);
      put(x, cy + 1, pal[2]);
      put(x, cy - 2, pal[3]);
      put(x, cy + 2, pal[3]);
    }
    // the head: a broad diamond
    for (let x = 32; x < L; x++) {
      const w = x < 40 ? ((x - 32) / 8) * 7 : ((L - 1 - x) / (L - 1 - 40)) * 7;
      for (let y = Math.round(cy - w); y <= Math.round(cy + w); y++) {
        const edge = y === Math.round(cy - w) || y === Math.round(cy + w);
        put(x, y, edge ? pal[3] : y < cy ? pal[1] : y === cy ? pal[0] : pal[2]);
      }
    }
    // the barbs at the back
    for (let k = 0; k < 7; k++) {
      put(6 - k, cy - 1 - k, pal[2]);
      put(7 - k, cy - 1 - k, pal[1]);
      put(6 - k, cy + 1 + k, pal[3]);
      put(7 - k, cy + 1 + k, pal[2]);
    }
  });
}

// Golden runes, 5x7, drawn twice the size, with a rim of fainter light.
const GLYPHS = [
  ['#.#.#', '.###.', '..#..', '#####', '..#..', '.#.#.', '#...#'],
  ['..#..', '.#.#.', '#...#', '#####', '#...#', '.#.#.', '..#..'],
  ['###..', '#..#.', '###..', '#..#.', '#...#', '#..#.', '###..'],
  ['#...#', '##.##', '#.#.#', '..#..', '#.#.#', '##.##', '#...#'],
];
function glyphCanvas(pal, k) {
  const gl = GLYPHS[k % GLYPHS.length];
  return canvasOf(16, 20, (put) => {
    const on = (x, y) => gl[y]?.[x] === '#';
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 5; x++) {
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => on(x + a, y + b));
        const c = on(x, y) ? ((x + y) % 3 ? pal[1] : pal[0]) : near ? pal[3] : null;
        if (!c) continue;
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) put(2 + x * 2 + a, 3 + y * 2 + b, c);
      }
    }
  });
}

// A halo: a flattened ring of light, sparkling.
function haloCanvas(pal) {
  return canvasOf(30, 14, (put) => {
    for (let a = 0; a < 200; a++) {
      const t = (a / 200) * Math.PI * 2;
      for (let w = 0; w < 2; w++) {
        const x = 14.5 + Math.cos(t) * (12.5 - w);
        const y = 6.5 + Math.sin(t) * (5 - w * 0.6);
        put(x, y, w ? pal[2] : Math.sin(t * 5) > 0.6 ? pal[0] : pal[1]);
      }
    }
  });
}

// A circle on the floor, seen from above: a ring of light with runes (or marks) round it.
function circleCanvas(pal, marks, seed) {
  const g = rng(seed);
  return canvasOf(72, 72, (put) => {
    const c = 35.5;
    for (let y = 0; y < 72; y++) {
      for (let x = 0; x < 72; x++) {
        const d = Math.hypot(x - c, y - c);
        if (d > 33 && d < 35.5) put(x, y, pal[1]);
        else if (d > 30 && d <= 33) put(x, y, pal[3], 150);
        else if (d < 30) put(x, y, pal[3], Math.round(30 + 40 * (d / 30)));
      }
    }
    for (let k = 0; k < marks; k++) {
      const a = (k / marks) * Math.PI * 2 + g() * 0.2;
      const gl = GLYPHS[k % GLYPHS.length];
      const ox = c + Math.cos(a) * 25 - 2;
      const oy = c + Math.sin(a) * 25 - 3;
      gl.forEach((row, y) => { for (let x = 0; x < 5; x++) if (row[x] === '#') put(ox + x, oy + y, pal[0]); });
    }
  });
}

// A pillar of light, brightest down its middle, ragged at its edges, fading upward.
function pillarCanvas(pal, seed) {
  const g = rng(seed);
  return canvasOf(18, 80, (put) => {
    for (let y = 0; y < 80; y++) {
      const half = 7 + Math.sin(y * 0.5 + seed) * 1.2;
      const fade = Math.min(1, y / 30);
      for (let x = 0; x < 18; x++) {
        const d = Math.abs(x - 8.5) / half;
        if (d > 1 || g() > 0.35 + fade) continue;
        put(x, y, heat(pal, (1 - d) * (0.6 + 0.4 * fade)), Math.round(255 * (0.4 + 0.6 * fade)));
      }
    }
  });
}

// Spikes thrust up out of the floor, seen from the side.
function spikesCanvas(pal, seed) {
  const g = rng(seed);
  return canvasOf(48, 40, (put) => {
    const n = 6;
    for (let k = 0; k < n; k++) {
      const bx = 4 + (k / (n - 1)) * 40 + (g() - 0.5) * 4;
      const tall = 18 + g() * 20 * (1 - Math.abs(k - (n - 1) / 2) / n);
      const lean = (g() - 0.5) * 6;
      const w = 2.5 + g() * 2;
      for (let y = 0; y < tall; y++) {
        const t = y / tall;
        const half = w * (1 - t);
        const cx = bx + lean * t;
        for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
          put(x, 39 - y, x < cx ? pal[1] : x === Math.round(cx) ? pal[0] : pal[2]);
        }
      }
      put(bx + lean, 39 - tall, pal[0]);
    }
  });
}

// A lance of light (or of blood): wavering edges round a white core, made to tile along its length.
function beamCanvas(pal, seed) {
  const ph = rng(seed)() * 6;
  return canvasOf(64, 11, (put) => {
    for (let x = 0; x < 64; x++) {
      const half = 3.6 + Math.sin((x / 64) * Math.PI * 4 + ph) * 1.2;
      for (let y = 0; y < 11; y++) {
        const d = Math.abs(y - 5) / half;
        if (d > 1) continue;
        put(x, y, heat(pal, 1 - d * 0.9));
      }
    }
  });
}

// Lightning: a jagged fall from the top to the bottom, forking now and then.
function boltCanvas(pal, seed, wide) {
  const g = rng(seed);
  const W = wide ? 40 : 28;
  return canvasOf(W, 120, (put) => {
    const walk = (x, y, len, w) => {
      for (let i = 0; i < len && y < 120; i++) {
        x += (g() - 0.5) * 3.2;
        y += 1;
        for (let k = -w; k <= w; k++) put(x + k, y, Math.abs(k) < w * 0.5 ? pal[0] : pal[1]);
        put(x - w - 1, y, pal[2]);
        put(x + w + 1, y, pal[2]);
        if (w >= 1 && g() < 0.025) walk(x, y, 10 + g() * 20, Math.max(0, w - 1));
      }
    };
    walk(W / 2, 0, 120, wide ? 3 : 1);
  });
}

// The wall of light: a tall crescent, thickest at its middle, streaked.
function wallCanvas(pal, seed) {
  const g = rng(seed);
  return canvasOf(56, 100, (put) => {
    const cy = 49.5;
    const R = 90;
    const cx = -36;
    for (let y = 0; y < 100; y++) {
      const t = (y - cy) / 48;
      if (Math.abs(t) > 1) continue;
      const outer = cx + Math.sqrt(R * R - (y - cy) ** 2);
      const thick = 21 * (1 - t * t) + 3;
      for (let x = Math.floor(outer - thick); x <= outer; x++) {
        const k = (x - (outer - thick)) / thick;
        put(x, y, heat(pal, 0.2 + k * 0.8 * (1 - Math.abs(t) * 0.3)), Math.round(255 * (0.55 + 0.45 * k)));
      }
      if (g() < 0.25) put(outer + 1 + g() * 3, y, pal[2]);
    }
  });
}

// A crescent of light (a slash flying on), as the great enemy's own but in the striker's light.
function slashCanvas(pal, seed) {
  const g = rng(seed);
  return canvasOf(40, 72, (put, w, h) => {
    const cx = -18;
    const cy = h / 2;
    const R = 50;
    for (let y = 0; y < h; y++) {
      const t = (y - cy) / (h / 2 - 2);
      if (Math.abs(t) > 1) continue;
      const thick = 9 * (1 - t * t) + 1.5 + Math.sin(y * 1.7 + g() * 0.5) * 1.2;
      const outer = cx + Math.sqrt(Math.max(0, R * R - (y - cy) ** 2));
      for (let x = Math.floor(outer - thick); x <= outer; x++) {
        const k = (x - (outer - thick)) / thick;
        put(x, y, heat(pal, 0.15 + k * 0.85 * (1 - Math.abs(t) * 0.4)));
      }
      if (g() < 0.3) put(outer + 1 + g() * 3, y, pal[3]);
    }
  });
}

// A tome in flight, seen from the side: golden covers about white pages; frame 0 covers up,
// 1 open flat, 2 covers down (it beats them like wings).
function tomeCanvas(frame) {
  const gold = LIGHT.rune;
  return canvasOf(26, 20, (put) => {
    const cx = 13;
    const cy = 10;
    const lift = [-6, 0, 5][frame];
    for (const s of [-1, 1]) {
      // a cover: from the spine out to the side, tipped up or down
      for (let i = 0; i <= 11; i++) {
        const x = cx + s * i;
        const y = Math.round(cy + (lift * i) / 11);
        put(x, y, i > 9 ? gold[3] : gold[2]);
        put(x, y + 1, gold[3]);
        // the pages, just inside the cover
        if (i > 1 && i < 10) { put(x, y - 1, [250, 244, 226]); put(x, y - 2, i % 3 ? [228, 220, 196] : [250, 244, 226]); }
      }
    }
    for (let y = cy - 3; y <= cy + 2; y++) put(cx, y, gold[1]); // the spine
    put(cx, cy - 4, gold[0]);
  });
}

// A spear, flying (or stuck) point first, to the right.
function spearCanvas() {
  return canvasOf(70, 9, (put) => {
    const wood = [[132, 92, 52], [96, 64, 36], [60, 40, 24]];
    for (let x = 0; x < 54; x++) { put(x, 4, wood[0]); put(x, 3, wood[1]); put(x, 5, wood[2]); }
    for (let y = 2; y <= 6; y++) put(50, y, [70, 70, 76]); // the binding
    // the leaf-shaped iron head
    for (let x = 54; x < 70; x++) {
      const w = x < 60 ? (x - 54) / 6 * 3.2 : (69 - x) / 9 * 3.2;
      for (let y = Math.round(4 - w); y <= Math.round(4 + w); y++) put(x, y, y < 4 ? [214, 222, 230] : y === 4 ? [250, 252, 255] : [150, 158, 168]);
    }
  });
}

// A burst of light: rays from a bright heart.
function burstCanvas(pal, seed) {
  const g = rng(seed);
  return canvasOf(48, 48, (put) => {
    const c = 23.5;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + g() * 0.3;
      const len = 10 + g() * 13;
      for (let r = 0; r < len; r++) put(c + Math.cos(a) * r, c + Math.sin(a) * r, heat(pal, 1 - r / len));
    }
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 25) put(c + x, c + y, x * x + y * y < 9 ? pal[0] : pal[1]);
  });
}

// Where a blow strikes home: sharp lines flung out the way it went (toward +x, a few back), white
// at the heart and the striker's own light (`rgb`) at the tips: 0 the flash, 1 the lines flying
// apart, 2 their tips dying. The heart sits at (8, 12).
const SPARK_RAYS = [[-0.95, 9], [-0.5, 12], [-0.15, 15], [0.2, 13], [0.55, 10], [0.95, 7], [2.5, 5], [-2.6, 4]];
function sparkCanvas(rgb, frame) {
  const white = [255, 255, 255];
  const pale = rgb.map((v) => Math.round(v + (255 - v) * 0.55));
  return canvasOf(32, 24, (put) => {
    const [cx, cy] = [8, 12];
    for (const [a, len] of SPARK_RAYS) {
      const L = frame === 0 ? len * 0.6 : len;
      const r0 = frame === 0 ? 0 : frame === 1 ? L * 0.35 : L * 0.8;
      for (let r = r0; r <= L; r += 0.5) {
        const k = r / L;
        put(cx + Math.cos(a) * r, cy + Math.sin(a) * r, frame === 2 ? rgb : k < 0.45 ? white : k < 0.75 ? pale : rgb);
      }
    }
    if (frame === 0) for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) put(cx + x, cy + y, white);
  });
}

// A ring of light on the floor, seen from above.
function ringCanvas(pal) {
  return canvasOf(64, 64, (put) => {
    const c = 31.5;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const d = Math.hypot(x - c, y - c);
        if (d > 29 && d < 31.5) put(x, y, pal[1]);
        else if (d > 26 && d <= 29) put(x, y, pal[2], 160);
      }
    }
  });
}

// A pool of blood, seen from above: dark, ragged, glinting, bubbling.
function poolCanvas(seed) {
  const g = rng(seed);
  const pal = LIGHT.blood;
  return canvasOf(80, 80, (put) => {
    const c = 39.5;
    const lobes = [g() * 6, g() * 6, g() * 6];
    for (let y = 0; y < 80; y++) {
      for (let x = 0; x < 80; x++) {
        const a = Math.atan2(y - c, x - c);
        const edge = 34 + Math.sin(a * 3 + lobes[0]) * 2.4 + Math.sin(a * 5 + lobes[1]) * 1.6 + Math.sin(a * 9 + lobes[2]) * 0.8;
        const d = Math.hypot(x - c, y - c);
        if (d > edge) continue;
        const rim = d > edge - 2.5;
        const shine = g() < 0.012;
        put(x, y, shine ? pal[1] : rim ? pal[3] : d < edge * 0.55 ? pal[4] : g() < 0.5 ? pal[3] : pal[4], rim ? 255 : 235);
      }
    }
    for (let k = 0; k < 9; k++) { // bubbles
      const bx = c + (g() - 0.5) * 44;
      const by = c + (g() - 0.5) * 44;
      put(bx, by, pal[2]); put(bx + 1, by, pal[1]); put(bx, by - 1, pal[2]);
    }
  });
}

// A soft glow (not pixel art: a light behind someone), tinted by its material.
function glowCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

const TEX = {
  orb: (school, r = 6) => once(`orb:${school}:${r}`, () => texture(orbCanvas(LIGHT[school], r, 3))),
  shard: (school, len = 18, half = 3) => once(`shard:${school}:${len}:${half}`, () => texture(shardCanvas(LIGHT[school], len, half))),
  arrow: () => once('arrow', () => texture(arrowCanvas(LIGHT.glintstone))),
  glyph: (k) => once(`glyph:${k % GLYPHS.length}`, () => texture(glyphCanvas(LIGHT.rune, k))),
  halo: () => once('halo', () => texture(haloCanvas(LIGHT.holy))),
  circle: (school, marks) => once(`circle:${school}:${marks}`, () => texture(circleCanvas(LIGHT[school], marks, 5))),
  pillar: (school) => once(`pillar:${school}`, () => texture(pillarCanvas(LIGHT[school], 4))),
  spikes: (school, k = 0) => once(`spikes:${school}:${k % 3}`, () => texture(spikesCanvas(LIGHT[school], 11 + (k % 3) * 7))),
  beam: (school) => once(`beam:${school}`, () => {
    const t = texture(beamCanvas(LIGHT[school], 9));
    t.wrapS = THREE.RepeatWrapping;
    return t;
  }),
  bolt: (school, k, wide = false) => once(`bolt:${school}:${k % 5}:${wide}`, () => texture(boltCanvas(LIGHT[school], 31 + (k % 5) * 13, wide))),
  wall: () => once('wall', () => texture(wallCanvas(LIGHT.holy, 8))),
  slash: (school) => once(`slash:${school}`, () => texture(slashCanvas(LIGHT[school], 6))),
  tome: (frame) => once(`tome:${frame}`, () => texture(tomeCanvas(frame))),
  spear: () => once('spear', () => texture(spearCanvas())),
  burst: (school) => once(`burst:${school}`, () => texture(burstCanvas(LIGHT[school], 2))),
  spark: (color, frame) => once(`spark:${color}:${frame}`, () => texture(sparkCanvas([1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)), frame))),
  ring: (school) => once(`ring:${school}`, () => texture(ringCanvas(LIGHT[school]))),
  pool: () => once('pool', () => texture(poolCanvas(17))),
  glow: () => once('glow', () => new THREE.CanvasTexture(glowCanvas())),
};
export { TEX };

// ---------------------------------------------------------------------------------------------
// the effects

// A flat drawing standing in the world (facing the camera, as everything here does).
function plane(scene, map, w, h, { opacity = 1, order = 6, additive = false } = {}) {
  const mat = lit(map, opacity);
  if (additive) mat.blending = THREE.AdditiveBlending;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.renderOrder = order;
  scene.add(mesh);
  return mesh;
}
function drop(scene, mesh) {
  scene.remove(mesh);
  mesh.material.dispose();
  mesh.geometry.dispose();
}
// A mark on the floor, `size` across (or [across, deep]), bending with it where it ripples.
function floor(scene, map, x, z, size, opacity = 1) {
  const mat = rippling(lit(map, opacity));
  const [w, d] = Array.isArray(size) ? size : [size, size];
  const seg = Math.max(1, Math.min(32, Math.ceil(Math.max(w, d) / 0.5)));
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d, seg, seg), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.04, z);
  mesh.renderOrder = 3;
  scene.add(mesh);
  return mesh;
}

// The angle on screen of a movement (dx, dy, dz) in the world, seen from the camera's usual
// height (z coming toward it reads as downward).
const screenAngle = (dx, dy, dz) => Math.atan2(dy * 0.9 - dz * 0.42, dx);

// The camera the world is seen through (main.js, setView): what flies is turned by where it shows
// in the picture, whichever way it goes, into the view or out of it as well as across.
let view = null;
export function setView(camera) { view = camera; }

const P0 = new THREE.Vector3();
const P1 = new THREE.Vector3();
const BX = new THREE.Vector3();
const BY = new THREE.Vector3();
const BZ = new THREE.Vector3();
const BM = new THREE.Matrix4();
const DIR = new THREE.Vector3(); // (a way something goes, for screenAngleAt)
const GUIDE = new THREE.Vector3(); // (the way back onto a line: Missile)
const GUIDE_PULL = 2.5; // (how hard: a share of the way off it, a second)

// The angle on the screen (counterclockwise from the right) of a movement `d` made at `at` (in
// `parent`'s space: the yard's effects are set on its lowered floor): where its two ends land in
// the picture, perspective and all. Without the camera, as seen from its usual height.
function screenAngleAt(parent, at, d) {
  const len = d.length();
  if (!view || len < 1e-6) return screenAngle(d.x, d.y, d.z);
  P0.copy(at);
  P1.copy(at).addScaledVector(d, 0.05 / len);
  if (parent) { parent.localToWorld(P0); parent.localToWorld(P1); }
  P0.project(view);
  P1.project(view);
  return Math.atan2(P1.y - P0.y, (P1.x - P0.x) * view.aspect);
}

// How far to turn a flat drawing (it faces the way the camera looks from, not tilted up to it) so
// that it shows at `angle` on the screen: looking down on it, the camera shortens its height.
function planeTurn(angle) {
  const e = view?.matrixWorld.elements;
  const squeeze = e ? Math.max(0.2, Math.hypot(e[8], e[10])) : 0.9;
  return Math.atan2(Math.sin(angle) / squeeze, Math.cos(angle));
}

// Turns `mesh`, a drawing pointing to the right, to point at `angle` on the screen. With `keep`
// (its state, { way }), it stays upright: mirrored rather than turned upside down as it goes
// leftward, and only changing over once it's turned well past straight up or down (so that one
// flying straight into the view or out of it doesn't flicker between the two).
function pointAt(mesh, angle, keep = null) {
  if (!keep) {
    mesh.rotation.z = planeTurn(angle);
    return;
  }
  const c = Math.cos(angle);
  if (!keep.way) keep.way = c < 0 ? -1 : 1;
  else if (keep.way * c < -0.17) keep.way = -keep.way;
  mesh.scale.x = keep.way * Math.abs(mesh.scale.x);
  mesh.rotation.z = keep.way > 0 ? planeTurn(angle) : planeTurn(angle) - Math.PI;
}

// Lays `mesh` (a flat drawing, its length along x) along the line from `from` to `to`, turned to
// face the camera as far as it may, so that it ends where it should whichever way it runs.
function lieAlong(mesh, from, to) {
  BX.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
  if (!view) {
    mesh.rotation.z = screenAngle(BX.x, BX.y, BX.z);
    return;
  }
  P0.copy(mesh.position);
  if (mesh.parent) mesh.parent.localToWorld(P0);
  BZ.setFromMatrixPosition(view.matrixWorld).sub(P0).normalize(); // (toward the camera)
  BY.crossVectors(BZ, BX);
  if (BY.lengthSq() < 1e-6) return; // (straight at the camera: seen end on)
  BY.normalize();
  BZ.crossVectors(BX, BY);
  mesh.quaternion.setFromRotationMatrix(BM.makeBasis(BX, BY, BZ));
  mesh.position.addScaledVector(BZ, 0.05); // (a hair toward the camera, before what it strikes)
}

// Something flying. `to()`: where it's going, followed as it moves (homing), or `dir` [dx, dz]
// to fly straight on that way. Reaching its mark (within `near`), it calls onHit and is done; it
// gives up after `life` seconds. `trail`: particle colours left behind it; `spin`: it turns as it
// flies rather than pointing the way it goes (which, otherwise, it does as it shows on the screen,
// into the view or out of it as well as across); `upright`: it keeps upright as it points, mirrored
// rather than upside down going leftward (an arrow's light on top, a tome's covers);
// `frames`: textures it flips through; `light`: the light it carries (shine), lighting what it
// passes. Aimed (thine: combat.js, aimSpell), it keeps to its line (`guide`: { from, dir }), coming
// back onto it if it set off aside, and strikes whatever it comes up to on the way (`strike(x, z)`:
// what it has met there, if anything, handed on to onHit). With `land` (how far behind its point its
// middle is), it flies on onto the drawing of what it met, the last of the way, and strikes there,
// pinned to it (pinOn: handed on to onHit too), rather than in the air beside it.
export class Missile {
  constructor(fx, { map, w, h, from, to = null, dir = null, speed = 10, turn = 7, near = 0.5, life = 3,
    trail = null, trailRate = 40, trailSize = 0.06, spin = 0, upright = false, frames = null, fps = 10, onHit = null, onEnd = null, delay = 0, rise = 0, wobble = 0, light = null,
    guide = null, strike = null, land = null }) {
    this.fx = fx;
    this.mesh = plane(fx.scene, frames ? frames[0] : map, w, h);
    this.mesh.visible = delay <= 0;
    this.light = light ? carry(fx.scene, from, { ...light, level: delay > 0 ? 0 : 1 }) : null;
    this.pos = new THREE.Vector3(...from);
    const [tx, ty, tz] = to ? to() : [from[0] + (dir?.[0] ?? 1), from[1], from[2] + (dir?.[1] ?? 0)];
    const d = Math.hypot(tx - from[0], ty - from[1], tz - from[2]) || 1;
    // (it may set off upward first, and curve onto its mark)
    this.vel = new THREE.Vector3(((tx - from[0]) / d) * speed, ((ty - from[1]) / d) * speed + rise, ((tz - from[2]) / d) * speed);
    Object.assign(this, { to, dir, speed, turn, near, life, trail, trailRate, trailSize, spin, upright, frames, fps, onHit, onEnd, delay, wobble, guide, strike, land, t: 0, done: false, struck: null, pin: null });
    this.mesh.position.copy(this.pos);
  }

  step(dt) {
    if (this.done) return false;
    if (this.delay > 0) {
      this.delay -= dt;
      if (this.delay > 0) return true;
      this.mesh.visible = true;
      if (this.light) this.light.level = 1;
    }
    this.t += dt;
    if (this.to) {
      // homing: turn the velocity toward the mark, keeping the speed
      const [tx, ty, tz] = this.to();
      const want = new THREE.Vector3(tx - this.pos.x, ty - this.pos.y, tz - this.pos.z);
      const dist = want.length();
      if (dist < this.near + this.speed * dt) {
        this.pos.set(tx, ty, tz);
        this.finish(true);
        return false;
      }
      want.multiplyScalar(this.speed / dist);
      const k = Math.min(1, dt * this.turn * (1 + this.t * 2));
      this.vel.lerp(want, k).setLength(this.speed);
    } else if (this.guide) {
      // along its line, pulled back onto it from aside (and from above or below)
      const g = this.guide;
      const ox = this.pos.x - g.from[0];
      const oz = this.pos.z - g.from[2];
      const t = ox * g.dir[0] + oz * g.dir[1];
      GUIDE.set(g.dir[0] * this.speed - (ox - g.dir[0] * t) * GUIDE_PULL, -(this.pos.y - g.from[1]) * GUIDE_PULL, g.dir[1] * this.speed - (oz - g.dir[1] * t) * GUIDE_PULL);
      this.vel.lerp(GUIDE.setLength(this.speed), Math.min(1, dt * this.turn));
    }
    this.pos.addScaledVector(this.vel, dt);
    const wob = this.wobble ? Math.sin(this.t * 14) * this.wobble : 0;
    this.mesh.position.set(this.pos.x, this.pos.y + wob, this.pos.z);
    this.light?.at(this.pos.x, this.pos.y + wob, this.pos.z + 0.3);
    if (this.spin) this.mesh.rotation.z += this.spin * dt;
    else pointAt(this.mesh, screenAngleAt(this.mesh.parent, this.pos, this.vel), this.upright ? this : null);
    if (this.frames) this.mesh.material.map = this.frames[Math.floor(this.t * this.fps) % this.frames.length];
    if (this.trail && Math.random() < dt * this.trailRate) {
      this.fx.particles.emit({
        pos: [this.pos.x, this.pos.y, this.pos.z], spread: [0.06, 0.06, 0.06], vel: [-this.vel.x * 0.08, 0.2, -this.vel.z * 0.08],
        velSpread: [0.25, 0.25, 0.2], color: this.trail, size: this.trailSize, life: 0.45, count: 2, drag: 2, intensity: 2.4,
      });
    }
    const met = this.strike?.(this.pos.x, this.pos.z);
    if (met) {
      this.struck = met;
      this.strike = null;
      if (this.land != null && this.landOn(met)) return true;
      this.finish(true);
      return false;
    }
    if (this.t >= this.life) { this.finish(false); return false; }
    return true;
  }

  // On course for something (`met`): onto the point of its drawing it's pinned to, the last of the
  // way, homing there as it moves (and only so far off its line as it was forgiven).
  landOn(met) {
    const g = this.guide?.dir;
    const v = Math.hypot(this.vel.x, this.vel.z) || 1;
    const way = g || [this.vel.x / v, this.vel.z / v];
    P0.copy(this.pos);
    this.mesh.parent?.localToWorld(P0);
    const pin = pinOn(met, P0, way);
    if (!pin?.land(this.mesh.parent, this.land)) return false;
    Object.assign(this, { pin, guide: null, turn: 40, near: 0.12, life: this.t + 1 });
    this.to = () => pin.land(this.mesh.parent, this.land) || [this.pos.x, this.pos.y, this.pos.z];
    return true;
  }

  finish(hit) {
    this.done = true;
    this.light?.end(0.12);
    if (hit) this.onHit?.(this.pos.clone(), this.struck, this.pin);
    else this.onEnd?.(this.pos.clone());
  }

  dispose() {
    this.light?.end(0.08);
    drop(this.fx.scene, this.mesh);
  }
}

// Something thrown that strikes, plants itself in the floor past what it struck, shakes there, and
// flies back to the hand that threw it (Ruadan's maul: combat.js, throwMaul), spinning as it flies:
//   - out from `from` along `dir` (a way on the floor) at `speed`, turned `turn` as it leaves (its
//     haft back toward the hand); struck by something (`strike(x, z, way)` → { target, at() }, the way
//     it's going then), on to `past` beyond its far side (its `kind.radius`), else out to `reach`;
//   - coming down over the last `dive` of the way to plant its head `sink` deep in the floor, turned
//     `angle` (its haft leaning back the way it came: `onPlant(x, z)`);
//   - there `stay` seconds, shaking side to side the last `shake` of them (`jolt` either way, twenty
//     times a second, as the Golem shakes gathering his fire);
//   - pulled out and back to the hand (`home()`: [x, y, z] as the thrower moves; null once it can't
//     take it back, and then it's gone at once) over `back` seconds, faster and faster.
// Each way it strikes what it comes up to, each thing once (`onHit(at, struck)`); back in the hand,
// `onHome()`. Drawn flying right (mirrored flying left), it turns `spin` radians a second the way it
// rolls, about `pivot` ([across, down] its drawing: a maul's head). Angles as seen flying right.
const TURN = Math.PI * 2;
export class Boomerang {
  constructor(fx, { map, w, h, from, dir, speed, reach, past, dive, sink, angle, turn = 0, stay, shake, jolt, back, spin, pivot = [0.5, 0.5],
    home, strike = null, onHit = null, onPlant = null, onHome = null, light = null, trail = null, dust = null }) {
    this.fx = fx;
    this.mesh = plane(fx.scene, map, w, h);
    this.mesh.geometry.translate((0.5 - pivot[0]) * w, (pivot[1] - 0.5) * h, 0);
    this.side = Math.sign(dir[0]) || 1;
    this.mesh.scale.x = this.side;
    this.mesh.rotation.z = turn * this.side;
    this.from = new THREE.Vector3(...from);
    this.pos = this.from.clone();
    this.light = light ? carry(fx.scene, from, light) : null;
    Object.assign(this, { dir, speed, past, dive, sink, angle, stay, shake, jolt, back, spin, home, strike, onHit, onPlant, onHome, trail, dust });
    Object.assign(this, { phase: 'out', s: 0, end: reach, diving: null, at: 0, t: 0, done: false, struck: new Set() });
    this.mesh.position.copy(this.pos);
  }

  step(dt) {
    if (this.done) return false;
    const hand = this.home();
    if (!hand) { this.finish(false); return false; } // (he can't take it back: gone at once)
    this.t += dt;
    if (this.phase === 'out') this.fly(dt);
    else if (this.phase === 'planted') this.hold(dt);
    else if (this.fetch(dt, hand)) { this.finish(true); return false; }
    this.light?.at(this.pos.x, this.pos.y, this.pos.z + 0.3);
    if (this.trail && this.phase !== 'planted' && Math.random() < dt * 30) {
      this.fx.particles.emit({
        pos: [this.pos.x, this.pos.y, this.pos.z], spread: [0.15, 0.15, 0.1], vel: [0, 0.3, 0], velSpread: [0.4, 0.3, 0.3],
        color: this.trail, size: 0.06, life: 0.5, count: 2, drag: 1.5, gravity: 2, intensity: 2.2,
      });
    }
    return true;
  }

  // Out along its line, spinning; coming down at the end of it, its turn eased onto the planted one.
  fly(dt) {
    const { dir } = this;
    this.s = Math.min(this.end, this.s + this.speed * dt);
    let y = this.from.y;
    const begins = this.end - this.dive;
    if (this.s > begins) {
      if (!this.diving) this.diving = { from: Math.max(this.s - this.speed * dt, begins), rot: this.mesh.rotation.z, by: this.turnTo(this.mesh.rotation.z) };
      const d = this.diving;
      const u = Math.min(1, (this.s - d.from) / Math.max(0.01, this.end - d.from));
      y = this.sink + (this.from.y - this.sink) * (1 - u * u);
      this.mesh.rotation.z = d.rot + d.by * (1 - (1 - u) * (1 - u));
    } else {
      this.mesh.rotation.z -= this.spin * this.side * dt;
    }
    this.pos.set(this.from.x + dir[0] * this.s, y, this.from.z + dir[1] * this.s);
    this.mesh.position.copy(this.pos);
    const met = this.strike?.(this.pos.x, this.pos.z, dir);
    if (met && !this.struck.has(met.target)) {
      // (the first thing it strikes: on a little past it, then down)
      if (!this.struck.size && !this.diving) {
        const [tx, , tz] = met.at();
        const along = (tx - this.from.x) * dir[0] + (tz - this.from.z) * dir[1];
        this.end = Math.max(this.s + 0.2, along + (met.target.kind?.radius ?? 0.5) + this.past);
      }
      this.struck.add(met.target);
      this.onHit?.(this.pos.clone(), met);
    }
    if (this.s >= this.end) {
      this.phase = 'planted';
      this.at = this.t;
      this.planted = this.pos.clone();
      this.onPlant?.(this.pos.x, this.pos.z);
    }
  }

  // The turn from `rot`, the way it spins, onto its planted one (as seen: mirrored flying left).
  turnTo(rot) {
    const way = -this.side;
    const far = ((((this.angle * this.side - rot) * way) % TURN) + TURN) % TURN; // (how far, that way)
    return way * far;
  }

  // Planted: still, then shaking side to side, dust and embers shaken out of the crack.
  hold() {
    const held = this.t - this.at;
    const p = this.planted;
    const shaking = held > this.stay - this.shake;
    const x = p.x + (shaking ? (Math.floor(held * 20) % 2 ? 1 : -1) * this.jolt : 0);
    this.pos.set(x, p.y, p.z);
    this.mesh.position.copy(this.pos);
    if (shaking && this.dust && Math.random() < 0.6) {
      this.fx.particles.emit({
        pos: [p.x, 0.1, p.z], spread: [0.35, 0.05, 0.2], vel: [0, 0.9, 0], velSpread: [0.8, 0.5, 0.4],
        color: this.dust, size: 0.07, life: 0.45, count: 2, drag: 1.4, gravity: 3, intensity: 1.4,
      });
    }
    if (held >= this.stay) {
      this.phase = 'back';
      this.at = this.t;
      this.struck.clear();
    }
  }

  // Pulled out and back to the hand, faster and faster, spinning back the other way as it picks up.
  fetch(dt, [hx, hy, hz]) {
    const u = Math.min(1, (this.t - this.at) / this.back);
    const k = 1 - Math.cos((Math.PI / 2) * u);
    const p = this.planted;
    this.pos.set(p.x + (hx - p.x) * k, p.y + (hy - p.y) * k, p.z + (hz - p.z) * k);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.z += this.spin * this.side * dt * (0.3 + 0.7 * u);
    const dx = hx - p.x;
    const dz = hz - p.z;
    const d = Math.hypot(dx, dz) || 1;
    const met = this.strike?.(this.pos.x, this.pos.z, [dx / d, dz / d]);
    if (met && !this.struck.has(met.target)) {
      this.struck.add(met.target);
      this.onHit?.(this.pos.clone(), met);
    }
    return u >= 1;
  }

  finish(home) {
    this.done = true;
    this.light?.end(0.12);
    if (home) this.onHome?.();
  }

  dispose() {
    this.light?.end(0.08);
    drop(this.fx.scene, this.mesh);
  }
}

// A lance of light from `from` to `to`, there at once, flickering a moment and fading. Drawn by
// hand (`art`, fxart.js: a lash of blood, Maren's thunderbolt), it's stretched evenly from the one
// to the other, its thick end at `from` (as thick as its drawing is for that length, kept within
// `thick` [least, most] if given), and plays its frames out over its life; or (`tile`: a lance of holy light,
// drawn running on from edge to edge) it's `width` thick and its drawing is repeated along it,
// flickering between its frames (`fps` a second) and flowing on (`flow` world units a second). It
// lights all along it as long as it lasts.
export class Beam {
  constructor(fx, { school, from, to, width = 0.32, life = 0.3, art = null, tile = false, fps = 24, flow = 3, thick = null, onHit = null }) {
    const [x0, y0, z0] = from;
    const [x1, y1, z1] = to;
    const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    const sheet = art && fxArt(art);
    this.tiles = sheet && tile ? sheet.frames.map((t) => {
      const c = t.clone();
      c.wrapS = THREE.RepeatWrapping;
      c.repeat.set(len / ((width * sheet.w) / sheet.h), 1);
      c.needsUpdate = true;
      return c;
    }) : null;
    const map = this.tiles ? this.tiles[0] : sheet ? sheet.frames[0] : TEX.beam(school).clone();
    if (!sheet) {
      map.needsUpdate = true;
      map.repeat.set(Math.max(1, len / 1.4), 1);
    }
    this.frames = sheet && !tile ? sheet.frames : null;
    const drawn = sheet && !tile ? (len * sheet.h) / sheet.w : width;
    this.mesh = plane(fx.scene, map, len, thick && sheet && !tile ? Math.min(thick[1], Math.max(thick[0], drawn)) : drawn, { order: 7 });
    this.mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    lieAlong(this.mesh, from, to);
    flash(fx.scene, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2 + 0.3], shine(school, 80 * width, len / 2 + 5, { life, rise: 0.03 }));
    this.fx = fx;
    this.life = life;
    this.fps = fps;
    this.flow = flow;
    this.t = 0;
    this.map = map;
    onHit?.(new THREE.Vector3(x1, y1, z1));
  }

  step(dt) {
    this.t += dt;
    const k = this.t / this.life;
    if (this.tiles) {
      // (the lance flickering between its frames, flowing on, and fading)
      const map = this.tiles[Math.floor(this.t * this.fps) % this.tiles.length];
      for (const t of this.tiles) t.offset.x = -this.t * this.flow;
      this.mesh.material.map = map;
      this.mesh.material.opacity = Math.max(0, 1 - k * k);
      return this.t < this.life;
    }
    if (this.frames) {
      // (the lash snapping out, its own frames, then fading)
      this.mesh.material.map = this.frames[Math.min(this.frames.length - 1, Math.floor(k * this.frames.length))];
      this.mesh.material.opacity = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
      return this.t < this.life;
    }
    this.mesh.material.opacity = Math.max(0, 1 - k * k);
    this.mesh.scale.y = 1 + 0.25 * Math.sin(this.t * 70);
    this.map.offset.x -= dt * 6;
    return this.t < this.life;
  }

  dispose() {
    if (this.tiles) for (const t of this.tiles) t.dispose();
    else if (!this.frames) this.map.dispose();
    drop(this.fx.scene, this.mesh);
  }
}

// Something rising out of the floor at (x, z): the floor marked first (`warn` seconds), then it
// thrusts up (`map`, w x h), strikes (onHit) and sinks away. Drawn by hand (`art`, fxart.js), it
// plays its own frames instead (breaking through, half, full, cracking apart), `px` world units to
// its pixel, its foot on (x, z); its mark may be drawn too (`markArt`, `markSize` across). As it
// thrusts up it lights round it, the taller the brighter.
export class Rise {
  constructor(fx, { school, x, z, map, w, h, art = null, px = 0.02, mark = null, markArt = null, markSize = 2.4, warn = 0.45, life = 0.7, onHit = null }) {
    this.fx = fx;
    const drawnMark = markArt && fxArt(markArt);
    this.mark = drawnMark
      ? floor(fx.scene, drawnMark.frames[0], x, z, [markSize, (markSize * drawnMark.h) / drawnMark.w], 0)
      : floor(fx.scene, mark || TEX.ring(school), x, z, markSize, 0);
    const sheet = art && fxArt(art);
    if (sheet) {
      [w, h] = [sheet.w * px, sheet.h * px];
      this.frames = sheet.frames;
      this.dx = (sheet.w / 2 - sheet.foot[0]) * px;
    }
    this.mesh = plane(fx.scene, sheet ? sheet.frames[0] : map, w, h);
    this.mesh.visible = false;
    Object.assign(this, { x, z, w, h, warn, life, onHit, school, t: 0, struck: false });
  }

  step(dt) {
    this.t += dt;
    if (this.t < this.warn) {
      this.mark.material.opacity = 0.3 + 0.7 * (this.t / this.warn);
      this.mark.rotation.z += dt * 2;
      return true;
    }
    const k = (this.t - this.warn) / this.life;
    if (!this.struck) {
      this.struck = true;
      this.mesh.visible = true;
      flash(this.fx.scene, [this.x, Math.min(this.h / 2, 2.5), this.z + 0.3], shine(this.school, 12 + 8 * this.h, 6 + 1.5 * this.h, { life: this.life * 0.7, rise: 0.05 }));
      this.onHit?.(new THREE.Vector3(this.x, 1, this.z));
      this.fx.particles.emit({
        pos: [this.x, 0.2, this.z], spread: [0.6, 0.1, 0.4], vel: [0, 2.6, 0], velSpread: [1.4, 1.2, 1],
        color: motesOf(this.school), size: 0.08, life: 0.6, count: 24, drag: 1.4, intensity: 2.6,
      });
    }
    if (this.frames) {
      // through the floor and up in two quick steps, standing a while, then cracking and gone
      const n = this.frames.length;
      const i = k < 0.07 ? 0 : k < 0.14 ? 1 : k < 0.55 ? Math.min(2, n - 1) : n - 1;
      this.mesh.material.map = this.frames[i];
      this.mesh.material.opacity = k < 0.75 ? 1 : Math.max(0, 1 - (k - 0.75) / 0.25);
      this.mesh.position.set(this.x + this.dx, this.h / 2, this.z + 0.05);
    } else {
      // up fast, then down slowly
      const up = k < 0.2 ? k / 0.2 : Math.max(0, 1 - (k - 0.55) / 0.45);
      this.mesh.scale.y = Math.max(0.01, up);
      this.mesh.position.set(this.x, (this.h * this.mesh.scale.y) / 2, this.z + 0.05);
    }
    this.mark.material.opacity = Math.max(0, 1 - k);
    return k < 1;
  }

  dispose() {
    drop(this.fx.scene, this.mesh);
    drop(this.fx.scene, this.mark);
  }
}

// Lightning out of the sky onto (x, z): there a moment, a flash on the floor where it lands. Drawn
// by hand (`art`, fxart.js), its frames play out over its life, `px` world units to its pixel and
// its strike on (x, z), every other one mirrored; else it's drawn here, `height` tall. With `light`
// (world.flash's look, and `up`: how high over the floor), it lights the floor and everyone near
// for a moment as it strikes.
export class Bolt {
  constructor(fx, { school = 'storm', x, z, k = 0, wide = false, height = 14, life = 0.22, art = null, px = 0.06, light = null, onHit = null }) {
    const sheet = art && fxArt(art);
    if (sheet) {
      const flip = k % 2 ? -1 : 1;
      this.mesh = plane(fx.scene, sheet.frames[0], sheet.w * px, sheet.h * px, { order: 8 });
      this.mesh.scale.x = flip;
      this.mesh.position.set(x + (sheet.w / 2 - sheet.foot[0]) * px * flip, (sheet.h / 2) * px - 0.05, z + 0.1);
      this.frames = sheet.frames;
    } else {
      this.mesh = plane(fx.scene, TEX.bolt(school, k, wide), wide ? 2.6 : 1.3, height, { order: 8 });
      this.mesh.position.set(x, height / 2, z + 0.1);
    }
    this.mark = floor(fx.scene, TEX.ring(school), x, z, wide ? 4.2 : 2.2, 1);
    Object.assign(this, { fx, life, t: 0 });
    if (light) flash(fx.scene, [x, light.up ?? 2, z], light);
    onHit?.(new THREE.Vector3(x, 0.5, z));
    fx.particles.emit({
      pos: [x, 0.3, z], spread: [0.3, 0.1, 0.3], vel: [0, 2.4, 0], velSpread: [2, 1.6, 1.4],
      color: motesOf(school), size: wide ? 0.11 : 0.07, life: 0.5, count: wide ? 40 : 14, drag: 1.2, intensity: 2.8,
    });
  }

  step(dt) {
    this.t += dt;
    const k = this.t / this.life;
    if (this.frames) {
      // (the strike, the flash, the fading: its own frames do the flickering)
      this.mesh.material.map = this.frames[Math.min(this.frames.length - 1, Math.floor(k * this.frames.length))];
      this.mesh.material.opacity = k < 0.85 ? 1 : Math.max(0, 1 - (k - 0.85) / 0.15);
    } else {
      this.mesh.material.opacity = k < 0.6 ? (Math.floor(this.t * 40) % 2 ? 1 : 0.65) : Math.max(0, 1 - (k - 0.6) / 0.4);
    }
    this.mark.material.opacity = Math.max(0, 1 - k);
    return k < 1;
  }

  dispose() {
    drop(this.fx.scene, this.mesh);
    drop(this.fx.scene, this.mark);
  }
}

// A blow striking home at `at`: a spark of sharp lines in the striker's light (`color`, '#rrggbb')
// flung the way the blow went (`dir`, -1 or 1), `size` world units tall, three frames in a flash;
// drawn over whatever it strikes (it would be lost inside him); its light a glint round it.
export class Spark {
  constructor(fx, { color, at, dir = 1, size = 1, life = 0.16 }) {
    const w = (size * 32) / 24;
    this.mesh = plane(fx.scene, TEX.spark(color, 0), w, size, { order: 9 });
    this.mesh.material.depthTest = false;
    this.mesh.scale.x = dir;
    // (its heart, 8 of its 32 columns in, on the spot)
    this.mesh.position.set(at[0] + (w / 2 - (w * 8.5) / 32) * dir, at[1], at[2]);
    flash(fx.scene, [at[0], at[1], at[2] + 0.3], { color, power: 8 * size, reach: 5, life: 0.14, rise: 0.01 });
    Object.assign(this, { fx, color, life, t: 0 });
  }

  step(dt) {
    this.t += dt;
    const frame = Math.floor((this.t / this.life) * 3);
    if (frame > 2) return false;
    this.mesh.material.map = TEX.spark(this.color, frame);
    return true;
  }

  dispose() { drop(this.fx.scene, this.mesh); }
}

// A burst where something strikes home: a flash of rays, a ring spreading on the floor, sparks;
// and its light round it a moment, the bigger the brighter, farther and longer (unless `light`
// is false: another light already there).
export class Burst {
  constructor(fx, { school, at, size = 2, ring = true, sparks = 30, life = 0.45, light = true }) {
    const [x, y, z] = at;
    if (light) flash(fx.scene, [x, y, z + 0.3], shine(school, 12 * size ** 1.5, 4 + 3 * size, { life: 0.25 + 0.06 * size, rise: 0.02 }));
    this.flash = plane(fx.scene, TEX.burst(school), size, size, { order: 8 });
    this.flash.position.set(x, y, z + 0.15);
    this.flash.rotation.z = Math.random() * Math.PI;
    this.ring = ring ? floor(fx.scene, TEX.ring(school), x, z, size * 0.6, 1) : null;
    Object.assign(this, { fx, life, size, t: 0 });
    fx.particles.emit({
      pos: [x, y, z], spread: [0.15, 0.15, 0.15], vel: [0, 1.2, 0], velSpread: [2.4, 2, 1.6],
      color: motesOf(school), size: 0.08, life: 0.6, count: sparks, drag: 1.6, intensity: 2.8,
    });
  }

  step(dt) {
    this.t += dt;
    const k = this.t / this.life;
    this.flash.scale.setScalar(0.6 + k * 0.7);
    this.flash.material.opacity = Math.max(0, 1 - k);
    if (this.ring) {
      this.ring.scale.setScalar(1 + k * 2.4);
      this.ring.material.opacity = Math.max(0, 1 - k);
    }
    return k < 1;
  }

  dispose() {
    drop(this.fx.scene, this.flash);
    if (this.ring) drop(this.fx.scene, this.ring);
  }
}

// The wall of light: a tall crescent flying `dir` ([dx, dz], one of the four ways) from (x, z),
// `range` far; `hits(x, z)` asks, as it goes, whether it has reached its mark. It carries its light
// along the floor.
export class Wall {
  // drawn (`art`, fxart.js), it plays its frames: forming as it leaves, full as it flies, fading at
  // the end of its run
  constructor(fx, { x, z, dir, speed = 13, range = 15, height = 6, art = null, hits = null, onHit = null }) {
    const sheet = art && fxArt(art);
    this.frames = sheet?.frames || null;
    this.mesh = plane(fx.scene, sheet ? sheet.frames[0] : TEX.wall(), sheet ? (height * sheet.w) / sheet.h : height * 0.56, height, { order: 7 });
    this.mesh.scale.x = dir[0] < 0 ? -1 : 1;
    // flying more into or out of the view than across: seen face on, as a broad arc
    const ahead = Math.abs(dir[1]) > Math.abs(dir[0]);
    if (ahead) { this.mesh.rotation.z = (dir[1] > 0 ? -1 : 1) * Math.PI / 2; this.mesh.scale.set(1.8, 1, 1); }
    Object.assign(this, { fx, x, z, dir, ahead, speed, range, height, hits, onHit, gone: 0, t: 0, struck: false });
    this.light = carry(fx.scene, [x, height * 0.4, z + 0.4], shine('holy', 50, 15));
    this.place();
  }

  place() {
    this.mesh.position.set(this.x, this.ahead ? 1.6 : this.height / 2, this.z + 0.1);
    this.light.at(this.x, this.height * 0.4, this.z + 0.4);
  }

  step(dt) {
    this.t += dt;
    const s = this.speed * dt;
    this.x += this.dir[0] * s;
    this.z += this.dir[1] * s;
    this.gone += s;
    this.place();
    if (!this.struck && this.hits?.(this.x, this.z)) {
      this.struck = true;
      this.onHit?.(new THREE.Vector3(this.x, 2, this.z));
    }
    if (Math.random() < dt * 50) {
      this.fx.particles.emit({
        pos: [this.x, 0.3 + Math.random() * this.height * 0.8, this.z], spread: [0.2, 0.3, 0.2], vel: [-this.dir[0] * 2, 0.6, -this.dir[1] * 2],
        velSpread: [0.5, 0.5, 0.5], color: motesOf('holy'), size: 0.07, life: 0.6, count: 3, drag: 1.4, intensity: 2.6,
      });
    }
    const k = this.gone / this.range;
    if (this.frames) this.mesh.material.map = this.frames[k < 0.08 ? 0 : k < 0.75 ? 1 : 2];
    this.mesh.material.opacity = k < 0.75 ? 1 : Math.max(0, 1 - (k - 0.75) / 0.25);
    this.light.level = this.mesh.material.opacity;
    return k < 1;
  }

  dispose() {
    this.light.end(0.1);
    drop(this.fx.scene, this.mesh);
  }
}

// A pool of blood on the floor at (x, z), `r` across its middle, for `life` seconds: it spreads,
// bubbles, and dries away at the end.
// Drawn by hand (`art`, fxart.js) it spreads in its first frame, then bubbles between the others,
// a little wider than `r` for the splashes round its rim.
export class Pool {
  constructor(fx, { x, z, r = 3.2, life = 7, art = null, onStep = null }) {
    const sheet = art && fxArt(art);
    const mat = rippling(new THREE.MeshBasicMaterial({ map: sheet ? sheet.frames[0] : TEX.pool(), transparent: true, depthWrite: false, opacity: 0.95, toneMapped: false }));
    const w = sheet ? r * 2.2 : r * 2;
    this.frames = sheet?.frames || null;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, sheet ? (w * sheet.h) / sheet.w : w, 16, 16), mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(x, 0.045, z);
    this.mesh.renderOrder = 3;
    fx.scene.add(this.mesh);
    Object.assign(this, { fx, x, z, r, life, onStep, t: 0 });
  }

  get active() { return this.t < this.life; }

  step(dt) {
    this.t += dt;
    const k = this.t / this.life;
    const spread = Math.min(1, this.t / 0.45);
    if (this.frames) {
      // (its first drawing is already the small one, spreading: it grows less)
      this.mesh.scale.setScalar(0.6 + 0.4 * spread);
      this.mesh.material.map = spread < 1 ? this.frames[0] : this.frames[1 + (Math.floor(this.t / 0.5) % (this.frames.length - 1))];
    } else {
      this.mesh.scale.setScalar(0.2 + 0.8 * spread);
    }
    this.mesh.material.opacity = 0.95 * Math.min(1, (1 - k) / 0.15);
    if (Math.random() < dt * 10) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * this.r * 0.8;
      this.fx.particles.emit({
        pos: [this.x + Math.cos(a) * d, 0.1, this.z + Math.sin(a) * d * 0.8], spread: [0.05, 0, 0.05], vel: [0, 0.9, 0], velSpread: [0.1, 0.3, 0.1],
        color: motesOf('blood'), size: 0.07, life: 0.5, count: 1, drag: 1, intensity: 1.6,
      });
    }
    this.onStep?.(dt, this);
    return k < 1;
  }

  dispose() { drop(this.fx.scene, this.mesh); }
}

// A crescent of light flying at its mark (to()), striking it once (onHit), fading out past it; its
// light carried along with it.
export class Slash {
  // drawn (`art`, fxart.js; `px` world units to its pixel), it stands on the floor and plays its
  // frames: forming as it leaves, full as it flies, stretching as it strikes, then fading
  constructor(fx, { school, from, to, size = 4, speed = 16, art = null, px = 0.03, onHit = null }) {
    const sheet = art && fxArt(art);
    this.frames = sheet?.frames || null;
    this.mesh = sheet
      ? plane(fx.scene, sheet.frames[0], sheet.w * px, sheet.h * px, { order: 7 })
      : plane(fx.scene, TEX.slash(school), size * 40 / 72, size, { order: 7 });
    this.pos = new THREE.Vector3(...from);
    if (sheet) this.pos.y = (sheet.h * px) / 2;
    Object.assign(this, { fx, to, speed, onHit, school, t: 0, struck: false, fade: 0, fadeFor: sheet ? 0.32 : 0.25 });
    this.light = carry(fx.scene, [this.pos.x, this.pos.y, this.pos.z + 0.4], shine(school, 45, 14));
    this.place();
  }

  // (pointing the way it goes, as it shows on the screen, upright: mirrored going leftward)
  place() {
    if (!this.struck) {
      const [tx, , tz] = this.to();
      const d = Math.hypot(tx - this.pos.x, tz - this.pos.z);
      if (d > 0.05) this.going = [(tx - this.pos.x) / d, (tz - this.pos.z) / d];
    }
    const [gx, gz] = this.going || [1, 0];
    pointAt(this.mesh, screenAngleAt(this.mesh.parent, this.pos, DIR.set(gx, 0, gz)), this);
    this.mesh.position.copy(this.pos);
    this.light.at(this.pos.x, this.pos.y, this.pos.z + 0.4);
  }

  step(dt) {
    this.t += dt;
    const [tx, ty, tz] = this.to();
    if (!this.struck) {
      const d = Math.hypot(tx - this.pos.x, tz - this.pos.z);
      if (d < 0.6 + this.speed * dt) {
        this.struck = true;
        this.onHit?.(new THREE.Vector3(tx, ty, tz));
      } else {
        this.pos.x += ((tx - this.pos.x) / d) * this.speed * dt;
        this.pos.z += ((tz - this.pos.z) / d) * this.speed * dt;
      }
    } else {
      this.fade += dt;
      const [gx, gz] = this.going || [this.mesh.scale.x, 0];
      this.pos.x += gx * this.speed * dt * 0.5;
      this.pos.z += gz * this.speed * dt * 0.5;
    }
    this.place();
    if (this.frames) {
      const k = this.fade / this.fadeFor;
      this.mesh.material.map = this.frames[this.struck ? (k < 0.35 ? 2 : 3) : this.t < 0.06 ? 0 : 1];
      this.mesh.material.opacity = k < 0.35 ? 1 : Math.max(0, 1 - (k - 0.35) / 0.65);
    } else {
      this.mesh.material.opacity = Math.max(0, 1 - this.fade / this.fadeFor);
    }
    this.light.level = this.mesh.material.opacity;
    if (Math.random() < dt * 40) {
      this.fx.particles.emit({
        pos: [this.pos.x, this.pos.y, this.pos.z], spread: [0.1, 0.8, 0.1], vel: [0, 0.4, 0], velSpread: [0.4, 0.4, 0.3],
        color: motesOf(this.school), size: 0.07, life: 0.4, count: 2, drag: 1.4, intensity: 2.6,
      });
    }
    return this.t < 3 && this.fade < this.fadeFor;
  }

  dispose() {
    this.light.end(0.1);
    drop(this.fx.scene, this.mesh);
  }
}

// A cut hanging in the air: a thin line of light from a to b, flaring when it's settled (flare());
// drawn across, it glints round it a moment.
export class Cut {
  constructor(fx, { a, b, school = 'steel', width = 0.07, art = null, px = 0 }) {
    const [x0, y0, z0] = a;
    const [x1, y1, z1] = b;
    const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    const angle = screenAngle(x1 - x0, y1 - y0, z1 - z0);
    const sheet = art && fxArt(art);
    if (sheet) {
      // drawn: the one of them nearest its angle (or that one mirrored), turned the little that's
      // left; `px` world units to its pixel (else as long as the cut)
      const pick = nearestCut(sheet, angle);
      const s = px || len / pick.len;
      this.mesh = plane(fx.scene, pick.map, pick.w * s, pick.h * s, { order: 9 });
      this.mesh.rotation.z = angle - pick.a;
      this.flip = pick.flip ? -1 : 1;
    } else {
      this.mesh = plane(fx.scene, TEX.beam(school), len, width, { order: 9 });
      this.mesh.rotation.z = angle;
      this.flip = 1;
    }
    this.mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2 + 0.2);
    flash(fx.scene, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2 + 0.4], shine(school, 18, len / 2 + 4, { life: 0.22, rise: 0.02 }));
    this.drawn = !!sheet;
    this.grow = 0.05;
    this.mesh.scale.x = this.grow * this.flip;
    if (this.drawn) this.mesh.scale.y = this.grow;
    Object.assign(this, { fx, school, t: 0, flared: -1, gone: false });
  }

  flare() { this.flared = this.t; }

  step(dt) {
    this.t += dt;
    // drawn across in a blink (a drawn one springs out from its middle)
    this.grow = Math.min(1, this.grow + dt * 18);
    this.mesh.scale.x = this.grow * this.flip;
    if (this.drawn && this.flared < 0) this.mesh.scale.y = this.grow;
    if (this.flared >= 0) {
      const k = (this.t - this.flared) / 0.4;
      this.mesh.scale.y = 1 + k * (this.drawn ? 1.5 : 5);
      this.mesh.material.opacity = Math.max(0, 1 - k);
      return k < 1;
    }
    this.mesh.material.opacity = 0.75 + 0.25 * Math.sin(this.t * 30);
    return this.t < 8;
  }

  dispose() { drop(this.fx.scene, this.mesh); }
}

// Drawn cuts (fxart.js, Wynn's): on the sheet, level; steep, rising to the right; shallow, falling
// to the right; upright. Each one's angle on the screen and its length tip to tip, in its pixels,
// with the diagonals mirrored too (a falling one rises, mirrored); the one nearest `angle`.
function nearestCut(sheet, angle) {
  const shapes = [];
  sheet.frames.forEach((map, k) => {
    const { width: w, height: h } = map.image;
    const a = [0, Math.atan2(h, w), -Math.atan2(h, w), Math.PI / 2][k] ?? 0;
    const len = [w, Math.hypot(w, h), Math.hypot(w, h), h][k] ?? w;
    shapes.push({ map, w, h, a, len, flip: false });
    if (k === 1 || k === 2) shapes.push({ map, w, h, a: -a, len, flip: true });
  });
  // (a line's angle is the same half a turn on)
  const off = (s) => Math.abs(Math.atan2(Math.sin(2 * (angle - s.a)), Math.cos(2 * (angle - s.a))));
  return shapes.reduce((best, s) => (off(s) < off(best) ? s : best));
}

// Something dropping out of the sky onto (x, z) (an icicle), landing after `dur` and shattering.
// (`span`: how tall it stands as drawn, turned upright.) A great one (`stick`) is driven into the
// floor, its point `sink` deep, and stands there shuddering for `stick` seconds before it shatters
// (`onShatter`, then).
export class Drop {
  constructor(fx, { school = 'frost', x, z, map, w, h, span = h, art = null, px = 0.02, shatter = null, shatterPx = px, height = 12, dur = 0.5, delay = 0, stick = 0, sink = 0, onHit = null, onShatter = null }) {
    const sheet = art && fxArt(art);
    if (sheet) {
      [w, h] = [sheet.w * px, sheet.h * px];
      span = h;
    }
    this.drawn = !!sheet;
    this.mesh = plane(fx.scene, sheet ? sheet.frames[0] : map, w, h, { order: 7 });
    this.mesh.visible = false;
    Object.assign(this, { fx, school, x, z, span, height, dur, delay, stick, sink, px, onHit, onShatter, shatter, shatterPx, t: 0, stuck: null });
  }

  step(dt) {
    if (this.delay > 0) { this.delay -= dt; return true; }
    this.mesh.visible = true;
    this.t += dt;
    if (this.stuck != null) {
      // (driven in: shuddering a pixel either way, then bursting)
      this.stuck += dt;
      this.mesh.position.x = this.x + (Math.floor(this.stuck * 30) % 2 ? this.px : -this.px);
      if (this.stuck < this.stick) return true;
      this.burst();
      return false;
    }
    const k = Math.min(1, this.t / this.dur);
    this.mesh.position.set(this.x, this.span / 2 + this.height * (1 - k * k), this.z + 0.1);
    if (k >= 1) {
      this.onHit?.(new THREE.Vector3(this.x, 0.5, this.z));
      if (this.stick > 0) {
        this.stuck = 0;
        this.mesh.position.y = this.span / 2 - this.sink;
        return true;
      }
      this.burst();
      return false;
    }
    return true;
  }

  burst() {
    // (drawn, it bursts into its own shards; the flash under them smaller)
    const splash = this.shatter && fxArt(this.shatter);
    if (splash) this.fx.add(new Splash(this.fx, { art: this.shatter, x: this.x, z: this.z + 0.15, px: this.shatterPx, flip: Math.random() < 0.5 }));
    this.fx.add(new Burst(this.fx, { school: this.school, at: [this.x, 0.8, this.z], size: splash ? 1.6 : 2.6, sparks: 34 }));
    this.onShatter?.();
  }

  dispose() { drop(this.fx.scene, this.mesh); }
}

// A drawn effect (fxart.js) played once where something lands (an icicle's shatter): its frames at
// `fps`, `px` world units to its pixel, its foot on (x, z), mirrored or not; `light`, a flash of it
// (world.flash's look), a third of its height up.
export class Splash {
  constructor(fx, { art, x, z, px, fps = 14, flip = false, light = null }) {
    const sheet = fxArt(art);
    const s = flip ? -1 : 1;
    this.mesh = plane(fx.scene, sheet.frames[0], sheet.w * px, sheet.h * px, { order: 8 });
    this.mesh.scale.x = s;
    this.mesh.position.set(x + (sheet.w / 2 - sheet.foot[0]) * px * s, (sheet.h / 2) * px - 0.05, z);
    if (light) flash(fx.scene, [x, (sheet.h * px) / 3, z + 0.4], light);
    Object.assign(this, { fx, frames: sheet.frames, fps, t: 0 });
  }

  step(dt) {
    this.t += dt;
    const i = Math.floor(this.t * this.fps);
    if (i >= this.frames.length) return false;
    this.mesh.material.map = this.frames[i];
    return true;
  }

  dispose() { drop(this.fx.scene, this.mesh); }
}

// A spear stuck in the great enemy, `off` from his middle, until `until`; then it falls away
// (`look`: drawn, { map, w, h }, fxart.js).
// (`way` [dx, dz]: the way it was thrown, which it points, as it shows on the screen; else `dir`,
// left or right. `motes`: the school of the motes it sheds while it's stuck, his ultimate's poison;
// none, a spear simply thrown. `pin`, in place of `follow` and `off`: stuck in his drawing (pinOn),
// it goes with it as he's knocked back, turns as he turns, and drops as soon as what was drawn
// there has moved away from it.)
export class StuckSpear {
  constructor(fx, { follow = null, off = null, dir, way = null, until, look = null, motes = 'poison', pin = null }) {
    const { map, w, h } = look || { map: TEX.spear(), w: 2.1, h: 2.1 * 9 / 70 };
    this.mesh = plane(fx.scene, map, w, h, { order: 7 });
    this.mesh.scale.x = dir;
    this.mesh.rotation.z = (Math.random() - 0.5) * 0.25;
    Object.assign(this, { fx, follow, off, way, until, motes, pin, t: 0, falling: 0, vy: 0, jitter: (Math.random() - 0.5) * 0.25, pointed: null });
    // (where it's stuck from the first, not where it was made, till its first step)
    if (pin) this.pinned();
    else {
      const [bx, by, bz] = follow();
      this.mesh.position.set(bx + off[0], by + off[1], bz + off[2]);
    }
  }

  // In his drawing: its point where it's pinned, its shaft back the way it flew (turned as he
  // turns). Whether it's still there to be.
  pinned() {
    const p = this.pin.now();
    const at = p && this.pin.land(this.mesh.parent, PIN.back);
    if (!at) return false;
    this.mesh.position.set(at[0], at[1], at[2]);
    if (p.way[0] !== this.pointed) {
      this.pointed = p.way[0];
      pointAt(this.mesh, screenAngleAt(this.mesh.parent, this.mesh.position, DIR.set(p.way[0], 0, p.way[1])) + this.jitter, {});
    }
    return true;
  }

  step(dt) {
    this.t += dt;
    if (this.pin && !this.loose) {
      if (this.t < this.until && this.pin.holds() && this.pinned()) {
        this.shed(dt);
        return true;
      }
      this.loose = true; // (it lets go, and drops from where it was)
    }
    if (!this.pin && this.t < this.until) {
      const [bx, by, bz] = this.follow();
      this.mesh.position.set(bx + this.off[0], by + this.off[1], bz + this.off[2]);
      if (this.way && !this.aimed) {
        this.aimed = true;
        const keep = { way: this.mesh.scale.x < 0 ? -1 : 1 };
        pointAt(this.mesh, screenAngleAt(this.mesh.parent, this.mesh.position, DIR.set(this.way[0], 0, this.way[1])) + this.jitter, keep);
      }
      this.shed(dt);
      return true;
    }
    // loose: it drops and fades
    this.falling += dt;
    this.vy -= dt * 12;
    this.mesh.position.y = Math.max(0.1, this.mesh.position.y + this.vy * dt);
    this.mesh.rotation.z += dt * 2 * this.mesh.scale.x;
    this.mesh.material.opacity = Math.max(0, 1 - this.falling / 0.6);
    return this.falling < 0.6;
  }

  // (its motes, now and then, while it's stuck)
  shed(dt) {
    if (!this.motes || Math.random() >= dt * 3) return;
    this.fx.particles.emit({
      pos: [this.mesh.position.x, this.mesh.position.y, this.mesh.position.z], spread: [0.1, 0.1, 0.1], vel: [0, 0.8, 0], velSpread: [0.2, 0.3, 0.2],
      color: motesOf(this.motes), size: 0.07, life: 0.7, count: 1, drag: 0.8, intensity: 1.8,
    });
  }

  dispose() { drop(this.fx.scene, this.mesh); }
}

// ---------------------------------------------------------------------------------------------
// pinned to a drawing

// What strikes something (combat.js, struckOf) lands on its drawing (`struck.drawing()`: the frame
// it shows, as npc.js and training.js make it), and what sticks in it stays pinned there, not to the
// ground where it stands: at the height it struck at, kept to the drawing's middle (`band`: between
// those shares of its drawn height, its torso rather than a blade's tip or a foot), on the edge of
// what's drawn there on the side it came from, `inset` world units into it (somewhere between, and
// `spread` of its height up or down, so that several don't stick in one spot; or, come within `front`
// of straight into the view or out of it, in the middle of what's drawn there), `ahead` of the
// drawing so that it shows over it. Of what's drawn on that row it takes his body (where his middle
// stands), not a blade held out or a tail. It goes with the drawing as it's knocked back and turns as
// it turns; it holds while something's drawn within `grip` of it. (`back`: a spear's middle, behind
// its point.)
const PIN = { band: [0.3, 0.75], inset: [0.14, 0.4], spread: 0.12, front: 0.3, ahead: 0.12, grip: 0.12, back: 0.9 };
const PW = new THREE.Vector3();
const rowDrawn = (d, r) => {
  for (let c = 0; c < d.w; c++) if (d.opaque(c, r)) return true;
  return false;
};

// The pin on `struck` for something that met it at `at` (in the world) flying `way` [dx, dz]: null if
// it has no drawing, or nothing's drawn in its middle.
export function pinOn(struck, at, way) {
  const d = struck?.drawing?.();
  if (!d) return null;
  let top = -1;
  let bottom = -1;
  for (let r = 0; r < d.h; r++) {
    if (!rowDrawn(d, r)) continue;
    if (top < 0) top = r;
    bottom = r;
  }
  if (top < 0) return null;
  // (rows from the top: its middle, between the band's shares of its height above its lowest row)
  const lo = top + Math.round((bottom - top) * (1 - PIN.band[1]));
  const hi = top + Math.round((bottom - top) * (1 - PIN.band[0]));
  const r0 = Math.min(hi, Math.max(lo, d.row(at.y) + Math.round((Math.random() - 0.5) * PIN.spread * (bottom - top))));
  let r = -1;
  for (let k = 0; k <= hi - lo && r < 0; k++) {
    if (r0 - k >= lo && rowDrawn(d, r0 - k)) r = r0 - k;
    else if (r0 + k <= hi && rowDrawn(d, r0 + k)) r = r0 + k;
  }
  if (r < 0) return null;
  // what's drawn on that row, in runs (a gap of a pixel or two closed), and of them his body's: the
  // one his middle (`mid`) stands in, else the nearest to it; not a blade held out, nor a tail
  const runs = [];
  for (let c = 0; c < d.w; c++) {
    if (!d.opaque(c, r)) continue;
    const last = runs[runs.length - 1];
    if (last && c - last[1] <= 3) last[1] = c;
    else runs.push([c, c]);
  }
  let [c0, c1] = runs[0];
  let near = Infinity;
  for (const [a, z] of runs) {
    const off = d.mid < a ? a - d.mid : d.mid > z ? d.mid - z : 0;
    if (off < near) { near = off; [c0, c1] = [a, z]; }
  }
  let c = (c0 + c1) / 2;
  if (Math.abs(way[0]) >= PIN.front) {
    // flying rightward, it came from the world's left: the drawing's first columns, if it faces right
    const inset = (PIN.inset[0] + Math.random() * (PIN.inset[1] - PIN.inset[0])) / d.px;
    c = (way[0] > 0) === (d.facing > 0) ? Math.min(c1, c0 + inset) : Math.max(c0, c1 - inset);
  }
  return {
    struck, way: [...way], facing: d.facing, lx: (d.x(c) - d.ax) * d.facing, ly: d.y(r) - d.base,
    // where its point is now (in the world), and the way it points (turned as the drawing turns)
    now() {
      const e = struck.drawing();
      if (!e) return null;
      return { tip: [e.ax + this.lx * e.facing, e.base + this.ly, e.z + PIN.ahead], way: [this.way[0] * e.facing * this.facing, this.way[1]] };
    },
    // whether something's still drawn about its point
    holds() {
      const e = struck.drawing();
      if (!e) return false;
      const cc = e.col(e.ax + this.lx * e.facing);
      const rr = e.row(e.base + this.ly);
      const k = Math.max(2, Math.round(PIN.grip / e.px));
      for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) if (e.opaque(cc + dc, rr + dr)) return true;
      return false;
    },
    // where something `back` behind its point (along the way it points) is, in `space`
    land(space, back) {
      const p = this.now();
      if (!p) return null;
      PW.set(p.tip[0] - p.way[0] * back, p.tip[1], p.tip[2] - p.way[1] * back);
      space?.worldToLocal?.(PW);
      return [PW.x, PW.y, PW.z];
    },
  };
}

// A point in the world, in `space`'s coordinates (an effect's group: the yard's lowered floor, the
// arena's risen one).
export function inSpace(space, [x, y, z]) {
  PW.set(x, y, z);
  space?.worldToLocal?.(PW);
  return [PW.x, PW.y, PW.z];
}

// ---------------------------------------------------------------------------------------------
// the aura of an ultimate

const OUTLINE = {
  vertexShader: /* glsl */ `
    uniform mat3 uvT;
    varying vec2 vUv;
    void main() { vUv = (uvT * vec3(uv, 1.0)).xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D map;
    uniform vec2 texel;
    uniform vec4 cell;
    uniform vec3 color;
    uniform float uPower, uMask, uTime, uR;
    varying vec2 vUv;
    // (only the frame's own cell of the sheet: past its edge lies the next frame, whose feet would
    // be outlined over the head)
    float alphaAt(vec2 p) {
      return any(lessThan(p, cell.xy)) || any(greaterThanEqual(p, cell.zw)) ? 0.0 : texture2D(map, p).a;
    }
    void main() {
      float a = texture2D(map, vUv).a;
      float ring = 0.0;
      for (int i = 0; i < 16; i++) {
        float ang = float(i) * 0.3927;
        vec2 dir = vec2(cos(ang), sin(ang)) * texel;
        ring = max(ring, alphaAt(vUv + dir * uR));
        ring = max(ring, 0.6 * alphaAt(vUv + dir * uR * 1.9));
      }
      float edge = ring * (1.0 - step(0.5, a));
      float glow = edge * uPower * (0.75 + 0.25 * sin(uTime * 14.0 + vUv.y * 90.0));
      if (glow < 0.02) discard;
      gl_FragColor = uMask > 0.5 ? vec4(vec3(1.0), 1.0) : vec4(color * glow * 1.6, glow);
    }
  `,
};

// Round someone (a SpriteBody) loosing an ultimate: a shining outline in their light, a glow
// behind them, and motes rising and swirling in (their own particles, which go on while the world
// stands still), and their light falling round them. `power` 0..1 brings it in and out.
export class Aura {
  constructor(scene, particles, body, color, { radius = 2.4 } = {}) {
    const sheet = body.sheet;
    this.tex = body.tex;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: body.tex },
        uvT: { value: new THREE.Matrix3() },
        texel: { value: new THREE.Vector2(1 / (sheet.frameW * sheet.cols), 1 / (sheet.frameH * sheet.rows)) },
        cell: { value: new THREE.Vector4(0, 0, 1, 1) }, // the frame shown, in the sheet: [u0, v0, u1, v1]
        color: { value: new THREE.Color(color) },
        uPower: { value: 0 },
        uMask: { value: 0 },
        uTime: { value: 0 },
        uR: { value: radius },
      },
      vertexShader: OUTLINE.vertexShader,
      fragmentShader: OUTLINE.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.outline = new THREE.Mesh(body.mesh.geometry, mat);
    this.outline.renderOrder = 9;
    const glowMat = new THREE.MeshBasicMaterial({
      map: TEX.glow(), color: new THREE.Color(color).multiplyScalar(1.4), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false,
    });
    const h = sheet.frameH * sheet.px;
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.9, h * 0.9), glowMat);
    this.glow.renderOrder = 1;
    scene.add(this.outline, this.glow);
    Object.assign(this, { scene, particles, body, color, power: 0, t: 0, h });
    // (its light from behind them, as the glow is: it falls round them, not on them)
    this.light = carry(scene, [body.mesh.position.x, body.mesh.position.y + h * 0.35, body.mesh.position.z - 0.6], { color, power: 16, reach: 9, level: 0 });
  }

  // the meshes that keep their colour while the world goes grey (post.js)
  get meshes() { return [this.outline, this.glow]; }

  step(dt, power) {
    this.t += dt;
    this.power += (power - this.power) * Math.min(1, dt * 8);
    const m = this.body.mesh;
    // (the sheet the frame shown is in: a big pose's own, npc.js)
    const tex = this.body.mat.map;
    const grid = this.body.grid || this.body.sheet;
    tex.updateMatrix();
    const u = this.outline.material.uniforms;
    u.map.value = tex;
    u.texel.value.set(1 / (grid.frameW * grid.cols), 1 / (grid.frameH * grid.rows));
    u.uvT.value.copy(tex.matrix);
    // (its cell: the offset and repeat npc.js set, the repeat across negative when it faces left)
    const { offset: o, repeat: r } = tex;
    u.cell.value.set(Math.min(o.x, o.x + r.x), Math.min(o.y, o.y + r.y), Math.max(o.x, o.x + r.x), Math.max(o.y, o.y + r.y));
    u.uPower.value = this.power;
    u.uTime.value = this.t;
    this.outline.position.copy(m.position);
    this.outline.position.z += 0.01;
    this.outline.scale.copy(m.scale);
    this.glow.position.set(this.body.footX ?? m.position.x, m.position.y + this.h * 0.32, m.position.z - 0.05);
    this.glow.scale.setScalar(0.9 + 0.12 * Math.sin(this.t * 6));
    this.glow.material.opacity = this.power * 0.55;
    this.light.at(this.glow.position.x, m.position.y + this.h * 0.35, m.position.z - 0.6);
    this.light.level = this.power;
    // motes: rising round them, and drawn in toward them
    if (this.power > 0.3 && Math.random() < dt * 60) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.9 + Math.random() * 0.8;
      const p = m.position;
      this.particles.emit({
        pos: [p.x + Math.cos(a) * r, p.y + 0.2 + Math.random() * this.h * 0.6, p.z + Math.sin(a) * r * 0.5],
        vel: [0, 1.2, 0], velSpread: [0.3, 0.5, 0.2], color: [this.color, '#ffffff'], size: 0.09, life: 0.8, count: 2,
        drag: 0.8, intensity: 2.6, attract: { x: p.x, y: p.y + this.h * 0.35, z: p.z, strength: 3, swirl: 4 },
      });
    }
  }

  dispose() {
    this.light.end(0.2);
    this.scene.remove(this.outline, this.glow);
    this.outline.material.dispose();
    this.glow.material.dispose();
    this.glow.geometry.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// a giant of one's own light (Aurelion's Radiant Verdict)

// Their drawing, in golds by its lightness: the outline darkest, the highlights past white so the
// bloom lights round it; see-through.
const STAND = {
  fragmentShader: /* glsl */ `
    uniform sampler2D map;
    uniform vec3 c0, c1, c2, c3;
    uniform float uPower, uMask;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(map, vUv);
      if (c.a < 0.5 || uPower < 0.02) discard;
      float l = pow(dot(c.rgb, vec3(0.299, 0.587, 0.114)), 1.0 / 2.2);
      vec3 gold = l < 0.25 ? mix(c0, c1, l / 0.25) : l < 0.6 ? mix(c1, c2, (l - 0.25) / 0.35) : mix(c2, c3, (l - 0.6) / 0.4);
      gl_FragColor = uMask > 0.5 ? vec4(1.0) : vec4(gold, 0.88 * uPower);
    }
  `,
};

// Behind someone loosing an ultimate (a SpriteBody), a giant of their own light: their drawing
// `scale` times its size, its feet on theirs, golden and see-through. It shows the frame they show,
// so it swings as they swing, or plays an animation of their sheet on its own (`play`: Aurelion's
// giant swings the Verdict while he strikes a pose); once they're let go of the pose (`follow`
// false) it keeps its last. `power` 0..1 brings it in and out, and its golden light with it, falling
// round them from its chest.
export class Stand {
  constructor(scene, body, { scale = 1.8, colors = ['#4a3208', '#9c7414', '#e8bc30', '#fde070'] } = {}) {
    const [c0, c1, c2, c3] = colors.map((c) => new THREE.Color(c));
    c2.multiplyScalar(1.05);
    c3.multiplyScalar(1.25);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: body.tex },
        uvT: { value: new THREE.Matrix3() },
        c0: { value: c0 },
        c1: { value: c1 },
        c2: { value: c2 },
        c3: { value: c3 },
        uPower: { value: 0 },
        uMask: { value: 0 },
      },
      vertexShader: OUTLINE.vertexShader,
      fragmentShader: STAND.fragmentShader,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(body.mesh.geometry, mat);
    this.mesh.visible = false;
    scene.add(this.mesh);
    Object.assign(this, { scene, body, scale, power: 0, anim: null });
    this.light = carry(scene, [body.mesh.position.x, body.mesh.position.y + 2, body.mesh.position.z - 0.6], { color: colors[3], power: 35, reach: 16, level: 0 });
  }

  // (it keeps its colour while the world goes grey, post.js)
  get meshes() { return [this.mesh]; }

  // An animation of their sheet, played by the giant alone.
  play(name) {
    const def = this.body.sheet.anims[name];
    this.anim = def ? { def, t: 0 } : null;
  }

  step(dt, power, follow = true) {
    // in as the aura comes, out quickly once the blow is struck
    this.power += (power - this.power) * Math.min(1, dt * (power > this.power ? 6 : 12));
    const { body } = this;
    const m = body.mesh;
    const u = this.mesh.material.uniforms;
    const foot = body.footX ?? m.position.x;
    if (this.anim) {
      // a frame of their sheet of its own, shown as SpriteBody.setFrame shows one, facing as they do
      const a = this.anim;
      a.t += dt;
      const { frames, fps } = a.def;
      const index = frames[Math.floor(a.t * fps) % frames.length];
      const { sheet } = body;
      const slot = sheet.slots?.[index];
      const big = !!(slot?.big && body.bigTex);
      const grid = big ? sheet.big : sheet;
      const k = slot ? slot.k : index;
      const f = body.facing;
      const col = k % grid.cols;
      const row = Math.floor(k / grid.cols);
      u.map.value = big ? body.bigTex : body.tex;
      u.uvT.value.setUvTransform((f > 0 ? col : col + 1) / grid.cols, 1 - (row + 1) / grid.rows, f / grid.cols, 1 / grid.rows, 0, 0, 0);
      // its middle on their feet
      const shift = (grid.frameW / 2 - (grid.anchor ?? grid.frameW / 2)) * sheet.px;
      this.mesh.position.set(foot + f * shift * this.scale, m.position.y, m.position.z - 0.3);
      this.mesh.scale.set((grid.frameW / sheet.frameW) * this.scale, (grid.frameH / sheet.frameH) * this.scale, this.scale);
      this.shown = true;
    } else if (follow || !this.shown) {
      const tex = body.mat.map;
      tex.updateMatrix();
      u.map.value = tex;
      u.uvT.value.copy(tex.matrix);
      // its feet where theirs are, and all of it `scale` times as far from them (a lunge too)
      this.mesh.position.set(foot + (m.position.x - foot) * this.scale, m.position.y, m.position.z - 0.3);
      this.mesh.scale.copy(m.scale).multiplyScalar(this.scale);
      this.shown = true;
    }
    u.uPower.value = this.power;
    this.mesh.visible = this.power > 0.02;
    // (its light from its chest, behind them as it stands: the frame's middle, as tall as it is)
    const tall = body.sheet.frameH * body.sheet.px * this.scale;
    this.light.at(foot, m.position.y + tall * 0.42, m.position.z - 0.6);
    this.light.level = this.power;
  }

  dispose() {
    this.light.end(0.25);
    this.scene.remove(this.mesh);
    this.mesh.material.dispose();
  }
}
