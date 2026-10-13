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
from other projects. When work calls and home is far, they fast travel: they dissolve into golden
light and reappear at their region's Site of Grace.

| In Claude Code | In the world |
|---|---|
| Session starts | A Tarnished rises at the Site of Grace |
| New prompt | A quest marker pops above their head |
| Edit / Write | Hammering at **the Forge** |
| Read / Grep / Glob | Studying in **the Scriptorium** |
| Bash / PowerShell | Invoking **the Ritual Circle** |
| Web search / fetch, MCP tools | Sending ravens from **the Raven Tower** |
| Todo lists, plans, questions | Plotting at **the War Table** |
| Subagents | Blue spirit ashes float beside their summoner |
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
    it's all for show). **Space** dodges. **C** crouches.
  - **B** (or clicking yourself) opens your fan of gestures over your head (or **1–8**). Nearby
    Tarnished may answer.
  - **E** uses what you stand by (a prompt shows it): the forge, the scrolls, the war table, the
    ritual circle, the raven tower, the fog gate, a site of grace, and the Round Table. Each
    works as it does for the sessions' characters (the forge glows and throws sparks, a raven
    takes wing…).
  - **M** shows the map of every island. **Z / X** travel by grace to the previous / next area,
    **H** to Roundtable Hold.
  - The **Controls** button (top right) lists all of this.
- **Others:** only the character you are can gesture. Clicking anyone else opens their info panel
  and a fan with just **Become [name]**. You can drag them to carry them elsewhere. Scroll to zoom.
  The region bar (bottom right) and the lines of the message log take you places.
- **Back to Maren:** while you're someone else, Maren lives on her own. She wanders, sits at the
  Round Table and talks in her own voice. To return to her, click her and choose **Become Maren**.
- **Sessions:** a character you take over stops following its Claude Code session, which keeps
  running. When you let go, it walks back to whatever the session is doing. If a generic
  Tarnished's session ends while you're them, you return to Maren.
- **The Twofold:** if you're them at dusk or dawn, you can't move while they change form.

Every time the world loads, the hand-drawn heroes are already seated at the Round Table in
Roundtable Hold, before any island exists, and Maren rises from grace beside them. Each Claude Code
session takes up the next free hero (the eldest session first). Then the islands rise from the mist
one after another, and as each one rises its hero gets up and walks home across the bridges (no
travelling by grace), taking up whatever the session is doing on arrival. When a session ends, its
hero walks back to the Round Table to wait for the next one. Only when every hero is already out on
a quest does a session get a generic Tarnished, who also starts at the Round Table, walks home, and
passes through the fog gate when the session ends.

The project is the session's project root: Claude Code's project folder, or the nearest folder
with `.git` / `package.json` above wherever the session is working. Each project keeps its biome
across reloads.

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
    bracelets and embroidery stay gold.
  - **The change:** halfway through dusk and dawn, golden light gathers and the drawing of the
    change itself (`champion-to-queen.json` at dawn, `queen-to-champion.json` at dusk;
    `client/js/heroes/twofold.js`) holds for a moment. Then the other form bursts out under its
    own name, and the log tells it.

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

The extractor finds the art's pixel grid, drops the background and reduces the colours; give it
several images to share one palette, `--palette existing.json` to match an existing hero's colours,
or `:pitch=px,py` after an input when the art is soft and the grid needs setting by hand.

### Fire

The braziers and the candles on the round table in Roundtable Hold burn with pixel-art fire from
two sprite sheets (`client/assets/fx/`, rigged in `client/js/fire.js`).

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

Boss fights happen in the **Arena of Trials**. It rises from the mist north of Roundtable Hold,
with a bridge from the Hold, when a fight begins. It sinks again only once the fight is over and
everyone has left it, you included (`client/js/fight.js`, `client/js/arena.js`).

- **What brings one:**
  - **Summoned:** at the Round Table (**E**).
  - **Invasions:** by itself every 20–40 minutes.
  - **A struggling session:** three failed tool calls within two minutes, a session ending in
    failure, or a single quest running past ten minutes.

  After a fight, nothing but a summons brings another for six minutes.
- **Who fights:** every Tarnished except the Twofold drops what it's doing and comes by grace to
  fight. Their sessions keep running, and they go back to them by grace afterwards. You fight too,
  as whoever you are.
- **How they fight:** each keeps its own ring around the enemy, circling its own way. When ready, one
  rushes in, strikes and falls back. Seeing a blow coming, they mostly sprint out of its way after
  a moment's reaction, though now and then someone is too slow.
  - **The Bandit Knight** never fights (he's Elden Ring's Patches in all but name). He keeps as far
    from the enemy as the arena allows, dodges everything, and begs for mercy when it comes close.
- **The enemy:** Fenrath, the Crimson Fang (`client/js/heroes/boss.js`, effects in
  `client/js/bossfx.js`). He walks into his target's lane and strikes along it. Every blow shows
  itself before it lands: step out of the way, or dodge through it with **Space**.
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
- **The fight:**
  - Enough damage in quick succession breaks his stance: he reels and takes more from every blow.
  - While you fight on the arena, the camera pulls back to keep him in view. Every click is a
    strike: nobody can be clicked, inspected or carried off until the fight is over.
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
- If the enemy's art fails to load, a stand-in (a towering shade) comes instead.

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
  Generic Tarnished speak the common voice; any of them named **Ysolde** is mysterious and barely
  speaks (`BY_NAME` in `voices.js`). Maren is a storm knight, warm, brave and wry, heard
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
    and end on their own, three to seven at a time.
  - They work in believable runs: exploring, implementing and running tests, debugging, reading
    the web, planning with subagents, shipping through MCP tools. Slash commands, permission waits,
    model switches and compactions come up now and then.
  - New projects rise as islands. An island nobody has worked on for 45 seconds sinks back into
    the mist, if it's the outermost on its side (the others hold up a bridge).
  - Great enemies come oftener: the first after about two minutes, then every 5 to 9 minutes, with
    a lighter enemy (700 health) so the Tarnished can win without you. A run of failing tool calls
    or a session ending in failure can bring one too.
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
client/js/interact.js   E: using the stations and the Round Table
client/js/arena.js      the Arena of Trials, north of the Hold
client/js/fight.js      great enemies: what brings them, their attacks, the fighters, thy health
client/js/bossfx.js     the enemy's red light: the swing's crescent, the lunge's lance, floor marks
client/js/director.js   event → behaviour, regions, slash-command effects, chatter, visits
client/js/voices.js     how each character talks: base lines and every voice's version of them
client/js/lore.js       names, epithets, session tallies, conversation topics
client/js/post.js       bloom, tilt-shift, colour grade
client/dev/sprites.html sprite-sheet viewer
client/dev/fire.html    the fire loops, enlarged
```
