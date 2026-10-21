// Sound (Web Audio): what's heard in the Lands Between. Its clips are cut from Sacha's recordings
// and levelled (client/assets/sfx/<set>, README), and played where things happen in the world, at
// the moment they happen there (the Golem's foot set down on the frame it lands on, golem.js; Wynn's
// blade on the drawing where it cuts, npc.js; each bolt of Maren's storm as it strikes, ults.js;
// Fenrath landing, fight.js; a hammer on an anvil, npc.js; every foot set down, npc.js): quieter the
// farther from where the camera looks (and some, the footsteps, not at all past a point), to the left
// or the right as they show on the screen, a little different each time (`vary`), and never too
// many of one at once (`most`).
// And the music (Music, below): the ambient pieces while nothing's fought, the arena's while a great
// enemy stands in it. Nothing sounds before thou settest out (a browser lets a page make a sound only
// once it's been clicked: unlock), and V turns it all off and on again (remembered).

import * as THREE from 'three';

const STORE = 'elden-code:sound';

// The sounds, by name: the clips one is played from (one chosen each time), how loud, how much it
// varies (loudness and pitch, a share either way), how many may sound at once, how far off it's
// heard at half its loudness (world units), how far off it isn't heard at all (`far`: fading out
// toward it; else it never quite is), and, looped, the stretch of its clip that repeats; with
// `layer`, its clips are all heard together (a recording's 1 and 2, as Sacha names them), rather
// than one of them; with `pitch`, the range its pitch is picked from each time (a playback rate:
// lower is deeper, and longer), unless the one who plays it says (play); with `duck`, the music
// held down to that much of its loudness while it sounds (an ultimate's own). (A clip is played from its
// first sound: whatever silence its decoding left before it is skipped, so that it sounds on the
// very frame: leadOf.)
const SET = '/assets/sfx/';
const takes = (clip, n) => Array.from({ length: n }, (_, i) => `${clip}-${i + 1}`); // (clip-1 … clip-n)
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
  'golem-ankle': { set: 'golem', clips: ['ankle-1', 'ankle-2'], layer: true, volume: 0.85, vary: 0.05, most: 3, half: 24 },
  'golem-explosion': { set: 'golem', clips: ['explosion'], volume: 0.9, most: 1, half: 30 },
  // (each meteor flung up out of him, one of two, and the swarm of them as they begin; his stone
  // giving way as he tips over, passing out, and crumbling as his body hits the floor)
  'golem-throw': { set: 'golem', clips: ['throw-1', 'throw-2'], volume: 0.45, vary: 0.12, most: 4, half: 24 },
  'golem-swarm': { set: 'golem', clips: ['swarm-1', 'swarm-2'], volume: 0.8, most: 1, half: 30 },
  'golem-tip': { set: 'golem', clips: ['throw-2'], volume: 0.85, most: 1, half: 26 },
  'golem-crumble': { set: 'golem', clips: ['crumble'], volume: 0.9, most: 1, half: 30 },
  // Wynn's, and nobody else's (heroes/ronin.js: on the drawings where they happen; ults.js)
  'ronin-slash': { set: 'ronin', clips: ['slash'], volume: 0.75, vary: 0.06, most: 3, half: 18 },
  'ronin-ult': { set: 'ronin', clips: ['ult'], volume: 0.9, most: 1, half: 22 },
  'ronin-breathe': { set: 'ronin', clips: ['breathe'], volume: 0.5, most: 1, half: 20 },
  'ronin-shine': { set: 'ronin', clips: ['shine'], volume: 1.2, most: 1, half: 18 }, // (over his breath, which still holds as it comes)
  'ronin-cut': { set: 'ronin', clips: ['cut'], volume: 0.8, vary: 0.06, most: 4, half: 22 },
  'ronin-shine-back': { set: 'ronin', clips: ['shine-back'], volume: 0.7, most: 1, half: 18 },
  'ronin-damage': { set: 'ronin', clips: ['damage'], volume: 0.95, most: 1, half: 24 },
  // Fenrath's (fight.js): coming; each blow drawn back; the swing's cut (its whoosh, the greatsword
  // landing) and the arc of light it throws (the two together: arch, crescent); the lunge; the slam;
  // his leap (trembling as he crouches, springing); struck; felled; his growls (as he speaks, as his
  // stance breaks, now and then); his great attack (roar, rumble, the two heard on through it, each
  // cut of the ghost sword), and landing (one of three)
  'boss-appear': { set: 'boss', clips: ['appear'], volume: 0.9, most: 1, half: 30 },
  'boss-anticipation': { set: 'boss', clips: ['anticipation'], volume: 0.7, vary: 0.06, most: 2, half: 26 },
  'boss-woosh': { set: 'boss', clips: ['woosh'], volume: 0.75, vary: 0.06, most: 2, half: 26 },
  'boss-cut': { set: 'boss', clips: ['cut'], volume: 0.8, vary: 0.05, most: 2, half: 28 },
  'boss-arch': { set: 'boss', clips: ['arch'], volume: 0.7, vary: 0.05, most: 2, half: 26 },
  'boss-crescent': { set: 'boss', clips: ['crescent'], volume: 0.6, vary: 0.05, most: 2, half: 24 },
  'boss-lunge': { set: 'boss', clips: ['lunge'], volume: 0.85, most: 2, half: 28 },
  'boss-slam': { set: 'boss', clips: ['slam'], volume: 0.9, most: 1, half: 30 },
  'boss-tremble': { set: 'boss', clips: ['tremble'], volume: 0.6, most: 1, half: 26 },
  'boss-jump': { set: 'boss', clips: ['jump'], volume: 0.85, most: 1, half: 30 },
  'boss-hit': { set: 'boss', clips: ['hit'], volume: 0.55, vary: 0.1, pitch: [0.92, 1.08], most: 3, half: 22 },
  'boss-death': { set: 'boss', clips: ['death'], volume: 1, most: 1, half: 34 },
  'boss-growl': { set: 'boss', clips: takes('growl', 4), volume: 0.8, vary: 0.08, pitch: [0.94, 1.04], most: 1, half: 30 },
  'boss-roar': { set: 'boss', clips: ['roar'], volume: 1, most: 1, half: 34 },
  'boss-wrath': { set: 'boss', clips: ['wrath'], volume: 0.9, most: 1, half: 34 },
  'boss-wrath-during': { set: 'boss', clips: ['wrath-during-1', 'wrath-during-2'], layer: true, volume: 0.7, most: 1, half: 40 },
  'boss-sword': { set: 'boss', clips: ['sword'], volume: 1, most: 2, half: 40 },
  'boss-land': { set: 'boss', clips: ['land-1', 'land-2', 'land-3'], volume: 1, most: 2, half: 30 },
  // the ultimates' (ults.js): Maren's bolts (one of six each) and her great bolt, the camera closing
  // on her, Aurelion's verdict and his giant (rising, and striking: one of fifteen blows), Ruadan's
  // leap and landing, Fortuna's mass of ice bursting, Corisande's arrow, Ulric's spears
  'knight-bolt': { set: 'knight', clips: ['bolt-1', 'bolt-2', 'bolt-3', 'bolt-4', 'bolt-5', 'bolt-6'], volume: 0.75, vary: 0.08, most: 5, half: 26 },
  'knight-great': { set: 'knight', clips: ['great'], volume: 1, most: 1, half: 34 },
  'knight-ult-zoom': { set: 'knight', clips: ['ult-zoom'], volume: 0.8, most: 1, half: 24 },
  'paladin-ult': { set: 'paladin', clips: ['ult'], volume: 0.85, most: 1, half: 22 },
  // (Jorvik's tomes, each as it springs up)
  'runelord-book': { set: 'runelord', clips: takes('book', 3), volume: 0.5, vary: 0.1, pitch: [0.94, 1.08], most: 4, half: 22 },
  'paladin-stand': { set: 'paladin', clips: ['stand'], volume: 0.8, most: 1, half: 22 },
  'paladin-stand-hit': { set: 'paladin', clips: takes('stand-hit', 15), volume: 0.9, vary: 0.05, most: 1, half: 24 },
  // (and his own music, from the moment it's loosed till a moment after it strikes: ults.js)
  'paladin-theme': { set: 'paladin', clips: ['theme'], volume: 1, most: 1, half: 24, duck: 0.25 },
  'champion-jump': { set: 'champion', clips: ['jump'], volume: 0.85, most: 1, half: 26 },
  'champion-land': { set: 'champion', clips: ['land'], volume: 1, most: 1, half: 28 },
  // Ruadan's maul (combat.js): landing, a blow of his or thrown (one of five), flying back to his
  // hand, and its whoosh, again and again as it spins out
  'champion-hit': { set: 'champion', clips: takes('hit', 5), volume: 0.85, vary: 0.06, most: 3, half: 20 },
  'champion-back': { set: 'champion', clips: ['back'], volume: 0.75, most: 1, half: 20 },
  'champion-woosh': { set: 'champion', clips: ['woosh'], volume: 0.55, vary: 0.12, pitch: [0.95, 1.1], most: 3, half: 18 },
  'frost-ult-end': { set: 'frost', clips: ['ult-end'], volume: 1, most: 1, half: 26 },
  'frost-icicle': { set: 'frost', clips: ['icicle'], volume: 0.9, vary: 0.05, pitch: [0.92, 1.08], most: 3, half: 26 },
  'sorceress-ult-hit': { set: 'sorceress', clips: ['ult-hit'], volume: 1, most: 1, half: 26 },
  'bandit-woosh': { set: 'bandit', clips: ['woosh-1', 'woosh-2', 'woosh-3'], layer: true, volume: 0.8, vary: 0.08, most: 10, half: 18 },
  // the spells (combat.js): loosed, or landing
  'sorceress-projectile': { set: 'sorceress', clips: ['projectile-1', 'projectile-2'], layer: true, volume: 0.7, vary: 0.05, most: 3, half: 20 },
  'bloodbender-blob': { set: 'bloodbender', clips: ['blob'], volume: 0.75, vary: 0.06, most: 3, half: 20 },
  'bloodbender-impact': { set: 'bloodbender', clips: ['impact'], volume: 0.75, vary: 0.06, most: 3, half: 20 },
  'holy-spell': { set: 'holy', clips: ['spell'], volume: 0.7, vary: 0.05, most: 2, half: 20 },
  'holy-light': { set: 'holy', clips: ['light'], volume: 0.8, most: 2, half: 20 },
  'frost-throw': { set: 'frost', clips: ['throw-1', 'throw-2'], volume: 0.7, vary: 0.06, most: 3, half: 20 },
  'frost-lands': { set: 'frost', clips: ['lands-1', 'lands-2'], layer: true, volume: 0.75, vary: 0.05, most: 3, half: 20 },
  'knight-thunder': { set: 'knight', clips: Array.from({ length: 16 }, (_, i) => `thunder-${i + 1}`), volume: 0.75, vary: 0.05, most: 3, half: 20 },
  'knight-thunder-rise': { set: 'knight', clips: ['thunder-rise'], volume: 0.8, most: 2, half: 20 },
  // the world's: a spectre called up, a hammer on an anvil, the ritual circle invoked (interact.js)
  // and a spirit ash summoned (npc.js), a straw dummy struck and bursting (training.js)
  'spectre-appear': { set: 'spectre', clips: ['appear-1', 'appear-2'], layer: true, volume: 0.7, most: 2, half: 16 },
  'work-anvil': { set: 'work', clips: ['anvil-1', 'anvil-2'], layer: true, volume: 0.5, vary: 0.06, most: 4, half: 12 },
  'work-summon': { set: 'work', clips: ['summon'], volume: 0.6, most: 2, half: 16 },
  // (a straw dummy's each at a pitch of its own; the great one's lower than any: training.js)
  'yard-break': { set: 'yard', clips: ['break-1', 'break-2', 'break-3'], layer: true, volume: 0.85, vary: 0.05, pitch: [0.9, 1.18], most: 3, half: 20 },
  'yard-hit': { set: 'yard', clips: ['hit'], volume: 0.7, vary: 0.08, pitch: [0.92, 1.12], most: 4, half: 18 },
  // a blow's swing, as it lands (combat.js): anyone's with a blade, a spear or a fist, but Wynn's
  // (his own, above) and Ruadan's (his maul's, above)
  'blade-swing': { set: 'blade', clips: takes('swing', 3), volume: 0.55, vary: 0.08, pitch: [0.95, 1.05], most: 4, half: 16 },
  // (and a spear's thrust: Maren's, Ulric's)
  'spear-thrust': { set: 'blade', clips: ['thrust-1', 'thrust-2'], volume: 0.6, vary: 0.08, pitch: [0.95, 1.05], most: 4, half: 16 },
  // footsteps (npc.js): each foot as it's set down, one of its kind's at random, by what's on one's
  // feet (a hero's rig says: its `feet`), walking or running (thee with Shift, the others in a
  // hurry): armour, its chain clinking (Maren, Aurelion, Ulric, Jorvik); heels (Solenne, Fortuna);
  // soft shoes (Vael, Corisande); bare feet (Ruadan: the one step, its pitch and loudness picked anew
  // each time, so that it never sounds the same twice); plain on stone (everyone else); and Fenrath's
  // (fight.js), deeper and heavier. Heard only near where the camera looks, and not at all `far` off.
  'step-walk': { set: 'steps', clips: takes('walk', 5), volume: 0.18, vary: 0.12, pitch: [0.94, 1.06], most: 6, half: 8, far: 22 },
  'step-run': { set: 'steps', clips: takes('run', 5), volume: 0.22, vary: 0.12, pitch: [0.94, 1.06], most: 6, half: 8, far: 22 },
  'step-chain-walk': { set: 'steps', clips: takes('chain-walk', 5), volume: 0.19, vary: 0.12, pitch: [0.94, 1.06], most: 6, half: 8, far: 22 },
  'step-chain-run': { set: 'steps', clips: takes('chain-run', 5), volume: 0.23, vary: 0.12, pitch: [0.94, 1.06], most: 6, half: 8, far: 22 },
  'step-heels': { set: 'steps', clips: takes('heels', 15), volume: 0.17, vary: 0.12, pitch: [0.95, 1.05], most: 6, half: 8, far: 22 },
  'step-soft': { set: 'steps', clips: ['soft'], volume: 0.18, vary: 0.18, pitch: [0.86, 1.14], most: 6, half: 8, far: 22 },
  'step-bare': { set: 'steps', clips: ['bare'], volume: 0.18, vary: 0.18, pitch: [0.86, 1.14], most: 6, half: 8, far: 22 },
  'step-heavy': { set: 'steps', clips: takes('walk', 5), volume: 0.45, vary: 0.1, pitch: [0.66, 0.76], most: 3, half: 14, far: 36 },
  // coming down from a dodge (and pushing off into it) or a hop (pilot.js, fight.js), or set down
  // after being carried (npc.js), whoever it is
  'step-land': { set: 'steps', clips: ['land'], volume: 0.5, vary: 0.12, pitch: [0.88, 1.12], most: 4, half: 10, far: 30 },
  // the world standing still as anyone's ultimate is loosed, the camera closing on them (ults.js),
  // heard alike wherever one is; quiet enough under what's heard of them meanwhile (Wynn's breath
  // and the glare on his blade), and stopped as it strikes
  'cine-focus': { set: 'cine', clips: ['focus'], volume: 0.45, most: 1 },
  // a banner revealed (ui.js), heard alike wherever one is
  'ui-banner': { set: 'ui', clips: ['banner'], volume: 0.65, most: 2 },
  // setting out (main.js, as the title's button is clicked)
  'ui-start': { set: 'ui', clips: ['start'], volume: 0.8, most: 1 },
};
// The silence a decoded clip begins with (seconds), skipped as it's played: some browsers leave
// the encoder's at the start of an MP3, others take it out (and then there's nothing to skip: a
// fixed skip would cut into the sound itself). Never more than a tenth of a second.
function leadOf(buf) {
  const d = buf.getChannelData(0);
  const most = Math.min(d.length, Math.round(buf.sampleRate * 0.1));
  for (let i = 0; i < most; i++) if (Math.abs(d[i]) > 1e-4) return i / buf.sampleRate;
  return most / buf.sampleRate;
}

// The music, by the mood the world is in (main.js): its pieces (played in turn), how loud, the
// breath between one piece's end and the next's start (s), how long it waits before coming in once
// another mood has had its turn (the ambient: a moment's quiet after a fight), how long it takes to
// come in and to die away, whether it begins from its start each time (else where it left off),
// and whether its piece repeats, on and on.
const TUNES = '/assets/music/';
export const MUSIC = {
  // while no great enemy stands in the arena
  calm: { pieces: ['ambient-1', 'ambient-2'], volume: 0.22, gap: 3, wait: 4, fadeIn: 4, fadeOut: 2.5 },
  // as one enters it (fight.js), till he's felled or the fight is over
  fight: { pieces: ['arena'], volume: 0.28, gap: 0, wait: 0, fadeIn: 0.3, fadeOut: 3, fresh: true, loop: true },
};

export class Sound {
  constructor() {
    this.ctx = null; // (made once the page has been clicked: unlock)
    this.out = null;
    let stored = null;
    try { stored = localStorage.getItem(STORE); } catch {}
    this.on = stored !== 'off';
    this.clips = new Map(); // clip path → AudioBuffer (or the promise of it)
    this.bytes = new Map(); // clip path → the promise of its file, fetched (load)
    this.leads = new Map(); // clip path → the silence it begins with (leadOf)
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

  // Fetches and decodes a set's clips (once), ready for when they're wanted: fetched at once (even
  // under the title screen), decoded as soon as sound may begin (unlock), so that nothing's missed
  // for not being ready in the first moments after thou settest out.
  load(set) {
    if (!this.ctx) (this.wanted ??= new Set()).add(set);
    for (const s of Object.values(SOUNDS)) {
      if (s.set !== set) continue;
      for (const clip of s.clips) {
        const path = `${SET}${set}/${clip}.mp3`;
        if (!this.bytes.has(path)) this.bytes.set(path, fetch(path).then((r) => r.arrayBuffer()).catch(() => null));
        if (!this.ctx || this.clips.has(path)) continue;
        this.clips.set(path, this.bytes.get(path)
          .then((b) => (b ? this.ctx.decodeAudioData(b) : Promise.reject(new Error('not fetched'))))
          .then((buf) => { this.leads.set(path, leadOf(buf)); this.clips.set(path, buf); return buf; })
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
  // is), `volume` times its own, `delay` seconds from now, `offset` seconds into its clip (what's
  // before left out: so that a moment in it falls where it should, Fenrath's lunge), at `pitch` (a
  // playback rate; else one from its own range, if it has one). Returns what's sounding (stop(fade, after) ends it, dying
  // away over `fade` seconds from `after` seconds on, or keeps it from ever beginning: a looped one
  // sounds till then), or null if nothing can be heard.
  play(name, { at = null, volume = 1, delay = 0, pitch = null, offset = 0 } = {}) {
    const s = SOUNDS[name];
    this.log.push([performance.now() / 1000, name]);
    if (this.log.length > 200) this.log.splice(0, 100);
    if (!s || !this.ctx || this.ctx.state !== 'running') return null;
    const clips = s.layer ? s.clips : [s.clips[Math.floor(Math.random() * s.clips.length)]];
    const paths = clips.map((clip) => `${SET}${s.set}/${clip}.mp3`);
    if (!paths.every((p) => this.clips.get(p) instanceof AudioBuffer)) return null; // (not loaded yet)
    const vary = s.vary || 0;
    const [gain, pan] = this.place(at, s.half ?? 24, s.far);
    const loud = (s.volume ?? 1) * volume * gain * (1 + (Math.random() * 2 - 1) * vary);
    if (loud < 0.01) return null;
    // (no more than `most` of it at once: the oldest gives way)
    const playing = (this.voices.get(name) || []).filter((v) => !v.done);
    while (playing.length >= (s.most ?? 4)) playing.shift().stop(0.05);
    const g = this.ctx.createGain();
    g.gain.value = loud;
    let node = g;
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(this.out);
    const begins = this.ctx.currentTime + delay;
    const base = pitch ?? (s.pitch ? s.pitch[0] + Math.random() * (s.pitch[1] - s.pitch[0]) : 1);
    const rate = base * (1 + (Math.random() * 2 - 1) * vary * 0.5);
    const srcs = paths.map((path) => {
      const buf = this.clips.get(path);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      if (s.loop) {
        src.loop = true;
        [src.loopStart, src.loopEnd] = s.loop;
      }
      src.connect(g);
      src.start(begins, Math.min(this.leads.get(path) || 0, buf.duration / 2) + Math.min(offset, buf.duration * 0.9));
      return src;
    });
    // (the music held down while it sounds, if it says; back up as it ends)
    const ducks = s.duck != null;
    if (ducks) this.music.duck(s.duck, begins);
    const voice = {
      done: false,
      stop: (fade = 0.2, after = 0) => {
        if (voice.done) return;
        voice.done = true;
        const t = this.ctx.currentTime + after;
        if (ducks) this.music.duck(1, t);
        if (t < begins) { for (const src of srcs) src.stop(t); return; } // (not begun: it never will)
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + fade);
        for (const src of srcs) src.stop(t + fade + 0.02);
      },
    };
    let left = srcs.length;
    for (const src of srcs) {
      src.onended = () => {
        if (--left > 0) return;
        if (ducks && !voice.done) this.music.duck(1);
        voice.done = true;
      };
    }
    playing.push(voice);
    this.voices.set(name, playing);
    return voice;
  }

  // Plays a sound (as play) as soon as its clips are ready, if that's within `within` seconds: the
  // first ones after sound may begin are only being decoded then (thy click on the title's button,
  // main.js).
  soon(name, opts = {}, within = 1) {
    const s = SOUNDS[name];
    if (!s || !this.ctx) return;
    const asked = performance.now();
    Promise.all(s.clips.map((clip) => this.clips.get(`${SET}${s.set}/${clip}.mp3`))).then(() => {
      if ((performance.now() - asked) / 1000 <= within) this.play(name, opts);
    });
  }

  // How loud something at `at` is heard, and which way: by its distance from where the camera looks
  // (half as loud `half` off, and fading out to nothing `far` off), and where it shows on the screen.
  place(at, half, far = Infinity) {
    const v = this.view;
    if (!at || !v) return [1, 0];
    const { camera, focus } = v;
    const d = Math.hypot(at[0] - focus.x, at[1] - focus.z);
    const gain = d < far ? (1 - (d / far) ** 2) / (1 + (d / half) ** 2) : 0;
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

  // Held down to `low` of its loudness from `at` (the sound's clock) under something that wants the
  // floor (an ultimate's own music: Sound.play, `duck`), or (1) let back up, more slowly.
  duck(low, at = this.sound.ctx.currentTime) {
    if (!this.bus) return;
    const g = this.bus.gain;
    g.cancelScheduledValues(at);
    g.setTargetAtTime(low, at, low < 1 ? 0.1 : 0.4);
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
