// How each Tarnished fights a great enemy (fight.js). The mages keep their distance and cast, a few
// spells each in their own light (spellfx.js): the Rune Lord's golden runes, the Glintstone
// Witch's glintstone, Vael's blood, the Eternal Queen's holy light. The rest close in with sword,
// spear or hammer. Fortuna does both: her frost blade up close, frost from afar. Every blow that
// lands fills the striker's ultimate (ults.js).
//
// Ulric has no sorcery, but played by thee he throws his spear as a mage casts (throwSpear); and
// Ruadan his maul, which comes back to his hand (throwMaul).
//
// Thine (whoever thou art) go the way thou pointest: every blow, spell and thrown spear along the
// line on the screen from thee to the pointer (aimOf), finding what stands on it, or a little off it.
//
// Also here: what the ultimates can do to him besides wounding him (status): hold him still (as
// the iaijutsu's cuts are made), stun him (dazed, he neither fights nor moves), slow him and root
// him where he stands (a pool of blood), bleed or poison him (his health running down by itself),
// and knock him back.

import * as THREE from 'three';
import { Missile, Boomerang, Beam, Rise, Burst, Spark, StuckSpear, TEX, motesOf, shine, inSpace } from './spellfx.js';
import { lookOf } from './fxart.js';
import { Decal } from './bossfx.js';
import { groundAt } from './ground.js';

// By hero id (a hero of two looks fights as whichever it wears). `muzzle`: where a mage's spells
// leave from, [ahead, up] of its feet in world units (the orb, the crystal, the fist, the ring),
// unless its rig says where its drawn poses hold it (muzzleOf). `throws`: one who fights up close
// but throws his weapon for a spell, played by thee: his spear (throwSpear), his maul (throwMaul).
// `reach`: how much farther than an ordinary blade's its blow reaches (reachOf).
export const STYLES = {
  runelord: { range: 'far', school: 'rune', color: '#ffc94a', muzzle: [2.0, 0.75] }, // (the orb, thrust out: heroes/runelord.js)
  sorceress: { range: 'far', school: 'glintstone', color: '#6fc3ff', muzzle: [0.72, 2.68] }, // (bare-faced; masked: heroes/sorceress.js)
  bloodbender: { range: 'far', school: 'blood', color: '#ff3a4a', muzzle: [0.5, 1.04] },
  queen: { range: 'far', school: 'holy', color: '#ffd75a', muzzle: [0.54, 1.01] },
  fortuna: { range: 'both', school: 'frost', color: '#8fe0ff', muzzle: [0.92, 1.78] },
  champion: { range: 'near', color: '#ffb84a', throws: 'maul' },
  knight: { range: 'near', school: 'storm', color: '#ff4038', muzzle: [3.0, 1.52], reach: 1.2 }, // (her blows up close; played, a thunderbolt from her spear's tip too, right click: a little inside it, the bolt's line a little below its middle)
  paladin: { range: 'near', color: '#ffe9a0' },
  ronin: { range: 'near', color: '#d8ecff', reach: 1.2 }, // (his long blade: as far as Maren's spear, as Sacha wants)
  bandit: { range: 'near', color: '#9fdc5a', throws: 'spear', reach: 1.7 },
};
const NEAR = { range: 'near', color: '#ffd27a' };
export const heroKey = (n) => n?.hero?.hero?.split('-')[0] ?? null;
export const styleOf = (n) => STYLES[heroKey(n)] || NEAR;
export const casts = (n) => styleOf(n).range !== 'near';
// How much farther than a blade's a blow of n's reaches, world units: a spear's (Maren's, Ulric's)
// finds whatever its drawn tip touches as it lands (3.1 and 3.6 units ahead of them, and the
// lunge's third of a unit with it: npc.js), where a sword's goes into what it finds; and Wynn's
// long blade reaches as far as Maren's spear.
export const reachOf = (n) => styleOf(n).reach || 0;
// Whether n has a spell for thy right click at all (pilot.js): a mage's, Fortuna's frost, Ulric's
// spear, Ruadan's maul.
export const canCast = (n) => !!(SPELLS[styleOf(n).school] || styleOf(n).throws);

// How hard a spell hits (`share` 1: an ordinary one): a fighter's, and thine. Less than a blade's
// blow, for being safe from afar (and Fenrath goes after whoever keeps it up: fight.js, HUNT).
export const SPELL = { npc: 7, player: 22 };
// Ultimates: how many hits fill one, thine and a fighter's alike, whoever the enemy (a blow that
// lands counts one, however much it takes; a spell, as much of one as it is: its share; fight.js,
// charge); how hard one hits, per share of the enemy's own health (so that it hits about as hard
// whoever he is; thine half as hard again); and the least time between two loosed by the fighters
// (thine never waits).
export const ULT = { hits: 10, power: { npc: 0.0025, player: 0.00375 }, gap: 12 };
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
  if (!spell) swing(n, n.action.hitAt);
}

// A blow's sound (audio.js), heard as it lands, `at` seconds from now: a blade's swing, or a spear's
// thrust (THRUSTS), at its loudest then (each of their clips is cut to be at its loudest SWING
// seconds in: scripts/cut-sfx.mjs), anyone's but Wynn's (his blade has its own: heroes/ronin.js) and
// Ruadan's, whose maul comes down with a blow of its own (HAMMER); thine louder than the rest.
const SWING = 0.12;
const HAMMER = 'champion-hit';
const THRUSTS = new Set(['knight', 'bandit']); // (Maren's spear, Ulric's)
function swing(n, at) {
  const key = heroKey(n);
  if (key === 'ronin') return;
  const [name, delay] = key === 'champion' ? [HAMMER, at] : [THRUSTS.has(key) ? 'spear-thrust' : 'blade-swing', Math.max(0, at - SWING)];
  n.ctx?.sound?.play(name, { at: [n.pos.x, n.pos.y], volume: n.piloted ? 1 : 0.6, delay });
}

// Where a spell of n's leaves from, in the world: where its rig's drawn pose holds it, if it says
// (`which`: the thrust that looses a spell, or the ultimate's pose), else where its style says.
export function muzzleOf(n, which = 'attack') {
  const [ahead, up] = muzzleSpot(n, which);
  return [n.pos.x + n.body.facing * ahead, up + (n.lift || 0), n.pos.y + 0.05];
}
// (and that spot as it stands from n's feet: [ahead, up], world units)
export const muzzleSpot = (n, which = 'attack') => n.body?.sheet?.rig?.muzzles?.[which] || styleOf(n).muzzle || [0.6, 1.4];

// ---------------------------------------------------------------------------------------------
// aiming (thine: pilot.js, and the places thou strikest, fight.js and training.js)

// How far off thy line a blow or a spell still finds what it was aimed at (beyond that one's body,
// world units: `blow`, `spell`), how far a spell flies before it's spent (`reach`), and how far short
// of what it finds it knows (`early`): it flies on onto its drawing from there (spellfx.js, pinOn).
export const AIM = { blow: 0.6, spell: 1.0, reach: RANGED.reach + 4, early: 2 };
const AIM_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const AIM_AT = new THREE.Vector3();

// The way n aims (`at`: where thou pointest, input.js, with its ray): from n to the pointer, as a
// way [dx, dz] on the floor. The pointer is taken where its ray crosses the height the attack goes
// at (`up` over the ground under n), so that on the screen the line runs from n's middle at that
// height to the pointer, and what flies along it passes right under the pointer. Pointing nowhere,
// or at n itself, the way it faces.
export function aimOf(n, at, up) {
  if (!at) return [n.body.facing, 0];
  let x = at.x;
  let z = at.z;
  if (at.ray) {
    AIM_PLANE.constant = -(groundAt(n.pos.x, n.pos.y) + up);
    if (at.ray.intersectPlane(AIM_PLANE, AIM_AT)) { x = AIM_AT.x; z = AIM_AT.z; }
  }
  const dx = x - n.pos.x;
  const dz = z - n.pos.y;
  const d = Math.hypot(dx, dz);
  return d > 0.05 ? [dx / d, dz / d] : [n.body.facing, 0];
}

// How high n's middle stands over the ground under it (where its blow goes).
export const middleOf = (n) => (n.body.sheet.head ?? 60) * n.body.sheet.px * 0.55 + (n.lift || 0);

// The way a blow of n's goes: thine, the way thou aimed it (pilot.js); anyone else's, the way it faces.
export const wayOf = (n) => n.action?.aim || [n.body.facing, 0];

// Where something standing at (tx, tz), `rx` across and `rz` deep (half its body each way), lies on
// the line from (ox, oz) the way `dir` goes: how far along it, if it stands within `reach` ahead
// (and its body), or no more than `back` behind (a blow finds what's at one's very side), and no
// farther off the line than its body and `margin`; else null.
export function onAim(ox, oz, dir, tx, tz, rx, rz, reach, margin, back = 0.6) {
  const dx = tx - ox;
  const dz = tz - oz;
  const along = dx * dir[0] + dz * dir[1];
  const half = Math.hypot(rx * dir[1], rz * dir[0]); // (its body across the line)
  const deep = Math.hypot(rx * dir[0], rz * dir[1]); // (and along it)
  return along > -back && along < reach + deep && Math.abs(dx * dir[1] - dz * dir[0]) <= half + margin ? along : null;
}

// Whether what flies the way `dir` goes, now at (x, z), has come up to something at (tx, tz) (`rx`,
// `rz` as above): on course for it (no farther off its line than its body and `margin`), and at its
// near side (or `early` short of it), or not long past it.
export function meets(x, z, dir, tx, tz, rx, rz, margin, early = 0) {
  const dx = tx - x;
  const dz = tz - z;
  const along = dx * dir[0] + dz * dir[1];
  const deep = Math.hypot(rx * dir[0], rz * dir[1]);
  return along <= deep + early && along > -deep - 1.5 && Math.abs(dx * dir[1] - dz * dir[0]) <= Math.hypot(rx * dir[1], rz * dir[0]) + margin;
}

// Something struck (by what flies along thy line): itself, where it stands (its feet), and its
// drawing as it shows now (npc.js, SpriteBody.drawing; a dummy's), what sticks in it pinned to that.
export const struckOf = (t) => ({
  target: t,
  at: () => [t.pos.x, t.lift || 0, t.pos.y],
  drawing: () => (t.drawing ? t.drawing() : t.body?.drawing?.() ?? null),
});

// Thy spell's line: the way to the pointer at the height it flies at (aimOf); where it leaves from,
// on that line (out to where thy pose holds it, ahead of thee, nearer thee as the line turns into
// the view or out of it, where no drawing reaches); the floor where thou pointest, within its reach
// (for what rises out of the floor); and how far it flies. The place it's cast on adds what stands
// on the line: `meets(x, z)`, what something flying along it has come up to (or, `meets(x, z, way,
// early)`, flying some other way, knowing it `early` short of it: Ruadan's maul coming back), and
// `first(reach)`, the first standing on it ({ along, x, z, struck }); each struck thing as
// { target, at() }, at() its place (its feet), as it moves.
export function aimSpell(n, at) {
  const [ahead, up] = muzzleSpot(n);
  const lift = n.lift || 0;
  const dir = aimOf(n, at, up + lift);
  const r = ahead * Math.abs(dir[0]) + 0.35 * Math.abs(dir[1]);
  const from = [n.pos.x + dir[0] * r, up + lift, n.pos.y + dir[1] * r + 0.05];
  const gx = at ? at.x - n.pos.x : dir[0] * 6;
  const gz = at ? at.z - n.pos.y : dir[1] * 6;
  const gd = Math.hypot(gx, gz) || 1;
  const k = Math.min(AIM.reach, Math.max(2, gd)) / gd;
  return { dir, from, ground: [n.pos.x + gx * k, n.pos.y + gz * k], reach: AIM.reach, meets: () => null, first: () => null };
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
  // Maren, played (her right click: she fights up close, else): a thunderbolt thrown from her
  // spear's tip, straight along her line to what it strikes (drawn: Sacha's two drawings, stretched
  // from her spear to it, not moving: the bolt there in a flash, its burst on what it strikes, held
  // a moment, then breaking up as it goes)
  storm: [
    { weight: 1, cast: (c) => c.beam({ width: 1.0, share: 1, art: 'maren-thunderbolt', life: 0.6, thick: [0.7, 1.3] }) },
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

// What a spell is heard as (audio.js), by school and by which of its spells (in the order listed
// above): `cast` as it's loosed (`wait` seconds after, for what comes up out of the floor once its
// mark has warned of it, spellfx.js, Rise: so that the crest of Jorvik's pillar and the burst of
// Vael's spikes come as they rise), `land` as it lands on what it struck (Solenne's have none yet).
const HEARD = {
  rune: [
    { cast: 'runelord-cast', land: 'runelord-lands' }, { cast: 'runelord-cast', land: 'runelord-lands' },
    { cast: 'runelord-pillar', wait: 0.07, land: 'runelord-lands' },
  ],
  glintstone: [
    { cast: 'sorceress-projectile', land: 'sorceress-lands' }, { cast: 'sorceress-projectile', land: 'sorceress-lands' },
    { cast: 'sorceress-projectile', land: 'sorceress-lands' },
  ],
  blood: [{ cast: 'bloodbender-blob', land: 'bloodbender-impact' }, { cast: 'bloodbender-spikes', wait: 0.12 }, { cast: 'bloodbender-lash' }],
  holy: [{ cast: 'holy-spell' }, { cast: 'holy-spell' }, { cast: 'holy-light' }],
  storm: [{ cast: ['knight-thunder', 'knight-thunder-rise'] }], // (one of her zaps, and the rush with it)
  frost: [{ cast: 'frost-throw', land: 'frost-lands' }, { cast: 'frost-throw', land: 'frost-lands' }],
};
// A sound of n's (audio.js: one, or several together), heard where n stands (or at x, z), `delay`
// seconds from now.
const heard = (n, name, x = n.pos.x, z = n.pos.y, delay = 0) => {
  for (const one of [name].flat()) if (one) n.ctx?.sound?.play(one, { at: [x, z], delay });
};

// n casts one of its spells. `target()`: the point it's cast at (followed, homing: a fighter's at
// him); thine, `aim` (aimSpell), straight along thy line, striking what it meets; or neither, straight
// on `dir` ([dx, dz]) into nothing. `hit(at, share, struck)`: it lands, `share` of an ordinary
// spell's strength (aimed, on what it struck).
export function castSpell(fx, n, { target = null, dir = null, aim = null, hit }) {
  if (styleOf(n).throws === 'maul') { throwMaul(fx, n, { aim, dir, hit }); return; }
  if (styleOf(n).throws) { throwSpear(fx, n, { aim, dir, hit }); return; }
  const school = styleOf(n).school;
  const list = SPELLS[school];
  if (!list) return;
  const from = aim ? aim.from : muzzleOf(n);
  const trail = motesOf(school);
  const spell = pick(list);
  const sounds = HEARD[school]?.[list.indexOf(spell)] || {};
  const land = (at, share, size = 1, struck = null) => {
    fx.add(new Burst(fx, { school, at: [at.x, at.y, at.z], size: 1.3 * size, ring: false, sparks: Math.round(14 * size) }));
    heard(n, sounds.land, at.x, at.z);
    hit(at, share, struck);
  };
  const c = {
    px: n.body.sheet.px, // (the caster's pixel size, for spells drawn to match it)
    missile: ({ side = 0, share = 1, size = 1, ...o }) => {
      if (aim) {
        // along thy line (a volley fanned out to one side at first comes back onto it), striking
        // what it comes up to
        const m = new Missile(fx, {
          light: shine(school, 6 * size, 6), ...o, from, trail, dir: aim.dir, guide: { from, dir: aim.dir }, turn: side ? 3.5 : 7,
          life: aim.reach / (o.speed ?? 10), strike: aim.meets, land: 0, onHit: (at, struck) => land(at, share, size, struck),
        });
        if (side) {
          m.vel.x -= aim.dir[1] * side;
          m.vel.z += aim.dir[0] * side;
        }
        fx.add(m);
        return;
      }
      // (fanned out to one side at first: it comes round onto him)
      const away = side ? [from[0] - n.body.facing * 0.2, from[1], from[2] + side * 0.08] : from;
      const m = new Missile(fx, {
        ...o, from: away, trail, light: shine(school, 6 * size, 6),
        to: target, dir: target ? null : dir, turn: side ? 3.5 : 7, life: target ? 3 : 1.4,
        onHit: (at) => land(at, share, size),
      });
      if (side) m.vel.z += side;
      fx.add(m);
    },
    rise: ({ share = 1, ...o }) => {
      if (aim) {
        // under what stands first on thy line; else out of the floor where thou pointest
        const on = aim.first(aim.reach);
        const [x, z] = on ? [on.x, on.z] : aim.ground;
        fx.add(new Rise(fx, { school, x, z, ...o, onHit: on ? (at) => land(at, share, 1, on.struck) : null }));
        return;
      }
      // (cast straight on into nothing, it rises where it would have struck, a few steps ahead)
      const [x, , z] = target ? target() : [from[0] + dir[0] * 6, 0, from[2] + dir[1] * 6];
      fx.add(new Rise(fx, { school, x, z, ...o, onHit: target ? (at) => land(at, share) : null }));
    },
    beam: ({ share = 1, width, art = null, tile = false, ...look }) => {
      if (aim) {
        // along thy line, to what stands first on it; else on into nothing. It leaves from where
        // the pose holds it as drawn (Maren's spear's tip, out to her side, in her own plane), not
        // from where the line begins: run into the view or out of it, that point stands deeper or
        // nearer than the drawing, and the beam would float off the hand that looses it
        const on = aim.first(aim.reach);
        const len = on ? Math.max(1, on.along) : 9;
        const end = [from[0] + aim.dir[0] * len, from[1], from[2] + aim.dir[1] * len];
        fx.add(new Beam(fx, { school, from: muzzleOf(n), to: end, width, art, tile, ...look, onHit: on ? (at) => land(at, share, 1, on.struck) : null }));
        return;
      }
      const to = target ? target() : [from[0] + dir[0] * 9, from[1], from[2] + dir[1] * 9];
      fx.add(new Beam(fx, { school, from, to, width, art, tile, ...look, onHit: target ? (at) => land(at, share) : null }));
    },
  };
  heard(n, sounds.cast, n.pos.x, n.pos.y, sounds.wait);
  spell.cast(c);
}

// Ulric's spear, thrown (his right click, a spell to him: pilot.js): his own spear, drawn as his
// Tenfold Spears are (ults.js), leaving his open hand fast and flying straight along thy line (or,
// unaimed, the way he faces); striking what it comes up to as a spell does, its point in his drawing
// (spellfx.js, pinOn), a spark of his colour where it bites, and staying stuck in it a moment, the
// way it flew, as it moves and turns; else on into nothing.
const SPEAR = { speed: 34, stuck: 1.2, back: 0.9 }; // (`back`: its middle, behind its point)
function throwSpear(fx, n, { aim = null, dir = null, hit }) {
  const facing = n.body.facing;
  const line = aim || { dir: dir || [facing, 0], from: muzzleOf(n), reach: AIM.reach, meets: () => null };
  const { from, dir: way } = line;
  const look = lookOf('ulric-spear', n.body.sheet.px, { map: TEX.spear(), w: 2.1, h: 2.1 * 9 / 70 });
  heard(n, 'bandit-woosh');
  fx.add(new Missile(fx, {
    ...look, from, dir: way, guide: { from, dir: way }, speed: SPEAR.speed, turn: 14, life: line.reach / SPEAR.speed, strike: line.meets,
    land: SPEAR.back,
    onHit: (at, struck, pin) => {
      // (its point, where it bit: back along the way it flew from its middle)
      const p = pin?.now();
      const tip = p ? inSpace(fx.scene, p.tip) : [at.x + way[0] * SPEAR.back, at.y, at.z + way[1] * SPEAR.back];
      fx.add(new Spark(fx, { color: styleOf(n).color, at: [tip[0], tip[1], tip[2] + 0.2], dir: Math.sign(p ? p.way[0] : way[0]) || facing, size: 1.3 }));
      heard(n, 'bandit-hit', tip[0], tip[2]); // (biting: audio.js)
      if (pin) fx.add(new StuckSpear(fx, { pin, dir: facing, until: SPEAR.stuck, look, motes: null }));
      else if (struck) {
        const [bx, by, bz] = struck.at();
        const off = [at.x - bx, at.y - by, at.z - bz + 0.2];
        fx.add(new StuckSpear(fx, { follow: struck.at, off, dir: facing, way, until: SPEAR.stuck, look, motes: null }));
      }
      hit(at, 1, struck);
    },
  }));
}

// Ruadan's maul, thrown (his right click, a spell to him: pilot.js): his own maul, drawn as he holds
// it crouching (fx/ruadan-maul.json), leaves his open hand head first, spinning, and flies along thy
// line (or, unaimed, the way he faces) at `speed` (spellfx.js, Boomerang). It strikes the first thing
// it comes up to, goes on `past` its far side, and comes down over the last `dive` of the way to plant
// its head in the floor (or does so at `reach`, striking nothing), the stone cracking there in his
// gold (`crack`: a Decal, fading the last of its `life`), dust and chips of gold flying; there it
// stays `stay` seconds, shaking side to side the last `shake` of them as the Golem shakes gathering
// his fire, then is pulled out and back to his hand, faster and faster (`back` seconds), striking
// what it comes up to again on the way. Each blow as hard as a spell, a spark of his gold where it
// lands. Once it has left his hand he goes where he will (`n.maulOut`: about without it, pilot.js),
// but strikes nothing, throws nothing and looses nothing (ults.js) till it's back; as it's pulled
// out he stops where he stands, turns to it and holds out his hand for it (his `catch`, the drawing
// he threw it in), and so till it's in his hand. If anything takes him first (travel by grace, a
// fall), it's back in his hand at once. (Turns as seen thrown right: `turn` as it leaves his hand,
// its haft back toward the hand; `angle` planted, its haft leaning back the way it came; its
// drawing's haft rises 26° from the head: `haft`.) It's heard landing (each blow, and planted: HAMMER),
// pulled out and flying back, and whooshing round each half turn (`whirl`, radians) it spins out.
const MAUL = {
  speed: 16, reach: 10, past: 1.6, dive: 1.8, sink: 0.12, turn: 2.52, angle: 1.55, haft: 0.454, whirl: Math.PI,
  stay: 0.75, shake: 0.45, jolt: 0.05, back: 0.4, spin: 19, pivot: [0.25, 0.55],
  crack: { size: 2.4, life: 4, fade: 1.5 },
  light: { color: '#ffb84a', power: 8, reach: 6 },
  embers: ['#fceb6d', '#fad140', '#ec9a08', '#b26707'],
  dust: ['#6a5a4e', '#3a2e28', '#8a7a6a', '#ec9a08'],
};
function throwMaul(fx, n, { aim = null, dir = null, hit }) {
  const facing = n.body.facing;
  const line = aim || { dir: dir || [facing, 0], from: muzzleOf(n), meets: () => null };
  const { from, dir: way } = line;
  const pilot = n.ctx?.pilot;
  const look = lookOf('ruadan-maul', n.body.sheet.px, { map: TEX.orb('holy', 5), w: 0.5, h: 0.5 });
  const maul = new Boomerang(fx, {
    ...look, from, dir: way, ...MAUL, light: MAUL.light, trail: MAUL.embers, dust: MAUL.dust,
    // (his hand, held out for it the way he faces: gone if he's been taken from it)
    home: () => (n.maulOut === maul && !n.travel && !n.shift && !pilot?.dead && (!pilot || pilot.npc === n) ? muzzleOf(n) : null),
    // (what it has come up to: its own body, not a spell's reach short of it)
    strike: (x, z, going) => line.meets(x, z, going, 0),
    onHit: (at, struck) => {
      fx.add(new Spark(fx, { color: styleOf(n).color, at: [at.x, at.y, at.z + 0.2], dir: Math.sign(at.x - n.pos.x) || facing, size: 1.6 }));
      heard(n, HAMMER, at.x, at.z);
      hit(at, 1, struck);
    },
    // (spinning out: its whoosh, again and again)
    onWhirl: (at) => heard(n, 'champion-woosh', at.x, at.z),
    // (its head driven into the floor: the stone cracks in his gold, dust and chips of gold fly)
    onPlant: (x, z) => {
      heard(n, HAMMER, x, z);
      const crack = new Decal(fx.scene, 'goldCrack', x, z, MAUL.crack.size, { glow: false });
      let t = 0;
      fx.add({
        step: (dt) => { t += dt; crack.opacity = Math.min(1, (MAUL.crack.life - t) / MAUL.crack.fade); return t < MAUL.crack.life; },
        dispose: () => crack.dispose(),
      });
      fx.particles.emit({
        pos: [x, 0.2, z], spread: [0.4, 0.1, 0.25], vel: [0, 2, 0], velSpread: [2.2, 1.2, 1.2],
        color: MAUL.dust, size: 0.1, life: 0.8, count: 26, drag: 1.3, gravity: 6, intensity: 1.2,
      });
      fx.particles.emit({
        pos: [x, 0.2, z], spread: [0.2, 0.05, 0.15], vel: [0, 2.6, 0], velSpread: [1.6, 1.2, 1],
        color: MAUL.embers, size: 0.06, life: 0.6, count: 14, drag: 1.2, gravity: 4, intensity: 2.4,
      });
      n.ctx?.rig?.shake?.(0.12);
    },
    // (pulled out: he stops where he stands, turns to it and holds out his hand till it's in it)
    onBack: (x, z) => {
      if (n.maulOut !== maul) return;
      heard(n, 'champion-back', x, z);
      if (Math.abs(x - n.pos.x) > 0.3) n.body.facing = x > n.pos.x ? 1 : -1;
      n.action = { kind: 'catch', anim: 'catch', t: 0, dur: Infinity };
      n.body.play(n.body.sheet.anims.catch ? 'catch' : 'idle', true);
    },
    // (back in his hand, or gone: his hand is his own again)
    onDone: () => {
      if (n.maulOut === maul) n.maulOut = null;
      if (n.action?.kind === 'catch') n.action.dur = n.action.t;
    },
  });
  n.maulOut = maul;
  fx.add(maul);
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

// Damage over time (`kind`: 'bleed' or 'poison'), `dps` from now till `until`, `src` its owner;
// `heard`, a sound of it (audio.js), heard every `DOT_HEARD` seconds while it lasts, the first at once
// (the bleeding of Vael's Crimson Mire, ults.js).
const DOT_HEARD = 1;
export function addDot(b, { kind, dps, until, src, heard = null }) {
  statusOf(b).dots.push({ kind, dps, until, src, heard, heardAt: -Infinity, acc: 0 });
}

// One frame of his statuses (fight.stepBoss): his bleeding and poison, his knocking back, and
// the pool keeping him in. `hit(amount, src)` wounds him; `shift(dx, dz)` moves him; `heard(name)`
// plays a sound where he is.
export function stepStatus(b, now, dt, { hit, shift, particles, heard = null }) {
  const s = b.status;
  if (!s) return;
  s.dots = s.dots.filter((d) => {
    if (now >= d.until) return false;
    d.acc += d.dps * dt;
    if (d.acc >= 4) { hit(d.acc, d.src); d.acc = 0; }
    if (d.heard && now - d.heardAt >= DOT_HEARD) {
      d.heardAt = now;
      heard?.(d.heard);
    }
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
