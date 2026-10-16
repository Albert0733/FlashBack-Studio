import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('fbstudio', {
  scanLibrary: () => ipcRenderer.invoke('library:scan'),
  openReplay: (absPath: string) => ipcRenderer.invoke('replay:open', absPath),
  parseChunk: (chunkName: string) => ipcRenderer.invoke('replay:parseChunk', chunkName),
  saveState: (state: unknown) => ipcRenderer.invoke('state:save', state),
  pickReplayFile: () => ipcRenderer.invoke('dialog:openReplay'),
});
