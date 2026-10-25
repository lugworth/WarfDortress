import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialGameState, generateContextAwareEvent, resolveNarrativeEvent, stepSimulationTick } from './game-engine.ts';
import { BACKUP_SAVE_KEY, LOCAL_SAVE_KEY, cloudSavePath, deserializeFortress, readLocalSave, restoreCloudSave, serializeFortress, writeLocalSave } from './save-system.ts';

test('full fortress round trip retains construction, citizens, enemies, history, jobs and calendar', () => {
  let state = createInitialGameState('Long-' + 'x'.repeat(90));
  state.grid[0][21][40].terrain = 'WORKSHOP_FORGE';
  // Canonical visuals are reconstructed from terrain, rather than persisted.
  state.activeEvent = generateContextAwareEvent(state, 'TRADE_CARAVAN');
  state = resolveNarrativeEvent(state, 'trade-crafts');
  state = stepSimulationTick(state);
  const serialized = serializeFortress(state);
  assert.ok(Buffer.byteLength(serialized) < 900_000);
  const restored = deserializeFortress(serialized);
  assert.equal(restored.grid[0][21][40].terrain, 'WORKSHOP_FORGE');
  assert.deepEqual(restored.dwarves, JSON.parse(JSON.stringify(state.dwarves)));
  assert.deepEqual(restored.hostiles, state.hostiles);
  assert.deepEqual(restored.world, state.world);
  assert.deepEqual(restored.workOrders, state.workOrders);
  assert.deepEqual(restored.resources, state.resources);
  assert.deepEqual(restored.eventHistory, state.eventHistory);
  assert.equal(restored.ticks, state.ticks);
  assert.equal(restored.world.seed, state.world.seed);
});

test('local loading falls back to the last good snapshot after corruption', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const state = createInitialGameState('Backup');
  writeLocalSave(storage, state);
  writeLocalSave(storage, stepSimulationTick(state));
  assert.ok(data.has(BACKUP_SAVE_KEY));
  storage.setItem(LOCAL_SAVE_KEY, '{corrupt');
  assert.equal(readLocalSave(storage)?.ticks, 0);
});

test('unsupported versions and malformed coordinates/resources cannot enter the simulation', () => {
  const snapshot = JSON.parse(serializeFortress(createInitialGameState('Validate')));
  assert.throws(() => deserializeFortress(JSON.stringify({ ...snapshot, version: 999 })));
  snapshot.state.resources.stone = -1;
  assert.throws(() => deserializeFortress(JSON.stringify(snapshot)));
  snapshot.state.resources.stone = 1;
  snapshot.state.dwarves[0].z = 8;
  assert.throws(() => deserializeFortress(JSON.stringify(snapshot)));
  snapshot.state.dwarves[0].z = 0;
  snapshot.cells[0][0] = -1;
  assert.throws(() => deserializeFortress(JSON.stringify(snapshot)));
});

test('same seed uses independent save slots and user-scoped paths', () => {
  const a = createInitialGameState('Shared'), b = createInitialGameState('Shared');
  assert.notEqual(a.id, b.id);
  assert.notEqual(cloudSavePath('user-A', a.id), cloudSavePath('user-B', a.id));
  assert.throws(() => cloudSavePath('user/A', a.id));
});

test('legacy full local saves migrate and summary-only cloud records remain loadable', () => {
  const old = createInitialGameState('Legacy');
  assert.equal(deserializeFortress(JSON.stringify(old)).world.seed, old.world.seed);
  const restored = restoreCloudSave({ id: 'old-id', seed: old.world.seed, ticks: 10, year: 251, season: old.season, resources: { ...old.resources, stone: 47 } });
  assert.equal(restored.resources.stone, 47);
  assert.equal(restored.ticks, 10);
});

test('maximum population fits the snapshot budget', () => {
  const state = createInitialGameState('Max-pop');
  state.dwarves = Array.from({ length: 200 }, (_, i) => ({ ...state.dwarves[0], id: `dwarf-${i}` }));
  assert.equal(deserializeFortress(serializeFortress(state)).dwarves.length, 200);
});

test('resource-drop metadata rejects malformed amounts and types in modern and legacy saves', () => {
  const state = createInitialGameState('Drops');
  state.grid[0][0][0].resourceDrop = { type: 'stone', amount: 3 };
  const snapshot = JSON.parse(serializeFortress(state));
  assert.deepEqual(deserializeFortress(JSON.stringify(snapshot)).grid[0][0][0].resourceDrop, { type: 'stone', amount: 3 });
  const legacy = JSON.parse(JSON.stringify(state));
  const invalid = [null, false, 3, {}, { type: 'stone', amount: { value: 3 } }, { type: { value: 'stone' }, amount: 3 }, { type: 'unknown', amount: 3 }, { type: 'stone', amount: -1 }];
  for (const drop of invalid) {
    snapshot.cells[0][4] = drop;
    legacy.grid[0][0][0].resourceDrop = drop;
    assert.throws(() => deserializeFortress(JSON.stringify(snapshot)));
    assert.throws(() => deserializeFortress(JSON.stringify(legacy)));
  }
});
