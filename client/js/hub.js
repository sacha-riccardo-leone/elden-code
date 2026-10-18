// Roundtable Hold: the round island at the centre of the world. A round table where idle
// Tarnished from every project sit and talk, a ring of weapons planted in it (weapons.js) about
// the great Site of Grace floating at its heart, braziers and candles burning
// with pixel-art fire (fire.js), a broken colonnade, and a banner for each project's region.

import * as THREE from 'three';
import { HUB, HUB_LAYOUT } from './config.js';
import * as T from './textures.js';
import { rng, ramp, hashStr } from './pixel.js';
import { Builder, BRICK_TILE, scaleCylUV, seedOf } from './build.js';
import { Flame } from './fire.js';
import { plantedWeapons } from './weapons.js';
import { GraceFigure } from './grace.js';
import { YARD } from './yard.js';

// The project banners at the Round Table: how far below the floor a new one's pole starts, and
// how long it takes to rise and then for its flag to unfurl (seconds).
const BANNER = { sink: 4.9, rise: 1.0, unfurl: 0.8 };

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
    // (open to the south where the stair runs down to the training yard, yard.js)
    const gap = Math.asin((YARD.stairHalf + 0.4) / (R - 0.1));
    const rim = new THREE.TorusGeometry(R - 0.1, 0.22, 4, 46, Math.PI * 2 - gap * 2);
    rim.rotateZ(Math.PI / 2 + gap);
    const lip = new THREE.Mesh(rim, this.mat.stoneMoss);
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
    // at its heart a dark inlaid disc, ringed in bronze, and round it a ring of weapons driven into
    // the wood, each its own kind, at its own angle
    const TOP = 1.0;
    const inlay = new THREE.Mesh(new THREE.CircleGeometry(1.05, 32), new THREE.MeshLambertMaterial({ color: '#2b2620' }));
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.set(tx, TOP + 0.004, tz);
    const band = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.13, 40), new THREE.MeshLambertMaterial({ color: '#7a6034' }));
    band.rotation.x = -Math.PI / 2;
    band.position.set(tx, TOP + 0.006, tz);
    this.add(inlay, band, plantedWeapons(tx, tz, TOP, 1.05, rng(41)));
    this.tableCandles = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const x = tx + Math.cos(a) * 1.68;
      const z = tz + Math.sin(a) * 1.55;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 6), this.world.mat.wax);
      c.position.set(x, 1.13, z);
      const f = this.additiveSprite('#ffb347', 0.3, 0.9);
      f.position.set(x, 1.34, z);
      this.add(c, f);
      this.tableCandles.push(f);
    }
    this.lights = { table: this.light(tx, 2.2, tz, '#ffb070', 8, 1.4) };

    // the great grace, larger than any island's, floating over the heart of the table amid the
    // ring of weapons, a pillar of golden light rising from it (arrivals by grace still appear
    // behind the table, at HUB_LAYOUT.grace)
    const r = rng(77);
    for (let i = 0; i < 22; i++) r(); // (the colonnade's columns break where they always have)
    const GY = 1.75;
    this.graceCore = this.additiveSprite('#ffcf6b', 1.5, 0.75);
    this.graceCore.position.set(tx, GY, tz);
    this.graceHalo = this.additiveSprite('#ffb347', 4.6, 0.2);
    this.graceHalo.position.set(tx, GY + 0.2, tz);
    this.gracePillar = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 7.5), new THREE.MeshBasicMaterial({
      map: this.world.tex.pillar, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.25, 0.95, 0.5),
    }));
    this.gracePillar.position.set(tx, TOP + 3.75, tz);
    this.add(this.graceCore, this.graceHalo, this.gracePillar);
    // and over it the grace itself, a figure of golden light far larger than any island's
    this.graceFigure = new GraceFigure(this.group, tx, GY + 1.25, tz, 3.0);
    this.lights.grace = this.light(tx, 2.6, tz, '#ffb347', 14, 1.2);
    this.ambient(12, () => (this.lit(seedOf(0, 20)) < 0.3 ? null : {
      pos: [tx, GY - 0.4, tz], spread: [0.35, 0.3, 0.3], vel: [0, 0.9, 0], velSpread: [0.25, 0.35, 0.25],
      color: ['#ffd27a', '#ffe7a8', '#ffb347'], size: 0.06, life: 3, drag: 0.4, intensity: 1.4,
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
      const i = this.braziers.length;
      this.braziers.push({ fire, light, phase: a * 5, x, z, flame: null });
      this.ambient(3, () => (this.lit(seedOf(0, 30 + i)) < 0.3 ? null : {
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

  // One tall banner per project whose island has risen (director.js), in an arc behind the round
  // table. A new one grows in: its wooden pole and crossbar rise out of the ground, then the flag
  // unfurls down from the bar. One whose island sinks rolls up and goes back into the ground, and
  // the others close up or spread out to keep the arc even.
  setBanners(projects) {
    const key = projects.join('|');
    if (key === this.bannerProjects.join('|')) return;
    this.bannerProjects = projects.slice();
    const n = projects.length;
    projects.forEach((p, i) => {
      let b = this.banners.find((x) => x.project === p && !x.leaving);
      const t = n === 1 ? 0.5 : i / (n - 1);
      const a = -Math.PI * (0.18 + t * 0.64);
      const at = [Math.cos(a) * 8.2, Math.sin(a) * 6.6];
      if (!b) {
        b = this.makeBanner(p, i);
        b.root.position.set(at[0], -BANNER.sink, at[1]);
        this.banners.push(b);
      }
      b.at = at;
    });
    for (const b of this.banners) if (!projects.includes(b.project)) b.leaving = true;
  }

  makeBanner(project, i) {
    const root = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.6, 6), this.world.mat.wood);
    pole.position.y = 2.3;
    pole.castShadow = true;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.08), this.world.mat.wood);
    bar.position.y = 4.4;
    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), this.world.mat.gold);
    finial.position.y = 4.75;
    const hue = hashStr(`proj:${project}`) % 360;
    const tex = T.pixelTexture(T.bannerCanvas(ramp(hue, 0.42, 0.09, 0.44), hashStr(project) % 4));
    const b = this.bannerMesh(tex, i * 1.3);
    b.mesh.position.set(0, 4.36, 0.06);
    b.mesh.scale.set(0.3, 0.01, 1);
    b.mesh.visible = false;
    root.add(pole, bar, finial, b.mesh);
    this.group.add(root);
    return Object.assign(b, { root, project, age: 0, at: [0, 0], leaving: false, dust: false });
  }

  // Each banner growing in (or going), and sliding to its place in the arc.
  stepBanners(dt) {
    this.banners = this.banners.filter((b) => {
      b.age = b.leaving ? Math.min(b.age, BANNER.rise + BANNER.unfurl) - dt * 1.5 : b.age + dt;
      if (b.leaving && b.age <= 0) {
        this.group.remove(b.root);
        b.mesh.material.map?.dispose();
        b.mesh.material.dispose();
        b.root.traverse((o) => o.geometry?.dispose()); // (its wood and gold are everyone's)
        return false;
      }
      const up = Math.max(0, Math.min(1, b.age / BANNER.rise));
      const rolled = Math.max(0, Math.min(1, (b.age - BANNER.rise) / BANNER.unfurl));
      const p = b.root.position;
      p.y = -BANNER.sink * (1 - up) ** 3;
      p.x += (b.at[0] - p.x) * Math.min(1, dt * 2.5);
      p.z += (b.at[1] - p.z) * Math.min(1, dt * 2.5);
      b.mesh.visible = rolled > 0.01;
      b.mesh.scale.set(0.3 + 0.7 * rolled, Math.max(0.01, rolled), 1);
      // the ground breaks as it comes up
      if (!b.dust && !b.leaving && b.age > 0.02 && this.near) {
        b.dust = true;
        this.world.particles.emit({
          pos: [p.x, 0.1, p.z], spread: [0.35, 0.05, 0.35], vel: [0, 1.4, 0], velSpread: [0.9, 0.6, 0.9],
          color: ['#6a625a', '#8a8278', '#4a443e'], size: 0.08, life: 1.1, count: 22, drag: 1.2, intensity: 0.7,
        });
      }
      return true;
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
    // while a great enemy is abroad the Hold's fires and its grace go out, each at its own moment
    // (Builder.lit), the flames sinking into their bowls and wicks
    const lg = this.lit(seedOf(0, 20));
    this.lights.grace.intensity = (11 + grace * 4) * gp * lg;
    let candles = 0;
    this.tableCandles.forEach((glow, i) => {
      const lc = this.lit(seedOf(0, 10 + i));
      if (this.candleFlames) {
        const f = this.candleFlames[i];
        const e = f.step(dt);
        candles += ((0.8 + 0.2 * e) * lc) / this.tableCandles.length;
        f.mesh.scale.setScalar(lc);
        f.mesh.visible = lc > 0.02;
        glow.scale.setScalar(0.43 * (0.85 + 0.15 * e));
        glow.material.opacity = 0.2 * lc;
      } else {
        candles += (flick(5, 8) * lc) / this.tableCandles.length;
        glow.scale.setScalar(0.28 * flick(i * 3, 13) * lc);
      }
    });
    this.lights.table.intensity = 6 * candles;
    this.graceCore.material.opacity = 0.62 * gp * lg;
    this.graceHalo.material.opacity = 0.12 * gp * lg;
    this.gracePillar.material.opacity = (0.4 + 0.18 * Math.sin(t * 1.1)) * lg; // (soft, not to drown the figure in it)
    this.graceFigure.update(dt, gp * lg);
    this.braziers.forEach((b, i) => {
      const lb = this.lit(seedOf(0, 30 + i));
      this.smoke(b, lb, b.x, 1.5, b.z);
      // the light rises and falls with how much fire the flame's frame holds
      let f = flick(b.phase, 10);
      if (b.flame) {
        b.level = (b.level ?? 1) + (0.75 + 0.3 * b.flame.step(dt) - (b.level ?? 1)) * Math.min(1, dt * 12);
        f = b.level;
      }
      b.light.intensity = 10 * f * lb;
      if (b.flame) {
        b.fire.scale.set(2.15 * f, 1.95 * f, 1);
        b.fire.material.opacity = 0.3 * lb;
        b.flame.mesh.scale.setScalar(lb);
        b.flame.mesh.visible = lb > 0.02;
      } else {
        b.fire.scale.set(0.9 * f * lb, 1.15 * f * lb, 1);
      }
    });
    this.stepBanners(dt);
    if (this.near) for (const b of this.banners) this.swayBanner(b, t);
  }
}
