export interface AdvisorChatMessage {
  role: 'user' | 'model';
  content: string;
}

/** The advisor route only reads the most recent turns. */
export const MAX_ADVISOR_MESSAGES = 12;

export function serializeAdvisorRequest(
  model: string,
  messages: AdvisorChatMessage[],
  fortressSummary?: Record<string, unknown>
): string {
  if (!Array.isArray(messages)) {
    throw new TypeError('Messages must be an array');
  }

  // Format into standard multimodal content parts
  const formattedMessages = messages.slice(-MAX_ADVISOR_MESSAGES).map((m) => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.content || '' }],
  }));

  const payload = {
    model: model || 'gemini-3.5-flash-lite',
    messages: formattedMessages,
    fortressSummary: fortressSummary || {},
  };

  const serialized = JSON.stringify(payload);

  if (serialized.length > 120_000) {
    throw new RangeError('Request payload exceeds maximum allowed size.');
  }

  return serialized;
}
