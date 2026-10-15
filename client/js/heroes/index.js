// The roster of hand-drawn heroes. The first (the Stormbound Knight) is worn by Maren, the
// player; the rest go to the sessions in order of arrival: the eldest wears the next hero, and
// so on. Everyone else keeps a procedural look. The Twofold (champion, queen and the two drawings
// of their change, twofold.js) is a single hero with a night and a day form; so is the Glintstone
// Witch (sorceress.js), masked and bare-faced, with the drawing of her lifting the mask between.

import knight from './knight.js';
import fortuna from './fortuna.js';
import { bare as sorceress, masked as sorceressMasked, veil as sorceressVeil } from './sorceress.js';
import ronin from './ronin.js';
import bloodbender from './bloodbender.js';
import runelord from './runelord.js';
import paladin from './paladin.js';
import bandit from './bandit.js';
import champion from './champion.js';
import queen from './queen.js';
import { dawn, dusk } from './twofold.js';
import { loadSheet } from './core.js';

export const HEROES = [knight, fortuna, sorceress, sorceressMasked, sorceressVeil, ronin, bloodbender, runelord, paladin, bandit, champion, queen, dawn, dusk];

// Loads every hero whose art is present; a missing or broken one is skipped.
export async function loadHeroSheets() {
  const sheets = await Promise.all(HEROES.map((rig) => loadSheet(rig).catch((err) => {
    console.warn(`Hero art for ${rig.id} unavailable`, err);
    return null;
  })));
  return sheets.filter(Boolean);
}
