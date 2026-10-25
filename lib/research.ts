import type { FortressResources, GameState, TileTerrain } from "./types.ts";
import { validResourceMap } from "./game-rules.ts";

export type ResearchProjectId =
  "PICK_TECHNIQUES" | "MUSHROOM_CELLAR" | "WATCH_DRILLS";
export type ResearchAction = {
  type: "START_RESEARCH";
  projectId: ResearchProjectId;
};
export interface ResearchState {
  version: 1;
  completed: Array<{
    projectId: ResearchProjectId;
    startedAt: number;
    completedAt: number;
  }>;
  active: {
    projectId: ResearchProjectId;
    startedAt: number;
    completesAt: number;
  } | null;
  history: Array<{
    tick: number;
    projectId: ResearchProjectId;
    type: "STARTED" | "COMPLETED";
  }>;
}

interface ResearchProject {
  id: ResearchProjectId;
  title: string;
  description: string;
  cost: Partial<FortressResources>;
  duration: number;
  prerequisites: Array<{ terrain: TileTerrain; label: string }>;
  militia?: boolean;
  effect: string;
}

export const RESEARCH_PROJECTS: readonly ResearchProject[] = [
  {
    id: "PICK_TECHNIQUES",
    title: "Seam-wise pick techniques",
    description:
      "Mark the grain, then strike. The founding miners can study their tools at camp.",
    cost: { stone: 6, wood: 2, ironOre: 1 },
    duration: 18,
    prerequisites: [],
    effect: "+1 mining progress per work tick.",
  },
  {
    id: "MUSHROOM_CELLAR",
    title: "Mushroom cellar",
    description: "Carpenters develop ventilated racks for the farm harvest.",
    cost: { food: 8, wood: 6 },
    duration: 24,
    prerequisites: [
      { terrain: "FARM_PLOT", label: "Built farm plot" },
      { terrain: "WORKSHOP_CARPENTER", label: "Built carpenter’s workshop" },
    ],
    effect: "+1 food per built farm at each harvest.",
  },
  {
    id: "WATCH_DRILLS",
    title: "Watch drills",
    description:
      "Smiths and the militia rehearse a disciplined opening strike.",
    cost: { weapons: 1, ale: 6 },
    duration: 24,
    prerequisites: [
      { terrain: "WORKSHOP_FORGE", label: "Built metalsmith forge" },
    ],
    militia: true,
    effect: "+1 militia melee damage.",
  },
];

const projectFor = (id: unknown) =>
  RESEARCH_PROJECTS.find((project) => project.id === id);
export const createResearchState = (): ResearchState => ({
  version: 1,
  completed: [],
  active: null,
  history: [],
});
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const keysAre = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const tickIs = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/** Validate canonical records rather than trusting persisted bonus values. */
export function validResearchState(
  value: unknown,
  state?: GameState,
): value is ResearchState {
  if (
    !record(value) ||
    !keysAre(value, ["version", "completed", "active", "history"]) ||
    value.version !== 1 ||
    !Array.isArray(value.completed) ||
    value.completed.length > 3 ||
    !Array.isArray(value.history) ||
    value.history.length > 6
  )
    return false;
  const seen = new Set<string>();
  const expected: ResearchState["history"] = [];
  let previousEnd = 0;
  for (const entry of value.completed) {
    if (
      !record(entry) ||
      !keysAre(entry, ["projectId", "startedAt", "completedAt"])
    )
      return false;
    const project = projectFor(entry.projectId);
    if (
      !project ||
      seen.has(project.id) ||
      !tickIs(entry.startedAt) ||
      !tickIs(entry.completedAt) ||
      entry.startedAt < previousEnd ||
      entry.completedAt !== entry.startedAt + project.duration ||
      (state && entry.completedAt > state.ticks)
    )
      return false;
    seen.add(project.id);
    expected.push(
      { tick: entry.startedAt, projectId: project.id, type: "STARTED" },
      { tick: entry.completedAt, projectId: project.id, type: "COMPLETED" },
    );
    previousEnd = entry.completedAt;
  }
  if (value.active !== null) {
    const active = value.active;
    if (
      !record(active) ||
      !keysAre(active, ["projectId", "startedAt", "completesAt"])
    )
      return false;
    const project = projectFor(active.projectId);
    if (
      !project ||
      seen.has(project.id) ||
      !tickIs(active.startedAt) ||
      !tickIs(active.completesAt) ||
      active.startedAt < previousEnd ||
      active.completesAt !== active.startedAt + project.duration ||
      (state && active.startedAt > state.ticks)
    )
      return false;
    expected.push({
      tick: active.startedAt,
      projectId: project.id,
      type: "STARTED",
    });
  }
  return (
    value.history.length === expected.length &&
    value.history.every(
      (entry, i) =>
        record(entry) &&
        keysAre(entry, ["tick", "projectId", "type"]) &&
        entry.tick === expected[i].tick &&
        entry.projectId === expected[i].projectId &&
        entry.type === expected[i].type,
    )
  );
}

/** Built terrain, never queued designations, satisfies engineering prerequisites. */
export function researchBlockers(
  state: GameState,
  projectId: ResearchProjectId,
): string[] {
  const project = projectFor(projectId);
  if (!project) return ["Unknown project."];
  const research = state.activities?.research || createResearchState();
  if (research.completed.some((item) => item.projectId === projectId))
    return ["Already researched."];
  if (research.active)
    return [
      research.active.projectId === projectId
        ? "Research in progress."
        : "Finish the active project first.",
    ];
  const built = new Set(state.grid.flat(2).map((tile) => tile.terrain));
  const blockers = project.prerequisites
    .filter((requirement) => !built.has(requirement.terrain))
    .map((requirement) => requirement.label);
  if (
    project.militia &&
    !state.dwarves.some((dwarf) => dwarf.hp > 0 && dwarf.labors.COMBAT)
  )
    blockers.push("At least one living militia member");
  for (const [resource, amount] of Object.entries(project.cost)) {
    if (state.resources[resource as keyof FortressResources] < amount)
      blockers.push(`Need ${amount} ${resource}`);
  }
  return blockers;
}

export function applyResearchAction(
  state: GameState,
  action: ResearchAction,
): GameState {
  const research = state.activities?.research || createResearchState();
  const project = projectFor(action?.projectId);
  if (
    !state.activities ||
    action?.type !== "START_RESEARCH" ||
    !project ||
    !validResourceMap(state.resources) ||
    !validResearchState(research, state) ||
    !tickIs(state.ticks) ||
    !Number.isSafeInteger(state.ticks + project.duration) ||
    researchBlockers(state, project.id).length
  )
    return state;
  const resources = { ...state.resources };
  for (const [key, amount] of Object.entries(project.cost))
    resources[key as keyof FortressResources] -= amount;
  return {
    ...state,
    resources,
    activities: {
      ...state.activities,
      research: {
        ...research,
        active: {
          projectId: project.id,
          startedAt: state.ticks,
          completesAt: state.ticks + project.duration,
        },
        history: [
          ...research.history,
          { tick: state.ticks, projectId: project.id, type: "STARTED" },
        ],
      },
    },
  };
}

/** Tick deadlines survive save/load and skipped simulation ticks without duplicate unlocks. */
export function stepResearch(state: GameState): GameState {
  const research = state.activities?.research;
  if (
    !research?.active ||
    !validResearchState(research, state) ||
    state.ticks < research.active.completesAt
  )
    return state;
  const active = research.active;
  return {
    ...state,
    activities: {
      ...state.activities!,
      research: {
        ...research,
        active: null,
        completed: [
          ...research.completed,
          {
            projectId: active.projectId,
            startedAt: active.startedAt,
            completedAt: active.completesAt,
          },
        ],
        history: [
          ...research.history,
          {
            tick: active.completesAt,
            projectId: active.projectId,
            type: "COMPLETED",
          },
        ],
      },
    },
  };
}

export function getResearchBonuses(state: GameState): {
  mining: number;
  foodPerFarm: number;
  combat: number;
} {
  const research = state.activities?.research;
  if (!research || !validResearchState(research, state))
    return { mining: 0, foodPerFarm: 0, combat: 0 };
  const unlocked = new Set(research.completed.map((entry) => entry.projectId));
  return {
    mining: unlocked.has("PICK_TECHNIQUES") ? 1 : 0,
    foodPerFarm: unlocked.has("MUSHROOM_CELLAR") ? 1 : 0,
    combat: unlocked.has("WATCH_DRILLS") ? 1 : 0,
  };
}
