# ASCII Fortress: Deep Anvil — Metallurgy, Militia Combat, Cavern Relics & Overseer Command Upgrade

This upgrade transforms ASCII Fortress into a deeper, balanced dwarven colony simulation by introducing a complete metallurgy and armory production chain, real-time ASCII grid raids and militia defense, subterranean cavern relics and monsters, Tavern and Temple morale sanctuaries, interactive seasonal caravan bartering, and four tactical command-and-inspection tools.

## User Review & Critical Decisions

> [!IMPORTANT]
> All core gameplay systems, economy balance targets, and command interface improvements below reflect your confirmed choices from our interactive planning session. Review the architectural design and click **Proceed** when ready to build.

- **Confirmed Feature Scope**:
  - **Smeltery & Forge Metallurgy Chain**: Buildable Smelter and Metalsmith Forge workshops (`SMITHING` labor) converting Iron, Copper, Gold, and Mithril ores into Steel Bars, Weapons, and Armor.
  - **Active Goblin Raids & Dwarven Militia Combat**: Hostile surface raiders and deep cavern beasts moving on the ASCII grid, countered by armed Dwarven Militia orders (Defend Gate, Patrol, Sally Forth) and constructible Stone Deadfall Traps.
  - **Subterranean Caverns, Monsters & Relics**: Deep strata (`Z-3` to `Z-5`) housing ancient Vault Relics (`☼`) that bestow permanent fortress bonuses alongside guarding cavern creatures.
  - **Tavern & Temple Morale Sanctuaries**: Buildable Hearth Taverns and Ancestral Temples where dwarves recover fatigue, quench thirst with bonus mirth, and gain protection against morale collapse.
  - **Seasonal Trade Depot & Custom Bartering**: Constructible Trade Depot and interactive Barter Exchange allowing custom resource-for-resource trading when merchant caravans arrive.
- **Confirmed Balance & Pacing**:
  - **Balanced Survival with Steady Seasonal Scaling**: Distinct seasonal modifiers across Granite (Spring), Slate (Summer), Sands (Autumn), and Timber (Winter) that pace crop yields, hunger/thirst drain, caravan arrivals, and raid intensity smoothly with fortress wealth and year.
- **Confirmed Command & QoL Tools**:
  - **Interactive Tile & Entity Inspector**: Click-to-inspect mode revealing tile geology, ore yields, dwarf skills/thoughts/equipment, or enemy combat stats.
  - **Auto-Queue Production & Clan Labor Presets**: Per-recipe auto-repeat toggles and one-click clan-wide labor profiles.
  - **Mini-Map Radar & Z-Level Vein Scanner**: Live spatial radar of the active depth plus a 6-stratum mineral, relic, and threat scanner with instant depth switching.
  - **Fortress Alerts Ticker with Jump-to-Location**: Actionable alert feed with `[ JUMP (X,Y,Z) ]` buttons that switch Z-levels and pulse-highlight the target coordinate on the canvas.

---

## 1. Overview & Core Concept

- **What It Does**: Expands the multi-Z-level dwarven colony simulation from basic excavation and survival into a full fortress management loop where raw ores are smelted and forged into arms, militia squads defend the halls against surface and cavern threats, artisans gather in taverns and temples, and the Overseer commands the colony with precision radar, inspection, and automated production tools.
- **Target Audience / Persona**: Strategy and colony-simulation players who love deep emergent systems, readable Base16 Isotope terminal aesthetics, and tactile keyboard-and-mouse command control.
- **Key Value**: Connects every resource and Z-level into a meaningful strategic loop—mining deep strata fuels the Smeltery and Forge, forged arms protect fortress wealth from raids and cavern beasts, recovered relics and tavern feasts elevate clan morale, and smart automation reduces repetitive micromanagement.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Metallurgy & Armory Flow**: Designate Iron, Gold, or Mithril veins for mining -> construct a Smeltery (`WORKSHOP_SMELTER`) and Forge (`WORKSHOP_FORGE`) -> toggle `[ AUTO ]` on Smelt Steel Bars and Forge Runed Arms -> dwarves with `SMITHING` labor smelt ore and equip newly forged weapons and armor, visibly raising the clan's Militia Power readout.
  2. **Raid Defense & Cavern Expedition Flow**: An alert appears in the top Alert Ticker (`[ ! GOBLIN RAID AT (42,14,Z-0) ]`) -> click `[ JUMP ]` to center and highlight the raiders on `Z-0` -> switch Militia Doctrine to `SALLLY FORTH` or lure raiders over constructed Stone Traps (`^`) -> armed dwarves intercept and defeat the raiders, logging the victory in the Chronicle.
  3. **Inspection, Radar & Bartering Flow**: Toggle `[ ? INSPECT ]` (or click any dwarf/tile in Inspect mode) to view a detailed readout of a dwarf's equipped weapon/armor, skill ranks, needs bars, and inner thoughts -> use the Z-Level Vein Scanner to spot unmined Gold and Relics on `Z-3` -> open the Seasonal Trade Depot modal to barter surplus carved stone and steel crafts for winter food, ale, and migrant pioneers.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Utilitarian Base16 Isotope dark terminal simulation with crisp box-drawing frames, zero-pill inline metadata (`·` and `|` separators), and single-line bracketed terminal controls (`whitespace-nowrap shrink-0`).
  - *Color Palette & Mood*:
    - Dominant Canvas (60%): Deep Obsidian Terminal Black (`#000000`) and Dark Slate Panel (`#101010`).
    - Structural Surfaces (30%): Hairline Terminal Borders (`#202020`), Muted Stone Text (`#808080`), and Crisp Readout Text (`#d0d0d0` / `#ffffff`).
    - Semantic Accents (10%): Base16 Isotope Pink (`#ff0099`) for primary focus, relics, gold, and royal decrees; Isotope Green (`#33ff00`) for thriving provisions, wood, and positive status; Isotope Orange (`#ff9900`) for iron, metallurgy, and warnings; Isotope Cyan (`#00ffff`) for mythril, water, and calendar telemetry; Isotope Purple (`#cc00ff`) for ale, temples, and fey moods; Isotope Red (`#ff0000`) for goblin raids and critical alerts.
  - *Typography & Hierarchy*: Monospace terminal grid (`font-mono tabular-nums`) across all resource counters, coordinates, combat stats, and radar readouts so columns and brackets remain strictly aligned without wrapping.
- **Interactive Feedback & Motion**:
  - Canvas target ping ring (`3-second` decaying Isotope Pink/Red highlight box) when jumping to an alert coordinate or inspecting an entity.
  - Combat hit flashes and floating ASCII damage/status indicators on tiles during active skirmishes.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Integrated Grid Entities for Raiders, Beasts, and Relics**
  - *Chosen Approach*: Represent hostile raiders, cavern beasts, and ancient relics as first-class spatial entities within `GameState` that move, guard, and interact on the `[z][y][x]` grid each simulation tick.
  - *Why*: Ensures threats and discoveries are visible directly on the ASCII map, detectable by the Mini-Map Radar, and inspectable via `[ ? INSPECT ]`, rather than existing only as abstract text popups.
  - *Alternatives Considered*: Purely modal-based combat was rejected because it disconnects fortress layout, traps, and militia positioning from raid outcomes.
- **Decision 2: Balanced Seasonal Survival Pacing**
  - *Chosen Approach*: Tie environmental modifiers to the 4 dwarven seasons (`Granite/Spring`, `Slate/Summer`, `Sands/Autumn`, `Timber/Winter`) while scaling raid size to a combination of Fortress Wealth and Year, with Beds, Taverns, and Temples acting as efficiency multipliers rather than punishing instant-death timers.
  - *Why*: Rewards proactive fortress planning (stockpiling food/ale before Winter, forging weapons as wealth climbs) while keeping the simulation enjoyable and recoverable.
  - *Alternatives Considered*: Hardcore exponential starvation was passed over per user preference for balanced survival.
- **Decision 3: Backward-Compatible Cloud Save Schema**
  - *Chosen Approach*: Store the extended resources (`steelBars`, `weapons`, `armor`, `relics`) and settings with safe default hydration so existing Firestore cloud saves load seamlessly alongside newly created fortresses.
  - *Why*: Preserves compatibility with the provisioned Firestore database (`fortresses` collection) and existing security rules.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Root Colony Shell & HUD Bar                         │
│  [Fortress & Season Badge] · [Extended Resource & Armory Readout]          │
│  [Alert Ticker with Jump-to-Coordinate] · [Barter / Decrees / Sim Controls]│
└───────┬───────────────────────────────────┬────────────────────────┬───────┘
        │                                   │                        │
        ▼                                   ▼                        ▼
┌───────────────────────┐   ┌───────────────────────────────┐  ┌─────────────┐
│  Colony Command Dock  │   │   Multi-Z ASCII Map Viewport  │  │ Chronicle & │
│ ┌───────────────────┐ │   │ ┌───────────────────────────┐ │  │ Royal AI    │
│ │ [BUILD] Workshops │ │   │ │ Quick Toolbar & Inspect   │ │  │ Advisor     │
│ │  Smelter / Forge  │ │   │ │ Mode Toggle [ ? INSPECT ] │ │  ├─────────────┤
│ │  Tavern / Temple  │ │   │ ├───────────────────────────┤ │  │ Mini-Map    │
│ │  Trap / Depot     │ │   │ │ 2D Canvas Renderer        │ │  │ Radar &     │
│ ├───────────────────┤ │   │ │  · Terrain & Designations │ │  │ Z-Strata    │
│ │ [JOBS] & Presets  │ │   │ │  · Dwarves & Equipment    │ │  │ Scanner     │
│ │  Militia Doctrine │ │   │ │  · Raiders, Beasts, Relics│ │  ├─────────────┤
│ ├───────────────────┤ │   │ │  · Jump Ping Reticle      │ │  │ Seasonal    │
│ │ [STOCKS] & Auto-Q │ │   │ ├───────────────────────────┤ │  │ Caravan     │
│ │  Repeat WorkOrders│ │   │ │ Live Tile & Entity        │ │  │ Barter      │
│ └───────────────────┘ │   │ │ Inspector Drawer/Overlay  │ │  │ Exchange    │
└───────────┬───────────┘   └───────────────┬───────────────┘  └──────┬──────┘
            │                               │                         │
            └───────────────────────────────┼─────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                Deterministic Simulation Engine (Pure Logic)                │
│  · Seasonal Economy Modifiers (Spring/Summer/Autumn/Winter)                │
│  · Metallurgy & Auto-Queue Workshop Pipeline (Ore -> Steel -> Arms)        │
│  · Spatial AI: Dwarf Tasking, Tavern/Temple Visits, Militia vs Hostiles    │
│  · Cavern Relic Recovery & Alert Generation with (X, Y, Z) Coordinates     │
└────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State Extensions

- **Extended `FortressResources`**:
  - Adds `steelBars: number`, `weapons: number`, `armor: number`, and `relics: number` to track metallurgy output and recovered cavern artifacts.
- **Extended `TileTerrain` & `DesignationType`**:
  - New constructible terrains: `WORKSHOP_SMELTER` (`£`), `WORKSHOP_FORGE` (`⚒`), `TAVERN_HALL` (`♫`), `TEMPLE_ALTAR` (`Ψ`), `TRADE_DEPOT` (`¤`), `TRAP_STONE` (`^`), and subterranean `CAVERN_RELIC` (`☼`).
  - New `DwarfLabor` roles: `SMITHING` and `COMBAT` alongside existing labors, plus equipped gear indicators (`weaponEquipped`, `armorEquipped`) on `DwarfEntity`.
- **Hostile & Cavern Entities (`HostileEntity`)**:
  - Spatial actors (`id`, `name`, `kind`: `'GOBLIN_RAIDER' | 'TROLL_BREAKER' | 'CAVE_SPIDER' | 'MAGMA_CRAB'`, `char`, `color`, `x`, `y`, `z`, `hp`, `maxHp`, `attack`, `behavior`: `'RAID_SEEK' | 'CAVERN_GUARD' | 'FLANK_PATROL'`).
- **Actionable Fortress Alerts (`FortressAlert`)**:
  - Structured alerts (`id`, `tick`, `title`, `severity`, `x`, `y`, `z`) powering the top Alert Ticker and `[ JUMP (X,Y,Z) ]` camera focus.
- **Militia Doctrine & Auto-Queue WorkOrders**:
  - `militiaDoctrine: 'DEFENSIVE' | 'PATROL' | 'SALLY_FORTH'` in `GameState`.
  - `autoRepeat: boolean` on `WorkOrder` so workshops automatically replenish essential stocks when input resources are available.

### Interactive Component & State Mapping

- **Click-to-Inspect (`[ ? INSPECT ]`)**: Clicking any tile on the ASCII canvas while in Inspect mode (or right-clicking at any time) selects `{ x, y, z }` and displays the **Inspector Panel** with tile properties, any dwarf or hostile at that coordinate, and quick-action buttons (`Designate Tile`, `Equip/Draft Dwarf`, `Center Radar`).
- **Mini-Map Radar & Strata Scanner**: Renders a proportional bird's-eye canvas of the current Z-level showing terrain, dwarves (`#ff0099`/`#33ff00`), hostiles (`#ff0000`), and relics (`#00ffff`), paired with a 6-row Z-level table listing unmined Iron, Gold, Mithril, Relics, and Hostiles per depth with one-click Z-level navigation.
- **Seasonal Trade Depot Barter Modal**: Accessible from the top bar (`[ ¤ TRADE ]`) or when a caravan is present; allows incrementing/decrementing export goods (Stone, Furniture, Steel, Weapons) and import goods (Food, Ale, Wood, Iron, Migrants) with live value balance validation before executing the trade.
- **Alert Ticker & Coordinate Ping**: Displays the latest active spatial alert in the HUD bar; clicking `[ JUMP (X,Y,Z) ]` sets `currentZ = alert.z` and triggers a pulsing highlight reticle around `(alert.x, alert.y)` on the main ASCII canvas.
