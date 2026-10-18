// How each Tarnished fights a great enemy (fight.js). The mages keep their distance and cast, a few
// spells each in their own light (spellfx.js): the Rune Lord's golden runes, the Glintstone
// Witch's glintstone, Vael's blood, the Eternal Queen's holy light. The rest close in with sword,
// spear or hammer. Fortuna does both: her frost blade up close, frost from afar. Every blow that
// lands fills the striker's ultimate (ults.js).
//
// Also here: what the ultimates can do to him besides wounding him (status): hold him still (as
// the iaijutsu's cuts are made), stun him (dazed, he neither fights nor moves), slow him and root
// him where he stands (a pool of blood), bleed or poison him (his health running down by itself),
// and knock him back.

import { Missile, Beam, Rise, Burst, TEX, motesOf } from './spellfx.js';
import { lookOf } from './fxart.js';

// By hero id (a hero of two looks fights as whichever it wears). `muzzle`: where a mage's spells
// leave from, [ahead, up] of its feet in world units (the orb, the crystal, the fist, the ring),
// unless its rig says where its drawn poses hold it (muzzleOf).
export const STYLES = {
  runelord: { range: 'far', school: 'rune', color: '#ffc94a', muzzle: [2.0, 0.75] }, // (the orb, thrust out: heroes/runelord.js)
  sorceress: { range: 'far', school: 'glintstone', color: '#6fc3ff', muzzle: [0.72, 2.68] }, // (bare-faced; masked: heroes/sorceress.js)
  bloodbender: { range: 'far', school: 'blood', color: '#ff3a4a', muzzle: [0.5, 1.04] },
  queen: { range: 'far', school: 'holy', color: '#ffd75a', muzzle: [0.54, 1.01] },
  fortuna: { range: 'both', school: 'frost', color: '#8fe0ff', muzzle: [0.92, 1.78] },
  champion: { range: 'near', color: '#ffb84a' },
  knight: { range: 'near', color: '#ff4038' },
  paladin: { range: 'near', color: '#ffe9a0' },
  ronin: { range: 'near', color: '#d8ecff' },
  bandit: { range: 'near', color: '#9fdc5a' },
};
const NEAR = { range: 'near', color: '#ffd27a' };
export const heroKey = (n) => n?.hero?.hero?.split('-')[0] ?? null;
export const styleOf = (n) => STYLES[heroKey(n)] || NEAR;
export const casts = (n) => styleOf(n).range !== 'near';

// How hard a spell hits (`share` 1: an ordinary one): a fighter's, and thine. Less than a blade's
// blow, for being safe from afar (and Fenrath goes after whoever keeps it up: fight.js, HUNT).
export const SPELL = { npc: 7, player: 22 };
// Ultimates, measured against the enemy's own health (so that one comes about as often, and hits
// about as hard, whoever he is): the share of it whose worth in blows fills one (a fighter's;
// thine: a few in a fight, not one every few blows), how hard one hits per share of it (thine
// half as hard again), and the least time between two loosed by the fighters (thine never waits).
export const ULT = { fill: { npc: 0.04, player: 0.2 }, power: { npc: 0.0025, player: 0.00375 }, gap: 12 };
// (an enemy may have them fill sooner: the Golem, whose stone takes little from blows, golem.js)
export const ultFill = (b, player = false) => (b?.max || 8000) * (b?.kind?.ultFill ?? 1) * ULT.fill[player ? 'player' : 'npc'];
export const ultPower = (b, player = false) => (b?.max || 8000) * ULT.power[player ? 'player' : 'npc'];
// Where the mages stand off from him, and how long they take between spells.
export const RANGED = { ring: [6.5, 9.5], reach: 13, cd: [2.2, 3.8] };

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => {
  const total = list.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const x of list) { r -= x.weight; if (r <= 0) return x; }
  return list[list.length - 1];
};

// One blow of n's (`kind`: the action it is, as pilot.js and fight.js tell them apart), played
// whole: its own drawn attack (a spell: its drawn cast, if it has one besides), else its rig's
// strike; the blow lands, or the spell is loosed, at the step its sheet says (`hitAt`). `more`
// goes into the action as it is.
export function blow(n, kind, { spell = false, ...more } = {}) {
  const sheet = n.body.sheet;
  const anim = spell && sheet.anims.spell ? 'spell' : sheet.anims.attack ? 'attack' : 'hammer';
  const def = sheet.anims[anim];
  n.action = { kind, anim, t: 0, dur: def.frames.length / def.fps, hitAt: (sheet.hits?.[anim] ?? 2) / def.fps, hit: false, ...more };
  n.body.play(anim, true);
}

// Where a spell of n's leaves from, in the world: where its rig's drawn pose holds it, if it says
// (`which`: the thrust that looses a spell, or the ultimate's pose), else where its style says.
export function muzzleOf(n, which = 'attack') {
  const [ahead, up] = n.body?.sheet?.rig?.muzzles?.[which] || styleOf(n).muzzle || [0.6, 1.4];
  return [n.pos.x + n.body.facing * ahead, up + (n.lift || 0), n.pos.y + 0.05];
}

// ---------------------------------------------------------------------------------------------
// the spells (c: the cast, castSpell)

const SPELLS = {
  // the Rune Lord: a rune flung spinning, a volley of three that fan out and come round onto him,
  // or a circle of runes under him and a pillar of gold out of it
  // (all drawn: his runes at his own pixel size, the volley's smaller; the pillar out of a drawn
  // circle of runes)
  rune: [
    {
      weight: 3,
      cast: (c) => {
        const k = Math.floor(Math.random() * 4);
        c.missile({ ...lookOf('jorvik-runes', c.px, { map: TEX.glyph(k), w: 0.46, h: 0.58 }, { pick: k }), speed: 11, spin: 6 });
      },
    },
    {
      weight: 2,
      cast: (c) => [-1, 0, 1].forEach((s, i) => c.missile({
        ...lookOf('jorvik-runes', c.px * 0.7, { map: TEX.glyph(i), w: 0.34, h: 0.42 }, { pick: i }),
        speed: 9.5, spin: 7, rise: 2 + i, side: s * 3.2, delay: i * 0.08, share: 0.45,
      })),
    },
    {
      weight: 1.5,
      cast: (c) => c.rise({
        art: 'jorvik-pillar', px: c.px, markArt: 'jorvik-circle', map: TEX.pillar('rune'), w: 1.3, h: 5.5, mark: TEX.circle('rune', 6), markSize: 2.8, share: 1.4,
      }),
    },
  ],
  // the Glintstone Witch: a glintstone pebble, a spray of shards, or now and then a great shard
  // (all drawn, at her own pixel size: the pebble flickering, a shard of each design; the great
  // shard keeps upright, its light on top)
  glintstone: [
    { weight: 3, cast: (c) => c.missile({ ...lookOf('corisande-pebble', c.px, { map: TEX.orb('glintstone', 5), w: 0.42, h: 0.42 }, { fps: 12 }), speed: 14 }) },
    {
      weight: 2,
      cast: (c) => [-1, 0, 1].forEach((s, i) => c.missile({
        ...lookOf('corisande-shards', c.px, { map: TEX.shard('glintstone', 14, 2), w: 0.62, h: 0.3 }, { pick: i }),
        speed: 12, side: s * 2.2, rise: 1, delay: i * 0.05, share: 0.45,
      })),
    },
    {
      weight: 1,
      cast: (c) => c.missile({
        ...lookOf('corisande-great-shard', c.px, { map: TEX.shard('glintstone', 26, 5), w: 1.15, h: 0.58 }), upright: true, speed: 9, share: 1.8, size: 1.6,
      }),
    },
  ],
  // Vael: a gout of blood, spikes of blood out of the floor under him, or a lash of blood reaching
  // him at once
  blood: [
    { weight: 3, cast: (c) => c.missile({ ...lookOf('vael-orb', c.px * 0.8, { map: TEX.orb('blood', 6), w: 0.5, h: 0.5 }, { fps: 10 }), speed: 11, wobble: 0.06 }) },
    {
      weight: 2,
      cast: (c) => c.rise({ art: 'vael-spikes', px: c.px, map: TEX.spikes('blood', Math.floor(Math.random() * 3)), w: 2.2, h: 1.85, share: 1.2 }),
    },
    { weight: 1.5, cast: (c) => c.beam({ width: 0.3, share: 0.9, art: 'vael-lash' }) },
  ],
  // the Eternal Queen: a lance of holy light, a halo thrown spinning, or light falling on him (all
  // drawn: the lance repeated along its length; the halo turning, keeping level as it flies; the
  // light falling, striking and fading)
  holy: [
    { weight: 3, cast: (c) => c.beam({ width: 0.5, share: 1, art: 'solenne-lance', tile: true }) },
    {
      weight: 2,
      cast: (c) => c.missile({ ...lookOf('solenne-halo', c.px * 0.62, { map: TEX.halo(), w: 0.9, h: 0.42, spin: 0.01 }, { fps: 12 }), upright: true, speed: 10 }),
    },
    {
      weight: 1.5,
      cast: (c) => c.rise({ art: 'solenne-light', px: c.px * 1.4, map: TEX.pillar('holy'), w: 1.5, h: 6, mark: TEX.circle('holy', 0), markSize: 2.6, share: 1.4 }),
    },
  ],
  // Fortuna, from afar: a frost shard, or ice out of the floor (both drawn at her own pixel size)
  frost: [
    { weight: 3, cast: (c) => c.missile({ ...lookOf('fortuna-shard', c.px, { map: TEX.shard('frost', 20, 3), w: 0.85, h: 0.38 }), speed: 13 }) },
    {
      weight: 2,
      cast: (c) => c.rise({ art: 'fortuna-spikes', px: c.px, map: TEX.spikes('frost', Math.floor(Math.random() * 3)), w: 2.2, h: 1.9, share: 1.2 }),
    },
  ],
};

// n casts one of its spells. `target()`: the point it's cast at (followed, homing), or null to
// cast it straight on `dir` ([dx, dz]) into nothing; `hit(at, share)`: it lands, `share` of an
// ordinary spell's strength.
export function castSpell(fx, n, { target, dir, hit }) {
  const school = styleOf(n).school;
  const list = SPELLS[school];
  if (!list) return;
  const from = muzzleOf(n);
  const trail = motesOf(school);
  const land = (at, share, size = 1) => {
    fx.add(new Burst(fx, { school, at: [at.x, at.y, at.z], size: 1.3 * size, ring: false, sparks: Math.round(14 * size) }));
    hit(at, share);
  };
  const c = {
    px: n.body.sheet.px, // (the caster's pixel size, for spells drawn to match it)
    missile: ({ side = 0, share = 1, size = 1, ...o }) => {
      // (fanned out to one side at first: it comes round onto him)
      const away = side ? [from[0] - n.body.facing * 0.2, from[1], from[2] + side * 0.08] : from;
      const m = new Missile(fx, {
        ...o, from: away, trail,
        to: target, dir: target ? null : dir, turn: side ? 3.5 : 7, life: target ? 3 : 1.4,
        onHit: (at) => land(at, share, size),
      });
      if (side) m.vel.z += side;
      fx.add(m);
    },
    rise: ({ share = 1, ...o }) => {
      // (cast straight on into nothing, it rises where it would have struck, a few steps ahead)
      const [x, , z] = target ? target() : [from[0] + dir[0] * 6, 0, from[2] + dir[1] * 6];
      fx.add(new Rise(fx, { school, x, z, ...o, onHit: target ? (at) => land(at, share) : null }));
    },
    beam: ({ share = 1, width, art = null, tile = false }) => {
      const to = target ? target() : [from[0] + dir[0] * 9, from[1], from[2] + dir[1] * 9];
      fx.add(new Beam(fx, { school, from, to, width, art, tile, onHit: target ? (at) => land(at, share) : null }));
    },
  };
  pick(list).cast(c);
}

// ---------------------------------------------------------------------------------------------
// what the ultimates do to him besides wounding him

export function statusOf(b) {
  return (b.status ??= { holdUntil: 0, stunUntil: 0, slowUntil: 0, slow: 1, rootUntil: 0, root: null, dots: [], knock: null });
}

// He can't act: held (the iaijutsu) or stunned (dazed).
export const heldAt = (b, now) => !!b.status && (now < b.status.holdUntil || now < b.status.stunUntil);
// How fast he goes (slowed in the pool of blood).
export const paceAt = (b, now) => (b.status && now < b.status.slowUntil ? b.status.slow : 1);
// Rooted: he may not leap or roll off elsewhere (and keeps to the pool).
export const rootedAt = (b, now) => !!b.status && now < b.status.rootUntil;

// Damage over time (`kind`: 'bleed' or 'poison'), `dps` from now till `until`, `src` its owner.
export function addDot(b, { kind, dps, until, src }) {
  statusOf(b).dots.push({ kind, dps, until, src, acc: 0 });
}

// One frame of his statuses (fight.stepBoss): his bleeding and poison, his knocking back, and
// the pool keeping him in. `hit(amount, src)` wounds him; `shift(dx, dz)` moves him.
export function stepStatus(b, now, dt, { hit, shift, particles }) {
  const s = b.status;
  if (!s) return;
  s.dots = s.dots.filter((d) => {
    if (now >= d.until) return false;
    d.acc += d.dps * dt;
    if (d.acc >= 4) { hit(d.acc, d.src); d.acc = 0; }
    return true;
  });
  for (const kind of ['bleed', 'poison']) {
    if (!s.dots.some((d) => d.kind === kind) || Math.random() > dt * 9) continue;
    particles.emit({
      pos: [b.pos.x + (Math.random() - 0.5) * 2, 1.2 + Math.random() * 2.4, b.pos.y + 0.3], spread: [0.1, 0.1, 0.1],
      vel: kind === 'bleed' ? [0, -0.4, 0] : [0, 0.9, 0], velSpread: [0.2, 0.3, 0.2], gravity: kind === 'bleed' ? 5 : 0,
      color: motesOf(kind === 'bleed' ? 'blood' : 'poison'), size: 0.08, life: 0.7, count: 2, drag: 0.6, intensity: 1.8,
    });
  }
  if (s.knock) {
    const k = s.knock;
    const step = Math.min(k.left, k.speed * dt);
    k.left -= step;
    shift(k.dx * step, k.dz * step);
    if (k.left <= 0.001) s.knock = null;
  }
  // (in the pool, he keeps to it)
  if (s.root && now < s.rootUntil) {
    const { x, z, r } = s.root;
    const dx = b.pos.x - x;
    const dz = b.pos.y - z;
    const d = Math.hypot(dx, dz);
    if (d > r) shift((dx / d) * (r - d), (dz / d) * (r - d));
  }
}

// Stop what he's doing (held or stunned mid-blow): back to standing, his blow undone.
export function interrupt(fight, b) {
  if (b.state !== 'attack') return;
  b.endMove();
  b.state = 'ready';
  b.t = 0;
  b.cd = Math.max(b.cd ?? 0, 1);
  b.pose(b.body.sheet.anims.stagger ? 'stagger' : 'idle', true);
}

// ---------------------------------------------------------------------------------------------
// the ranged fighters' place in the fight (fight.driveFighter)

// Where a mage stands to cast: on its own ring well off him, going slowly round.
export function standOff(b, n, f, dt) {
  f.far ??= rand(...RANGED.ring);
  f.angle += dt * 0.18 * f.dir;
  return [b.pos.x + Math.cos(f.angle) * f.far, b.pos.y + Math.sin(f.angle) * f.far * 0.62];
}
export const castPause = () => rand(...RANGED.cd);
