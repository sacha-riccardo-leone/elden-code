// node scripts/cut-sfx.mjs [set…]: the game's sounds (client/js/audio.js, SOUNDS), cut from Sacha's
// recordings (client/assets/sfx/IMPORT/<their folder>, left as they are and never committed) into
// client/assets/sfx/<set>: each sound from where it starts (a footstep alone, where a recording holds
// several, a few seconds apart), levelled to one peak, mono MP3. Every set, or those named. Needs
// ffmpeg. The cut points were found from the recordings' loudness (each sound's sudden rise).
//   golem        the Guardian Golem's (golem.js), from "Golem Guardian"
//   boss         Fenrath's (fight.js), from "Fenrath"
//   ronin        Wynn's (heroes/ronin.js, ults.js), from "Wynn"
//   knight       Maren's thunderbolt and Red Storm (combat.js, ults.js), from "Marren"
//   paladin      Aurelion's Radiant Verdict and its giant (ults.js), from "Aurelion"
//   champion     Ruadan's Hammerfall (ults.js) and his maul (combat.js), from "Ruadan"
//   frost        Fortuna's spells and Frostfall (combat.js, ults.js), from "Fortuna"
//   sorceress    Corisande's spells and Glintstone Arrow (combat.js, ults.js), from "Sellen"
//   bloodbender  Vael's gout of blood (combat.js), from "Vael"
//   holy         Solenne's spells (combat.js), from "Holy magic"
//   bandit       Ulric's spears (combat.js, ults.js), from "Ulric"
//   spectre      the Noble Sorcerers' spectres (npc.js), from "Noble sorcerers"
//   work         the stations' (npc.js, interact.js), from "Working"
//   yard         the training yard's straw dummies (training.js), from "dummy" (and IMPORT's)
//   steps        everyone's footsteps, and a dodge or a hop coming down (npc.js, pilot.js, fight.js),
//                from "Base movements"
//   blade        the swing of a blow (combat.js), from "Base sword sounds"
//   cine         the world standing still as an ultimate is loosed (ults.js), from "During everyones
//                ult camera focus"
//   ui           the banners' and setting out's (ui.js, main.js), from those loose in client/assets/sfx
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SFX = path.join(repo, 'client/assets/sfx');

// Each set: the folder its recordings are in (never the set's own name, not even but for its case:
// on Windows the two would be one folder), and its clips: [name, source file, start (s), length (s),
// peak (dBFS), fade in (s), fade out (s), and { reverse } to have that stretch played backward (its
// fades then at the ends of what's heard), { group } for clips heard together (a recording's 1 and
// 2: audio.js, `layer`), levelled as one so that they keep the balance they were made with].
const SETS = {
  golem: {
    from: 'IMPORT/Golem Guardian',
    clips: [
      ...[2.43, 5.21, 8.86, 11.66, 15.26, 18.06, 21.70].map((t, i) => [`step-${i + 1}`, 'golem_footsteps_type1.mp3', t - 0.02, 1.8, -4, 0, 0.8]),
      ...[0.06, 6.76, 12.06, 18.76].map((t, i) => [`step-${i + 8}`, 'golem_footsteps_type2.wav', t - 0.02, 1.8, -4, 0, 0.8]),
      ['windup', 'golem_anticipation_atk.wav', 0.04, 0.95, -3, 0, 0.3],
      ['strike', 'golem_atk.wav', 0, 1.9, -2, 0, 0.5],
      ['clang', 'golem_not_ankle_sound.wav', 0, 1.1, -3, 0, 0.4],
      // passing out: his stone crumbling as he falls (golem.js), heard from his first moment of
      // falling: the first from its first crackle (the 0.9 s before it are faint), the second from its
      // start, and no longer than his fall may last (both are stopped as his body hits the floor)
      ['fall-start-1', 'golem_passing_out_start_1.ogg', 0.88, 1.5, -6, 0, 0.25],
      ['fall-start-2', 'golem_passing_out_start_2.wav', 0, 3, -6, 0, 0.6],
      ['fall-hit', 'golem_passing_out_ground_hit.wav', 0, 2.9, -2, 0, 0.8],
      ['fire-start', 'golem_spitting_fire_start.wav', 0, 3.1, -3, 0, 0.15],
      // (the blaze from where it's already roaring, its quiet lead-in left out)
      ['fire', 'golem_spitting_fire.wav', 1.15, 2.85, -3, 0, 0.5],
      ['meteor', 'meteorite_hit.wav', 2.02, 1.6, -4, 0, 0.6],
      // a blow or a spell on his cracked ankle (the two together), and the burst of his fire as he
      // begins to spit it (Firespray 2, from its first sound, in place of golem_explosion_on_spitfire)
      ['ankle-1', 'golem_ankle_hit_1.wav', 0, 1.2, -3, 0, 0.4, { group: 'ankle' }],
      ['ankle-2', 'golem_ankle_hit_2.wav', 0, 1.5, -3, 0, 0.5, { group: 'ankle' }],
      ['explosion', 'freeexplosionspitfire/Firespray 2.ogg', 0.035, 2.03, -2, 0, 0.6],
      // each meteor flung up out of him (one of two), and the swarm of them as they begin (one of two)
      ['throw-1', 'freemeteor/Rock Meteor Throw 1.ogg', 0, 0.5, -4, 0, 0.1],
      ['throw-2', 'freemeteor/Rock Meteor Throw 2.ogg', 0, 0.5, -4, 0, 0.1],
      ['swarm-1', 'freemeteor/Rock Meteor Swarm 1.ogg', 0, 1.97, -3, 0, 0.5],
      ['swarm-2', 'freemeteor/Rock Meteor Swarm 2.ogg', 0, 1.87, -3, 0, 0.5],
      // passing out: his stone giving way as he tips over (freepassoutsound's Rock Meteor Throw 2 is
      // freemeteor's, the very same recording: throw-2), and crumbling as his body hits the floor
      ['crumble', 'freepassoutsound/Rock Wall 1.ogg', 0, 2.0, -3, 0, 0.6],
    ],
  },
  ronin: {
    from: 'IMPORT/Wynn',
    clips: [
      // a blow of his (any but his Iaijutsu's), from its rise
      ['slash', 'slash.mp3', 0.06, 0.5, -4, 0, 0.15],
      // his Iaijutsu loosed (thine as R is pressed), whole
      ['ult', 'ult_pressed.wav', 0, 1.3, -3, 0, 0.3],
      // and with it his breath as he gathers himself: its first 1.1 s, the swell and the hold (it
      // tails off for another second and a half after), fading out over its last 0.45 s as the
      // first cut comes; a little quieter than the rest (it's loud throughout, not in one burst)
      ['breathe', 'concentration_breathe.wav', 0.03, 1.1, -6, 0, 0.45],
      // the glare on the blade as he looses it: the shine itself, at 2.53 s (before it, a click and
      // half a second of hiss)
      ['shine', 'blade_shine.m4a', 2.5, 1.1, -4, 0, 0.5],
      // each cut of his Iaijutsu: from where it's loud already (it swells from 2.12 s, silent before
      // that), and short, so that eight of them a ninth of a second apart stay apart
      ['cut', 'ult_slash.wav', 2.36, 0.7, -3, 0, 0.35],
      // and the glare on the blade again, at the end, backward: its ring swelling into the shine and
      // gone (0.45 s: over as the blade goes home)
      ['shine-back', 'blade_shine.m4a', 2.53, 0.45, -4, 0.06, 0.02, { reverse: true }],
      // all of it landing on him at once, whole (it's loud from its first instant)
      ['damage', 'ult_damage_dealt.wav', 0, 1.7, -3, 0, 0.4],
    ],
  },
  ui: {
    from: '.',
    clips: [
      // a banner revealed: from its first sound (0.65 s: silent before), swelling as the banner
      // comes up, and dying away about as it goes
      ['banner', 'announcement_banner_reveal.wav', 0.64, 4.4, -3, 0, 1.2],
      // setting out, the title's button clicked: from its first sound
      ['start', 'after_click_start_your_tarnished_journey.wav', 0.2, 4.6, -3, 0, 0.8],
    ],
  },
  boss: {
    from: 'IMPORT/Fenrath',
    clips: [
      // as he comes into the arena (from its first sound, 0.9 s in)
      ['appear', 'fenrath_appearing.wav', 0.9, 4.9, -3, 0, 1.0],
      // his great attack: his roar, and the rumble beginning with it
      ['roar', 'roar.wav', 0, 3.6, -2, 0, 0.6],
      ['wrath', 'fenrath_big_atk_start.mp3', 0, 3.9, -3, 0, 0.6],
      // while it goes on, from his leap up (the two together; stopped as it ends)
      ['wrath-during-1', 'fenrath_big_atk_during.wav', 0, 12, -4, 0, 1.5, { group: 'during' }],
      ['wrath-during-2', 'fenrath_big_atk_during2.wav', 0, 12, -4, 0, 1.5, { group: 'during' }],
      // each cut of the ghost of his sword
      ['sword', 'fenrath_big_atk_sword_hit.wav', 0, 1.9, -2, 0, 0.5],
      // landing (the recording holds three, one picked each time)
      ['land-1', 'fenrath_jump_landing.wav', 0, 2.0, -2, 0, 0.6],
      ['land-2', 'fenrath_jump_landing.wav', 2.98, 3.8, -2, 0, 1.0],
      ['land-3', 'fenrath_jump_landing.wav', 7.98, 4.8, -2, 0, 1.2],
    ],
  },
  knight: {
    from: 'IMPORT/Marren',
    clips: [
      // the Red Storm's bolts: six strikes out of its thunder, one picked for each bolt
      ...[8.78, 9.38, 10.53, 11.13, 12.53, 14.33].map((t, i) => [`bolt-${i + 1}`, 'maren_ult_small_lightning.mp3', t - 0.02, 0.6, -3, 0, 0.3]),
      // and the great bolt that ends it, its thunder rolling on
      ['great', 'maren_ult_big_lightning.wav', 4.36, 6.0, -2, 0, 2.0],
      // her thunderbolt (her right click): one of the sixteen zaps in atk1, one picked each time, and
      // with it atk2's rush (in its 2-3 s: from where it's heard, so that it peaks as the bolt is there)
      ...[[0.90, 0.17], [1.91, 0.18], [2.70, 0.26], [3.32, 0.20], [4.41, 0.65], [5.91, 0.15], [6.31, 0.15], [6.99, 0.15], [7.74, 0.16], [8.38, 0.72], [9.49, 0.21], [10.12, 0.43], [11.74, 0.15], [12.92, 0.21], [14.15, 0.17], [15.44, 0.61]].map(([t, len], i) => [`thunder-${i + 1}`, 'maren_atk1.wav', t, len, -4, 0, 0.05]),
      ['thunder-rise', 'maren_atk2_audiobetween2and3.wav', 2.6, 0.42, -3, 0, 0.05],
      // her Red Storm: the camera closing on her as R is pressed (maren_ult_start_on_click.mp3, from
      // its first sound, 0.14 s in: it swells for a second and holds; over as the storm breaks, 1.85 s
      // on, as the camera lets her go)
      ['ult-zoom', 'maren_ult_start_on_click.mp3', 0.12, 1.95, -3, 0, 0.4],
    ],
  },
  paladin: {
    from: 'IMPORT/Aurelion',
    clips: [
      // his Radiant Verdict loosed: the recording's third (from 4.82 s), as named
      ['ult', 'aurelion_ult_start1_at4.5s.wav', 4.82, 1.6, -3, 0, 0.5],
      // the giant of his light rising behind him
      ['stand', 'aurelion_stand_appear.wav', 0, 3.0, -3, 0, 0.8],
      // and striking: one of the fifteen heavy blows in aurelion_stand_hit (each from just before it)
      ...[1.48, 8.09, 14.21, 20.44, 27.405, 36.515, 47.295, 53.765, 59.885, 67.07, 73.11, 79.225, 85.455, 92.42, 102.965]
        .map((t, i) => [`stand-hit-${i + 1}`, 'aurelion_stand_hit.wav', t - 0.02, 1.5, -2, 0, 0.7]),
    ],
  },
  champion: {
    from: 'IMPORT/Ruadan',
    clips: [
      // Hammerfall: his leap (from 1.2 s, just before its loudest, 1.42 s: as he's rising; over as he
      // lands), and the maul's head driven into the floor, and the golden explosion
      ['jump', 'ruadan_ult_jump.mp3', 1.2, 1.25, -3, 0.02, 0.35],
      ['land', 'radahn_ult_landing_explosion.wav', 0, 5.5, -2, 0, 1.5],
      // his maul landing (a blow of his, or thrown: striking, planted): one of the three Sacha chose
      // of hammer_hit_2_variations (between 1 and 2 s, 10 and 12, 12 and 13), each from just before
      // its crack (1.02, 11.02 and 13.04 s in: the swell into it left out), so that it cracks as the
      // maul lands (hammer_hit, its sound not good enough, is left out, as Sacha wants); or
      // hammer_hit_2 or hammer_hit_3, from their first sound, levelled lower: as loud a peak, they're
      // louder than the rest
      ...[0.98, 10.98, 12.965].map((t, i) => [`hit-${i + 1}`, 'hammer_hit_2_variations.mp3', t, 1.15, -3, 0.015, 0.5]),
      ['hit-4', 'hammer_hit_2.mp3', 0, 1.6, -5.5, 0, 0.6],
      ['hit-5', 'hammer_hit_3.mp3', 0.02, 1.6, -5.5, 0, 0.6],
      // pulled out and flying back to his hand (between 1 and 3 s, as Sacha wants: its swell at its
      // loudest at 1.45 s, about as it's in his hand)
      ['back', 'hammer_coming_back.mp3', 1.0, 2.0, -3, 0.04, 0.8],
      // spinning out (its one whoosh, from its first sound: heard again and again as it turns)
      ['woosh', 'hammer_woosh.mp3', 0.02, 0.18, -4, 0, 0.05],
    ],
  },
  frost: {
    from: 'IMPORT/Fortuna',
    clips: [
      // a spell of hers landing (the two together, from each one's first sound)
      ['lands-1', 'Fortuna_spell_atk_lands.wav', 0.73, 1.1, -3, 0, 0.4, { group: 'lands' }],
      ['lands-2', 'Fortuna_spell_atk_lands_2.wav', 0.02, 1.1, -3, 0, 0.4, { group: 'lands' }],
      // a spell of hers loosed (one of two)
      ['throw-1', 'Ice Throw 1.ogg', 0, 1.05, -3, 0, 0.3],
      ['throw-2', 'Ice Throw 2.ogg', 0, 0.98, -3, 0, 0.3],
      // Frostfall's three great icicles shattering as each lands (from its first sound), and its
      // mass of ice bursting (from its first sound, 1.78 s in)
      ['icicle', 'new_ice_rock_shattering.ogg', 0.015, 0.8, -3, 0, 0.3],
      ['ult-end', 'Fortuna_ult_debris_explosion_end.wav', 1.76, 1.5, -2, 0, 0.5],
    ],
  },
  sorceress: {
    from: 'IMPORT/Sellen',
    clips: [
      // a spell of hers loosed (the two together)
      ['projectile-1', 'Sellen_projectile.wav', 0.08, 1.4, -4, 0, 0.5, { group: 'projectile' }],
      ['projectile-2', 'Sellen_projectile_2.wav', 0, 1.6, -4, 0, 0.5, { group: 'projectile' }],
      // her Glintstone Arrow striking home
      ['ult-hit', 'ult_hit.wav', 0.08, 2.4, -2, 0, 0.6],
    ],
  },
  bloodbender: {
    from: 'IMPORT/Vael',
    clips: [
      // her gout of blood, loosed (from where it swells, 0.22 s in), and landing on what it struck
      // (from just before its burst, 0.16 s in: the quiet rise before it left out)
      ['blob', 'Vael_blood_blob_projectile.m4a', 0.22, 1.4, -3, 0, 0.3],
      ['impact', 'atk_impact.ogg', 0.15, 0.73, -3, 0, 0.3],
    ],
  },
  holy: {
    from: 'IMPORT/Holy magic',
    clips: [
      // a lance or a halo of holy light loosed (from where it swells)
      ['spell', 'magic-spell.wav', 0.15, 2.2, -3, 0, 0.6],
      // light falling on him
      ['light', '853303__tommasomotteran__magic-healing-spell-sfx-fantasy-rpg-restore-effect.wav', 0.1, 2.2, -3, 0, 0.5],
    ],
  },
  bandit: {
    from: 'IMPORT/Ulric',
    clips: [
      // a spear leaving his hand (the three together)
      ['woosh-1', 'spear_woosh_1.wav', 0, 0.09, -4, 0, 0.02, { group: 'woosh' }],
      ['woosh-2', 'spear_woosh_2.wav', 0, 0.08, -4, 0, 0.02, { group: 'woosh' }],
      ['woosh-3', 'spear_woosh_3.wav', 0, 0.1, -4, 0, 0.02, { group: 'woosh' }],
    ],
  },
  spectre: {
    from: 'IMPORT/Noble sorcerers',
    clips: [
      // a spectre called up (the two together: whispering spells, and a swell)
      ['appear-1', 'noble_sorcerer.wav', 0, 9, -6, 1.0, 3.0, { group: 'appear' }],
      ['appear-2', 'noble_sorcerer_2.wav', 0.4, 9, -6, 0, 3.0, { group: 'appear' }],
    ],
  },
  work: {
    from: 'IMPORT/Working',
    clips: [
      // a hammer blow on the anvil (the two together, from each one's ring)
      ['anvil-1', 'anvil-hit-1.wav', 0.22, 1.0, -4, 0, 0.4, { group: 'anvil' }],
      ['anvil-2', 'anvil-hit-2.wav', 0.36, 1.0, -4, 0, 0.4, { group: 'anvil' }],
      // the ritual circle invoked (E), and a spirit ash summoned (a subagent set to work)
      ['summon', 'summoning-magic-spell.flac', 0, 3.6, -3, 0, 0.8],
    ],
  },
  yard: {
    from: '.',
    clips: [
      // a straw dummy bursting (the three together: the wood smashed, struck, and its cloth torn)
      ['break-1', 'dummy/dummy_breaking.wav', 0, 1.7, -3, 0, 0.5, { group: 'break' }],
      ['break-2', 'dummy/dummy_breaking_2.wav', 0.02, 0.6, -3, 0, 0.2, { group: 'break' }],
      ['break-3', 'dummy/dummy_breaking_3.wav', 0, 0.85, -3, 0, 0.2, { group: 'break' }],
      // and struck (from just before its knock, 0.03 s in)
      ['hit', 'IMPORT/dummy/dummy_hit.mp3', 0.025, 0.55, -3, 0, 0.2],
    ],
  },
  steps: {
    from: 'IMPORT/Base movements',
    clips: [
      // a foot set down on stone, walking and running, five of each: plain, and in armour (its
      // chain clinking)
      ...[1, 2, 3, 4, 5].flatMap((i) => [
        [`walk-${i}`, `Stone Walk ${i}.ogg`, 0, 0.5, -4, 0, 0.15],
        [`run-${i}`, `Stone Run ${i}.ogg`, 0, 0.5, -4, 0, 0.15],
        [`chain-walk-${i}`, `Stone Chain Walk ${i}.ogg`, 0, 0.5, -4, 0, 0.15],
        [`chain-run-${i}`, `Stone Chain Run ${i}.ogg`, 0, 0.5, -4, 0, 0.15],
      ]),
      // in heels: fifteen of the recording's 34 steps, the clearest (the faint ones would bring the
      // room's hiss up with them, levelled), each from just before its click, short of the next
      ...[0.795, 1.285, 1.83, 2.365, 6.965, 7.535, 8.07, 8.635, 9.67, 10.3, 10.88, 16.42, 16.94, 17.485, 17.99]
        .map((t, i) => [`heels-${i + 1}`, 'heels.wav', t - 0.02, 0.42, -4, 0, 0.2]),
      // in soft shoes: the step in its fourth second (from 2.96 s, the one heard in it)
      ['soft', 'footstep_in_the_fourth_second.wav', 2.945, 0.55, -4, 0, 0.25],
      // barefoot: only the step between 1.4 and 2 s, as Sacha wants (from just before it, 1.65 s)
      ['bare', 'footsteps-barefoot-tile.wav', 1.635, 0.365, -4, 0, 0.15],
      // coming down from a dodge or a hop, whoever it is
      ['land', 'Stone Land.ogg', 0, 0.5, -4, 0, 0.15],
    ],
  },
  cine: {
    from: 'IMPORT/During everyones ult camera focus',
    clips: [
      // anyone's ultimate loosed, the camera closing on them: effect_on_click from about 2 s in, as
      // Sacha wants (from where it rises, 1.9 s, to its end, 3.39 s), its first two seconds left out
      ['focus', 'effect_on_click.mp3', 1.89, 1.5, -3, 0, 0.04],
    ],
  },
  blade: {
    from: 'IMPORT/Base sword sounds',
    clips: [
      // a blow's swing: each from 0.12 s before its loudest (combat.js, SWING, has it begin that
      // long before the blow lands)
      ['swing-1', 'Sword Attack 1.ogg', 0.045, 0.455, -4, 0.02, 0.15],
      ['swing-2', 'Sword Attack 2.ogg', 0.057, 0.443, -4, 0.02, 0.15],
      ['swing-3', 'Sword Attack 3.ogg', 0.141, 0.359, -4, 0.02, 0.15],
    ],
  },
};

const wanted = process.argv.slice(2);
for (const set of wanted) if (!SETS[set]) { console.error(`No set ${set} (${Object.keys(SETS).join(', ')})`); process.exit(1); }
const ff = (args) => spawnSync('ffmpeg', ['-v', 'info', '-hide_banner', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
for (const [set, { from, clips }] of Object.entries(SETS)) {
  if (wanted.length && !wanted.includes(set)) continue;
  const SRC = path.join(SFX, from);
  const OUT = path.join(SFX, set);
  fs.mkdirSync(OUT, { recursive: true });
  let total = 0;
  // the peak of each stretch, as it is (and of each group, its loudest)
  const peakOf = (src, start, len) => {
    const probe = ff(['-ss', String(start), '-t', String(len), '-i', src, '-ac', '1', '-af', 'volumedetect', '-f', 'null', '-']);
    const m = /max_volume: (-?[\d.]+) dB/.exec(probe.stderr);
    return m ? Number(m[1]) : 0;
  };
  const peaks = clips.map(([, file, start, len]) => peakOf(path.join(SRC, file), start, len));
  const loudest = {};
  clips.forEach(([, , , , , , , { group } = {}], i) => { if (group) loudest[group] = Math.max(loudest[group] ?? -Infinity, peaks[i]); });
  for (const [i, [name, file, start, len, peak, fin, fout, { reverse = false, group = null } = {}]] of clips.entries()) {
    const src = path.join(SRC, file);
    const max = group ? loudest[group] : peaks[i];
    const gain = peak - max;
    const fades = [fin ? `afade=t=in:st=0:d=${fin}` : null, `afade=t=out:st=${(len - fout).toFixed(3)}:d=${fout}`].filter(Boolean);
    const out = path.join(OUT, `${name}.mp3`);
    // (its sound only: a picture a recording carries is left behind)
    const r = ff(['-ss', String(start), '-t', String(len), '-i', src, '-map', '0:a:0', '-ac', '1', '-ar', '44100', '-af', [reverse ? 'areverse' : null, `volume=${gain.toFixed(2)}dB`, ...fades].filter(Boolean).join(','),
      '-codec:a', 'libmp3lame', '-b:a', '112k', out]);
    if (r.status !== 0) { console.error(name, r.stderr.slice(-400)); process.exit(1); }
    const size = fs.statSync(out).size;
    total += size;
    console.log(`${set}/${name}.mp3  ${file} ${start.toFixed(2)}+${len}s${reverse ? ' reversed' : ''}  peak ${peaks[i].toFixed(1)}${group ? ` (${group}: ${max.toFixed(1)})` : ''} -> ${(peaks[i] + gain).toFixed(1)} dB  ${(size / 1024).toFixed(0)} KB`);
  }
  console.log(`${set}: ${clips.length} clips, ${(total / 1024).toFixed(0)} KB`);
}
