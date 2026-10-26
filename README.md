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
  - The world loads behind the title meanwhile, sessions already taking up their heroes (locally;
    on a first journey they wait till the tutorial is over: see below).
  - If it isn't ready yet, a loading sign turns at the bottom right until it is (`client/js/gate.js`).
  - Then the title crumbles away, pixel by pixel from the middle out, as Maren rises at grace:
    in 1.3 s by the clock, however slowly the world's first frames come (its shaders are compiled
    the first time a page is opened), and it's gone for good a moment later even if its own frames
    stop. The world checks its size every frame too, so a page first opened out of sight (with no
    size yet, and none ever announced) is drawn once it's shown, never left black.
- **Nothing of the game shows until then:** no buttons, log or map strip, and no keys reach the
  world.

## The tutorial

On the first journey the title gives way to a tutorial (`client/js/tutorial.js`) before the Lands
Between set out. Once it's been walked or skipped the browser remembers it, and it doesn't come
again by itself (`?tutorial` in the address shows it anyway).

- **The world held back:** Maren rises at grace in Roundtable Hold with nothing else about: no
  island, no heroes at the Round Table, the training yard out of sight. No session is taken up
  meanwhile (locally the bridge's stream is opened afresh once it's over, so its snapshot is the
  world as it stands then), the public demo's sessions wait, and no great enemy comes.
- **How it's shown:** black falls between the Hold and the training yard, there and back; on the
  yard you walk from one step to the next (below). What to do is written at the foot of the
  screen, the keys to press drawn as keys, in the gold of the hint a fight used to show: W A S D
  and the arrows laid out as on a keyboard, Shift, Space, R, Q, and the mouse with the button to
  click lit. Each step lets through only what it teaches and what came before, and keeps you to
  the place it's in.
- **On the yard:** the three middle steps all take place on the training yard (see below), the Hold
  out of sight and the yard's own stair up to it put away meanwhile (it would lead nowhere); you
  keep to its floor. Once a step is done, the golden arrow that shows the way to the arena in a
  fight shows the way to the next: over to the ring of the rune rocks at the yard's east end, then
  back to the great dummy's sawdust ring at its west end. Come into the ring, and its step begins.
- **The steps:**
  1. *Walking*, at the Hold: "Move around with W A S D or the arrows · Hold Shift to sprint".
     Each way lights up once it's been tried, and Shift once you've sprinted with it; once all
     have, on.
  2. *Blows*, on the training yard, emptied of its dummies (and anyone training): you stand
     where its great dummy will (in the middle of its sawdust ring, at its west end), three straw
     ones round you in a triangle pointing east: "Destroy the three dummies · Attack with" a
     left click (or a left or right click, for whoever casts). Two hits break each, blows or spells
     (the training yard's own take four blows); broken, they stay in pieces.
  3. *Dodging*, over at the yard's east end, in the ring of its rune rocks (see the Training Yard
     below), shut till now: step in, and they take their turns. "Dodge with Space to not get hit":
     a dodge as a crest comes counts, on a counter over the words (0 / 3, shown only in the
     tutorial); a crest that reaches you strikes but takes no health, and the count starts again.
     Three in a row, and on (the rocks rest again till the tutorial is over). Step out of the ring
     meanwhile, and they rest and the arrow shows the way back in.
  4. *The ultimate*, back at the west end: come into the sawdust ring and the great dummy comes in
     a puff of dust where you began, the straw ones' pieces swept away in it. "Strike its cracked
     ankle", a gold arrow over it, and the hint for Q, the camera's focus on it (it no longer shows
     in a fight). Blows on the ankle hurt it no more but fill your ultimate's bar, a fifth each;
     full, "Use your ultimate attack with R", and the ultimate breaks it at a stroke, with its last
     blow (Maren's great bolt, after the twelve of her storm; each ultimate marks its last,
     `client/js/ults.js`).
  5. *Gestures*, back at the Hold: "Open your gestures with B", then "Choose a gesture with" a
     click on one, or its number, 1 to 8.
  6. *Becoming someone*, straight on: a hero of the Round Table (one of those with a single form,
     at random) rises from grace beside you and waits. "Click on them to become them", then
     "Become" in their fan.
  7. *Islands*: straight on, Maren, let go, waits as an island rises for her (*your-project*),
     then sets out and works at its forge, the camera on it. A card says why they go there, and
     where they go with nothing to do; then **Tutorial completed**: **Do it again**, or **Move
     on** into the Lands Between (the island sinks away, Maren comes home to the Hold, and you stay
     whoever you became).
- **Skip tutorial**, at the bottom right, ends it at any step and brings you back to the Hold.
- **Again:** at the training yard's grace (E there, **Tutorial**, and yes to "Use grace to do the
  tutorial?"), or with **Do it again**. The page loads afresh for it, the title standing aside
  (`client/js/gate.js`, `again`).
- It's silent for now: only the game's own sounds play.

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

South of the Hold, and lower, lies the **Training Yard** (`client/js/yard.js`), always there: a
long floor of grey brick shaped like a pill, 60 long and 24 wide with its two ends round, on a rock
of its own. Its west end is for blows, its east end for dodging, and a little Site of Grace burns
in the middle. A stone stair comes down from the Hold's rim to the middle of its north side, and
whoever walks it goes down with it (`client/js/ground.js` gives the ground's height wherever it
isn't level with the Hold). At its west end, in the middle of a sawdust ring, stands a great
dummy: the Guardian Golem in wood, halberd and all, a little smaller than he (7.1 units tall to his
7.9). As with him, its only weakness is its cracked
ankle, low on its back leg: a blow lands only there, struck from behind it, and its wood turns any
other (splinters and a spark, the striker bouncing off, and the first time a word in the log on
where to strike); spells fly at the ankle; ultimates land whole. It breaks after half the blows on
the ankle that fell him: eight of yours (each counts 1 of its 7.5, a spell 0.7, a blow or spell of
someone training half that, as on his ankle). An ultimate takes from it besides, though his ankle
never feels one: a share of its health for every point the ultimate deals, a whole one of yours
(some 800) about half of it, one of theirs about a third. Broken, it bursts apart
(`boss-dummy-falling-broken`, splinters flying, 0.45 s), lies in a heap of its pieces six seconds
(`boss-dummy-broken`), and stands whole again in a puff of dust. Near it the
camera pulls back and looks a little higher to keep the whole of it in view, as it does for a great
enemy on the arena, and Q turns its focus on it (between you and it) and back, as on him. Eight straw dummies stand scattered round it (`client/js/training.js`), in new
places each time the page loads, over the west half of the yard, clear of it, the stair's foot, the
props and one another. Racks of the Round Table's weapons (`client/js/weapons.js`) flank the foot
of the stair, with barrels and crates beside them; an archery butt stands on the south side, east
of the grace, and rope lanterns light the edge. Blows,
spells and ultimates find the dummies as they find a great enemy. A dummy flashes white as each one
lands, as a character struck does (as briefly, and pale by night, never a light going off), and
wobbles away from it; once a straw one has taken enough it bursts into pieces, then stands whole
again five seconds later. Each dummy has its health in a bar over its head, its own and not the
screen's (`placeBars`): shown only while it's hurt and for four seconds after a blow hurts it,
what it just lost lingering in white a moment before draining away; never while it lies in pieces
or from afar. Dummies never strike back. On the yard your ultimate is always full: each
one still freezes the world for its moment, but you needn't wait between them. Leave the yard and
it's empty again; a fight in the arena always begins with it empty, and it fills as your blows land.

At the yard's east end three **rune rocks** stand on a ring of thin black cracks in its floor
(`client/js/runerocks.js`; the user's drawings, `client/assets/fx/rune-rock-1..3.json`, dark and
with the rune alight, recoloured to the yard's slabs). Step into the ring and a small light kindles
in the cracks and runs round them from rock to rock, the way their turns go (the north rock, then
the south-west, then the south-east), a cyan tail fading behind it. As it passes under a rock, that
rock's rune lights, and it's lifted in blue magic (its own light, and motes), held up a second and
dropped, cracking the floor in its rune's cyan, and its shockwave ripples out over the yard's floor
as the Golem's do over the arena's, though slower (`client/js/ripple.js`: each ripple bends only
the floor it's on, the arena's round one or the yard's pill-shaped one); each is heard too (see
Sound). The light runs at the pace of their turns, so that it reaches each rock just as its turn
begins, about a third of the way round every four seconds. The camera pulls back while you're in
the ring to keep the rock lifted in view. A crest that reaches you strikes as a great enemy's blow
does (red, thrown back) but takes no health; dodge (Space) through it. With nobody in the ring the
light goes out and the cracks lie dark (the rock up still comes down). Those training go there too
(below), and the rocks take their turns for them as for you.

In the middle of the yard burns a little **Site of Grace**. Press E there ("The
yard's grace") for its menu: **Tutorial** walks the tutorial again (after asking "Use grace to do
the tutorial?"), and **Call to training** chooses who trains, in the same window that chooses
companions for a great enemy:
whoever is training already stands in its slots, with a spare one to call another. "Train" sends
for everyone in the slots at once, and they come by grace (arriving in front of the little grace);
anyone taken out of a slot goes back. Each one training has a **Dismiss** button under its feet to
send it back on its own, shown while the pointer is on them (or they're the one inspected).
Training, a Tarnished has stopped working: what its session wants waits until it leaves the yard,
and nothing of its work shows meanwhile (no signs over its head, no
gestures, no trips to its stations, no spirit ashes), as in a fight. It takes a post (beside a
straw dummy, behind the great one at its cracked ankle, a spear its farther reach the farther off,
or, a caster, off to one side) and strikes
or casts there every so often, now and then going over to another dummy. Now and then (three times
in ten, each time it chooses where to go next) it goes to the rune rocks instead, two at most at
once: it stands in their ring, either side of its middle, and hops each shockwave as it comes, as
fighters hop the Golem's, but one time in five it hops too soon and is down again as the crest
passes, thrown back and staggering (nothing taken). Rarely (a minute or more
into its training, then every few minutes, and never two within twenty seconds on the yard) it
looses its ultimate at its dummy, quietly: it gathers in its pose with its aura round it, as long as
ever, but the world doesn't stand still for it or go grey, and the camera neither closes on it nor
shakes (`client/js/ults.js`, `startQuiet`). Ulric never does: his spears are thine to loose alone.
A Tarnished with nothing
to do, a hero without a quest or one whose session has been idle a while, sometimes goes to train
of its own accord (a few at most at once, never while a great enemy is abroad). It goes back as soon
as its session has work for it, or after a minute or two, and then waits a few minutes before
coming again. Sent back, a Tarnished takes up what its session wants now, or else goes home (a hero
without a quest walks back up the stair to the Round Table).

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
  - **Left click** strikes with the character's own attack (a Tarnished in its way staggers;
    it's all for show); a mage casts a spell instead. **Right click** casts as Fortuna or a mage,
    throws a spear as Ulric, and a thunderbolt as Maren. Every attack goes the way you point (see
    **Aiming**, under great enemies).
    **Space** dodges. **C** crouches. **Q**, in a fight against a great enemy, turns the camera's
    focus on it and back on you. **R** looses your ultimate once its bar is full. **V** turns the
    sound off and on.
  - **B** opens your fan of gestures over your head (or **1–8**); clicking yourself doesn't, it's a
    blow like any other click. Nearby
    Tarnished may answer. There are no gestures while a great enemy is abroad: the fan folds away
    and comes back once the fight is over.
  - **E** uses what you stand by (a prompt shows it): the forge, the scrolls, the war table, the
    ritual circle, the raven tower, the fog gate, a site of grace, and the Round Table. Each
    works as it does for the sessions' characters (the forge glows and throws sparks, a raven
    takes wing…).
  - **M** shows the map of every island, and the training yard below the Hold, each named. **Z / X**
    travel by grace to the previous / next area, **H** to Roundtable Hold.
  - **The map strip** (along the bottom of the screen) is one line as wide as the whole world,
    with Roundtable Hold always in the very middle, and the training yard (which lies below the Hold)
    under the Hold's name. Each area's name sits over its own place on it, and clicking a name takes
    you there by grace (the training yard always, like the Hold). A golden dot under
    the line shows where you are, moving with you even between islands. An island only appears on
    it, and can only be reached by grace, once it has fully risen from the mist.
  - While a great enemy is abroad, the **Arena of Trials** shows over Roundtable Hold in shining
    red, under a skull whose horns curve down. Every island but the Hold is greyed out: the Hold is
    the only place you can travel to by grace, and the way on to the arena is on foot. Once you're
    sealed in the arena with it, the strip gives way to its health bar until the fight is over.
  - The **settings** wheel (top right, beside the **?**) lists all of this under **Controls**.
- **Settings** (the wheel at the top right; `#settings` in `client/index.html`, wired in
  `client/js/main.js`; all of it remembered in the browser). Its pages are listed down its left:
  - **Controls:** every control above, its keys drawn as keys.
  - **Interface:** show or hide the message log, the speech bubbles, the map strip and the area
    titles; turn the screen shake off (heavy blows and landings jolt the view); and how big the
    interface is, 80–130%: its panels and bars, each from where it's set (not what follows the
    world on the screen, the bubbles, prompts and fans, nor the settings themselves).
  - **Sound:** how loud the sound effects are, and how loud the music, a slider each.
- **Others:** only the character you are can gesture. Clicking anyone else opens their info panel
  and a fan with just **Become [name]**. You can drag them to carry them elsewhere. Scroll to zoom.
  The names on the map strip and the lines of the message log take you places.
- **Back to Maren:** while you're someone else, Maren lives on her own. She wanders, sits at the
  Round Table and talks in her own voice. To return to her, click her and choose **Become Maren**.
- **Sessions:** a character you take over stops following its Claude Code session, which keeps
  running. When you let go, it walks back to whatever the session is doing. If a generic
  Tarnished's session ends while you're them, you return to Maren.
- **The Twofold:** if you're them at dusk or dawn, you can't move while they change form. You can
  change them yourself too: **B**, and **Change into Solenne** (or **Ruadan**) in the middle of the
  fan. They keep the form you chose until dusk or dawn comes round to it.
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
- **You never leave the ground** (`client/js/pilot.js`). Walking, dodging, or sliding along the
  rim onto a bridge, nothing takes you off the walkable ground or into a pillar. Should anything
  ever leave you standing on nothing, you're stepped onto the nearest ground within 6 units, or,
  from farther out, taken to Roundtable Hold by grace. (Standing on the top step of the arena's
  stair as a great enemy enters and the fog seals it, you're stepped onto the arena's floor.)

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
  His cut (`ronin-attack.json`: crouched, the blade drawn back low behind him; the wide cut forward;
  the follow-through, the blade high behind him) and his Iaijutsu (`ronin-ult.json`: the drawing
  stance, his blade sheathed in a black scabbard at his hip; the dash; the stance with the blade
  loosed a hand's breadth, a glare flashing on the bared steel) are drawn whole, in his `bigFrame`.
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
    stone glow. His blow (`champion-attack.json`: the maul swung up over his head, brought down
    onto the ground in front, resting on his shoulder) and his Hammerfall (`champion-ult.json`:
    the crouch, airborne with the maul raised, the slam) are drawn whole, in his `bigFrame`; so is
    his maul throw (Hammerfall's crouch, then `champion-throw.json`: his near arm across his chest
    and stretched out after the maul, the hand open), the frame widened for that hand. The thrown maul is drawn too
    (`fx/ruadan-maul.json`): lifted cell for cell out of the crouch by the stencil of its cut-out
    (`ruadan-maul-throw.png`), the cells where his fingers held the haft taking the bare haft from
    the cut-out, so it's the very maul he held.
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
    own name, and the log tells it. Every visit begins two minutes before the next of them (see
    **Day and night**), so even a short one sees both forms; and whoever is the Twofold can change
    them at will (`changeForm` in `client/js/director.js`).
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
    seconds and isn't logged. While thou art her, she wears it on the training yard and in a fight
    on the arena, putting it on as she walks onto them and taking it off as she walks out, so her
    drawn blows, spell and ultimate play wherever she fights.
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
middle where the character stands. A frame needn't be centred on the character: its `anchor` says
where its middle is, so a frame holds only what's ever drawn in it (the Witch's staff reaches far
ahead of her and little behind: hers is 218 wide with her middle at 74, where centred it was 300, a
quarter of it always empty). `npm run heroes` exports each hero as `<id>-sheet.png` +
`<id>-sheet.json` (grid and animations; with a big sheet, `<id>-big-sheet.png` too, and the poses
on it: `big.poses`), a glow map, and an animated GIF per animation in `art/exports/`. Preview
them at <http://127.0.0.1:7777/dev/hero.html?hero=ronin>.

**Baked sheets.** Drawing every frame of every character as the game starts took some 12 s (the
Witch, Fortuna, Aurelion and Maren the longest; the Golem 2.5 s). So the sheets are baked ahead of
time (`npm run bake`, `scripts/bake-sheets.mjs`), into `client/assets/hero/baked/` (never committed):
each one's pictures, colour and glow (and its big poses'), what each frame holds, and the
fingerprint of the files it was made from, its rig's module, the modules that imports, and its art
(`client/js/heroes/bake.js`). The game loads those pictures instead, decoded off the page's thread,
and reads their pixels only once they're wanted (what's clicked or struck); a sheet baked is the
very sheet it would draw, pixel for pixel. A bake is used only while it's still its own:

- The bridge checks each bake against those files as it serves it (`server/bridge.js`, `stillOwn`),
  and sends it marked trusted; one that has fallen behind (a rig or its art changed) isn't sent, and
  the bridge bakes the stale ones again meanwhile, in the background, as it does once as it starts.
- The public build bakes its own with the code it ships (`--trusted`: never checked).
- Served any other way, the page checks a bake itself (`fingerprint`).

A sheet without a bake of its own is drawn as before, but in workers off the page's thread, a few at
once (`client/js/heroes/compose-worker.js`), else on the page. The great enemies' sheets
load only once the world is ready (no great enemy comes till its own is), and the first frame's
shaders are compiled side by side (`compileAsync`). Ready to set out: about 1.4 s for the public
build, 3 to 4 s locally, 5 s with nothing baked (it was 11 to 15 s).

All the art the game is drawn from lives in `art/` (never committed), one folder per character:
`art/heroes/<Name>/` holds the hero's master stand and kneel (the images its art grids were made from),
its attack, ultimate and effect drawings and its weapon cut-outs, with `ref/` for references and
`krita/` for Krita files; `art/bosses/<Name>/` the same for each great enemy. Beside them are
`art/dummies/`, the world's props (`art/world/`), the UI mock-ups (`art/ui/`), `art/references/`, the
ChatGPT prompt templates (`art/prompts/`) and what `npm run heroes` exports (`art/exports/`). A new
drawing goes straight into its character's folder.

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
node scripts/recolor-sprite.mjs art/heroes/Aurelion/ult-aurelion-1-raise.png paladin
```

Each material (outline, greys, reds, golds, blues…) takes the tonal range of the hero's master sprite
and the nearest colours of the hero's palette, matched in CIELAB. A flat white or black fallback
background becomes transparent, and so does a painted grey-and-white checkerboard, enclosed pockets
of it included. The result is written next to the input as `…-recoloured.png`.

A weapon drifts on its own (Corisande's staff came back orange while her gold trim barely moved), so
pass its cut-out, the weapon alone at the master's size, as the art prompts attach it:

```
node scripts/recolor-sprite.mjs art/heroes/Corisande/ult-corisande.png sorceress-masked --weapon art/heroes/Corisande/corisande-staff.png
```

The weapon is found where the cut-out's colours dominate and matched against the cut-out alone. New
light with no counterpart in the master, such as Aurelion's giant blade, goes in a
`--light x1,y1,x2,y2,r` band (a segment and a radius in the image's pixels): it keeps its own
brightness on the palette's brightest colours. The hero is the art grid's name: `knight` (Maren),
`fortuna`, `ronin` (Wynn), `bloodbender` (Vael), `runelord` (Jorvik), `paladin` (Aurelion), `bandit`
(Ulric), `champion` (Ruadan), `queen` (Solenne) or `sorceress-masked` (Corisande). Any other art grid
goes by its path, e.g. Fenrath's `client/assets/boss/boss.json`. The master art is looked for beside
the grid, then by its name anywhere in `art/`. Once a recoloured pose is final, it takes the
original's name and the original goes.

Art that isn't a hero's (a training dummy, a prop) keeps its own colours. When one drawing of a set
comes back lighter or more orange than the rest, as the great dummy's two wobbles did
(`client/assets/fx/boss-dummy.json`), the set's first drawing serves as the master: extract it on
its own colours (`extract-hero.mjs --colors`), keep that image beside the grid it made, and give
`recolor-sprite.mjs` the grid's path as the hero for the others. Otherwise only its fallback
background goes, found as above (`scripts/image-io.mjs` holds what the two tools share):

```
node scripts/clear-background.mjs art/dummies/dummy-stand.png
```

The result is written next to the input as `…-clear.png`. When the outline is drawn nearly black on
a black background, lower `--dark` (24 by default) so that the outline stays.

### Fire

The braziers and the candles on the round table in Roundtable Hold burn with pixel-art fire from
two sprite sheets (`art/world/fire/`, extracted into `client/assets/fx/` and rigged in
`client/js/fire.js`). So does every island: a
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
GIFs to `art/exports/`. To turn a sheet of frames into an animation file:

```
powershell -ExecutionPolicy Bypass -File scripts/decode-image.ps1 sheet.webp .elden/sheet.bgra
node scripts/split-sheet.mjs .elden/sheet.bgra 2000x667 .elden/frames/fire
node scripts/extract-hero.mjs --name "Fire" --colors 9 .elden/frames/fire-1.bgra:169x313:.elden/frames/fire-1.json …
node scripts/pack-frames.mjs client/assets/fx/fire.json "Fire" "source note" .elden/frames/fire-1.json .elden/frames/fire-2.json …
```

Extract all of a sheet's frames in one run so they share a palette, and pack them in frame order.

The fight art (an ultimate's pose, a blow's frames, its effects) comes as images of their own in
the hero's folder in `art/heroes/` (see `art-prompts.md` for what each holds). A pose goes back on its hero's palette, at
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
loosed on it is placed from its floor, as on the Hold (a group raised to its height, `ARENA.y`);
a spell or spear you loose off it (in the Hold, on a bridge, on the stair) is placed from the
ground under you instead, so it flies at your hand's height there too.

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
  - **Add slot** adds another, up to as many as there are heroes to take. **Remove slot** takes one
    away, the last empty one (or the last of all, with its hero, if every one is taken), down to one.
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
    matters when you play him. Then right click throws his spear as a mage casts: cocked back like
    a javelin and thrown (the two drawings of his Tenfold Spears), it leaves his open hand fast
    (34 units a second, against a mage's 9 to 14), flies straight the way you point, strikes the
    enemy (on the training yard, a dummy) if it comes up to him on that line or a little off it, as
    hard as a spell, with a spark of his green, and stays stuck in him a moment the way it flew (no
    poison: that's his ultimate's); otherwise it flies on into nothing. Ruadan's style matters
    when you play him too: right click throws his maul. Crouched as for Hammerfall, he flings it
    and stays stretched out after it, his hand open. It leaves his hand head first, spinning, and
    flies along the line you point (16 units a second), embers falling off its cracks and its gold
    lighting the floor. It strikes the first thing it comes up to, flies on a little past it (1.6
    beyond its far side) and comes down head first into the floor, the stone cracking round it in
    his gold, dust and chips of gold flying (striking nothing, it plants itself 10 units past his
    hand). It stays there three quarters of a second, shaking side to side the last half second
    as the Golem shakes gathering his fire, then tears itself out and flies back to his hand in
    0.4 s, faster and faster, no longer spinning: its haft turns to his hand as it comes out of the
    floor and points at him all the way back. It strikes what it comes up to again on the way (`Boomerang`,
    `client/js/spellfx.js`; `throwMaul`, `client/js/combat.js`). Each blow is as hard as a spell,
    with a spark of his gold. Once it has left his hand he can walk about, drawn without it (his
    fist empty), but strikes, throws and looses nothing (R waits) till it's back; as it tears
    itself out of the floor he stops where he stands, turns to it and holds his hand out for it
    (the drawing he threw it in) till it's in his hand. Being struck meanwhile doesn't throw him
    off it; if anything takes him first (travel by grace, a fall), the maul is back in his hand
    at once.
  - **Fortuna** does both, switching between her frost blade and frost cast from afar (a shard, or
    ice out of the floor), both drawn (`fortuna-shard.json`, `fortuna-spikes.json`) at her own
    pixel size.
  - **Pointing the way they go:** whatever flies (shards, orbs, tomes, arrows, spears, Aurelion's
    wave) is turned to point the way it goes as it shows on the screen, into the view or out of it
    as well as across, worked out through the camera itself (`spellfx.js`, `setView`). The ones
    that keep upright (Corisande's great shard and arrow, Jorvik's tomes, the wave) are mirrored
    rather than turned upside down going leftward. Beams (Vael's lash, Solenne's lance) lie along
    the line from the caster to what they strike, turned toward the camera, so they end on it
    whichever way they run; Ulric's spears stay stuck the way they were thrown.
  - **Stuck in the drawing:** what flies is judged a hit by a forgiving zone round the enemy's
    feet, but it lands on his drawing: over the last stretch it flies on onto the edge of his body
    on the side it came from (his middle on that row, not a blade held out or a tail), at the
    height it flew, kept to his torso, in his drawing's plane; spells burst there, and spears stick
    there, their point a little way in (`spellfx.js`, `pinOn`, reading the frame he shows). A stuck
    spear goes with his drawing as he's knocked back, turns as he turns, and drops as soon as his
    pose has moved away from it. So too on the training yard's dummies.
  - **Playing them:** as a mage, a left click casts; as Fortuna, left click swings her blade and
    right click casts.
  - **Aiming** (`combat.js`, `aimOf`): every attack of yours, a blow, a spell, a thrown spear, an
    aimed ultimate, goes along the line on the screen from your character to the pointer, at any
    angle. The pointer is taken at the height the attack goes at, so what flies passes right under
    it.
    - A blow strikes what stands on that line within its reach, in any direction (straight up or
      down the screen too), the Golem's and the great dummy's ankles included.
    - **Spears reach farther:** Maren's and Ulric's blows land on whatever the tip of their drawn
      spear touches, 1.2 and 1.7 units farther than a blade's (their tips drawn 3.1 and 3.6 units
      ahead of them as the blow lands, against 1.7 to 2.7 for the swords and the maul:
      `combat.js`, `reachOf`). As fighters they strike from that much farther off, and stand that
      much farther back from the Golem's ankle; training, from a dummy.
    - A spell or a spear flies straight along it, homing on nothing: it leaves from the line (as
      far out as the drawn pose holds it, nearer as the line turns into the view or out of it) and
      strikes the first thing it comes up to. A volley set off to the sides comes back onto the
      line.
    - A beam runs along the line to the first thing on it; what rises out of the floor rises under
      the first thing on it, else right where you point.
    - **A little off still counts:** a blow finds what's up to 0.6 beyond its body from the line,
      a spell up to 1 (`AIM`). Against a straw dummy, a spell lands up to about 1.6 off the line,
      and misses beyond.
    - Fighters and those training still strike the way they face, and their spells still find
      the enemy wherever he is.
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
  - **Aimed ones** (Solenne's, Ulric's) go the way you point (any angle, as every attack of
    yours does), straight at him when loosed by anyone else, and only hit if the enemy stands on
    that line, or a little off it: Ulric's spears fly straight along it, sticking where they
    bite; Solenne's wall is seen face on when it goes more into the view or out of it than
    across. The others walk into line first.
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
  - Ruadan, **Hammerfall:** gathered in a crouch, he leaps high, the maul raised over him, and lands
    kneeling at the enemy's feet, the maul driven into the floor; where its head strikes, the ground
    explodes in gold, stones flying, then smoke and embers (drawn, `ruadan-explosion.json`, at
    twice his pixel size).
  - Maren, played, throws a **thunderbolt** with her right click: from her spear's tip as she
    thrusts, straight along the line you point to the first thing on it (or on into nothing), a red
    bolt drawn by Sacha in two drawings (`maren-thunderbolt.json`), stretched from her spear to
    what it strikes and not moving: the whole bolt there in a flash, its burst on what it strikes,
    held 0.3 s; then the bolt breaking up as it fades, 0.3 s more. Heard as one of her zaps with a
    rush peaking on it (see **Sound**). Fought beside, she keeps to her spear.
  - Maren, **Red Storm:** red lightning rains around him, ending in one great bolt (drawn bolts,
    `maren-bolt.json` and `maren-great-bolt.json`, at twice her pixel size so they fall from out
    of sight). Each bolt lights the floor and everyone near it red as it strikes, for a third of a
    second, flickering out; the great bolt's light is far brighter, reaches across the floor and
    lasts most of a second, dipping twice as it dies. It's a real light, by day as by night: one of
    the world's pooled lights, taken from the lamps for that moment (`flash`,
    `client/js/world.js`).
  - Aurelion, **Radiant Verdict:** a great slash of light dazes him for 5 seconds, unable to fight
    or move. He strikes his pose and holds it, and a giant of his own light stands behind him, his
    drawing 1.8 times its size, golden and see-through, its feet on his, and swings the Verdict:
    the giant blade of light raised back over its shoulder, then swept low ahead of it (`Stand`,
    `client/js/spellfx.js`, playing frames of his sheet on its own; the camera draws back to take
    it in). The wave is drawn
    (`aurelion-wave.json`): forming as it leaves the blades, full as it flies, stretching as it
    strikes, then fading.
  - Wynn, **Iaijutsu:** his drawing stance for half a second, then his blade loosed a hand's
    breadth from the scabbard for another half, a glare flashing on the bared steel; then (a second
    in, sooner than the others) he cuts through him from every side while he's held still, dashing
    through him stretched out in the cut, eight passes in under a second. The cuts hang in the air (drawn, `wynn-cuts.json`, at
    twice his pixel size: of the four drawn, the one nearest each cut's angle, or it mirrored), and
    nothing lands until Wynn is back where he began, turned away from him: the blade loosed again,
    the glare, and as it goes home in its scabbard it all lands at once.
  - Ulric, **Tenfold Spears** (aimed): ten spears stick in him, poison him for 4 seconds, then fall
    away. The spears are drawn (`ulric-spear.json`): his own spear, at his own pixel size, leaving
    his open hand as he's drawn throwing.
  - Fortuna, **Frostfall:** three great icicles drop on him one after another, each as tall as she
    is, and shatter (`fortuna-icicle.json`, `fortuna-shatter.json`). A beat later a mass of ice
    three times their size, taller than he is, comes down on him, stands driven into the floor a
    moment, shuddering, and bursts wide, shaking the view. It wounds him as it lands, and again
    as it bursts.
  - **Art:** every hero holds a drawn pose: Maren's spear raised to the sky, its lightning
    crackling; Fortuna's four arms and greatsword raised, the frost flickering; Vael's clawed hand
    raised, blood streaming up his arm; Jorvik's staff thrust high, runes wheeling round its
    blazing orb; Corisande's staff held level like a drawn bow, motes wheeling round its blazing
    crystal (bare-faced, she raises it as she casts); Solenne wound up, the light gathered between
    her palms, motes drifting up from it; Aurelion pointing at the enemy, his sword held out low,
    while the giant behind him raises its blade of light back over its shoulder, a glint running
    along it; Ulric's spear cocked back like a javelin; Ruadan crouched, gathering to leap, the
    maul low behind him; Wynn in his drawing stance, his hand on the hilt of his sheathed blade. A
    pose too wide for the camera's close shot (Corisande's) is centred and taken in whole; Aurelion,
    with his giant behind him, is shot from as far back but kept in the middle of the picture. An ult
    may be loosed in a drawing of its own (`release`), held a moment as it strikes: Solenne's palms
    thrust out as the wall leaves them; Aurelion's giant sweeping its blade low ahead of it;
    Ulric's hand open as the spears leave it. Ruadan's and Wynn's carry them on through drawings of
    their own (the leap and the slam; the dash, and the blade loosed and sheathed).
- **Only the fight:** while a great enemy is abroad, every session works on unseen, the spectres at
  work on their islands included: no log lines about the work, no incantations, signs or gestures,
  no spirit wisps and no small talk. A fighter's signs are put away for the fight (the "!" of one
  that was kneeling at its gate comes back after). Fighters say only their battle lines (taking up
  the charge, falling back, mourning the fallen, the victory). From the moment the enemy is
  announced until it's over, the message log carries only the fight. What the sessions did
  meanwhile is taken up again afterwards.
- **Faces and health:** top left, your character's face in a square frame like the companion
  slots, your health and ultimate meter beside it. Under it, each fighter in a smaller frame, with
  their name over their health and meter, in the order they lined up (`client/js/faces.js`: each
  face is the head and shoulders of the character's own idle drawing). A face darkens once its
  fighter has fallen (the name greyed and struck through). Its frame lights red round the inside
  for a moment each time its fighter is struck, and white-gold, pulsing, while its fighter's
  ultimate is loosed.
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
- **The enemies, one after another:** never by chance (`ORDER` in `client/js/fight.js`). The
  Guardian Golem comes first; once he's been beaten, Fenrath, the Crimson Fang; once Fenrath has,
  Morvane. Each win is remembered in the browser (`elden-code:felled`), and with all three beaten any
  of them may come. Add `?foe=golem`, `?foe=fenrath` or `?foe=morvane` to the address to bring that
  one. Add `?felled` instead to watch and hear Morvane's fall again and again: as you set out, his
  fight is called and you're set in his arena (nothing can fell you); he comes straight in his
  second form, stands three seconds, falls as he does in the fight, and stands again where he fell
  just before he'd be gone, on and on, never felled for good (`client/js/felled-loop.js`). Or add
  `?morvane` to watch and hear one of his moves again and again without fighting him: the Frenzied
  Eye, or the one named (`?morvane=slash`, `lunge`, `fly` or `throw`); the same way in, but he makes
  that move and no other, at you, a moment apart (`client/js/move-loop.js`). Both wait for his art
  to load before calling him. If one's art fails to load, the next in line comes instead. The Tarnished's battle lines fit
  whichever came (Ulric has his own jokes for Fenrath and the Golem).
- **Fenrath, the Crimson Fang** (`client/js/heroes/boss.js`, effects in `client/js/bossfx.js`).
  He has 8,000 health: about two minutes with four companions. He walks into his target's lane and
  strikes along it. Every blow shows itself before it lands: step out of the way, or dodge through
  it with **Space**.
  - **His target:** whoever is nearest (you a little more than the others), but whoever keeps
    wounding him from afar draws him: the more they've dealt lately, the nearer they seem to him.
    A mage pelting him won't stay out of reach for long. He keeps to one target two to four seconds,
    turns round only once it has stayed behind him a moment (never twice within a second), and
    swings and lunges only the way he faces.
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
- **Morvane** (drawings `client/js/heroes/morvane.js` and `client/js/heroes/morvane-flame.js`,
  fight `client/js/morvane.js`): the last of them. A withered old lord, a little smaller than Maren
  (0.95 of her height), a greatsword of twisted gold driven down through his skull and its spikes out
  through his ribs, his mustard drapes in rags. Every drawing is Sacha's (`art/bosses/Morvane`).
  - **His first form won't fight:** he flees all round the arena, away from whoever comes near
    (you most), and after three to six seconds of running stops, **out of breath**, for about three.
    Your blade (and an ultimate) reaches him only then: running, he slips away from it (the log says
    so once). What you loose from afar reaches him running too: a spell, Ulric's spear, Ruadan's
    thrown maul, Maren's thunderbolt. He's yours alone: your companions stay in their places in line
    by the way in, watching him, and join only once he's in his second form. His health (1,000,
    about forty seconds) is a small bar he wears over his head, as the training yard's dummies do; the
    great enemy's bar at the bottom of the screen shows only once he's the Lord of Frenzied Flame.
    Six of your blows or spells that land on him fill your ultimate, however much each takes (in
    his second form too). With 15% of his bar left, he makes one last run, to the middle of the arena,
    and stays there out of breath, wheezing, till you finish him: his change and his reveal come
    there, where he stands, nobody moved for them.
  - **His change**, as that bar empties: everyone holds still (you can't move or strike) and the
    camera comes in close on him, pulling back as he grows. About 26 seconds:
    - he kneels, grips the sword in his skull and screams;
    - he pulls, and the sword, stuck fast, drags his head up on a stretching neck till he **rips his
      own head off**: a burst of frenzied flame swallows it, never to be seen again;
    - from behind, he kneels headless, arms numb, the sword dragging;
    - he stands, still turned away, flames rising from his neck, and **grows** under them to his
      second form's size;
    - the screen goes **black**;
    - he turns round as **the Lord of Frenzied Flame**, three times as tall (7 units from his head of
      flame to his toes, a little taller than Fenrath): his head a ring of frenzied flame round a
      black hole, arms spread, the sword in one hand and a gold fang in the other. His title shows,
      and his second bar (6,000) fills.
  - **His second form** then fights, and your companions are at him now too. He floats, and never
    stays where he is: he drifts about whoever he's after, into their lane a little off them, and
    comes at them quickly, every blow showing itself first (his flame flares as he draws back):
    - he **vanishes** in a burst of frenzied flame and is back a moment later behind you (to slash
      you) or across the arena from you (to lunge at you): unbidden every 7 to 11 seconds, and
      whenever three of you crowd him;
    - **the slash:** the sword raised high, then swept down and across. Everyone before him, out to
      his sword's point (6.4 units), is struck, and a crescent of frenzied flame flies on down his
      lane;
    - **the lunges:** coiled in the air, he shoots forward low with the sword at arm's length, 5 to
      11 units, two or three in a row (vanishing into your lane between them if you've left it);
    - **the fly-by:** drawn back, he streaks across the whole arena flat out, head first, burning
      everyone in his path;
    - **the fang:** he throws his gold fang at where you stand (marked on the floor as he draws back).
      It flies straight at the mark, point first and never turning, very fast (45 units a second;
      drawn bigger than in his hand, so that you see it, gold sparks streaming off it), and stabs into
      the floor at the slant it came in at, in a small mark (0.9 units round). It stays a moment, then
      flies back to his hand as straight and as fast, grip first, hurting anyone in its way again;
      one to three throws in a row;
    - **the Frenzied Eye**, as his bar falls to two-thirds, and again at one-third: he vanishes, comes
      back over the middle of the arena facing you, arms spread, rises, and his head of flame swells
      into a huge burning eye (the camera pulls back to show the whole arena). It drags everyone
      toward him while flames rain down on marked spots; then, white-hot, it bursts over the whole
      arena, hardest near him (46 there, 28 at the edge). Only a dodge (Space) as it bursts escapes
      it; your companions hop it, mostly.
    - Every blade, spell and ultimate reaches him whenever he's there to be reached (not vanished,
      nor up over the arena). The camera follows you from farther back than for the others, so that
      you see him coming. Felled, he falls to his knees, his flame shrinking, and slumps, his sword
      and fang dropping to the floor, all of it seen whole for three and a half seconds; then he, his
      head of flame, his sword and fang, his light and his arena's fire fade out together (a second
      and a half): "GREAT ENEMY FELLED". (`MORVANE.felled` in `client/js/morvane.js`.)
    - **His head of flame** burns all the while, whatever he does: its tongues swirl round the black
      hole, swelling and shrinking as it burns, embers rising off it (Sacha's drawing of it alone,
      the Frenzied Eye's, set over the head in each of his drawings, the hole on the hole: `Head` in
      `client/js/frenzyfx.js`). It's hidden while he's vanished, while the Eye itself is open, and from
      the moment he's felled (his fall's drawings have their own head of flame, shrinking).
    - **His arena**, from the moment he's revealed (it comes while the screen is black): the world
      beyond it goes black, by day or by night (no sky, no horizon, no sea of cloud below); a wall of
      frenzied flame burns round the far half of its edge, black inside like his head of flame,
      about three-quarters of the pillars' height (none on your side, so that nothing stands between
      you and the fight), and the fog sealing the way out burns as that fire too; its light falls on
      the arena from all round; the picture shimmers with the heat; and burning ash drifts up through
      the air, small glinting orange pixels. It all dies away as he falls. (`Inferno` in
      `client/js/frenzyfx.js`: Sacha's band of flame, stood in copies round it, each bent to the
      round, every other one mirrored and each at its own moment of the band's four drawings,
      overlapping so that their dying ends meet; a second row behind them, darker, between them.)
  - **His drawings:** standing, fleeing (four frames) and out of breath (two) are each also drawn
    facing left. They're not mirrors (one of his eyes is covered in dead skin and keeps its side), so
    he plays them whenever he faces left (an animation's `left` frames, `client/js/npc.js`). The
    drawings came at many sizes. Each was sampled on the grid that makes the brooch on his chest the
    master's size (from behind, where it doesn't show, by his body), at half the master's block, so
    that the details drawn at half a block (his eyes, teeth, the brooch's discs, his hair) are kept;
    and each is set in the frame by his chest, so he doesn't jump between them. His two forms are two sheets on the same scale: the
    second has three times the pixels for three times the height. Grown in his change, his first
    form is simply scaled up under the flames (`setZoom`). The second form's flames are drawn as
    they are, glowing orange, with embers; the game's light lies low in front of him so that his
    head of flame keeps its black hole. His second form's fight drawings (the flight, the lunge, the
    slash, the fang thrown, the fall) came at about two-thirds of the master's size, so they're
    sampled at 3.33 px (his height from the hole in his head of flame to his toes the master's); the
    two flights, drawn bigger, at 4.8 and 5.1; the lunge's, whose head of flame came out bigger
    coiled and smaller thrusting, each at its own (3.55 to 2.65) so that he keeps his size through it. Each is set in the frame by the brooch on his belly, so
    that his body stays put whatever he does; those that reach far out (a sword at full stretch, the
    flights) are in frames of their own. All but the reveal and the fall are drawn facing left too,
    not mirrored: his hands never swap (the sword always in his right hand, the fang in his left).
    He swoops low to lunge and to fly, so that his blade and his body pass through the heroes, not
    over them. His effects are Sacha's drawings too (`art/bosses/Morvane`, `client/js/frenzyfx.js`):
    the frenzied flame flying and bursting, the Eye, his fang, and the band of flame round his arena
    (`fx-frenzy-band`, four frames sampled at 3 px, its drawing having no even grid to find; its
    bottom row's grid set 2 px lower, so that all four frames' black base lies on one line). His head
    of flame alight is the Eye's drawing again (`morvane-head`), sampled at 5.4 px so that its
    pixels are his body's at the size his head is drawn, its last two frames moved down 5 rows so
    that its hole stays still (the Eye's own frames jump); where the hole is in each of his drawings
    is `HOLES` in `client/js/heroes/morvane-flame.js`, and his head alight is set a little bigger
    than the hole there (`HEAD` in `client/js/frenzyfx.js`), as the tongues he's drawn with reach
    further from it than the Eye's.
  - Tuning (health, speed, how long he runs and pants, the change's timings, how much he grows) is
    `MORVANE`, `CHANGE` and `GROW` in `client/js/morvane.js`; his second form's (how fast and how
    often, how far each blow reaches, what each takes, the Eye) is `FLAME_FIGHT`, `EYE` and
    `MORVANE_MOVES` there. His size is `px` in `client/js/heroes/morvane.js`.
- **The fight:**
  - Enough damage in quick succession breaks his stance: he reels and takes more from every blow.
  - As you step in and he enters, the camera shows him for a few seconds, then comes back to
    you. Q turns the camera's focus on him (you and him both in view, pulled back to keep his
    height), and Q again gives it back to you. The key is taught in the tutorial, by the training
    yard's great dummy, where the hint **Press Q to focus on the boss** floats in the middle of the
    lower half of the screen (a click on it works too); it no longer shows in a fight. The camera
    stays a little further back than usual all fight, and returns to your own zoom when it's over
    (`BOSS_CAM` in `client/js/config.js`).
  - Every click is a strike: nobody can be clicked, inspected or carried off until the fight is
    over.
  - The sessions' banners across the screen (a region rising, a quest fulfilled or failed, an
    incantation) don't show while a great enemy is abroad, and aren't kept for after it. Only the
    fight's own banners do, and one of those never waits behind a session's: it cuts it short. The
    message log still lists everything.
  - A session that drew the enemy (its failing rites, its fall, its endless quest) wounds it each
    time it fulfils a quest: a quarter of its health, as the log says ("the great enemy reels").
- **Falling:**
  - A Tarnished who falls is out for good. It lies where it fell for a moment, then goes by grace
    to Roundtable Hold and rests at the grace until the fight is over.
  - When you fall, you see "YOU DIED", and the character you were is out too: it goes to rest at
    the Hold like the others. A panel then lists the fighters still standing (with their health);
    choose one to carry on the fight as them. Their face flies up out of its row into your big
    frame, growing as it goes, and the fallen character's flies down to the foot of the list.
  - Outside a fight, or once it's over, you rise at the Hold's grace instead (resting at a grace
    heals you).
- **Outcomes:**
  - **Won:** "GREAT ENEMY FELLED".
  - **Lost:** when nobody is left standing on the arena (you fall with no fighter left to carry
    on as, or every fighter has fallen while you're away), "THE GREAT ENEMY PREVAILS" and he fades
    into red mist.
  - **Withdrawn:** he leaves on his own after eight minutes.

  Nothing here ever reaches Claude Code.
- If no enemy's art loads, no great enemy comes at all.

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

Each visit has its own hour (`VISIT` in `client/js/daylight.js`): the one the real clock gives,
moved on or back to two minutes before the middle of the next dusk or dawn, so that even a short
visit sees the light turn and the Twofold change form. It holds there under the title and through
the tutorial, and goes on from the moment you set out. Add `?time=day` or `?time=night` to the
address to hold one, or `?time=fast` to watch a whole day pass in two minutes.

### Light

Whatever shines lights the world round it: the floor, the walls, and everyone near, in its own
colour. The world keeps 16 real lights and hands them to whatever counts most where the camera
looks (`client/js/world.js`); one handed from one source to another dies away before the next
comes up, so nothing blinks.

- **Lamps:** braziers, torches, candles, lanterns and graces, as ever; less by day.
- **What glows on a character:** Corisande's crystal, Solenne's ring, Fortuna's frost blade,
  Maren's red lightning, Vael's blood magic, Ruadan's maul, the spectres' glow, a subagent's wisp.
  Each light comes from where the glow is in the frame shown, so it swings with a blade, and it
  sits a step in front of them, lighting what's round them more than themselves. Their colour and
  strength come from the sheet's own glow (`client/js/heroes/core.js`, `client/js/npc.js`). Like
  the lamps, they matter less by day.
- **Effects** (`client/js/lights.js`), as bright by day as by night, and given a light before any
  lamp:
  - for as long as they last: a spell or a tome in flight, Corisande's glintstone arrow, Solenne's
    wall of dawn, Aurelion's wave and the golden giant behind him, the aura round whoever looses
    an ultimate (from behind them), Fenrath's crescent, lance and ghost sword, the Golem's
    meteors (each lighting the floor more and more as it falls) and the fire in his chest as he
    gathers it, spits it, and lies felled with it laid open;
  - for a moment: each burst where something strikes home, hit sparks, Maren's bolts (the great
    one brightest of all), Ruadan's golden explosion, pillars and spikes out of the floor, beams,
    Wynn's cuts, Fenrath's slam, landing, half-arena cuts and eruption, each meteor landing, a
    fast traveller going and coming in golden light, and the Twofold's and the Witch's change.

## Sound

The Lands Between are heard (`client/js/audio.js`, Web Audio): the great enemies, everyone's
footsteps and blows, every hero's ultimate and spells, the stations, the spectres, the training
yard's dummies, the banners and setting out. The sounds are cut from Sacha's recordings (`client/assets/sfx/IMPORT/<their folder>`,
one per hero or kind, and a few loose in `client/assets/sfx`, kept as they are and never deployed) into a set
each (`client/assets/sfx/<set>`): small MP3 clips, about 6 MB in all (the Golem's and Morvane's
fetched only as their fight begins). A recording that holds many
of one sound (footsteps, landings, lightning) is cut into each of them, every other sound from where
it starts, each levelled to one peak; a recording's 1 and 2 (and 3) are heard together, levelled as
one (left out: `dontuse.wav`, as named; `golem_explosion_on_spitfire`, `maren_ult_start` and both
`maren_ult_start_on_click`s, replaced as Sacha asked; `Stone Chain Jump` and
`Stone Chain Land`, as everyone comes down on `Stone Land`; Ruadan's `hammer_hit`, its sound not
good enough; Wynn's `unsheathe`, as asked; Morvane's `morvane_sword_removed_after`, out of his
change and of the Frenzied Eye's pull, as asked).
`node scripts/cut-sfx.mjs [set]` cuts them again, from the recordings, whenever they change; its
table says what each clip is cut from.

- **On the moment of what makes it:**
  - a footstep as each of his feet is set down: the walk's first and fifth drawings, where a foot
    lands, one of the 11 at random, a little different each time;
  - a whoosh as the axe or the pole is raised, and a boom on the drawing where it strikes: the
    swing, the thrust, each slam, the pole driven in for his fire;
  - a clang when his stone turns a blow; `golem_ankle_hit_1` and `_2` together when a blow or a
    spell lands on his cracked ankle;
  - as he passes out (or dies), his stone crumbling as he falls: `passing_out_start_1` at once, from
    its first crackle (the faint stretch before it left out), with `Rock Meteor Throw 2`
    (`freepassoutsound`) as he tips over, and halfway through his fall `passing_out_start_2` on top
    of it; both stop as his body hits the floor, on the drawing where it does, and the ground hit
    and `Rock Wall 1` are heard then (the ground shakes and the dust flies then too). Nothing
    crumbles while he lies felled;
  - the fire roaring up as he spits it (begun 0.3 s before, so that the roar is at its loudest as
    the fire comes), `Firespray 2` (`freeexplosionspitfire`) as it bursts out of him, the blaze
    burning on, looped, while he does, and dying away as he stops;
  - each meteor as it's flung up out of him (`Rock Meteor Throw 1` or `2`, `freemeteor`) and as it
    lands, and the swarm of them (`Rock Meteor Swarm 1` or `2`) as the first is flung;
  - `golem_roll` as he rolls out of the crowd (a second of its rumbling), and `golem_air_shock` as
    his lunge throws its shock of air on past the axe.
- **Footsteps** (everyone's, `client/js/npc.js`): each foot as it's set down, on the walk's first
  and fourth drawings (where every rig's walk has a foot land), one of its kind's at random and a
  little different each time, its pitch and loudness: Maren, Aurelion, Ulric and Jorvik in armour,
  its chain clinking (`Stone Chain Walk 1`–`5`; running, `Stone Chain Run 1`–`5`); Solenne and
  Fortuna in heels (fifteen of `heels`' 34 steps, the clearest); Vael and Corisande in soft shoes
  (the step in `footstep_in_the_fourth_second`'s fourth second, from 2.96 s); Ruadan barefoot (only
  the step between 1.4 and 2 s of `footsteps-barefoot-tile`, from 1.65 s, its pitch picked anew each
  time so that it never sounds the same twice); everyone else plain on stone (`Stone Walk 1`–`5`,
  `Stone Run 1`–`5`); Fenrath's deeper and heavier (`Stone Walk`, slowed). Running with Shift (you)
  or in a hurry (a fighter rushing in). Yours a little louder than anyone else's; heard only near
  where the camera looks, fading out to nothing 22 units off; none mid-dodge, in the air, carried,
  or from the spectres, who float.
- **Coming down**: `Stone Land`, whoever it is (a pitch of its own each time), as you push off into
  a dodge (quieter) and as you come out of it, as a fighter hops a shockwave or a cut and as they
  come down, and as a Tarnished you carried is set down.
- **Blows**: one of `Sword Attack 1`–`3` with every blow but Maren's and Ulric's (one of
  `spear_thrust` and `spear_thrust2`, their spears), Wynn's (his own `slash`, below) and Ruadan's,
  each cut to be at its loudest 0.12 s in and begun that long before the blow lands, so that it's at
  its loudest as it does; yours louder than the others'. Ruadan's maul: one of the
  three Sacha chose of `hammer_hit_2_variations` (between 1 and 2 s, 10 and 12, 12 and 13: each
  from just before its crack, so that it cracks as the maul lands), or `hammer_hit_2`, or
  `hammer_hit_3` (levelled a little lower, as loud as the rest), as it lands: each blow of his, and
  thrown, as it strikes something and as its head is driven into the floor. Thrown: `hammer_woosh` at each half turn as it
  spins out (about six a second), and `hammer_coming_back` (between 1 and 3 s, as named: at its
  loudest about as the maul is in his hand) as it's pulled out of the floor and flies back.
- **Wynn** (only him; whoever plays him, thee or another), each on the drawing where it happens:
  - `slash` with every blow but his Iaijutsu's, on the drawing where his blade cuts;
  - `ult_pressed` as his Iaijutsu is loosed (thine, as R is pressed), as he takes his stance, and
    with it `concentration_breathe`, his breath as he gathers himself: its first 1.1 s, fading out
    as the first cut comes;
  - `blade_shine` half a second on, as the blade leaves the scabbard and the glare flashes up on it
    (from 2.5 s in its recording, where the shine is: before it, a click and hiss);
  - `ult_slash` on each of his eight cuts (from where it's loud, 2.36 s in: it's silent till 2.1 s,
    then swells), short enough that they stay apart;
  - `blade_shine` again, backward, as the glare flashes on the blade once more at the end: its ring
    swelling into the shine and gone as the blade goes home;
  - `ult_damage_dealt` as the blade goes home and all of it lands on him at once.
- **Fenrath** (`client/assets/sfx/Fenrath`):
  - `fenrath_appearing` (the newer recording) as he comes into the arena;
  - `fenrath_anticipation_atk` as he draws back his swing and his lunge; `fenrath_slam_charge` as
    the ring of light gathers round him for his slam (hushed as he slams); the
    swing's cut: `fenrath_sword_woosh` (from just before its loudest) and `fenrath_greatsword_hit`
    as the greatsword lands, with `fenrath_arch` and the first second of `fenrath_red_crescent` as
    the arc of red light leaves his sword; `fenrath_lunge` (Sacha's newer recording) begun as he
    draws back so that its thrust, 1 s in, falls on his (partway into it, when he draws back quicker
    than that); `slam` as the blade goes into the ground;
  - his leap: `fenrath_trembling_before_jump` as he crouches and trembles (a stretch of its 42 s,
    hushed as he springs), `fenrath_jump` as he springs (from just before its loudest; and as he
    springs up in his great attack too);
  - `fenrath_hit` as a blow, a spell or an ultimate's blow lands on him (not a bleeding or poison as
    it ticks), no more than one a moment; `fenrath_death` as he's felled;
  - one of the four growls in `fenrath_growls` as he speaks, as his stance breaks, and every 8 to 14
    seconds as he fights, never two within 2.5 seconds;
  - `fenrath_eruption` as the ring erupts at the end of his great attack;
  - his great attack: `roar` and `fenrath_big_atk_start` as he roars at the sky; as he springs up,
    `fenrath_big_atk_during` and `fenrath_big_atk_during2` together, on till it ends, then dying
    away; `fenrath_big_atk_sword_hit` on each cut of the ghost of his sword;
  - `fenrath_jump_landing` each time he lands, from a leap or from his great attack (the recording
    holds three landings: one at random).
- **Morvane** (`client/assets/sfx/IMPORT/Morvane`, his first form's in its `morvane_phase_1`, cut
  into the `frenzy` set):
  - `morvane_starts_running` each time he breaks into a run (from its first sound), and
    `morvane_out_of_stamina_1` and `_2` together as he stops, out of breath (the first, a stretch of
    its long panting, hushed as he runs again); his bare feet as he runs, on the run's first and third
    drawings (everyone's `bare` step);
  - his change, heard wherever you are, holding the music down: `morvane_removing_sword_during`
    (from its first burst, 0.8 s in) as he grips the sword;
    `morvane_removing_sword_during_end` coming in halfway through that, his scream, heard to its end
    before his head comes off (it comes off 6.45 s after the scream begins, `CHANGE` in
    `client/js/morvane.js`); `morvane_sword_removed_instant`, `_instant_second` and `_instant_second2`
    together as it's ripped off; `morvane_before_reveal` as he grows (its silent lead-in left out);
    `morvane_blackscreen_to_flame_reveal` (Sacha's newer recording) and `…2` together as the screen
    goes black, swelling into the reveal; `morvane_reveal` and `morvane_reveal2` together as he's
    revealed, with `morvane_reveal3_low_volume` quietly under them, all dying away as the fight
    begins (each of the long ones cut to 14 to 20 s);
  - his second form: `morvane_teleport` as he vanishes (once: from just before its burst, so that it
    bursts as he's gone, and dying away as he moves on, never heard under the lunge that follows);
    `morvane_flying_woosh`, `2` and `3` together each time he lunges and as he flies (begun as he
    coils to lunge, so that their rush comes with the thrust); `morvane_sword_anticipation` as he
    draws his sword back to slash; the three whooshes in `morvane_sword_woosh` with each slash and
    lunge, and as the fang is thrown and comes back (in turn, each heard before any is again);
    `morvane_before_knife_throw` as he throws the fang (its short whirr begun just before, so
    that it crests as the fang leaves his hand); the Frenzied Eye: `morvane_big_attack_eye_positioning`
    as he rises into place over the middle of the arena, `morvane_big_attack_eye_start` as it opens,
    `morvane_big_attack_eye_during` under it all the while it swells (its steady stretch looped, the
    music held down meanwhile, and dying away as it bursts), and `morvane_dodge_signal` as it's about
    to burst, the cue to dodge (the opening and the roar over full scale in their recordings,
    levelled lower); `morvane_felled` and `2` together as he's felled (his cry raised, held under full scale, to be heard over all else; the second well
    under it), heard whole through his fall, and `morvane_felled3_sword_dropping` and
    `_fang_dropping` with them, a little quieter, each where his sword and his fang fall;
  - for now, till he has his own: struck, your own `player_hurt`, higher for his first form and
    deeper for his second; the falling flames bursting, the Golem's
    `meteorite_hit`; the bare fang stabbing into the floor, Fenrath's ghost sword striking, higher;
    the Eye bursting, the Golem's `Firespray 2`.
- **Maren's thunderbolt** (her right click): one of the sixteen zaps of `maren_atk1`, a different
  one each time, and with it the rush in `maren_atk2` (between 2 and 3 s, as its name says: from
  where it's heard, so that it peaks as the bolt is there).
- **The ultimates**:
  - anyone's, the world standing still as the camera closes on them: `effect_on_click` (`During
    everyones ult camera focus`) the moment it's loosed, from about 2 s in, as Sacha wants (from
    where it rises, 1.9 s, to its end), quiet enough under what's heard of them meanwhile (Wynn's
    breath, the glare on his blade), and stopped as it strikes (Wynn's after a second, the others'
    after 1.85 s);
  - Maren's Red Storm: `maren_ult_start_on_click2` as R is pressed and the camera closes on her,
    from its first sound (2.9 s in) and over as the storm breaks; then each of its twelve bolts as
    it strikes, one of six strikes cut from
    `maren_ult_small_lightning`, and the great bolt that ends it, `maren_ult_big_lightning` (from its
    strike, 4.36 s in, its thunder rolling on);
  - Jorvik's Flight of Tomes: one of `jorvik_ult_book1`, `2` and `3` as each of its seven tomes
    springs up;
  - Aurelion's Radiant Verdict: `aurelion_ult_start1_at4.5s` as it's loosed (its third, from 4.82 s,
    as its name says), `aurelion_stand_appear` as the giant of his light rises behind him, and one
    of the fifteen blows of `aurelion_stand_hit` as the giant strikes; and all through it his own
    music, `ult_theme`, from 2.5 s in as Sacha wants (where it comes in in full), from the moment
    it's loosed till a quarter of a second after its wave strikes, dying away then, the game's own
    music held down meanwhile;
  - Ruadan's Hammerfall: `ruadan_ult_jump` as he leaps (from 1.2 s, begun 0.22 s before he springs
    so that it's at its loudest, 1.42 s, as he does; over as he lands), and
    `radahn_ult_landing_explosion` as the maul strikes and the gold explodes;
  - Fortuna's Frostfall: `new_ice_rock_shattering` as each of its three great icicles shatters,
    and `Fortuna_ult_debris_explosion_end` as its mass of ice bursts;
  - Corisande's Glintstone Arrow: `ult_hit` as it strikes home;
  - Ulric's Tenfold Spears: `spear_woosh_1`, `_2` and `_3` together as each spear leaves his hand
    (and as he throws his one spear, right click).
- **The spells**: Corisande's `Sellen_projectile` and `_2` together as she looses one; Vael's
  `Vael_blood_blob_projectile` as she looses her gout of blood, and `atk_impact` as it lands on what
  it struck; Solenne's `magic-spell` with a lance or a halo of light, and the healing light as light
  falls on him; Fortuna's `Ice Throw 1` or `2` as she looses one, and `Fortuna_spell_atk_lands` and
  `_2` together as it lands on what it struck.
- **The world**: `anvil-hit-1` and `-2` together with every hammer blow at a forge;
  `summoning-magic-spell` each time you invoke a ritual circle (E) and as a spirit ash (a
  subagent) is summoned; `raven` as a raven takes wing from its tower (its wings beating, dying away
  as it flies off); `bell` each time the bell at a fog gate rings; `noble_sorcerer` and `_2`
  together as a spectre of the Noble Sorcerers is called up at its grace; `dummy_hit` each time a
  dummy of the training yard is struck (a blow, a spell, each blow of an ultimate; not a poison or
  a bleeding as it ticks, nor the blow that breaks it), and `dummy_breaking`, `_2` and `_3`
  together as one bursts (a straw one's each at a pitch of its own, anywhere from a little lower to
  a good deal higher; the great one's louder, and lower than any, struck as bursting); and
  `after_click_start_your_tarnished_journey` as you set out from the title.
- **The training yard's rune rocks** (`client/assets/sfx/IMPORT/Tutorial rocks`, cut into the `rocks` set),
  each where the rock stands: `rock_rune_lighting` as its rune lights (from its first sound, so that
  it crests as the rune is alight); `rock_levitating` as it's lifted, humming on while it's held up,
  and `rock_levitating_very_quiet` under it, very quietly, as it's named (both hushed as it drops);
  `rock_falling` as it drops (its rush at its loudest as it lands); `rock_fall_impact` as it crashes
  down and its shockwave goes out (from just before its blow, so that the blow falls on the frame
  it lands; over full scale in its recording, and the fall's too: both levelled lower).
- **Changing form**: `twofold_change` as the Twofold changes at dusk and dawn, and `sellen_mask1` and
  `sellen_mask2` together as Corisande's mask goes on or comes off, each at its loudest as the new
  form bursts out.
- **You, struck** (by a great enemy, or the tutorial's shockwaves): `player_hurt`.
- **Every banner** (a great enemy approaching, felled, prevailing or turning away, *You Died*, a
  region rising, a quest fulfilled or failed): `announcement_banner_reveal` as it's revealed, from
  its first sound (0.65 s in: silent before), swelling as the banner comes up and dying away about
  as it goes; heard alike wherever you are.
- **Where it happens:** quieter the farther it is from where the camera looks (the footsteps and
  the landings not heard at all past 22 and 30 units), to the left or the right as it shows on the
  screen, and never too many of one at once (eight meteors).
- **Music** (Sacha's pieces, `client/assets/sfx/IMPORT/Music`, kept as they are and never deployed,
  levelled into `client/assets/music` by `scripts/cut-music.mjs`: stereo MP3s, 6.5 MB in all, the
  two ambient pieces alike and the arena's a little louder):
  - while no great enemy stands in the arena, `ambient_1` and `ambient_2`, one after the other, a
    breath (3 s) apart, on and on;
  - as one enters it, the ambient dies away and `arena` comes in, from its start, and plays over
    again as long as he stands; felled (or gone), it dies away, and after a moment's quiet the
    ambient comes back where it left off.

  The pieces stream as they play (each from its own player, never decoded whole), quieter than
  the sounds of the fight (`MUSIC` in `client/js/audio.js`: how loud, how fast each comes and goes).
- Nothing sounds before you set out: a browser lets a page play sound only once it's been clicked.
  **V** turns the sound and the music off and on, and it's remembered; so are the settings' two
  sliders, how loud the sound effects are and how loud the music (`setVolume` in
  `client/js/audio.js`: each has its own way out, the music's after its ducking).

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
(CLI or the desktop app's Code tab) appear while the bridge is running. To fill the world with
fake sessions if you just want to watch, add `?demo` to the address (they come as you set out);
`npm run simulate` pushes fake sessions through the real hook.
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
  - Everything else works as locally: become anyone, fight, the Round Table. There is no event
    log: the page is marked as the demo's from its first moment (`scripts/build-public.mjs`),
    before any script runs.
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

## Credits

Shown in the game too, at the foot of the **?** panel.

- **Sounds from [Freesound](https://freesound.org)**, under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), cut, levelled and converted to MP3
  for the game (`scripts/cut-sfx.mjs`):
  - "[Explosion](https://freesound.org/s/728763/)" by TechspiredMinds: the Golem's strike
    (`golem_atk.wav`);
  - "[yasomasa_or_akazawa_inspired_bass_kick_explosion_drum_09082025](https://freesound.org/s/825797/)"
    by Artninja: four of his footsteps (`golem_footsteps_type2.wav`);
  - "[Rocks - Crumbling / Falling - Designed Rocks](https://freesound.org/s/555048/)" by Gregor
    Quendel: his stone crumbling as he falls (`golem_passing_out_start_2.wav`);
  - "[Magic Healing Spell SFX - Fantasy RPG Restore Effect](https://freesound.org/s/853303/)" by
    TommasoMotteran (credited as Coghezzi, as asked): Solenne's light falling;
  - "[Custom_yasmoasa_koyama_heaven_feel_heavy_sword_hit](https://freesound.org/s/819311/)" by
    Artninja, made with "Sci-Fi Bass Blast" by magnuswaker and "vas deferens 1.wav" by Logicogonist
    (both CC0, credited as Artninja asks): the blows of Aurelion's giant (`aurelion_stand_hit.wav`).
- **From [Freesound](https://freesound.org)**, under
  [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (non-commercial: fine for this
  free demo, not for a game that's sold): "[DSGNVocl_Weird Whispering Spells.Dry_EM](https://freesound.org/s/763000/)"
  by newlocknew, the spectres' whispering.
- **Named in the recordings themselves**: Fenrath's landings, by Nox_Sound; his great attack's
  drone, by In Motion Audio;
  Aurelion's verdict, from *Melee Weapons* by Just Sound Effects (Robert Millotat); setting out, by
  Jake Fielding.
- **The banners' sound**: "Campana" by Hugo Barbero (Banco de sonidos), `announcement_banner_reveal.wav`.
- **Music**: "Defending the Village" by Benjamin Botkin (`ambient_1`), "Deliverance" by Aaron Paul
  Low (`ambient_2`), "Halls of Ancients" by Ian Aisling (`arena`).

The other recordings carry no source of their own; any that needs a credit goes here, and in the
**?** panel (`client/index.html`).

## Layout

```
hooks/emit.js           the Claude Code hook (sanitises and forwards)
server/bridge.js        localhost HTTP + SSE server, static files, and the baked sheets checked as they're served (and baked again when stale)
server/events.js        allowlist validation
server/registry.js      per-session state for late joiners
scripts/                install/uninstall hooks, simulator, the art and sound tools, and bake-sheets.mjs (the characters' sheets baked ahead of time)
client/js/title.js      the title screen: the pixel-art wordmark, sigil and embers, the way in, loading
client/js/gate.js       where the title and the world meet: set out, and ready (and the tutorial asked for again)
client/js/tutorial.js   the tutorial on the first journey: its steps, the keys drawn as keys, the world held back meanwhile
client/js/runerocks.js  the training yard's rune rocks: their turns round their ring of cyan light, their shockwaves, the dodges counted
client/js/sprites.js    procedural pixel-art characters (base body + equipment layers)
client/js/world.js      sky, far skyline, mist, islands, bridges, pooled lights
client/js/lights.js     what lights the world besides its lamps: effects, and what glows on characters
client/js/audio.js      sound: the clips, played where and when things happen (the Golem's, Wynn's, the banners'), and the music
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
client/js/interact.js   E: using the stations, the Round Table and the training yard's grace
client/js/arena.js      the Arena of Trials, north of the Hold and higher, and the stone stair up to it
client/js/yard.js       the Training Yard below the Hold, and the stone stair down to it
client/js/training.js   the yard's dummies (straw, and the great one: the Golem in wood, struck only on its ankle), their health over their heads, thy blows, spells and ultimates on them, and the Tarnished training there
client/js/ground.js     the ground's height where it isn't level with the Hold (the yard, the arena, their stairs)
client/js/fight.js      great enemies: what brings them, Fenrath's attacks, the fighters, thy health and the faces by it
client/js/faces.js      a character's face for those frames: the head and shoulders of its idle drawing
client/js/companions.js choosing thy companions as one comes: the slots, the catalogue of heroes
client/js/golem.js      the Guardian Golem's fight: his weak points, his fall, shockwaves, fire
client/js/morvane.js    Morvane's fight: fleeing and out of breath, his change and reveal, his second form's blows, the Frenzied Eye
client/js/frenzyfx.js   Morvane's frenzied flame, drawn: flying and bursting, his thrown fang, the Eye, his dropped sword and fang, and his arena once he's revealed (black beyond, a ring of fire, heat haze, ash)
client/js/felled-loop.js  ?felled: Morvane felled again and again, to watch and hear his fall
client/js/ripple.js     the arena floor rippling like water under the Golem's shockwaves (and the tutorial rocks' yard's, under theirs)
client/js/bossfx.js     the enemies' effects: crescent, lance, floor marks, the ghost sword, the eruption, the air shock, meteors
client/js/director.js   event → behaviour, regions, slash-command effects, chatter, visits
client/js/voices.js     how each character talks: base lines and every voice's version of them
client/js/lore.js       names, epithets, session tallies, conversation topics
client/js/post.js       bloom, tilt-shift, colour grade; Fenrath's darkness and the shockwaves of his roar
client/dev/sprites.html sprite-sheet viewer
client/dev/fire.html    the fire loops, enlarged
```
