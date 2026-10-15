// One Tarnished per Claude Code session, living in its project's region. The director tells it
// what to pursue (an "intent": work at a station, wait at the gate, rest at grace, wander, visit
// Roundtable Hold, leave); short "actions" such as gestures, staggers or being picked up
// interrupt that and then hand control back. Long journeys are made by fast travel: the
// Tarnished dissolves into golden light and reappears at the Site of Grace nearest its goal.

import * as THREE from 'three';
import { rippleAt } from './ripple.js';
import { ANIMS, buildIcon, makeLook, sheetForLook } from './sprites.js';
import { STATIONS, TIMING, FAST_TRAVEL, HUB_LAYOUT, CROWD } from './config.js';
import { nameFor, classTitle } from './lore.js';

const SPEED = { wander: 1.25, rest: 2.3, visit: 2.0, journey: 2.7, urgent: 3.6 };
const URGENT = new Set(['work', 'wait', 'channel', 'leave']);
const SETTLED = new Set(['work', 'wait', 'rest', 'visit', 'gather']); // kept to a spot (its slot) once there
const HOMEWARD = new Set(['work', 'wait', 'rest', 'channel', 'wander', 'journey']); // done at home (a journey: unless to the Hold)
// Getting nowhere (`stalled`): no further than `dist` from where it was for `after` seconds; within
// `near` of where it's going, it calls that arrived.
const STALL = { dist: 0.8, after: 6, near: 2.5 };

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
    this.shown = 0; // the facing the texture last drew (`facing` is set freely; tick catches it up)
    this.anim = null;
  }

  setFrame(index, facing) {
    if (index === this.frame && facing === this.shown) return;
    this.frame = index;
    this.facing = facing;
    this.shown = facing;
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
    this.blob.position.set(x, y + 0.015, z + 0.05);
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
    // making its way among the others (crowd.js): how long it's been held up, giving way to
    // someone (who goes first when two block each other: the higher rank), pushed off its spot
    this.stuckT = 0;
    this.wp = null;
    this.yielding = null;
    this.rank = Math.random();
    this.pushedT = 0;
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
    // a home still under the mist (or sinking back into it) can't be gone to: it waits at the Round
    // Table instead, and sets out once its island has risen (director.updateGathering)
    if (HOMEWARD.has(intent.kind) && intent.dest !== 'hub' && !this.unbound && !this.spectre && !this.homeUp()) intent = { kind: 'journey', dest: 'hub' };
    const same = this.intent.kind === intent.kind && this.intent.station === intent.station && this.intent.anim === intent.anim && this.intent.dest === intent.dest;
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

  // Whether its home stands above the mist, to be gone to: the Hold always; its island once it has
  // risen, and not while it sinks back into the mist (nor once it's gone).
  homeUp() {
    const { world } = this.ctx;
    const r = this.region;
    if (!r || r === world.hub || !r.walkRect) return true;
    return r.risen && !r.sinking && world.regions.get(r.project) === r;
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
    this.yielding = null;
    this.stall = null;
    this.stuckT = 0;
    this.wp = null;
    this.steerV = null;
  }

  // Dissolve into golden light and reappear at the Site of Grace nearest the destination.
  fastTravel(x, z) {
    const world = this.ctx.world;
    let area = world.areaAt(x, z) || this.region;
    // (never onto an island under the mist, sinking into it or gone: that would leave it standing
    // on thin air; to the Hold instead)
    const island = area !== world.hub && area !== world.arena;
    if (island && (world.regions.get(area.project) !== area || !area.risen || area.sinking)) {
      area = world.hub;
      this.goal = null;
    }
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
  // spectres (spectres.js): called up when every hero is busy; they float, work, and fade

  // Becomes a spectre in colour k (wearing `sheet`); it shows itself once its island has risen.
  makeSpectre(sheet, k, color) {
    this.spectre = { color: k, tint: color.tint, hidden: true, vanishing: false, trail: [], trailT: 0 };
    this.setHero(sheet, { quiet: true });
    this.name = { first: `${color.name} Spectre`, epithet: 'of the Noble Sorcerers' };
    this.title = 'Spectre';
    this.fade = 0;
  }

  // Called up at its island's Site of Grace in a burst of blue sparkles.
  appear() {
    const sp = this.spectre;
    sp.hidden = false;
    const [gx, gz] = this.region.point('grace');
    const [x, z] = this.ctx.nav.clampToWalkable(gx + (Math.random() - 0.5) * 2.5, gz + 1.4 + Math.random());
    this.pos.set(x, z);
    this.fade = 0;
    this.sparkle(70);
  }

  // Its work done, it fades away in blue sparkles (and is gone: director.update).
  vanish() {
    const sp = this.spectre;
    if (!sp || sp.vanishing) return;
    sp.vanishing = true;
    this.setSpirits(0);
    this.action = null;
    this.path = [];
    this.talk = null;
    if (sp.hidden) { this.dead = true; return; } // never seen: simply gone
    this.sparkle(60);
  }

  sparkle(count) {
    this.ctx.particles.emit({
      pos: [this.pos.x, 1.3, this.pos.y], spread: [0.5, 1.1, 0.35], vel: [0, 1.4, 0], velSpread: [1, 1, 0.8],
      color: ['#7fc8ff', '#d8f2ff', '#3f86d8', '#ffffff'], size: 0.08, life: 1.4, count, drag: 0.9, intensity: 2.4, flicker: 1,
    });
  }

  // While it floats along, it leaves fading copies of itself behind.
  stepSpectre(dt, moving) {
    const sp = this.spectre;
    sp.trailT -= dt;
    if (moving && sp.trailT <= 0 && this.fade > 0.5) {
      sp.trailT = 0.09;
      const b = this.body;
      const tex = b.tex.clone();
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, alphaTest: 0.05, opacity: 0.32, color: new THREE.Color(...sp.tint),
      });
      const ghost = new THREE.Mesh(b.mesh.geometry, mat);
      ghost.position.copy(b.mesh.position);
      ghost.scale.copy(b.mesh.scale);
      ghost.renderOrder = -1;
      this.ctx.scene.add(ghost);
      sp.trail.push({ ghost, t: 0 });
    }
    sp.trail = sp.trail.filter((g) => {
      g.t += dt;
      g.ghost.material.opacity = 0.32 * Math.max(0, 1 - g.t / 0.5);
      if (g.t < 0.5) return true;
      this.ctx.scene.remove(g.ghost);
      g.ghost.material.map.dispose();
      g.ghost.material.dispose();
      return false;
    });
  }

  leave() {
    if (this.intent.kind === 'leave') return;
    this.action = null;
    this.dragged = false;
    this.setSpirits(0);
    this.setIntent({ kind: 'leave' });
  }

  update(dt, t) {
    const sp = this.spectre;
    if (sp?.hidden) {
      // a spectre is called up only once its island has risen
      this.body.mesh.visible = false;
      this.body.blob.visible = false;
      if (sp.vanishing || !this.region.risen) return;
      this.body.mesh.visible = true;
      this.body.blob.visible = true;
      this.appear();
    }
    let moving = false;
    if (sp?.vanishing) {
      this.fade -= dt / 1.2;
      this.lift += dt * 0.6;
      if (this.fade <= 0) this.dead = true;
    } else if (this.dragged) {
      this.lift += (0.9 - this.lift) * Math.min(1, dt * 10);
      this.body.play('lifted');
    } else {
      // spectres float above the ground; a fighter hopping a great enemy's shockwave is up in the air (fight.js)
      if (this.ultLift != null) this.lift = this.ultLift; // (borne up by an ultimate, ults.js)
      else if (this.hopLift > 0) this.lift = this.hopLift;
      else this.lift += ((sp ? 0.35 : 0) - this.lift) * Math.min(1, dt * 12);
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

    this.body.place(this.pos.x, rippleAt(this.pos.x, this.pos.y), this.pos.y, this.lift); // (riding the ground as it ripples, ripple.js)
    const fadeVisible = this.fade < 0.999 || !!sp; // spectres are always a little see-through
    this.body.mat.transparent = fadeVisible;
    this.body.mat.opacity = Math.max(0, this.fade) * (sp ? 0.88 : 1);
    this.body.mat.depthWrite = !fadeVisible;
    this.body.blob.material.opacity = (sp ? 0.3 : 0.7) * Math.max(0, this.fade);
    if (sp) this.stepSpectre(dt, moving);

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

  // Walks the current path; returns true while moving. On the way it steers round the others
  // (crowd.steer), plans a new way round anyone holding it up too long (`unstick`), and when two
  // block each other the one of lower rank gives way.
  followPath(dt) {
    if (this.stalled(dt)) return false;
    if (this.yielding) return this.giveWay(dt);
    if (!this.path.length) return false;
    const crowd = this.ctx.crowd;
    const [tx, tz] = this.path[0];
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.y;
    const d = Math.hypot(dx, dz);
    const last = this.path.length === 1;
    const speed = this.speedFor();
    const step = speed * dt;
    // (a waypoint on the way is passed close by; the last is stepped onto)
    if (d <= step || d < 0.04 || (!last && d < 0.4)) {
      if (d <= step) this.pos.set(tx, tz);
      this.path.shift();
      if (!this.path.length) this.arrive();
      this.body.play('walk');
      return true;
    }
    if (crowd) {
      // someone stands on the very spot it's making for: it stops beside them (and steps onto it
      // once they've gone, `settle`)
      const o = last && crowd.occupant(tx, tz, this);
      if (o && d < CROWD.radius + o.r + 0.15) {
        this.path = [];
        this.arrive();
        return false;
      }
      if (this.unstick(dt, dx / d, dz / d)) return true;
      if (!this.path.length) return false;
    }
    // steering round the others, smoothly (no turning this way and that from one frame to the
    // next); not on the last steps onto its spot, which may well be right beside someone
    const steer = crowd && !(last && d < CROWD.radius * 2 + CROWD.avoidMargin);
    let [vx, vz] = steer ? crowd.steer(this, dx / d, dz / d, speed) : [(dx / d) * speed, (dz / d) * speed];
    const sv = (this.steerV ??= { x: vx, z: vz });
    const k = Math.min(1, dt * 8);
    sv.x += (vx - sv.x) * k;
    sv.z += (vz - sv.z) * k;
    vx = sv.x;
    vz = sv.z;
    const nx = this.pos.x + vx * dt;
    const nz = this.pos.y + vz * dt;
    if (!crowd || crowd.canStep(this.pos.x, this.pos.y, nx, nz)) this.pos.set(nx, nz);
    else {
      // turned aside into a wall, or off the edge: straight on along the path instead. A path found
      // on the nav grid is trusted as it goes, as it always was (it may cut a corner a hair's
      // breadth past the walkable edge, onto a bridge), though never into a wall; a straight line
      // at a goal it found no way to is trusted no further than the ground goes.
      vx = dx;
      const sx = this.pos.x + (dx / d) * step;
      const sz = this.pos.y + (dz / d) * step;
      const nav = this.ctx.nav;
      if (this.path.failed ? crowd.ground(sx, sz, 0) : !this.ctx.world.isBlocked(sx, sz, 0)) this.pos.set(sx, sz);
      else if (this.goal && this.ctx.director.clock - (this.replanned ?? -9) > 0.5) {
        // pushed or turned so far off its path that the way on to the next waypoint runs into a
        // wall: a new path from here
        this.replanned = this.ctx.director.clock;
        this.path = nav.path([this.pos.x, this.pos.y], this.goal);
        this.wp = null;
      } else {
        // (stopped short: back to the middle of the nearest open cell of the nav grid first, from
        // where its paths run)
        const [cx, cz] = nav.toWorld(...nav.nearestFree(this.pos.x, this.pos.y));
        const ex = cx - this.pos.x;
        const ez = cz - this.pos.y;
        const ed = Math.hypot(ex, ez);
        if (ed > 0.01) {
          const k = Math.min(1, step / ed);
          crowd.move(this, ex * k, ez * k);
        }
      }
    }
    if (Math.abs(vx) > 0.1) this.body.facing = vx > 0 ? 1 : -1;
    this.body.play('walk');
    return true;
  }

  // However it tries, getting nowhere for a good while (wedged between a table and someone seated at
  // it, say): the last stretch is let be, a longer way is gone by grace. True once it gives up.
  stalled(dt) {
    if (!this.path.length && !this.yielding) { this.stall = null; return false; }
    const s = (this.stall ??= { x: this.pos.x, z: this.pos.y, t: 0 });
    if (Math.hypot(this.pos.x - s.x, this.pos.y - s.z) > STALL.dist) {
      s.x = this.pos.x;
      s.z = this.pos.y;
      s.t = 0;
      return false;
    }
    s.t += dt;
    if (s.t < STALL.after || !this.goal || this.dragged || this.fade < 0.99 || this.intent.kind === 'leave') return false;
    this.stall = null;
    this.yielding = null;
    const [gx, gz] = this.goal;
    if (Math.hypot(gx - this.pos.x, gz - this.pos.y) < STALL.near) {
      this.path = [];
      this.arrive();
    } else this.fastTravel(gx, gz);
    return true;
  }

  arrive() {
    this.arrived = true;
    this.arrivedAt = performance.now() / 1000;
    this.wp = null;
    this.steerV = null;
  }

  // Held up (no nearer the next waypoint for CROWD.stuckAfter seconds, however much it shuffles
  // about): when it and another block each other, the one of lower rank gives way; otherwise it
  // plans a new way round whoever stands in its way (or simply anew, if it's caught on nothing
  // but a wall). True while giving way.
  unstick(dt, ux, uz) {
    const wp = this.path[0];
    const d = Math.hypot(wp[0] - this.pos.x, wp[1] - this.pos.y);
    if (this.wp !== wp || d < this.bestD - 0.15) {
      this.wp = wp;
      this.bestD = d;
      this.stuckT = 0;
    } else this.stuckT += dt;
    if (this.stuckT < CROWD.stuckAfter) return false;
    this.wp = null;
    this.stuckT = 0;
    const now = this.ctx.director.clock;
    this.heldUp = now;
    // held up a step from where it's going: it stops there (and steps onto its spot, if it has one,
    // once that's free: `settle`)
    const end = this.path[this.path.length - 1];
    if (this.path.length === 1 && Math.hypot(end[0] - this.pos.x, end[1] - this.pos.y) < CROWD.radius * 2 + 0.3) {
      this.path = [];
      this.arrive();
      return false;
    }
    const blockers = this.ctx.crowd.blockers(this, ux, uz);
    const rival = blockers.find((b) => {
      const o = b.who;
      // (one giving way itself, backing into it, it lets by as well)
      if (!o.path?.length || o.piloted || o.yielding?.rival === this || (o.rank < this.rank && !o.yielding)) return false;
      const v = o.vel || { x: 0, z: 0 };
      return o.stuckT > 0.3 || now - (o.heldUp ?? -9) < 1 || v.x * ux + v.z * uz < -0.2; // held up too, or coming this way
    });
    if (rival) {
      this.standAside(rival.who, ux, uz);
      return true;
    }
    if (this.goal) {
      // round those standing still in the way (a moving one will have gone on by the time it gets there)
      const still = blockers.filter((b) => !b.who.vel || Math.hypot(b.who.vel.x, b.who.vel.z) < 0.4);
      const avoid = still.map((b) => [b.pos.x, b.pos.y, b.r + CROWD.radius * 0.6]);
      const from = [this.pos.x, this.pos.y];
      const round = this.ctx.nav.path(from, this.goal, avoid);
      this.path = round.failed ? this.ctx.nav.path(from, this.goal) : round; // (no way round: the way there is)
    }
    return false;
  }

  // Giving way to `rival` (who goes first): out of its way, to its own right if there's room there
  // (everyone keeps to the right), else back the way it came, and on back for as long as the other
  // keeps coming (out of a narrow way, if that's where they met); then, once the other has gone
  // by, on to where it was going by a new path.
  standAside(rival, ux, uz) {
    this.yielding = { t: 0, rival, ux, uz, to: this.asideSpot(ux, uz) };
  }

  asideSpot(ux, uz) {
    const crowd = this.ctx.crowd;
    const { x, y: z } = this.pos;
    const pad = 0.1; // (squeezed into a narrow way, it may well stand nearer the wall than usual)
    for (const [ox, oz, s] of [[-uz, ux, 1.2], [-uz, ux, 0.7], [-ux, -uz, 1.0], [-ux, -uz, 0.5]]) {
      const tx = x + ox * s;
      const tz = z + oz * s;
      if (crowd.ground(tx, tz, pad) && crowd.ground(x + ox * s * 0.5, z + oz * s * 0.5, pad) && !crowd.occupant(tx, tz, this)) return [tx, tz];
    }
    return [x, z];
  }

  giveWay(dt) {
    const y = this.yielding;
    y.t += dt;
    const o = y.rival;
    const rx = o.pos.x - this.pos.x;
    const rz = o.pos.y - this.pos.y;
    const dist = Math.hypot(rx, rz);
    const v = o.vel || { x: 0, z: 0 };
    const passed = rx * y.ux + rz * y.uz < -CROWD.radius * 2; // it's gone by
    const gone = o.dead || o.travel || (!o.path?.length && !o.yielding);
    const coming = v.x * -rx + v.z * -rz > 0.2 * dist;
    if (passed || gone || y.t > CROWD.yieldTime * 5 || (y.t > CROWD.yieldTime && !coming && dist > CROWD.radius * 2 + 1)) {
      this.yielding = null;
      this.stuckT = 0;
      this.wp = null;
      this.steerV = null;
      this.path = this.goal ? this.ctx.nav.path([this.pos.x, this.pos.y], this.goal) : [];
      if (!this.path.length) this.arrive();
      return true;
    }
    let dx = y.to[0] - this.pos.x;
    let dz = y.to[1] - this.pos.y;
    let d = Math.hypot(dx, dz);
    if (d < 0.05 && dist < CROWD.radius * 2 + 0.5) {
      // there, and it's still upon it: further aside (or back)
      y.to = this.asideSpot(y.ux, y.uz);
      dx = y.to[0] - this.pos.x;
      dz = y.to[1] - this.pos.y;
      d = Math.hypot(dx, dz);
    }
    if (d > 0.05) {
      // (by the same rule as a push: sliding along a wall in the way, never into it)
      const k = Math.min(1, (this.speedFor() * 0.9 * dt) / d);
      if (!this.ctx.crowd.move(this, dx * k, dz * k)) y.to = [this.pos.x, this.pos.y];
      if (Math.abs(dx) > 0.05) this.body.facing = dx > 0 ? 1 : -1;
      this.body.play('walk');
    } else {
      this.body.facing = rx > 0 ? 1 : -1; // (watching it go by)
      this.body.play('idle');
    }
    return true;
  }

  // Pushed off its spot (its seat, its place at a station, at grace or by the gate): once it has
  // been off it a moment and nobody stands on it, it steps back onto it.
  settle(dt) {
    const s = this.slot;
    if (!s || this.talk || !SETTLED.has(this.intent.kind) || Math.hypot(s.x - this.pos.x, s.z - this.pos.y) < 0.3) {
      this.pushedT = 0;
      return;
    }
    this.pushedT += dt;
    if (this.pushedT < CROWD.returnDelay || this.ctx.crowd?.occupant(s.x, s.z, this)) return;
    this.pushedT = 0;
    this.goal = [s.x, s.z];
    this.path = this.ctx.nav.path([this.pos.x, this.pos.y], this.goal);
    this.arrived = false;
  }

  pursue(dt, t) {
    if (this.talk) {
      this.body.facing = this.talk.partner.pos.x > this.pos.x ? 1 : -1;
      this.body.play(this.slot?.hub ? 'sit' : this.talk.speaking ? 'talk' : 'idle');
      return false;
    }
    if (this.followPath(dt)) return true;
    this.settle(dt);
    if (this.path.length) return false; // (stepping back onto its spot, from the next frame)
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
    for (const g of this.spectre?.trail || []) {
      this.ctx.scene.remove(g.ghost);
      g.ghost.material.map.dispose();
      g.ghost.material.dispose();
    }
    this.body.dispose();
    this.ctx.scene.remove(this.ring);
    this.ring.material.dispose();
    this.ring.geometry.dispose();
  }
}
