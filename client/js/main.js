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
import { SPRING } from './npc.js';
import { connect } from './net.js';
import { Demo } from './demo.js';
import { loadHeroSheets } from './heroes/index.js';
import { loadSheet } from './heroes/core.js';
import { loadFxArt } from './fxart.js';
import bossRig from './heroes/boss.js';
import golemRig from './heroes/golem.js';
import spectreRig from './heroes/spectre.js';
import { loadFireArt } from './fire.js';
import { Pilot } from './pilot.js';
import { HUB_LAYOUT } from './config.js';
import { Daylight } from './daylight.js';
import { Interact } from './interact.js';
import { Fight } from './fight.js';
import { Crowd } from './crowd.js';
import { Guide } from './guide.js';
import { Ults } from './ults.js';
import { Training } from './training.js';
import { setView, setLights } from './spellfx.js';
import { groundAt } from './ground.js';
import { Companions } from './companions.js';
import { PUBLIC_DEMO } from './mode.js';
import { started, markReady } from './gate.js';

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
setView(camera); // (what flies points the way it goes, as it shows through this: spellfx.js)
const rig = new CameraRig(camera);
const particles = new Particles(scene);
const world = new World(scene, particles);
setLights((at, look) => world.flash(at, look)); // (effects light the world for a moment: spellfx.js)
const nav = new Nav(world);
const ui = new UI(camera, canvas);
// The Stormbound Knight is worn by Maren (thee); the sessions share the other heroes.
// (the great enemies of the arena too, fight.js: should one's art fail, only the other comes)
// (and the spectres called up when every hero is busy, director.js: without their art, sessions
// wait for a free hero instead)
const [allHeroes, fireArt, bossSheet, golemSheet, spectreSheet] = await Promise.all([
  loadHeroSheets(),
  loadFireArt(),
  loadSheet(bossRig).catch((err) => { console.warn('Boss art unavailable', err); return null; }),
  loadSheet(golemRig).catch((err) => { console.warn('Golem art unavailable', err); return null; }),
  loadSheet(spectreRig).catch((err) => { console.warn('Spectre art unavailable', err); return null; }),
  loadFxArt(), // (the effects drawn for the ultimates, fxart.js: kept there)
]);
world.fireArt = fireArt; // (each island lights its own when it's built, region.js)
world.hub.lightFires(fireArt);
world.arena.lightFires(fireArt);
const playerSheet = allHeroes.find((s) => s.hero === 'knight') || null;
const ctx = { scene, world, nav, particles, ui, director: null, heroSheets: allHeroes.filter((s) => s !== playerSheet), bossSheet, golemSheet, spectreSheet };
const director = new Director(ctx);
ctx.director = director;
const keys = new Set();
const pilot = new Pilot(ctx, keys); // thee: Maren at first, or whoever thou hast become
ctx.pilot = pilot;
Object.defineProperty(ctx, 'player', { get: () => pilot.npc });

// ---------------------------------------------------------------------------------------------
// thee and the camera locked on thee; travel by grace between areas; the overview

// the areas on the map: the Hold and every island that has risen (not one still under the mist,
// nor one sinking back into it)
const areas = () => [world.hub, ...world.regionList().filter((r) => r.risen && !r.sinking)].sort((a, b) => a.cx - b.cx);
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
  if (PUBLIC_DEMO) director.holdRisesUntil(director.clock + 5); // the first island rises 5 s after thee
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
    // (only where one may go by grace just now: the Hold alone, while a great enemy is abroad)
    const here = areaOfPlayer();
    const list = areas().filter((a) => a === here || pilot.canTravelTo(a));
    let i = list.indexOf(here);
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
// as a great enemy comes, whom thou takest with thee (companions.js): the arena rises after
const companions = new Companions(ctx);
ctx.companions = companions;
ui.canSummon = () => fight.canSummon();
ui.hushed = () => director.worldPaused; // no session banners while the world holds still for a great enemy
const crowd = new Crowd(ctx); // characters are solid
ctx.crowd = crowd;
const guide = new Guide(ctx); // the way to the arena, while a great enemy is abroad
document.getElementById('table-summon').addEventListener('click', () => {
  ui.closeTable();
  fight.call({ kind: 'summon' }); // (thy companions first: companions.js)
});
document.getElementById('table-sit').addEventListener('click', () => {
  ui.closeTable();
  const me = pilot.npc;
  if (!me || pilot.busy(me)) return;
  me.action = { kind: 'use', anim: 'sit', t: 0, dur: Infinity };
  me.body.play('sit', true);
});
document.getElementById('table-leave').addEventListener('click', () => ui.closeTable());
let entered = false; // (thou'st set out from the title screen: begin)
new Input({
  canvas, camera, rig, director, ui, travel, keys,
  active: () => entered && !companions.shown, // (no keys reach the world under the title screen, nor while thou choosest thy companions)
  battle: () => fight.inBattle(),
  floor: () => (pilot.npc ? groundAt(pilot.npc.pos.x, pilot.npc.pos.y) : 0),
  actions: {
    emote: (key) => pilot.npc && director.gesture(pilot.npc, key),
    attack: (at) => pilot.attack(at),
    spell: (at) => pilot.cast(at), // right click: a spell (Fortuna, the mages)
    ult: (at) => (training.has(pilot.npc) ? training : fight).playerUlt(at), // R: thine ultimate, once full (ults.js; always, on the training yard)
    crouch: () => pilot.toggleCrouch(),
    interact: () => { if (ui.tableOpen) ui.closeTable(); else interact.press(); },
    dodge: () => pilot.dodge(),
    focus: () => fight.toggleFocus(), // Q: the camera on a great enemy, or back on thee
    // B (or a click on thyself): thine own fan of gestures, over thy head (not while a great enemy
    // is abroad: no gestures then, director.gesture)
    fan: () => {
      const me = pilot.npc;
      if (!me || fight.hunting()) return;
      if (ui.fanOwner === me) { ui.closeFan(); return; }
      director.select(null);
      ui.openFan(me);
    },
  },
});
const post = new Post(renderer, scene, camera);
ctx.post = post;
// ultimates: the world standing still and grey round whoever looses one (ults.js)
const ults = new Ults(ctx);
ctx.ults = ults;
// the training yard below the Hold: its dummies, and thy blows, spells and ultimates on them
const training = new Training(ctx);
ctx.training = training;
training.start();
const daylight = new Daylight({ renderer, scene, world, post, ui }); // day and night take turns
ctx.daylight = daylight;
director.start(); // the heroes take their seats at the Round Table (the Twofold in the form for the hour)
const perf = new Perf(renderer, post, resize);
const demo = new Demo(director);

// ---------------------------------------------------------------------------------------------
// bridge

let connected = false;
if (PUBLIC_DEMO) {
  // The public demo: no bridge and no real data, an endless world of made-up sessions instead.
  // Islands nobody works on any more sink back into the mist, and great enemies come oftener.
  document.body.classList.add('public-demo');
  director.retireAfter = 45;
  director.riseGap = 60; // a minute between islands, to look round each before the next
  ui.noticeGap = 40; // and no more than one session banner in 40 seconds (the log has them all)
  director.notBefore = Infinity; // no island rises before thou art up (spawnPlayer)
  fight.pace({ first: 100 + Math.random() * 60, invasion: [5 * 60, 9 * 60], cooldown: 5 * 60 });
  ui.setStatus('demo', true);
} else {
  // (the sessions take up their heroes behind the title already: they're at the Round Table when
  // thou comest in)
  connect({
    onSnapshot: (sessions) => director.snapshot(sessions),
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
  ults.particles.setViewport(bufferHeight, camera.fov);
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------------------------
// loop

let last = performance.now();
let t = 0;
let camMode = null; // in a fight on the arena: 'boss' (showing him), 'thee' (following thee), and in his great attack 'roar' (him) and 'wide' (the whole arena); on the training yard, 'great' (by its great dummy)
let camBase = FOLLOW_DIST; // how far back the camera was before the fight took it over

function step(dt) {
  // an ultimate being loosed (ults.js): the world stands still (wdt) but for whoever looses it,
  // and the camera closes on them; a heavy blow landing (fight.js, hit-stop) holds it still a
  // moment too
  const wdt = fight.held(dt) || training.held(dt) || ults.frozen ? 0 : dt;
  t += wdt;
  SPRING.t += wdt; // (the drawings' lunges and knocks keep the world's time, npc.js)
  const me = pilot.npc; // moved by the director with everyone else (its update asks the pilot)
  const shot = ults.shot();
  if (shot) {
    rig.target.set(shot.at[0], shot.at[1], shot.at[2] - 0.6);
  } else if (me) {
    if (overview && pilot.moving) endOverview();
    if (!overview) {
      // fighting a great enemy on the arena: the camera shows him as he enters, then follows thee
      // (or, with its focus on him, Q, looks between thee and him), pulled back far enough to keep
      // his height in view; so too by the training yard's great dummy (training.js)
      const aim = fight.aim(me) || training.aim(me);
      // (how far back: set as it changes between showing him and following thee, so a scroll of
      // the wheel still zooms; and as the fight ends, back to how far it was before)
      const mode = aim ? aim.mode || (aim.at ? 'boss' : 'thee') : null;
      if (mode !== camMode) {
        if (!camMode) camBase = rig.distGoal;
        rig.distGoal = mode ? Math.max(camBase, aim.dist) : camBase;
        camMode = mode;
      }
      const [x, y, z] = aim?.at || [me.pos.x, groundAt(me.pos.x, me.pos.y) + 0.8, me.pos.y];
      rig.target.set(x, y, z - 0.6);
    }
  }
  rig.update(dt);
  // Thin the fog as the camera pulls back so the overview isn't swallowed by it.
  daylight.update();
  scene.fog.density = 0.0105 * Math.min(1, 30 / rig.dist) * daylight.fogDensity;
  world.update(wdt, t, camera, rig.dist, director.hubVisitors || 0);
  director.update(wdt, t);
  fight.update(wdt, t);
  training.update(wdt);
  crowd.resolve(wdt); // once everyone has moved: nobody stands inside anybody
  guide.update(wdt);
  document.body.classList.toggle('in-battle', fight.inBattle()); // (no labels to click mid-fight)
  if (fight.hunting() && ui.fanOwner?.piloted) ui.closeFan(); // (thy gestures fold away as a great enemy comes)
  particles.update(wdt, t);
  ults.update(dt, wdt);
  ui.overview = rig.dist > 40;
  ui.setFocusArea(world.areaAt(rig.cur.x, rig.cur.z), t);
  ui.updateLabels(areas());
  // the map strip: where thou art, between islands too, and the arena while a great enemy is abroad
  ui.updateMap(me ? me.pos.x : 0, fight.hunting(), fight.sealed);
  ui.update(dt);
  training.placeButtons(); // (the button under each one training on the yard)
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

// Handy for poking at the scene from the dev console. advance(s) steps the simulation by s
// seconds even when the tab is in the background (where requestAnimationFrame pauses).
window.elden = {
  scene, world, director, demo, rig, renderer, travel, nav, post, perf, daylight, fight, ults,
  pilot,
  get player() { return pilot.npc; },
  keys,
  advance(seconds) {
    for (let i = 0; i < seconds * 30; i++) step(1 / 30);
    post.render(0, t);
  },
};

// The title screen (title.js) stands over all this. Behind it the camera waits where thou'lt rise
// and draws one frame (so that what it shows is ready to be drawn, shaders and all); then the
// world is ready (gate.js), and once thou settest out it begins: thou risest at grace, the public
// demo's sessions start, and time runs.
function begin() {
  entered = true;
  spawnPlayer();
  if (PUBLIC_DEMO) demo.startWorld();
  else if (new URLSearchParams(window.location.search).has('demo')) setTimeout(toggleDemo, 600);
  last = performance.now();
  requestAnimationFrame(frame);
}
try {
  nav.sync();
  const [gx, gz] = nav.clampToWalkable(HUB_LAYOUT.grace[0] + 1.6, HUB_LAYOUT.grace[1] + 1.8);
  rig.flyTo(gx, gz, FOLLOW_DIST);
  rig.target.set(gx, 0.8, gz - 0.6);
  rig.snap();
  step(0);
  if (window.innerWidth && window.innerHeight) post.render(0, t); // (a page out of sight has nothing to draw into)
} catch (err) {
  console.error('Warming up the first frame failed (the world carries on):', err);
}
markReady();
await started;
begin();
