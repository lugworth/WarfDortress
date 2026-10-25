export const CHAT_REQUEST_MAX_BYTES = 64_000;
const CLIENT_REQUEST_BUDGET = 60_000;

export interface AdvisorMessage {
  role: 'user' | 'model';
  content: string;
}

// Count the complete encoded payload, including telemetry and JSON escaping.
// Character counts alone underestimate multilingual conversations considerably.
export function serializeAdvisorRequest(model: string, history: AdvisorMessage[], fortressSummary: Record<string, unknown>): string {
  const messages = history.slice(-20).map((message) => ({
    role: message.role,
    parts: [{ text: message.content.slice(0, 3000) }],
  }));
  if (!messages.length) throw new RangeError('A question is required.');
  const encoder = new TextEncoder();
  let summary = fortressSummary;
  const encode = () => JSON.stringify({ model, messages, fortressSummary: summary });
  let body = encode();
  while (encoder.encode(body).byteLength > CLIENT_REQUEST_BUDGET && messages.length > 1) {
    messages.shift();
    body = encode();
  }
  if (encoder.encode(body).byteLength > CLIENT_REQUEST_BUDGET) {
    summary = { ...fortressSummary };
    delete summary.dwarvesStates;
    body = encode();
  }
  if (encoder.encode(body).byteLength > CLIENT_REQUEST_BUDGET) {
    throw new RangeError('Fortress context is too large to send to the advisor.');
  }
  return body;
}
