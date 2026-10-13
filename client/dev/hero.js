import { HEROES } from '../js/heroes/index.js';
import { loadSheet } from '../js/heroes/core.js';

// ?hero=knight&scale=3&only=walk,strike — dev viewer for the rigged heroes.
const q = new URLSearchParams(location.search);
const rig = HEROES.find((h) => h.id === (q.get('hero') || HEROES[0].id)) || HEROES[0];
const scale = Number(q.get('scale') || 2);
const only = q.get('only') ? q.get('only').split(',') : null;

document.querySelector('.dev-title').textContent = `${rig.firstName || ''} ${rig.epithet} — animations`.trim();
const sheet = await loadSheet(rig);
const root = document.getElementById('anims');
const players = [];
for (const [name, frames] of Object.entries(rig.groups)) {
  if (only && !only.includes(name)) continue;
  const box = document.createElement('div');
  box.className = 'anim';
  const label = document.createElement('span');
  label.textContent = `${name} (${frames.length})`;
  const c = document.createElement('canvas');
  c.width = sheet.frameW * scale;
  c.height = sheet.frameH * scale;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  box.append(label, c);
  root.append(box);
  players.push({ name, frames, ctx, i: -1 });
}
const draw = (p, i) => {
  const f = p.frames[i];
  p.ctx.clearRect(0, 0, p.ctx.canvas.width, p.ctx.canvas.height);
  p.ctx.drawImage(sheet.color, (f % sheet.cols) * sheet.frameW, Math.floor(f / sheet.cols) * sheet.frameH,
    sheet.frameW, sheet.frameH, 0, 0, sheet.frameW * scale, sheet.frameH * scale);
};
const start = performance.now();
function tick(now) {
  for (const p of players) {
    const i = Math.floor(((now - start) / 1000) * (rig.groupFps[p.name] || 4)) % p.frames.length;
    if (i !== p.i) { p.i = i; draw(p, i); }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

document.getElementById('sheet').append(sheet.color);
const dl = document.getElementById('download');
const dlg = document.getElementById('download-glow');
dl.download = `${rig.id}-sheet.png`;
dlg.download = `${rig.id}-glow.png`;
sheet.color.toBlob((b) => { dl.href = URL.createObjectURL(b); });
sheet.glow.toBlob((b) => { dlg.href = URL.createObjectURL(b); });

// Dev helper: a static strip of chosen frames, cropped around the hero.
window.showCrop = (name, idxs = null, s = 2.6, x0 = 44, w = 100, y0 = 40, h = 100) => {
  const frames = rig.groups[name];
  const sel = idxs ? idxs.map((i) => frames[i]) : frames;
  root.innerHTML = '';
  const c = document.createElement('canvas');
  const fw = Math.round(w * s);
  const fh = Math.round(h * s);
  c.width = fw * sel.length + (sel.length - 1) * 6;
  c.height = fh;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#3a3742';
  ctx.fillRect(0, 0, c.width, c.height);
  sel.forEach((f, i) => {
    ctx.drawImage(sheet.color, (f % sheet.cols) * sheet.frameW + x0, Math.floor(f / sheet.cols) * sheet.frameH + y0, w, h, i * (fw + 6), 0, fw, fh);
  });
  root.append(c);
  return sel;
};
window.heroDev = { rig, sheet, players, draw };
