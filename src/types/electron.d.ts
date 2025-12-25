/**
 * Type definitions for Electron API exposed via preload
 */

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
}

export interface ElectronAPI {
  saveFile: (data: string) => Promise<{ success: boolean; path?: string }>;
  loadFile: () => Promise<{ success: boolean; data?: string; path?: string }>;
  exportImage: (
    imageData: string,
    format: 'png' | 'svg',
    defaultFileName?: string
  ) => Promise<{ success: boolean; path?: string }>;
  openProjectFolder: () => Promise<{ success: boolean; path?: string }>;
  createProjectFolder: () => Promise<{ success: boolean; path?: string }>;
  listFiles: (folderPath: string) => Promise<{ success: boolean; files?: FileItem[] }>;
  createFolder: (parentPath: string, folderName: string) => Promise<{ success: boolean; path?: string }>;
  loadFileFromPath: (filePath: string) => Promise<{ success: boolean; data?: string; path?: string }>;
  saveFileToPath: (filePath: string, data: string) => Promise<{ success: boolean; path?: string }>;
  deleteFile: (filePath: string) => Promise<{ success: boolean }>;
  moveToFolder: (
    sourcePath: string,
    destFolderPath: string
  ) => Promise<{ success: boolean; path?: string; error?: string }>;
  renamePath: (oldPath: string, newName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  backupProject: (projectPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

