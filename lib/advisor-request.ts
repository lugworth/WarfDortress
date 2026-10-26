export interface AdvisorChatMessage {
  role: 'user' | 'model';
  content: string;
}

export function serializeAdvisorRequest(
  model: string,
  messages: AdvisorChatMessage[],
  fortressSummary?: Record<string, unknown>
): string {
  if (!Array.isArray(messages)) {
    throw new TypeError('Messages must be an array');
  }

  // Format into standard multimodal content parts
  const formattedMessages = messages.map((m) => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.content || '' }],
  }));

  const payload = {
    model: model || 'gemini-3.1-flash-lite',
    messages: formattedMessages,
    fortressSummary: fortressSummary || {},
  };

  const serialized = JSON.stringify(payload);

  if (serialized.length > 500_000) {
    throw new RangeError('Request payload exceeds maximum allowed size.');
  }

  return serialized;
}
