import { makeLook, spiritLook, baseLook, buildAtlas, buildIcon, ICON_NAMES, buildRaven, FRAME, COLS } from '../js/sprites.js';

// ?scale=6&frames=0-7&looks=0,1  — dev-only viewer for the procedural sprites.
const q = new URLSearchParams(location.search);
const scale = Number(q.get('scale') || 5);
const [f0, f1] = (q.get('frames') || '0-31').split('-').map(Number);
const root = document.getElementById('root');
const looks = [baseLook('bald'), baseLook('short')];
const seen = new Set();
for (let i = 0; seen.size < 8 && i < 200; i++) {
  const l = makeLook(`b${i.toString(16).padStart(11, '0')}`, `Project${i}`, ['opus', 'sonnet', 'haiku', 'fable'][i % 4]);
  if (!seen.has(l.cls)) { seen.add(l.cls); looks.push(l); }
}
looks.push(spiritLook());
const pick = q.get('looks') ? q.get('looks').split(',').map(Number) : looks.map((_, i) => i);
for (const li of pick) {
  const L = looks[li];
  const a = buildAtlas(L);
  const row = document.createElement('div');
  row.className = 'row';
  for (let f = f0; f <= f1; f++) {
    const c = document.createElement('canvas');
    c.width = FRAME * scale; c.height = FRAME * scale;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#3a3742';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(a.color, (f % COLS) * FRAME, Math.floor(f / COLS) * FRAME, FRAME, FRAME, 0, 0, c.width, c.height);
    row.append(c);
  }
  const label = document.createElement('div');
  label.textContent = `${li}: ${L.cls}`;
  root.append(label, row);
}
if (q.has('icons')) {
  const row = document.createElement('div');
  row.className = 'row';
  for (const n of ICON_NAMES) {
    const c = buildIcon(n);
    const big = document.createElement('canvas');
    big.width = 16 * scale; big.height = 16 * scale;
    const ctx = big.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, 0, 0, big.width, big.height);
    row.append(big);
  }
  const r = buildRaven();
  const rb = document.createElement('canvas');
  rb.width = 24 * scale; rb.height = 8 * scale;
  const rctx = rb.getContext('2d');
  rctx.imageSmoothingEnabled = false;
  rctx.fillStyle = '#556';
  rctx.fillRect(0, 0, rb.width, rb.height);
  rctx.drawImage(r, 0, 0, rb.width, rb.height);
  row.append(rb);
  root.append(row);
}
