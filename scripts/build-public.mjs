// Builds the public demo as a static site (for Vercel): dist/elden-code-demo.
//
//   npm run build:public       build it
//   npm run preview:public     try it at http://127.0.0.1:7788, served as Vercel would
//   npm run deploy:public      build and deploy it to Vercel (once: npx vercel login)
//
// It's the game as it is, with mode.js switched to PUBLIC_DEMO: no bridge and no real data, an
// endless world of made-up sessions (client/js/demo.js). Only what the page loads is copied: the
// client's code and styles, the art grids (JSON, not the preview GIFs and source images), the
// sounds as the game cut them (not the recordings they were cut from), the parts of Three.js it
// imports and the two fonts. The page carries the local bridge's
// Content-Security-Policy itself (a meta tag allowing exactly its import map, by hash); the other
// security headers are in the repository's vercel.json, which also tells Vercel how to build this
// when it deploys from GitHub, and are copied next to the build for npm run deploy:public.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { bake } from './bake-sheets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = path.join(ROOT, 'client');
const OUT = path.join(ROOT, 'dist', 'elden-code-demo'); // Vercel names the project after the folder
const THREE = path.join(ROOT, 'node_modules', 'three');

let files = 0;
let bytes = 0;
function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  files += 1;
  bytes += fs.statSync(to).size;
}
function write(to, text) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, text);
  files += 1;
  bytes += Buffer.byteLength(text);
}
function walk(dir, keep, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, keep, fn);
    else if (keep(p)) fn(p);
  }
}
const rel = (p) => path.relative(CLIENT, p);

// start afresh, but keep Vercel's link to the project (.vercel) so later deploys update it
fs.mkdirSync(OUT, { recursive: true });
for (const e of fs.readdirSync(OUT)) if (e !== '.vercel') fs.rmSync(path.join(OUT, e), { recursive: true, force: true });

// the page, with its Content-Security-Policy: the bridge's (the one inline script allowed is the
// import map, by its hash), as a meta tag ahead of everything it governs
const html = fs.readFileSync(path.join(CLIENT, 'index.html'), 'utf8');
const hashes = [...html.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)]
  .map((m) => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);
const csp = [
  "default-src 'self'",
  `script-src 'self' ${hashes.join(' ')}`,
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');
const charset = '<meta charset="utf-8">';
if (!html.includes(charset)) throw new Error(`index.html: no ${charset} to put the policy after`);
// (and its body marked as the public demo's from the first moment, before any script has run, so
// that nothing needing the bridge ever shows, "Summon phantoms" above all: game.css)
const body = '<body class="on-title">';
if (!html.includes(body)) throw new Error(`index.html: no ${body} to mark as the public demo's`);
write(path.join(OUT, 'index.html'), html
  .replace(charset, `${charset}\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`)
  .replace(body, '<body class="on-title public-demo">'));

// its styles and code (not the bridge's event log page, nor the dev viewers)
walk(path.join(CLIENT, 'css'), () => true, (p) => copy(p, path.join(OUT, rel(p))));
walk(path.join(CLIENT, 'js'), (p) => p.endsWith('.js') && !p.endsWith('debug.js'), (p) => copy(p, path.join(OUT, rel(p))));
write(path.join(OUT, 'js', 'mode.js'), [
  '// The public demo build (scripts/build-public.mjs): no bridge, no real data, only made-up sessions.',
  'export const PUBLIC_DEMO = true;',
  '',
].join('\n'));

// the art grids the rigs load (not the sheets baked here, which may be behind: they're baked afresh)
const BAKED = `${path.sep}baked${path.sep}`;
walk(path.join(CLIENT, 'assets'), (p) => p.endsWith('.json') && !p.endsWith('-sheet.json') && !p.includes(BAKED), (p) => copy(p, path.join(OUT, rel(p))));
// the characters' sheets, baked with this very code (scripts/bake-sheets.mjs): the game loads them as
// pictures, never checking them (`trusted`), instead of drawing every frame as it starts
const baked = await bake({ out: path.join(OUT, 'assets', 'hero', 'baked'), trusted: true });
files += fs.readdirSync(path.join(OUT, 'assets', 'hero', 'baked')).length;
bytes += baked.bytes;
// and the drawing of the grace itself (grace.js)
copy(path.join(CLIENT, 'assets', 'fx', 'grace-core.png'), path.join(OUT, 'assets', 'fx', 'grace-core.png'));
// the sounds, each set as the game cut it (client/assets/sfx/<set>: audio.js's SOUNDS; the sets of
// scripts/cut-sfx.mjs), not the recordings beside them it was cut from
const SFX_SETS = ['golem', 'boss', 'ronin', 'knight', 'paladin', 'champion', 'frost', 'sorceress', 'bloodbender', 'holy', 'bandit', 'spectre', 'work', 'yard', 'ui'];
for (const set of SFX_SETS) walk(path.join(CLIENT, 'assets', 'sfx', set), (p) => p.endsWith('.mp3'), (p) => copy(p, path.join(OUT, rel(p))));
// and the music, as levelled (client/assets/music: audio.js's MUSIC)
walk(path.join(CLIENT, 'assets', 'music'), (p) => p.endsWith('.mp3'), (p) => copy(p, path.join(OUT, rel(p))));

// Three.js: the build, and the addons the code imports with everything they import in turn
const imports = (file) => [...fs.readFileSync(file, 'utf8').matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g)].map((m) => m[1] || m[2]);
const vendor = (from, to) => {
  const seen = new Set();
  const visit = (file, dest) => {
    if (seen.has(file)) return;
    seen.add(file);
    copy(file, dest);
    for (const spec of imports(file)) {
      if (!spec.startsWith('.')) continue; // 'three' is the import map's
      visit(path.resolve(path.dirname(file), spec), path.resolve(path.dirname(dest), spec));
    }
  };
  visit(from, to);
};
vendor(path.join(THREE, 'build', 'three.module.js'), path.join(OUT, 'vendor', 'three', 'build', 'three.module.js'));
const addons = new Set();
walk(path.join(CLIENT, 'js'), (p) => p.endsWith('.js'), (p) => {
  for (const spec of imports(p)) if (spec.startsWith('three/addons/')) addons.add(spec.slice('three/addons/'.length));
});
for (const a of addons) vendor(path.join(THREE, 'examples', 'jsm', a), path.join(OUT, 'vendor', 'three', 'addons', a));

// the fonts game.css asks for
const FONTS = { cinzel: '@fontsource/cinzel/files', cormorant: '@fontsource/cormorant-garamond/files' };
const css = fs.readFileSync(path.join(CLIENT, 'css', 'game.css'), 'utf8');
for (const [, family, file] of css.matchAll(/url\('\/vendor\/fonts\/([a-z]+)\/([^']+)'\)/g)) {
  copy(path.join(ROOT, 'node_modules', FONTS[family], file), path.join(OUT, 'vendor', 'fonts', family, file));
}

// the other headers (and long caching for what never changes), from the repository's vercel.json,
// for a deploy of this folder alone (npm run deploy:public); a deploy from GitHub reads that file
const { cleanUrls, headers } = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
write(path.join(OUT, 'vercel.json'), `${JSON.stringify({ cleanUrls, headers }, null, 2)}\n`);

console.log(`Public demo built: ${path.relative(ROOT, OUT)} (${files} files, ${(bytes / 1048576).toFixed(1)} MB)`);
console.log(`  Three.js addons: ${[...addons].join(', ')}`);
