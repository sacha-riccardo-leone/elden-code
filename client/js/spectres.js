// Spectres of the Noble Sorcerers (heroes/spectre.js): called up when every hero is already out on
// a quest (director.summonSpectre), they float to work on their session's island and fade when
// it's done. Each spectre about at once wears its own colour: the first blue, as drawn, then
// purple, green, red… (the drawing's blues turned to that colour; its gold stays gold).

export const SPECTRE_COLORS = [
  { name: 'Blue', hue: 0, tint: [0.75, 0.88, 1] },
  { name: 'Purple', hue: 65, tint: [0.88, 0.75, 1] },
  { name: 'Green', hue: -95, tint: [0.75, 1, 0.8] },
  { name: 'Red', hue: 150, tint: [1, 0.72, 0.72] },
  { name: 'Golden', hue: -165, tint: [1, 0.92, 0.66] },
  { name: 'Teal', hue: -35, tint: [0.7, 1, 0.96] },
  { name: 'Pink', hue: 115, tint: [1, 0.74, 0.9] },
  { name: 'Orange', hue: 178, tint: [1, 0.82, 0.62] },
  { name: 'Indigo', hue: 30, tint: [0.76, 0.76, 1] },
  { name: 'Lime', hue: -125, tint: [0.86, 1, 0.66] },
];

const variants = new Map(); // colour index -> sheet

// The spectre's sheet in colour k (the drawing's own sheet for the first, blue).
export function spectreSheet(base, k) {
  const c = SPECTRE_COLORS[k % SPECTRE_COLORS.length];
  if (!c.hue) return base;
  // (`hue`: how far its glow's colour is turned, for the light it gives: npc.js)
  if (!variants.has(k)) variants.set(k, { ...base, hue: c.hue, color: recolor(base.color, c.hue), glow: recolor(base.glow, c.hue) });
  return variants.get(k);
}

// A copy of the canvas with its blues (hue 160–260°, not the greys) turned by `deg` degrees.
function recolor(canvas, deg) {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const g = out.getContext('2d');
  g.drawImage(canvas, 0, 0);
  const img = g.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [h, s, l] = toHsl(d[i], d[i + 1], d[i + 2]);
    if (s < 0.06 || h < 160 || h > 260) continue;
    const [r, gg, b] = toRgb((h + deg + 360) % 360, s, l);
    d[i] = r;
    d[i + 1] = gg;
    d[i + 2] = b;
  }
  g.putImageData(img, 0, 0);
  return out;
}

function toHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function toRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
