import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FlashbackMetadata } from '../replay/types';

export interface ReplaySummary {
  absPath: string; fileName: string; sizeBytes: number; mtimeMs: number;
  uuid: string | null; name: string; versionString: string | null;
  worldName: string | null; totalTicks: number; durationSeconds: number;
}

function readMetadataFromZip(zipPath: string): FlashbackMetadata | null {
  try {
    const fd = fs.openSync(zipPath, 'r');
    try {
      const stat = fs.fstatSync(fd);
      const readSize = Math.min(65536, stat.size);
      const tail = Buffer.alloc(readSize);
      fs.readSync(fd, tail, 0, readSize, stat.size - readSize);
      let eocd = -1;
      for (let i = readSize - 22; i >= 0; i--) {
        if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
      }
      if (eocd < 0) return null;
      const cdSize = tail.readUInt32LE(eocd + 12);
      const cdOffset = tail.readUInt32LE(eocd + 16);
      const cd = Buffer.alloc(cdSize);
      fs.readSync(fd, cd, 0, cdSize, cdOffset);
      let p = 0;
      while (p < cd.length - 46) {
        if (cd.readUInt32LE(p) !== 0x02014b50) break;
        const compMethod = cd.readUInt16LE(p + 10);
        const compSize = cd.readUInt32LE(p + 20);
        const nameLen = cd.readUInt16LE(p + 28);
        const extraLen = cd.readUInt16LE(p + 30);
        const commentLen = cd.readUInt16LE(p + 32);
        const localOffset = cd.readUInt32LE(p + 42);
        const name = cd.toString('utf8', p + 46, p + 46 + nameLen);
        if (name === 'metadata.json') {
          const lh = Buffer.alloc(30);
          fs.readSync(fd, lh, 0, 30, localOffset);
          const lNameLen = lh.readUInt16LE(26);
          const lExtraLen = lh.readUInt16LE(28);
          const dataStart = localOffset + 30 + lNameLen + lExtraLen;
          const data = Buffer.alloc(compSize);
          fs.readSync(fd, data, 0, compSize, dataStart);
          const inflated = compMethod === 8 ? require('zlib').inflateRawSync(data) : data;
          return JSON.parse(inflated.toString('utf8')) as FlashbackMetadata;
        }
        p += 46 + nameLen + extraLen + commentLen;
      }
      return null;
    } finally { fs.closeSync(fd); }
  } catch { return null; }
}

export function scanReplays(candidateGameDirs: string[]): ReplaySummary[] {
  const out: ReplaySummary[] = [];
  const seen = new Set<string>();
  for (const gameDir of candidateGameDirs) {
    const replayDir = path.join(gameDir, 'flashback', 'replays');
    if (!fs.existsSync(replayDir)) continue;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(replayDir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isFile() || !e.name.toLowerCase().endsWith('.zip')) continue;
      const abs = path.join(replayDir, e.name);
      if (seen.has(abs)) continue;
      seen.add(abs);
      try {
        const st = fs.statSync(abs);
        const meta = readMetadataFromZip(abs);
        out.push({
          absPath: abs, fileName: e.name, sizeBytes: st.size, mtimeMs: st.mtimeMs,
          uuid: meta?.uuid ?? null, name: meta?.name ?? e.name,
          versionString: meta?.version_string ?? null, worldName: meta?.world_name ?? null,
          totalTicks: meta?.total_ticks ?? 0, durationSeconds: (meta?.total_ticks ?? 0) / 20,
        });
      } catch {}
    }
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out;
}

export function defaultGameDirs(): string[] {
  const appdata = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const mcRoot = path.join(appdata, '.minecraft');
  const dirs: string[] = [mcRoot];
  const versionsDir = path.join(mcRoot, 'versions');
  try {
    for (const e of fs.readdirSync(versionsDir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        const candidate = path.join(versionsDir, e.name);
        if (fs.existsSync(path.join(candidate, 'flashback'))) dirs.push(candidate);
      }
    }
  } catch {}
  return dirs;
}
