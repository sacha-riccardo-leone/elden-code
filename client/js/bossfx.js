// The great enemy's magic, drawn as pixel art in red light (fight.js):
//   Crescent – the swing's arc of light, flying on in the direction of the blow and fading out;
//   Spike    – the lunge's lance of light, along the blade and past its point: two ragged edges
//              (above and below the blade) closing to a point, an open rectangle with a ">" end;
//   Decal    – marks on the arena floor: the slam's ring and the light that fills it, the jump's
//              landing zone, and the crack it leaves where it lands.

import * as THREE from 'three';
import { rng } from './pixel.js';

const RED = {
  core: [255, 236, 226],
  hot: [255, 120, 96],
  red: [242, 40, 34],
  deep: [176, 12, 16],
  dark: [96, 6, 10],
};

function canvasOf(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const put = (x, y, rgb, a = 255) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    img.data.set([...rgb, a], (y * w + x) * 4);
  };
  draw(put, w, h);
  g.putImageData(img, 0, 0);
  return c;
}

function texture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// heat 0..1 → a colour of red light
const shade = (k) => (k > 0.86 ? RED.core : k > 0.62 ? RED.hot : k > 0.36 ? RED.red : k > 0.16 ? RED.deep : RED.dark);

// The crescent: a band of light along an arc, thickest in the middle, ragged at its edge.
function crescentCanvas(seed) {
  const r = rng(seed);
  return canvasOf(40, 72, (put, w, h) => {
    const cx = -18;
    const cy = h / 2;
    const R = 50;
    for (let y = 0; y < h; y++) {
      const t = (y - cy) / (h / 2 - 2); // -1 .. 1 along the arc
      if (Math.abs(t) > 1) continue;
      const thick = 9 * (1 - t * t) + 1.5 + Math.sin(y * 1.7 + r() * 0.5) * 1.2;
      const outer = cx + Math.sqrt(Math.max(0, R * R - (y - cy) ** 2));
      for (let x = Math.floor(outer - thick); x <= outer; x++) {
        const k = (x - (outer - thick)) / thick; // 0 inner edge → 1 outer edge
        put(x, y, shade(0.15 + k * 0.85 * (1 - Math.abs(t) * 0.4)));
      }
      if (r() < 0.3) put(outer + 1 + r() * 3, y, RED.deep); // sparks thrown off its edge
    }
  });
}

// The spike: two wavering edges, above and below the blade, running out past its point and
// closing there; hottest along the blade's line.
function spikeCanvas(seed) {
  const r = rng(seed);
  const ph = r() * 6;
  return canvasOf(120, 30, (put, w, h) => {
    const cy = (h - 1) / 2;
    const tip = w - 1;
    const close = w - 28; // where the edges start to close to the point
    let prev = null;
    for (let x = 0; x < w; x++) {
      const wave = Math.sin(x * 0.28 + ph) * 1.4 + Math.sin(x * 0.11 + ph * 2) * 1.1;
      let half = 10 + wave;
      if (x > close) half *= ((tip - x) / (tip - close)) ** 0.8;
      // between the edges, a thinner light, brightest along the blade; open at the back, where
      // it thickens out of the blade
      const back = Math.min(1, x / 14);
      for (let y = Math.ceil(cy - half) + 1; y < cy + half - 1; y++) {
        const k = 1 - Math.abs(y - cy) / half;
        put(x, y, shade(0.2 + k * 0.75), Math.round(255 * (0.35 + 0.5 * k) * (0.4 + 0.6 * back)));
      }
      // the two edges, above and below the blade: unbroken lines of hot light (joined to the last
      // column's, so they stay whole as they close to the point)
      for (const s of [-1, 1]) {
        const y = cy + s * half;
        const was = prev === null ? y : cy + s * prev;
        for (let yy = Math.min(y, was); yy <= Math.max(y, was); yy++) put(x, yy, RED.hot);
        put(x, y + s, RED.red);
      }
      prev = half;
      if (r() < 0.12) put(x, cy + (r() < 0.5 ? -1 : 1) * (half + 2 + r() * 3), RED.deep);
    }
  });
}

// A ring of light on the floor (or, filled, a disc), ragged and bright.
function ringCanvas(seed, filled) {
  const r = rng(seed);
  return canvasOf(96, 96, (put, w, h) => {
    const c = w / 2 - 0.5;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - c, y - c);
        const a = Math.atan2(y - c, x - c);
        const edge = 44 + Math.sin(a * 7 + seed) * 1.2 + Math.sin(a * 13) * 0.8;
        if (d > edge) continue;
        if (filled) {
          const k = 0.35 + 0.5 * (d / edge) + (r() - 0.5) * 0.12;
          put(x, y, shade(k));
        } else if (d > edge - 5) {
          put(x, y, shade(0.5 + ((d - (edge - 5)) / 5) * 0.45));
        } else if (d > edge - 13) {
          put(x, y, RED.deep, Math.round((150 * (d - (edge - 13))) / 8)); // its light, bleeding inward
        }
      }
    }
  });
}

// Where the leap will land: a broken circle and a cross of light.
function zoneCanvas() {
  return canvasOf(64, 64, (put, w, h) => {
    const c = w / 2 - 0.5;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - c, y - c);
        const a = Math.atan2(y - c, x - c);
        if (d > 28 && d < 31 && Math.floor((a + Math.PI) * 4) % 2 === 0) put(x, y, RED.red);
        else if (d <= 28) put(x, y, RED.deep, 70);
      }
    }
    for (let k = -6; k <= 6; k++) { put(c + k, c, RED.hot); put(c, c + k, RED.hot); }
  });
}

// A crack in the stone where it landed: branching fissures glowing red at their hearts.
function crackCanvas(seed) {
  const r = rng(seed);
  return canvasOf(80, 80, (put, w, h) => {
    const walk = (x, y, a, len, depth) => {
      for (let i = 0; i < len; i++) {
        a += (r() - 0.5) * 0.7;
        x += Math.cos(a);
        y += Math.sin(a);
        put(x, y, i < len * 0.5 ? RED.red : RED.dark);
        put(x + 1, y, [24, 16, 16]);
        if (depth < 2 && r() < 0.08) walk(x, y, a + (r() < 0.5 ? -1 : 1) * 0.9, len * 0.5, depth + 1);
      }
    };
    for (let k = 0; k < 7; k++) walk(w / 2, h / 2, (k / 7) * Math.PI * 2 + r() * 0.6, 22 + r() * 14, 0);
    for (let k = 0; k < 10; k++) put(w / 2 + (r() - 0.5) * 8, h / 2 + (r() - 0.5) * 8, [30, 20, 20]);
  });
}

// Light: drawn over what's behind it rather than added to it (added, it washes out to pink on the
// bright stone of day), a little past white so the bloom catches it.
const glowing = (map, opacity = 1) => new THREE.MeshBasicMaterial({
  map, transparent: true, depthWrite: false, opacity, toneMapped: false, color: new THREE.Color(1.3, 1.05, 1.05),
});

export class Crescent {
  // from (x, z) at height y, flying toward dir (±1) for `life` seconds
  constructor(scene, x, y, z, dir, { size = 4.2, speed = 15, life = 0.5 } = {}) {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * 40 / 72, size), glowing(texture(crescentCanvas(Math.random() * 1000))));
    this.mesh.scale.x = dir;
    this.mesh.position.set(x, y, z);
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);
    Object.assign(this, { scene, dir, speed, life, t: 0, x, z, hit: new Set() });
  }

  // returns false once it has faded
  step(dt) {
    this.t += dt;
    this.x += this.dir * this.speed * dt;
    this.mesh.position.x = this.x;
    this.mesh.material.opacity = Math.max(0, 1 - Math.max(0, this.t - this.life * 0.6) / (this.life * 0.4));
    return this.t < this.life;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.material.map.dispose();
    this.mesh.material.dispose();
    this.mesh.geometry.dispose();
  }
}

export class Spike {
  // along a blade at height y, starting at x and running `len` toward dir
  constructor(scene, x, y, z, dir, len) {
    const geo = new THREE.PlaneGeometry(len, len * 30 / 120);
    geo.translate(len / 2, 0, 0);
    this.mesh = new THREE.Mesh(geo, glowing(texture(spikeCanvas(Math.random() * 1000))));
    this.mesh.scale.x = dir;
    this.mesh.position.set(x, y, z + 0.05);
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);
    this.scene = scene;
    this.t = 0;
  }

  step(dt, life) {
    this.t += dt;
    const k = this.t / life;
    this.mesh.material.opacity = k < 0.15 ? k / 0.15 : Math.max(0, 1 - (k - 0.6) / 0.4);
    this.mesh.scale.y = 0.9 + 0.1 * Math.sin(this.t * 60); // it shivers
    return this.t < life;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.material.map.dispose();
    this.mesh.material.dispose();
    this.mesh.geometry.dispose();
  }
}

const DECALS = { ring: () => ringCanvas(7, false), fill: () => ringCanvas(11, true), zone: zoneCanvas, crack: () => crackCanvas(Math.random() * 1000) };

export class Decal {
  // a mark on the floor at (x, z), `size` across
  constructor(scene, kind, x, z, size, { glow = true, opacity = 1 } = {}) {
    const map = texture(DECALS[kind]());
    const mat = glow ? glowing(map, opacity) : new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity, alphaTest: 0.05 });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(x, 0.035, z);
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
    this.scene = scene;
  }

  set opacity(v) { this.mesh.material.opacity = v; }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.material.map.dispose();
    this.mesh.material.dispose();
    this.mesh.geometry.dispose();
  }
}
