import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialGameState, applyAreaDesignation, stepSimulationTick } from './game-engine.ts';
import { getLocalSaveSummary, parseLocalSave, serializeLocalSave } from './local-save.ts';

test('local save restores the complete playable fortress, including excavation, orders and guild progress', () => {
  let state = createInitialGameState('Save-regression');
  state = applyAreaDesignation(state, 0, 43, 21, 45, 23, 'MINE').nextState;
  for (let i = 0; i < 12; i++) state = stepSimulationTick(state);
  state.guild.commissions[0].status = 'ACTIVE';
  const restored = parseLocalSave(serializeLocalSave(state));
  assert.ok(restored);
  assert.deepEqual(restored, JSON.parse(JSON.stringify({ ...state, paused: true })));
  assert.deepEqual(getLocalSaveSummary(restored), { name: state.world.dwarvenName, year: state.year, ticks: 12 });
  assert.doesNotThrow(() => stepSimulationTick(restored));
  assert.equal(state.paused, false, 'Saving does not pause the running state');
});

test('original unversioned saves remain resumable', () => {
  const state = createInitialGameState('Legacy-save');
  assert.deepEqual(parseLocalSave(JSON.stringify(state)), { ...state, paused: true });
});

test('invalid or incompatible local saves are rejected without crashing', () => {
  for (const raw of [null, '', '{', 'null', '[]', '{}', '{"version":99}', '{"version":1,"state":null}'])
    assert.equal(parseLocalSave(raw), null);
  const original = createInitialGameState('Bad-save');
  for (const mutate of [
    (s: any) => { s.grid[0].pop(); },
    (s: any) => { s.grid[0][0][0].x = 999; },
    (s: any) => { s.resources.food = null; },
    (s: any) => { s.dwarves = null; },
    (s: any) => { s.guild.commissions = null; },
    (s: any) => { s.world.depth = 999; },
  ]) {
    const state = structuredClone(original);
    mutate(state);
    assert.equal(parseLocalSave(serializeLocalSave(state)), null);
  }
});
