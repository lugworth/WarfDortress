import type { GameState } from './types.ts';
import { parseLocalSave, serializeLocalSave } from './local-save.ts';

/**
 * Format 1: the local-save JSON envelope, gzip-compressed. A 3,000-tick fortress
 * is about 2.7 MB of JSON but under 100 KB compressed, because the tile grid is
 * highly repetitive.
 */
export const SNAPSHOT_FORMAT = 1;

/** Firestore caps a field at 1,048,487 bytes; keep room for the rest of the document. */
export const MAX_SNAPSHOT_BYTES = 900_000;

const MAX_UNPACKED_CHARS = 32_000_000;

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function packFortressSnapshot(state: GameState): Promise<Uint8Array> {
  const packed = await readAll(
    new Blob([serializeLocalSave(state)]).stream().pipeThrough(new CompressionStream('gzip'))
  );
  if (packed.length > MAX_SNAPSHOT_BYTES) {
    throw new RangeError(`Fortress snapshot is ${packed.length} bytes; the limit is ${MAX_SNAPSHOT_BYTES}.`);
  }
  return packed;
}

/** Returns the restored (paused) fortress, or null for corrupt, oversized, or invalid data. */
export async function unpackFortressSnapshot(
  packed: Uint8Array,
  maxChars = MAX_UNPACKED_CHARS
): Promise<GameState | null> {
  try {
    const reader = new Blob([packed as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'))
      .pipeThrough(new TextDecoderStream())
      .getReader();
    let text = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += value;
      if (text.length > maxChars) {
        await reader.cancel();
        return null;
      }
    }
    return parseLocalSave(text);
  } catch {
    return null;
  }
}
