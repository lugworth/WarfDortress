# WarfDortress / ASCII Fortress

A Next.js fortress simulation with a local TypeScript engine, Firebase cloud saves, and optional Gemini lore/advice/speech.

## Local development

Use Node.js 22.18+ (including native TypeScript stripping) and Bun 1.4+.

```sh
bun install --frozen-lockfile
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Set `APP_URL` to that same origin (including the port). Gemini is optional: leave its key empty for deterministic gameplay and offline advice. A configured API key stays on the server. Configure the Firebase project in `firebase-applet-config.json` and enable Google sign-in for your development/production domains to use cloud storage.

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm start
```

The build uses Next's standalone output. For a deployed standalone bundle, copy `public/` (if present) and `.next/static/` alongside `.next/standalone/`, then run its `server.js`. `npm run clean` removes only this project's generated Next build directories.

## Saves and migration

Use **Save / Ctrl+S** (Cmd+S on macOS) and **Continue Local Fortress** on the realm screen. The versioned format preserves the world seed exactly, all terrain/construction/designations, dwarf progress and equipment, hostiles, work orders, diplomacy, history, calendar, and pause/speed settings. Terrain visuals are reconstructed from compact numeric tile records. Version 2 also saves commissions, faction favor, named relic ownership/history, dwarf quirks, and relationships. Version 1 snapshots migrate automatically; the original tile-index tables remain unchanged. A last-good local backup is tried when the primary save is damaged. New snapshots have a 900 KB serialized budget; an oversized save fails explicitly rather than being truncated.

Cloud records now live under `users/{uid}/saves/{fortressId}`. Each new expedition has an independent ID. **Deploy the updated `firestore.rules` before using the new cloud writer.** `firebase.json` targets the named database in the checked-in app configuration. With the intended Firebase project selected and an authenticated CLI, deploy rules with `firebase deploy --only firestore:rules --project <project-id>`.

Old unversioned full local saves and version-1 snapshots are migrated on load. Later-season legacy cloud summaries initialize their new guild board from the restored calendar. Up to 20 old aggregate relics gain archive names on migration; the rest retain their original resource count. Old `/saves` cloud records remain listed and loadable, but they contained only summaries: buildings and dwarf progress absent from those records cannot be recovered. The load message explains this; saving again creates a full snapshot in the user namespace. Cloud sync is attempted even if local storage is unavailable.

Rule changes here have not been deployed automatically. Tests cover snapshot integrity and user-specific paths; a live/emulator rules integration check still requires a Firebase emulator/runtime or a configured test project.

## AI request limits

All five AI routes validate JSON body sizes before contacting Gemini. Text/history/images and generated event rewards are bounded; requests have upstream timeouts and model cooldowns. Image upload supports PNG, JPEG and WebP up to 2 MB and preserves the actual MIME type. Speech preserves the response MIME type and wraps raw PCM only when needed; browser speech is the fallback. Audio formats follow [Google's speech generation documentation](https://ai.google.dev/gemini-api/docs/speech-generation).

Production AI requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for a shared, atomic budget: at most 12 requests per client bucket per minute and 300 requests total per UTC day. Redis failures stop paid calls. The configured Redis database should be dedicated to this application or account for the `fortress:ai:*` key namespace. These are request limits; one request may attempt multiple fallback models.

Only set `AI_TRUSTED_IP_HEADER` when the deployment's reverse proxy strips/replaces that header. Without it all guests share one bucket. Development uses an in-process budget. A deliberate single-instance production deployment may opt into that fallback with `AI_ALLOW_PROCESS_LIMITER=true`; its counters reset on restart and do not coordinate across instances. Without either production option, AI routes return an explicit unavailable response and gameplay remains usable. Advisor fallback text is labeled as offline advice.

## Guild Hall features

Open **Guild Hall** from the in-game toolbar. The simulation pauses while you make decisions and returns to its prior pause state when the panel closes.

- **Royal commissions:** two offers arrive each season. Accept one at a time, accumulate the listed stock, then explicitly deliver before the season ends. Delivery consumes the goods and awards wealth, faction favor, and a named relic exactly once. Expiry has no resource penalty. Favor 15 turns neutral factions into trade partners; favor 30 earns an alliance. A goblin alliance stops automatic raids and spontaneous siege decrees; the manual test war horn remains available.
- **Named relics:** commissions, cavern reclamation, and artifact decrees add named objects with a discoverer and bounded history. Display one for a recurring clan blessing with food/ale upkeep, equip it for work/combat bonuses and a bearer burden, or permanently gift it for 15 faction favor. One relic per dwarf; equipping another stores the previous one. Stored/gifted relics have no active effects. Gifted histories stay visible in the archive.
- **Clan stories:** each founder and migrant gets a lasting seeded quirk. Stonewise dwarves work stone faster but tire; ale enthusiasts get more drinking morale and consume extra ale; brave dwarves deal more damage; loners prefer space. Shared victories build bonds. Nearby companions within three tiles of a tavern build friendships or personality clashes every 20 ticks. Nearby friends/rivals affect morale, capped at two points per interval. The panel shows each relationship's last cause.

These systems run entirely in the local simulation and do not require Gemini or additional paid services.

## Controls and simulation

Tool shortcuts appear in the command sidebar. B selects beds, W walls, M farms, and S stills; F toggles the sidebar and Ctrl/Cmd+S saves. Escape closes dialogs; numbered event choices work while their dialog has focus. Map designation supports mouse and touch/pointer input. Surface presets explicitly target Z-0 even when invoked underground.

Dwarves route through walkable tiles, do not cut wall corners, and only change depth through paired stairs. Unreachable jobs remain unclaimed so they cannot strand workers. Labor changes cancel incompatible active jobs. Production has capacity per built workshop and rotates competing recipes fairly. Trade checks both current inventory and charter values at execution. Recruitment consumes issued gear and respects the 200-dwarf limit.

Existing relaxed survival rules are retained: this patch does not add dwarf deaths, starvation penalties, or new seasonal balance.

## Source map

- `lib/game-engine.ts`, `world-gen.ts`, `navigation.ts`: simulation, seeded terrain, and routing.
- `lib/save-system.ts`, `firebase.ts`, `firestore.rules`: serialization, migration, storage, and ownership.
- `lib/game-rules.ts`: shared limits, shortcuts, inventory validation, and trade prices.
- `lib/guild.ts`, `components/GuildHallModal.tsx`: commissions, relic transitions/effects, personality traits, and clan relationships.
- `lib/ai-request.ts`, `event-validation.ts`, `gemini-server.ts`: request budgets, validation, and provider calls.
- `components/GameProvider.tsx`: commands, simulation clock, async response ownership, and persistence UI.
- `lib/*.test.ts`: engine regressions, round trips/backup recovery, AI validation/budgets, and audio encoding.
