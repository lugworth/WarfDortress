import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialGameState, applyAreaDesignation, stepSimulationTick } from './game-engine.ts';
import { countOf, createGridDraft, getTerrainCounts } from './grid.ts';

test('grid drafts copy only the rows they edit and never touch the source', () => {
  const { grid } = createInitialGameState('Draft-rows');
  const draft = createGridDraft(grid);
  assert.equal(draft.grid, grid, 'an untouched draft is the source grid');

  draft.edit(2, 5, 7)!.terrain = 'ROCK_FLOOR';
  assert.notEqual(draft.grid, grid);
  assert.equal(draft.grid[0], grid[0], 'untouched levels keep their identity');
  assert.equal(draft.grid[2][4], grid[2][4], 'untouched rows keep their identity');
  assert.notEqual(draft.grid[2][5], grid[2][5]);
  assert.equal(draft.tile(2, 5, 7)!.terrain, 'ROCK_FLOOR', 'reads see earlier edits');
  assert.notEqual(grid[2][5][7].terrain, 'ROCK_FLOOR', 'the source grid is unchanged');
  assert.equal(draft.edit(-1, 0, 0), undefined);
});

test('terrain counts are cached per grid and reflect simulation changes', () => {
  let state = createInitialGameState('Counts-cache');
  const before = getTerrainCounts(state.grid);
  assert.equal(getTerrainCounts(state.grid), before, 'the same grid reuses its counts');
  const tiles = state.world.width * state.world.height * state.world.depth;
  assert.equal([...before.total.values()].reduce((a, b) => a + b, 0), tiles);

  const cx = Math.floor(state.world.width / 2);
  const cy = Math.floor(state.world.height / 2);
  state = applyAreaDesignation(state, 0, cx - 4, cy - 4, cx + 4, cy + 4, 'STOCKPILE').nextState;
  const original = state;
  for (let i = 0; i < 40; i++) state = stepSimulationTick(state);

  const built = countOf(getTerrainCounts(state.grid).total, 'STOCKPILE_TILE');
  assert.ok(built > countOf(before.total, 'STOCKPILE_TILE'), 'zoned stockpiles are counted once built');
  assert.equal(
    countOf(getTerrainCounts(original.grid).total, 'STOCKPILE_TILE'),
    countOf(before.total, 'STOCKPILE_TILE'),
    'stepping never mutates the grid of an earlier state',
  );
});
