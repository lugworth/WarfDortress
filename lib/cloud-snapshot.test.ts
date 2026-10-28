import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { applyAreaDesignation, createInitialGameState, stepSimulationTick } from './game-engine.ts';
import { MAX_SNAPSHOT_BYTES, packFortressSnapshot, unpackFortressSnapshot } from './cloud-snapshot.ts';

test('cloud snapshots restore a late-game fortress exactly and fit in a Firestore field', async () => {
  let state = createInitialGameState('Snapshot-roundtrip');
  state = applyAreaDesignation(state, 0, 30, 10, 60, 32, 'MINE').nextState;
  state = applyAreaDesignation(state, 0, 2, 2, 70, 38, 'CHOP').nextState;
  state = applyAreaDesignation(state, 0, 36, 18, 37, 19, 'STAIRS').nextState;
  for (let i = 0; i < 1500; i++) state = stepSimulationTick({ ...state, activeEvent: null });
  state = applyAreaDesignation(state, 0, 0, 0, 75, 41, 'MINE').nextState;

  const packed = await packFortressSnapshot(state);
  assert.ok(packed.length < MAX_SNAPSHOT_BYTES / 4, `snapshot is ${packed.length} bytes`);

  const restored = await unpackFortressSnapshot(packed);
  assert.deepEqual(restored, JSON.parse(JSON.stringify({ ...state, paused: true })));
  assert.doesNotThrow(() => stepSimulationTick(restored!));
});

test('corrupt, foreign, or oversized snapshots are rejected', async () => {
  const valid = await packFortressSnapshot(createInitialGameState('Snapshot-bad'));
  const truncated = valid.slice(0, valid.length >> 1);
  assert.equal(await unpackFortressSnapshot(truncated), null);
  assert.equal(await unpackFortressSnapshot(new Uint8Array([1, 2, 3, 4])), null);
  assert.equal(await unpackFortressSnapshot(gzipSync('{"version":1,"state":{}}')), null);
  assert.equal(await unpackFortressSnapshot(gzipSync('not json')), null);
  assert.equal(await unpackFortressSnapshot(valid, 1_000), null, 'decompression is capped');
});
