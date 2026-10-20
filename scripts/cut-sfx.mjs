// node scripts/cut-sfx.mjs [set…]: the game's sounds (client/js/audio.js, SOUNDS), cut from Sacha's
// recordings (client/assets/sfx/<their folder>, left as they are and never committed) into
// client/assets/sfx/<set>: each sound from where it starts (a footstep alone, where a recording holds
// several, a few seconds apart), levelled to one peak, mono MP3. Every set, or those named. Needs
// ffmpeg. The cut points were found from the recordings' loudness (each sound's sudden rise).
//   golem  the Guardian Golem's (golem.js), from "Golem Guardian"
//   ronin  Wynn's (heroes/ronin.js, ults.js), from "Wynn"
//   ui     the banners' (ui.js), from the recordings loose in client/assets/sfx itself
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SFX = path.join(repo, 'client/assets/sfx');

// Each set: the folder its recordings are in (never the set's own name, not even but for its case:
// on Windows the two would be one folder), and its clips: [name, source file, start (s), length (s),
// peak (dBFS), fade in (s), fade out (s)].
const SETS = {
  golem: {
    from: 'Golem Guardian',
    clips: [
      ...[2.43, 5.21, 8.86, 11.66, 15.26, 18.06, 21.70].map((t, i) => [`step-${i + 1}`, 'golem_footsteps_type1.mp3', t - 0.02, 1.8, -4, 0, 0.8]),
      ...[0.06, 6.76, 12.06, 18.76].map((t, i) => [`step-${i + 8}`, 'golem_footsteps_type2.wav', t - 0.02, 1.8, -4, 0, 0.8]),
      ['windup', 'golem_anticipation_atk.wav', 0.04, 0.95, -3, 0, 0.3],
      ['strike', 'golem_atk.wav', 0, 1.9, -2, 0, 0.5],
      ['clang', 'golem_not_ankle_sound.wav', 0, 1.1, -3, 0, 0.4],
      // passing out: his stone crumbling as he falls (golem.js), heard from his first moment of
      // falling: the first from its first crackle (the 0.9 s before it are faint), the second from its
      // start, and no longer than his fall may last (both are stopped as his body hits the floor)
      ['fall-start-1', 'golem_passing_out_start_1.ogg', 0.88, 1.5, -6, 0, 0.25],
      ['fall-start-2', 'golem_passing_out_start_2.wav', 0, 3, -6, 0, 0.6],
      ['fall-hit', 'golem_passing_out_ground_hit.wav', 0, 2.9, -2, 0, 0.8],
      ['fire-start', 'golem_spitting_fire_start.wav', 0, 3.1, -3, 0, 0.15],
      // (the blaze from where it's already roaring, its quiet lead-in left out)
      ['fire', 'golem_spitting_fire.wav', 1.15, 2.85, -3, 0, 0.5],
      ['meteor', 'meteorite_hit.wav', 2.02, 1.6, -4, 0, 0.6],
    ],
  },
  ronin: {
    from: 'Wynn',
    clips: [
      // a blow of his (any but his Iaijutsu's), from its rise
      ['slash', 'slash.mp3', 0.06, 0.5, -4, 0, 0.15],
      // his Iaijutsu loosed (thine as R is pressed), whole
      ['ult', 'ult_pressed.wav', 0, 1.3, -3, 0, 0.3],
      // the glare on the blade as he looses it: the shine itself, at 2.53 s (before it, a click and
      // half a second of hiss)
      ['shine', 'blade_shine.m4a', 2.5, 1.1, -4, 0, 0.5],
      // each cut of his Iaijutsu: from where it's loud already (it swells from 2.12 s, silent before
      // that), and short, so that eight of them a fifth of a second apart stay apart
      ['cut', 'ult_slash.wav', 2.36, 0.7, -3, 0, 0.35],
    ],
  },
  ui: {
    from: '.',
    clips: [
      // a banner revealed: from its first sound (0.65 s: silent before), swelling as the banner
      // comes up, and dying away about as it goes
      ['banner', 'announcement_banner_reveal.wav', 0.64, 4.4, -3, 0, 1.2],
    ],
  },
};

const wanted = process.argv.slice(2);
for (const set of wanted) if (!SETS[set]) { console.error(`No set ${set} (${Object.keys(SETS).join(', ')})`); process.exit(1); }
const ff = (args) => spawnSync('ffmpeg', ['-v', 'info', '-hide_banner', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
for (const [set, { from, clips }] of Object.entries(SETS)) {
  if (wanted.length && !wanted.includes(set)) continue;
  const SRC = path.join(SFX, from);
  const OUT = path.join(SFX, set);
  fs.mkdirSync(OUT, { recursive: true });
  let total = 0;
  for (const [name, file, start, len, peak, fin, fout] of clips) {
    const src = path.join(SRC, file);
    // the peak of that stretch, as it is
    const probe = ff(['-ss', String(start), '-t', String(len), '-i', src, '-ac', '1', '-af', 'volumedetect', '-f', 'null', '-']);
    const m = /max_volume: (-?[\d.]+) dB/.exec(probe.stderr);
    const max = m ? Number(m[1]) : 0;
    const gain = peak - max;
    const fades = [fin ? `afade=t=in:st=0:d=${fin}` : null, `afade=t=out:st=${(len - fout).toFixed(3)}:d=${fout}`].filter(Boolean);
    const out = path.join(OUT, `${name}.mp3`);
    const r = ff(['-ss', String(start), '-t', String(len), '-i', src, '-ac', '1', '-ar', '44100', '-af', [`volume=${gain.toFixed(2)}dB`, ...fades].join(','),
      '-codec:a', 'libmp3lame', '-b:a', '112k', out]);
    if (r.status !== 0) { console.error(name, r.stderr.slice(-400)); process.exit(1); }
    const size = fs.statSync(out).size;
    total += size;
    console.log(`${set}/${name}.mp3  ${file} ${start.toFixed(2)}+${len}s  peak ${max.toFixed(1)} -> ${peak} dB  ${(size / 1024).toFixed(0)} KB`);
  }
  console.log(`${set}: ${clips.length} clips, ${(total / 1024).toFixed(0)} KB`);
}
