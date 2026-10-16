import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { openReplay, parseChunk, ReplayProject } from './replay/ReplayReader';
import { loadEditorState, saveEditorState } from './state/EditorStateIO';
import { scanReplays, defaultGameDirs, ReplaySummary } from './library/ReplayLibrary';
import { EditorState } from './state/types';

let mainWindow: BrowserWindow | null = null;
let currentProject: ReplayProject | null = null;
let currentGameDir: string = '';

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
  const indexHtml = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(indexHtml)) {
    mainWindow.loadFile(indexHtml);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }
}

ipcMain.handle('library:scan', async (): Promise<ReplaySummary[]> => {
  return scanReplays(defaultGameDirs());
});

ipcMain.handle('replay:open', async (_e, absPath: string) => {
  currentProject = await openReplay(absPath);
  const replayDir = path.dirname(absPath);
  currentGameDir = path.dirname(path.dirname(replayDir));
  const state = await loadEditorState(currentGameDir, currentProject.metadata, absPath);
  return {
    metadata: currentProject.metadata,
    chunkFiles: currentProject.chunkFiles,
    iconPath: currentProject.iconPath,
    editorState: state,
    gameDir: currentGameDir,
  };
});

ipcMain.handle('replay:parseChunk', async (_e, chunkName: string) => {
  if (!currentProject) throw new Error('No replay open');
  const chunk = await parseChunk(currentProject, chunkName);
  return {
    fileName: chunk.fileName,
    duration: chunk.duration,
    packetDensity: chunk.packetDensity,
    cameraPath: chunk.cameraPath,
    actionCount: chunk.actions.length,
  };
});

ipcMain.handle('state:save', async (_e, state: EditorState) => {
  if (!currentProject) throw new Error('No replay open');
  await saveEditorState(currentGameDir, currentProject.metadata.uuid, state);
  return { ok: true, path: path.join(currentGameDir, 'flashback', 'editor_states', `${currentProject.metadata.uuid}.json`) };
});

ipcMain.handle('dialog:openReplay', async () => {
  const res = await dialog.showOpenDialog(mainWindow!, {
    title: 'Open Flashback replay',
    filters: [{ name: 'Flashback replay', extensions: ['zip'] }],
    properties: ['openFile'],
  });
  return res.canceled ? null : res.filePaths[0];
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
