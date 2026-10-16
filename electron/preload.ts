import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('fbstudio', {
  projectNew: (suggestedName) => ipcRenderer.invoke('project:new', suggestedName),
  projectOpen: () => ipcRenderer.invoke('project:open'),
  projectSave: () => ipcRenderer.invoke('project:save'),
  projectSaveAs: () => ipcRenderer.invoke('project:saveAs'),
  projectGet: () => ipcRenderer.invoke('project:get'),
  projectUpdate: (patch) => ipcRenderer.invoke('project:update', patch),
  importReplay: () => ipcRenderer.invoke('project:importReplay'),
  removeClip: (clipId) => ipcRenderer.invoke('project:removeClip', clipId),
  parseChunk: (clipId, chunkName) => ipcRenderer.invoke('project:parseChunk', clipId, chunkName),
  pickGameDir: () => ipcRenderer.invoke('project:pickGameDir'),
  exportToFlashback: () => ipcRenderer.invoke('project:exportToFlashback'),
  onMenu: (callback) => {
    ipcRenderer.removeAllListeners('menu:action');
    ipcRenderer.on('menu:action', (_e, action) => callback(action));
  },
});
