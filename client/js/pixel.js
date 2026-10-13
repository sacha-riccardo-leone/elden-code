// Small pixel-art toolkit: seeded randomness, color ramps, and a pixel grid that can
// outline itself and blit onto a canvas. Every sprite and texture in the game is drawn with it.

export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + next() * (hi - lo);
  next.int = (lo, hi) => Math.floor(lo + next() * (hi - lo + 1));
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.chance = (p) => next() < p;
  return next;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

export function shade(hex, f) {
  return f >= 0 ? mix(hex, '#ffffff', f) : mix(hex, '#000000', -f);
}

export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

// Four-step ramp, darkest first, with the hue drifting cooler in shadow and warmer in light.
export function ramp(h, s, l0 = 0.12, l1 = 0.5) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    out.push(hsl(h + (t - 0.5) * 18, s * (0.8 + 0.3 * t), l0 + (l1 - l0) * t));
  }
  return out;
}

export class PixelGrid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(null);
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (color && this.inside(x, y)) this.px[y * this.w + x] = color;
  }

  get(x, y) {
    return this.inside(x, y) ? this.px[y * this.w + x] : null;
  }

  clear(x, y) {
    if (this.inside(x, y)) this.px[y * this.w + x] = null;
  }

  rect(x, y, w, h, color) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color);
  }

  // Bresenham line; thick > 1 stamps a small square at each step.
  line(x0, y0, x1, y1, color, thick = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (thick === 1) this.set(x0, y0, color);
      else this.rect(x0 - Math.floor((thick - 1) / 2), y0 - Math.floor((thick - 1) / 2), thick, thick, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // Draws an ASCII map; `colors` maps characters to colors, '.' and ' ' are skipped.
  stamp(rows, x, y, colors, flip = false) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[flip ? row.length - 1 - i : i];
        if (ch !== '.' && ch !== ' ' && colors[ch]) this.set(x + i, y + j, colors[ch]);
      }
    });
  }

  // 1px outline around every opaque pixel (4-neighbourhood), drawn outside the shape.
  // Pixels already in the outline colour don't spawn a second ring.
  outline(color) {
    const solid = (x, y) => {
      const c = this.get(x, y);
      return c && c !== color;
    };
    const add = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) add.push([x, y]);
      }
    }
    for (const [x, y] of add) this.set(x, y, color);
  }

  // Paints another grid on top. With outline, the piece gets its own 1px ring wherever it
  // borders anything, so armour, hats and weapons stay readable against the body.
  composite(piece, outlineColor = null) {
    if (outlineColor) {
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          if (piece.get(x, y)) continue;
          if (piece.get(x - 1, y) || piece.get(x + 1, y) || piece.get(x, y - 1) || piece.get(x, y + 1)) this.set(x, y, outlineColor);
        }
      }
    }
    for (let i = 0; i < piece.px.length; i++) if (piece.px[i]) this.px[i] = piece.px[i];
  }

  blit(ctx, ox = 0, oy = 0) {
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.px.length; i++) {
      const c = this.px[i];
      if (!c) continue;
      const [r, g, b] = hexToRgb(c);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, ox, oy);
  }
}
