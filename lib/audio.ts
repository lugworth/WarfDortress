// Preserve the provider's actual format. Raw Gemini L16/PCM needs a WAV header;
// a WAV response already has one. See Google's speech-generation documentation.
export function speechAudioBytes(base64: string, mimeType: string): { bytes: Uint8Array<ArrayBuffer>; mimeType: string } {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (/^audio\/(wav|x-wav|mpeg|mp3|ogg)(;|$)/i.test(mimeType)) return { bytes, mimeType };
  if (!/^audio\/(l16|pcm)(;|$)/i.test(mimeType)) throw new Error('Unsupported speech audio format.');
  const rate = Number(mimeType.match(/rate=(\d+)/i)?.[1] || 24000);
  if (rate < 8000 || rate > 48000 || bytes.length % 2) throw new Error('Invalid speech audio.');
  const wav = new Uint8Array(44 + bytes.length);
  const view = new DataView(wav.buffer);
  for (const [offset, value] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']] as const) for (let i = 0; i < value.length; i++) wav[offset + i] = value.charCodeAt(i);
  view.setUint32(4, 36 + bytes.length, true); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); view.setUint32(40, bytes.length, true);
  wav.set(bytes, 44);
  return { bytes: wav, mimeType: 'audio/wav' };
}

export async function speakFortressText(text: string): Promise<void> {
  const cleanText = text.replace(/[*#_`]/g, '').slice(0, 420);
  try {
    const response = await fetch('/api/advisor/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: cleanText }) });
    const data = await response.json();
    if (data.audio) {
      const format = speechAudioBytes(data.audio, data.mimeType || '');
      const url = URL.createObjectURL(new Blob([format.bytes], { type: format.mimeType }));
      try {
        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(url);
          audio.onended = () => resolve(); audio.onerror = () => reject(new Error('Playback failed'));
          audio.play().catch(reject);
        });
        return;
      } finally { URL.revokeObjectURL(url); }
    }
  } catch { /* Browser speech is also available when the server is offline. */ }
  if ('speechSynthesis' in window) await new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.pitch = 0.8; utterance.rate = 0.95;
    utterance.onend = () => resolve(); utterance.onerror = () => resolve();
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
  });
}
