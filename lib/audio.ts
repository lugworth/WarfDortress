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

export type TactileSfxKind =
  | 'keycap'
  | 'tool'
  | 'stamp'
  | 'zlevel'
  | 'alert'
  | 'trade';

const SFX_MUTE_KEY = 'warf-tactile-sfx-muted';
let sharedAudioCtx: AudioContext | null = null;

export function isTactileSfxMuted(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(SFX_MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setTactileSfxMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SFX_MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function playTactileSfx(kind: TactileSfxKind = 'keycap'): void {
  if (typeof window === 'undefined' || isTactileSfxMuted()) return;
  // Skip audio synthesis in automated headless browsers to keep test runs silent and fast
  if (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent)) return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    const ctx = sharedAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (kind) {
      case 'keycap': {
        // Crisp 22ms mechanical terminal switch click
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(780, now);
        osc.frequency.exponentialRampToValueAtTime(210, now + 0.022);
        gain.gain.setValueAtTime(0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
        osc.start(now);
        osc.stop(now + 0.024);
        break;
      }
      case 'tool': {
        // Metallic tool latch clink
        osc.type = 'square';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.setValueAtTime(780, now + 0.018);
        gain.gain.setValueAtTime(0.035, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        osc.start(now);
        osc.stop(now + 0.048);
        break;
      }
      case 'stamp': {
        // Chisel / blueprint order stamp
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(360, now);
        osc.frequency.setValueAtTime(540, now + 0.028);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
        osc.start(now);
        osc.stop(now + 0.078);
        break;
      }
      case 'zlevel': {
        // Subterranean stone depth shift thrum
        osc.type = 'sine';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(115, now + 0.065);
        gain.gain.setValueAtTime(0.065, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.068);
        osc.start(now);
        osc.stop(now + 0.07);
        break;
      }
      case 'alert': {
        // Deep brass war-horn / anvil chime
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(293.66, now);
        osc.frequency.setValueAtTime(440, now + 0.055);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.145);
        break;
      }
      case 'trade': {
        // Gold coin / anvil strike
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1318.5, now + 0.035);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.105);
        break;
      }
    }
  } catch {
    // Ignore Web Audio errors when autoplay is blocked
  }
}

