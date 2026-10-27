# ASCII Fortress: Deep Anvil

A browser colony simulation with a procedural, six-level ASCII world, dwarven labor,
workshops, militia, trade, and a fortress chronicle. The interface uses the original
Base16 Isotope Dark terminal palette.

## Run locally

Use Node.js 22.18 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:3000. AI-generated lore and advisor features use
`GEMINI_API_KEY` in `.env.local`; the deterministic game works without it.
Google sign-in and cloud archives use the project's Firebase configuration.

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

Grow the colony into a Mountainhome Capital by reaching 6,000 fortress score.
The goal beneath the fortress name opens milestones, building unlocks, and rank
progress. Score comes from wealth, population, workshops, exploration depth, and
relics.

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

## Checks

```sh
npm test
npm run lint
npm run build
```

Tests cover the simulation, pathfinding, UI models, progression, and local save
round trips, including compatibility with original unversioned saves.
