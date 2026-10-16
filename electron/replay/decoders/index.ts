import { DecoderProfile, DecodedChunk } from './DecoderProfile';
import { MC1_21Decoder } from './v1_21';

const PROFILES: DecoderProfile[] = [new MC1_21Decoder()];

export function pickDecoder(dataVersion: number): DecoderProfile {
  for (const p of PROFILES) {
    if (dataVersion >= p.dataVersionMin && dataVersion <= p.dataVersionMax) return p;
  }
  return PROFILES[PROFILES.length - 1];
}

export interface ChunkRecord { bytes: Buffer; }

export async function readChunkCacheFile(path: string, fs: typeof import('fs')): Promise<ChunkRecord[]> {
  const fd = await fs.promises.open(path, 'r');
  const records: ChunkRecord[] = [];
  try {
    const stat = await fd.stat();
    const total = stat.size;
    let offset = 0;
    while (offset + 4 <= total) {
      const sizeBuf = Buffer.alloc(4);
      await fd.read(sizeBuf, 0, 4, offset);
      const size = sizeBuf.readInt32BE(0);
      offset += 4;
      if (size <= 0 || offset + size > total) break;
      const chunkBuf = Buffer.alloc(size);
      await fd.read(chunkBuf, 0, size, offset);
      offset += size;
      records.push({ bytes: chunkBuf });
    }
  } finally { await fd.close(); }
  return records;
}

export async function decodeAllChunks(cacheFiles: string[], dataVersion: number, fs: typeof import('fs')): Promise<DecodedChunk[]> {
  const profile = pickDecoder(dataVersion);
  const out: DecodedChunk[] = [];
  for (const cf of cacheFiles) {
    try {
      const records = await readChunkCacheFile(cf, fs);
      for (const rec of records) {
        const c = profile.decodeChunkPacket(rec.bytes);
        if (c) out.push(c);
      }
    } catch {}
  }
  return out;
}
