import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_REQUEST_MAX_BYTES, serializeAdvisorRequest, type AdvisorMessage } from './advisor-request.ts';

test('long multilingual conversations fit the complete UTF-8 request budget', () => {
  const history: AdvisorMessage[] = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'user' : 'model', content: '城'.repeat(3000) }));
  history[19].content = '最新的问题：'.repeat(300);
  const summary = { fortressName: '地下堡垒', population: 200, dwarvesStates: Array.from({ length: 20 }, () => ({ name: '矿工'.repeat(20), thought: '思'.repeat(160), state: 'IDLE', z: 0 })) };
  const body = serializeAdvisorRequest('gemini-3.1-flash-lite', history, summary);
  const parsed = JSON.parse(body);
  assert.ok(Buffer.byteLength(body, 'utf8') < CHAT_REQUEST_MAX_BYTES);
  assert.ok(parsed.messages.length < history.length);
  assert.equal(parsed.messages.at(-1).parts[0].text, history.at(-1)!.content);
  assert.deepEqual(parsed.fortressSummary, summary);
});

test('escaped ASCII and telemetry are included in byte accounting', () => {
  const history: AdvisorMessage[] = Array.from({ length: 20 }, () => ({ role: 'user', content: '"\\\n'.repeat(1000) }));
  const body = serializeAdvisorRequest('model', history, { fortressName: 'Anvil', note: 'x'.repeat(5000) });
  assert.ok(Buffer.byteLength(body, 'utf8') < CHAT_REQUEST_MAX_BYTES);
  assert.equal(JSON.parse(body).messages.at(-1).parts[0].text, history.at(-1)!.content);
});

test('small requests retain history; oversized optional roster cannot displace the latest question', () => {
  const history: AdvisorMessage[] = [{ role: 'user', content: 'How are we doing?' }];
  const small = JSON.parse(serializeAdvisorRequest('model', history, { population: 7 }));
  assert.equal(small.messages.length, 1);
  const large = JSON.parse(serializeAdvisorRequest('model', history, { population: 200, dwarvesStates: ['x'.repeat(70_000)] }));
  assert.equal(large.messages[0].parts[0].text, history[0].content);
  assert.deepEqual(large.fortressSummary, { population: 200 });
  assert.throws(() => serializeAdvisorRequest('model', history, { fortressName: 'x'.repeat(70_000) }), RangeError);
});
