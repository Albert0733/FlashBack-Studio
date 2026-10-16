import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import * as os from 'os';
import { FlashbackMetadata, ParsedChunk, ChunkAction, FLASHBACK_MAGIC } from './types';

// Netty ByteBuf default is BIG_ENDIAN. VarInt is LEB128 unsigned.
class BinaryReader {
  buf: Buffer; pos: number;
  constructor(buf: Buffer) { this.buf = buf; this.pos = 0; }
  remaining() { return this.buf.length - this.pos; }
  readInt(): number { const v = this.buf.readInt32BE(this.pos); this.pos += 4; return v; }
  readFloat(): number { const v = this.buf.readFloatBE(this.pos); this.pos += 4; return v; }
  readDouble(): number { const v = this.buf.readDoubleBE(this.pos); this.pos += 8; return v; }
  readVarInt(): number {
    let value = 0, size = 0, b: number;
    do { b = this.buf[this.pos++]; value |= (b & 0x7f) << (size * 7); size++; if (size > 5) throw new Error('VarInt too big'); }
    while ((b & 0x80) === 0x80);
    return value;
  }
  readString(): string {
    const len = this.readVarInt();
    const s = this.buf.toString('utf8', this.pos, this.pos + len);
    this.pos += len;
    return s;
  }
  slice(n: number): Buffer { const s = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return Buffer.from(s); }
}

async function unzipToTemp(zipPath: string, workDir: string): Promise<void> {
  await fs.promises.mkdir(workDir, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    execFile('tar', ['-xf', zipPath, '-C', workDir], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export interface ReplayProject {
  zipPath: string; workDir: string;
  metadata: FlashbackMetadata; chunkFiles: string[]; iconPath: string | null;
}

export async function openReplay(zipPath: string): Promise<ReplayProject> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbstudio-'));
  await unzipToTemp(zipPath, workDir);
  const metadata = JSON.parse(await fs.promises.readFile(path.join(workDir, 'metadata.json'), 'utf8')) as FlashbackMetadata;
  const chunkFiles = Object.keys(metadata.chunks || {}).filter((n) => n.endsWith('.flashback'));
  const iconPath = fs.existsSync(path.join(workDir, 'icon.png')) ? path.join(workDir, 'icon.png') : null;
  return { zipPath, workDir, metadata, chunkFiles, iconPath };
}

export async function parseChunk(project: ReplayProject, chunkName: string): Promise<ParsedChunk> {
  const buf = await fs.promises.readFile(path.join(project.workDir, chunkName));
  const r = new BinaryReader(buf);
  const magicUnsigned = r.readInt() >>> 0;
  if (magicUnsigned !== FLASHBACK_MAGIC >>> 0) {
    throw new Error(`Bad magic in ${chunkName}: 0x${magicUnsigned.toString(16)}`);
  }
  const actionCount = r.readVarInt();
  const actionNames: string[] = [];
  for (let i = 0; i < actionCount; i++) actionNames.push(r.readString());
  const snapshotSize = r.readInt();
  const snapshotEnd = r.pos + snapshotSize;
  const allActions: ChunkAction[] = [];
  const readActionStream = (stopAt: number | null) => {
    while (stopAt === null ? r.remaining() > 0 : r.pos < stopAt) {
      if (r.remaining() < 5) break;
      const id = r.readVarInt();
      const size = r.readInt();
      if (size < 0 || r.pos + size > buf.length) break;
      const payload = r.slice(size);
      allActions.push({ id, name: actionNames[id] || `unknown_${id}`, offset: r.pos - size - 4, size, payload });
    }
  };
  readActionStream(snapshotEnd);
  const dataStart = allActions.length;
  readActionStream(null);
  const density: number[] = [];
  const cameraPath: ParsedChunk['cameraPath'] = [];
  let tick = 0;
  const endsWith = (arr: string[], s: string) => arr.findIndex((n) => n.endsWith(s));
  const nextTickId = endsWith(actionNames, 'next_tick');
  const accuratePosId = endsWith(actionNames, 'accurate_player_position');
  for (let i = dataStart; i < allActions.length; i++) {
    const a = allActions[i];
    density[tick] = (density[tick] || 0) + 1;
    if (a.id === nextTickId) tick++;
    else if (a.id === accuratePosId && a.payload.length >= 32) {
      try {
        const pr = new BinaryReader(a.payload);
        cameraPath.push({ tick, x: pr.readDouble(), y: pr.readDouble(), z: pr.readDouble(), yaw: pr.readFloat(), pitch: pr.readFloat() });
      } catch {}
    }
  }
  const duration = project.metadata.chunks[chunkName]?.duration ?? 0;
  return { fileName: chunkName, duration, actions: allActions, packetDensity: density, cameraPath };
}
