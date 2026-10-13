// Procedural pixel textures for the courtyard: 16 texels per world unit to match the sprites.
// Everything is seeded, so the world looks the same on every load.

import * as THREE from 'three';
import { makeCanvas, rng, mix, shade, PixelGrid } from './pixel.js';

export const TEXELS = 16;

export function pixelTexture(canvas, { repeat = null, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

function noisePixel(r, base, amount) {
  return shade(base, (r() - 0.5) * amount);
}

// ---------------------------------------------------------------------------------------------
// Courtyard floor: flagstone plaza fading into packed dirt, moss and dead grass near the walls.

export const DEFAULT_FLOOR = {
  stone: ['#3a3940', '#413f46', '#38363c', '#46434a', '#3d3a3f'],
  dirt: ['#2b2622', '#2f2925', '#27221f'],
  moss: ['#2f3628', '#363e2d', '#2a3024'],
  tuft: ['#4a4a32', '#3d4030'],
};

export function floorCanvas(widthUnits, depthUnits, regionFn, palette = DEFAULT_FLOOR, seed = 1337) {
  const W = widthUnits * TEXELS;
  const H = depthUnits * TEXELS;
  const { c, ctx } = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  const r = rng(seed);
  const put = (x, y, hex) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const n = parseInt(hex.slice(1), 16);
    const i = (y * W + x) * 4;
    img.data[i] = (n >> 16) & 255;
    img.data[i + 1] = (n >> 8) & 255;
    img.data[i + 2] = n & 255;
    img.data[i + 3] = 255;
  };

  const STONE = palette.stone;
  const DIRT = palette.dirt;
  const MOSS = palette.moss;

  // Base: dirt everywhere with speckle.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const base = DIRT[(x * 7 + y * 13 + ((x * y) % 5)) % 3];
      put(x, y, r() < 0.12 ? shade(base, -0.25) : r() < 0.06 ? shade(base, 0.12) : base);
    }
  }

  // Flagstones: irregular slabs laid on a staggered grid where the region function says "paved".
  const slab = TEXELS;
  for (let ty = 0; ty < depthUnits; ty++) {
    const offset = ty % 2 ? slab / 2 : 0;
    for (let tx = -1; tx < widthUnits; tx++) {
      const wide = r() < 0.35 ? 2 : 1;
      const x0 = tx * slab + offset;
      const y0 = ty * slab;
      const cx = (x0 + (slab * wide) / 2) / TEXELS;
      const cz = (y0 + slab / 2) / TEXELS;
      const pave = regionFn(cx, cz);
      if (pave < 0.5 || r() > pave + 0.15) continue;
      const base = STONE[Math.floor(r() * STONE.length)];
      const w = slab * wide;
      for (let y = 0; y < slab; y++) {
        for (let x = 0; x < w; x++) {
          let col = noisePixel(r, base, 0.08);
          if (y === 0 || x === 0) col = '#1d1b20';
          else if (y === 1 || x === 1) col = shade(base, 0.12);
          else if (y === slab - 1 || x === w - 1) col = shade(base, -0.22);
          put(x0 + x, y0 + y, col);
        }
      }
      // cracks
      if (r() < 0.35) {
        let x = x0 + 3 + Math.floor(r() * (w - 6));
        let y = y0 + 2;
        for (let s = 0; s < 10 + r() * 8; s++) {
          put(x, y, '#1f1d22');
          x += Math.round(r() * 2 - 1);
          y += r() < 0.8 ? 1 : 0;
          if (y >= y0 + slab - 1) break;
        }
      }
      // moss in the seams
      if (r() < 0.4 * (1.2 - pave)) {
        const mx = x0 + Math.floor(r() * w);
        for (let s = 0; s < 18; s++) put(mx + Math.floor(r() * 6) - 3, y0 + Math.floor(r() * 3), MOSS[Math.floor(r() * 3)]);
      }
    }
  }

  // Dead grass tufts and pebbles on the unpaved ground.
  for (let i = 0; i < (W * H) / 90; i++) {
    const x = Math.floor(r() * W);
    const y = Math.floor(r() * H);
    if (regionFn(x / TEXELS, y / TEXELS) > 0.45) continue;
    if (r() < 0.6) {
      const g = palette.tuft[r() < 0.5 ? 0 : 1];
      put(x, y, g); put(x + 1, y - 1, g); put(x - 1, y - 1, shade(g, -0.2)); put(x, y - 2, shade(g, 0.15));
    } else {
      put(x, y, '#4a4549'); put(x + 1, y, '#2a272b');
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------------------------
// Gothic stone masonry: 32x32 texels covering 2x2 world units.

export function brickCanvas(seed = 3, { moss = 0.2, base = ['#3b3940', '#423f47', '#37353c', '#46424a'], mossColors = ['#323a2b', '#2b3226'] } = {}) {
  const S = 32;
  const g = new PixelGrid(S, S);
  const r = rng(seed);
  const MORTAR = '#1c1a20';
  for (let row = 0; row < 4; row++) {
    const y0 = row * 8;
    let x = row % 2 ? -6 : 0;
    while (x < S) {
      const w = 10 + Math.floor(r() * 9);
      const b = base[Math.floor(r() * base.length)];
      for (let y = 0; y < 8; y++) {
        for (let i = 0; i < w; i++) {
          const px = (x + i + S) % S;
          let col = r() < 0.18 ? shade(b, (r() - 0.5) * 0.18) : b;
          if (y === 7 || i === w - 1) col = MORTAR;
          else if (y === 0) col = shade(b, 0.14);
          else if (i === 0) col = shade(b, 0.07);
          else if (y === 6) col = shade(b, -0.18);
          if (moss && y > 3 && r() < moss * (y / 8) * 0.5) col = r() < 0.5 ? mossColors[0] : mossColors[1];
          g.set(px, y0 + y, col);
        }
      }
      if (r() < 0.25) {
        const cx = (x + 2 + Math.floor(r() * (w - 4)) + S) % S;
        g.set(cx, y0 + 2, MORTAR); g.set(cx + 1, y0 + 3, MORTAR); g.set(cx + 1, y0 + 4, MORTAR);
      }
      x += w;
    }
  }
  const { c, ctx } = makeCanvas(S, S);
  g.blit(ctx);
  return c;
}

export function woodCanvas(seed = 9) {
  const S = 16;
  const g = new PixelGrid(S, S);
  const r = rng(seed);
  const W = ['#2a1c12', '#33231a', '#3d2a1d'];
  for (let x = 0; x < S; x++) {
    const plank = Math.floor(x / 4);
    for (let y = 0; y < S; y++) {
      let col = W[(plank + Math.floor(y / 5)) % 3];
      if (x % 4 === 3) col = '#160f0a';
      else if (r() < 0.12) col = shade(col, -0.2);
      g.set(x, y, col);
    }
  }
  const { c, ctx } = makeCanvas(S, S);
  g.blit(ctx);
  return c;
}

export function slateCanvas() {
  const S = 16;
  const g = new PixelGrid(S, S);
  const r = rng(21);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const off = Math.floor(y / 4) % 2 ? 2 : 0;
      const edge = y % 4 === 3 || (x + off) % 4 === 0;
      const b = ['#23262f', '#2a2d37', '#20232b'][((x + off) >> 2) % 3];
      g.set(x, y, edge ? '#121318' : r() < 0.1 ? shade(b, 0.15) : b);
    }
  }
  const { c, ctx } = makeCanvas(S, S);
  g.blit(ctx);
  return c;
}

export function barkCanvas() {
  const S = 16;
  const g = new PixelGrid(S, S);
  const r = rng(5);
  for (let x = 0; x < S; x++) for (let y = 0; y < S; y++) {
    const ridge = (x + Math.floor(Math.sin(y * 0.7) * 1.5)) % 4 === 0;
    g.set(x, y, ridge ? '#120e0d' : r() < 0.2 ? '#2b2420' : '#221c19');
  }
  const { c, ctx } = makeCanvas(S, S);
  g.blit(ctx);
  return c;
}

// Bookshelf front: three shelves of muted spines.
export function shelfCanvas(seed = 11) {
  const W = 48, H = 56;
  const g = new PixelGrid(W, H);
  const r = rng(seed);
  const SPINES = ['#4a1e22', '#2e3a2a', '#3b2a1a', '#2a2e3e', '#5a4a2a', '#3a1e2e', '#4d4434'];
  g.rect(0, 0, W, H, '#1c130d');
  for (let s = 0; s < 3; s++) {
    const y0 = 3 + s * 18;
    let x = 3;
    while (x < W - 4) {
      const w = 2 + Math.floor(r() * 3);
      const h = 10 + Math.floor(r() * 5);
      const col = SPINES[Math.floor(r() * SPINES.length)];
      if (r() < 0.12) { x += w + 1; continue; }
      g.rect(x, y0 + (15 - h), w, h, col);
      g.rect(x, y0 + (15 - h), 1, h, shade(col, 0.18));
      g.rect(x, y0 + (15 - h) + 2, w, 1, '#a08850');
      x += w;
    }
    g.rect(0, y0 + 15, W, 3, '#3d2a1d');
    g.rect(0, y0 + 15, W, 1, '#5a3e25');
  }
  g.rect(0, 0, 3, H, '#2b1d13');
  g.rect(W - 3, 0, 3, H, '#2b1d13');
  const { c, ctx } = makeCanvas(W, H);
  g.blit(ctx);
  return c;
}

// Ritual circle: drawn white so the material color and emissive tint it.
export function runeCircleCanvas() {
  const S = 128;
  const { c, ctx } = makeCanvas(S, S);
  const g = new PixelGrid(S, S);
  const r = rng(66);
  const ring = (rad, gap = 0) => {
    for (let a = 0; a < Math.PI * 2; a += 0.004) {
      if (gap && Math.floor((a / (Math.PI * 2)) * gap) % 2) continue;
      g.set(64 + Math.cos(a) * rad, 64 + Math.sin(a) * rad, '#ffffff');
    }
  };
  ring(60); ring(57); ring(40); ring(20, 24);
  for (let i = 0; i < 7; i++) {
    const a1 = (i / 7) * Math.PI * 2;
    const a2 = ((i + 3) / 7) * Math.PI * 2;
    g.line(64 + Math.cos(a1) * 40, 64 + Math.sin(a1) * 40, 64 + Math.cos(a2) * 40, 64 + Math.sin(a2) * 40, '#ffffff');
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const cx = 64 + Math.cos(a) * 48.5;
    const cy = 64 + Math.sin(a) * 48.5;
    const glyph = Math.floor(r() * 6);
    const pts = [
      [[0, -3], [0, 3], [-2, -1], [2, -1]],
      [[-2, -3], [2, 3], [2, -3], [-2, 3]],
      [[0, -3], [-2, 0], [0, 3], [2, 0]],
      [[-2, -2], [2, -2], [0, 3]],
      [[-2, 3], [0, -3], [2, 3], [-1, 0]],
      [[0, -3], [0, 3], [-2, 2], [2, -2]],
    ][glyph];
    for (let k = 0; k < pts.length - 1; k++) g.line(cx + pts[k][0], cy + pts[k][1], cx + pts[k + 1][0], cy + pts[k + 1][1], '#ffffff');
  }
  g.blit(ctx);
  return c;
}

// Heraldic banner, 16x40, with a project-colored field and a gold emblem.
export function bannerCanvas(colorRamp, emblem = 0) {
  const W = 16, H = 40;
  const g = new PixelGrid(W, H);
  const C = colorRamp;
  for (let y = 0; y < H - 4; y++) for (let x = 1; x < W - 1; x++) g.set(x, y, x < 3 ? C[3] : x > W - 4 ? C[1] : C[2]);
  for (let x = 1; x < W - 1; x++) {
    const tip = Math.abs(x - W / 2 + 0.5);
    for (let y = H - 4; y < H - Math.floor(tip / 2); y++) g.set(x, y, C[2]);
  }
  for (let y = 2; y < H - 6; y++) { g.set(2, y, '#9c7631'); g.set(W - 3, y, '#9c7631'); }
  g.rect(0, 0, W, 2, '#5a4116');
  const gold = '#d6b46e';
  const emblems = [
    ['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', '...X...', '...X...', '..XXX..', '.X.X.X.'],
    ['..XXX..', '.X...X.', 'X.....X', 'X.....X', 'X.....X', '.X...X.', '..XXX..', '.......'],
    ['...X...', '...X...', '.XXXXX.', '...X...', '...X...', '...X...', '...X...', '..XXX..'],
    ['X.....X', '.X...X.', '..X.X..', '...X...', '..X.X..', '.X...X.', 'X.....X', '.......'],
  ];
  g.stamp(emblems[emblem % emblems.length], 5, 12, { X: gold });
  const { c, ctx } = makeCanvas(W, H);
  g.blit(ctx);
  return c;
}

// Gothic window: pointed arch with amber panes, used as an emissive decal.
export function windowCanvas() {
  const W = 12, H = 24;
  const g = new PixelGrid(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cx = x - (W - 1) / 2;
      const inArch = y > 5 || Math.abs(cx) < (y + 1) * 0.95;
      if (!inArch) continue;
      const frame = x === 0 || x === W - 1 || y === H - 1 || (y <= 5 && Math.abs(cx) > y * 0.95 - 1.2);
      const mullion = Math.abs(cx) < 0.6 || y === 12;
      g.set(x, y, frame ? '#1a171c' : mullion ? '#2a2420' : mix('#c98a3a', '#7a3a2a', ((x * 5 + y * 3) % 7) / 10));
    }
  }
  const { c, ctx } = makeCanvas(W, H);
  g.blit(ctx);
  return c;
}

export function parchmentCanvas() {
  const W = 32, H = 20;
  const g = new PixelGrid(W, H);
  const r = rng(8);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g.set(x, y, r() < 0.15 ? '#a8936a' : '#bfa97c');
  g.line(4, 6, 12, 4, '#5a3a22'); g.line(12, 4, 20, 9, '#5a3a22'); g.line(20, 9, 27, 7, '#5a3a22');
  g.line(6, 14, 15, 12, '#3a5a3a'); g.line(15, 12, 24, 15, '#3a5a3a');
  g.rect(19, 8, 3, 3, '#8a2a22');
  for (let x = 0; x < W; x++) { g.set(x, 0, '#7a6440'); g.set(x, H - 1, '#7a6440'); }
  const { c, ctx } = makeCanvas(W, H);
  g.blit(ctx);
  return c;
}

// Grass / weed tufts as small billboards.
export function tuftCanvas(seed, cols = ['#3e4230', '#4a4d36', '#353a2a', '#5a5a3a']) {
  const W = 16, H = 12;
  const g = new PixelGrid(W, H);
  const r = rng(seed);
  for (let i = 0; i < 9; i++) {
    let x = 3 + Math.floor(r() * 10);
    const h = 4 + Math.floor(r() * 7);
    const lean = r() < 0.5 ? -1 : 1;
    for (let y = 0; y < h; y++) {
      g.set(x, H - 1 - y, cols[Math.floor(r() * cols.length)]);
      if (y > h / 2 && r() < 0.4) x += lean;
    }
  }
  g.outline('#15140f');
  const { c, ctx } = makeCanvas(W, H);
  g.blit(ctx);
  return c;
}

// Cliff rock: horizontal strata of dark stone, 32x32 texels over 2x2 units.
export function rockCanvas(seed = 31, base = ['#26252b', '#2d2b31', '#222127', '#323037']) {
  const S = 32;
  const g = new PixelGrid(S, S);
  const r = rng(seed);
  for (let y = 0; y < S; y++) {
    const band = base[Math.floor((y + Math.floor(r() * 2)) / 5) % base.length];
    for (let x = 0; x < S; x++) {
      let c = r() < 0.15 ? shade(band, (r() - 0.5) * 0.3) : band;
      if ((y % 5 === 4 && r() < 0.7) || (x % 11 === Math.floor(y / 5) % 11 && r() < 0.5)) c = '#141318';
      g.set(x, y, c);
    }
  }
  const { c, ctx } = makeCanvas(S, S);
  g.blit(ctx);
  return c;
}
