import test from 'node:test';
import assert from 'node:assert/strict';
import { AiRequestError, RequestBudget, readAiRequest } from './ai-request.ts';
import { formatGeneratedEvent } from './event-validation.ts';
import { speechAudioBytes } from './audio.ts';

test('request budgets reject bursts, reset on the next minute and enforce daily limits', () => {
  const budget = new RequestBudget();
  for (let i = 0; i < 12; i++) budget.take('guest', 0);
  assert.throws(() => budget.take('guest', 0), AiRequestError);
  budget.take('guest', 60_000);
  for (let i = 13; i < 300; i++) budget.take(String(i), 60_000);
  assert.throws(() => budget.take('another', 120_000), AiRequestError);
  assert.doesNotThrow(() => budget.take('guest', 86_400_000));
});

test('request body limits do not rely on Content-Length', async () => {
  const request = new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x'.repeat(1000) }) });
  await assert.rejects(readAiRequest(request, 20), (error: unknown) => error instanceof AiRequestError && error.status === 413);
});

test('cross-origin and malformed JSON requests are rejected', async () => {
  const request = new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://another.example' }, body: '{}' });
  await assert.rejects(readAiRequest(request, 200), (error: unknown) => error instanceof AiRequestError && error.status === 403);
  await assert.rejects(readAiRequest(new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }), 200), AiRequestError);
});

test('generated choices are bounded, have unique IDs and always retain a free option', () => {
  const raw = { title: 'Caravan', severity: 'TRADE_CARAVAN', narrative: 'Traders arrive.', historicalConnection: 'The charter.', triggerReason: 'Spring.', asciiArt: '[X]', choices: [1, 2, 3].map((i) => ({ id: String(i), label: 'Accept', description: 'Trade', outcomeLog: 'Done', stoneCost: 5, spawnMigrants: 2 })) };
  const event = formatGeneratedEvent(raw, 40)!;
  assert.equal(event.choices[0].spawnMigrants, 2);
  assert.deepEqual(event.choices[2].cost, {});
  assert.equal(formatGeneratedEvent({ ...raw, choices: raw.choices.map((c) => ({ ...c, wealthReward: 1e15 })) }, 40), null);
  assert.equal(formatGeneratedEvent({ ...raw, choices: raw.choices.map((c) => ({ ...c, id: 'same' })) }, 40), null);
  assert.equal(formatGeneratedEvent({ ...raw, severity: ['TRADE_CARAVAN'] }, 40), null);
  assert.equal(formatGeneratedEvent({ ...raw, severity: { toString: () => 'TRADE_CARAVAN' } }, 40), null);
});

test('generated choice numbers retain inclusive bounds and reject coercion or fractions', () => {
  const raw = {
    title: 'Caravan', severity: 'TRADE_CARAVAN', narrative: 'Traders arrive.',
    historicalConnection: 'The charter.', triggerReason: 'Spring.', asciiArt: '[X]',
    choices: [1, 2, 3].map((i) => ({ id: String(i), label: 'Accept', description: 'Trade', outcomeLog: 'Done' })),
  };
  const withValue = (key: string, value: unknown) => ({
    ...raw,
    choices: raw.choices.map((choice, i) => i === 0 ? { ...choice, [key]: value } : choice),
  });
  const ranges: Array<[string, number, number]> = [
    ['stoneCost', 0, 100], ['woodCost', 0, 100], ['foodCost', 0, 100],
    ['stoneReward', 0, 100], ['foodReward', 0, 100], ['aleReward', 0, 100],
    ['wealthReward', 0, 1000], ['spawnMigrants', 0, 5], ['moraleDelta', -20, 20],
  ];
  for (const [key, min, max] of ranges) {
    for (const value of [undefined, min, max]) {
      assert.notEqual(formatGeneratedEvent(withValue(key, value), 40), null, `${key} must accept ${value}`);
    }
    for (const value of [min - 1, max + 1, 0.5, '1', null, NaN, Infinity]) {
      assert.equal(formatGeneratedEvent(withValue(key, value), 40), null, `${key} must reject ${String(value)}`);
    }
  }
  const absent = formatGeneratedEvent(raw, 40)!.choices[0];
  const zero = formatGeneratedEvent({ ...raw, choices: raw.choices.map((choice) => ({ ...choice, stoneCost: 0, wealthReward: 0, moraleDelta: 0, spawnMigrants: 0 })) }, 40)!.choices[0];
  for (const choice of [absent, zero]) {
    assert.deepEqual(choice.cost, {});
    assert.deepEqual(choice.reward, {});
    assert.equal(choice.moraleDelta, 0);
    assert.equal(choice.spawnMigrants, 0);
  }
});

test('speech preserves WAV bytes and wraps raw PCM using the declared sample rate', () => {
  const raw = Buffer.from([0, 1, 2, 3]).toString('base64');
  const audio = speechAudioBytes(raw, 'audio/L16;codec=pcm;rate=24000');
  assert.equal(new TextDecoder().decode(audio.bytes.slice(0, 4)), 'RIFF');
  assert.equal(new DataView(audio.bytes.buffer).getUint32(24, true), 24000);
  assert.deepEqual([...audio.bytes.slice(44)], [0, 1, 2, 3]);
  assert.deepEqual([...speechAudioBytes(raw, 'audio/wav').bytes], [0, 1, 2, 3]);
  assert.throws(() => speechAudioBytes(raw, 'text/plain'));
});
