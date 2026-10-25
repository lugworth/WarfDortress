# Adventure Hall gameplay update

Three complementary systems add resource decisions and short-term stories alongside the existing fortress simulation and Guild Hall.

## Expeditions

External hired scouts keep the colony roster and labor assignments intact. One trip may be active; it must return and be claimed before another can depart. Costs are atomic at departure. Every successful claim clears the active trip and appends a bounded journey account. Setbacks award the advertised smaller cargo rather than silently consuming a second cost.

| Route | Departure cost | Cautious / bold duration | Cautious / bold setback risk |
|---|---|---|---|
| River Market | 35 wealth, 2 food | 24 / 16 ticks | 10% / 30% |
| Iron Ridge | 60 wealth, 4 food, 2 ale | 40 / 26 ticks | 15% / 40% |
| Lost Vault | 100 wealth, 6 food, 4 ale | 60 / 40 ticks | 25% / 50% |

Cargo and risk are visible before launch. A successful vault survey creates one named relic and updates both the aggregate relic stock and Guild Hall archive. Seed, ordinal, route, and approach determine the outcome; loading an ongoing trip preserves it. The toolbar and priorities strip point to returned cargo.

## Celebrations

All three celebrations last 24 simulation ticks, allow one active event, and have a per-kind 120-tick cooldown measured from their start. Starting spends the listed supplies once. Supper improves morale/energy; a completed mason workshop unlocks contests with +1 actual work progress; a tavern unlocks tall tales and bonds for nearby attendees. Effects are bounded and expire through the simulation clock. Tick guards prevent repeated morale pulses; expired saved effects are cleared without replaying missed rewards. The memory archive retains 18 seeded dwarf anecdotes.

## Engineering

Pick techniques are available at the starting camp (6 stone, 2 wood, 1 iron ore; 18 ticks). Mushroom cellars require a built farm and carpenter workshop (8 food, 6 wood; 24 ticks). Watch drills require a built forge and living militia member (1 weapon, 6 ale; 24 ticks). One project runs at a time; each may be completed once.

Permanent bonuses are derived from canonical completion records: +1 mining progress, +1 food per actual farm at each harvest, and +1 militia melee damage. The engine reads these bonuses directly. Completed research produces a chronicle entry, and the panel retains a small research journal.

## State and compatibility

The new `activities` field is an optional additive extension to the existing full snapshot envelope, with its own `version: 1`. It introduces no new tile indices or resource keys and requires no Firestore schema-version increase. Existing saves without the extension receive empty activity state. Present but malformed activity data is rejected, rather than silently resetting ongoing costs or rewards.

Feature modules contain no UI, network, or wall-clock work. The game engine initializes and steps the systems after each actual simulation tick. UI actions use the provider's synchronous command wrapper so a repeated click sees current state. The Adventure Hall pauses planning and offers manual single-tick advancement; closing restores the original pause state.

## Automated verification

The expanded suite contains 86 tests. New checks cover departure/claim atomicity, seeded outcomes and setbacks, one-time named relic awards, bounded archives, building gates, celebration cooldowns and pulse idempotence, nearby social bonds, strict state validation, old-save initialization, modern snapshot roundtrips, and actual mining/harvest/combat effects. Existing engine, save, Guild Hall, UI, and AI-boundary regression tests remain in the suite.

## Browser verification

The production build was exercised through the visible controls. A bold River Market trip, camp research, and founders’ supper started together at tick 2. After six manual ticks the supper recorded a second dwarf anecdote. Saving at tick 8 and reloading through Continue restored the active trip, cooldown/effect state, and research deadline. Twelve more ticks completed pick research and exposed the returned-cargo notice; claiming produced the advertised 28 food, 6 ale, and 10 timber for this seeded successful trip and added one journey account. Closing with Escape restored an already paused clock.

At a 390×844 viewport the planning dialog and close control remained on-screen, its body scrolled internally, and the page had no horizontal overflow. This was a browser-size check, not a physical touch-device or screen-reader test. Screenshot capture was unavailable in the browser connection; these observations use the rendered DOM and element geometry.

The final production-build smoke check also verified that the returned-cargo action opens the Expeditions tab directly after the player last used Engineering, and that claiming creates exactly one visible journey account.
