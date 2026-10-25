import type { GameState } from "./types.ts";
import {
  createExpeditionState,
  validExpeditionState,
  applyExpeditionAction,
  stepExpeditions,
  type ExpeditionState,
  type ExpeditionAction,
} from "./expeditions.ts";
import {
  createFestivalState,
  validFestivalState,
  applyFestivalAction,
  stepFestivals,
  type FestivalState,
  type FestivalAction,
} from "./festivals.ts";
import {
  createResearchState,
  validResearchState,
  applyResearchAction,
  stepResearch,
  RESEARCH_PROJECTS,
  type ResearchState,
  type ResearchAction,
} from "./research.ts";

export interface ActivitiesState {
  version: 1;
  expeditions: ExpeditionState;
  festivals: FestivalState;
  research: ResearchState;
}
export type ActivityAction = ExpeditionAction | FestivalAction | ResearchAction;

export function initializeActivities(
  state: GameState,
): GameState & { activities: ActivitiesState } {
  if (state.activities !== undefined)
    return state as GameState & { activities: ActivitiesState };
  return {
    ...state,
    activities: {
      version: 1,
      expeditions: createExpeditionState(),
      festivals: createFestivalState(),
      research: createResearchState(),
    },
  };
}

export function validActivities(state: GameState): boolean {
  const value = state.activities;
  if (value === undefined) return true;
  return (
    value !== null &&
    typeof value === "object" &&
    value.version === 1 &&
    Object.keys(value).every((key) =>
      ["version", "expeditions", "festivals", "research"].includes(key),
    ) &&
    validExpeditionState(value.expeditions, state) &&
    validFestivalState(value.festivals, state) &&
    validResearchState(value.research, state)
  );
}

export function performActivityAction(
  state: GameState,
  action: ActivityAction,
): GameState {
  const current = initializeActivities(state);
  let next: GameState;
  switch (action.type) {
    case "START_EXPEDITION":
    case "CLAIM_EXPEDITION":
      next = applyExpeditionAction(current, action);
      break;
    case "START_FESTIVAL":
      next = applyFestivalAction(current, action);
      break;
    case "START_RESEARCH":
      next = applyResearchAction(current, action);
      break;
    default:
      return state;
  }
  return next === current ? state : next;
}

/** Called once after a real simulation tick, never by rendering or wall time. */
export function stepActivities(state: GameState): GameState {
  const initialized = initializeActivities(state);
  const next = stepResearch(stepFestivals(stepExpeditions(initialized)));
  if (
    (next.activities?.research.completed.length || 0) <=
    initialized.activities.research.completed.length
  )
    return next;
  const completed = next.activities!.research.completed.at(-1)!;
  const project = RESEARCH_PROJECTS.find((p) => p.id === completed.projectId)!;
  return {
    ...next,
    chronicle: [
      {
        id: `research-complete-${project.id}-${completed.completedAt}`,
        tick: next.ticks,
        year: next.year,
        season: next.season,
        type: "CRAFT" as const,
        text: `Engineering complete: ${project.title}. ${project.effect}`,
      },
      ...next.chronicle,
    ].slice(0, 60),
  };
}
