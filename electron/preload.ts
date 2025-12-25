/**
 * Electron preload script
 * Exposes safe APIs to the renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data: string) => ipcRenderer.invoke('save-file', data),
  loadFile: () => ipcRenderer.invoke('load-file'),
  exportImage: (imageData: string, format: 'png' | 'svg', defaultFileName?: string) =>
    ipcRenderer.invoke('export-image', imageData, format, defaultFileName),
  openProjectFolder: () => ipcRenderer.invoke('open-project-folder'),
  createProjectFolder: () => ipcRenderer.invoke('create-project-folder'),
  listFiles: (folderPath: string) => ipcRenderer.invoke('list-files', folderPath),
  createFolder: (parentPath: string, folderName: string) =>
    ipcRenderer.invoke('create-folder', parentPath, folderName),
  loadFileFromPath: (filePath: string) => ipcRenderer.invoke('load-file-from-path', filePath),
  saveFileToPath: (filePath: string, data: string) =>
    ipcRenderer.invoke('save-file-to-path', filePath, data),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  moveToFolder: (sourcePath: string, destFolderPath: string) =>
    ipcRenderer.invoke('move-to-folder', sourcePath, destFolderPath),
  renamePath: (oldPath: string, newName: string) => ipcRenderer.invoke('rename-path', oldPath, newName),
});

