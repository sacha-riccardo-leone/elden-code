// One Tarnished per Claude Code session, living in its project's region. The director tells it
// what to pursue (an "intent": work at a station, wait at the gate, rest at grace, wander, visit
// Roundtable Hold, leave); short "actions" such as gestures, staggers or being picked up
// interrupt that and then hand control back. Long journeys are made by fast travel: the
// Tarnished dissolves into golden light and reappears at the Site of Grace nearest its goal.

import * as THREE from 'three';
import { ANIMS, buildIcon, makeLook, sheetForLook } from './sprites.js';
import { STATIONS, TIMING, FAST_TRAVEL, HUB_LAYOUT } from './config.js';
import { nameFor, classTitle } from './lore.js';

const SPEED = { wander: 1.25, rest: 2.3, visit: 2.0, journey: 2.7, urgent: 3.6 };
const URGENT = new Set(['work', 'wait', 'channel', 'leave']);

// One quad per sheet size, standing on its bottom edge. The normals point up toward the sky so
// overhead and torch light reach the sprite's face.
const geometries = new Map();
function spriteGeometry(sheet) {
  const w = sheet.frameW * sheet.px;
  const h = sheet.frameH * sheet.px;
  const key = `${w.toFixed(4)}x${h.toFixed(4)}`;
  if (!geometries.has(key)) {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(0, h / 2, 0);
    const n = geo.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 0.55, 0.83);
    geometries.set(key, geo);
  }
  return geometries.get(key);
}

let blobTexture = null;
let ringTexture = null;
function blobTex() {
  if (blobTexture) return blobTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  blobTexture = new THREE.CanvasTexture(c);
  return blobTexture;
}
function ringTex() {
  if (ringTexture) return ringTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(255,214,140,1)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(32, 32, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(32, 32, 21, 0, Math.PI * 2);
  ctx.stroke();
  ringTexture = new THREE.CanvasTexture(c);
  return ringTexture;
}

function pixelTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Shared by every sprite and set by daylight.js (all 1 at night). By day the sun already lights
// the characters, so they take its light more gently (lit), need little of the self-light that
// keeps them legible in the dark (self), and their magic glows less (glow).
export const SPRITE_LIGHT = { lit: { value: 1 }, self: { value: 1 }, glow: { value: 1 } };

// A billboard driven by a sprite sheet: { color, glow, alpha, frameW, frameH, cols, rows,
// anims, px (world units per pixel), head (pixels to the top of the head), hits }.
export class SpriteBody {
  constructor(scene, sheet, { spirit = false } = {}) {
    this.sheet = sheet;
    this.atlas = sheet;
    this.tex = pixelTex(sheet.color);
    this.glowTex = pixelTex(this.atlas.glow);
    this.mat = new THREE.MeshLambertMaterial({
      map: this.tex,
      emissiveMap: this.glowTex,
      emissive: new THREE.Color(1, 1, 1),
      emissiveIntensity: sheet.glowIntensity ?? 2.6,
      alphaTest: 0.5,
    });
    if (spirit) {
      this.mat.transparent = true;
      this.mat.opacity = 0.62;
      this.mat.emissive = new THREE.Color('#3f86d8');
      this.mat.emissiveMap = this.tex;
      this.mat.emissiveIntensity = 0.55;
      this.mat.depthWrite = false;
    }
    // Keep sprites legible in the dark: a floor of self-light proportional to their own colour.
    this.mat.onBeforeCompile = (shader) => {
      shader.uniforms.uSelfLight = { value: spirit ? 0.15 : 0.32 };
      shader.uniforms.uLit = SPRITE_LIGHT.lit;
      shader.uniforms.uSelfScale = SPRITE_LIGHT.self;
      shader.uniforms.uGlowScale = SPRITE_LIGHT.glow;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uSelfLight, uLit, uSelfScale, uGlowScale;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= uGlowScale;\ntotalEmissiveRadiance += diffuseColor.rgb * uSelfLight * uSelfScale;')
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= uLit;\nreflectedLight.indirectDiffuse *= uLit;');
    };
    this.mesh = new THREE.Mesh(spriteGeometry(sheet), this.mat);
    this.mesh.castShadow = !spirit;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.tex, alphaTest: 0.5 });
    this.mesh.renderOrder = spirit ? 7 : 0;
    const big = sheet.hero ? 1.5 : 1;
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.35 * big, 0.7 * big), new THREE.MeshBasicMaterial({
      map: blobTex(), transparent: true, depthWrite: false, opacity: spirit ? 0.25 : 0.7,
    }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = 1;
    scene.add(this.mesh, this.blob);
    this.scene = scene;
    this.facing = 1;
    this.frame = -1;
    this.anim = null;
  }

  setFrame(index, facing) {
    if (index === this.frame && facing === this.facing) return;
    this.frame = index;
    this.facing = facing;
    const { cols, rows } = this.sheet;
    const col = index % cols;
    const row = Math.floor(index / cols);
    for (const t of [this.tex, this.glowTex]) {
      t.repeat.set(facing / cols, 1 / rows);
      t.offset.set((facing > 0 ? col : col + 1) / cols, 1 - (row + 1) / rows);
    }
  }

  play(name, restart = false) {
    if (!restart && this.anim && this.anim.name === name) return this.anim;
    this.anim = { name, def: this.sheet.anims[name] || ANIMS[name], t: 0, index: -1, done: false };
    return this.anim;
  }

  // Advances the animation; returns the step within the animation when it changes (for FX hooks).
  tick(dt, rate = 1) {
    const a = this.anim;
    if (!a) return null;
    a.t += dt * a.def.fps * rate;
    let i = Math.floor(a.t);
    if (a.def.once) {
      if (i >= a.def.frames.length) { i = a.def.frames.length - 1; a.done = true; }
    } else {
      i %= a.def.frames.length;
    }
    const frame = a.def.frames[i];
    const changed = i !== a.index;
    a.index = i;
    this.setFrame(frame, this.facing);
    return changed ? i : null;
  }

  // The step of the current animation where its blow lands (hammer strike, spell, raven).
  hits(step) {
    const a = this.anim;
    return !!a && this.sheet.hits?.[a.name] === step;
  }

  place(x, y, z, lift = 0) {
    this.mesh.position.set(x, y + lift, z);
    this.blob.position.set(x, 0.015, z + 0.05);
    const s = 1 - Math.min(0.5, lift * 0.35);
    this.blob.scale.set(s, s, 1);
  }

  // Alpha test against the atlas so clicks on transparent corners fall through.
  hitTest(uv) {
    const { frameW: FW, frameH: FH, cols } = this.sheet;
    const u = this.facing > 0 ? uv.x : 1 - uv.x;
    const col = this.frame % cols;
    const row = Math.floor(this.frame / cols);
    const W = FW * cols;
    const px = col * FW + Math.floor(u * FW);
    const py = row * FH + Math.floor((1 - uv.y) * FH);
    const r = this.sheet.hero ? 4 : 2;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = px + dx;
        const y = py + dy;
        if (x < col * FW || x >= (col + 1) * FW || y < row * FH || y >= (row + 1) * FH) continue;
        if (this.atlas.alpha[(y * W + x) * 4 + 3] > 0) return true;
      }
    }
    return false;
  }

  dispose() {
    this.scene.remove(this.mesh, this.blob);
    this.tex.dispose();
    this.glowTex.dispose();
    this.mat.dispose();
    this.blob.material.dispose();
    this.blob.geometry.dispose();
  }
}

// A subagent at work: a wisp of blue spirit-light circling its summoner, flaring when it works.
// (A light, not a second body: every character in the Lands is one of the hand-drawn heroes, and
// each appears only once.)
let wispTexture = null;
function wispTex() {
  if (wispTexture) return wispTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5;
      const dy = y - 10;
      const d = Math.hypot(dx, dy < 0 ? dy * 0.5 : dy); // drawn out upward, like a flame
      const col = d < 1.8 ? '#eaf6ff' : d < 3.2 ? '#9fd6ff' : d < 4.6 ? '#3f86d8' : null;
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  }
  wispTexture = new THREE.CanvasTexture(c);
  wispTexture.magFilter = THREE.NearestFilter;
  wispTexture.minFilter = THREE.NearestFilter;
  wispTexture.colorSpace = THREE.SRGBColorSpace;
  return wispTexture;
}

class Spirit {
  constructor(owner, index) {
    this.owner = owner;
    this.index = index;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: wispTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.3, 1.4, 1.7),
    }));
    this.sprite.renderOrder = 7;
    owner.ctx.scene.add(this.sprite);
    this.pos = owner.pos.clone().add(new THREE.Vector2((Math.random() - 0.5) * 1.5, 0.6));
    this.fade = 0;
    this.leaving = false;
    this.pulse = 0;
    this.phase = Math.random() * 6;
    owner.ctx.particles.emit({
      pos: [this.pos.x, 1.4, this.pos.y], spread: [0.2, 0.3, 0.2], vel: [0, 0.6, 0], velSpread: [0.6, 0.4, 0.6],
      color: ['#7fc8ff', '#b4e2ff', '#4e8fd0'], size: 0.08, life: 1.1, count: 18, drag: 1, intensity: 1.8,
    });
  }

  update(dt, t) {
    const o = this.owner;
    const n = Math.max(1, o.spirits.length);
    const a = (this.index / n) * Math.PI * 2 + t * 0.9;
    const target = new THREE.Vector2(o.pos.x + Math.cos(a) * 0.8, o.pos.y + Math.sin(a) * 0.45);
    this.pos.lerp(target, Math.min(1, dt * 3));
    this.fade += ((this.leaving ? 0 : 1) - this.fade) * Math.min(1, dt * 3);
    this.pulse = Math.max(0, this.pulse - dt * 2);
    const y = 1.5 + Math.sin(t * 2.2 + this.phase) * 0.18;
    this.sprite.position.set(this.pos.x, y, this.pos.y);
    const size = (0.42 + this.pulse * 0.25) * (0.9 + 0.1 * Math.sin(t * 9 + this.phase));
    this.sprite.scale.set(size, size, 1);
    this.sprite.material.opacity = (0.75 + this.pulse * 0.25) * this.fade;
    // a mote now and then, more while it works
    if (this.fade > 0.5 && Math.random() < dt * (o.working ? 6 : 2)) {
      o.ctx.particles.emit({
        pos: [this.pos.x, y, this.pos.y], spread: [0.05, 0.05, 0.05], vel: [0, 0.5, 0], velSpread: [0.2, 0.2, 0.2],
        color: ['#9fd6ff', '#4e8fd0'], size: 0.05, life: 0.8, count: 1, drag: 1, intensity: 1.6,
      });
    }
    return !(this.leaving && this.fade < 0.03);
  }

  dismiss() {
    if (this.leaving) return;
    this.leaving = true;
    this.owner.ctx.particles.emit({
      pos: [this.pos.x, 1.5, this.pos.y], spread: [0.2, 0.3, 0.2], vel: [0, 1.2, 0], velSpread: [0.4, 0.4, 0.4],
      color: ['#7fc8ff', '#b4e2ff'], size: 0.07, life: 1.2, count: 16, drag: 0.6, intensity: 1.6,
    });
  }

  dispose() {
    this.owner.ctx.scene.remove(this.sprite);
    this.sprite.material.dispose();
  }
}

export class Npc {
  constructor(ctx, session, { x = 0, z = 0, demo = false, region = null } = {}) {
    this.ctx = ctx;
    this.region = region;
    this.sid = session.sid;
    this.session = session;
    this.demo = demo;
    this.name = nameFor(session.sid);
    this.model = session.model || null;
    this.look = makeLook(session.sid, session.project, this.model);
    this.title = classTitle(this.look.cls);
    this.hero = null; // the hand-drawn hero sheet this Tarnished wears, if any
    this.body = new SpriteBody(ctx.scene, this.sheetFor(this.look));
    this.body.mesh.userData.npc = this;
    this.pos = new THREE.Vector2(x, z);
    this.lift = 0;
    this.intent = { kind: 'wander' };
    this.path = [];
    this.goal = null;
    this.arrived = true;
    this.slot = null;
    this.travel = null;
    this.idleSince = performance.now() / 1000;
    this.visitUntil = 0;
    this.action = null;
    this.dragged = false;
    this.talk = null;
    this.wanderPause = 1 + Math.random() * 3;
    this.chatReadyAt = performance.now() / 1000 + 8 + Math.random() * 20;
    this.restUntil = 0;
    this.restStarted = 0;
    this.lastRaven = 0;
    this.icon = null;
    this.persistentIcon = null;
    this.spirits = [];
    this.fade = 1;
    this.dead = false;
    this.working = false;
    this.selected = false;
    this.hovered = false;
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.95), new THREE.MeshBasicMaterial({
      map: ringTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, color: new THREE.Color(1.6, 1.2, 0.6),
    }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 2;
    ctx.scene.add(this.ring);
    this.body.play('idle');
    this.body.setFrame(0, 1);
  }

  get displayName() {
    return `${this.name.first} ${this.name.epithet}`;
  }

  head() {
    const s = this.body.sheet;
    return new THREE.Vector3(this.pos.x, this.lift + s.head * s.px, this.pos.y);
  }

  sheetFor(look) {
    return this.hero || sheetForLook(look);
  }

  rebuildBody() {
    const facing = this.body.facing;
    const anim = this.body.anim?.name || 'idle';
    this.body.dispose();
    this.body = new SpriteBody(this.ctx.scene, this.sheetFor(this.look));
    this.body.mesh.userData.npc = this;
    this.body.facing = facing;
    this.body.play(anim);
  }

  // A hand-drawn hero takes up a Claude Code session (and that session's island) ...
  bind(session, region) {
    this.sid = session.sid;
    this.session = session;
    this.region = region;
    this.demo = !!session.demo;
    this.unbound = false;
    if (session.model) this.setModel(session.model);
  }

  // ... and when the session ends, sets it down again and heads back to the Round Table.
  unbind(session, hub) {
    this.setSpirits(0);
    this.clearPersistentIcon();
    this.action = null;
    this.sid = session.sid;
    this.session = session;
    this.region = hub;
    this.demo = false;
    this.unbound = true;
    this.working = false;
  }

  // Wear a hand-drawn hero sheet (or go back to the procedural look with null). `quiet` skips the
  // burst of light, for someone who is only just arriving; `keepName` keeps the name and title
  // (the Twofold, halfway through changing form).
  setHero(sheet, { quiet = false, keepName = false } = {}) {
    if (sheet === this.hero) return;
    this.hero = sheet;
    const rig = sheet?.rig;
    if (!keepName) {
      const own = nameFor(this.sid);
      this.name = rig ? { first: rig.firstName || own.first, epithet: rig.epithet } : own;
      this.title = rig ? rig.title : classTitle(this.look.cls);
    }
    this.rebuildBody();
    if (rig && !quiet) {
      this.ctx.particles.emit({
        pos: [this.pos.x, 1.2, this.pos.y], spread: [0.4, 1, 0.3], vel: [0, 1, 0], velSpread: [0.8, 0.8, 0.6],
        color: rig.burst || ['#ffd27a', '#fff1b8'], size: 0.08, life: 1.2, count: 36, drag: 0.9, intensity: 2.4,
      });
    }
  }

  setModel(model) {
    if (!model || model === this.model) return;
    this.model = model;
    const look = makeLook(this.sid, this.session.project, model);
    this.look = look;
    if (!this.hero) this.rebuildBody();
    this.ctx.particles.emit({
      pos: [this.pos.x, 1, this.pos.y], spread: [0.3, 0.7, 0.2], vel: [0, 0.8, 0], velSpread: [0.5, 0.5, 0.5],
      color: [look.crest, '#ffffff'], size: 0.08, life: 1.2, count: 30, drag: 0.8, intensity: 2,
    });
  }

  // ------------------------------------------------------------------------------------------
  // intents

  setIntent(intent) {
    // while the player holds this character (or it's fighting a great enemy, fight.js), what its
    // session wants waits until it's free again
    if (this.piloted || this.intent.kind === 'fight') { this.resume = intent; return; }
    const same = this.intent.kind === intent.kind && this.intent.station === intent.station && this.intent.anim === intent.anim;
    if (same && intent.kind !== 'wander') return;
    const keepSlot = (intent.kind === 'work' && intent.station === this.intent.station) || (intent.kind === 'gather' && this.slot?.hub);
    if (this.slot && !keepSlot) this.releaseSlot();
    const wasIdle = this.intent.kind === 'wander' || this.intent.kind === 'rest' || this.intent.kind === 'visit';
    if ((intent.kind === 'wander' || intent.kind === 'rest') && !wasIdle) this.idleSince = performance.now() / 1000;
    this.intent = intent;
    this.arrivedAt = 0;
    this.talk = null;
    this.working = intent.kind === 'work' || intent.kind === 'channel';
    if (this.persistentIcon && intent.kind !== 'wait') this.clearPersistentIcon();
    switch (intent.kind) {
      case 'work': {
        const slot = this.ctx.director.reserveSlot(this.region, intent.station, this);
        this.slot = slot;
        this.goTo(slot.x, slot.z);
        break;
      }
      case 'wait': {
        const slot = this.ctx.director.reserveSlot(this.region, 'gate', this);
        this.slot = slot;
        this.goTo(slot.x, slot.z);
        this.showPersistentIcon('alert');
        break;
      }
      case 'rest': {
        const slot = this.ctx.director.reserveSlot(this.region, 'grace', this);
        this.slot = slot;
        this.goTo(slot.x, slot.z);
        this.restUntil = 0;
        break;
      }
      case 'leave': {
        const [ex, ez] = STATIONS.gate.exit;
        this.goTo(this.region.wx(ex), this.region.wz(ez));
        break;
      }
      case 'gather': {
        // placed straight at the Round Table (a seat if one is free, else standing by it)
        const seat = this.ctx.world.hub.reserveSeat(this);
        const spot = seat || this.ctx.director.standingSpot(this);
        this.slot = seat;
        this.pos.set(spot.x, spot.z);
        this.body.facing = spot.face;
        this.path = [];
        this.goal = null;
        this.arrived = true;
        break;
      }
      case 'journey': {
        // on foot, over the bridges (no travelling by grace): home to the island, or back to a
        // seat at the Round Table (dest 'hub')
        if (intent.dest === 'hub') {
          const seat = this.ctx.world.hub.reserveSeat(this);
          this.slot = seat;
          const spot = seat || this.ctx.director.standingSpot(this);
          this.goTo(spot.x, spot.z, false);
          break;
        }
        const [gx, gz] = this.region.point('grace');
        const [x, z] = this.ctx.nav.clampToWalkable(gx + (Math.random() - 0.5) * 3, gz + 1.8 + Math.random());
        this.goTo(x, z, false);
        break;
      }
      case 'visit': {
        const seat = this.ctx.world.hub.reserveSeat(this);
        if (!seat) { this.intent = { kind: 'wander' }; break; }
        this.slot = seat;
        this.visitUntil = 0;
        this.goTo(seat.x, seat.z);
        break;
      }
      case 'channel':
        this.path = [];
        this.goal = null;
        this.arrived = true;
        // Thinking happens at home: come back from Roundtable Hold first.
        if (!this.region.contains(this.pos.x, this.pos.y)) {
          const [gx, gz] = this.region.point('grace');
          const [x, z] = this.ctx.nav.clampToWalkable(gx + (Math.random() - 0.5) * 3, gz + 1.8 + Math.random());
          this.goTo(x, z);
        }
        break;
      default:
        this.path = [];
        this.goal = null;
        this.arrived = true;
        this.wanderPause = 0.5 + Math.random() * 2;
    }
  }

  releaseSlot() {
    if (this.slot?.hub) this.ctx.world.hub.releaseSeat(this);
    else if (this.slot) this.ctx.director.releaseSlot(this.slot, this);
    this.slot = null;
  }

  goTo(x, z, allowTravel = true) {
    this.goal = [x, z];
    const far = Math.hypot(x - this.pos.x, z - this.pos.y);
    const limit = URGENT.has(this.intent.kind) ? FAST_TRAVEL.urgent : FAST_TRAVEL.leisure;
    if (allowTravel && far > limit && !this.dragged && this.fade > 0.99 && this.intent.kind !== 'leave') {
      this.fastTravel(x, z);
      return;
    }
    this.path = this.ctx.nav.path([this.pos.x, this.pos.y], [x, z]);
    this.arrived = false;
  }

  // Dissolve into golden light and reappear at the Site of Grace nearest the destination.
  fastTravel(x, z) {
    const world = this.ctx.world;
    const area = world.areaAt(x, z) || this.region;
    const [gx, gz] = area === world.hub ? HUB_LAYOUT.grace : area.point('grace');
    const a = Math.random() * Math.PI * 2;
    const to = this.ctx.nav.clampToWalkable(gx + Math.cos(a) * 1.8, gz + 1.6 + Math.sin(a) * 0.6);
    this.travel = { phase: 'out', t: 0, to };
    this.path = [];
    this.arrived = false;
    this.goldBurst();
  }

  goldBurst() {
    this.ctx.particles.emit({
      pos: [this.pos.x, 0.4, this.pos.y], spread: [0.3, 0.6, 0.2], vel: [0, 2.4, 0], velSpread: [0.5, 1, 0.5],
      color: ['#ffd27a', '#fff1b8', '#ffb347'], size: 0.08, life: 1.3, count: 34, drag: 0.8, intensity: 2.4,
    });
  }

  stepTravel(dt) {
    const tr = this.travel;
    tr.t += dt;
    this.body.play('pray');
    if (tr.phase === 'out') {
      this.fade = Math.max(0, 1 - tr.t / 0.7);
      if (tr.t >= 0.7) {
        this.pos.set(tr.to[0], tr.to[1]);
        tr.phase = 'in';
        tr.t = 0;
        this.goldBurst();
      }
    } else {
      this.fade = Math.min(1, tr.t / 0.7);
      if (tr.t >= 0.7) {
        this.travel = null;
        this.fade = 1;
        if (this.goal) this.goTo(this.goal[0], this.goal[1], false);
      }
    }
  }

  speedFor() {
    if (this.intent.kind === 'fight') return Math.max(1.6, this.fighter?.speed || 0); // their legs keep up with their running
    if (this.intent.kind === 'wander') return SPEED.wander;
    if (this.intent.kind === 'journey') return SPEED.journey;
    if (this.intent.kind === 'rest') return SPEED.rest;
    if (this.intent.kind === 'visit') return SPEED.visit;
    return SPEED.urgent;
  }

  // ------------------------------------------------------------------------------------------
  // actions (temporary overrides)

  gesture(anim, icon = null) {
    if (this.dragged || this.dead) return;
    const def = this.body.sheet.anims[anim] || ANIMS[anim];
    const dur = def.once ? def.frames.length / def.fps + 0.2 : 2.4;
    this.action = { kind: 'gesture', anim, t: 0, dur };
    this.body.play(anim, true);
    if (icon) this.showIcon(icon, Math.max(2, dur));
  }

  stagger() {
    this.action = { kind: 'gesture', anim: 'stagger', t: 0, dur: 1.0 };
    this.body.play('stagger', true);
    this.showIcon('sweat', 2);
  }

  collapse(seconds = 4) {
    this.action = { kind: 'gesture', anim: 'collapse', t: 0, dur: seconds };
    this.body.play('collapse', true);
    this.showIcon('skull', seconds);
    this.ctx.particles.emit({
      pos: [this.pos.x, 0.4, this.pos.y], spread: [0.4, 0.1, 0.2], vel: [0, 0.6, 0], velSpread: [0.6, 0.3, 0.4],
      color: ['#8a2a22', '#3a1010', '#d14b3a'], size: 0.08, life: 1.4, count: 26, drag: 1, intensity: 1.2,
    });
  }

  spawn(fancy = true) {
    this.fade = fancy ? 0 : 1;
    this.action = { kind: 'spawn', anim: 'kneel', t: 0, dur: fancy ? 1.8 : 0.01 };
    this.body.play('kneel', true);
    if (fancy) {
      this.ctx.particles.emit({
        pos: [this.pos.x, 0.2, this.pos.y], spread: [0.3, 0.1, 0.3], vel: [0, 3, 0], velSpread: [0.4, 1.2, 0.4],
        color: ['#ffd27a', '#fff1b8', '#ffb347'], size: 0.09, life: 1.6, count: 60, drag: 0.6, intensity: 2.4,
      });
    }
  }

  // Runes spiral into the character while its memory is consolidated (/compact).
  absorb() {
    const at = { x: this.pos.x, y: 1.0, z: this.pos.y, strength: 6, swirl: 5 };
    for (let k = 0; k < 50; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.6 + Math.random() * 1.2;
      this.ctx.particles.emit({
        pos: [this.pos.x + Math.cos(a) * r, 0.4 + Math.random() * 2, this.pos.y + Math.sin(a) * r],
        color: ['#ffd27a', '#fff1b8'], size: 0.08, life: 2.4, drag: 1.2, attract: at, intensity: 2.2,
      });
    }
    this.gesture('cast', 'rune');
  }

  castBurst(color = ['#ffd27a', '#fff1b8']) {
    this.ctx.particles.emit({
      pos: [this.pos.x + this.body.facing * 0.3, 1.4, this.pos.y], spread: [0.2, 0.2, 0.1], vel: [0, 1.2, 0], velSpread: [1, 0.8, 0.6],
      color, size: 0.08, life: 1, count: 18, drag: 1.5, intensity: 2.2,
    });
  }

  // ------------------------------------------------------------------------------------------
  // dragging

  pickUp() {
    if (this.travel) { this.travel = null; this.fade = 1; }
    this.dragged = true;
    this.action = null;
    this.talk = null;
    this.body.play('lifted', true);
    this.showIcon('question', 1.5);
  }

  dragTo(x, z) {
    const [cx, cz] = this.ctx.nav.clampToWalkable(x, z);
    this.pos.set(cx, cz);
  }

  drop() {
    this.dragged = false;
    this.ctx.particles.emit({
      pos: [this.pos.x, 0.05, this.pos.y], spread: [0.3, 0, 0.15], vel: [0, 0.4, 0], velSpread: [0.8, 0.2, 0.4],
      color: ['#6a625a', '#8a8278'], size: 0.07, life: 0.8, count: 14, drag: 2, intensity: 0.8,
    });
    // Dropped near a station while idle? Try it out for a moment.
    const near = this.intent.kind === 'wander' || this.intent.kind === 'visit' ? this.ctx.director.stationNear(this.pos.x, this.pos.y) : null;
    if (near) {
      this.body.facing = near.face;
      this.action = { kind: 'gesture', anim: STATIONS[near.station].anim, t: 0, dur: 4.5 };
      this.body.play(STATIONS[near.station].anim, true);
    } else {
      this.gesture('stagger');
    }
    this.wanderPause = 6 + Math.random() * 4;
    this.goal && this.goTo(this.goal[0], this.goal[1], this.intent.kind !== 'journey');
  }

  // ------------------------------------------------------------------------------------------
  // icons

  makeIconSprite(name) {
    const tex = pixelTex(buildIcon(name));
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5, depthTest: false }));
    s.renderOrder = 20;
    s.scale.set(0.001, 0.001, 1);
    this.ctx.scene.add(s);
    return s;
  }

  showIcon(name, duration = 2.5) {
    this.clearIcon();
    this.icon = { sprite: this.makeIconSprite(name), t: 0, duration, name };
  }

  clearIcon() {
    if (!this.icon) return;
    this.ctx.scene.remove(this.icon.sprite);
    this.icon.sprite.material.map.dispose();
    this.icon.sprite.material.dispose();
    this.icon = null;
  }

  showPersistentIcon(name) {
    if (this.persistentIcon?.name === name) return;
    this.clearPersistentIcon();
    this.persistentIcon = { sprite: this.makeIconSprite(name), t: 0, name };
  }

  clearPersistentIcon() {
    if (!this.persistentIcon) return;
    this.ctx.scene.remove(this.persistentIcon.sprite);
    this.persistentIcon.sprite.material.map.dispose();
    this.persistentIcon.sprite.material.dispose();
    this.persistentIcon = null;
  }

  updateIcons(dt, t) {
    const head = this.head();
    const place = (ic, visible) => {
      ic.t += dt;
      const pop = Math.min(1, ic.t * 6);
      const s = 0.95 * (pop < 1 ? 0.6 + 0.6 * Math.sin(pop * Math.PI * 0.75) : 1);
      ic.sprite.visible = visible;
      ic.sprite.scale.set(s, s, 1);
      ic.sprite.position.set(head.x, head.y + 0.55 + Math.sin(t * 3 + this.pos.x) * 0.05, head.z);
    };
    if (this.icon) {
      place(this.icon, true);
      if (this.icon.t > this.icon.duration) this.clearIcon();
    }
    if (this.persistentIcon) place(this.persistentIcon, !this.icon);
  }

  // ------------------------------------------------------------------------------------------
  // spirits (subagents)

  setSpirits(n) {
    const alive = this.spirits.filter((s) => !s.leaving);
    while (alive.length < n) {
      const s = new Spirit(this, alive.length);
      this.spirits.push(s);
      alive.push(s);
    }
    while (alive.length > n) alive.pop().dismiss();
    alive.forEach((s, i) => { s.index = i; });
  }

  pulseSpirit() {
    const s = this.spirits.find((sp) => !sp.leaving);
    if (s) s.pulse = 1;
  }

  // ------------------------------------------------------------------------------------------

  leave() {
    if (this.intent.kind === 'leave') return;
    this.action = null;
    this.dragged = false;
    this.setSpirits(0);
    this.setIntent({ kind: 'leave' });
  }

  update(dt, t) {
    let moving = false;
    if (this.dragged) {
      this.lift += (0.9 - this.lift) * Math.min(1, dt * 10);
      this.body.play('lifted');
    } else {
      this.lift += (0 - this.lift) * Math.min(1, dt * 12);
      if (this.travel) {
        this.stepTravel(dt);
      } else if (this.intent.kind !== 'leave' && this.fade < 1) {
        this.fade = Math.min(1, this.fade + dt / 1.2);
      }
      if (this.travel) {
        // nothing else happens while in transit
      } else if (this.piloted) {
        moving = this.ctx.pilot.drive(this, dt); // the player's hand (pilot.js)
      } else if (this.action) {
        this.action.t += dt;
        if (this.action.t >= this.action.dur) this.action = null;
      } else {
        moving = this.pursue(dt, t);
      }
    }

    const rate = moving ? (this.piloted ? this.ctx.pilot.speed / 2.4 : this.speedFor() / 1.6) : 1;
    const step = this.body.tick(dt, rate);
    if (step !== null) this.onFrame(step, t);

    if (this.intent.kind === 'leave' && this.arrived) {
      this.fade -= dt * 0.8;
      this.pos.y -= dt * 0.9;
      if (this.fade <= 0) this.dead = true;
    }

    this.body.place(this.pos.x, 0, this.pos.y, this.lift);
    const fadeVisible = this.fade < 0.999;
    this.body.mat.transparent = fadeVisible;
    this.body.mat.opacity = Math.max(0, this.fade);
    this.body.mat.depthWrite = !fadeVisible;
    this.body.blob.material.opacity = 0.7 * Math.max(0, this.fade);

    const ringTarget = this.selected ? 0.9 : this.hovered ? 0.45 : this.piloted ? 0.3 : 0; // a faint ring of grace marks thee
    this.ring.material.opacity += (ringTarget - this.ring.material.opacity) * Math.min(1, dt * 10);
    this.ring.position.set(this.pos.x, 0.02, this.pos.y + 0.05);
    this.ring.scale.setScalar((1 + Math.sin(t * 3) * 0.04) * (this.hero ? 1.45 : 1));

    this.updateIcons(dt, t);
    this.spirits = this.spirits.filter((s) => {
      const keep = s.update(dt, t);
      if (!keep) s.dispose();
      return keep;
    });
  }

  // Walks the current path; returns true while moving.
  followPath(dt) {
    if (!this.path.length) return false;
    const [tx, tz] = this.path[0];
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.y;
    const d = Math.hypot(dx, dz);
    const step = this.speedFor() * dt;
    if (d <= step || d < 0.04) {
      this.pos.set(tx, tz);
      this.path.shift();
      if (!this.path.length) { this.arrived = true; this.arrivedAt = performance.now() / 1000; }
    } else {
      this.pos.x += (dx / d) * step;
      this.pos.y += (dz / d) * step;
      if (Math.abs(dx) > 0.02) this.body.facing = dx > 0 ? 1 : -1;
    }
    this.body.play('walk');
    return true;
  }

  pursue(dt, t) {
    if (this.talk) {
      this.body.facing = this.talk.partner.pos.x > this.pos.x ? 1 : -1;
      this.body.play(this.slot?.hub ? 'sit' : this.talk.speaking ? 'talk' : 'idle');
      return false;
    }
    if (this.followPath(dt)) return true;
    const now = performance.now() / 1000;
    switch (this.intent.kind) {
      case 'work': {
        const st = STATIONS[this.intent.station];
        if (this.slot) this.body.facing = this.slot.face;
        this.body.play(st.anim);
        return false;
      }
      case 'channel':
        this.body.play(this.intent.anim || 'cast');
        return false;
      case 'wait':
        if (this.slot) this.body.facing = this.slot.face;
        this.body.play('kneel');
        return false;
      case 'fight':
        return this.ctx.fight.driveFighter(this, dt);
      case 'gather': {
        const seated = this.slot && Math.hypot(this.slot.x - this.pos.x, this.slot.z - this.pos.y) < 0.3;
        if (seated) this.body.facing = this.slot.face;
        this.body.play(seated ? 'sit' : 'idle');
        return false;
      }
      case 'journey':
        this.ctx.director.journeyDone(this);
        return false;
      case 'rest': {
        if (this.slot) this.body.facing = this.slot.face;
        if (!this.restStarted || this.restStarted < this.arrivedAt) this.restStarted = now;
        if (!this.restUntil) this.restUntil = now + TIMING.restAtGrace + Math.random() * 10;
        this.body.play(now - this.restStarted > 12 ? 'doze' : 'sit');
        if (now > this.restUntil) this.setIntent({ kind: 'wander' });
        return false;
      }
      case 'leave':
        this.body.play('walk');
        return false;
      case 'visit': {
        if (this.slot) this.body.facing = this.slot.face;
        this.body.play('sit');
        if (!this.visitUntil) this.visitUntil = now + TIMING.visitStay[0] + Math.random() * (TIMING.visitStay[1] - TIMING.visitStay[0]);
        if (now > this.visitUntil) this.setIntent({ kind: 'wander' });
        return false;
      }
      default: {
        this.wanderPause -= dt;
        this.body.play('idle');
        if (this.wanderPause <= 0) {
          const [x, z] = this.ctx.nav.randomPoint(Math.random, this.wanderRegion());
          this.goTo(x, z);
          this.wanderPause = 2 + Math.random() * 6;
        }
        return false;
      }
    }
  }

  // Idle wandering stays within a few metres of where they stand, inside their own region;
  // anyone who finds themselves elsewhere heads home.
  wanderRegion() {
    if (!this.region?.walkRect) this.region = this.ctx.world.hub; // (nobody lives on the arena)
    const home = this.region.walkRect();
    if (!this.region.contains(this.pos.x, this.pos.y)) return home;
    const r = 6;
    return {
      minX: Math.max(home.minX, this.pos.x - r), maxX: Math.min(home.maxX, this.pos.x + r),
      minZ: Math.max(home.minZ + 1, this.pos.y - r), maxZ: Math.min(home.maxZ, this.pos.y + r),
    };
  }

  onFrame(step, t) {
    // working a station: for its session, or (held by the player) by choice (interact.js)
    const station = this.using ? this.using.station : this.intent.kind === 'work' && !this.path.length ? this.intent.station : null;
    if (!station || !this.body.hits(step)) return;
    const region = this.using ? this.using.region : this.region;
    const now = performance.now() / 1000;
    if (station === 'forge') {
      if (this.using || (this.slot && this.slot.index >= 0 && this.slot.index < 2)) region.forgeStrike();
      else this.ctx.particles.emit({
        pos: [this.pos.x + this.body.facing * 0.6, 0.6, this.pos.y], spread: [0.05, 0.05, 0.05], vel: [0, 1.6, 0],
        velSpread: [1.2, 0.8, 0.8], color: ['#ffd27a', '#ff9a3a'], size: 0.05, life: 0.5, gravity: 6, count: 8, intensity: 2,
      });
    }
    if (station === 'ritual') {
      this.ctx.particles.emit({
        pos: [this.pos.x, 0.1, this.pos.y], spread: [0.6, 0, 0.4], vel: [0, 1.4, 0], velSpread: [0.2, 0.5, 0.2],
        color: ['#d0304a', '#ff6a7a', '#8a1a3a'], size: 0.07, life: 1.4, count: 10, drag: 0.4, intensity: 2.2,
      });
    }
    if (station === 'tower' && now - this.lastRaven > 5) {
      this.lastRaven = now;
      region.sendRaven();
    }
  }

  dispose() {
    this.releaseSlot();
    this.clearIcon();
    this.clearPersistentIcon();
    for (const s of this.spirits) s.dispose();
    this.spirits = [];
    this.body.dispose();
    this.ctx.scene.remove(this.ring);
    this.ring.material.dispose();
    this.ring.geometry.dispose();
  }
}
