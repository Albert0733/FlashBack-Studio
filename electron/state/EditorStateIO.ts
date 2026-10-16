import * as fs from 'fs';
import * as path from 'path';
import { EditorState } from './types';
import { FlashbackMetadata } from '../replay/types';

export function editorStatePath(gameDir: string, replayUuid: string): string {
  return path.join(gameDir, 'flashback', 'editor_states', `${replayUuid}.json`);
}

export function defaultEditorState(replayPath: string): EditorState {
  return {
    replayVisuals: {
      showChat: false, showBossBar: false, showTitleText: false, showScoreboard: false,
      showActionBar: false, showHotbar: true, renderBlocks: true, renderEntities: true,
      renderPlayers: true, renderParticles: true, renderSky: true,
      skyColour: [0.0, 1.0, 0.0], renderNametags: true, renderBeaconBeams: true,
      overrideFog: false, overrideFogStart: 0.0, overrideFogEnd: 256.0,
      overrideFogColour: false, fogColour: [0.0, 1.0, 0.0],
      overrideFov: false, overrideFovAmount: -1.0, overrideCameraShake: false,
      cameraShakeSplitParams: false, cameraShakeYFrequency: 1.0, cameraShakeYAmplitude: 1.0,
      cameraShakeXFrequency: 1.0, cameraShakeXAmplitude: 1.0,
      overrideRoll: false, overrideRollAmount: 0.0, overrideWeatherMode: 'NONE',
      overrideTimeOfDay: -1, overrideNightVision: false,
      ruleOfThirdsGuide: false, centerGuide: false, cameraPath: true,
      sizing: 'KEEP_ASPECT_RATIO', changeAspectRatio: 'ASPECT_16_9',
      disableServerResourcePack: false,
    },
    scenes: [{ name: 'Scene 1', keyframeTracks: [], exportStartTicks: -1, exportEndTicks: -1, history: { entries: [], position: 0 } }],
    sceneIndex: 0, zoomMin: 0.0, zoomMax: 1.0, usedByPaths: [replayPath],
    hideDuringExport: [], hideAllSpectators: false, muteVoice: [], hideNametags: [],
    skinOverride: {}, skinOverrideFromFile: {}, nameOverride: {}, glowingOverride: {},
    hideTeamPrefix: [], hideTeamSuffix: [], hideBelowName: [], hideCape: [],
    filteredEntities: [], filteredParticles: [] as string[], hiddenEquipment: {}, hiddenModelParts: {},
  } as unknown as EditorState;
}

export async function loadEditorState(gameDir: string, replay: FlashbackMetadata, replayPath: string): Promise<EditorState> {
  const p = editorStatePath(gameDir, replay.uuid);
  if (fs.existsSync(p)) {
    try {
      const st = JSON.parse(await fs.promises.readFile(p, 'utf8')) as EditorState;
      if (!st.usedByPaths) st.usedByPaths = [];
      if (!st.usedByPaths.includes(replayPath)) st.usedByPaths.push(replayPath);
      return st;
    } catch {}
  }
  return defaultEditorState(replayPath);
}

export async function saveEditorState(gameDir: string, replayUuid: string, state: EditorState): Promise<void> {
  const p = editorStatePath(gameDir, replayUuid);
  await fs.promises.mkdir(path.dirname(p), { recursive: true });
  await fs.promises.writeFile(p, JSON.stringify(state), 'utf8');
}
