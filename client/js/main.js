// Elden Code — boots the world, wires the bridge stream to the director, runs the loop.

import * as THREE from 'three';
import { Particles } from './particles.js';
import { World } from './world.js';
import { Nav } from './nav.js';
import { Director } from './director.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { Post } from './post.js';
import { Perf } from './perf.js';
import { CameraRig } from './camera.js';
import { connect } from './net.js';
import { Demo } from './demo.js';
import { loadHeroSheets } from './heroes/index.js';
import { loadSheet } from './heroes/core.js';
import bossRig from './heroes/boss.js';
import { loadFireArt } from './fire.js';
import { Pilot } from './pilot.js';
import { HUB_LAYOUT } from './config.js';
import { Daylight } from './daylight.js';
import { Interact } from './interact.js';
import { Fight } from './fight.js';
import { PUBLIC_DEMO } from './mode.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b0c10');
scene.fog = new THREE.FogExp2('#16171d', 0.0105);

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 1500);
const rig = new CameraRig(camera);
const particles = new Particles(scene);
const world = new World(scene, particles);
const nav = new Nav(world);
const ui = new UI(camera, canvas);
// The Stormbound Knight is worn by Maren (thee); the sessions share the other heroes.
// (the great enemy of the arena too, fight.js: should his art fail, a stand-in shade comes instead)
const [allHeroes, fireArt, bossSheet] = await Promise.all([
  loadHeroSheets(),
  loadFireArt(),
  loadSheet(bossRig).catch((err) => { console.warn('Boss art unavailable', err); return null; }),
]);
world.hub.lightFires(fireArt);
world.arena.lightFires(fireArt);
const playerSheet = allHeroes.find((s) => s.hero === 'knight') || null;
const ctx = { scene, world, nav, particles, ui, director: null, heroSheets: allHeroes.filter((s) => s !== playerSheet), bossSheet };
const director = new Director(ctx);
ctx.director = director;
const keys = new Set();
const pilot = new Pilot(ctx, keys); // thee: Maren at first, or whoever thou hast become
ctx.pilot = pilot;
Object.defineProperty(ctx, 'player', { get: () => pilot.npc });

// ---------------------------------------------------------------------------------------------
// thee and the camera locked on thee; travel by grace between areas; the overview

const areas = () => [world.hub, ...world.regionList()].sort((a, b) => a.cx - b.cx);
const FOLLOW_DIST = 22;
let overview = null; // { dist } to return to while the overview is shown

// Maren rises from grace in Roundtable Hold, between the great grace and the Round Table, where
// everyone gathers before the islands rise, and the player starts out as her.
function spawnPlayer() {
  if (pilot.npc) return;
  nav.sync();
  const [x, z] = nav.clampToWalkable(HUB_LAYOUT.grace[0] + 1.6, HUB_LAYOUT.grace[1] + 1.8);
  const maren = director.addMaren(playerSheet, x, z);
  maren.spawn(true);
  pilot.take(maren);
  rig.flyTo(x, z, FOLLOW_DIST);
  rig.target.set(x, 0.8, z - 0.6);
  rig.snap();
}

function endOverview() {
  if (!overview) return;
  rig.distGoal = overview.dist;
  overview = null;
}

function areaOfPlayer() {
  const me = pilot.npc;
  return me ? world.areaAt(me.pos.x, me.pos.y) || me.region : world.hub;
}

function focusTarget(target) {
  if (!pilot.npc) return;
  endOverview();
  if (target.region) {
    pilot.travelTo(target.region);
  } else if (target.pos && !target.dead) {
    if (target !== pilot.npc) director.select(target);
    const there = world.areaAt(target.pos.x, target.pos.y);
    if (there && there !== areaOfPlayer()) pilot.travelTo(there);
  }
}

const travel = {
  cycle(dir) {
    const me = pilot.npc;
    if (!me) return;
    endOverview();
    const list = areas();
    let i = list.indexOf(areaOfPlayer());
    if (i < 0) i = list.reduce((best, a, k) => (Math.abs(a.cx - me.pos.x) < Math.abs(list[best].cx - me.pos.x) ? k : best), 0);
    pilot.travelTo(list[(i + dir + list.length) % list.length]);
  },
  home() {
    endOverview();
    pilot.travelTo(world.hub);
  },
  overview() {
    if (overview) { endOverview(); return; }
    overview = { dist: rig.distGoal };
    const { minX, maxX } = world.extent();
    const aspect = window.innerWidth / window.innerHeight;
    const fit = (maxX - minX + 10) / (2 * Math.tan((camera.fov * Math.PI) / 360) * aspect);
    rig.flyTo((minX + maxX) / 2, -1, Math.max(40, Math.min(rig.overviewMax, fit)));
  },
};

ctx.onWorldGrew = () => {
  const { minX, maxX } = world.extent();
  rig.setBounds(minX, maxX);
};

// Only the one thou art can be made to gesture; anyone else's fan offers to become them.
ui.onGesture = (npc, key) => { if (npc === pilot.npc) director.gesture(npc, key); };
ui.onBecome = (npc) => {
  if (!npc || npc.dead || npc === pilot.npc) return;
  director.select(null);
  ui.closeFan();
  pilot.take(npc);
  ui.log(`Thou art ${npc.displayName}`, 'gold', npc);
};
ui.onDeselect = () => director.select(null);
ui.onFocus = focusTarget;

// E: use what's in reach; the Round Table opens its menu
const interact = new Interact(ctx);
// great enemies in the Arena of Trials, north of the Hold
ctx.rig = rig;
const fight = new Fight(ctx);
ctx.fight = fight;
ui.canSummon = () => fight.canSummon();
document.getElementById('table-summon').addEventListener('click', () => {
  ui.closeTable();
  fight.start({ kind: 'summon' });
});
document.getElementById('table-sit').addEventListener('click', () => {
  ui.closeTable();
  const me = pilot.npc;
  if (!me || pilot.busy(me)) return;
  me.action = { kind: 'use', anim: 'sit', t: 0, dur: Infinity };
  me.body.play('sit', true);
});
document.getElementById('table-leave').addEventListener('click', () => ui.closeTable());
new Input({
  canvas, camera, rig, director, ui, travel, keys,
  battle: () => fight.inBattle(),
  actions: {
    emote: (key) => pilot.npc && director.gesture(pilot.npc, key),
    attack: (at) => pilot.attack(at ? at.x : null),
    crouch: () => pilot.toggleCrouch(),
    interact: () => { if (ui.tableOpen) ui.closeTable(); else interact.press(); },
    dodge: () => pilot.dodge(),
    // B (or a click on thyself): thine own fan of gestures, over thy head
    fan: () => {
      const me = pilot.npc;
      if (!me) return;
      if (ui.fanOwner === me) { ui.closeFan(); return; }
      director.select(null);
      ui.openFan(me);
    },
  },
});
const post = new Post(renderer, scene, camera);
const daylight = new Daylight({ renderer, scene, world, post, ui }); // day and night take turns
ctx.daylight = daylight;
director.start(); // the heroes take their seats at the Round Table (the Twofold in the form for the hour)
const perf = new Perf(renderer, post, resize);
const demo = new Demo(director);

// ---------------------------------------------------------------------------------------------
// bridge

let connected = false;
let firstSnapshot = true;
if (PUBLIC_DEMO) {
  // The public demo: no bridge and no real data, an endless world of made-up sessions instead.
  // Islands nobody works on any more sink back into the mist, and great enemies come oftener.
  document.body.classList.add('public-demo');
  director.retireAfter = 45;
  // (a lighter enemy: with nobody at the keyboard, the Tarnished should stand a fair chance)
  fight.pace({ first: 100 + Math.random() * 60, invasion: [5 * 60, 9 * 60], cooldown: 5 * 60, bossHp: 700 });
  ui.setStatus('demo', true);
  demo.startWorld();
} else {
  connect({
    onSnapshot: (sessions) => {
      director.snapshot(sessions);
      if (firstSnapshot) {
        firstSnapshot = false;
        spawnPlayer();
      }
    },
    onEvent: (ev, session) => director.event(ev, session),
    onStatus: (ok) => {
      connected = ok;
      ui.setStatus(ok, demo.active);
    },
  });
}

const toggleDemo = () => {
  if (PUBLIC_DEMO) return;
  demo.toggle();
  ui.setStatus(connected, demo.active);
};
document.getElementById('demo-btn').addEventListener('click', toggleDemo);
document.getElementById('empty-demo').addEventListener('click', toggleDemo);
// The two panels at the top right: the controls menu and "how it works"; one at a time, Esc closes.
const keysPanel = document.getElementById('keys');
const keysBtn = document.getElementById('keys-btn');
const help = document.getElementById('help');
const helpBtn = document.getElementById('help-btn');
const showPanel = (panel, open) => {
  for (const [p, b] of [[keysPanel, keysBtn], [help, helpBtn]]) {
    p.hidden = p === panel ? !open : true;
    b.setAttribute('aria-expanded', String(!p.hidden));
  }
};
keysBtn.addEventListener('click', () => showPanel(keysPanel, keysPanel.hidden));
document.getElementById('keys-close').addEventListener('click', () => showPanel(keysPanel, false));
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') showPanel(null, false); });
helpBtn.addEventListener('click', () => {
  showPanel(help, help.hidden);
});
document.getElementById('help-close').addEventListener('click', () => {
  help.hidden = true;
  helpBtn.setAttribute('aria-expanded', 'false');
});
if (new URLSearchParams(window.location.search).has('demo')) setTimeout(toggleDemo, 600);
// Without the bridge there is no snapshot: Maren arrives anyway.
setTimeout(spawnPlayer, 1500);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const ratio = perf.ratio(w, h);
  renderer.setPixelRatio(ratio);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 42 : 30;
  camera.updateProjectionMatrix();
  post.setSize(w, h, ratio);
  const bufferHeight = h * ratio;
  particles.setViewport(bufferHeight, camera.fov);
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------------------------
// loop

let last = performance.now();
let t = 0;

function step(dt) {
  t += dt;
  const me = pilot.npc; // moved by the director with everyone else (its update asks the pilot)
  if (me) {
    if (overview && pilot.moving) endOverview();
    if (!overview) {
      // fighting a great enemy on the arena: the camera looks between thee and him, pulled back
      // far enough to keep his height in view
      const aim = fight.aim(me);
      if (aim) rig.distGoal = Math.max(rig.distGoal, 30);
      const [x, y, z] = aim || [me.pos.x, 0.8, me.pos.y];
      rig.target.set(x, y, z - 0.6);
    }
  }
  rig.update(dt);
  // Thin the fog as the camera pulls back so the overview isn't swallowed by it.
  daylight.update();
  scene.fog.density = 0.0105 * Math.min(1, 30 / rig.dist) * daylight.fogDensity;
  world.update(dt, t, camera, rig.dist, director.hubVisitors || 0);
  director.update(dt, t);
  fight.update(dt, t);
  document.body.classList.toggle('in-battle', fight.inBattle()); // (no labels to click mid-fight)
  particles.update(dt, t);
  ui.overview = rig.dist > 40;
  ui.setFocusArea(world.areaAt(rig.cur.x, rig.cur.z), t);
  ui.updateLabels(areas());
  ui.update(dt);
  interact.update();
  // walking away from the Round Table folds its menu
  if (ui.tableOpen && (!me || Math.hypot(me.pos.x - HUB_LAYOUT.table[0], me.pos.y - HUB_LAYOUT.table[1]) > 4)) ui.closeTable();
}

let frameErrors = 0;
function frame(now) {
  requestAnimationFrame(frame); // asked for first, so one bad frame can never stop the world for good
  perf.frame(now - last);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  try {
    step(dt);
    post.render(dt, t);
  } catch (err) {
    if (frameErrors++ % 300 === 0) console.error('A frame failed (the world carries on):', err);
  }
}
requestAnimationFrame(frame);

// Handy for poking at the scene from the dev console. advance(s) steps the simulation by s
// seconds even when the tab is in the background (where requestAnimationFrame pauses).
window.elden = {
  scene, world, director, demo, rig, renderer, travel, nav, post, perf, daylight, fight,
  pilot,
  get player() { return pilot.npc; },
  keys,
  advance(seconds) {
    for (let i = 0; i < seconds * 30; i++) step(1 / 30);
    post.render(0, t);
  },
};
