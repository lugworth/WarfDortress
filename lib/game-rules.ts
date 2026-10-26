import type { DesignationType } from "./types";

export const TOOL_KEYS: Record<string, DesignationType> = {
  d: "MINE",
  t: "CHOP",
  g: "GATHER",
  x: "STAIRS",
  p: "STOCKPILE",
  r: "RECLAIM_RELIC",
  w: "BUILD_WALL",
  o: "BUILD_DOOR",
  e: "BUILD_TRAP",
  b: "BUILD_BED",
  m: "BUILD_MASON",
  c: "BUILD_CARPENTER",
  s: "BUILD_STILL",
  l: "BUILD_SMELTER",
  f: "BUILD_FORGE",
  v: "BUILD_TAVERN",
  y: "BUILD_TEMPLE",
  u: "BUILD_DEPOT",
  a: "BUILD_FARM",
  k: "CANCEL",
};
