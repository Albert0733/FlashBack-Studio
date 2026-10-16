// Minimal big-endian binary reader matching Netty/FriendlyByteBuf conventions.
export class BufReader {
  buf: Buffer;
  pos: number;
  constructor(buf: Buffer, pos = 0) { this.buf = buf; this.pos = pos; }
  readUByte(): number { const v = this.buf[this.pos]; this.pos += 1; return v; }
  readShort(): number { const v = this.buf.readInt16BE(this.pos); this.pos += 2; return v; }
  readUnsignedShort(): number { const v = this.buf.readUInt16BE(this.pos); this.pos += 2; return v; }
  readInt(): number { const v = this.buf.readInt32BE(this.pos); this.pos += 4; return v; }
  readLong(): bigint { const v = this.buf.readBigInt64BE(this.pos); this.pos += 8; return v; }
  readVarInt(): number {
    let value = 0, size = 0, b: number;
    do { b = this.buf[this.pos++]; value |= (b & 0x7f) << (size * 7); size++; if (size > 5) throw new Error('VarInt too big'); } while ((b & 0x80) === 0x80);
    return value;
  }
}

export function skipNBT(r: BufReader): void {
  const type = r.readUByte();
  if (type === 0) return;
  const nameLen = r.readUnsignedShort();
  r.pos += nameLen;
  skipNBTPayload(r, type);
}

function skipNBTPayload(r: BufReader, type: number): void {
  switch (type) {
    case 1: r.pos += 1; break;
    case 2: r.pos += 2; break;
    case 3: r.pos += 4; break;
    case 4: r.pos += 8; break;
    case 5: r.pos += 4; break;
    case 6: r.pos += 8; break;
    case 7: { const n = r.readInt(); r.pos += n; break; }
    case 8: { const n = r.readUnsignedShort(); r.pos += n; break; }
    case 9: { const elemType = r.readUByte(); const n = r.readInt(); for (let i = 0; i < n; i++) skipNBTPayload(r, elemType); break; }
    case 10: { while (true) { const t = r.readUByte(); if (t === 0) break; const nl = r.readUnsignedShort(); r.pos += nl; skipNBTPayload(r, t); } break; }
    case 11: { const n = r.readInt(); r.pos += n * 4; break; }
    case 12: { const n = r.readInt(); r.pos += n * 8; break; }
    default: throw new Error('Unknown NBT tag type ' + type);
  }
}
