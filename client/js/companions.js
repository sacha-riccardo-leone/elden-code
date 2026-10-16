// Choosing who fights beside thee, as a great enemy comes (fight.js, call). A window across the
// middle of the screen: "Choose your companions", who is coming and why, and four tall slots (more
// with "Add slot", up to as many heroes as there are to take). Each empty slot is a "+" that opens
// the catalogue of heroes: how each fights, its ultimate, its manner, and where it is just now.
// A chosen one shows in its slot as its portrait, drawn large from its own art; "Empty slot" under
// it frees the slot again, and a click on the portrait changes it. "Start fight", with however many
// companions are chosen (none at all included), raises the arena; × or Esc turns the enemy down.
// The companions chosen last are in their slots again the next time.

import { heroKey } from './combat.js';
import { ULTS } from './ults.js';

const SLOTS = 4; // to begin with
const MEMORY = 'elden-code.companions';

// What the catalogue says of each hero (by its art: the Twofold by the form it wears just now):
// how it fights, what its ultimate does, and its manner.
const ROSTER = {
  runelord: {
    style: 'Ranged · golden runes', fights: 'Keeps well off and looses runes of gold.',
    ult: 'golden tomes take wing and dash into the enemy, each spent as it strikes',
    manner: 'A pompous scholar of the Golden Order.',
  },
  sorceress: {
    style: 'Ranged · glintstone', fights: 'Glintstone sorcery from afar, her mask on as she casts.',
    ult: 'a crystal arrow trailing light, that always finds its mark',
    manner: 'Cast out of her academy: arrogant, cold, sharp with fools, and lonely under it.',
  },
  bloodbender: {
    style: 'Ranged · blood', fights: 'Blood sorcery, from a safe distance.',
    ult: "a pool of blood under the enemy: it slows, can't get out, and bleeds",
    manner: 'Courteous, sinister, and always thinking of blood.',
  },
  queen: {
    style: 'Ranged · holy light', fights: 'Holy light from afar. By night, the Twofold is Ruadan, the Red Hammer.',
    ult: 'a curved wall of golden light that strikes hard and drives the enemy back',
    manner: 'Answers no one, ever, but with "…".',
  },
  champion: {
    style: 'Close · great hammer', fights: 'Up close, with a great hammer. By day, the Twofold is Solenne, the Eternal Queen.',
    ult: "up into the air and down at the enemy's feet, hammer first, in a burst of gold",
    manner: 'Answers no one, ever, but with "…".',
  },
  paladin: {
    style: 'Close · sword', fights: 'Sword in hand, in the thick of it.',
    ult: 'a great slash of light that leaves the enemy dazed, unable to fight or move',
    manner: 'Solemn and warm, a blessing for everyone.',
  },
  ronin: {
    style: 'Close · katana', fights: 'Katana drawn, quick in and out.',
    ult: 'a breath, then cut after cut from every side, all landing as the blade is sheathed',
    manner: 'Few words, each one sharpened.',
  },
  bandit: {
    style: 'Never fights', fights: 'Never strikes a blow: he runs as far from the enemy as the arena allows, and whines.',
    ult: 'ten poisoned spears that stick in the enemy (loosed only by thee, as him)',
    manner: 'Rough, greedy and cheerful, always eyeing thy purse; a shameless coward.',
  },
  fortuna: {
    style: 'Ranged and close · frost', fights: 'Frost from afar, or her blade up close, by turns.',
    ult: 'four great icicles dropping on the enemy one after another',
    manner: 'Cold, vain and elegant; frost in every word.',
  },
  knight: {
    style: 'Close · spear', fights: 'Spear in hand, in the storm of it.',
    ult: 'red lightning raining on the enemy, and one great bolt to end it',
    manner: 'Brave and warm, with a dry wit; thunder in every other word.',
  },
};

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// A hero's standing drawing (the first frame of its idle pose), cut to the pixels it fills: an
// image to show anywhere, and its height in the world (heroes are drawn at different scales: shown
// by their height, they come out as tall as one another as they stand in the Lands Between).
const portraits = new WeakMap();
function portrait(sheet) {
  let p = portraits.get(sheet);
  if (p) return p;
  const def = sheet.anims.idle || Object.values(sheet.anims)[0];
  const i = def.frames[0];
  const sx = (i % sheet.cols) * sheet.frameW;
  const sy = Math.floor(i / sheet.cols) * sheet.frameH;
  const W = sheet.frameW;
  const H = sheet.frameH;
  const d = sheet.color.getContext('2d').getImageData(sx, sy, W, H).data;
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!d[(y * W + x) * 4 + 3]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }
  const c = document.createElement('canvas');
  c.width = x1 - x0 + 1;
  c.height = y1 - y0 + 1;
  c.getContext('2d').drawImage(sheet.color, sx + x0, sy + y0, c.width, c.height, 0, 0, c.width, c.height);
  p = { url: c.toDataURL(), w: c.width, h: c.height, tall: c.height * sheet.px };
  portraits.set(sheet, p);
  return p;
}

// The portrait as an image `perUnit` screen pixels to the world's unit, no larger than `maxW` x `maxH`.
function face(sheet, perUnit, maxW, maxH) {
  const p = portrait(sheet);
  const k = Math.min(perUnit * sheet.px, maxW / p.w, maxH / p.h);
  const img = el('img');
  img.src = p.url;
  img.alt = '';
  img.width = Math.round(p.w * k);
  img.height = Math.round(p.h * k);
  return img;
}

// Who a hero is, to remember it by: its hero (the Twofold whatever its form), or Maren.
const idOf = (n) => n.heroActor || (n.isMaren ? 'maren' : null);

export class Companions {
  constructor(ctx) {
    this.ctx = ctx;
    this.root = document.getElementById('companions');
    this.panel = this.root.querySelector('.panel');
    this.foeEl = this.root.querySelector('.foe');
    this.slotsEl = this.root.querySelector('.slots');
    this.addBtn = this.root.querySelector('.add');
    this.startBtn = this.root.querySelector('.start');
    this.catalog = this.root.querySelector('.catalog');
    this.list = this.root.querySelector('.catalog .list');
    this.shown = false;
    this.slots = [];
    this.roster = [];
    this.picking = -1; // the slot the catalogue is open for
    this.done = null;
    this.root.querySelector('.close').addEventListener('click', () => this.close());
    this.root.querySelector('.back').addEventListener('click', () => this.closeCatalog());
    this.addBtn.addEventListener('click', () => this.addSlot());
    this.startBtn.addEventListener('click', () => this.start());
    // (a click on the dimmed world around the window does nothing: it's this, or turning it down)
    window.addEventListener('keydown', (e) => {
      if (!this.shown || e.key !== 'Escape') return;
      e.stopPropagation();
      if (this.picking >= 0) this.closeCatalog();
      else this.close();
    }, true);
  }

  // Opens the window for `foe` (who's coming) and `why`; resolves with the companions chosen once
  // the fight is called, or null if it's turned down (close).
  ask({ foe, why }) {
    if (this.shown) this.close();
    const { director, pilot } = this.ctx;
    pilot.keys?.clear(); // (thou stoppest where thou stand'st: no keys reach the world meanwhile)
    // the heroes there are to take: every one but whoever thou art (thou fightest anyway), and Maren
    // when thou art someone else
    this.roster = [...director.heroes.values(), director.maren].filter((n) => n && !n.dead && n !== pilot.npc && n.hero);
    let last = [];
    try { last = JSON.parse(localStorage.getItem(MEMORY) || '[]'); } catch {}
    const remembered = (Array.isArray(last) ? last : []).map((id) => this.roster.find((n) => idOf(n) === id)).filter(Boolean);
    const count = Math.min(this.roster.length, Math.max(SLOTS, remembered.length));
    this.slots = Array.from({ length: count }, (_, i) => remembered[i] || null);
    this.foeEl.replaceChildren(el('b', null, foe), why ? ` · ${why}` : '');
    this.picking = -1;
    this.catalog.hidden = true;
    this.panel.classList.remove('cataloguing');
    this.render();
    this.root.hidden = false;
    this.shown = true;
    this.startBtn.focus({ preventScroll: true });
    return new Promise((resolve) => { this.done = resolve; });
  }

  // Turned down (×, Esc, or left unanswered: fight.js).
  close() {
    if (!this.shown) return;
    this.finish(null);
  }

  start() {
    const party = this.slots.filter(Boolean);
    try { localStorage.setItem(MEMORY, JSON.stringify(party.map(idOf))); } catch {}
    this.finish(party);
  }

  finish(party) {
    this.shown = false;
    this.root.hidden = true;
    this.picking = -1;
    const done = this.done;
    this.done = null;
    done?.(party);
  }

  addSlot() {
    if (this.slots.length >= this.roster.length) return;
    this.slots.push(null);
    this.render();
  }

  // The slots, each a "+" or its companion's portrait, with "Empty slot" under it; "Add slot" only
  // while there are heroes left over for another.
  render() {
    this.slotsEl.replaceChildren(...this.slots.map((n, i) => {
      const slot = el('div', 'slot');
      const pick = el('button', n ? 'pick chosen' : 'pick');
      pick.type = 'button';
      if (n) {
        const art = ROSTER[heroKey(n)] || {};
        pick.append(face(n.hero, 96, 148, 206), el('span', 'who', n.name.first), el('span', 'what', art.style || n.title || ''));
        pick.setAttribute('aria-label', `${n.displayName}: change companion`);
      } else {
        pick.append(el('span', 'plus', '+'));
        pick.setAttribute('aria-label', 'Choose a companion');
      }
      pick.addEventListener('click', () => this.openCatalog(i));
      const empty = el('button', 'empty', 'Empty slot');
      empty.type = 'button';
      empty.disabled = !n;
      empty.addEventListener('click', () => {
        this.slots[i] = null;
        this.render();
        this.slotsEl.children[i]?.querySelector('.pick')?.focus({ preventScroll: true });
      });
      slot.append(pick, empty);
      return slot;
    }));
    this.addBtn.disabled = this.slots.length >= this.roster.length;
    this.addBtn.title = this.addBtn.disabled ? 'There are no more heroes to take' : '';
  }

  // The catalogue, for slot `i`: every hero there is to take, one already chosen elsewhere greyed.
  openCatalog(i) {
    this.picking = i;
    this.list.replaceChildren(...this.roster.map((n) => {
      const key = heroKey(n);
      const art = ROSTER[key] || { style: n.title || '', fights: '', manner: '' };
      const ult = ULTS[key];
      const taken = this.slots.some((s, k) => s === n && k !== i);
      const card = el('button', 'hero');
      card.type = 'button';
      card.disabled = taken;
      const thumb = el('span', 'face');
      thumb.append(face(n.hero, 52, 72, 112));
      const about = el('span', 'about');
      const name = el('span', 'name', n.name.first);
      if (n.name.epithet) name.append(el('small', null, ` ${n.name.epithet}`));
      about.append(name, el('span', 'tags', `${n.title} · ${art.style}`));
      if (art.fights) about.append(el('span', 'line', art.fights));
      if (ult) {
        const u = el('span', 'line ult');
        u.append(el('b', null, ult.name), `${ult.aim ? ' (aimed)' : ''}: ${art.ult || ''}`);
        about.append(u);
      }
      if (art.manner) about.append(el('span', 'line manner', art.manner));
      about.append(el('span', 'where', taken ? 'Already chosen' : this.whereabouts(n)));
      card.append(thumb, about);
      card.addEventListener('click', () => {
        this.slots[i] = n;
        this.closeCatalog();
      });
      return card;
    }));
    this.catalog.hidden = false;
    this.panel.classList.add('cataloguing');
    this.catalog.scrollTop = 0;
    this.list.querySelector('.hero:not(:disabled)')?.focus({ preventScroll: true });
  }

  closeCatalog() {
    const i = this.picking;
    this.picking = -1;
    this.catalog.hidden = true;
    this.panel.classList.remove('cataloguing');
    this.render();
    if (i >= 0) this.slotsEl.children[i]?.querySelector('.pick')?.focus({ preventScroll: true });
  }

  whereabouts(n) {
    if (n.isMaren) return 'Wandering the Lands Between';
    if (n.unbound) return 'At the Round Table';
    return `On a quest in ${n.region.project}`;
  }
}
