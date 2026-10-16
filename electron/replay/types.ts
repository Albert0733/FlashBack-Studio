// Types mirroring Flashback's metadata.json (see FlashbackMeta.java / FlashbackChunkMeta.java)

export interface FlashbackChunkMeta {
  duration: number;
  forcePlaySnapshot: boolean;
}

export interface ReplayMarker {
  [k: string]: unknown;
}

export interface FlashbackMetadata {
  uuid: string;
  name: string;
  version_string?: string;
  world_name?: string;
  bobby_world_name?: string;
  data_version?: number;
  protocol_version?: number;
  total_ticks?: number;
  markers?: Record<string, ReplayMarker>;
  chunks: Record<string, FlashbackChunkMeta>;
  modVersions?: Record<string, string>;
  customNamespacesForRegistries?: Record<string, string[]>;
  distantHorizonPaths?: Record<string, string>;
}

// From Flashback.java: public static final int MAGIC = 0xD780E884;
export const FLASHBACK_MAGIC = 0xD780E884;

export interface ChunkAction {
  id: number;
  name: string;
  offset: number;
  size: number;
  payload: Buffer;
}

export interface ParsedChunk {
  fileName: string;
  duration: number;
  actions: ChunkAction[];
  packetDensity: number[];
  cameraPath: { tick: number; x: number; y: number; z: number; yaw: number; pitch: number }[];
}
