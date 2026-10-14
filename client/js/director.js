// Turns the bridge's event stream into life across the world: which region a session lives in,
// who walks where, which gesture plays for which slash command, bells, banners, the message
// log, small talk between idle Tarnished (each in their own voice), the lines they say when
// something happens, and their trips to Roundtable Hold.

import { STATIONS, STATION_LABEL, TIMING, HUB_LAYOUT, stationForTool } from './config.js';
import { Npc } from './npc.js';
import { SPECTRE_COLORS, spectreSheet } from './spectres.js';
import { conversation } from './lore.js';
import { speak, voiceOf } from './voices.js';

const COMMAND_FX = {
  'code-review': { title: 'Incantation of Scrutiny', icon: 'eye' },
  review: { title: 'Incantation of Scrutiny', icon: 'eye' },
  'security-review': { title: 'Ward of Vigilance', icon: 'eye' },
  init: { title: 'A New Oath Is Sworn', icon: 'crown' },
  loop: { title: 'The Eternal Rite', icon: 'rune' },
  schedule: { title: 'A Pact With Time', icon: 'bell' },
  handoff: { title: 'The Torch Is Passed', icon: 'sparkle' },
  reprise: { title: 'The Vigil Resumes', icon: 'sparkle' },
  simplify: { title: 'Rite of Unburdening', icon: 'rune' },
  model: { title: 'A Change of Mantle', icon: 'crown' },
};

export const GESTURES = [
  { key: 'bow', label: 'Bow', anim: 'bow', icon: null },
  { key: 'wave', label: 'Wave', anim: 'wave', icon: 'note' },
  { key: 'point', label: 'Point', anim: 'point', icon: 'quest' },
  { key: 'kneel', label: 'Kneel', anim: 'kneelBow', icon: null },
  { key: 'cheer', label: 'Rejoice', anim: 'cheer', icon: 'sparkle' },
  { key: 'pray', label: 'Pray', anim: 'pray', icon: 'rune' },
  { key: 'heart', label: 'Fondness', anim: 'wave', icon: 'heart' },
  { key: 'rest', label: 'Rest', anim: 'sit', icon: 'zzz' },
];

const RESPONSES = { bow: 'bow', kneel: 'bow', wave: 'wave', cheer: 'cheer', heart: 'heart', point: 'question' };
// what a bystander says back to a gesture (see voices.js)
const REPLIES = { bow: 'bow_reply', kneel: 'bow_reply', wave: 'wave_reply', cheer: 'cheer_reply', heart: 'heart_reply', point: 'point_reply', pray: 'pray_reply' };
const TALKERS = new Set(['wander', 'visit', 'gather']);
// what a Tarnished in a fight against a great enemy may say (fight.js): nothing of its work
const FIGHT_LINES = new Set(['battle', 'victory', 'flee', 'cower', 'taunt', 'fallen']);
const RISE_FIRST = 3; // seconds before the first island rises from the mist
const RISE_GAP = 10; // between islands rising one after another
const LEAVE_AFTER = 2.5; // a newcomer sits at the Round Table at least this long
// The Twofold's change of form (seconds): the drawing of the change replaces the old form, then
// the new form bursts out, then it's free to move again.
const SHIFT = { change: 0.8, reveal: 3.4, end: 4.0 };

// What a hand-drawn hero carries while no Claude Code session has taken them up.
const idleSession = (sid) => ({ sid, project: null, state: 'idle', startedAt: 0, tools: {} });

// How long a line stays over someone's head.
const readTime = (text) => Math.min(5, 1.8 + text.length * 0.045);

export class Director {
  constructor(ctx) {
    this.ctx = ctx;
    this.npcs = new Map();
    this.lastCommand = new Map();
    this.questStart = new Map();
    this.chatTimer = 3;
    this.visitTimer = 5;
    this.talks = [];
    this.remarks = []; // lines waiting to be said: { npc, intent, to, at } (no npc: an answer)
    this.nextGreet = 0;
    this.selected = null;
    this.statsTimer = 0;
    this.clock = 0;
    this.rises = []; // islands waiting to rise: { at, region, announce, started }
    this.lastRise = -Infinity;
    this.riseGap = RISE_GAP;
    this.notBefore = 0; // no island rises before this (the public demo: not before the player is up)
    this.retireAfter = 0;
    this.waiting = new Map(); // sid -> session: sessions waiting, unseen, for a hero to come free // the public demo: seconds an island may stand empty before it sinks (0: never)
    this.heroes = new Map(); // hero id -> the hand-drawn hero (bound to a session or not)
  }

  // The hand-drawn heroes live here from the start: seated at the Round Table before any island
  // exists, each waiting for a Claude Code session to take them up. A generic Tarnished only
  // appears when every hero is already out on a quest.
  // A hero with more than one form (the Twofold: night, day and the two drawings of the change) is
  // one actor wearing them in turn, starting with the form for the hour.
  start() {
    const [gx, gz] = HUB_LAYOUT.grace;
    const sheets = this.ctx.heroSheets || [];
    const forms = new Map();
    for (const sheet of sheets) {
      const { pair, form } = sheet.rig;
      if (pair) forms.set(pair, { ...forms.get(pair), [form]: sheet });
    }
    for (const sheet of sheets) {
      const id = sheet.rig.pair || sheet.hero;
      const own = forms.get(id);
      if (this.heroes.has(id) || (own && !(own.night && own.day))) continue;
      const sid = `hero:${id}`;
      const npc = new Npc(this.ctx, idleSession(sid), { x: gx, z: gz + 2, region: this.ctx.world.hub });
      npc.heroActor = id;
      npc.unbound = true;
      if (own) {
        npc.forms = own;
        npc.form = this.formNow();
      }
      npc.setHero(own ? own[npc.form] : sheet, { quiet: true });
      npc.setIntent({ kind: 'gather', leaveAt: Infinity, stagger: 0 });
      this.heroes.set(id, npc);
      this.npcs.set(sid, npc);
    }
  }

  // The Twofold's form for the hour: the day form from halfway through dawn to halfway through dusk.
  formNow() {
    const daylight = this.ctx.daylight;
    return (daylight ? daylight.amount ?? daylight.now() : 0) >= 0.5 ? 'day' : 'night';
  }

  // Halfway through dusk or dawn the Twofold becomes its other form: golden light gathers, the
  // drawing of the change holds a moment, then the other form bursts out under its own name.
  updateForms(dt) {
    const want = this.formNow();
    for (const n of this.heroes.values()) {
      if (!n.forms || n.dead) continue;
      if (n.shift) { this.stepShift(n, dt); continue; }
      if (n.form === want || n.dragged || n.travel || n.fade < 1) continue;
      n.shift = { to: want, t: 0, stage: 0, glow: 0 };
      n.action = { kind: 'transform', anim: 'cast', t: 0, dur: SHIFT.end };
      n.body.play('cast', true);
      this.log(`${n.displayName} is wreathed in golden light…`, 'gold', n);
    }
  }

  stepShift(n, dt) {
    const s = n.shift;
    s.t += dt;
    s.glow -= dt;
    if (s.glow <= 0 && s.stage < 2) {
      s.glow = 0.12;
      this.ctx.particles.emit({
        pos: [n.pos.x, 1.3, n.pos.y], spread: [0.5, 1.1, 0.3], vel: [0, 1.1, 0], velSpread: [0.3, 0.4, 0.3],
        color: ['#ffd75a', '#fff1c0', '#f0a020'], size: 0.07, life: 1.3, count: 6, drag: 0.6, intensity: 2.2,
      });
    }
    if (s.stage === 0 && s.t >= SHIFT.change) {
      s.stage = 1;
      const middle = n.forms[s.to === 'day' ? 'dawn' : 'dusk'];
      if (middle) {
        n.setHero(middle, { quiet: true, keepName: true });
        n.body.play('idle', true);
      }
    }
    if (s.stage === 1 && s.t >= SHIFT.reveal) {
      s.stage = 2;
      n.setHero(n.forms[s.to]);
      n.form = s.to;
      n.body.play('idle', true);
      this.log(`…and becomes ${n.displayName}`, 'gold', n);
    }
    if (s.t >= SHIFT.end) n.shift = null;
  }

  // Maren the Stormbound: the player's own character, not a session's. While the player is someone
  // else, she goes about the Lands Between like any idle Tarnished.
  addMaren(sheet, x, z) {
    const npc = new Npc(this.ctx, idleSession('player:maren'), { x, z, region: this.ctx.world.areaAt(x, z) || this.ctx.world.hub });
    npc.unbound = true;
    npc.isMaren = true;
    npc.setHero(sheet, { quiet: true });
    this.npcs.set(npc.sid, npc);
    this.maren = npc;
    return npc;
  }

  // The first hero (in roster order) not out on a quest, nor held by the player.
  freeHero() {
    for (const n of this.heroes.values()) if (n.unbound && !n.dead && !n.piloted) return n;
    return null;
  }

  // A session is over: its hero sets it down and walks back to the Round Table; a generic
  // Tarnished passes through the fog and is gone.
  dismiss(npc) {
    if (npc.spectre) { npc.vanish(); return; } // its work done, it fades away
    // a held Tarnished passing through the fog hands the player back to Maren first
    if (npc.piloted && !npc.heroActor) this.ctx.pilot.take(this.maren);
    if (!npc.heroActor) { npc.leave(); return; }
    this.npcs.delete(npc.sid);
    npc.unbind(idleSession(`hero:${npc.heroActor}`), this.ctx.world.hub);
    this.npcs.set(npc.sid, npc);
    npc.setIntent({ kind: 'journey', dest: 'hub' });
  }

  // A line in the message log; but while a great enemy is abroad (fight.js) the log carries the
  // fight alone, and the doings of the Lands Between go unsaid.
  log(...args) {
    if (!this.ctx.fight?.hunting()) this.ctx.ui.log(...args);
  }

  // ------------------------------------------------------------------------------------------
  // regions and slots

  // Every island is born below the mist and rises a moment later, one after another.
  regionOf(project, announce) {
    const { region, created } = this.ctx.world.regionFor(project || 'Unknown');
    if (created) {
      region.sink();
      const at = Math.max(this.clock + RISE_FIRST, this.lastRise + this.riseGap, this.notBefore);
      this.lastRise = at;
      this.rises.push({ at, region, announce, started: false });
      this.ctx.nav.sync();
      this.ctx.onWorldGrew?.();
    }
    return region;
  }

  // Islands may rise from `at` on, one after another: those already waiting are timed afresh.
  holdRisesUntil(at) {
    this.notBefore = at;
    this.lastRise = -Infinity;
    for (const r of this.rises) {
      if (r.started) continue;
      r.at = Math.max(at, this.lastRise + this.riseGap);
      this.lastRise = r.at;
    }
  }

  updateRises() {
    for (const r of this.rises) {
      if (!r.started && this.clock >= r.at) {
        r.started = true;
        r.region.startRise();
        if (r.announce) this.ctx.ui.notice(r.region.project, `A new region rises from the mist · ${r.region.biome.name}`);
        this.log(`${r.region.project}: ${r.region.biome.name} rises from the mist`, 'gold', { region: r.region });
      }
      if (r.started && r.region.risen) {
        r.region.risenAt = this.clock;
        this.ctx.world.version += 1;
        this.ctx.nav.sync();
      }
    }
    this.rises = this.rises.filter((r) => !r.region.risen);
  }

  // The public demo lets an island nobody calls home any more sink back into the mist after a
  // while: only the outermost on its side (the others hold up a bridge), and only once nobody
  // stands on it or its bridge. With real sessions islands stay.
  retireIslands() {
    if (!this.retireAfter) return;
    const { world, ui, nav } = this.ctx;
    for (const r of world.regionList()) {
      if (r.sunk) {
        world.removeRegion(r);
        nav.sync();
        this.ctx.onWorldGrew?.();
        this.log(`${r.project}: ${r.biome.name} sinks into the mist`, 'dim');
        continue;
      }
      if (r.sinking || !r.risen) continue;
      const bridge = world.bridges.find((b) => b.region === r);
      const there = (n) => world.areaAt(n.pos.x, n.pos.y) === r
        || (bridge && n.pos.x >= bridge.x0 && n.pos.x <= bridge.x1 && n.pos.y >= bridge.z0 - 1 && n.pos.y <= bridge.z1 + 1);
      if ([...this.npcs.values()].some((n) => n.region === r || there(n))) { r.emptySince = null; continue; }
      r.emptySince ??= this.clock;
      if (this.clock - r.emptySince >= this.retireAfter && world.isOutermost(r)) r.startSink();
    }
  }

  // Where a newcomer stands when every seat at the Round Table is taken.
  standingSpot(npc) {
    const [tx, tz] = HUB_LAYOUT.table;
    const standing = [...this.npcs.values()].filter((n) => n !== npc && n.intent.kind === 'gather' && !n.slot).length;
    const a = standing * 2.4 + 0.3;
    const [x, z] = this.ctx.nav.clampToWalkable(tx + Math.cos(a) * 4.7, tz + Math.sin(a) * 3.5);
    return { x, z, face: x < tx ? 1 : -1 };
  }

  // Seated at the Round Table until their island has risen; then they set off home on foot.
  updateGathering() {
    for (const n of this.npcs.values()) {
      if (n.intent.kind !== 'gather' || n.unbound || n.action || n.dragged || n.inTalk || !n.region.risen) continue;
      if (this.clock < n.intent.leaveAt || this.clock < (n.region.risenAt ?? 0) + n.intent.stagger) continue;
      n.setIntent({ kind: 'journey' });
      this.log(`${n.name.first} rises from the Round Table and sets out for ${n.region.project}`, 'dim', n);
      this.remark(n, 'depart', null, 0.3);
      if (this.clock > (this.lastLuck ?? -Infinity) + 2.5) {
        this.lastLuck = this.clock;
        this.answer(n, 'luck', 2, 7);
      }
    }
  }

  // Maren's blow lands: whoever stands just in front of her staggers (it's all for show).
  strikeFrom(p) {
    // in the arena, a great enemy takes the blow; fellow fighters are spared it
    const fight = this.ctx.fight;
    if (fight?.active) fight.strikeFrom(p);
    for (const n of this.npcs.values()) {
      if (n === p || n.dead || n.dragged || n.travel || n.fade < 1 || n.intent.kind === 'leave') continue;
      if (n.fighter || n.spectre) continue; // (a blow passes through a spectre)
      const ahead = (n.pos.x - p.pos.x) * p.body.facing;
      if (ahead < -0.3 || ahead > 2.8 || Math.abs(n.pos.y - p.pos.y) > 1.3) continue;
      n.body.facing = p.pos.x > n.pos.x ? 1 : -1;
      n.stagger();
      if (this.clock > (n.struckAt ?? -Infinity) + 4 && Math.random() < 0.8) this.remark(n, 'struck', p, 0.5);
      n.struckAt = this.clock;
    }
  }

  // Home at last: take up whatever the session is doing.
  // Arrived: back at the Round Table (to wait for a quest, or to set out again for a new one),
  // or home, taking up whatever the session is doing.
  journeyDone(npc) {
    if (npc.intent.dest === 'hub') {
      npc.setIntent({ kind: 'gather', leaveAt: npc.unbound ? Infinity : this.clock + 1, stagger: 0.5 });
      if (npc.unbound) {
        this.remark(npc, 'back', null, 0.6);
        this.answer(npc, 'welcome', 2.6, 7);
      }
      return;
    }
    npc.setIntent({ kind: 'wander' });
    if (npc.session.state !== 'idle') this.applyState(npc, npc.session);
  }

  reserveSlot(region, station, npc) {
    const list = region.slots[station];
    const defs = STATIONS[station].slots;
    let idx = list.indexOf(npc);
    if (idx < 0) {
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < list.length; i++) {
        if (list[i]) continue;
        const s = region.slotWorld(station, i);
        const d = Math.hypot(s.x - npc.pos.x, s.z - npc.pos.y);
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) {
        const s = region.slotWorld(station, Math.floor(Math.random() * defs.length));
        const [x, z] = this.ctx.nav.clampToWalkable(s.x + (Math.random() - 0.5) * 1.4, s.z + 0.6 + Math.random() * 0.8);
        return { region, station, index: -1, x, z, face: s.face };
      }
      list[best] = npc;
      idx = best;
    }
    return { region, station, index: idx, ...region.slotWorld(station, idx) };
  }

  releaseSlot(slot, npc) {
    if (slot.index < 0 || !slot.region) return;
    const list = slot.region.slots[slot.station];
    if (list[slot.index] === npc) list[slot.index] = null;
  }

  stationNear(x, z) {
    const area = this.ctx.world.areaAt(x, z);
    if (!area || area === this.ctx.world.hub) return null;
    for (const [id, st] of Object.entries(STATIONS)) {
      if (!st.anim) continue;
      for (let i = 0; i < st.slots.length; i++) {
        const s = area.slotWorld(id, i);
        if (Math.hypot(s.x - x, s.z - z) < 1.3) return { station: id, face: s.face };
      }
    }
    return null;
  }

  // The area most worth looking at right now: where someone waits, else where most work.
  busiestArea() {
    let best = null;
    let score = -1;
    for (const r of this.ctx.world.regions.values()) {
      let s = 0;
      for (const n of this.npcs.values()) {
        if (n.region !== r || n.intent.kind === 'leave') continue;
        s += n.intent.kind === 'wait' ? 10 : n.working ? 3 : 1;
      }
      if (s > score) { score = s; best = r; }
    }
    return best || this.ctx.world.hub;
  }

  // ------------------------------------------------------------------------------------------
  // sessions

  ensure(session, { fancy = true } = {}) {
    let npc = this.npcs.get(session.sid);
    if (npc) {
      npc.session = session;
      return npc;
    }
    // Only the hand-drawn characters walk the Lands, each hero once: a free hero takes up the
    // session and sets out from the Round Table once its island rises. With every hero out on a
    // quest, a spectre is called up for it instead (each in its own colour); without the spectre's
    // art, the session waits, unseen and without an island, until a hero comes free (seatWaiting).
    const hero = this.freeHero();
    if (!hero) {
      const spectre = this.summonSpectre(session, fancy);
      if (spectre) return spectre;
      this.waiting.set(session.sid, session);
      return null;
    }
    this.waiting.delete(session.sid);
    const region = this.regionOf(session.project, fancy);
    this.npcs.delete(hero.sid);
    hero.bind(session, region);
    this.npcs.set(session.sid, hero);
    if (hero.intent.kind === 'gather') Object.assign(hero.intent, { leaveAt: this.clock + LEAVE_AFTER, stagger: 0.3 + Math.random() * 1.6 });
    if (fancy) this.log(`${hero.displayName} takes up a quest in ${region.project}`, 'gold', hero);
    return hero;
  }

  // A spectre for a session no hero is free for: the first colour none of the others wears. It
  // shows itself at its island's Site of Grace once the island has risen (npc.js).
  summonSpectre(session, fancy) {
    const base = this.ctx.spectreSheet;
    if (!base) return null;
    const used = new Set([...this.npcs.values()].filter((n) => n.spectre && !n.dead).map((n) => n.spectre.color));
    let k = 0;
    while (used.has(k)) k += 1;
    const color = SPECTRE_COLORS[k % SPECTRE_COLORS.length];
    const region = this.regionOf(session.project, fancy);
    const [gx, gz] = region.point('grace');
    const npc = new Npc(this.ctx, session, { x: gx, z: gz + 1.6, demo: !!session.demo, region });
    npc.makeSpectre(spectreSheet(base, k), k, color);
    this.npcs.set(session.sid, npc);
    if (fancy) this.log(`Every hero is out: the ${npc.name.first} is called up for ${region.project}`, 'gold', npc);
    return npc;
  }

  // A hero has come free (its session ended, or the player let go of it): the session that has
  // waited longest takes it up.
  seatWaiting() {
    if (!this.waiting.size || !this.freeHero()) return;
    const next = [...this.waiting.values()].sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))[0];
    const hero = this.ensure(next, { fancy: true });
    if (hero && next.state !== 'idle') hero.session = next; // its work waits until it's home (applyState)
  }

  snapshot(sessions) {
    const live = new Set(sessions.map((s) => s.sid));
    for (const [sid, npc] of [...this.npcs]) if (!npc.demo && !npc.unbound && !live.has(sid)) this.dismiss(npc);
    for (const sid of [...this.waiting.keys()]) if (!live.has(sid)) this.waiting.delete(sid);
    // the eldest sessions take up the first heroes (the rest wait for one to come free)
    for (const s of [...sessions].sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))) {
      const known = this.npcs.has(s.sid);
      const npc = this.ensure(s, { fancy: false });
      if (!npc) continue;
      if (known) this.applyState(npc, s);
      else npc.session = s; // gathered at the Round Table; they pick this up once home
    }
  }

  applyState(npc, session) {
    npc.session = session;
    if (session.state === 'gone') { this.dismiss(npc); return; }
    if (npc.intent.kind === 'leave') return;
    if (npc.intent.kind === 'gather' || npc.intent.kind === 'journey') {
      // still at the Round Table or on the road: the work waits until they're home
      npc.setSpirits(session.spirits || 0);
      if (session.model) npc.setModel(session.model);
      return;
    }
    if (session.project && session.project !== 'Unknown' && session.project !== npc.region.project) {
      // The session now reports a different project root: it moves house.
      npc.releaseSlot();
      npc.region = this.regionOf(session.project, true);
      npc.setIntent({ kind: 'wander' });
    }
    if (session.state === 'waiting') {
      npc.setIntent({ kind: 'wait' });
    } else if (session.state === 'working') {
      const st = stationForTool(session.tool);
      if (!session.tool) npc.setIntent({ kind: 'channel', anim: 'read' });
      else if (st === 'summon') npc.setIntent({ kind: 'channel', anim: 'pray' });
      else if (st === 'cast') npc.setIntent({ kind: 'channel', anim: 'cast' });
      else npc.setIntent({ kind: 'work', station: st });
    } else if (!['wander', 'rest', 'visit'].includes(npc.intent.kind)) {
      npc.setIntent({ kind: 'rest' });
    }
    if (!npc.fighter) npc.setSpirits(session.spirits || 0); // (a fighter's spirit ashes wait out the fight)
    if (session.model) npc.setModel(session.model);
  }

  event(ev, session) {
    const ui = this.ctx.ui;
    // While a great enemy is abroad the message log carries the fight alone; and a Tarnished in the
    // fight (fight.js) works its session on unseen: no signs, gestures or words of its work, only its
    // battle lines (remark). What its session does is still kept, for when the fight is over.
    const quiet = !!this.ctx.fight?.hunting();
    const log = (...a) => { if (!quiet) this.log(...a); };
    if (ev.event === 'SessionEnd' || ev.event === 'Gone' || session.state === 'gone') {
      if (this.waiting.delete(ev.sid)) return; // it never had a hero
      const npc = this.npcs.get(ev.sid);
      if (npc && npc.intent.kind !== 'leave' && !npc.unbound) {
        const from = npc.region.project;
        this.dismiss(npc);
        log(npc.spectre ? `The ${npc.name.first} fades from ${from}, its work done` : npc.heroActor ? `${npc.name.first} leaves ${from} and returns to the Round Table` : `${npc.name.first} passes through the fog of ${from}`, 'dim', npc);
      }
      return;
    }
    const isNew = !this.npcs.has(ev.sid);
    const npc = this.ensure(session, { fancy: true });
    if (!npc) return; // every hero is out: this session waits, unseen, for one to come free
    const name = npc.name.first;
    const now = performance.now() / 1000;
    const fighting = !!npc.fighter; // (in the fight: none of what follows shows)
    const shown = !fighting;

    switch (ev.event) {
      case 'SessionStart':
        if (!isNew && ev.source === 'clear') {
          if (shown) {
            npc.spawn(true);
            this.spellBanner(npc, 'clear', { title: 'Reborn at Grace', icon: 'sparkle' });
          }
        } else if (!isNew && ev.source === 'resume') {
          log(`${name} returns to ${npc.region.project}`, 'gold', npc);
        }
        break;
      case 'UserPromptSubmit':
        this.questStart.set(ev.sid, now);
        if (ev.command) this.command(npc, ev.command);
        else if (shown) {
          npc.showIcon('quest', 2.5);
          log(`${name} receives a quest from the Voice`, '', npc);
          if (Math.random() < 0.35) this.remark(npc, 'called', null, 0.8);
        }
        break;
      case 'UserPromptExpansion':
        if (ev.command) this.command(npc, ev.command);
        break;
      case 'PreToolUse': {
        if (ev.agent) { if (shown) npc.pulseSpirit(); break; }
        const st = stationForTool(ev.tool);
        if (ev.tool === 'Skill') {
          if (shown) npc.castBurst();
          if (shown) log(`${name} invokes ${ev.skill ? `the skill ${ev.skill}` : 'a skill'}`, '', npc);
        } else if (st === 'summon') {
          if (shown) npc.castBurst(['#7fc8ff', '#b4e2ff']);
          if (shown) log(`${name} summons spirit ashes${ev.agentType ? ` · ${ev.agentType}` : ''}`, 'blue', npc);
        } else if (npc.lastStation !== st && shown) {
          const verb = STATIONS[st]?.verb || 'weaves an incantation';
          log(`${name} ${verb} · ${shortTool(ev.tool)}`, '', npc);
        }
        npc.lastStation = st;
        break;
      }
      case 'PostToolUseFailure':
        if (ev.agent) break;
        if (ev.reason === 'interrupt') { if (shown) npc.showIcon('dots', 2); }
        else {
          if (shown) {
            npc.stagger();
            log(`${name} falters · ${shortTool(ev.tool)}`, 'red', npc);
          }
          this.ctx.fight?.noteFailure(npc); // failure upon failure draws a great enemy
        }
        break;
      case 'PermissionRequest':
      case 'Notification':
        if (ev.event === 'Notification' && ev.kind !== 'permission') break;
        if (npc.intent.kind !== 'wait' && shown) {
          npc.region.ringBell();
          if (Math.random() < 0.5) this.remark(npc, 'waiting', null, 2.5);
          log(`${name} kneels at the gate of ${npc.region.project}, awaiting thy command${ev.tool ? ` · ${shortTool(ev.tool)}` : ''}`, 'amber', npc);
        }
        break;
      case 'PermissionDenied':
        if (shown) {
          npc.showIcon('anger', 2.5);
          log(`${name} is turned away from the gate · ${shortTool(ev.tool)}`, 'red', npc);
        }
        break;
      case 'Stop': {
        const started = this.questStart.get(ev.sid);
        this.questStart.delete(ev.sid);
        this.ctx.fight?.noteDone(npc); // the great enemy this session drew reels (said in the fight's own words)
        if (!shown) break;
        npc.showIcon('sparkle', 2.5);
        if (started && now - started > 180) ui.notice('Quest Fulfilled', `${npc.displayName} · ${formatDuration(now - started)}`);
        log(`${name} returns to grace, quest fulfilled`, 'gold', npc);
        if (Math.random() < 0.45) {
          this.remark(npc, 'done', null, 0.6);
          if (Math.random() < 0.6) this.answer(npc, 'praise', 2.6);
        }
        break;
      }
      case 'StopFailure': {
        if (shown) {
          npc.collapse(5);
          const title = ev.reason === 'rate_limit' ? 'Thy Stamina Is Spent' : ev.reason === 'overloaded' ? 'The Grace Wavers' : 'Fallen';
          ui.notice(title, `${npc.displayName}${ev.reason ? ` · ${ev.reason.replace(/_/g, ' ')}` : ''}`, 'red');
          log(`${name} has fallen${ev.reason ? ` · ${ev.reason.replace(/_/g, ' ')}` : ''}`, 'red', npc);
          this.answer(npc, 'sympathy', 1.4, 7);
        }
        this.ctx.fight?.noteFall(npc);
        break;
      }
      case 'SubagentStart':
        if (shown) log(`A spirit answers ${name}'s call${ev.agentType ? ` · ${ev.agentType}` : ''}`, 'blue', npc);
        break;
      case 'SubagentStop':
        if (shown) log(`${name}'s spirit returns to the ashes`, 'blue', npc);
        break;
      case 'PreCompact':
        if (!shown) break;
        npc.absorb();
        if (ev.trigger === 'manual') this.spellBanner(npc, 'compact', { title: 'Memories Consolidated', icon: 'rune' });
        else log(`${name}'s memories grow heavy… consolidating`, 'gold', npc);
        break;
      case 'PostCompact':
        if (shown) npc.showIcon('sparkle', 2);
        break;
      case 'PostModelSwitch':
        log(`${name} takes up the mantle of ${titleCase(ev.model || 'another')}`, 'gold', npc);
        break;
      default:
        break;
    }
    this.applyState(npc, session);
  }

  command(npc, cmd) {
    if (npc.fighter) return; // (no incantations of its work mid-fight)
    const now = performance.now() / 1000;
    const last = this.lastCommand.get(npc.sid);
    if (last && last.cmd === cmd && now - last.t < 4) return;
    this.lastCommand.set(npc.sid, { cmd, t: now });
    if (cmd === 'compact' || cmd === 'clear') return; // their own hook events animate these
    this.spellBanner(npc, cmd, COMMAND_FX[cmd] || { title: 'Incantation', icon: 'rune' });
  }

  spellBanner(npc, cmd, fx) {
    this.ctx.ui.notice(fx.title, `/${cmd} · ${npc.displayName} · ${npc.region.project}`);
    this.log(`${npc.name.first} invokes /${cmd}`, 'gold', npc);
    npc.gesture('cast', fx.icon);
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      this.ctx.particles.emit({
        pos: [npc.pos.x + Math.cos(a) * 0.9, 0.08, npc.pos.y + Math.sin(a) * 0.55], vel: [0, 1.6, 0], velSpread: [0.1, 0.4, 0.1],
        color: ['#ffd27a', '#fff1b8'], size: 0.07, life: 1.3, drag: 0.5, intensity: 2.4,
      });
    }
  }

  // ------------------------------------------------------------------------------------------
  // player interaction

  select(npc) {
    if (this.selected && this.selected !== npc) this.selected.selected = false;
    this.selected = npc;
    if (npc) npc.selected = true;
    this.ctx.ui.select(npc);
  }

  gesture(npc, key) {
    const g = GESTURES.find((x) => x.key === key);
    if (!g || !npc || npc.dead) return;
    if (key === 'rest') {
      npc.action = { kind: 'gesture', anim: 'sit', t: 0, dur: 6 };
      npc.body.play('sit', true);
      npc.showIcon('zzz', 6);
    } else if (key === 'pray') {
      npc.action = { kind: 'gesture', anim: 'pray', t: 0, dur: 3 };
      npc.body.play('pray', true);
      npc.showIcon('rune', 3);
    } else {
      npc.gesture(g.anim, g.icon);
    }
    for (const other of this.npcs.values()) {
      if (other === npc || other.dead || other.dragged || other.action || other.talk || other.travel || other.spectre) continue;
      if (!['wander', 'rest', 'visit', 'gather'].includes(other.intent.kind)) continue;
      if (Math.hypot(other.pos.x - npc.pos.x, other.pos.y - npc.pos.y) > 5) continue;
      if (Math.random() > 0.65) continue;
      const resp = RESPONSES[key];
      setTimeout(() => {
        if (other.dead || other.action) return;
        other.body.facing = npc.pos.x > other.pos.x ? 1 : -1;
        if (resp === 'bow') other.gesture('bow');
        else if (resp === 'wave') other.gesture('wave', 'note');
        else if (resp === 'cheer') other.gesture('cheer', 'sparkle');
        else if (resp === 'heart') other.showIcon(Math.random() < 0.5 ? 'heart' : 'sweat', 2.5);
        else if (resp === 'question') other.showIcon('question', 2);
        else other.showIcon('dots', 2);
        if (REPLIES[key] && Math.random() < 0.7) this.utter(other, speak(other, REPLIES[key], npc));
      }, 400 + Math.random() * 600);
    }
  }

  // ------------------------------------------------------------------------------------------
  // idle life: chatter and trips to Roundtable Hold

  seated(n) {
    return (n.intent.kind === 'visit' || n.intent.kind === 'gather') && !n.path.length && !n.travel && n.slot?.hub;
  }

  canTalk(n, now) {
    if (n.spectre) return false; // spectres only work
    if (n.dead || n.dragged || n.action || n.talk || n.inTalk || n.travel || n.fade < 1) return false;
    if (now < n.chatReadyAt) return false;
    if (n.intent.kind === 'wander') return true;
    return this.seated(n);
  }

  updateChatter(dt) {
    const now = performance.now() / 1000;
    this.talks = this.talks.filter((c) => this.stepTalk(c, now));
    this.chatTimer -= dt;
    if (this.chatTimer > 0) return;
    this.chatTimer = 1.5;
    const world = this.ctx.world;
    const idle = [...this.npcs.values()].filter((n) => this.canTalk(n, now));
    for (let i = 0; i < idle.length; i++) {
      for (let j = i + 1; j < idle.length; j++) {
        const a = idle[i];
        const b = idle[j];
        if (world.areaAt(a.pos.x, a.pos.y) !== world.areaAt(b.pos.x, b.pos.y)) continue;
        const atTable = this.seated(a) && this.seated(b);
        // two quiet souls seldom strike up a conversation
        const talky = 0.35 + 0.65 * Math.max(voiceOf(a).chatty, voiceOf(b).chatty);
        if (Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) < 6 && Math.random() < (atTable ? 0.8 : 0.6) * talky) {
          this.startTalk(a, b, atTable);
          return;
        }
      }
    }
    if (idle.length && Math.random() < 0.04) {
      const n = idle[Math.floor(Math.random() * idle.length)];
      this.utter(n, speak(n, 'solo'));
    }
    this.greetPlayer(idle, now);
  }

  // Maren walks up to someone idle: now and then they hail her, in their own way.
  greetPlayer(idle, now) {
    const p = this.ctx.player;
    if (!p || p.travel || now < this.nextGreet) return;
    for (const n of idle) {
      if (now < (n.greetedAt ?? -Infinity) + 120) continue;
      if (Math.hypot(n.pos.x - p.pos.x, n.pos.y - p.pos.y) > 2.6) continue;
      n.greetedAt = now;
      if (Math.random() < 0.5) continue;
      this.nextGreet = now + 12;
      if (n.intent.kind === 'wander') n.body.facing = p.pos.x > n.pos.x ? 1 : -1;
      this.utter(n, speak(n, 'hail', p));
      return;
    }
  }

  startTalk(a, b, seated) {
    for (const n of [a, b]) { n.inTalk = true; if (!seated) n.wanderPause = 999; }
    if (!seated) {
      const mx = (a.pos.x + b.pos.x) / 2;
      const mz = (a.pos.y + b.pos.y) / 2;
      const [ax, az] = this.ctx.nav.clampToWalkable(mx - 0.8, mz);
      const [bx, bz] = this.ctx.nav.clampToWalkable(mx + 0.8, mz);
      a.goTo(ax, az, false);
      b.goTo(bx, bz, false);
    }
    this.talks.push({ a, b, kinds: [a.intent.kind, b.intent.kind], lines: conversation(a, b), i: -1, next: 0, started: performance.now() / 1000 });
  }

  endTalk(c, now) {
    for (const n of [c.a, c.b]) {
      n.talk = null;
      n.inTalk = false;
      if (n.intent.kind === 'wander') n.wanderPause = 1 + Math.random() * 3;
      n.chatReadyAt = now + TIMING.chatCooldown[0] + Math.random() * (TIMING.chatCooldown[1] - TIMING.chatCooldown[0]);
    }
  }

  stepTalk(c, now) {
    const { a, b } = c;
    const broken = [a, b].some((n, k) => n.dead || n.dragged || n.travel || n.intent.kind !== c.kinds[k] || n.action);
    if (broken || now - c.started > 40) { this.endTalk(c, now); return false; }
    if (c.i < 0) {
      if (a.path.length || b.path.length) return true;
      a.talk = { partner: b, speaking: false };
      b.talk = { partner: a, speaking: false };
      c.i = 0;
      c.next = now + 0.4;
      return true;
    }
    if (now < c.next) return true;
    if (c.i >= c.lines.length) {
      if (Math.random() < 0.5 && a.intent.kind === 'wander' && b.intent.kind === 'wander') { a.gesture('bow'); b.gesture('bow'); }
      this.endTalk(c, now);
      return false;
    }
    const [who, text] = c.lines[c.i];
    const speaker = who === 0 ? a : b;
    const listener = who === 0 ? b : a;
    if (speaker.talk) speaker.talk.speaking = true;
    if (listener.talk) listener.talk.speaking = false;
    const dur = readTime(text);
    this.ctx.ui.say(speaker, text, dur);
    c.i += 1;
    c.next = now + dur + 0.35;
    return true;
  }

  // ------------------------------------------------------------------------------------------
  // remarks: lines said outside a conversation (setting out, coming home, a blow from Maren)

  // `npc` says `intent` in its own voice, to `to` (or to no one), `delay` seconds from now;
  // unless by then it's being carried, travelling, gone, or deep in a conversation.
  remark(npc, intent, to = null, delay = 0) {
    if (npc?.fighter && !FIGHT_LINES.has(intent)) return; // in the fight: battle lines only
    if (npc && !npc.spectre) this.remarks.push({ npc, intent, to, at: this.clock + delay });
  }

  // Someone near where `to` stands now answers it, `delay` seconds from now: whoever is free
  // and close by then ("Good luck, Fortuna!" as she sets off).
  answer(to, intent, delay = 0, radius = 6) {
    this.remarks.push({ npc: null, intent, to, at: this.clock + delay, near: to.pos.clone(), radius });
  }

  updateRemarks() {
    if (!this.remarks.length) return;
    this.remarks = this.remarks.filter((r) => {
      if (this.clock < r.at) return true;
      const n = r.npc || this.bystander(r.to, r.radius, r.near);
      if (n && !n.dead && !n.dragged && !n.travel && !n.talk && n.fade >= 1) this.utter(n, speak(n, r.intent, r.to));
      return false;
    });
  }

  utter(npc, text) {
    if (npc.spectre) return; // spectres never speak
    this.ctx.ui.say(npc, text, readTime(text));
  }

  // The Tarnished nearest `at` (where `npc` stands, by default) free to answer `npc`: same area,
  // within `radius`, not talking already, carried, travelling, on the road or gesturing.
  bystander(npc, radius = 6, at = npc.pos) {
    const world = this.ctx.world;
    const area = world.areaAt(at.x, at.y);
    let best = null;
    let bd = radius;
    for (const n of this.npcs.values()) {
      if (n === npc || n.dead || n.dragged || n.travel || n.talk || n.inTalk || n.action || n.fade < 1 || n.piloted || n.spectre || n.fighter) continue;
      if (n.intent.kind === 'journey' || n.intent.kind === 'leave') continue;
      if (world.areaAt(n.pos.x, n.pos.y) !== area) continue;
      const d = Math.hypot(n.pos.x - at.x, n.pos.y - at.y);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  // Some idle Tarnished wander off to sit at the round table for a while.
  updateVisits(dt) {
    this.visitTimer -= dt;
    if (this.visitTimer > 0) return;
    this.visitTimer = 2;
    const now = performance.now() / 1000;
    const hub = this.ctx.world.hub;
    if (!hub.seats.some((s) => !s)) return;
    for (const n of this.npcs.values()) {
      if (n.intent.kind !== 'wander' || n.spectre || n.talk || n.inTalk || n.travel || n.dragged || n.action || n.fade < 1) continue;
      if (now - n.idleSince < TIMING.visitAfter || now - (n.lastVisit || 0) < 180) continue;
      if (Math.random() < 0.08) {
        n.lastVisit = now;
        n.setIntent({ kind: 'visit' });
        this.log(`${n.name.first} sets out for Roundtable Hold`, 'dim', n);
        return;
      }
    }
  }

  // ------------------------------------------------------------------------------------------

  update(dt, t) {
    this.clock += dt;
    this.updateRises();
    this.retireIslands();
    this.updateGathering();
    this.seatWaiting();
    this.updateRemarks();
    this.updateForms(dt);
    const world = this.ctx.world;
    const counts = new Map();
    for (const r of world.regions.values()) counts.set(r, { forge: 0, scriptorium: 0, ritual: 0, tower: 0, table: 0, gate: 0, grace: 0, total: 0, working: 0, waiting: 0 });
    let working = 0;
    let waiting = 0;
    let visitors = 0;
    for (const [sid, npc] of this.npcs) {
      npc.update(dt, t);
      if (npc.dead) {
        if (this.selected === npc) this.select(null);
        npc.dispose();
        this.npcs.delete(sid);
        continue;
      }
      const c = counts.get(npc.region);
      const k = npc.intent.kind;
      if (c && k !== 'leave') c.total += 1;
      if (c && k === 'work' && !npc.path.length && !npc.travel) c[npc.intent.station] += 1;
      if (c && (k === 'wait' || k === 'leave')) c.gate += 1;
      if (c && k === 'rest') c.grace += 1;
      // thou, working a station
      const used = npc.using && counts.get(npc.using.region);
      if (used) used[npc.using.station] += 1;
      if (k === 'work' || k === 'channel') { working += 1; if (c) c.working += 1; }
      if (k === 'wait') { waiting += 1; if (c) c.waiting += 1; }
      if (this.seated(npc)) visitors += 1;
    }
    for (const [r, c] of counts) r.setActivity(c);
    this.hubVisitors = visitors;
    this.updateChatter(dt);
    this.updateVisits(dt);
    this.statsTimer -= dt;
    if (this.statsTimer <= 0) {
      this.statsTimer = 0.5;
      world.hub.setBanners(world.regionList().map((r) => r.project));
      this.ctx.ui.setStats([...this.npcs.values()].filter((n) => !n.unbound).length, working, waiting);
      this.ctx.ui.setRegions([
        { area: world.hub, name: world.hub.name, color: '#d6b46e', total: visitors, working: 0, waiting: 0 },
        // (only those that have risen: one still under the mist, or sinking into it, isn't on the map)
        ...world.regionList().filter((r) => r.risen && !r.sinking).map((r) => ({ area: r, name: r.project, color: r.color, ...counts.get(r) })),
      ]);
    }
  }
}

function shortTool(tool) {
  if (!tool) return 'unknown rite';
  if (tool.startsWith('mcp__')) {
    const parts = tool.split('__');
    return `${parts[parts.length - 1]} (MCP)`;
  }
  return tool;
}

function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDuration(sec) {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

export { STATION_LABEL };
