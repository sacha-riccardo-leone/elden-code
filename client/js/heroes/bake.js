// A drawn character's sheet baked ahead of time (scripts/bake-sheets.mjs: its pictures and what each
// frame holds, in assets/hero/baked/<id>), so that the game loads pictures as it starts instead of
// drawing every frame then (core.js, loadSheet). And how the game knows a bake is still the one its
// art and code would make now: a fingerprint of every file that goes into it, its rig's module
// (`rig.src`) and the modules that one imports, and its art (`rig.art`, `rig.extraArt`). Shared by
// the page and the bake: `read(url)` gives a file's text, by its URL, or by its path under the
// site's root (the art). No imports here: the composing worker loads this too (compose-worker.js).

export const BAKED = '/assets/hero/baked/';

// (a relative import or re-export, at the start of a line: `import { … } from './core.js';`)
const IMPORTS = /^\s*(?:import|export)\b[^;]*?\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]/gm;

export async function fingerprint(rig, read) {
  return hashOf(await inputs(rig, read));
}

// What a rig's sheet is made from, in order, as [name, text]: its module and the modules it imports
// (named from js/ on, the same served as files or from a server), then its art (by its path under the
// site). A bake keeps the names (`files`), so that the bridge can check it from the files themselves
// (server/bridge.js, stillOwn: the same hash, worked out there).
export async function inputs(rig, read) {
  const parts = [];
  const seen = new Set();
  const walk = async (url) => {
    if (seen.has(url)) return;
    seen.add(url);
    const text = await read(url);
    parts.push([url.slice(url.lastIndexOf('/js/') + 1), text]);
    for (const m of text.matchAll(IMPORTS)) await walk(new URL(m[1], url).href);
  };
  await walk(rig.src);
  for (const art of [rig.art, ...Object.values(rig.extraArt || {})]) parts.push([art, await read(art)]);
  return parts;
}

export async function hashOf(parts) {
  const text = parts.map(([name, body]) => `${name}\n${body}`).join('\u0000');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
