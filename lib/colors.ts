import type { TileTerrain } from './types.ts';

// Neutral bedrock stays subdued so ore seams and colony activity stand out.
export const STONE_WALL_FOREGROUNDS: Partial<Record<TileTerrain, string>> = {
  ROCK_WALL: '#606060',
  LIMESTONE_WALL: '#707070',
  GRANITE_WALL: '#484848',
};
