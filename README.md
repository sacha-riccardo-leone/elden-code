# Elden Code

Your Claude Code sessions, alive in a dark-fantasy HD-2D world. Each session on this machine
walks in as a Tarnished; what it does in Claude Code, it does in its project's region.

## The title screen

The page opens on a pixel-art title screen in the manner of Elden Ring's (`client/js/title.js`):

- **What it shows:**
  - The **ELDEN CODE** wordmark in cracked gold, each word's first letter standing taller, with
    *The Lands Between Sessions* under it.
  - A faint sigil behind them: a line straight down through three rings and a wide bowl, sparks
    running along its lines.
  - Embers drifting up out of the dark, and a band of light sweeping the wordmark now and then.
  - One way in, small and low on the screen as Elden Ring's "Press any button" is, on a streak of
    light: **Start your Tarnished journey (With Claude)**.
- **How it's drawn:** on small canvases scaled up whole, so that every pixel is a crisp square:
  the wordmark and the sigil about four screen pixels across on a 1080p screen, the way in and the
  loading sign on a grid of half that. The words are Cinzel cut to whole pixels, outlined and
  shaded. Things fade in and out in dithered patterns, and a key or click
  shows the intro at once.
- **Setting out:** click it, or press Enter.
  - The world loads behind the title meanwhile, sessions already taking up their heroes (locally).
  - If it isn't ready yet, a loading sign turns at the bottom right until it is (`client/js/gate.js`).
  - Then the title crumbles away, pixel by pixel from the middle out, as Maren rises at grace.
- **Nothing of the game shows until then:** no buttons, log or map strip, and no keys reach the
  world.
- **Online:** the public demo never shows **Summon phantoms**: its sessions are made up already.

## The Lands Between Sessions

Every project gets its own **region**: a floating island with its own walled keep and stations,
dressed in one of six biomes (Ashen Reach, Verdant Vale, Crimson Wastes, Frostbound Heights,
Azure Mere, Gilded Terrace) and flying the project's banner. Regions rise out of the mist the
first time one of a project's sessions appears, alternating east and west of **Roundtable
Hold**, the hub in the middle, and are joined to it by stone bridges.

Idle Tarnished sometimes cross the bridges to sit at the round table and talk with Tarnished
from other projects. As in Elden Ring, a ring of weapons is planted in the table (swords,
greatswords, katanas, a scimitar, an estoc, war axes, a spear, a halberd, a great hammer, each at
its own angle; `client/js/weapons.js`), and the great Site of Grace floats at its heart, larger
than any island's, a pillar of golden light rising from it. Taking a seat there rests at grace.
Behind the table stands a banner for each island that has risen. When a new island rises, its
banner's wooden pole and crossbar come up out of the ground, then the flag unfurls down from the
bar. When an island sinks, its banner rolls up and goes back into the ground, and the others
close up the arc.
Over every grace's light floats the grace itself, an almost human figure of golden light
(`client/js/grace.js`, from a drawing in `client/assets/fx/grace-core.png`). It rises and sinks
slowly, and the motes of light about it circle it and twinkle. The one over the Round Table is
far larger. When work calls and home is far, they fast travel: they dissolve into golden light
and reappear at their region's Site of Grace.

South of the Hold, and lower, hangs the **Training Yard** (`client/js/yard.js`), always there: a
great five-sided platform of timber slung from the Hold's rim on two chains, standing on posts that
run down into the mist. A stone stair comes down to it from the rim, and whoever walks it goes down
with it (`client/js/ground.js` gives the ground's height wherever it isn't level with the Hold).
Five straw dummies stand inside a sawdust ring (`client/js/training.js`). Blows, spells and
ultimates find them as they find a great enemy. A dummy wobbles as each one lands, and once it has
taken enough it bursts into pieces, then stands whole again five seconds later. Dummies never strike
back. On the yard your ultimate is always full: each one still freezes the world for its moment,
but you needn't wait between them.

| In Claude Code | In the world |
|---|---|
| Session starts | A Tarnished rises at the Site of Grace |
| New prompt | A quest marker pops above their head |
| Edit / Write | Hammering at **the Forge** |
| Read / Grep / Glob | Studying in **the Scriptorium** |
| Bash / PowerShell | Invoking **the Ritual Circle** |
| Web search / fetch, MCP tools | Sending ravens from **the Raven Tower** |
| Todo lists, plans, questions | Plotting at **the War Table** |
| Subagents | Wisps of blue spirit-light circle their summoner |
| Waiting for your permission | Kneeling at **the Fog Gate** while the bell tolls |
| Slash commands (`/code-review`, `/loop`, skills…) | An incantation and a banner across the screen |
| `/compact` | Runes spiral into them: *Memories Consolidated* |
| `/clear` | Reborn at grace |
| `/model` | Their plume, eyes or feather change colour |
| A turn fails (rate limit…) | They collapse: *Thy Stamina Is Spent* |
| Session ends | They walk into their region's fog gate |
| First session of a new project | A new region rises from the mist |
| Idle | They rest, wander, chat, and visit Roundtable Hold |

Cloth colour = project. Plume / eye / feather colour = model (Opus gold, Sonnet silver,
Haiku jade, Fable violet).

You start as **Maren the Stormbound** (the Stormbound Knight), not one of the sessions, but you
can **become any character**: click one and choose **Become …** in the fan over its head.

- **Controls** (whoever you are):
  - **W A S D** or the arrow keys to walk, **Shift** to run; cross the bridges to other islands.
    The camera stays on you.
  - **Left click** strikes with the character's own attack (a Tarnished in front of you staggers;
    it's all for show); a mage casts a spell instead. **Right click** casts as Fortuna or a mage.
    **Space** dodges. **C** crouches. **Q**, in a fight against a great enemy, turns the camera's
    focus on it and back on you. **R** looses your ultimate once its bar is full.
  - **B** (or clicking yourself) opens your fan of gestures over your head (or **1–8**). Nearby
    Tarnished may answer. There are no gestures while a great enemy is abroad: the fan folds away
    and comes back once the fight is over.
  - **E** uses what you stand by (a prompt shows it): the forge, the scrolls, the war table, the
    ritual circle, the raven tower, the fog gate, a site of grace, and the Round Table. Each
    works as it does for the sessions' characters (the forge glows and throws sparks, a raven
    takes wing…).
  - **M** shows the map of every island. **Z / X** travel by grace to the previous / next area,
    **H** to Roundtable Hold.
  - **The map strip** (along the bottom of the screen) is one line as wide as the whole world,
    with Roundtable Hold always in the very middle. Each area's name sits over its own place on it,
    and clicking a name takes you there by grace. A golden dot under
    the line shows where you are, moving with you even between islands. An island only appears on
    it, and can only be reached by grace, once it has fully risen from the mist.
  - While a great enemy is abroad, the **Arena of Trials** shows over Roundtable Hold in shining
    red, under a skull whose horns curve down. Every island but the Hold is greyed out: the Hold is
    the only place you can travel to by grace, and the way on to the arena is on foot. Once you're
    sealed in the arena with it, the strip gives way to its health bar until the fight is over.
  - The **Controls** button (top right) lists all of this.
- **Others:** only the character you are can gesture. Clicking anyone else opens their info panel
  and a fan with just **Become [name]**. You can drag them to carry them elsewhere. Scroll to zoom.
  The names on the map strip and the lines of the message log take you places.
- **Back to Maren:** while you're someone else, Maren lives on her own. She wanders, sits at the
  Round Table and talks in her own voice. To return to her, click her and choose **Become Maren**.
- **Sessions:** a character you take over stops following its Claude Code session, which keeps
  running. When you let go, it walks back to whatever the session is doing. If a generic
  Tarnished's session ends while you're them, you return to Maren.
- **The Twofold:** if you're them at dusk or dawn, you can't move while they change form.
- **Nobody walks through anybody** (`client/js/crowd.js`, tuned in `CROWD` in
  `client/js/config.js`). Every character, you included, stands on a solid circle: in the open,
  at the Hold and in a fight. A great enemy's circle is larger. Only the Noble Sorcerers'
  spectres float through everyone.
  - **You shove.** Walk into someone and they're pushed aside, out of your way. You slow down more
    the heavier they are (each hero has a weight). Nobody can push a great enemy.
  - **A push never stops anyone.** Someone walking somewhere is slowed or nudged, then carries on.
    Someone pushed off their seat or their place at a station steps back once it's free. A push
    never sends anyone into a wall, off a ledge or off the walkable ground.
  - **NPCs never push you; they go round you.** They steer around anyone in their way, judging
    where others are heading as well as where they stand. Two meeting head on both keep to their
    right, unless a wall or a table is on that side: then they go round the other way.
  - **Held up for about 1.5 seconds,** an NPC plans a new path around the blocker. If two block
    each other in a narrow way, one gives way: it backs off and steps aside, then goes on.
  - **Getting nowhere for 6 seconds** (wedged somewhere, however it tries), an NPC travels the rest
    of the way by grace; a step from where it's going, it simply stops there.
  - **In a fight,** fighters keep some room between one another and you.

Every time the world loads, the hand-drawn heroes are already seated at the Round Table in
Roundtable Hold, before any island exists, and Maren rises from grace beside them. Each Claude Code
session takes up the next free hero (the eldest session first). Then the islands rise from the mist
one after another, 10 seconds apart, and as each one rises its hero gets up and walks home across the bridges (no
travelling by grace), taking up whatever the session is doing on arrival. When a session ends, its
hero walks back to the Round Table to wait for the next one.

While a great enemy is abroad, from the moment it's announced until the fight is over, the Lands
Between hold still (`worldPaused` in `client/js/director.js`):

- No island rises (so no new flag goes up in the Hold) and none sinks. An island already rising or
  sinking when the enemy came finishes doing so.
- No session's banner shows (see the fight's banners, below).
- In the public demo, no session starts or ends.

Islands whose sessions arrive meanwhile wait under the mist. Once the fight is over, their heroes
wait for them at the Round Table, and the islands rise three seconds later, one after another at
the usual pace. The world takes up again as soon as the fight is over, not when the arena has
sunk: lingering on the arena afterwards holds nothing up.

Nobody is ever sent to an island that isn't standing. A hero whose island is still under the mist,
or sinking back into it, waits at the Round Table instead and sets out once it has risen. That
holds whatever sends them: the end of a fight, letting go of them, or their session moving to
another project. A new island never takes a place beyond one that is sinking, whose bridge it would
need. An island sinking (or sunk) that a session comes back to rises again.

Only the hand-drawn characters ever appear, each hero once. When every hero is already out on a
quest, a **spectre** is called up for the new session instead (see below). (Should the spectre's art
fail to load, the session waits, unseen, until a hero comes free.)

The project is the session's project root: Claude Code's project folder, or the nearest folder
with `.git` / `package.json` above wherever the session is working.

No two islands standing at once share a design (biome). A new island takes its project's own
design, the one it had before, kept across reloads, if no other island has it. Otherwise it takes
the free design that appeared longest ago (or never yet). With all six standing, it takes the one
that appeared longest ago (`pickBiome` in `client/js/world.js`).

## Heroes

Hand-drawn characters replace the procedural look. The Stormbound Knight is Maren (you); the
other heroes live at Roundtable Hold and each takes up one session at a time (see above). There is no procedural sorcerer: Vael is the sorcerer.

- **The Stormbound Knight** — `client/assets/hero/knight.json` (+ `knight-kneel.json`), rigged in
  `client/js/heroes/knight.js`. Her Red Storm pose (`knight-ult.json`) and her spear thrust
  (`knight-attack.json`, three frames) are drawn whole.
- **Fortuna, the Four-armed Beauty** — `fortuna.json` (+ `fortuna-kneel.json`), rigged in
  `client/js/heroes/fortuna.js` (frost blade, floating orb, dripping ice; finer pixels than the knight).
  Her Frostfall pose (`fortuna-ult.json`), her blade (`fortuna-attack.json`) and her frost cast
  (`fortuna-spell.json`) are drawn whole.
- **The Ronin of the Iron Kasa** — `ronin.json` (+ `ronin-kneel.json`), rigged in
  `client/js/heroes/ronin.js` (curved blade with a slash trail and a running glint, walking legs).
- **Vael, the Crimson Weaver** — `bloodbender.json` (+ `bloodbender-kneel.json`), rigged in
  `client/js/heroes/bloodbender.js` (blood magic that spins round the fist and lashes like a whip).
  His Crimson Mire pose (`bloodbender-ult.json`) and his cast (`bloodbender-attack.json`) are
  drawn whole.
- **The Rune Lord, of the Golden Rune** — `runelord.json` (+ `runelord-kneel.json`), rigged in
  `client/js/heroes/runelord.js` (the staff's orb kindles, golden runes wheel round it, and a
  blow of the staff sends a ring of runes across the ground). His Flight of Tomes pose
  (`runelord-ult.json`) and his staff cast (`runelord-attack.json`) are drawn whole; his palette
  has no light of its own, so the orb drawn on the staff is kindled as his rig's orb is (`drawn`:
  a rig may touch up its drawn poses, `client/js/heroes/core.js`).
- **Aurelion, the Radiant Oath** (Holy Knight) — `paladin.json` (+ `paladin-kneel.json`), rigged in
  `client/js/heroes/paladin.js` (the sword leaves a radiant arc, light bursts from the raised blade,
  and a pillar of light falls on it; kneeling, he prays under a beam of light). His swing
  (`paladin-attack.json`: raised, cut down in front, carried on low behind), his Radiant Verdict
  (`paladin-ult.json`: the giant blade of light raised back over his shoulder, then swept low ahead
  of him, swung by the giant of his light behind him) and the pose he strikes meanwhile
  (`paladin-pose.json`: his sword held out low, pointing at the enemy) are drawn whole, in his
  `bigFrame`; the giant blade glows steadily.
- **The Bandit Knight, of the Broken Road** — `bandit.json` (+ `bandit-kneel.json`, his resting
  squat, used exactly as drawn), rigged in `client/js/heroes/bandit.js` (no sorcery: the spear sweeps
  over his head and lunges with a trail, and the tower shield comes up to guard). His lunge
  (`bandit-attack.json`: the spear cocked over his head, thrust out past the shield, drawn back
  upright) and his Tenfold Spears (`bandit-ult.json`: the spear cocked back like a javelin, then
  thrown, his hand open) are drawn whole, in his `bigFrame`.
- **The Twofold:** one god with two forms and two names, which change with day and night. This is
  one hero, not two.
  - **Ruadan, the Red Hammer** (by night) — `champion.json`, with the hammer as its own part
    (`champion-hammer.json`, on the same grid) and `champion-kneel.json`. Rigged in
    `client/js/heroes/champion.js`: the fractured hammer turns about his fist, swings up over his
    shoulder and lands in a burst of gold that cracks along the ground, and the cracks in his
    stone glow.
  - **Solenne, the Eternal Queen** (by day) — `queen.json` (+ `queen-kneel.json`). Rigged in
    `client/js/heroes/queen.js`: a ring of holy light turns about one hand, rises and sheds motes
    of light, and lances out as a beam that bursts at its end. Only the ring glows; the crown,
    bracelets and embroidery stay gold. She walks as Aurelion does, her legs striding and lifting
    under the gown (only its panels sway). Her cast (`queen-attack.json`: the ring raised, thrust
    out as the lance leaves it, the arm back) and her Wall of Dawn (`queen-ult.json`: wound up,
    then loosed) are drawn whole, the ring's gold in them glowing as her ring does. The Wall's two
    are wider than her frame, so they're kept in her `bigFrame`.
  - **The change:** halfway through dusk and dawn, golden light gathers and the drawing of the
    change itself (`champion-to-queen.json` at dawn, `queen-to-champion.json` at dusk;
    `client/js/heroes/twofold.js`) holds for a moment. Then the other form bursts out under its
    own name, and the log tells it.
- **Corisande, the Glintstone Witch** (Sorceress): one hero with two looks, rigged in
  `client/js/heroes/sorceress.js`. Her sorcery is glintstone: the staff's crystal kindles
  blue-white, motes wheel round it, stars rise from it, and a thrust of the staff looses a
  glintstone pebble that streaks away and shatters. The staff's crystal glows strongly; the mask's
  crystals glow too, but only faintly.
  - **Bare-faced**, the mask under her arm: `sorceress.json` (+ `sorceress-kneel.json`).
  - **Masked**: `sorceress-masked.json` (+ `sorceress-masked-kneel.json`). She fights masked, so
    her Glintstone Arrow pose (`sorceress-masked-ult.json`) and her staff thrust
    (`sorceress-masked-attack.json`: drawn back, thrust out crystal first, upright again) are drawn
    for this look only, each set by her mask's crown, the crystal on the staff kindled as her own
    is and motes wheeling round it. They reach far ahead of her and behind, so they're kept in
    frames of their own (`bigFrame`, below).
  - **The mask:** she puts it on to work her sorcery (once she's at her station, or channelling)
    and to fight. She takes it off once she has been idle 12 seconds, and changes no more often
    than every 6 seconds. Between the looks, glintstone light gathers and she holds the mask up over
    her head, her staff standing by itself beside her (`sorceress-veil.json`). It takes under two
    seconds and isn't logged. While thou art her, she leaves the mask as it is, except that she
    puts it on as thou goest into battle.
  - Her drawings keep all their detail: they're sampled at twice the density of their drawn pixels,
    so the finest touches (the light in her eyes) survive. Her grids are about twice the size of the
    other heroes', and her scale is half theirs, so she stands as tall as them.
  - She speaks as a scholar cast out of her academy: formal, condescending, calling everyone
    "pupil".

- **The spectres of the Noble Sorcerers** — `spectre.json`, rigged in `client/js/heroes/spectre.js`,
  coloured in `client/js/spectres.js`. Not heroes: they're called up only when every hero is busy,
  one per extra session.
  - They appear at their island's Site of Grace in blue sparkles once the island has risen, work
    its stations, and fade away in blue sparkles when their session ends.
  - They never walk: idle and moving are a float, rising and sinking, the cloak's tatters and the
    legs stirring beneath them, and they leave a fading spectral trail of themselves as they glide.
    Their work is done with the staff: struck down at the forge, tilted forward for sorcery, the
    crystal and the circlet's gems glowing.
  - Each one about at once has its own colour: the first blue, then purple, green, red, gold, teal,
    pink, orange, indigo and lime (the drawing's blues turned; the gold stays gold).
  - They can't be taken over, carried or struck, never talk, answer emotes, visit the Hold or join a
    fight. Clicking one only shows who it is.

Each hero's art is a standing pose and a kneeling pose, stored as palette-indexed pixel grids. The
rig cuts the standing pose into parts (cape, legs, body, head, hand, weapon) and composes every
animation frame by moving parts on whole pixels, rotating the weapon RotSprite-style and making its
magic flicker. Kneeling, resting, praying and collapsing use the kneeling drawing, which breathes,
bows its head and sways its cape. Fight poses can be drawn whole too: an ultimate's pose, or the
three frames of a blow (`<id>-ult.json`, `<id>-attack.json`, listed in the rig's `extraArt`). A pose
that names one (`drawn`) is set in the frame as it is, its body's middle on the frame's centre and
its feet on the ground line, and its magic flickers as the rig's own does (`composeDrawn`,
`client/js/heroes/core.js`). The frame grows to hold them (Maren's raised spear). A pose much wider
than the rest (Corisande's staff held level far out ahead) goes in the rig's `bigFrame` instead
(`big: true`), with the character's middle on its `anchor` column: those frames are kept in a sheet
of their own, so the rest stay small, and the drawing grows to that frame while it's shown, its
middle where the character stands. `npm run heroes` exports each hero as `<id>-sheet.png` +
`<id>-sheet.json` (grid and animations; with a big sheet, `<id>-big-sheet.png` too, and the poses
on it: `big.poses`), a glow map, and an animated GIF per animation in `client/assets/hero/`. Preview
them at <http://127.0.0.1:7777/dev/hero.html?hero=ronin>.

To turn new sprite images into art grids (no npm packages needed):

```
powershell -ExecutionPolicy Bypass -File scripts/decode-image.ps1 stand.webp .elden/stand.bgra
node scripts/extract-hero.mjs --name "Name" --colors 40 .elden/stand.bgra:1254x1254:client/assets/hero/name.json
```

The extractor finds the art's pixel grid, drops the background and reduces the colours (up to 91);
give it several images to share one palette, `--palette existing.json` to match an existing hero's
colours, or `:pitch=px,py` after an input when the art is soft and the grid needs setting by hand.
An image with its own transparent background keeps every opaque pixel. Without one, the background
is flooded in from the edges by colour. Art whose drawn pixels vary in size (AI-made sprites often
draw fine details at half a pixel) keeps those details when sampled at half its pitch. That makes
the grid twice as large, so the rig halves its scale (`px`) to match. A pitch under 2 px still
reads every cell (at least the pixel at its middle).

Image generators drift from a hero's colours (gold comes back yellow, wine red comes back bright
red, a navy robe royal blue), so put a new pose back on its hero's palette before extracting it:

```
node scripts/recolor-sprite.mjs art-in/ult-aurelion-1-raise.png paladin
```

Each material (outline, greys, reds, golds, blues…) takes the tonal range of the hero's master sprite
and the nearest colours of the hero's palette, matched in CIELAB. A flat white or black fallback
background becomes transparent, and so does a painted grey-and-white checkerboard, enclosed pockets
of it included. The result is written next to the input as `…-recoloured.png`.

A weapon drifts on its own (Corisande's staff came back orange while her gold trim barely moved), so
pass its cut-out, the weapon alone at the master's size, as the art prompts attach it:

```
node scripts/recolor-sprite.mjs art-in/ult-corisande.png sorceress-masked --weapon "character references/weapons/corisande-staff.png"
```

The weapon is found where the cut-out's colours dominate and matched against the cut-out alone. New
light with no counterpart in the master, such as Aurelion's giant blade, goes in a
`--light x1,y1,x2,y2,r` band (a segment and a radius in the image's pixels): it keeps its own
brightness on the palette's brightest colours. The hero is the art grid's name: `knight` (Maren),
`fortuna`, `ronin` (Wynn), `bloodbender` (Vael), `runelord` (Jorvik), `paladin` (Aurelion), `bandit`
(Ulric), `champion` (Ruadan), `queen` (Solenne) or `sorceress-masked` (Corisande). Any other art grid
goes by its path, its master art beside it, e.g. Fenrath's `client/assets/boss/boss.json`.

Art that isn't a hero's (a training dummy, a prop) keeps its own colours. Only its fallback
background goes, found as above (`scripts/image-io.mjs` holds what the two tools share):

```
node scripts/clear-background.mjs art-in/dummy-stand.png
```

The result is written next to the input as `…-clear.png`. When the outline is drawn nearly black on
a black background, lower `--dark` (24 by default) so that the outline stays.

### Fire

The braziers and the candles on the round table in Roundtable Hold burn with pixel-art fire from
two sprite sheets (`client/assets/fx/`, rigged in `client/js/fire.js`). So does every island: a
candle flame on the scriptorium's candles and the war table's, two fires in the forge's dark
mouth (fiercer while someone works it), and a smaller brazier fire on each torch by the fog gate.

- **Braziers:** the sheet's frames grow tall and then collapse rather than loop, so each brazier is
  rigged from one of its cleanest frames instead, each from a different frame, every other one
  mirrored.
  - The flame sways in a wave that climbs it, and stretches and settles above its glowing bed.
  - Both sides swell and draw in, each on its own, with licks running up them.
  - Heat shimmers up through it, the tips lick, and sparks break off and rise.
  - Each brazier's light rises and falls with its flame.
- **Candles:** the sheet's own frames, put on one baseline and played in the order that changes
  least from frame to frame. Its one bent frame is left out, since it jumps out of the loop. A
  black wick rises from the wax into the bottom of each flame.

Preview the loops at <http://127.0.0.1:7777/dev/fire.html>. `npm run heroes` also writes them as
GIFs to `client/assets/fx/`. To turn a sheet of frames into an animation file:

```
powershell -ExecutionPolicy Bypass -File scripts/decode-image.ps1 sheet.webp .elden/sheet.bgra
node scripts/split-sheet.mjs .elden/sheet.bgra 2000x667 .elden/frames/fire
node scripts/extract-hero.mjs --name "Fire" --colors 9 .elden/frames/fire-1.bgra:169x313:.elden/frames/fire-1.json …
node scripts/pack-frames.mjs client/assets/fx/fire.json "Fire" "source note" .elden/frames/fire-1.json .elden/frames/fire-2.json …
```

Extract all of a sheet's frames in one run so they share a palette, and pack them in frame order.

The fight art (an ultimate's pose, a blow's frames, its effects) comes as images of their own in
`art-in/` (see `art-prompts.md` for what each holds). A pose goes back on its hero's palette, at
the size that matches the hero's standing pose: pass `:pitch=px,py` when the drawing's pixels are
finer or softer than the master's. A sheet laid out in a grid (a blow's three frames in a 2 x 2
grid, an effect's frames in a row) is split by its cells:

```
node scripts/split-sheet.mjs .elden/atk.bgra 1536x1024 .elden/frames/atk --grid 2x2
node scripts/extract-hero.mjs --name "Name, thrust" --palette client/assets/hero/knight.json --keep .elden/frames/atk-1.bgra:880x624:.elden/frames/atk-1.json:pitch=5.2,5.2 …
node scripts/pack-frames.mjs client/assets/hero/knight-attack.json "Name, thrust" "source note" .elden/frames/atk-1.json …
```

With `--grid`, each figure stays with the cell that holds most of it (a cape or a spear point that
strays over a cell's edge comes along), and every frame comes out the size of a cell plus the same
margin, at the same place relative to its cell. Add `--near` when a figure flings loose bits into
the next cell (Vael's spray of blood): each loose bit then goes with the figure nearest to it.
Leave it off for frames made only of scattered bits, or whose bits trail behind them toward the
previous cell (Vael's orb). `--keep` keeps each grid whole, and frames given
one pitch come out the same size and in register; `pack-frames.mjs` then cuts them down together
to the area any of them uses. Effects are packed the same way with their own colours (`--colors`)
into `client/assets/fx/` and loaded by `client/js/fxart.js`; an effect whose art is missing draws
itself as before. Name a dump after its image (`atk-maren.png.bgra`) and the art's notes say so.

## Great enemies

Boss fights happen in the **Arena of Trials**, a wide ring of broken pillars (radius 19). It rises
from the mist north of Roundtable Hold once you call for the fight, and stands higher than the
Hold: a stone stair climbs to it from the Hold's rim. It sinks again only once the fight is over
and everyone has left it, you included (`client/js/fight.js`, `client/js/arena.js`). Everything
loosed on it is placed from its floor, as on the Hold (a group raised to its height, `ARENA.y`).

- **What brings one:**
  - **Summoned:** at the Round Table (**E**).
  - **Invasions:** by itself every 20–40 minutes.
  - However it comes, you choose your companions first (below).
  - **A struggling session:** three failed tool calls within two minutes, a session ending in
    failure, or a single quest running past ten minutes.

  After a fight, nothing but a summons brings another for six minutes.
- **Choose your companions** (`client/js/companions.js`): however one comes, a window opens first.
  - It names who is coming and why ("Fenrath, the Crimson Fang · Summoned at the Round Table"), over
    four tall slots, each a **+**.
  - **+** opens the catalogue of heroes. Each card shows its portrait (from the hero's own art), class
    and style, how it fights, its ultimate, its manner, and where it is now. One already chosen is
    greyed out. The one you're playing isn't there: you always fight.
  - A chosen hero stands in its slot, large, idling (its own idle animation), and stands out of it:
    drawn over the frame, feet just above its name, head (hat, crown, staff) and blade reaching past
    the edges. Every hero is as tall as the others, by their height in the world. Clicking them
    changes them, and **Empty slot** under it frees the slot.
  - **Add slot** adds another, up to as many as there are heroes to take.
  - **Start fight** works with any number chosen, none included. It raises the arena; the Round
    Table's "Summon a great enemy" only opens this window now.
  - **× or Esc** turns it down: a summons is simply let be; an enemy that came by itself turns
    away. Left unanswered for two and a half minutes, it turns away too.
  - Your last companions are in their slots again the next time.
- **Who fights:** only your companions drop what they're doing and come by grace. Everyone else
  goes on with their work (quietly: the fight still has the log and the screen to itself). Their
  sessions keep running, and they go back to them by grace afterwards. You fight too, as whoever
  you are.
- **From afar or up close** (`client/js/combat.js`, effects in `client/js/spellfx.js`):
  - **Mages** keep 6.5–9.5 units off the enemy, circle slowly, and cast. A spell is safer than a
    blade but does less (yours 22, a blade blow 55; a companion's 7, its blow 16), and Fenrath goes
    after whoever keeps wounding him from afar. Each has a few spells in its own light:
    - Jorvik (the Rune Lord): a spinning golden rune, a volley of three that fan out and curve back
      in, or a circle of runes under the enemy that bursts into a pillar of gold, all drawn
      (`jorvik-runes.json`, four designs; `jorvik-circle.json`; `jorvik-pillar.json`).
    - Corisande: a glintstone pebble, a spray of three shards, or now and then a great shard, all
      drawn at her pixel size (`corisande-pebble.json`, flickering; `corisande-shards.json`, three
      designs; `corisande-great-shard.json`, which keeps upright as it flies). They leave from the
      crystal as her thrust drives it out (the rig's `muzzles`).
    - Vael: a gout of blood, blood spikes out of the floor, or a lash of blood that reaches the enemy
      at once, all drawn (`vael-orb.json`, `vael-spikes.json`, `vael-lash.json`; the lash stretched
      evenly from his palm to wherever it strikes).
    - Solenne: a lance of holy light, a spinning halo, or light falling on the enemy, all drawn
      (`solenne-lance.json`, its drawing repeated along its length, flickering and flowing on;
      `solenne-halo.json`, turning and keeping level as it flies; `solenne-light.json`, falling,
      striking and fading). The lance and the halo leave from her ring as her cast thrusts it out.
  - **Up close:** Ruadan, Maren, Aurelion, Wynn and Ulric. Ulric still hides; his style only
    matters when you play him.
  - **Fortuna** does both, switching between her frost blade and frost cast from afar (a shard, or
    ice out of the floor), both drawn (`fortuna-shard.json`, `fortuna-spikes.json`) at her own
    pixel size.
  - **Playing them:** as a mage, a left click casts toward the pointer. The spell homes on the
    enemy if he's within about 35° of where you point; otherwise it flies off into nothing. As
    Fortuna, left click swings her blade and right click casts.
  - **Blows:** a hero with a drawn blow plays it, three frames landing on the second, each held as
    long as suits it (Maren's lunge a third of a second; Fortuna's slash a ninth, her follow-through
    lingering); the others swing their rig's strike. As a drawn blow lands (Maren's, Fortuna's,
    Vael's, Jorvik's, Corisande's, Solenne's, Aurelion's, Ulric's), the drawing (not where they
    stand, nor their shadow) is thrown forward a third of a unit in a flash and springs back, a
    little past and settling (`lunge`, `client/js/npc.js`). However quick a drawn blow is, your
    blows come no faster than the old strike's pace (`blowReady`, `client/js/pilot.js`), so the
    enemies' health still fits.
  - **How a hit lands** (`impact` and `IMPACT`, `client/js/fight.js`):
    - Every blow, spell and ultimate that wounds the enemy turns his whole drawing white for a
      blink (never more than three times a second, however many strike him) and knocks it a few
      pixels back, away from the striker, springing back. Only the drawing moves, never where he is.
      The white is pale by night, under what the bloom lights up, so it reads as a silhouette and
      not as a light going off (`spriteFlash`, `client/js/daylight.js`).
    - A blade or a fist that strikes him throws a spark of sharp lines in the striker's own colour,
      pointing the way the blow went (`Spark`, `client/js/spellfx.js`).
    - Your own blows hold the whole world still for a split second (hit-stop: 0.055 s for a blow,
      less for a spell), while he shudders and your drawing stays at full stretch, and they push
      the view a little the way the blow went. The heavy ones (the blow that breaks his stance, an
      ultimate's great blow) hold it twice as long, knock him further and shake the view, whoever
      struck them. Your companions' everyday blows never hold the world still.
    - His health bar keeps what he just lost in white a moment (until half a second after the last
      wound, at most 1.4 seconds), then drains it.
    - A blow the Golem's stone turns does nothing of this: no flash, no hold, a grey spark, and the
      striker's drawing bounces back off him instead of lunging forward.
    - Struck yourself, your drawing flashes white and is knocked back, the world holds a moment and
      the view jolts, on top of the red edges of the screen; a companion struck flashes and is
      knocked back.
  - **Against the Golem,** spells hit his cracked ankle while he stands (counting a little less
    toward felling him than a blow there). While he lies felled they hit the fire in his chest, for
    half what a blow from inside the golden circle does.
- **Ultimates** (`client/js/ults.js`):
  - **The meter:** each fighter's blows fill it, measured against the enemy's health: a fifth of
    it for you (1,600 against Fenrath), a twenty-fifth for the others, so that a fight brings a few
    ultimates, not one every few blows. An ultimate hits about as hard against either enemy, for
    its share of his health. A blow on the Golem's ankle counts in full, though it barely wounds
    him, and against the Golem, whose fight leans on ultimates, meters fill sooner. Your meter is
    under your health; the others' are thin gold lines under theirs.
  - **Loosing one:** you press **R** once your meter is full. The others loose theirs when ready,
    at least 12 seconds apart, never two at once.
  - **The freeze:** the world stops and turns black and white, except whoever looses it. The camera
    closes in (far enough back to show a tall pose whole, Maren's spear raised to the sky), its name
    shows, and an aura of their own light shines round them (a glowing outline, a light behind,
    motes swirling in). Then they strike, and the world moves and colours again,
    about 2.4 seconds in all. If you aren't on the arena (fallen and resting at the Hold), an NPC's
    ult simply fires, with no freeze.
  - **Aimed ones** (Solenne's, Ulric's) go one of four ways: toward the pointer for you, and only
    hit if the enemy stands in that line. The others walk into line first.
  - Jorvik, **Flight of Tomes:** seven golden tomes take wing and dash into him, each spent as it
    strikes. The tomes are drawn (`jorvik-tome.json`), beating their covers, and keep upright as
    they fly.
  - Corisande, **Glintstone Arrow:** a crystal arrow trailing light finds him. The arrow is drawn
    (`corisande-arrow.json`): it's loosed along the staff she aims like a bow, its head at the
    crystal, and keeps upright as it flies.
  - Vael, **Crimson Mire:** a pool of blood under him for 7 seconds. He's slowed to a third, can't
    leave it or leap or roll away, and bleeds until 4 seconds after it dries. The pool is drawn
    (`vael-pool.json`): it spreads, then bubbles.
  - Solenne, **Wall of Dawn** (aimed): a tall curved wall of golden light strikes him once, hard,
    and drives him back. The wall is drawn (`solenne-wall.json`), half again her height: forming
    as it leaves her palms, whole as it flies, fading at the end of its run.
  - Ruadan, **Hammerfall:** he leaps high and lands hammer first at the enemy's feet in a burst of
    gold.
  - Maren, **Red Storm:** red lightning rains around him, ending in one great bolt (drawn bolts,
    `maren-bolt.json` and `maren-great-bolt.json`, at twice her pixel size so they fall from out
    of sight).
  - Aurelion, **Radiant Verdict:** a great slash of light dazes him for 5 seconds, unable to fight
    or move. He strikes his pose and holds it, and a giant of his own light stands behind him, his
    drawing 1.8 times its size, golden and see-through, its feet on his, and swings the Verdict:
    the giant blade of light raised back over its shoulder, then swept low ahead of it (`Stand`,
    `client/js/spellfx.js`, playing frames of his sheet on its own; the camera draws back to take
    it in). The wave is drawn
    (`aurelion-wave.json`): forming as it leaves the blades, full as it flies, stretching as it
    strikes, then fading.
  - Wynn, **Iaijutsu:** after a breath, Wynn cuts through him from every side while he's held still.
    The cuts hang in the air, and nothing lands until Wynn is back where he began, blade sheathed.
    Then it all lands at once.
  - Ulric, **Tenfold Spears** (aimed): ten spears stick in him, poison him for 4 seconds, then fall
    away. The spears are drawn (`ulric-spear.json`): his own spear, at his own pixel size, leaving
    his open hand as he's drawn throwing.
  - Fortuna, **Frostfall:** three great icicles drop on him one after another, each as tall as she
    is, and shatter (`fortuna-icicle.json`, `fortuna-shatter.json`). A beat later a mass of ice
    three times their size, taller than he is, comes down on him, stands driven into the floor a
    moment, shuddering, and bursts wide, shaking the view.
  - **Art:** Maren, Fortuna, Vael, Jorvik, Corisande, Solenne, Aurelion and Ulric hold their
    drawn poses: Maren's spear raised to the sky, its lightning crackling; Fortuna's four arms and
    greatsword raised, the frost flickering; Vael's clawed hand raised, blood streaming up his
    arm; Jorvik's staff thrust high, runes wheeling round its blazing orb; Corisande's staff held
    level like a drawn bow, motes wheeling round its blazing crystal (bare-faced, she raises it as
    she casts); Solenne wound up, the light gathered between her palms, motes drifting up from it;
    Aurelion pointing at the enemy, his sword held out low, while the giant behind him raises its
    blade of light back over its shoulder, a glint running along it; Ulric's spear cocked back
    like a javelin. A pose too wide for the camera's close shot (Corisande's) is centred and taken
    in whole. An ult may be loosed in a drawing of its own (`release`), held a moment as it
    strikes: Solenne's palms thrust out as the wall leaves them; Aurelion's giant sweeping its
    blade low ahead of it; Ulric's hand open as the spears leave it. The others hold their own
    rig's pose (raise, cast, strike, kneel) until their ult drawings replace it.
- **Only the fight:** while a great enemy is abroad, every session works on unseen, the spectres at
  work on their islands included: no log lines about the work, no incantations, signs or gestures,
  no spirit wisps and no small talk. A fighter's signs are put away for the fight (the "!" of one
  that was kneeling at its gate comes back after). Fighters say only their battle lines (taking up
  the charge, falling back, mourning the fallen, the victory). From the moment the enemy is
  announced until it's over, the message log carries only the fight. What the sessions did
  meanwhile is taken up again afterwards.
- **The others' health:** under your own health bar (top left), each fighter's name and health,
  in the order they lined up. The fallen stay greyed out and struck through.
- **The enemy waits for you:** it enters only once you stand on the arena. Until then the others
  wait for you in a curved line just inside the way in. The line follows the arena's round, in two
  wings facing a wide aisle down the middle for you to walk through (`LINE` in
  `client/js/config.js`). The log tells you where to go. If you haven't come after two and a half
  minutes, it turns away and everyone goes home.
- **No way out:** as you step onto the ring, a wall of fog wells up across the way in, between two
  stone posts. Until the fight is over (felled, prevailing or withdrawn), nobody walks back down
  the stair and you can't travel by grace, not even to the Hold. Then the fog thins away.
- **The lights go out:** from the moment it's announced until it's felled, prevails or withdraws,
  every torch, candle, fire and grace in the Lands Between goes out, one after another, except the
  arena's braziers. Flames sink into their beds, the big fires give off a wisp of smoke, and the
  graces fade. They're lit again, one by one, once it's over (`DOUSE` in `client/js/config.js`).
- **The way there:** meanwhile a golden arrow lies on the ground in front of you, pointing along
  the path to the arena (`client/js/guide.js`, `GUIDE` in the config). From an island it points
  along the island and over its bridge; at the Hold it turns north, up the stair. It fades once
  you're on the arena, and comes back if you leave mid-fight. Low things in front of it never hide
  it.
- **How they fight:** each keeps its own ring around the enemy, circling its own way. When ready, one
  rushes in, strikes and falls back. Seeing a blow coming, they mostly sprint out of its way after
  a moment's reaction, though now and then someone is too slow.
  - **The Bandit Knight** (Ulric) never fights (he's Elden Ring's Patches in all but name). He has
    three hiding places: the left and right ends of the arena on its middle line, and its top end
    among the pillars. He keeps to whichever is farthest from the enemy and crouches out of sight
    there. When it comes for him, or after a while when he grows uneasy, he scurries to another,
    around the enemy rather than past it. He dodges everything, and never stops talking. Close to
    the enemy he begs ("Wrong bandit! Wrong bandit!"). Hidden, he mutters ("I'm a rock. A small,
    rusty, handsome rock."). From a safe distance he taunts it. When an ally falls he mourns them
    in his own way ("Rest easy. Dibs on yer purse.").
- **The enemies:** one of two comes, an even chance of either: Fenrath, the Crimson Fang, or the
  Guardian Golem. If one's art fails to load, only the other comes. The Tarnished's battle lines
  fit whichever came (Ulric has his own jokes for each).
- **Fenrath, the Crimson Fang** (`client/js/heroes/boss.js`, effects in `client/js/bossfx.js`).
  He has 8,000 health: about two minutes with four companions. He walks into his target's lane and
  strikes along it. Every blow shows itself before it lands: step out of the way, or dodge through
  it with **Space**.
  - **His target:** whoever is nearest (you a little more than the others), but whoever keeps
    wounding him from afar draws him: the more they've dealt lately, the nearer they seem to him.
    A mage pelting him won't stay out of reach for long.
  - **Swing:** he raises the greatsword and cuts. A crescent of red light flies on down his lane
    for half a second, striking each person it passes once.
  - **Lunge:** he thrusts and slides forward. A lance of red light runs along the blade and well past
    its point.
  - **Slam:** a ring of red light gathers around him for a little over a second. Then it fills with
    light, and everyone inside it is hurt.
  - **Leap:** he leaps when beset (three or more close around him, or heavy damage in five
    seconds) or when he has stayed in one place too long (at most every ten seconds). He crouches
    and trembles for a second, and a danger zone marks where he will land. Then he leaps: his
    shadow runs along the ground beneath him. He lands with a crack in the stone, flying debris and
    a shake of the camera, hurting everyone on the zone. Beset, he lands away from the crowd;
    otherwise he lands next to someone. Wounded again and again from afar by someone more than seven
    units off, he leaps right onto them, a step short.
  - **His great attack (wrath):** about 30 to 40 seconds into the fight, then every 45 to 60, he
    stops and roars at the sky for two seconds (`boss-roar.json`: head thrown back, the sword held
    high), the camera on him. Four shockwaves burst from his head, half a second apart, each
    bending and smearing the picture as it sweeps out across the screen and jolting the camera.
    Behind them the world goes **pitch black**: the arena, its pillars and torches, the sky. The
    darkness spreads out from him slowly at first, then rushes out behind the last shockwave, and
    only Fenrath, the fighters, you and the marks on the floor stay lit (`client/js/post.js`, a
    pass of its own before the bloom: the red light of the marks still glows on the black). Then
    the camera pulls back to show the whole arena, and he leaps up over its
    middle and hangs there facing you (`boss-float.json`: the sword held level over his head).
    Beside him a ghost of his own greatsword, red and see-through (`fenrath-sword.json`: his
    sword's drawing, its colours turned to red light), grows from his sword's length to about 15
    units. The half of the arena on the side it's held over is marked in red for about two
    seconds. Then it cuts down across that half, and everyone still on it suffers (26), unless
    they're dodging through it (Space) or in the air (the fighters who can't get across hop it,
    mostly). It swings over to the other side, and the other half is marked and cut the same way.
    The half with more of his foes on it goes first, you counting double. Then the whole floor
    turns red but for a golden circle round the middle. He comes down into it, and three seconds
    after the first mark the ring erupts: red light tears up out of the floor all over it
    (`fenrath-eruption.json`), rippling out from the circle, and everyone on it suffers (34).
    Only the golden circle by his side is safe. It all takes about eleven seconds. The fighters
    see each mark and run from it (across the middle line, or in to the circle), and a line in
    the log explains each the first time. While he hangs in the air he can't be struck, only
    spelled. A pool of blood holding him keeps him from it. Half a second after the eruption the
    light comes back, spreading out from the middle of the arena (at once if he falls first).
  - Below half health he grows wild, and his blows come quicker.
  - He says little, in red over his head. He has a line as he enters ("Thy death resteth close
    at hand."), and now and then another while he stalks ("Serve my will alone, O blade.", "*heavy
    breathing*"). He gives a grunt on some of his leaps and landings. Left facing nobody but the
    cowering Bandit Knight, he can't believe it: "*looks in disbelief*"… "Coward…".
- **The Guardian Golem** (drawings `client/js/heroes/golem.js`, fight `client/js/golem.js`): a
  giant of black stone, about 8 units tall, with a fire in his ribcage and a double-bladed axe on
  a long pole. He says nothing. His attacks and his fall are the user's frames, used as drawn;
  idle (breathing) and walk are rigged from the idle drawing.
  - **Weak points:** stone turns every blow except those on his **cracked ankle**, low on his back
    leg. Blows elsewhere do nothing (a puff of stone chips), and blows on the ankle do little (12).
    After 15 ankle blows (yours; a fighter's counts for half) the ankle smoulders, and the next
    time he walks it gives way. He **passes out** and falls on his face, and a **golden circle**
    appears on the floor by the fire in his chest. For 6 seconds, blows struck from inside the
    circle deal 110 (a fighter's 22); from anywhere else, nothing. Then he gets up (the fall played
    backwards), the ankle whole again. A line in the log explains each step the first time.
  - **Turning:** he's slow to change his mind. He keeps to one foe for a few seconds, turns round
    only once it has stayed behind him a moment (never twice within a second and a half), and his
    swing and lunge go only where he faces. Getting at his ankle, on his back leg, means getting
    round him between turns.
  - **Shockwaves:** what hurts most is what his blows shake loose. Where the axe or the pole
    strikes, the stone floor itself ripples like still water with a stone dropped in it: a
    ring-shaped crest rolls outward, two lower ones following with troughs between, the tiles
    bending over them, dust thrown up along the leading crest, the whole ripple flattening as it
    spreads. Everyone standing on it rises and sinks as it passes under them. Its first crest is
    what hurts: dodge through it (Space) as it reaches you. The fighters hop it, mostly. Each
    meteor of the fire spit makes a small ripple too, which hurts no one. (`client/js/ripple.js`:
    the ripple, the same formula bending the floor on the graphics card and lifting the
    characters; its sizes are in the `GOLEM` table.)
  - **Swing:** he raises the axe behind him and brings it over and down. Where it lands (marked
    beforehand) the stone cracks and a shockwave rolls out 8 units.
  - **Lunge:** he drives the axe out at full stretch. His size gives it a reach of about 12
    units, and a shock in the air flies on past its point.
  - **Slam:** he raises the pole high and holds it for two seconds, drives it into the ground
    twice, fast, holds again for a second and drives it down a last time. Three shockwaves, the
    last over the whole arena. Then he settles.
  - **Fire spit:** it begins exactly like the slam, but the pole goes into the ground and stays
    there, planted, with a crack at its foot, while he lets go of it. He shakes for two seconds,
    then spits fire from his chest for five while meteors fall all over the arena, each marked
    on the floor before it lands. Nothing hurts him meanwhile. Then he settles and takes his axe
    back.
  - **Roll:** hemmed in (three or more foes within 5 units) he slams, but not again within 15
    seconds of the last slam. Hemmed in again sooner, he rolls out of the crowd instead (at most
    every 8 seconds): a somersault over his axe, the user's seven drawings (standing, bending
    with his hands to the ground, rolling over, curled up, pushing up with the axe planted, on
    his knees leaning on it, standing; about 0.86 s), carrying him about 6.5 units into the most
    open ground, across the arena rather than up or down it. Blows pass over him meanwhile. Then
    he turns back on them with his swing, lunge or fire. Not yet able to roll again, he uses those
    rather than slamming again.
  - Tuning (health, damage, how many ankle blows, the circle, the shockwaves, how often each
    attack comes) is the `GOLEM` table in `client/js/golem.js`. His size is `px` in
    `client/js/heroes/golem.js`.
- **The fight:**
  - Enough damage in quick succession breaks his stance: he reels and takes more from every blow.
  - As you step in and he enters, the camera shows him for a few seconds, then comes back to
    you. A large floating hint in the middle of the lower half of the screen says **Press Q to
    focus on the boss**. Q, or a click on the hint, turns the camera's focus on him (you and him
    both in view, pulled back to keep his height), and Q again gives it back to you. Once you've
    used it, the hint isn't shown again. The camera stays a little further back than usual all
    fight, and returns to your own zoom when it's over (`BOSS_CAM` in `client/js/config.js`).
  - Every click is a strike: nobody can be clicked, inspected or carried off until the fight is
    over.
  - The sessions' banners across the screen (a region rising, a quest fulfilled or failed, an
    incantation) don't show while a great enemy is abroad, and aren't kept for after it. Only the
    fight's own banners do, and one of those never waits behind a session's: it cuts it short. The
    message log still lists everything.
  - A session that drew the enemy wounds it badly by fulfilling its next quest.
- **Falling:**
  - A Tarnished who falls is out for good. It lies where it fell for a moment, then goes by grace
    to Roundtable Hold and rests at the grace until the fight is over.
  - When you fall, you see "YOU DIED", and the character you were is out too: it goes to rest at
    the Hold like the others. A panel then lists the fighters still standing (with their health);
    choose one to carry on the fight as them.
  - Outside a fight, or once it's over, you rise at the Hold's grace instead (resting at a grace
    heals you).
- **Outcomes:**
  - **Won:** "GREAT ENEMY FELLED".
  - **Lost:** when nobody is left standing on the arena (you fall with no fighter left to carry
    on as, or every fighter has fallen while you're away), "THE GREAT ENEMY PREVAILS" and he fades
    into red mist.
  - **Withdrawn:** he leaves on his own after eight minutes.

  Nothing here ever reaches Claude Code.
- If neither enemy's art loads, no great enemy comes at all.

## Day and night

Day and night take turns over the Lands Between, 18 minutes each, the last 2 minutes of each a
slow dusk or dawn into the other (all in `client/js/daylight.js`).

- **Night:** the world as it was first made: moonlight, stars, dark mist below the islands,
  lamplit braziers and torches.
- **Day:** bright like Octopath Traveler's dioramas.
  - A blue sky with drifting clouds and white clouds below the islands.
  - A warm sun throwing crisp shadows, and fuller colour.
  - Clear air, and the far spires lost in the haze.
  - Lamps that matter less.
  - On the Frostbound Heights, the snow is toned down and cooled so it keeps its texture instead
    of burning out to white.
  - The characters take the sun more gently, with their magic glowing less, so they don't look
    washed out. At night they're unchanged.
- **Dusk and dawn:** the light turns orange and the horizon glows halfway through the change.
  The message log announces each as it begins. Halfway through, the Twofold changes form.

The hour comes from the real clock, so every tab and every reload agree on it. Add `?time=day` or
`?time=night` to the address to hold one, or `?time=fast` to watch a whole day pass in two minutes.

## How they talk

Every line anyone says starts from a **base line** ("I'm tired…", "Going to work!", "Good luck,
{name}!") and comes out in the speaker's own voice. All of it lives in `client/js/voices.js`:
`BASE` lists the base lines plainly, and each voice gives its own versions of them (pick any
line, add variants, add a voice). Where a voice has no version of a line, it uses the common
Tarnished's courtly old speech.

| Base line | Vael | The Bandit Knight | Ysolde |
|---|---|---|---|
| Ah, I'm tired… | I can feel my blood slowing down… | I'm too spent to keep the robbin' goin'… | *sighs* |
| Going to work! | Work calls. My blood quickens. | Off I go… | *rises without a word* |
| Good luck, {name}! | Be careful not to nick thyself, {name}. I might get thirsty. | Bring back somethin' shiny, {name}! | …Return. |

- **Voices:** Fortuna is cold and vain, the Ronin terse, the Rune Lord pompous, Aurelion
  solemn and kind, Vael courteous and bloodthirsty, the Bandit Knight greedy and crude.
  A hero with no voice of its own would speak the common Tarnished's, and one named **Ysolde** would
  be mysterious and barely speak (`BY_NAME` in `voices.js`). Maren is a storm knight, warm, brave and wry, heard
  whenever you're someone else. The Twofold, in either form, answers everything with "…".
- **Conversations** between idle Tarnished follow a topic: a greeting and news, weariness,
  hunger, boredom, a musing, a compliment, a challenge to a duel. The two take turns, and each
  reply names whoever spoke first. The chattier one tends to open, a terse one may cut it
  short, and a silent one gets teased for it. The news they trade is their session's real
  tally: files edited, scrolls read, commands run.
- **When something happens:**
  - Heroes leaving the Round Table say so, and someone still seated wishes them luck.
  - Coming home, they're welcomed back.
  - A finished quest may be praised, and a fallen Tarnished gets help.
  - A struck Tarnished tells Maren off.
  - Maren's gestures get answers in kind, and walking up to someone idle may get her a greeting.

## Run it

```bash
npm install
npm start                 # http://127.0.0.1:7777
npm run hooks:install     # once: tell Claude Code to report to the world
```

Then open <http://127.0.0.1:7777> and set out from the title screen. New Claude Code sessions
(CLI or the desktop app's Code tab) appear while the bridge is running. **Summon phantoms** (top
right, once you're in) fills the world with fake sessions if you just want to watch (`?demo` in the
address does it as you set out); `npm run simulate` pushes fake sessions through the real hook.
The raw event stream is at <http://127.0.0.1:7777/debug>.

**Performance.** The 3D view is drawn into at most ~1.6 megapixels and stretched over the
window, so big or high-DPI screens cost no more than a 1080p one. If frames still run slow,
quality steps down by itself (multisampling first, then resolution) and steps back up when
there's headroom. Press **P** for the frame rate, resolution and GPU in use; `?quality=full`
forces full resolution with multisampling. If it's still slow in one browser but not another,
check that browser's hardware acceleration is on (P warns when it isn't) and that an energy- or
battery-saver mode isn't capping its frame rate.

Remove the hooks any time with `npm run hooks:uninstall` (a timestamped backup of
`~/.claude/settings.json` is written every time either command runs).

## Public demo (Vercel)

A version anyone can open, with no bridge and no real data: an endless world of made-up sessions.

- **What it does:**
  - Sessions in realistic-sounding projects (`checkout-service`, `ios-app`, `infra-terraform`…) start
    and end on their own, three at the quietest and, at the busiest, a few more than there are
    heroes (spectres are called up for those).
  - They work in believable runs: exploring, implementing and running tests, debugging, reading
    the web, planning with subagents, shipping through MCP tools. Slash commands, permission waits,
    model switches and compactions come up now and then.
  - New projects rise as islands, one at a time: the first 5 seconds after you appear, then at
    least a minute apart, time to look round each before the next. An island nobody has worked on
    for 45 seconds sinks back into the mist, if it's the outermost on its side (the others hold up
    a bridge). Islands sink one at a time, at least 20 seconds apart, so the world never shrinks
    all at once.
  - While a great enemy is abroad no session starts or ends. A session whose time comes meanwhile
    ends a little while after the fight, each at its own moment.
  - At most one banner about the sessions (a slash command, a quest fulfilled) shows in 40
    seconds; the rest go to the message log only. An island rising always gets its banner.
  - Great enemies come oftener: the first after about two minutes, then every 5 to 9 minutes, at
    full strength. A run of failing tool calls or a session ending in failure can bring one too. As
    locally, the window choosing companions opens first (left unanswered, the enemy turns away), and
    it enters only once you reach the arena.
  - Everything else works as locally: become anyone, fight, the Round Table. There is no
    **Summon phantoms** or event log: the page is marked as the demo's from its first moment
    (`scripts/build-public.mjs`), before any script runs.
  - The world (its sessions, the first great enemy's countdown) starts as you set out from the
    title screen, not while it stands.
- **How it's built:** `client/js/mode.js` says which world the page shows. `npm run build:public`
  copies the game to `dist/elden-code-demo` with that switch set to the public demo, plus only what
  the page loads (the art grids, the parts of Three.js it imports, the two fonts) and a
  `vercel.json` with the same security headers the bridge sends. No server code, hooks or token.
- **Try it locally:** `npm run build:public`, then `npm run preview:public` and open
  <http://127.0.0.1:7788>.
- **Deploy from GitHub (simplest):** in Vercel, *Add New → Project* and import this repository.
  Everything it needs is in `vercel.json` (install, `npm run build:public`, the output folder, the
  headers), so leave the settings as they are and deploy. Every push to `main` then redeploys it.
- **Or deploy from your machine:** once, `npx vercel login`; then `npm run deploy:public` builds and
  deploys it to your Vercel account as the project `elden-code-demo`. Run it again to update.

## Cost

Nothing. The world never calls Claude or any API; it only listens to hook events. Idle
chatter is written in advance (client/js/voices.js) and filled in from each session's real stats.

## Security model

- **Local only.** The bridge listens on `127.0.0.1` and rejects requests whose `Host` isn't
  `127.0.0.1`/`localhost` (blocks DNS-rebinding pages).
- **Minimal data.** `hooks/emit.js` forwards only: event name, a hashed session id, the
  project folder name, tool name, slash-command name, and a few enums. Prompts, commands,
  file paths, file contents and Claude's messages never leave the hook. The bridge re-validates
  everything against an allowlist (`server/events.js`).
- **Write path is token-protected.** `POST /event` needs the random token in `.elden/token`
  and a JSON content type, so other websites can't inject events.
- **Read-only game.** The page receives a one-way Server-Sent Events stream. Gestures and
  dragging are purely cosmetic; nothing can be sent back to Claude Code.
- **Hooks can't interfere.** They run with `async: true`, print nothing, and always exit 0.
- Strict Content-Security-Policy; all text from the stream is rendered with `textContent`.

To let someone else watch, put it behind something private like Tailscale. Don't port-forward it.

## Layout

```
hooks/emit.js           the Claude Code hook (sanitises and forwards)
server/bridge.js        localhost HTTP + SSE server, static files
server/events.js        allowlist validation
server/registry.js      per-session state for late joiners
scripts/                install/uninstall hooks, simulator
client/js/title.js      the title screen: the pixel-art wordmark, sigil and embers, the way in, loading
client/js/gate.js       where the title and the world meet: set out, and ready
client/js/sprites.js    procedural pixel-art characters (base body + equipment layers)
client/js/world.js      sky, far skyline, mist, islands, bridges, pooled lights
client/js/daylight.js   day and night: the clock, and how every light, colour and the grade change
client/js/region.js     one project's island and its stations
client/js/hub.js        Roundtable Hold
client/js/fire.js       the braziers' and candles' pixel-art fire, rigged from the user's sheets
client/js/biomes.js     biome palettes, decor and particles
client/js/build.js      island building helpers (local coords, merged static meshes)
client/js/npc.js        a character: animation, pathing, emotes, dragging, spirits
client/js/pilot.js      thee: whoever the player is (Maren, or anyone become), walked with the keyboard
client/js/crowd.js      characters are solid: parting overlaps by weight, shoving, steering round others
client/js/guide.js      the golden arrow on the ground that shows the way to the arena in a fight
client/js/grace.js      the grace itself, the figure of golden light floating over every Site of Grace
client/js/interact.js   E: using the stations and the Round Table
client/js/arena.js      the Arena of Trials, north of the Hold and higher, and the stone stair up to it
client/js/yard.js       the Training Yard below the Hold, and the stone stair down to it
client/js/training.js   the yard's straw dummies, and thy blows, spells and ultimates on them
client/js/ground.js     the ground's height where it isn't level with the Hold (the yard, the arena, their stairs)
client/js/fight.js      great enemies: what brings them, Fenrath's attacks, the fighters, thy health
client/js/companions.js choosing thy companions as one comes: the slots, the catalogue of heroes
client/js/golem.js      the Guardian Golem's fight: his weak points, his fall, shockwaves, fire
client/js/ripple.js     the arena floor rippling like water under the Golem's shockwaves
client/js/bossfx.js     the enemies' effects: crescent, lance, floor marks, the ghost sword, the eruption, the air shock, meteors
client/js/director.js   event → behaviour, regions, slash-command effects, chatter, visits
client/js/voices.js     how each character talks: base lines and every voice's version of them
client/js/lore.js       names, epithets, session tallies, conversation topics
client/js/post.js       bloom, tilt-shift, colour grade; Fenrath's darkness and the shockwaves of his roar
client/dev/sprites.html sprite-sheet viewer
client/dev/fire.html    the fire loops, enlarged
```
