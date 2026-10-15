# Elden Code

Your Claude Code sessions, alive in a dark-fantasy HD-2D world. Each session on this machine
walks in as a Tarnished; what it does in Claude Code, it does in its project's region.

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
  `client/js/heroes/knight.js`.
- **Fortuna, the Four-armed Beauty** — `fortuna.json` (+ `fortuna-kneel.json`), rigged in
  `client/js/heroes/fortuna.js` (frost blade, floating orb, dripping ice; finer pixels than the knight).
- **The Ronin of the Iron Kasa** — `ronin.json` (+ `ronin-kneel.json`), rigged in
  `client/js/heroes/ronin.js` (curved blade with a slash trail and a running glint, walking legs).
- **Vael, the Crimson Weaver** — `bloodbender.json` (+ `bloodbender-kneel.json`), rigged in
  `client/js/heroes/bloodbender.js` (blood magic that spins round the fist and lashes like a whip).
- **The Rune Lord, of the Golden Rune** — `runelord.json` (+ `runelord-kneel.json`), rigged in
  `client/js/heroes/runelord.js` (the staff's orb kindles, golden runes wheel round it, and a
  blow of the staff sends a ring of runes across the ground).
- **Aurelion, the Radiant Oath** (Holy Knight) — `paladin.json` (+ `paladin-kneel.json`), rigged in
  `client/js/heroes/paladin.js` (the sword leaves a radiant arc, light bursts from the raised blade,
  and a pillar of light falls on it; kneeling, he prays under a beam of light).
- **The Bandit Knight, of the Broken Road** — `bandit.json` (+ `bandit-kneel.json`, his resting
  squat, used exactly as drawn), rigged in `client/js/heroes/bandit.js` (no sorcery: the spear sweeps
  over his head and lunges with a trail, and the tower shield comes up to guard).
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
    under the gown (only its panels sway).
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
  - **Masked**: `sorceress-masked.json` (+ `sorceress-masked-kneel.json`).
  - **The mask:** she puts it on to work her sorcery (once she's at her station, or channelling)
    and to fight. She takes it off once she has been idle 12 seconds, and changes no more often
    than every 6 seconds. Between the looks, glintstone light gathers and she holds the mask up over
    her head, her staff standing by itself beside her (`sorceress-veil.json`). It takes under two
    seconds and isn't logged. While thou art her, she leaves the mask as it is.
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
bows its head and sways its cape. `npm run heroes` exports each hero as `<id>-sheet.png` +
`<id>-sheet.json` (grid and animations), a glow map, and an animated GIF per animation in
`client/assets/hero/`. Preview them at <http://127.0.0.1:7777/dev/hero.html?hero=ronin>.

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
the grid twice as large, so the rig halves its scale (`px`) to match.

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

## Great enemies

Boss fights happen in the **Arena of Trials**, a wide ring of broken pillars (radius 19). It rises
from the mist north of Roundtable Hold, with a bridge from the Hold, when a fight begins. It sinks again only once the fight is over and
everyone has left it, you included (`client/js/fight.js`, `client/js/arena.js`).

- **What brings one:**
  - **Summoned:** at the Round Table (**E**).
  - **Invasions:** by itself every 20–40 minutes.
  - **A struggling session:** three failed tool calls within two minutes, a session ending in
    failure, or a single quest running past ten minutes.

  After a fight, nothing but a summons brings another for six minutes.
- **Who fights:** every Tarnished, the Twofold included, drops what it's doing and comes by grace
  to fight. Their sessions keep running, and they go back to them by grace afterwards. You fight
  too, as whoever you are.
- **From afar or up close** (`client/js/combat.js`, effects in `client/js/spellfx.js`):
  - **Mages** keep 6.5–9.5 units off the enemy, circle slowly, and cast. Each has a few spells in
    its own light:
    - Jorvik (the Rune Lord): a spinning golden rune, a volley of three that fan out and curve back
      in, or a circle of runes under the enemy that bursts into a pillar of gold.
    - Corisande: a glintstone pebble, a spray of three shards, or now and then a great shard.
    - Vael: a gout of blood, blood spikes out of the floor, or a lash of blood that reaches the enemy
      at once.
    - Solenne: a lance of holy light, a spinning halo, or light falling on the enemy.
  - **Up close:** Ruadan, Maren, Aurelion, Wynn and Ulric. Ulric still hides; his style only
    matters when you play him.
  - **Fortuna** does both, switching between her frost blade and frost cast from afar (a shard, or
    ice out of the floor).
  - **Playing them:** as a mage, a left click casts toward the pointer. The spell homes on the
    enemy if he's within about 35° of where you point; otherwise it flies off into nothing. As
    Fortuna, left click swings her blade and right click casts.
  - **Against the Golem,** spells hit his cracked ankle while he stands (counting a little less
    toward felling him than a blow there). While he lies felled they hit the fire in his chest, for
    half what a blow from inside the golden circle does.
- **Ultimates** (`client/js/ults.js`):
  - **The meter:** each fighter's blows fill it: about 160 damage for the others, 520 for you. A
    blow on the Golem's ankle counts in full, though it barely wounds him. Your meter is under
    your health; the others' are thin gold lines under theirs.
  - **Loosing one:** you press **R** once your meter is full. The others loose theirs when ready,
    at least 12 seconds apart, never two at once.
  - **The freeze:** the world stops and turns black and white, except whoever looses it. The camera
    closes in, its name shows, and an aura of their own light shines round them (a glowing outline,
    a light behind, motes swirling in). Then they strike, and the world moves and colours again,
    about 2.4 seconds in all. If you aren't on the arena (fallen and resting at the Hold), an NPC's
    ult simply fires, with no freeze.
  - **Aimed ones** (Solenne's, Ulric's) go one of four ways: toward the pointer for you, and only
    hit if the enemy stands in that line. The others walk into line first.
  - Jorvik, **Flight of Tomes:** seven golden tomes take wing and dash into him, each spent as it
    strikes.
  - Corisande, **Glintstone Arrow:** a crystal arrow trailing light finds him.
  - Vael, **Crimson Mire:** a pool of blood under him for 7 seconds. He's slowed to a third, can't
    leave it or leap or roll away, and bleeds until 4 seconds after it dries.
  - Solenne, **Wall of Dawn** (aimed): a tall curved wall of golden light strikes him once, hard,
    and drives him back.
  - Ruadan, **Hammerfall:** he leaps high and lands hammer first at the enemy's feet in a burst of
    gold.
  - Maren, **Red Storm:** red lightning rains around him, ending in one great bolt.
  - Aurelion, **Radiant Verdict:** a great slash of light dazes him for 5 seconds, unable to fight
    or move.
  - Wynn, **Iaijutsu:** after a breath, Wynn cuts through him from every side while he's held still.
    The cuts hang in the air, and nothing lands until Wynn is back where he began, blade sheathed.
    Then it all lands at once.
  - Ulric, **Tenfold Spears** (aimed): ten spears stick in him, poison him for 4 seconds, then fall
    away.
  - Fortuna, **Frostfall:** four great icicles drop on him one after another.
  - **Art:** each ult holds the character's own pose (raise, cast, strike, kneel) until their ult
    drawings replace it.
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
  stone posts. Until the fight is over (felled, prevailing or withdrawn), nobody walks back out
  over the bridge and you can't travel by grace, not even to the Hold. Then the fog thins away.
- **The lights go out:** from the moment it's announced until it's felled, prevails or withdraws,
  every torch, candle, fire and grace in the Lands Between goes out, one after another, except the
  arena's braziers. Flames sink into their beds, the big fires give off a wisp of smoke, and the
  graces fade. They're lit again, one by one, once it's over (`DOUSE` in `client/js/config.js`).
- **The way there:** meanwhile a golden arrow lies on the ground in front of you, pointing along
  the path to the arena (`client/js/guide.js`, `GUIDE` in the config). From an island it points
  along the island and over its bridge; at the Hold it turns north. It fades once you're on the
  arena, and comes back if you leave mid-fight. Low things in front of it never hide it.
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
  He walks into his target's lane and strikes along it. Every blow shows itself before it lands:
  step out of the way, or dodge through it with **Space**.
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
    otherwise he lands next to someone.
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

Then open <http://127.0.0.1:7777>. New Claude Code sessions (CLI or the desktop app's Code
tab) appear while the bridge is running. **Summon phantoms** fills the world with fake
sessions if you just want to watch; `npm run simulate` pushes fake sessions through the real hook.
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
    locally, it enters only once you reach the arena.
  - Everything else works as locally: become anyone, fight, the Round Table.
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
client/js/arena.js      the Arena of Trials, north of the Hold
client/js/fight.js      great enemies: what brings them, Fenrath's attacks, the fighters, thy health
client/js/golem.js      the Guardian Golem's fight: his weak points, his fall, shockwaves, fire
client/js/ripple.js     the arena floor rippling like water under the Golem's shockwaves
client/js/bossfx.js     the enemies' effects: crescent, lance, floor marks, the air shock, meteors
client/js/director.js   event → behaviour, regions, slash-command effects, chatter, visits
client/js/voices.js     how each character talks: base lines and every voice's version of them
client/js/lore.js       names, epithets, session tallies, conversation topics
client/js/post.js       bloom, tilt-shift, colour grade
client/dev/sprites.html sprite-sheet viewer
client/dev/fire.html    the fire loops, enlarged
```
