import * as fs from 'fs';
import * as path from 'path';
import { openReplay, parseChunk, ReplayProject } from '../replay/ReplayReader';
import { FlashbackMetadata } from '../replay/types';
import { EditorState } from '../state/types';

export interface ProjectClip {
  id: string; sourcePath: string; originalName: string; uuid: string;
  metadata: FlashbackMetadata; chunkFiles: string[]; iconPath: string | null;
  inPoint: number; outPoint: number;
}
export interface FBProject {
  version: 1; name: string; createdAt: string; updatedAt: string;
  clips: ProjectClip[]; tracks: any[]; markers: { tick: number; label: string; color: string }[];
  replayVisuals: any;
  export: { startTick: number; endTick: number; fps: number; outputDir: string; gameDir: string };
}
export interface ProjectContext {
  projectPath: string; projectDir: string; mediaDir: string;
  project: FBProject; openReplayCache: Map<string, ReplayProject>;
}

export function blankProject(name: string): FBProject {
  return {
    version: 1, name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    clips: [], tracks: [], markers: [],
    replayVisuals: {
      showChat: true, showBossBar: true, showTitleText: true, showScoreboard: true,
      showActionBar: true, showHotbar: true, renderNametags: true, ruleOfThirdsGuide: false,
      centerGuide: false, cameraPath: true,
      renderBlocks: true, renderEntities: true, renderPlayers: true, renderParticles: true,
      renderSky: true, renderBeaconBeams: true,
      overrideFov: false, overrideFovAmount: 70, changeAspectRatio: '16:9',
      skyColour: [135, 206, 235], fogColour: [192, 192, 192],
    },
    export: { startTick: -1, endTick: -1, fps: 60, outputDir: '', gameDir: '' },
  };
}

export function makeContext(projectPath: string, project: FBProject): ProjectContext {
  const projectDir = path.dirname(projectPath);
  const safeName = project.name.replace(/[\\/:*?"<>|]/g, '_');
  return { projectPath, projectDir, mediaDir: path.join(projectDir, `${safeName}_media`), project, openReplayCache: new Map() };
}

export async function saveProject(ctx: ProjectContext): Promise<void> {
  ctx.project.updatedAt = new Date().toISOString();
  await fs.promises.writeFile(ctx.projectPath, JSON.stringify(ctx.project, null, 2), 'utf-8');
}

export async function loadProject(projectPath: string): Promise<ProjectContext> {
  const raw = await fs.promises.readFile(projectPath, 'utf-8');
  return makeContext(projectPath, JSON.parse(raw) as FBProject);
}

export async function importReplayIntoProject(ctx: ProjectContext, sourceZip: string): Promise<ProjectClip> {
  await fs.promises.mkdir(ctx.mediaDir, { recursive: true });
  const replay = await openReplay(sourceZip);
  const ext = path.extname(sourceZip);
  const baseName = path.basename(sourceZip, ext);
  let targetName = `${baseName}${ext}`; let i = 1;
  while (fs.existsSync(path.join(ctx.mediaDir, targetName))) { targetName = `${baseName}_${i}${ext}`; i++; }
  const targetPath = path.join(ctx.mediaDir, targetName);
  await fs.promises.copyFile(sourceZip, targetPath);
  const clip: ProjectClip = {
    id: 'clip-' + Math.random().toString(36).slice(2, 10),
    sourcePath: targetPath, originalName: path.basename(sourceZip),
    uuid: replay.metadata.uuid, metadata: replay.metadata,
    chunkFiles: replay.chunkFiles, iconPath: replay.iconPath,
    inPoint: 0, outPoint: replay.metadata.total_ticks ?? 0,
  };
  ctx.project.clips.push(clip);
  ctx.openReplayCache.set(clip.id, replay);
  return clip;
}

export async function getCachedReplay(ctx: ProjectContext, clipId: string): Promise<ReplayProject> {
  const clip = ctx.project.clips.find((c) => c.id === clipId);
  if (!clip) throw new Error('Clip not found: ' + clipId);
  if (!ctx.openReplayCache.has(clipId)) ctx.openReplayCache.set(clipId, await openReplay(clip.sourcePath));
  return ctx.openReplayCache.get(clipId)!;
}

export async function parseClipChunk(ctx: ProjectContext, clipId: string, chunkName: string) {
  const replay = await getCachedReplay(ctx, clipId);
  return parseChunk(replay, chunkName);
}
