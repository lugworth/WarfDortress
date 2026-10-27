import assert from 'node:assert/strict';
import test from 'node:test';
import { readJsonBody, TEXT_MODELS, textModels } from './gemini-server.ts';

const post = (body: string) => new Request('http://local/api', { method: 'POST', body });

test('AI routes read bounded JSON objects only', async () => {
  assert.deepEqual(await readJsonBody(post('{"seed":"Khazad"}'), 100), { seed: 'Khazad' });
  await assert.rejects(readJsonBody(post(JSON.stringify({ text: 'x'.repeat(200) })), 100), RangeError);
  await assert.rejects(readJsonBody(post('[1,2]'), 100), TypeError);
  await assert.rejects(readJsonBody(post('{'), 100), SyntaxError);
});

test('the preferred model leads the fallback chain without duplicates', () => {
  assert.deepEqual(textModels(), [...TEXT_MODELS]);
  const chain = textModels('gemini-3.8-flash');
  assert.equal(chain[0], 'gemini-3.8-flash');
  assert.equal(new Set(chain).size, chain.length);
});
