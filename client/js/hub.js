// Roundtable Hold: the round island at the centre of the world. A great Site of Grace, a
// round table where idle Tarnished from every project sit and talk, braziers and candles burning
// with pixel-art fire (fire.js), a broken colonnade, and a banner for each project's region.

import * as THREE from 'three';
import { HUB, HUB_LAYOUT } from './config.js';
import * as T from './textures.js';
import { rng, ramp, hashStr } from './pixel.js';
import { Builder, BRICK_TILE, scaleCylUV } from './build.js';
import { Flame } from './fire.js';

const HUB_FLOOR = {
  stone: ['#403b38', '#47423e', '#3c3734', '#4d4742', '#433e3a'],
  dirt: ['#2b2622', '#2f2925', '#27221f'],
  moss: ['#3a3628', '#433e2d', '#353024'],
  tuft: ['#5a5236', '#4a4430'],
};

export class Hub extends Builder {
  constructor(world) {
    super(world, 0, 0);
    this.name = 'Roundtable Hold';
    this.subtitle = 'Where the Tarnished gather';
    this.mat = world.matsFor('ashen');
    this.seats = HUB_LAYOUT.seats.map(() => null);
    this.banners = [];
    this.bannerProjects = [];
    this.build();
    this.mergeStatic();
  }

  contains(x, z) {
    return x * x + z * z <= (HUB.radius + 0.5) ** 2;
  }

  walkRect() {
    const r = HUB.walkRadius - 1.5;
    return { minX: -r, maxX: r, minZ: -r * 0.8, maxZ: r * 0.8 };
  }

  build() {
    const R = HUB.radius;
    const floorTex = T.pixelTexture(T.floorCanvas(R * 2, R * 2, (cx, cz) => {
      const d = Math.hypot(cx - R, cz - R);
      return d < R - 1.2 ? 1.2 : 0.4 + Math.sin(cx * 2.1 + cz) * 0.2;
    }, HUB_FLOOR, 4242));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshLambertMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.add(floor);
    const rock = this.mat.rockTex.clone();
    rock.repeat.set(30, 13);
    rock.needsUpdate = true;
    const cliff = new THREE.Mesh(new THREE.CylinderGeometry(R, R - 1.5, 26, 40, 1, true), new THREE.MeshLambertMaterial({ map: rock }));
    cliff.position.y = -13;
    this.add(cliff);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(R - 0.1, 0.22, 4, 48), this.mat.stoneMoss);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = -0.05;
    this.add(lip);

    // the round table on its rug
    const [tx, tz] = HUB_LAYOUT.table;
    const rug = new THREE.Mesh(new THREE.CircleGeometry(3.9, 40), new THREE.MeshLambertMaterial({ map: this.world.tex.rugRound }));
    rug.rotation.x = -Math.PI / 2;
    rug.scale.set(1, 0.78, 1);
    rug.position.set(tx, 0.012, tz);
    rug.receiveShadow = true;
    this.add(rug);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.16, 28), this.world.mat.wood);
    top.position.set(tx, 0.92, tz);
    top.castShadow = true;
    top.receiveShadow = true;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.75, 0.86, 10), this.mat.stone);
    foot.position.set(tx, 0.43, tz);
    foot.castShadow = true;
    this.add(top, foot);
    this.blockCircle(tx, tz, 2.15);
    this.tableCandles = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = tx + Math.cos(a) * 1.2;
      const z = tz + Math.sin(a) * 1.0;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 6), this.world.mat.wax);
      c.position.set(x, 1.13, z);
      const f = this.additiveSprite('#ffb347', 0.3, 0.9);
      f.position.set(x, 1.34, z);
      this.add(c, f);
      this.tableCandles.push(f);
    }
    this.lights = { table: this.light(tx, 2.2, tz, '#ffb070', 8, 1.4) };

    // the great grace
    const [gx, gz] = HUB_LAYOUT.grace;
    const r = rng(77);
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const s = 0.28 + r() * 0.18;
      this.box(s * 1.4, s, s, this.mat.stoneMoss, gx + Math.cos(a) * 1.0, s / 2, gz + Math.sin(a) * 0.8, { ry: r() * 3, tile: 1 });
    }
    this.blockCircle(gx, gz, 1.2);
    this.graceCore = this.additiveSprite('#ffcf6b', 1.5, 0.75);
    this.graceCore.position.set(gx, 0.7, gz);
    this.graceHalo = this.additiveSprite('#ffb347', 5, 0.2);
    this.graceHalo.position.set(gx, 1.0, gz);
    this.gracePillar = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), new THREE.MeshBasicMaterial({
      map: this.world.tex.pillar, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.2, 0.9, 0.5),
    }));
    this.gracePillar.position.set(gx, 2.5, gz);
    this.add(this.graceCore, this.graceHalo, this.gracePillar);
    this.lights.grace = this.light(gx, 2.4, gz, '#ffb347', 14, 1.2);
    this.ambient(10, () => ({
      pos: [gx, 0.4, gz], spread: [0.5, 0.1, 0.4], vel: [0, 0.8, 0], velSpread: [0.2, 0.3, 0.2],
      color: ['#ffd27a', '#ffe7a8', '#ffb347'], size: 0.06, life: 2.8, drag: 0.4, intensity: 1.3,
    }));

    // broken colonnade, open toward the bridges and the viewer
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const deg = ((a * 180) / Math.PI) % 360;
      // open to the bridges east and west, and north to the Arena of Trials
      const nearBridge = Math.abs(deg - 0) < 16 || Math.abs(deg - 360) < 16 || Math.abs(deg - 180) < 16 || Math.abs(deg - 270) < 16;
      const front = deg > 50 && deg < 130;
      if (nearBridge || front) continue;
      const x = Math.cos(a) * (R - 1.2);
      const z = Math.sin(a) * (R - 1.2) * 0.92;
      const broken = r() < 0.35;
      const h = broken ? 1.2 + r() * 1.6 : 5.2 + r() * 1.2;
      const col = new THREE.Mesh(scaleCylUV(new THREE.CylinderGeometry(0.42, 0.5, h, 8), 0.45, h, BRICK_TILE), this.mat.stoneMoss);
      col.position.set(x, h / 2, z);
      col.castShadow = true;
      col.receiveShadow = true;
      this.add(col);
      if (!broken) this.box(1.2, 0.35, 1.2, this.mat.stone, x, h + 0.17, z, { tile: 1 });
      else this.box(0.6, 0.3, 0.5, this.mat.stone, x + 0.6, 0.15, z + 0.3, { ry: r() * 3, tile: 1 });
      this.blockCircle(x, z, 0.65);
    }

    // braziers
    this.braziers = [];
    for (const a of [-0.55, -2.6, 0.55, 2.6]) {
      const x = Math.cos(a) * 6.6;
      const z = Math.sin(a) * 5.4;
      for (let k = 0; k < 3; k++) {
        const la = (k / 3) * Math.PI * 2;
        this.box(0.08, 1.1, 0.08, this.world.mat.iron, x + Math.cos(la) * 0.25, 0.5, z + Math.sin(la) * 0.25, { tile: 1, rx: Math.sin(la) * 0.2, rz: -Math.cos(la) * 0.2 });
      }
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.32, 10), this.world.mat.iron);
      bowl.position.set(x, 1.15, z);
      bowl.castShadow = true;
      this.add(bowl);
      const fire = this.additiveSprite('#ff8a2a', 1.1, 0.95);
      fire.position.set(x, 1.6, z);
      this.add(fire);
      this.blockCircle(x, z, 0.55);
      const light = this.light(x, 1.9, z, '#ff8a3a', 9, 1.5);
      this.braziers.push({ fire, light, phase: a * 5, x, z, flame: null });
      this.ambient(3, () => ({
        pos: [x, 1.5, z], spread: [0.2, 0.05, 0.2], vel: [0, 1.1, 0], velSpread: [0.25, 0.4, 0.25],
        color: ['#ff9a3a', '#ffd27a', '#ff6a2a'], size: 0.06, life: 1.4, flicker: 1, intensity: 1.7,
      }));
    }
  }

  // The user's pixel-art flames take the place of the plain glows: a rigged fire in each brazier
  // (each from a different frame of the sheet) and a flame on each candle. The glows stay on,
  // dimmer and wider, as the light around them; `art` comes from fire.js loadFireArt().
  lightFires(art) {
    if (!art || this.candleFlames) return;
    this.braziers.forEach((b, i) => {
      b.flame = new Flame(art.brazier[i % art.brazier.length]);
      b.flame.mesh.position.set(b.x, 1.17, b.z);
      this.add(b.flame.mesh);
      b.fire.position.y = 1.6;
    });
    this.candleFlames = this.tableCandles.map((glow, i) => {
      const flame = new Flame(art.candle[i % art.candle.length], { brightness: 1.05 });
      flame.mesh.position.set(glow.position.x, 1.25, glow.position.z);
      this.add(flame.mesh);
      // the halo sits just behind its flame, so it glows around it without washing out the wick
      glow.position.y = 1.38;
      glow.position.z -= 0.06;
      return flame;
    });
  }

  // One tall banner per project, arranged in an arc behind the round table.
  setBanners(projects) {
    const key = projects.join('|');
    if (key === this.bannerProjects.join('|')) return;
    this.bannerProjects = projects.slice();
    for (const b of this.banners) {
      this.group.remove(b.root);
      b.mesh.material.map?.dispose();
    }
    this.banners = [];
    const n = projects.length;
    projects.forEach((p, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const a = -Math.PI * (0.18 + t * 0.64);
      const x = Math.cos(a) * 8.2;
      const z = Math.sin(a) * 6.6;
      const root = new THREE.Group();
      root.position.set(x, 0, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.6, 6), this.world.mat.wood);
      pole.position.y = 2.3;
      pole.castShadow = true;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.08), this.world.mat.wood);
      bar.position.y = 4.4;
      const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), this.world.mat.gold);
      finial.position.y = 4.75;
      const hue = hashStr(`proj:${p}`) % 360;
      const tex = T.pixelTexture(T.bannerCanvas(ramp(hue, 0.42, 0.09, 0.44), hashStr(p) % 4));
      const b = this.bannerMesh(tex, i * 1.3);
      b.mesh.position.set(0, 4.36, 0.06);
      root.add(pole, bar, finial, b.mesh);
      this.group.add(root);
      b.root = root;
      b.project = p;
      this.banners.push(b);
    });
  }

  reserveSeat(npc) {
    let idx = this.seats.indexOf(npc);
    if (idx < 0) {
      const free = this.seats.map((s, i) => (s ? -1 : i)).filter((i) => i >= 0);
      if (!free.length) return null;
      idx = free[Math.floor(Math.random() * free.length)];
      this.seats[idx] = npc;
    }
    const [x, z, face] = HUB_LAYOUT.seats[idx];
    return { station: 'seat', index: idx, x, z, face, hub: true };
  }

  releaseSeat(npc) {
    const idx = this.seats.indexOf(npc);
    if (idx >= 0) this.seats[idx] = null;
  }

  update(dt, t, grace = 0) {
    const flick = (ph, sp = 9) => 0.85 + 0.1 * Math.sin(t * sp + ph) + 0.05 * Math.sin(t * 23 + ph * 2);
    const gp = 0.92 + 0.08 * Math.sin(t * 1.7);
    this.lights.grace.intensity = (11 + grace * 4) * gp;
    let candles = flick(5, 8);
    if (this.candleFlames) {
      candles = 0;
      this.candleFlames.forEach((f, i) => {
        const e = f.step(dt);
        candles += (0.8 + 0.2 * e) / this.candleFlames.length;
        this.tableCandles[i].scale.setScalar(0.43 * (0.85 + 0.15 * e));
        this.tableCandles[i].material.opacity = 0.2;
      });
    } else {
      this.tableCandles.forEach((c, i) => c.scale.setScalar(0.28 * flick(i * 3, 13)));
    }
    this.lights.table.intensity = 6 * candles;
    this.graceCore.material.opacity = 0.7 * gp;
    this.graceHalo.material.opacity = 0.18 * gp;
    this.gracePillar.material.opacity = 0.55 + 0.25 * Math.sin(t * 1.1);
    for (const b of this.braziers) {
      // the light rises and falls with how much fire the flame's frame holds
      let f = flick(b.phase, 10);
      if (b.flame) {
        b.level = (b.level ?? 1) + (0.75 + 0.3 * b.flame.step(dt) - (b.level ?? 1)) * Math.min(1, dt * 12);
        f = b.level;
      }
      b.light.intensity = 10 * f;
      if (b.flame) {
        b.fire.scale.set(2.15 * f, 1.95 * f, 1);
        b.fire.material.opacity = 0.3;
      } else {
        b.fire.scale.set(0.9 * f, 1.15 * f, 1);
      }
    }
    if (this.near) for (const b of this.banners) this.swayBanner(b, t);
  }
}
