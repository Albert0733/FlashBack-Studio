// DecoderProfile: a per-MC-version decoder that turns raw level_chunk_caches bytes
// into neutral voxel data (world coords -> block name string).

export interface ChunkSection {
  blocks: Int32Array | null;
  blockCount: number;
  sectionY: number;
}

export interface DecodedChunk {
  chunkX: number;
  chunkZ: number;
  sections: ChunkSection[];
}

export interface DecoderProfile {
  dataVersionMin: number;
  dataVersionMax: number;
  versionLabel: string;
  worldHeight: number;
  minY: number;
  sectionsPerChunk: number;
  decodeChunkPacket(buf: Buffer): DecodedChunk | null;
  stateName(stateId: number): string;
}
