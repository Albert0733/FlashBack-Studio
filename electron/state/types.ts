// Types mirroring Flashback's editor state JSON (see EditorState.java)

export interface ReplayVisuals {
  showChat: boolean; showBossBar: boolean; showTitleText: boolean; showScoreboard: boolean;
  showActionBar: boolean; showHotbar: boolean; renderBlocks: boolean; renderEntities: boolean;
  renderPlayers: boolean; renderParticles: boolean; renderSky: boolean;
  skyColour: [number, number, number]; renderNametags: boolean; renderBeaconBeams: boolean;
  overrideFog: boolean; overrideFogStart: number; overrideFogEnd: number;
  overrideFogColour: boolean; fogColour: [number, number, number];
  overrideFov: boolean; overrideFovAmount: number;
  overrideCameraShake: boolean; cameraShakeSplitParams: boolean;
  cameraShakeYFrequency: number; cameraShakeYAmplitude: number;
  cameraShakeXFrequency: number; cameraShakeXAmplitude: number;
  overrideRoll: boolean; overrideRollAmount: number;
  overrideWeatherMode: string; overrideTimeOfDay: number; overrideNightVision: boolean;
  ruleOfThirdsGuide: boolean; centerGuide: boolean; cameraPath: boolean;
  sizing: string; changeAspectRatio: string; disableServerResourcePack: boolean;
  [k: string]: unknown;
}

export interface Keyframe { tick?: number; [k: string]: unknown; }
export interface KeyframeTrack {
  enabled: boolean;
  keyframeType: { id: string; name: string };
  keyframesByTick: Record<string, Keyframe>;
  [k: string]: unknown;
}
export interface EditorScene {
  name: string; keyframeTracks: KeyframeTrack[];
  exportStartTicks: number; exportEndTicks: number;
  history?: { entries: unknown[]; position: number };
}
export interface EditorState {
  replayVisuals: ReplayVisuals;
  scenes: EditorScene[]; sceneIndex: number;
  zoomMin: number; zoomMax: number; usedByPaths: string[];
  audioSourceEntity?: string | null;
  hideDuringExport: string[]; hideAllSpectators: boolean; muteVoice: string[];
  hideNametags: string[]; skinOverride: Record<string, unknown>;
  skinOverrideFromFile: Record<string, unknown>; nameOverride: Record<string, string>;
  glowingOverride: Record<string, unknown>; hideTeamPrefix: string[]; hideTeamSuffix: string[];
  hideBelowName: string[]; hideCape: string[]; filteredEntities: string[];
  filteredParticles: string[]; hiddenEquipment: Record<string, unknown>;
  hiddenModelParts: Record<string, unknown>;
  [k: string]: unknown;
}
