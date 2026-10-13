// Day and night over the Lands Between. The night is the world as it was first made: moonlit,
// starry and lamplit. The day is bright like Octopath Traveler's dioramas: a blue sky with
// drifting cloud, a warm sun throwing shadows, a sea of white cloud below the islands, fuller
// colour. Each lasts 18 minutes, the last 2 of them a slow dusk (or dawn) into the other, the
// light turning orange and the horizon glowing halfway through.
//
// The hour comes from the real clock, so every tab, and a reload, agree on it. In the address
// bar, ?time=day or ?time=night holds one, and ?time=fast runs a whole day in two minutes.

import * as THREE from 'three';
import { SPRITE_LIGHT } from './npc.js';

export const CYCLE = { day: 18 * 60, night: 18 * 60, turn: 2 * 60 }; // seconds

// Everything that changes between the two, night first.
const LOOK = {
  exposure: [1.4, 1.08],
  fog: ['#16171d', '#9cbde6'],
  fogDensity: [1, 0.34], // the clear air of day
  background: ['#0b0c10', '#9fb8d6'],
  spires: ['#0d0e13', '#7f92ad'], // the far skyline: dark spires by night, gone in the haze of day
  spireOpacity: [1, 0],
  hemiSky: ['#6a7799', '#d2e2ff'],
  hemiGround: ['#2a2119', '#7a6a52'],
  hemi: [2.3, 2.0],
  sun: ['#9fb2e0', '#fff0d4'], // the moon by night
  sunIntensity: [2.3, 6.8],
  sunFrom: [[-10, 24, -9], [-12, 26, 10]], // relative to what the camera looks at; by day from the front
  fill: ['#7f8fb8', '#ffe6c4'],
  fillIntensity: [0.8, 1.0],
  lamps: [1, 0.35], // braziers, torches and graces matter less in daylight
  // the characters: unchanged at night; by day softer in the sun, with less self-light and glow
  spriteLit: [1, 0.62],
  spriteSelf: [1, 0.15],
  spriteGlow: [1, 0.5],
  bloomThreshold: [0.9, 1.35],
  bloomStrength: [0.6, 0.42],
  vignette: [0.45, 0.24],
};

// Halfway between the two (dusk, dawn): the light the colours above are pulled toward.
const DUSK = { sun: '#ff8a4c', hemiSky: '#8c6c94', fog: '#6e5266' };

const ease = (x) => x * x * (3 - 2 * x);

// How much day it is (0 night .. 1 day) at a time in seconds.
export function dayAt(seconds) {
  const { day, night, turn } = CYCLE;
  const len = day + night;
  const s = ((seconds % len) + len) % len;
  if (s < day - turn) return 1;
  if (s < day) return 1 - ease((s - (day - turn)) / turn);
  if (s < len - turn) return 0;
  return ease((s - (len - turn)) / turn);
}

export class Daylight {
  constructor({ renderer, scene, world, post, ui }) {
    Object.assign(this, { renderer, scene, world, post, ui });
    this.mode = new URLSearchParams(location.search).get('time'); // day | night | fast | null
    this.held = null;
    this.amount = null;
    this.fogDensity = 1; // how thick the fog is, relative to night (main.js applies it)
    const colors = (pair) => pair.map((c) => new THREE.Color(c));
    this.c = Object.fromEntries(['fog', 'background', 'spires', 'hemiSky', 'hemiGround', 'sun', 'fill'].map((k) => [k, colors(LOOK[k])]));
    this.sunFrom = LOOK.sunFrom.map((v) => new THREE.Vector3(...v));
    this.dusk = Object.fromEntries(Object.entries(DUSK).map(([k, c]) => [k, new THREE.Color(c)]));
  }

  // Hold the light at an amount of day (0..1), or give it back to the clock with null.
  hold(amount) {
    this.held = amount;
  }

  now() {
    if (this.held != null) return this.held;
    if (this.mode === 'day') return 1;
    if (this.mode === 'night') return 0;
    const s = Date.now() / 1000;
    return dayAt(this.mode === 'fast' ? (s * (CYCLE.day + CYCLE.night)) / 120 : s);
  }

  update() {
    const d = this.now();
    if (d === this.amount) return;
    // dusk and dawn are announced as they begin
    if (this.amount === 1 && d < 1) this.ui.log('Dusk falls over the Lands Between', 'gold');
    if (this.amount === 0 && d > 0) this.ui.log('Dawn breaks over the Lands Between', 'gold');
    this.amount = d;
    this.apply(d);
  }

  apply(d) {
    const dusk = 4 * d * (1 - d); // 0 by full day or night, 1 halfway through dusk or dawn
    const num = (k) => LOOK[k][0] + (LOOK[k][1] - LOOK[k][0]) * d;
    const col = (target, k) => {
      target.lerpColors(this.c[k][0], this.c[k][1], d);
      if (this.dusk[k]) target.lerp(this.dusk[k], dusk * 0.65);
    };
    const { world, post, scene } = this;
    this.renderer.toneMappingExposure = num('exposure');
    col(scene.fog.color, 'fog');
    this.fogDensity = num('fogDensity');
    col(scene.background, 'background');
    col(world.spireMat.color, 'spires');
    world.spireMat.opacity = num('spireOpacity');
    world.skyline.visible = world.spireMat.opacity > 0.01;
    col(world.hemi.color, 'hemiSky');
    col(world.hemi.groundColor, 'hemiGround');
    world.hemi.intensity = num('hemi');
    col(world.moon.color, 'sun');
    world.moon.intensity = num('sunIntensity');
    world.sunFrom.lerpVectors(this.sunFrom[0], this.sunFrom[1], d);
    col(world.fill.color, 'fill');
    world.fill.intensity = num('fillIntensity');
    world.lampLevel = num('lamps');
    SPRITE_LIGHT.lit.value = num('spriteLit');
    SPRITE_LIGHT.self.value = num('spriteSelf');
    SPRITE_LIGHT.glow.value = num('spriteGlow');
    world.uDay.value = d;
    world.skyUniforms.uDusk.value = dusk;
    world.mistUniforms.uDusk.value = dusk;
    post.bloom.threshold = num('bloomThreshold');
    post.bloom.strength = num('bloomStrength');
    post.grade.uniforms.uVignette.value = num('vignette');
    post.grade.uniforms.uDay.value = d;
    // the HUD's gold text needs a darker halo against a bright sky (game.css)
    document.body.classList.toggle('day', d > 0.25);
  }
}
