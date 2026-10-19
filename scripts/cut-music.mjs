// node scripts/cut-music.mjs: the music for the game (client/js/audio.js, MUSIC), from Sacha's pieces
// (client/assets/sfx/Music, left as they are and never committed) into client/assets/music: each
// whole, levelled to one loudness (EBU R128, integrated: the two ambient pieces alike, the arena's a
// little louder), stereo MP3 at 128 kb/s, without the cover art and tags. Needs ffmpeg.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repo = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SRC = path.join(repo, 'client/assets/sfx/Music');
const OUT = path.join(repo, 'client/assets/music');
fs.mkdirSync(OUT, { recursive: true });

// [name, source file, loudness (LUFS)]
const pieces = [
  ['ambient-1', 'ambient_1.mp3', -18],
  ['ambient-2', 'ambient_2.mp3', -18],
  ['arena', 'arena.mp3', -16],
];

const ff = (args) => spawnSync('ffmpeg', ['-v', 'info', '-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
let total = 0;
for (const [name, file, lufs] of pieces) {
  const src = path.join(SRC, file);
  // its loudness, as it is
  const probe = ff(['-i', src, '-map', '0:a:0', '-af', 'ebur128', '-f', 'null', '-']);
  const m = /Integrated loudness:\s*I:\s*(-?[\d.]+) LUFS/.exec(probe.stderr);
  if (!m) { console.error(name, probe.stderr.slice(-400)); process.exit(1); }
  const was = Number(m[1]);
  const gain = lufs - was;
  const out = path.join(OUT, `${name}.mp3`);
  const r = ff(['-i', src, '-map', '0:a:0', '-map_metadata', '-1', '-ac', '2', '-ar', '44100', '-af', `volume=${gain.toFixed(2)}dB`,
    '-codec:a', 'libmp3lame', '-b:a', '128k', out]);
  if (r.status !== 0) { console.error(name, r.stderr.slice(-400)); process.exit(1); }
  const size = fs.statSync(out).size;
  total += size;
  console.log(`${name}.mp3  ${file}  ${was.toFixed(1)} -> ${lufs} LUFS (${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB)  ${(size / 1024 / 1024).toFixed(2)} MB`);
}
console.log(`total ${(total / 1024 / 1024).toFixed(2)} MB`);
