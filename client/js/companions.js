// Choosing who fights beside thee, as a great enemy comes (fight.js, call). A window across the
// middle of the screen: "Choose your companions", who is coming and why, and four tall slots (more
// with "Add slot", up to as many heroes as there are to take). Each empty slot is a "+" that opens
// the catalogue of heroes: how each fights, its ultimate, its manner, and where it is just now.
// A chosen one stands in its slot, large, idling in its own art; "Empty slot" under it frees the
// slot again, and a click on it changes it. "Start fight", with however many
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

// A hero standing in a box of its own (a slot, or a card in the catalogue): its idle pose, played
// over and over (or, `still`, its first drawing). Every hero comes out as tall as the others, by its
// height in the world (heroes are drawn at different scales: they stand 2.6 to 3.1 units, hats and
// raised blades included), `tall` world units to the box's height, feet on the canvas's floor. In a
// slot the canvas reaches past the box (game.css), so that the hero stands out of it: drawn over its
// frame, head and blade beyond its edges.
class Figure {
  constructor(sheet, { still = false, tall = 3.1 } = {}) {
    this.sheet = sheet;
    this.still = still;
    this.tall = tall;
    this.canvas = el('canvas', 'figure');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.g = this.canvas.getContext('2d');
    this.shown = -1;
    this.offset = Math.random() * 10; // (no two idling in step)
  }

  draw(t) {
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const box = c.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const W = Math.round(box.width * dpr);
    const H = Math.round(box.height * dpr);
    const s = this.sheet;
    const def = s.anims.idle || Object.values(s.anims)[0];
    const i = this.still ? def.frames[0] : def.frames[Math.floor((t + this.offset) * def.fps) % def.frames.length];
    if (c.width === W && c.height === H && i === this.shown) return;
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    this.shown = i;
    // (the box the hero stands in, CSS pixels: a slot's, which it stands out of; a card's figure, its own)
    const room = (this.still ? 0 : c.parentElement?.clientHeight) || box.height;
    const k = ((room * dpr) / this.tall) * s.px; // (screen pixels to the art's)
    // (the sheet the frame is in: a big pose's own, heroes/core.js; the character's middle mid-canvas)
    const slot = s.slots?.[i];
    const grid = slot?.big ? s.big : s;
    const at = slot ? slot.k : i;
    const { frameW: FW, frameH: FH } = grid;
    const fw = FW * k;
    const fh = FH * k;
    const sx = (at % grid.cols) * FW;
    const sy = Math.floor(at / grid.cols) * FH;
    const dx = Math.round(W / 2 - (grid.anchor ?? FW / 2) * k);
    const dy = Math.round(H - fh - 2 * dpr);
    const g = this.g;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, W, H);
    g.drawImage(grid.color, sx, sy, FW, FH, dx, dy, fw, fh);
    // (and what of it glows, glowing)
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.45;
    g.drawImage(grid.glow, sx, sy, FW, FH, dx, dy, fw, fh);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }
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
    this.figures = []; // the companions idling in their slots
    this.raf = 0;
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
    this.idle();
    return new Promise((resolve) => { this.done = resolve; });
  }

  // The companions in their slots idle while the window is open.
  idle() {
    cancelAnimationFrame(this.raf);
    const loop = () => {
      if (!this.shown) return;
      const t = performance.now() / 1000;
      for (const f of this.figures) f.draw(t);
      this.raf = requestAnimationFrame(loop);
    };
    loop();
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
    cancelAnimationFrame(this.raf);
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
    this.figures = [];
    this.slotsEl.replaceChildren(...this.slots.map((n, i) => {
      const slot = el('div', 'slot');
      const pick = el('button', n ? 'pick chosen' : 'pick');
      pick.type = 'button';
      if (n) {
        const art = ROSTER[heroKey(n)] || {};
        const figure = new Figure(n.hero);
        this.figures.push(figure);
        pick.append(figure.canvas, el('span', 'who', n.name.first), el('span', 'what', art.style || n.title || ''));
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
    const t = performance.now() / 1000;
    for (const f of this.figures) f.draw(t);
  }

  // The catalogue, for slot `i`: every hero there is to take, one already chosen elsewhere greyed.
  openCatalog(i) {
    this.picking = i;
    const faces = [];
    this.list.replaceChildren(...this.roster.map((n) => {
      const key = heroKey(n);
      const art = ROSTER[key] || { style: n.title || '', fights: '', manner: '' };
      const ult = ULTS[key];
      const taken = this.slots.some((s, k) => s === n && k !== i);
      const card = el('button', 'hero');
      card.type = 'button';
      card.disabled = taken;
      const thumb = el('span', 'face');
      const figure = new Figure(n.hero, { still: true, tall: 3.25 });
      faces.push(figure);
      thumb.append(figure.canvas);
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
    for (const f of faces) f.draw(0);
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
