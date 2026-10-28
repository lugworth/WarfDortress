# Deep Anvil

A browser colony simulation drawn in pixel art: a procedural six-level world,
dwarven labor, workshops, militia, trade, and a fortress chronicle. Every tile,
creature, building, and icon is a hand-authored sprite, and the map is alive with
animation: rippling water, churning magma, flickering forges, walking and digging
dwarves, sparks, weather, and torch-lit caverns.

## Run locally

Use Node.js 22.18 or newer. The committed lockfile is `bun.lock`; `npm install`
also works.

```sh
bun install   # or: npm install
npm run dev
```

Open http://localhost:3000. AI-generated lore, decrees, and the advisor use
`GEMINI_API_KEY` in `.env.local` (3.5 Flash-Lite first, then 3.8 Flash; see
`lib/gemini-server.ts`). The deterministic game works without it. Google
sign-in and cloud archives use the project's Firebase configuration.

## Controls

- Choose a tool in the dock at the bottom of the map, drag an area, then press
  Enter (or Queue) to place the order. Build opens walls, workshops, and defenses.
- Scroll or middle-drag (or Alt-drag) to pan; Ctrl+scroll, `+`/`-`, or the zoom
  buttons zoom; `0` fits the whole map. On touch screens, two fingers pan and
  pinch-zoom, and the hand button turns one-finger drags into panning.
- Space pauses or resumes. Selecting a speed preserves the current pause state.
- `/` opens command search. `I` toggles inspection; right-click or Shift-click
  inspects a tile. Escape cancels or closes.
- `[` and `]` change depth. With the map focused, arrow keys move the cursor and
  inspect; Shift+arrows select an area.
- The minimap (top right) jumps the view; the side rail opens Clan, Quests,
  Stocks, and Radar on the left, Chronicle and the guide on the right, and the
  Guild, Trade, and Decrees dialogs. On phones the rail moves to the bottom.
- Menu → Settings controls text size, map zoom, high contrast, labels, tile tips,
  reduced motion, and interface sounds. The system reduced-motion setting is
  respected too.

New colonies start paused. Decision dialogs pause the simulation and restore its
previous state when closed. The simulation stops advancing while the browser tab
is hidden.

## Goal and tutorial

Grow the colony into a Mountainhome Capital by reaching 25,000 fortress score.
The goal beneath the fortress name opens milestones, building unlocks, and rank
progress. Score comes from wealth, population, workshops, exploration depth, and
relics.

Locked blueprints cannot be queued from any tool, including inspector shortcuts.
Each building type's manual action (Inspect a building, or Clan & orders →
building actuators) recharges for 24 ticks after use. Dwarves who fall in combat
leave the clan for good; seasonal migrants can still arrive if provisions allow.

New colonies open a 13-topic guide covering map controls, all building categories,
workers and defenses, trade, Decrees, Guild Hall, expeditions, and saving. Use
Menu → How to play to resume or replay any topic. The guide starts paused; Finish
& resume starts the simulation.

## Saving

The game saves the complete fortress to this browser every 15 seconds, when
leaving the game, and when the tab is hidden or closed. Save also writes a local
checkpoint immediately. Continue on the realm screen restores the saved map,
dwarves, orders, resources, and guild progress, and starts paused.

Opening `?autostart=1` restores the existing local checkpoint if available.

Browser storage is tied to the site's address. A local preview and the deployed
site have separate saves. Clearing browser data removes local saves.

Cloud saves (Sign in with Google, then Save) store the whole fortress: a summary
in `saves/{id}` for the archive list, and a gzip-compressed snapshot of the full
game in `snapshots/{id}`, written together in one batch. A late-game fortress
compresses to under 100 KB. Loading an archive resumes whichever full copy is
newer, the cloud snapshot or this browser's checkpoint of the same fortress.
Archives saved before snapshots existed still load: the map and clan restart
from the seed with the archived stockpiles and calendar. Archive ids are
namespaced per player, so two players who choose the same seed no longer
collide; archives a player already owns keep their old id.

Full cloud saves need the Firestore rules in `firestore.rules` deployed to the
app's database. Until they are, Save keeps working and stores a summary only.

```sh
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules   # uses firebase.json and .firebaserc
```

## Checks

```sh
npm run check   # typecheck, lint, and tests
npm run build
```

Tests cover the simulation, pathfinding, UI models, progression, the
copy-on-write grid, AI route input limits, cloud snapshot round trips, and local
save round trips, including compatibility with original unversioned saves.

The simulation never mutates a published grid: `stepSimulationTick` edits a
draft that copies only the rows it changes (`lib/grid.ts`). Terrain counts are
cached per level, and the map redraws a level's cached terrain only for the rows
that changed. Treat `GameState.grid` as immutable outside test setup.

## Pixel art

Sprites live in `lib/pixel/sprites/` as text art: one character per pixel, looked
up in the fixed palette in `lib/pixel/palette.ts`. Dwarves have recolorable
clothing and beard slots, so every dwarf keeps their own outfit. Stone, grass,
water, and magma textures are generated from seamless noise
(`lib/pixel/procedural.ts`). Preview every sprite as a contact sheet with:

```sh
node --experimental-strip-types scripts/sprite-sheet.ts sprites.png 4
```

`lib/pixel/map-renderer.ts` draws the map on a canvas sized in device pixels at
whole-number scales, so sprite pixels stay square on any screen. It caches each
level's terrain, smooths creature movement between simulation ticks, and adds
particles, weather, and cave lighting. Interface icons are PNG data URLs encoded
without a canvas (`lib/pixel/png.ts`), so they render on the server too.
The interface fonts are Pixelify Sans and Press Start 2P (SIL Open Font License,
bundled in `app/fonts`).
