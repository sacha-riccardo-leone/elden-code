// Sound (Web Audio): what's heard in the Lands Between. Its clips are cut from Sacha's recordings
// and levelled (client/assets/sfx/<set>: the Golem's so far, README), and played where things happen
// in the world, at the moment they happen there (the Golem's foot set down on the frame it lands on,
// golem.js): quieter the farther from where the camera looks, to the left or the right as they show
// on the screen, a little different each time (`vary`), and never too many of one at once (`most`).
// Nothing sounds before thou settest out (a browser lets a page make a sound only once it's been
// clicked: unlock), and V turns it all off and on again (remembered).

import * as THREE from 'three';

const STORE = 'elden-code:sound';

// The sounds, by name: the clips one is played from (one chosen each time), how loud, how much it
// varies (loudness and pitch, a share either way), how many may sound at once, how far off it's
// heard at half its loudness (world units), the silence its clips begin with (`lead`: the encoder's,
// skipped so that it sounds on the very frame), and, looped, the stretch of its clip that repeats.
const SET = '/assets/sfx/';
export const SOUNDS = {
  // the Guardian Golem's (golem.js)
  'golem-step': { set: 'golem', clips: Array.from({ length: 11 }, (_, i) => `step-${i + 1}`), volume: 0.75, vary: 0.08, most: 3, half: 24 },
  'golem-windup': { set: 'golem', clips: ['windup'], volume: 0.7, vary: 0.05, most: 2, half: 24 },
  'golem-strike': { set: 'golem', clips: ['strike'], volume: 0.9, vary: 0.04, most: 3, half: 30 },
  'golem-clang': { set: 'golem', clips: ['clang'], volume: 0.55, vary: 0.08, most: 3, half: 20 },
  'golem-fall-start-1': { set: 'golem', clips: ['fall-start-1'], volume: 0.9, most: 1, half: 26 },
  'golem-fall-start-2': { set: 'golem', clips: ['fall-start-2'], volume: 0.8, most: 1, half: 26 },
  'golem-fall-hit': { set: 'golem', clips: ['fall-hit'], volume: 1, most: 1, half: 30 },
  'golem-fire-start': { set: 'golem', clips: ['fire-start'], volume: 0.8, most: 1, half: 30 },
  'golem-fire': { set: 'golem', clips: ['fire'], volume: 0.75, most: 1, half: 30, loop: [1.2, 2.6] },
  'golem-meteor': { set: 'golem', clips: ['meteor'], volume: 0.5, vary: 0.1, most: 8, half: 22 },
};
const LEAD = 0.04;

export class Sound {
  constructor() {
    this.ctx = null; // (made once the page has been clicked: unlock)
    this.out = null;
    let stored = null;
    try { stored = localStorage.getItem(STORE); } catch {}
    this.on = stored !== 'off';
    this.clips = new Map(); // clip path → AudioBuffer (or the promise of it)
    this.voices = new Map(); // sound name → what's sounding of it
    this.view = null; // { camera, focus }: where it's heard from (main.js)
    this.log = []; // (what was played lately: [seconds, name])
    this.p = new THREE.Vector3();
  }

  // The page has been clicked: sound may begin (and go on, if the browser had held it).
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = this.on ? 1 : 0;
      this.out.connect(this.ctx.destination);
      for (const set of this.wanted || []) this.load(set);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  // Fetches and decodes a set's clips (once), ready for when they're wanted.
  load(set) {
    if (!this.ctx) { (this.wanted ??= new Set()).add(set); return; }
    for (const s of Object.values(SOUNDS)) {
      if (s.set !== set) continue;
      for (const clip of s.clips) {
        const path = `${SET}${set}/${clip}.mp3`;
        if (this.clips.has(path)) continue;
        this.clips.set(path, fetch(path)
          .then((r) => r.arrayBuffer())
          .then((b) => this.ctx.decodeAudioData(b))
          .then((buf) => { this.clips.set(path, buf); return buf; })
          .catch((err) => { console.warn(`Sound ${path} unavailable`, err); this.clips.delete(path); }));
      }
    }
  }

  // V: all of it off, or on again.
  toggle() {
    this.on = !this.on;
    try { localStorage.setItem(STORE, this.on ? 'on' : 'off'); } catch {}
    if (this.out) this.out.gain.setTargetAtTime(this.on ? 1 : 0, this.ctx.currentTime, 0.05);
    return this.on;
  }

  // Plays a sound (SOUNDS) where something happens (`at`: [x, z] in the world; none, wherever one
  // is), `volume` times its own, `delay` seconds from now. Returns what's sounding (stop(fade) ends
  // it, or keeps it from ever beginning: a looped one sounds till then), or null if nothing can be
  // heard.
  play(name, { at = null, volume = 1, delay = 0 } = {}) {
    const s = SOUNDS[name];
    this.log.push([performance.now() / 1000, name]);
    if (this.log.length > 200) this.log.splice(0, 100);
    if (!s || !this.ctx || this.ctx.state !== 'running') return null;
    const clip = s.clips[Math.floor(Math.random() * s.clips.length)];
    const buf = this.clips.get(`${SET}${s.set}/${clip}.mp3`);
    if (!(buf instanceof AudioBuffer)) return null; // (not loaded yet)
    const vary = s.vary || 0;
    const [gain, pan] = this.place(at, s.half ?? 24);
    const loud = (s.volume ?? 1) * volume * gain * (1 + (Math.random() * 2 - 1) * vary);
    if (loud < 0.01) return null;
    // (no more than `most` of it at once: the oldest gives way)
    const playing = (this.voices.get(name) || []).filter((v) => !v.done);
    while (playing.length >= (s.most ?? 4)) playing.shift().stop(0.05);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1 + (Math.random() * 2 - 1) * vary * 0.5;
    if (s.loop) {
      src.loop = true;
      [src.loopStart, src.loopEnd] = s.loop;
    }
    const g = this.ctx.createGain();
    g.gain.value = loud;
    let node = src.connect(g);
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(this.out);
    const begins = this.ctx.currentTime + delay;
    src.start(begins, Math.min(LEAD, buf.duration / 2));
    const voice = {
      done: false,
      stop: (fade = 0.2) => {
        if (voice.done) return;
        voice.done = true;
        const t = this.ctx.currentTime;
        if (t < begins) { src.stop(t); return; } // (not begun: it never will)
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + fade);
        src.stop(t + fade + 0.02);
      },
    };
    src.onended = () => { voice.done = true; };
    playing.push(voice);
    this.voices.set(name, playing);
    return voice;
  }

  // How loud something at `at` is heard, and which way: by its distance from where the camera looks
  // (half as loud `half` off), and where it shows on the screen.
  place(at, half) {
    const v = this.view;
    if (!at || !v) return [1, 0];
    const { camera, focus } = v;
    const d = Math.hypot(at[0] - focus.x, at[1] - focus.z);
    const gain = 1 / (1 + (d / half) ** 2);
    this.p.set(at[0], focus.y, at[1]).project(camera);
    const pan = Math.max(-0.8, Math.min(0.8, this.p.x * 0.75));
    return [gain, Number.isFinite(pan) ? pan : 0];
  }
}
