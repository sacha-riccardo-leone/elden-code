// node scripts/cut-golem-sfx.mjs: the Golem's sounds for the game (client/js/audio.js), cut from
// Sacha's recordings (client/assets/sfx/Golem Guardian, left as they are and never committed) into
// client/assets/sfx/golem: each footstep alone (the recordings hold several, a few seconds apart),
// each other sound from where it starts, levelled to one peak, mono MP3. Needs ffmpeg. The cut
// points were found from the recordings' loudness (each step's sudden rise, each sound's start).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repo = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SRC = path.join(repo, 'client/assets/sfx/Golem Guardian');
const OUT = path.join(repo, 'client/assets/sfx/golem');
fs.mkdirSync(OUT, { recursive: true });

// [name, source file, start (s), length (s), peak (dBFS), fade in (s), fade out (s)]
const clips = [
  ...[2.43, 5.21, 8.86, 11.66, 15.26, 18.06, 21.70].map((t, i) => [`step-${i + 1}`, 'golem_footsteps_type1.mp3', t - 0.02, 1.8, -4, 0, 0.8]),
  ...[0.06, 6.76, 12.06, 18.76].map((t, i) => [`step-${i + 8}`, 'golem_footsteps_type2.wav', t - 0.02, 1.8, -4, 0, 0.8]),
  ['windup', 'golem_anticipation_atk.wav', 0.04, 0.95, -3, 0, 0.3],
  ['strike', 'golem_atk.wav', 0, 1.9, -2, 0, 0.5],
  ['clang', 'golem_not_ankle_sound.wav', 0, 1.1, -3, 0, 0.4],
  // passing out: the first whole, and the second from its start, as long as he may lie felled (it
  // comes in halfway through the first, on top of it, and dies away as he gets up: golem.js)
  ['fall-start-1', 'golem_passing_out_start_1.ogg', 0, 4.0, -6, 0, 0.4],
  ['fall-start-2', 'golem_passing_out_start_2.wav', 0, 12, -6, 0, 2.0],
  ['fall-hit', 'golem_passing_out_ground_hit.wav', 0, 2.9, -2, 0, 0.8],
  ['fire-start', 'golem_spitting_fire_start.wav', 0, 3.1, -3, 0, 0.15],
  ['fire', 'golem_spitting_fire.wav', 0.3, 3.75, -3, 0, 0.5],
  ['meteor', 'meteorite_hit.wav', 2.02, 1.6, -4, 0, 0.6],
];

const ff = (args) => spawnSync('ffmpeg', ['-v', 'info', '-hide_banner', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
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
  console.log(`${name}.mp3  ${file} ${start.toFixed(2)}+${len}s  peak ${max.toFixed(1)} -> ${peak} dB  ${(size / 1024).toFixed(0)} KB`);
}
console.log(`total ${(total / 1024).toFixed(0)} KB`);
