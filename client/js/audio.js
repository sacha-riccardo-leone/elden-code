// Sound (Web Audio): what's heard in the Lands Between. Its clips are cut from Sacha's recordings
// and levelled (client/assets/sfx/<set>: the Golem's and Wynn's so far, README), and played where
// things happen in the world, at the moment they happen there (the Golem's foot set down on the frame
// it lands on, golem.js; Wynn's blade on the drawing where it cuts, npc.js): quieter the farther from
// where the camera looks, to the left or the right as they show
// on the screen, a little different each time (`vary`), and never too many of one at once (`most`).
// And the music (Music, below): the ambient pieces while nothing's fought, the arena's while a great
// enemy stands in it. Nothing sounds before thou settest out (a browser lets a page make a sound only
// once it's been clicked: unlock), and V turns it all off and on again (remembered).

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
  'golem-fire': { set: 'golem', clips: ['fire'], volume: 0.75, most: 1, half: 30, loop: [0.35, 1.75] },
  'golem-meteor': { set: 'golem', clips: ['meteor'], volume: 0.5, vary: 0.1, most: 8, half: 22 },
  // Wynn's, and nobody else's (heroes/ronin.js: on the drawings where they happen; ults.js)
  'ronin-slash': { set: 'ronin', clips: ['slash'], volume: 0.75, vary: 0.06, most: 3, half: 18 },
  'ronin-ult': { set: 'ronin', clips: ['ult'], volume: 0.9, most: 1, half: 22 },
  'ronin-unsheathe': { set: 'ronin', clips: ['unsheathe'], volume: 0.8, most: 2, half: 18 },
  'ronin-shine': { set: 'ronin', clips: ['shine'], volume: 0.7, most: 1, half: 18 },
  'ronin-cut': { set: 'ronin', clips: ['cut'], volume: 0.8, vary: 0.06, most: 4, half: 22 },
};
const LEAD = 0.04;

// The music, by the mood the world is in (main.js): its pieces (played in turn), how loud, the
// breath between one piece's end and the next's start (s), how long it waits before coming in once
// another mood has had its turn (the ambient: a moment's quiet after a fight), how long it takes to
// come in and to die away, whether it begins from its start each time (else where it left off),
// and whether its piece repeats, on and on.
const TUNES = '/assets/music/';
export const MUSIC = {
  // while no great enemy stands in the arena
  calm: { pieces: ['ambient-1', 'ambient-2'], volume: 0.45, gap: 3, wait: 4, fadeIn: 4, fadeOut: 2.5 },
  // as one enters it (fight.js), till he's felled or the fight is over
  fight: { pieces: ['arena'], volume: 0.55, gap: 0, wait: 0, fadeIn: 0.3, fadeOut: 3, fresh: true, loop: true },
};

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
    this.music = new Music(this);
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
    this.music.unlock();
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

// A piece's loudness on its way to `to` over `secs`, from where it is now (even mid-way through
// another fade: worked out from that fade, as the gain itself can't be trusted to tell). Returns when
// it gets there (the sound's clock).
function fadeTo(tr, to, secs, ctx) {
  const t = ctx.currentTime;
  const f = tr.fade;
  const from = !f ? tr.gain.gain.value : t >= f.t1 ? f.to : f.from + (f.to - f.from) * ((t - f.t0) / (f.t1 - f.t0));
  const t1 = t + Math.max(0.02, secs);
  const g = tr.gain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(from, t);
  g.linearRampToValueAtTime(to, t1);
  tr.fade = { from, to, t0: t, t1 };
  return t1;
}

// The music (Sacha's pieces, levelled: client/assets/music, README; MUSIC above). Each piece streams
// as it plays (minutes long, they're never decoded whole) from its own player, into its own gain
// (for its fades), into the sound's out (so V hushes it too). One mood dies away as the other comes
// in; one that has died away is stopped, kept where it was (or wound back to its start, `fresh`).
class Music {
  constructor(sound) {
    this.sound = sound;
    this.bus = null;
    this.tracks = new Map(); // piece -> { el, gain, fade, on, primed }
    this.moods = new Map(); // mood -> { at (its piece), playing, pending, wait, fade, stopAt }
    this.mood = null;
  }

  // The page clicked (Sound.unlock): the players made, and each begun and stopped again at once (a
  // browser may let a page begin one later only if it was first begun on a click).
  unlock() {
    const ctx = this.sound.ctx;
    if (!ctx) return;
    if (!this.bus) {
      this.bus = ctx.createGain();
      this.bus.connect(this.sound.out);
    }
    for (const def of Object.values(MUSIC)) {
      for (const piece of def.pieces) {
        const tr = this.track(piece);
        if (tr.primed) continue;
        tr.el.play().then(() => {
          tr.primed = true;
          if (!tr.on) tr.el.pause();
        }).catch(() => {});
      }
    }
  }

  track(piece) {
    let tr = this.tracks.get(piece);
    if (!tr) {
      const ctx = this.sound.ctx;
      const el = new Audio(`${TUNES}${piece}.mp3`);
      el.preload = 'auto';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain).connect(this.bus);
      tr = { el, gain, fade: null, on: false, primed: false };
      this.tracks.set(piece, tr);
    }
    return tr;
  }

  state(mood) {
    let m = this.moods.get(mood);
    if (!m) {
      m = { at: 0, playing: false, pending: false, wait: 0, fade: null, stopAt: 0 };
      this.moods.set(mood, m);
    }
    return m;
  }

  // Each frame (main.js): the mood the world is in ('calm', or 'fight'), and the music follows it.
  update(mood, dt) {
    const ctx = this.sound.ctx;
    if (!this.bus || ctx.state !== 'running' || !MUSIC[mood]) return;
    if (mood !== this.mood) {
      if (this.mood) this.leave(this.mood);
      const m = this.state(mood);
      m.pending = true;
      m.wait = this.mood ? MUSIC[mood].wait : 1; // (the very first: a moment after thou settest out)
      m.fade = null;
      this.mood = mood;
    }
    for (const [name, m] of this.moods) {
      if (m.stopAt && ctx.currentTime >= m.stopAt) {
        m.stopAt = 0;
        const tr = this.track(MUSIC[name].pieces[m.at]);
        tr.el.pause();
        tr.on = false;
        if (MUSIC[name].fresh) tr.el.currentTime = 0;
      }
    }
    const def = MUSIC[mood];
    const m = this.state(mood);
    if (m.pending) {
      if ((m.wait -= dt) <= 0) this.start(mood);
      return;
    }
    // a piece over (a repeating one never is): the next, a breath on, coming in as it begins
    const tr = this.track(def.pieces[m.at]);
    if (m.playing && tr.el.ended) {
      m.playing = false;
      tr.on = false;
      m.at = (m.at + 1) % def.pieces.length;
      m.pending = true;
      m.wait = def.gap;
      m.fade = 0.05;
    }
  }

  start(mood) {
    const def = MUSIC[mood];
    const m = this.state(mood);
    const tr = this.track(def.pieces[m.at]);
    if (def.fresh || tr.el.ended) tr.el.currentTime = 0;
    tr.el.loop = !!def.loop;
    fadeTo(tr, def.volume, m.fade ?? def.fadeIn, this.sound.ctx);
    tr.on = true;
    tr.el.play().catch(() => {});
    m.playing = true;
    m.pending = false;
    m.stopAt = 0; // (dying away, it comes back instead)
  }

  leave(mood) {
    const def = MUSIC[mood];
    const m = this.state(mood);
    m.pending = false;
    if (!m.playing) return;
    m.playing = false;
    m.stopAt = fadeTo(this.track(def.pieces[m.at]), 0, def.fadeOut, this.sound.ctx) + 0.05;
  }
}
