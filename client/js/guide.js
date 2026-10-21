// The way to the arena. From the moment a great enemy is announced till he's beaten, wins or goes
// (fight.hunting), a golden pixel-art arrow lies on the ground before thee pointing along the
// path there: along thine island and over the bridge first, then north across the Hold. It points
// where the path goes on from just ahead (GUIDE.lookAhead), so it turns into each corner as it
// comes, and it fades once thou art on the arena (and comes back if thou leavest it mid-fight).
// In the tutorial it shows the way up the stair to its next yard, once a yard's step is done
// (tutorial.js, route).

import * as THREE from 'three';
import { GUIDE } from './config.js';
import { groundAt } from './ground.js';

// A 32x32 arrow pointing up the canvas: a broad head on a shaft, gold paling to the tip, outlined.
function arrowTexture() {
  const N = 32;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const inside = (x, y) => {
    const dx = Math.abs(x + 0.5 - N / 2);
    if (y >= 2 && y < 16) return dx <= (y - 2) * 0.82 + 0.6; // the head
    return y >= 16 && y <= 28 && dx <= 4; // the shaft
  };
  const fill = ['#fff4c8', '#ffe08a', '#ffc85a', '#f2a23a', '#d9822a'];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (inside(x, y)) {
        g.fillStyle = fill[Math.min(fill.length - 1, Math.floor(((y - 2) / 27) * fill.length))];
        g.fillRect(x, y, 1, 1);
      } else if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) {
        g.fillStyle = '#3a1c0a';
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Drawn as if GUIDE.lift nearer the camera than it lies (each point slid toward the eye along its
// own line of sight, so it stays exactly where it is on screen): low things in front of it (a
// fallen column, a crate, a step) can't hide it, while thy figure, standing well in front when it
// points away, still does.
function liftToward(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      mvPosition.xyz *= max(0.05, 1.0 - ${GUIDE.lift.toFixed(2)} / length(mvPosition.xyz));
      gl_Position = projectionMatrix * mvPosition;`);
  };
  return material;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,210,122,0.9)');
  grad.addColorStop(0.5, 'rgba(255,170,70,0.35)');
  grad.addColorStop(1, 'rgba(255,150,50,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Guide {
  constructor(ctx) {
    this.ctx = ctx;
    this.group = new THREE.Group();
    // a soft glow on the ground beneath it, then the arrow
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(GUIDE.size * 1.7, GUIDE.size * 1.7), liftToward(new THREE.MeshBasicMaterial({
      map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
    })));
    glow.rotation.x = -Math.PI / 2;
    glow.renderOrder = 3;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(GUIDE.size, GUIDE.size), liftToward(new THREE.MeshBasicMaterial({
      map: arrowTexture(), transparent: true, alphaTest: 0.4, depthWrite: false, toneMapped: false, fog: false,
      color: new THREE.Color(1.3, 1.2, 1.05),
    })));
    mesh.rotation.x = -Math.PI / 2; // flat on the ground, the arrow's tip toward -z
    mesh.position.y = 0.01;
    mesh.renderOrder = 4;
    this.mesh = mesh;
    this.glow = glow;
    this.group.add(glow, mesh);
    this.group.visible = false;
    ctx.scene.add(this.group);
    this.show = 0;
    this.angle = null;
    this.path = null;
    this.from = null;
    this.replanIn = 0;
    this.t = 0;
  }

  update(dt) {
    const { fight, pilot, nav, tutorial } = this.ctx;
    const me = pilot.npc;
    const route = tutorial?.route(); // (the tutorial's way on, if it's showing one)
    const want = !!me && !pilot.dead && !me.travel && (route ? true : fight.hunting() && !fight.inArena(me));
    this.show += ((want ? 1 : 0) - this.show) * Math.min(1, dt * 5);
    if (this.show < 0.01) {
      this.group.visible = false;
      this.path = null;
      this.angle = null;
      return;
    }
    this.group.visible = true;
    this.t += dt;
    const { x, y: z } = me.pos;
    if (want) {
      // the path from where thou standest (anew now and then, and whenever thou'st strayed from it)
      this.replanIn -= dt;
      const strayed = this.from && Math.hypot(x - this.from[0], z - this.from[1]) > 1.5;
      if (!this.path || this.replanIn <= 0 || strayed) {
        this.from = [x, z];
        this.path = [this.from, ...(route || nav.path(this.from, fight.destination()))];
        this.replanIn = GUIDE.replan;
      }
      const [ax, az] = this.ahead(x, z);
      const goal = Math.atan2(-(ax - x), -(az - z));
      if (this.angle === null) this.angle = goal;
      let turn = goal - this.angle;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn)); // the short way round
      this.angle += turn * Math.min(1, dt * 8);
    }
    // before thee where it points, a little further when it points away from the camera (so thy
    // figure doesn't hide it), nudging on and back as if beckoning
    const dx = -Math.sin(this.angle);
    const dz = -Math.cos(this.angle);
    const pulse = Math.sin(this.t * 4.5);
    const dist = GUIDE.ahead + 0.9 * Math.max(0, -dz) + 0.14 * pulse;
    const gx = x + dx * dist;
    const gz = z + dz * dist;
    this.group.position.set(gx, groundAt(gx, gz) + 0.06, gz); // (on the ground: up the arena's stair too, ground.js)
    this.group.rotation.y = this.angle;
    this.mesh.scale.setScalar(1 + 0.05 * pulse);
    this.mesh.material.opacity = this.show * (0.85 + 0.15 * pulse);
    this.glow.material.opacity = this.show * (0.45 + 0.2 * pulse);
  }

  // The point GUIDE.lookAhead further along the path than its nearest point to (x, z).
  ahead(x, z) {
    const p = this.path;
    if (p.length < 2) return p[p.length - 1];
    let best = Infinity;
    let at = 0;
    let along = 0;
    for (let i = 0; i < p.length - 1; i++) {
      const [x0, z0] = p[i];
      const [x1, z1] = p[i + 1];
      const sx = x1 - x0;
      const sz = z1 - z0;
      const len2 = sx * sx + sz * sz || 1;
      const k = Math.max(0, Math.min(1, ((x - x0) * sx + (z - z0) * sz) / len2));
      const d = Math.hypot(x0 + sx * k - x, z0 + sz * k - z);
      if (d < best) { best = d; at = i; along = k * Math.sqrt(len2); }
    }
    let left = GUIDE.lookAhead + along;
    for (let i = at; i < p.length - 1; i++) {
      const [x0, z0] = p[i];
      const [x1, z1] = p[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (left <= len) return [x0 + ((x1 - x0) * left) / len, z0 + ((z1 - z0) * left) / len];
      left -= len;
    }
    return p[p.length - 1];
  }
}
