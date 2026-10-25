# Parallel review and feature research

Three agents independently checked correctness, looked for simplification, and researched feature ideas for the current `fix/fortress-correctness` working tree.

## Code checking

The reviewer found no additional P1 issues. Four concrete P2 issues were identified across the correctness and simplification reviews and corrected:

- **Walls could trap a dwarf who moved earlier in the same tick.** Idle wandering now avoids pending wall sites, and wall completion checks positions as dwarves are processed. Tests cover both entering a pending wall site and leaving a site before a builder completes it.
- **Non-string generated event severity could pass enum validation.** Validation now requires a string before checking allowed severities, preventing array/object values from reaching UI string operations.
- **Malformed resource-drop metadata survived save loading.** Both compact snapshots and legacy full saves now validate the resource key and bounded integer amount before exposing them to the Inspector.
- **Valid multilingual advisor conversations could exceed the API body limit.** The client now measures the full serialized UTF-8 payload, including escaping and telemetry, and drops oldest history while retaining the current question. The server and client share the request-limit constant. Optional roster details are omitted only if needed.

The reviewer checked the occupancy and validation fixes and independently approved the final chat serializer correction. The complete local suite has 41 passing tests; TypeScript and lint with zero warnings pass. Live Firebase, Redis, and Gemini integrations were not exercised.

## Simplification

The simplification agent replaced the nested numeric-limit logic in `lib/event-validation.ts` with a named per-field bounds table and small predicates. Existing ranges, defaults, and the free-choice guarantee are preserved. Boundary tests cover all nine numeric fields, absent/zero values, fractions, strings, null, NaN, and infinity.

Further opportunities remain recommendations:

1. Split save validation into named world, dwarf, work-order, event, and tile validators accepting `unknown`. Preserve the version-1 wire-index arrays and guard changes with malformed-save and round-trip tests.
2. Extract one migrant factory and equipment-allocation helper for trade and event recruitment. Test multiple arrivals with limited equipment and population caps.
3. Define construction metadata in a typed registry shared by the engine and sidebar, while keeping special effects and logs explicit.
4. Extract the provider's world-session cancellation/response-ownership lifecycle without changing synchronous command results.
5. Move remaining inline API parsing into pure functions with focused malformed-input tests.

## Researched feature proposals

Implementation update: the first three proposals below now have playable versions in the Guild Hall, including v2 save migration. See the README for controls and exact effects. The remaining four are still proposals.

These are design suggestions inspired by the linked primary developer sources. The table records the original proposals and relative scope; they are not validated player preferences. Effort is relative: S is a contained extension; M adds persistent state; L spans multiple simulation systems. Initial versions can use seeded tables without paid AI calls.

| Priority | Feature | Small playable first version | Existing connections | Effort / inspiration |
|---|---|---|---|---|
| 1 | **Royal commissions** | Choose one optional seasonal contract, such as delivering six axes before winter. Show progress and give a clear reward; missing the deadline only forfeits the bonus. | Work orders, resources, calendar, civilization favor. Unlike decrees, this supplies an ongoing objective. | S/M. [Eremite on optional timed orders and trade offers](https://eremitegames.com/time-is-money-update/) |
| 2 | **Named relics with histories** | Three templates, each with a name, discoverer, benefit, and drawback. Choose display, equip, or diplomatic gift; record owners and notable uses. | Relic discovery, equipment, diplomacy, chronicle. Expands the current numeric relic counter into memorable objects. | M. [Bay 12 artifact discussions](https://bay12games.com/media/df_talk_combined_transcript.html) |
| 3 | **Dwarf quirks and relationships** | One quirk per dwarf and a small friendship/rivalry map, updated by a few shared experiences such as defending the gate. Keep effects modest and visible. | Named dwarves, skills, morale, thoughts, combat, taverns. | M. [Bay 12 development log](https://www.bay12games.com/dwarves/), [Ludeon on social roles and rituals](https://ludeon.com/blog/2021/07/ideology-adds-social-roles-and-rituals/) |
| 4 | **Festivals and craft competitions** | Assign a host, reserve food/ale, temporarily release participants from work, then name a champion. | Gives existing taverns and temples scheduled activity. | M. [Ludeon ritual design](https://ludeon.com/blog/2021/07/ideology-adds-social-roles-and-rituals/) |
| 5 | **Small off-site expeditions** | Send two dwarves to one of three sites for a fixed number of ticks. They return with a report and supplies or a relic; their absence costs labor. | Skills, provisions, civilizations, chronicle. Start with a mission panel rather than another map renderer. | M/L. [Bay 12's 2017 expedition development log](https://www.bay12games.com/dwarves/dev_2017.html) |
| 6 | **Dwarven contraptions** | A lever toggles a portcullis; a pressure plate triggers a linked trap. Defer fluids and complex machinery. | Doors, traps, route planning. Raider routing needs further work first. | M/L. [Bay 12 engineering features](https://bay12games.com/dwarves/features.html) |
| 7 | **Storyteller charters** | Choose Hearthkeeper, Delver, or Warlord at embark to favor different objectives and event pacing. Keep manual event summoning in Sandbox. | Existing event categories and fortress telemetry; adds replay variety. | S/M. [Tynan's original storyteller design post](https://ludeon.com/blog/2013/09/title-screen-update/) |

Recommended sequence: prototype one royal commission, then award one named relic. This yields a compact loop: choose a goal, organize the fortress, earn a memorable object, and decide how to use it. Each persistent addition needs a save migration and tick-based progression tests.
