// Draws a hero's sheet off the page's thread (core.js, loadSheet: when there's no bake of it that's
// still its own, bake.js): its rig, found by its module and its id; its art, fetched here; its
// pixels sent back whole, handed over rather than copied. (Nothing it loads imports three: a worker
// has no import map.)
import { sheetPixels } from './core.js';

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
};

self.onmessage = async ({ data: { job, id, src } }) => {
  try {
    const rig = Object.values(await import(src)).find((r) => r?.id === id);
    if (!rig) throw new Error(`${src}: no rig ${id}`);
    const json = await fetchJson(rig.art);
    const extras = {};
    for (const [k, url] of Object.entries(rig.extraArt || {})) extras[k] = await fetchJson(url);
    const px = sheetPixels(rig, json, extras);
    const pictures = [px.color, px.glow, px.big?.color, px.big?.glow].filter(Boolean).map((a) => a.buffer);
    self.postMessage({ job, px }, pictures);
  } catch (err) {
    self.postMessage({ job, error: String(err?.stack || err) });
  }
};
