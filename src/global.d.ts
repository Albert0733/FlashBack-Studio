export {};

declare global {
  interface ProjectClip {
    id: string; sourcePath: string; originalName: string; uuid: string;
    metadata: any; chunkFiles: string[]; iconPath: string | null;
    inPoint: number; outPoint: number;
  }
  interface FBProject {
    version: number; name: string; createdAt: string; updatedAt: string;
    clips: ProjectClip[]; tracks: any[];
    markers: { tick: number; label: string; color: string }[];
    replayVisuals: any;
    export: { startTick: number; endTick: number; fps: number; outputDir: string; gameDir: string };
  }
  interface ProjectPayload { projectPath: string; project: FBProject; }
  interface ParsedChunk {
    fileName: string; duration: number; packetDensity: number[];
    cameraPath: { tick: number; x: number; y: number; z: number; yaw: number; pitch: number }[];
    actionCount: number;
  }
  interface Window {
    fbstudio: {
      projectNew: (suggestedName?: string) => Promise<ProjectPayload | null>;
      projectOpen: () => Promise<ProjectPayload | null>;
      projectSave: () => Promise<{ ok: boolean; path: string }>;
      projectSaveAs: () => Promise<ProjectPayload | null>;
      projectGet: () => Promise<ProjectPayload | null>;
      projectUpdate: (patch: Partial<FBProject>) => Promise<ProjectPayload | null>;
      importReplay: () => Promise<{ clips: ProjectClip[]; project: FBProject } | null>;
      removeClip: (clipId: string) => Promise<ProjectPayload | null>;
      parseChunk: (clipId: string, chunkName: string) => Promise<ParsedChunk>;
      pickGameDir: () => Promise<string | null>;
      exportToFlashback: () => Promise<{ ok: boolean; written: string[] }>;
      onMenu: (callback: (action: string) => void) => void;
    };
  }
}
