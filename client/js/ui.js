// DOM overlay: title and stats, the message log, center-screen banners, speech bubbles that
// follow characters, the inspect panel and the fan of gestures over a head. All text is set with
// textContent, so nothing arriving from the bridge is ever parsed as HTML.

import * as THREE from 'three';
import { buildIcon } from './sprites.js';
import { GESTURES, STATION_LABEL } from './director.js';
import { stats } from './lore.js';
import { REGION, HUB } from './config.js';
import { groundAt } from './ground.js';

// The Arena of Trials' mark on the map strip: a horned skull, in pixels, its horns sweeping out
// from the top of the head and curving down beside the face (h: its paler brow).
const SKULL = [
  '.....xhhhhhhhx.....',
  '..xxxxxxxxxxxxxxx..',
  '.xxx.xxxxxxxxx.xxx.',
  'xxx..xx..x..xx..xxx',
  'xx...xx..x..xx...xx',
  'xx...xxxx.xxxx...xx',
  '.x....xxxxxxx....x.',
  '.x....x.x.x.x....x.',
  '......xxxxxxx......',
];

const $ = (sel) => document.querySelector(sel);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function iconCanvas(name, size = 32) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buildIcon(name), 0, 0, size, size);
  return c;
}

function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export class UI {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.bubbles = [];
    this.logEl = $('#log');
    this.bannerEl = $('#banner');
    this.statsEl = $('#stats');
    this.statusEl = $('#status');
    this.inspectEl = $('#inspect');
    this.fanEl = $('#fan');
    this.fanOwner = null; // whose head the fan of gestures opens over (a Tarnished, or Maren)
    this.labelEl = $('#label');
    this.bubbleLayer = $('#bubbles');
    this.regionsEl = $('#regions');
    this.areaEl = $('#area');
    this.labelsEl = $('#region-labels');
    this.regionButtons = new Map();
    this.regionLabels = new Map();
    this.focusArea = null;
    this.pendingArea = null;
    this.pendingSince = 0;
    this.shownArea = null;
    this.overview = false;
    this.selected = null;
    this.hovered = null;
    this.inspectTimer = 0;
    this.bannerQueue = [];
    this.bannerBusy = false;
    this.sound = null; // (what's heard as a banner is revealed: main.js, audio.js)
    this.v = new THREE.Vector3();
    this.buildFan();
    $('#inspect-close').addEventListener('click', () => this.onDeselect && this.onDeselect());
  }

  // ------------------------------------------------------------------------------------------

  project(pos) {
    this.v.copy(pos).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: ((this.v.x + 1) / 2) * r.width, y: ((1 - this.v.y) / 2) * r.height, behind: this.v.z > 1 };
  }

  // target: an npc or { region } — clicking the line flies the camera there.
  log(text, tone = '', target = null) {
    const li = el('li', tone, text);
    if (target && this.onFocus) {
      li.classList.add('link');
      li.addEventListener('click', () => this.onFocus(target));
    }
    this.logEl.prepend(li);
    requestAnimationFrame(() => li.classList.add('in'));
    setTimeout(() => li.classList.add('out'), 14000);
    setTimeout(() => li.remove(), 15500);
    while (this.logEl.children.length > 7) this.logEl.lastChild.remove();
  }

  // One of the world's own (a great enemy coming, felled, prevailing) goes before any session's
  // still waiting, and cuts one showing short.
  banner(title, sub = '', tone = 'gold', session = false) {
    if (session && this.hushed?.()) return;
    if (!session) {
      this.bannerQueue = this.bannerQueue.filter((b) => !b.session);
      if (this.bannerShown?.session) {
        clearTimeout(this.bannerTimer);
        this.bannerBusy = false;
      }
    }
    this.bannerQueue.push({ title, sub, tone, session });
    if (this.bannerQueue.length > 3) this.bannerQueue.shift();
    if (!this.bannerBusy) this.nextBanner();
  }

  // A banner about a session (an island rising, a quest fulfilled or failed, a spell): never shown
  // while the world holds still for a great enemy (main.js sets `hushed`), nor kept for after it;
  // the message log still has it. With `noticeGap` set (the public demo, main.js), no more than
  // one in that many seconds, the rest left to the log; but an `important` one (an island rising)
  // always shows.
  notice(title, sub = '', tone = 'gold', important = false) {
    if (this.hushed?.()) return; // (nor does a hushed one take the place of the next)
    const now = performance.now() / 1000;
    if (!important && this.noticeGap && now - (this.lastNotice ?? -Infinity) < this.noticeGap) return;
    if (!important && this.noticeGap && this.bannerQueue.some((b) => b.session)) return; // (one waiting already)
    this.lastNotice = now;
    this.banner(title, sub, tone, true);
  }

  nextBanner() {
    let b = this.bannerQueue.shift();
    while (b?.session && this.hushed?.()) b = this.bannerQueue.shift();
    this.bannerShown = b || null;
    if (!b) { this.bannerBusy = false; return; }
    this.bannerBusy = true;
    const h = this.bannerEl.querySelector('h2');
    const p = this.bannerEl.querySelector('p');
    h.textContent = b.title;
    p.textContent = b.sub;
    this.bannerEl.dataset.tone = b.tone;
    this.bannerEl.classList.remove('show');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
    this.sound?.play('ui-banner');
    this.bannerTimer = setTimeout(() => this.nextBanner(), 3900);
  }

  say(npc, text, duration = 3, tone = '') {
    for (const b of this.bubbles) if (b.npc === npc) b.until = 0;
    const div = el('div', 'bubble');
    if (tone) div.classList.add(tone); // ('boss': a great enemy's words, in red)
    // *asterisks* mark a gesture rather than words
    for (const part of text.split(/(\*[^*]+\*)/)) {
      if (/^\*[^*]+\*$/.test(part)) div.append(el('i', null, part.slice(1, -1)));
      else if (part) div.append(part);
    }
    this.bubbleLayer.append(div);
    this.bubbles.push({ npc, div, until: performance.now() / 1000 + duration });
  }

  setStats(total, working, waiting) {
    const parts = [`${total} Tarnished`];
    if (working) parts.push(`${working} at work`);
    if (waiting) parts.push(`${waiting} await${waiting === 1 ? 's' : ''} thee`);
    this.statsEl.textContent = parts.join(' · ');
    this.statsEl.dataset.waiting = waiting ? '1' : '';
  }

  // The map strip at the bottom: one line as wide as the whole world (the Hold and every island
  // that has risen), each area's name over its own place on it (clicked, it takes thee there by
  // grace), and a golden dot under it where thou art, between islands too (updateMap). While a
  // great enemy is abroad the Arena of Trials shows over the Hold in red, under a horned skull, and
  // every island but the Hold is out of reach.
  buildMap() {
    const m = this.regionsEl;
    m.append(el('div', 'map-line'));
    this.mapMarks = el('div', 'map-marks');
    this.mapMe = el('div', 'map-me');
    this.mapMe.title = 'Thou art here';
    this.mapArena = el('div', 'map-arena');
    this.mapArena.hidden = true;
    const skull = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    skull.setAttribute('viewBox', `0 0 ${SKULL[0].length} ${SKULL.length}`);
    skull.setAttribute('shape-rendering', 'crispEdges');
    skull.setAttribute('aria-hidden', 'true');
    SKULL.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '.') return;
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', x);
      r.setAttribute('y', y);
      r.setAttribute('width', 1);
      r.setAttribute('height', 1);
      r.setAttribute('fill', c === 'h' ? '#ff9a7a' : '#ff3a2a');
      skull.append(r);
    }));
    this.mapArena.append(skull, el('span', 'map-arena-name', 'Arena of Trials'));
    m.append(this.mapMarks, this.mapArena, this.mapMe);
    this.mapSpan = { min: -12, max: 12 };
    this.mapBoss = false;
  }

  // The areas on the map, with live counts: Roundtable Hold and each risen island (director.js).
  setRegions(list) {
    if (!this.mapMarks) this.buildMap();
    // the world's width, the same either side of the Hold (so it always sits in the very middle):
    // out to the far edge of whichever island lies farthest east or west
    let reach = HUB.radius;
    for (const r of list) reach = Math.max(reach, Math.abs(r.area.cx) + (r.area.biome ? REGION.halfW : HUB.radius));
    this.mapSpan = { min: -reach, max: reach };
    const seen = new Set();
    for (const r of list) {
      seen.add(r.area);
      let b = this.regionButtons.get(r.area);
      if (!b) {
        const btn = el('button', 'map-mark');
        btn.type = 'button';
        const name = el('span', 'map-name');
        const swatch = el('i');
        swatch.style.background = r.color;
        const meta = el('em', 'map-meta');
        name.append(swatch, el('span', 'map-label', r.name), meta);
        btn.append(name, el('b', 'map-tick'));
        btn.addEventListener('click', () => this.onFocus && this.onFocus({ region: r.area }));
        if (!r.area.biome) btn.classList.add('hub');
        b = { btn, meta, name, area: r.area };
        this.regionButtons.set(r.area, b);
        this.mapMarks.append(btn);
      }
      b.btn.style.left = `${(this.mapAt(r.area.cx) * 100).toFixed(2)}%`;
      b.btn.disabled = this.mapBoss && !!r.area.biome;
      const meta = [];
      if (r.total) meta.push(`${r.total}`);
      if (r.waiting) meta.push(`!${r.waiting}`);
      b.meta.textContent = meta.join(' ');
      b.btn.dataset.waiting = r.waiting ? '1' : '';
      b.btn.dataset.active = r.area === this.focusArea ? '1' : '';
      b.btn.title = r.area.biome ? `${r.name} — ${r.area.biome.name}` : r.name;
    }
    for (const [area, b] of this.regionButtons) {
      if (!seen.has(area)) { b.btn.remove(); this.regionButtons.delete(area); }
    }
    // names never run into one another: the Hold's always whole, the others each as wide as the
    // room to their neighbours allows (half the gap to an island's, all but the Hold's own half)
    const width = this.regionsEl.clientWidth || 600;
    const marks = [...this.regionButtons.values()].sort((a, b) => a.area.cx - b.area.cx);
    const hub = marks.find((b) => !b.area.biome);
    if (hub) hub.name.style.maxWidth = 'none';
    const hubHalf = hub ? hub.name.offsetWidth / 2 + 10 : 0;
    const room = (b, o) => {
      const gap = Math.abs(this.mapAt(o.area.cx) - this.mapAt(b.area.cx)) * width;
      return o.area.biome ? gap / 2 : gap - hubHalf;
    };
    marks.forEach((b, i) => {
      if (!b.area.biome) return;
      const left = i > 0 ? room(b, marks[i - 1]) : this.mapAt(b.area.cx) * width + 40;
      const right = i < marks.length - 1 ? room(b, marks[i + 1]) : (1 - this.mapAt(b.area.cx)) * width + 40;
      b.name.style.maxWidth = `${Math.max(48, Math.floor(2 * Math.min(left, right) - 6))}px`;
    });
  }

  // Where x lies along the map strip (0 at its west end, 1 at its east).
  mapAt(x) {
    const { min, max } = this.mapSpan;
    return Math.max(0, Math.min(1, (x - min) / (max - min || 1)));
  }

  // Every frame: thy dot where thou art, and the arena while a great enemy is abroad. Sealed in the
  // arena with him (`sealed`), the strip gives way to his health bar till the fight is over.
  updateMap(x, boss, sealed = false) {
    if (!this.mapMarks) this.buildMap();
    this.regionsEl.classList.toggle('sealed', sealed);
    this.mapMe.style.left = `${(this.mapAt(x) * 100).toFixed(2)}%`;
    if (boss) this.mapArena.style.left = `${(this.mapAt(0) * 100).toFixed(2)}%`; // (north of the Hold)
    if (boss === this.mapBoss) return;
    this.mapBoss = boss;
    this.regionsEl.classList.toggle('boss', boss);
    this.mapArena.hidden = !boss;
    for (const b of this.regionButtons.values()) b.btn.disabled = boss && !!b.area.biome;
  }

  // Elden Ring-style area title when the camera settles over a new area.
  setFocusArea(area, now) {
    if (area !== this.focusArea) {
      this.focusArea = area;
      for (const [a, b] of this.regionButtons) b.btn.dataset.active = a === area ? '1' : '';
    }
    if (!area || area === this.shownArea) { this.pendingArea = null; return; }
    if (area !== this.pendingArea) { this.pendingArea = area; this.pendingSince = now; return; }
    if (now - this.pendingSince < 0.7 || this.overview) return;
    this.shownArea = area;
    this.pendingArea = null;
    this.areaEl.querySelector('h2').textContent = area.name;
    this.areaEl.querySelector('p').textContent = area.biome ? area.biome.name : area.subtitle || '';
    this.areaEl.classList.remove('show');
    void this.areaEl.offsetWidth;
    this.areaEl.classList.add('show');
  }

  setStatus(connected, demo) {
    if (connected === 'demo') {
      // the public demo: nothing to connect to
      this.statusEl.dataset.ok = '1';
      this.statusEl.querySelector('span').textContent = 'Public demo · made-up sessions';
      return;
    }
    this.statusEl.dataset.ok = connected ? '1' : '';
    this.statusEl.querySelector('span').textContent = connected ? 'Bridge connected' : 'Seeking the bridge…';
    $('#demo-btn').textContent = demo ? 'Dismiss phantoms' : 'Summon phantoms';
  }

  // ------------------------------------------------------------------------------------------
  // the Round Table's menu (E at the table): summon a great enemy, take a seat

  openTable() {
    const menu = $('#table-menu');
    const summon = $('#table-summon');
    const busy = this.canSummon ? this.canSummon() : 'Not yet';
    summon.disabled = busy !== true;
    summon.textContent = busy === true ? 'Summon a great enemy' : busy;
    menu.hidden = false;
    this.tableOpen = true;
  }

  closeTable() {
    $('#table-menu').hidden = true;
    this.tableOpen = false;
  }

  // ------------------------------------------------------------------------------------------
  // selection, inspect panel and the fan of gestures

  // A fan over a character's head. Over thyself (pilot.js): an arc of gestures, left to right.
  // Over anyone else (Maren too, when thou art someone else): a single button to become them;
  // nobody else can be made to gesture.
  buildFan() {
    const n = GESTURES.length;
    const step = (21 * Math.PI) / 180;
    const radius = 112;
    this.fanButtons = GESTURES.map((g, i) => {
      const btn = el('button', 'fan-btn gesture');
      btn.type = 'button';
      btn.title = `${g.label}  (${i + 1})`;
      btn.append(iconCanvas(g.icon || { bow: 'crown', kneel: 'bell' }[g.key] || 'dots', 26), el('span', '', g.label), el('b', '', String(i + 1)));
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * step;
      btn.style.setProperty('--x', `${Math.cos(a) * radius}px`);
      btn.style.setProperty('--y', `${Math.sin(a) * radius}px`);
      btn.style.setProperty('--delay', `${Math.abs(i - (n - 1) / 2) * 28}ms`);
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const owner = this.fanOwner;
        if (!owner || !owner.piloted || !this.onGesture) return;
        this.onGesture(owner, g.key);
        this.closeFan(); // one gesture at a time
      });
      this.fanEl.append(btn);
      return btn;
    });
    const special = (cls, icon, x, y, action) => {
      const btn = el('button', `fan-btn ${cls}`);
      btn.type = 'button';
      const label = el('span', '');
      btn.append(iconCanvas(icon, 26), label);
      btn.style.setProperty('--x', `${x}px`);
      btn.style.setProperty('--y', `${y}px`);
      btn.style.setProperty('--delay', '0ms');
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        action(this.fanOwner);
      });
      this.fanEl.append(btn);
      return { btn, label };
    };
    this.becomeBtn = special('become', 'sparkle', 0, -50, (owner) => owner && this.onBecome && this.onBecome(owner));
  }

  openFan(owner) {
    this.fanOwner = owner;
    // over thyself, gestures; over anyone else, "Become"
    this.fanEl.dataset.mode = owner.piloted ? 'self' : 'other';
    this.becomeBtn.label.textContent = `Become ${owner.name.first}`;
    this.becomeBtn.btn.title = `Become ${owner.displayName}`;
    this.fanEl.hidden = false;
    this.fanEl.classList.remove('open');
    void this.fanEl.offsetWidth;
    this.fanEl.classList.add('open');
    this.placeFan();
  }

  closeFan() {
    this.fanOwner = null;
    this.fanEl.classList.remove('open');
    this.fanEl.hidden = true;
  }

  // Folded away while its owner is carried, opened again when set down.
  hideFan() {
    this.fanEl.classList.remove('open');
  }

  showFan() {
    if (this.fanOwner) this.fanEl.classList.add('open');
  }

  placeFan() {
    const o = this.fanOwner;
    if (!o) return;
    const head = o.head();
    head.y += 0.2;
    const p = this.project(head);
    this.fanEl.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
  }

  select(npc) {
    this.selected = npc;
    this.inspectEl.hidden = !npc;
    if (npc) {
      if (npc.spectre) this.closeFan(); // a spectre can only be looked at
      else this.openFan(npc);
      this.refreshInspect(true);
    } else if (this.fanOwner && !this.fanOwner.piloted) {
      this.closeFan();
    }
  }

  describeState(npc) {
    const k = npc.intent.kind;
    if (npc.piloted) return 'Guided by thy hand';
    if (k === 'fight') return npc.fighter?.dead ? 'Fallen, resting at the Hold till the fight is over' : 'Fighting in the Arena of Trials';
    if (npc.dragged) return 'Carried by an unseen hand';
    if (k === 'train') return npc.travel ? 'Bound for the training yard' : npc.trainee?.self ? 'Training in the yard, with nothing else to do' : 'Training in the yard, at thy call';
    if (k === 'work') return npc.path.length ? `Hastening to ${STATION_LABEL[npc.intent.station]}` : `At ${STATION_LABEL[npc.intent.station]}`;
    if (k === 'channel') return npc.intent.anim === 'pray' ? 'Channelling summoned spirits' : npc.intent.anim === 'read' ? 'Pondering the quest' : 'Weaving an incantation';
    if (k === 'wait') return 'Awaiting thy command at the gate';
    if (k === 'rest') return 'Resting at the Site of Grace';
    if (k === 'leave') return 'Passing through the fog';
    if (k === 'gather') {
      if (npc.unbound) return 'At the Round Table, awaiting a quest';
      return npc.region.risen ? 'Rising from the Round Table' : `At the Round Table, awaiting ${npc.region.project}`;
    }
    if (k === 'journey') return npc.intent.dest === 'hub' ? 'Returning to the Round Table' : `Journeying home to ${npc.region.project}`;
    if (npc.travel) return 'Travelling by grace';
    if (k === 'visit') return npc.path.length ? 'Bound for Roundtable Hold' : 'Seated at the Round Table';
    if (npc.talk) return `Conversing with ${npc.talk.partner.name.first}`;
    return 'Wandering the courtyard';
  }

  refreshInspect(force = false) {
    const npc = this.selected;
    if (!npc) return;
    const s = npc.session;
    const st = stats(s);
    $('#inspect-name').textContent = npc.name.first;
    $('#inspect-epithet').textContent = npc.name.epithet;
    const where = (n) => n.region?.project || n.region?.name || 'the Lands Between';
    $('#inspect-class').textContent = npc.isMaren ? `${npc.title}, thine own` : npc.unbound ? `${npc.title} of Roundtable Hold` : `${npc.title} of ${npc.region.project}${npc.demo ? ' (phantom)' : ''}`;
    // Maren is no session's: she is thine, and walks where she will while thou art someone else
    const rows = npc.isMaren ? [
      ['Region', where(npc)],
      ['State', this.describeState(npc)],
      ['Quest', 'None: she keeps watch while thou art another'],
    ] : npc.unbound ? [
      ['Region', 'Roundtable Hold'],
      ['State', this.describeState(npc)],
      ['Quest', 'None yet: the next Claude Code session to begin is theirs'],
    ] : [
      ['Region', `${npc.region.project} · ${npc.region.biome.name}`],
      ['State', this.describeState(npc)],
      ['Current rite', s.tool ? (s.tool.startsWith('mcp__') ? `${s.tool.split('__').pop()} · MCP` : s.tool) : '—'],
      ['Mantle', s.model ? s.model.charAt(0).toUpperCase() + s.model.slice(1) : 'Unknown'],
      ['Awake for', ago(Date.now() - (s.startedAt || Date.now()))],
      ['Quests', String(s.prompts || 0)],
      ['Rites performed', String(s.toolTotal || 0)],
      ['Spirits', String(s.spirits || 0)],
    ];
    const dl = $('#inspect-rows');
    dl.replaceChildren();
    for (const [k, v] of rows) dl.append(el('dt', '', k), el('dd', '', v));
    const bars = $('#inspect-bars');
    bars.replaceChildren();
    const tools = Object.entries(s.tools || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = tools.length ? tools[0][1] : 1;
    for (const [tool, n] of tools) {
      const row = el('div', 'bar');
      const label = el('span', 'bar-label', tool.startsWith('mcp__') ? `${tool.split('__').pop()} · MCP` : tool);
      const track = el('span', 'bar-track');
      const fill = el('span', 'bar-fill');
      fill.style.width = `${Math.round((n / max) * 100)}%`;
      track.append(fill);
      row.append(label, track, el('span', 'bar-n', String(n)));
      bars.append(row);
    }
    $('#inspect-lore').textContent = st.total
      ? `Hath forged ${st.forged}, studied ${st.read}, invoked ${st.rituals}, and sent ${st.ravens} raven${st.ravens === 1 ? '' : 's'}.`
      : 'Hath performed no rites as yet.';
  }

  // ------------------------------------------------------------------------------------------

  // Floating names over each island, shown when the camera pulls back far enough.
  updateLabels(areas) {
    const seen = new Set();
    for (const a of areas) {
      seen.add(a);
      let lab = this.regionLabels.get(a);
      if (!lab) {
        lab = el('div', 'region-label');
        const h = el('strong', '', a.name);
        const sub = el('span', '', a.biome ? a.biome.name : a.subtitle || '');
        lab.append(h, sub);
        lab.addEventListener('click', () => this.onFocus && this.onFocus({ region: a }));
        this.labelsEl.append(lab);
        this.regionLabels.set(a, lab);
      }
      const p = this.project(new THREE.Vector3(a.cx, 9.5, -8));
      lab.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
      lab.hidden = !this.overview || p.behind;
    }
    for (const [a, lab] of this.regionLabels) if (!seen.has(a)) { lab.remove(); this.regionLabels.delete(a); }
  }

  update(dt) {
    const now = performance.now() / 1000;
    this.bubbles = this.bubbles.filter((b) => {
      if (now > b.until || b.npc.dead) {
        b.div.classList.add('out');
        setTimeout(() => b.div.remove(), 300);
        return false;
      }
      const head = b.npc.head();
      head.y += b.npc.icon || b.npc.persistentIcon ? 1.15 : 0.45;
      const p = this.project(head);
      b.div.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
      return true;
    });

    if (this.selected) {
      if (this.selected.dead) { this.onDeselect && this.onDeselect(); }
      else {
        this.inspectTimer -= dt;
        if (this.inspectTimer <= 0) { this.inspectTimer = 0.4; this.refreshInspect(); }
      }
    }
    if (this.fanOwner) {
      if (this.fanOwner.dead) this.closeFan();
      else this.placeFan();
    }

    const h = this.hovered && !this.hovered.dead && this.hovered !== this.selected ? this.hovered : null;
    this.labelEl.hidden = !h;
    if (h) {
      const p = this.project(new THREE.Vector3(h.pos.x, groundAt(h.pos.x, h.pos.y) + h.lift - 0.1, h.pos.y));
      this.labelEl.textContent = h.displayName;
      this.labelEl.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, 0)`;
    }
  }
}
