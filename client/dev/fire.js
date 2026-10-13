import { loadFireArt } from '../js/fire.js';

// ?scale=6 — dev viewer for the braziers' and candles' fire (client/js/fire.js).
const scale = Number(new URLSearchParams(location.search).get('scale') || 6);
const art = await loadFireArt();
const sheets = [
  ...art.brazier.map((s, i) => [`brazier ${i + 1}`, s]),
  ...art.candle.map((s, i) => [`candle${i ? ' (mirrored)' : ''}`, s]),
];
const players = [];
for (const [name, s] of sheets) {
  const box = document.createElement('div');
  box.className = 'anim';
  const label = document.createElement('span');
  label.textContent = `${name} · ${s.frames} frames at ${s.fps} fps`;
  const k = name.startsWith('candle') ? scale * 2 : scale;
  const c = document.createElement('canvas');
  c.width = s.w * k;
  c.height = s.h * k;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  box.append(label, c);
  document.getElementById('anims').append(box);
  players.push({ s, ctx, k, i: -1 });
  const strip = document.createElement('canvas');
  strip.width = s.canvas.width * 3;
  strip.height = s.h * 3;
  const sc = strip.getContext('2d');
  sc.imageSmoothingEnabled = false;
  sc.drawImage(s.canvas, 0, 0, strip.width, strip.height);
  document.getElementById('strips').append(strip);
}
const start = performance.now();
function tick(now) {
  for (const p of players) {
    const i = Math.floor(((now - start) / 1000) * p.s.fps) % p.s.frames;
    if (i === p.i) continue;
    p.i = i;
    p.ctx.clearRect(0, 0, p.ctx.canvas.width, p.ctx.canvas.height);
    p.ctx.drawImage(p.s.canvas, i * p.s.w, 0, p.s.w, p.s.h, 0, 0, p.s.w * p.k, p.s.h * p.k);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
