# ASCII Fortress: Deep Anvil

A browser colony simulation with a procedural, six-level ASCII world, dwarven labor,
workshops, militia, trade, and a fortress chronicle. The interface uses the original
Base16 Isotope Dark terminal palette.

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

- Choose a map tool, drag an area, then press Enter to queue the order.
- Space pauses or resumes. Selecting a speed preserves the current pause state.
- `/` opens command search. `I` opens inspection. Escape cancels or closes.
- `[` and `]` change depth. Arrow keys inspect; Shift+arrows select an area.
- Supplies and weather float over the top of the map.
- Mine, Chop, Gather, Stairs, and Stockpile stay in the floating tool bar at the bottom.
  Build contains construction, workshop, and defense tools.
- Clan & orders opens the left panel; Chronicle at the far right opens its own
  right panel. Both can stay open on desktop. On small screens, panels fill the workspace.
- Map options contains labels, compact tooltips, panning, and quick orders.
  Display settings in Menu controls text size, map zoom, and accessibility.

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
cached per level, and the map redraws an underground level only when it
changes. Treat `GameState.grid` as immutable outside test setup.
