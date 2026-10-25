import { createHash } from 'node:crypto';

export class AiRequestError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function aiErrorResponse(error: unknown): Response | null {
  if (!(error instanceof AiRequestError)) return null;
  return Response.json({ error: error.message, fallback: true }, { status: error.status, headers: error.status === 429 ? { 'Retry-After': '60' } : {} });
}

// Development/single-instance fallback. Production defaults to a shared Redis
// budget; process-only budgets require an explicit operator opt-in.
export class RequestBudget {
  private minute = -1;
  private day = -1;
  private total = 0;
  private clients = new Map<string, number>();
  take(client: string, now = Date.now()) {
    const minute = Math.floor(now / 60_000), day = Math.floor(now / 86_400_000);
    if (minute !== this.minute) { this.minute = minute; this.clients.clear(); }
    if (day !== this.day) { this.day = day; this.total = 0; }
    const count = this.clients.get(client) || 0;
    if (count >= 12 || this.total >= 300 || (!this.clients.has(client) && this.clients.size >= 1000)) throw new AiRequestError('AI request budget reached. Please try again later.', 429);
    this.clients.set(client, count + 1); this.total++;
  }
}
const budget = new RequestBudget();
async function takeBudget(request: Request) {
  // Only trust a proxy header explicitly configured for a deployment that strips
  // client-supplied values. Without one, guests share a conservative bucket.
  const client = createHash('sha256').update(process.env.AI_TRUSTED_IP_HEADER ? request.headers.get(process.env.AI_TRUSTED_IP_HEADER) || 'guest' : 'guest').digest('hex').slice(0, 32);
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const minute = Math.floor(Date.now() / 60_000), day = Math.floor(Date.now() / 86_400_000);
    const script = "local a=redis.call('GET',KEYS[1]) or '0'; local b=redis.call('GET',KEYS[2]) or '0'; if tonumber(a)>=12 or tonumber(b)>=300 then return 0 end; redis.call('INCR',KEYS[1]); redis.call('EXPIRE',KEYS[1],120); redis.call('INCR',KEYS[2]); redis.call('EXPIRE',KEYS[2],172800); return 1";
    try {
      const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(['EVAL', script, '2', `fortress:ai:${minute}:${client}`, `fortress:ai:daily:${day}`]), signal: AbortSignal.timeout(3000) });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error('Budget backend unavailable');
      if (data.result !== 1) throw new AiRequestError('AI request budget reached. Please try again later.', 429);
    } catch (error) {
      if (error instanceof AiRequestError) throw error;
      throw new AiRequestError('AI service temporarily unavailable.', 503);
    }
  } else {
    if (process.env.NODE_ENV === 'production' && process.env.AI_ALLOW_PROCESS_LIMITER !== 'true') throw new AiRequestError('AI service requires a configured shared request budget.', 503);
    budget.take(client);
  }
}

export async function readAiRequest(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new AiRequestError('Expected JSON request.', 415);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(process.env.APP_URL || request.url).origin) throw new AiRequestError('Origin not allowed.', 403);
  await takeBudget(request);
  const reader = request.body?.getReader();
  if (!reader) throw new AiRequestError('Missing request body.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new AiRequestError('Request is too large.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AiRequestError('Invalid JSON.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AiRequestError('Expected a JSON object.');
  return body as Record<string, unknown>;
}

export function textField(value: unknown, max: number, required = true): string {
  if ((!required && value === undefined)) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new AiRequestError('Invalid text field.');
  return value;
}
