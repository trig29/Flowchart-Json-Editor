/**
 * Electron main process
 * Handles window creation and file operations
 */

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'fs/promises';
import { createWriteStream } from 'fs';
import * as path from 'path';
import archiver from 'archiver';

let mainWindow: BrowserWindow | null = null;
const backupLocks = new Map<string, boolean>();

const formatTimestamp = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
};

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the React app
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // In `npm start` (not packaged), we still want to load the built renderer output.
    // Make sure to run `npm run build` once before `npm start`.
    mainWindow.loadFile(path.join(__dirname, '../dist-react/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for file operations
ipcMain.handle('save-file', async (_, data: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    defaultPath: 'flowchart.json',
  });

  if (!result.canceled && result.filePath) {
    await fs.writeFile(result.filePath, data, 'utf-8');
    return { success: true, path: result.filePath };
  }

  return { success: false };
});

ipcMain.handle('load-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const data = await fs.readFile(filePath, 'utf-8');
    return { success: true, data, path: filePath };
  }

  return { success: false };
});

// Open project folder
ipcMain.handle('open-project-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }

  return { success: false };
});

// Create new project folder
ipcMain.handle('create-project-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }

  return { success: false };
});

// List files in folder
ipcMain.handle('list-files', async (_, folderPath: string) => {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const files: Array<{ name: string; path: string; type: 'file' | 'folder' }> = [];

    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      if (entry.isDirectory()) {
        files.push({ name: entry.name, path: fullPath, type: 'folder' });
      } else if (entry.name.endsWith('.json')) {
        files.push({ name: entry.name, path: fullPath, type: 'file' });
      }
    }

    // Sort: folders first, then files
    files.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return { success: true, files };
  } catch (error) {
    console.error('Failed to list files:', error);
    return { success: false, files: [] };
  }
});

// Create folder
ipcMain.handle('create-folder', async (_, parentPath: string, folderName: string) => {
  try {
    const newFolderPath = path.join(parentPath, folderName);
    await fs.mkdir(newFolderPath, { recursive: true });
    return { success: true, path: newFolderPath };
  } catch (error) {
    console.error('Failed to create folder:', error);
    return { success: false };
  }
});

// Load file from path
ipcMain.handle('load-file-from-path', async (_, filePath: string) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return { success: true, data, path: filePath };
  } catch (error) {
    console.error('Failed to load file:', error);
    return { success: false };
  }
});

// Save file to path
ipcMain.handle('save-file-to-path', async (_, filePath: string, data: string) => {
  try {
    await fs.writeFile(filePath, data, 'utf-8');
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Failed to save file:', error);
    return { success: false };
  }
});

// Delete file or folder
ipcMain.handle('delete-file', async (_, filePath: string) => {
  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      await fs.rmdir(filePath, { recursive: true });
    } else {
      await fs.unlink(filePath);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to delete file:', error);
    return { success: false };
  }
});

// Move a file or folder into another folder (keep basename)
ipcMain.handle('move-to-folder', async (_, sourcePath: string, destFolderPath: string) => {
  try {
    const sourceStats = await fs.stat(sourcePath);
    const destStats = await fs.stat(destFolderPath);
    if (!destStats.isDirectory()) {
      return { success: false, error: 'Destination is not a folder' };
    }

    const baseName = path.basename(sourcePath);
    const destPath = path.join(destFolderPath, baseName);

    // Prevent moving folder into itself or its subfolder
    if (sourceStats.isDirectory()) {
      const rel = path.relative(sourcePath, destFolderPath);
      if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
        return { success: false, error: 'Cannot move a folder into itself' };
      }
    }

    // Prevent overwrite
    try {
      await fs.stat(destPath);
      return { success: false, error: 'Destination already exists' };
    } catch {
      // ok
    }

    await fs.rename(sourcePath, destPath);
    return { success: true, path: destPath };
  } catch (error) {
    console.error('Failed to move path:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Rename a file or folder (within same parent directory)
ipcMain.handle('rename-path', async (_, oldPath: string, newName: string) => {
  try {
    const trimmed = (newName || '').trim();
    if (!trimmed) return { success: false, error: 'Name is empty' };

    // Basic traversal prevention: name cannot contain separators
    if (trimmed.includes('/') || trimmed.includes('\\')) {
      return { success: false, error: 'Invalid name' };
    }

    const dir = path.dirname(oldPath);
    const isJson = oldPath.toLowerCase().endsWith('.json');
    const normalizedName = isJson && !trimmed.toLowerCase().endsWith('.json') ? `${trimmed}.json` : trimmed;
    const newPath = path.join(dir, normalizedName);

    if (newPath === oldPath) return { success: true, path: newPath };

    // Prevent overwrite
    try {
      await fs.stat(newPath);
      return { success: false, error: 'Destination already exists' };
    } catch {
      // ok
    }

    await fs.rename(oldPath, newPath);
    return { success: true, path: newPath };
  } catch (error) {
    console.error('Failed to rename path:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('export-image', async (_, imageData: string, format: 'png' | 'svg', defaultFileName?: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    filters: [
      { name: format === 'png' ? 'PNG Images' : 'SVG Images', extensions: [format] },
    ],
    defaultPath: defaultFileName || `flowchart.${format}`,
  });

  if (!result.canceled && result.filePath) {
    if (format === 'png') {
      // PNG: imageData is base64 data URL
      const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
      await fs.writeFile(result.filePath, base64Data, 'base64');
    } else {
      // SVG: imageData is SVG string
      await fs.writeFile(result.filePath, imageData, 'utf-8');
    }
    return { success: true, path: result.filePath };
  }

  return { success: false };
});

// Backup project folder to zip inside <projectPath>/backups
ipcMain.handle('backup-project', async (_, projectPath: string) => {
  try {
    if (!projectPath) return { success: false, error: 'Missing project path' };

    // simple per-project lock
    if (backupLocks.get(projectPath)) {
      return { success: false, error: 'Backup already running' };
    }
    backupLocks.set(projectPath, true);

    const backupsDir = path.join(projectPath, 'backups');
    await fs.mkdir(backupsDir, { recursive: true });

    const zipName = `backup-${formatTimestamp(new Date())}.zip`;
    const zipPath = path.join(backupsDir, zipName);

    // Create zip stream
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    const done = new Promise<{ success: boolean; path?: string; error?: string }>((resolve) => {
      output.on('close', () => resolve({ success: true, path: zipPath }));
      output.on('error', (err) => resolve({ success: false, error: err.message }));
      archive.on('error', (err) => resolve({ success: false, error: err.message }));
    });

    archive.pipe(output);

    // Only backup JSON files to keep archive size small.
    // Still exclude backups itself and typical build/dev folders.
    archive.glob('**/*.json', {
      cwd: projectPath,
      dot: true,
      follow: false,
      ignore: [
        'backups/**',
        '**/backups/**',
        'node_modules/**',
        'dist/**',
        'dist-react/**',
        'release/**',
        '.git/**',
      ],
    });

    await archive.finalize();
    const result = await done;
    return result;
  } catch (error) {
    console.error('Failed to backup project:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    backupLocks.delete(projectPath);
  }
});

