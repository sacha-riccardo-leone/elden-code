// The grace itself (the user's drawing, assets/fx/grace-core.png): a figure of golden light,
// almost human, floating above every Site of Grace's light: each island's, and a far larger one
// over the Round Table (hub.js, region.js). It rises and sinks slowly, breathing; the motes of light
// drawn about it drift round it, each on its own slow orbit, twinkling, with a few more like them.

import * as THREE from 'three';

const IMG = '/assets/fx/grace-core.png';
// in the 100x100 drawing: the figure's centre and height (its bright core, y 18 to 80, inside the
// soft glow that fills most of the drawing), and the motes of light drawn about it
const CENTRE = { x: 49.5, y: 49 };
const FIGURE_H = 62;
const MOTES = [[39, 4.3], [77.9, 17], [21.2, 37.9], [76, 65], [22, 94.1]];
const MOTE_R = 4.5; // each a little cross of light this many pixels across from its centre
const MOTE_SCALE = 1.6; // drawn larger than in the drawing, to be seen from where the camera stands
const DENSER = 0.8; // the figure's light made a little denser (alpha to this power)
const EXTRA = 3; // motes added to the drawn ones

let loading = null;

function texture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.shared = true; // every grace's (never freed with one island)
  return t;
}

const canvasOf = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

// The drawing pulled apart: the figure in its glow with the motes taken out (each filled with the
// glow around it), and one mote on its own (the glow behind it taken away, faded at the edge).
function pullApart(img) {
  const W = img.width;
  const H = img.height;
  const whole = canvasOf(W, H);
  const g = whole.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, W, H);
  const d = data.data;
  const at = (x, y) => (y * W + x) * 4;
  // the glow round a mote: the mean of a ring just outside it
  const around = (cx, cy) => {
    const sum = [0, 0, 0, 0];
    let n = 0;
    for (let y = Math.floor(cy - MOTE_R - 2); y <= cy + MOTE_R + 2; y++) {
      for (let x = Math.floor(cx - MOTE_R - 2); x <= cx + MOTE_R + 2; x++) {
        const r = Math.hypot(x - cx, y - cy);
        if (r < MOTE_R + 0.5 || r > MOTE_R + 2 || x < 0 || y < 0 || x >= W || y >= H) continue;
        for (let k = 0; k < 4; k++) sum[k] += d[at(x, y) + k];
        n++;
      }
    }
    return sum.map((v) => (n ? v / n : 0));
  };
  // the mote, from the clearest of them
  const [mx, my] = MOTES[1];
  const bg = around(mx, my);
  const size = Math.ceil(MOTE_R * 2 + 2);
  const mote = canvasOf(size, size);
  const mg = mote.getContext('2d');
  const md = mg.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.round(mx - size / 2 + x);
      const sy = Math.round(my - size / 2 + y);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const i = at(sx, sy);
      const r = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2);
      const edge = Math.max(0, Math.min(1, (MOTE_R + 0.5 - r) / 1.5));
      const o = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) md.data[o + k] = d[i + k];
      md.data[o + 3] = Math.max(0, d[i + 3] - bg[3]) * (255 / (255 - bg[3])) * edge;
    }
  }
  mg.putImageData(md, 0, 0);
  // the figure, the motes filled in, its light a little denser
  for (const [cx, cy] of MOTES) {
    const fill = around(cx, cy);
    for (let y = Math.floor(cy - MOTE_R - 1); y <= cy + MOTE_R + 1; y++) {
      for (let x = Math.floor(cx - MOTE_R - 1); x <= cx + MOTE_R + 1; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H || Math.hypot(x - cx, y - cy) > MOTE_R + 0.5) continue;
        for (let k = 0; k < 4; k++) d[at(x, y) + k] = fill[k];
      }
    }
  }
  for (let i = 3; i < d.length; i += 4) d[i] = 255 * (d[i] / 255) ** DENSER;
  g.putImageData(data, 0, 0);
  return { figure: texture(whole), mote: texture(mote), w: W, h: H, moteSize: size };
}

function loadArt() {
  loading ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(pullApart(img));
    img.onerror = () => resolve(null); // no figure then; the graces keep their light
    img.src = IMG;
  });
  return loading;
}

// drawn as it was drawn (normal blending: light added onto a bright sky by day would vanish into it),
// at its own brightness whatever the hour
const glow = (map) => new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });

export class GraceFigure {
  // Floating at (x, y, z) in `parent` (an island's group, or the Hold's), `height` world units tall.
  constructor(parent, x, y, z, height) {
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);
    parent.add(this.group);
    this.height = height;
    this.t = Math.random() * 20;
    this.figure = null;
    this.motes = [];
    loadArt().then((a) => { if (a && !this.gone) this.dress(a); });
  }

  dress(a) {
    const unit = this.height / FIGURE_H; // world units per pixel of the drawing
    this.size = [a.w * unit, a.h * unit];
    this.figure = new THREE.Sprite(glow(a.figure));
    this.figure.center.set(CENTRE.x / a.w, 1 - CENTRE.y / a.h);
    this.figure.scale.set(a.w * unit, a.h * unit, 1);
    this.figure.renderOrder = 8;
    this.group.add(this.figure);
    // the drawn motes keep their places about the figure, now each turning slowly round it
    const at = MOTES.map(([x, y]) => [(x - CENTRE.x) * unit, (CENTRE.y - y) * unit]);
    for (let i = 0; i < EXTRA; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = this.height * (0.35 + Math.random() * 0.25);
      at.push([Math.cos(ang) * r * 0.8, Math.sin(ang) * r]);
    }
    this.motes = at.map(([dx, dy], i) => {
      const s = new THREE.Sprite(glow(a.mote));
      s.renderOrder = 8;
      this.group.add(s);
      return {
        sprite: s,
        angle: Math.atan2(dy, dx / 0.8),
        radius: Math.hypot(dx / 0.8, dy),
        speed: (i % 2 ? 1 : -1) * (0.12 + Math.random() * 0.18),
        phase: Math.random() * Math.PI * 2,
        rate: 1.2 + Math.random() * 1.6,
        size: a.moteSize * unit * MOTE_SCALE * (0.8 + Math.random() * 0.5),
      };
    });
  }

  // `light`: how bright the grace burns just now (its own pulse, 0..1+)
  update(dt, light = 1) {
    if (!this.figure) return;
    this.t += dt;
    const t = this.t;
    const h = this.height;
    // rising and sinking slowly, and breathing
    const bob = Math.sin(t * 0.8) * 0.07 * h;
    this.figure.position.y = bob;
    const breath = 1 + 0.03 * Math.sin(t * 1.6);
    this.figure.scale.set(this.size[0] * (2 - breath), this.size[1] * breath, 1);
    this.figure.material.opacity = (0.82 + 0.18 * Math.sin(t * 1.25)) * light;
    // the motes turn about it, drawing nearer and further, twinkling
    for (const m of this.motes) {
      m.angle += m.speed * dt;
      const r = m.radius * (1 + 0.12 * Math.sin(t * 0.6 + m.phase));
      m.sprite.position.set(Math.cos(m.angle) * r * 0.8, bob * 0.6 + Math.sin(m.angle) * r, Math.sin(m.angle * 2 + m.phase) * 0.08 * h);
      const tw = (0.5 + 0.5 * Math.sin(t * m.rate + m.phase)) ** 2;
      m.sprite.material.opacity = (0.25 + 0.75 * tw) * light;
      const s = m.size * (0.7 + 0.5 * tw);
      m.sprite.scale.set(s, s, 1);
    }
  }

  dispose() {
    this.gone = true;
    this.group.parent?.remove(this.group);
    for (const s of [this.figure, ...this.motes.map((m) => m.sprite)]) s?.material.dispose();
  }
}
