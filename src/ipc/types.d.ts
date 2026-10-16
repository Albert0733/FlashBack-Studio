export {};

declare global {
  interface Window {
    fbstudio: {
      scanLibrary: () => Promise<any[]>;
      openReplay: (absPath: string) => Promise<any>;
      parseChunk: (chunkName: string) => Promise<any>;
      saveState: (state: unknown) => Promise<{ ok: boolean; path: string }>;
      pickReplayFile: () => Promise<string | null>;
    };
  }
}
