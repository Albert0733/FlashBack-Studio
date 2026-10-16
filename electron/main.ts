import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import {
  ProjectContext, FBProject, blankProject, makeContext,
  saveProject, loadProject, importReplayIntoProject, parseClipChunk,
} from './project/Project';
import { EditorState } from './state/types';
import { saveEditorState, editorStatePath } from './state/EditorStateIO';

let mainWindow: BrowserWindow | null = null;
let ctx: ProjectContext | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 950,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#1e1e1e',
    title: 'FlashBack Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const indexHtml = path.join(__dirname, '..', '..', 'dist', 'index.html');
  if (fs.existsSync(indexHtml)) {
    mainWindow.loadFile(indexHtml);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  const send = (action: string) => () => mainWindow?.webContents.send('menu:action', action);
  const menu = Menu.buildFromTemplate([
    {
      label: '檔案 (File)',
      submenu: [
        { label: '新增專案', accelerator: 'CmdOrCtrl+N', click: send('newProject') },
        { label: '開啟專案…', accelerator: 'CmdOrCtrl+O', click: send('openProject') },
        { type: 'separator' },
        { label: '儲存', accelerator: 'CmdOrCtrl+S', click: send('save') },
        { label: '另存新檔…', accelerator: 'CmdOrCtrl+Shift+S', click: send('saveAs') },
        { type: 'separator' },
        { label: '匯入 Replay…', accelerator: 'CmdOrCtrl+I', click: send('importReplay') },
        { type: 'separator' },
        { label: '結束', role: 'quit' },
      ],
    },
    {
      label: '專案 (Project)',
      submenu: [
        { label: '設定 Minecraft 資料夾…', click: send('setGameDir') },
        { label: '匯出到 Flashback', accelerator: 'CmdOrCtrl+E', click: send('export') },
      ],
    },
    {
      label: '檢視 (View)',
      submenu: [
        { label: '切換語言 (繁中/EN)', click: send('toggleLang') },
        { type: 'separator' },
        { label: '放大', role: 'zoomIn' },
        { label: '縮小', role: 'zoomOut' },
        { label: '重設縮放', role: 'resetZoom' },
        { type: 'separator' },
        { label: '重新載入', role: 'reload' },
        { label: '開發者工具', role: 'toggleDevTools' },
      ],
    },
    { label: '說明 (Help)', submenu: [{ label: '關於 FlashBack Studio', click: () => dialog.showMessageBox(mainWindow!, { type: 'info', title: '關於', message: 'FlashBack Studio', detail: '獨立的 Flashback 錄製檔剪輯器\nAI 開發 · 與 Moulberry/Flashback 模組互通' }) }] },
  ]);
  Menu.setApplicationMenu(menu);
}

function projectPayload() {
  if (!ctx) return null;
  return { projectPath: ctx.projectPath, project: ctx.project };
}

ipcMain.handle('project:new', async (_e, suggestedName: string) => {
  const res = await dialog.showSaveDialog(mainWindow!, {
    title: 'New FlashBack Studio Project',
    defaultPath: path.join(app.getPath('documents'), suggestedName || 'Untitled.fbproj'),
    filters: [{ name: 'FlashBack Studio Project', extensions: ['fbproj'] }],
  });
  if (res.canceled || !res.filePath) return null;
  const project = blankProject(path.basename(res.filePath, path.extname(res.filePath)));
  ctx = makeContext(res.filePath, project);
  await fs.promises.mkdir(ctx.mediaDir, { recursive: true });
  await saveProject(ctx);
  return projectPayload();
});

ipcMain.handle('project:open', async () => {
  const res = await dialog.showOpenDialog(mainWindow!, {
    title: 'Open Project',
    filters: [{ name: 'FlashBack Studio Project', extensions: ['fbproj'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  ctx = await loadProject(res.filePaths[0]);
  return projectPayload();
});

ipcMain.handle('project:save', async () => {
  if (!ctx) throw new Error('No project open');
  await saveProject(ctx);
  return { ok: true, path: ctx.projectPath };
});

ipcMain.handle('project:saveAs', async () => {
  if (!ctx) throw new Error('No project open');
  const res = await dialog.showSaveDialog(mainWindow!, {
    title: 'Save Project As', defaultPath: ctx.projectPath,
    filters: [{ name: 'FlashBack Studio Project', extensions: ['fbproj'] }],
  });
  if (res.canceled || !res.filePath) return null;
  ctx.projectPath = res.filePath;
  ctx.projectDir = path.dirname(res.filePath);
  const safeName = ctx.project.name.replace(/[\\/:*?"<>|]/g, '_');
  ctx.mediaDir = path.join(ctx.projectDir, `${safeName}_media`);
  await fs.promises.mkdir(ctx.mediaDir, { recursive: true });
  await saveProject(ctx);
  return projectPayload();
});

ipcMain.handle('project:get', async () => projectPayload());

ipcMain.handle('project:update', async (_e, patch: Partial<FBProject>) => {
  if (!ctx) throw new Error('No project open');
  ctx.project = { ...ctx.project, ...patch };
  await saveProject(ctx);
  return projectPayload();
});

ipcMain.handle('project:importReplay', async () => {
  if (!ctx) throw new Error('No project open. Create or open a project first.');
  const res = await dialog.showOpenDialog(mainWindow!, {
    title: 'Import Flashback replay (.zip)',
    filters: [{ name: 'Flashback replay', extensions: ['zip'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (res.canceled) return null;
  const clips = [];
  for (const f of res.filePaths) clips.push(await importReplayIntoProject(ctx, f));
  await saveProject(ctx);
  return { clips, project: ctx.project };
});

ipcMain.handle('project:removeClip', async (_e, clipId: string) => {
  if (!ctx) throw new Error('No project open');
  const clip = ctx.project.clips.find((c) => c.id === clipId);
  if (clip && fs.existsSync(clip.sourcePath)) { try { await fs.promises.unlink(clip.sourcePath); } catch {} }
  ctx.project.clips = ctx.project.clips.filter((c) => c.id !== clipId);
  ctx.openReplayCache.delete(clipId);
  await saveProject(ctx);
  return projectPayload();
});

ipcMain.handle('project:parseChunk', async (_e, clipId: string, chunkName: string) => {
  if (!ctx) throw new Error('No project open');
  const chunk = await parseClipChunk(ctx, clipId, chunkName);
  return {
    fileName: chunk.fileName, duration: chunk.duration,
    packetDensity: chunk.packetDensity, cameraPath: chunk.cameraPath,
    actionCount: chunk.actions.length,
  };
});

ipcMain.handle('project:pickGameDir', async () => {
  const res = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select Minecraft .minecraft folder', properties: ['openDirectory'],
  });
  return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle('project:exportToFlashback', async () => {
  if (!ctx) throw new Error('No project open');
  if (!ctx.project.export.gameDir) throw new Error('Set Minecraft game folder first');
  const written: string[] = [];
  for (const clip of ctx.project.clips) {
    const scenes = [{
      name: 'Scene 1', keyframeTracks: [],
      exportStartTicks: ctx.project.export.startTick,
      exportEndTicks: ctx.project.export.endTick,
      history: { entries: [], position: 0 },
    }];
    const state = {
      replayVisuals: ctx.project.replayVisuals, scenes, sceneIndex: 0,
      zoomMin: 0, zoomMax: 1, usedByPaths: [clip.sourcePath],
      hideDuringExport: [], hideAllSpectators: false, muteVoice: [], hideNametags: [],
      skinOverride: {}, skinOverrideFromFile: {}, nameOverride: {}, glowingOverride: {},
      hideTeamPrefix: [], hideTeamSuffix: [], hideBelowName: [], hideCape: [],
      filteredEntities: [], filteredParticles: [], hiddenEquipment: {}, hiddenModelParts: {},
    } as unknown as EditorState;
    await saveEditorState(ctx.project.export.gameDir, clip.uuid, state);
    written.push(editorStatePath(ctx.project.export.gameDir, clip.uuid));
  }
  return { ok: true, written };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
