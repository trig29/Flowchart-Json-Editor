/**
 * File Explorer sidebar component - VSCode-like project explorer
 * Shows project folder structure with flowchart files
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { serializeFlowchart, createFlowchart } from '../models/flowchart';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileItem[];
  loaded?: boolean;
}

interface FileExplorerProps {
  projectPath: string | null;
  onNewProject: () => void;
  onOpenProject: () => void;
  onLoadFile: (filePath: string) => void;
  onSaveFile: (filePath: string, data: string) => void;
  onFilePathChanged?: (oldPath: string, newPath: string) => void;
  onRefresh?: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  item: FileItem | null;
  parentPath: string | null;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  projectPath,
  onNewProject,
  onOpenProject,
  onLoadFile,
  onSaveFile,
  onFilePathChanged,
  onRefresh,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [fileTree, setFileTree] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [createDialog, setCreateDialog] = useState<{
    type: 'flowchart' | 'folder';
    parentPath: string;
  } | null>(null);
  const [createName, setCreateName] = useState('');
  const [renameDialog, setRenameDialog] = useState<{ item: FileItem } | null>(null);
  const [renameName, setRenameName] = useState('');
  const [dragOverFolderPath, setDragOverFolderPath] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const lastBackupAtRef = useRef<number>(0);

  // Load file tree when project path changes
  useEffect(() => {
    if (projectPath && window.electronAPI) {
      loadFileTree(projectPath);
    } else {
      setFileTree([]);
    }
  }, [projectPath]);

  const runBackup = useCallback(
    async (silent: boolean) => {
      if (!projectPath) return;
      if (!window.electronAPI?.backupProject) {
        if (!silent) alert('Electron API 不可用');
        return;
      }
      if (isBackingUp) return;

      setIsBackingUp(true);
      try {
        const result = await window.electronAPI.backupProject(projectPath);
        if (result.success && result.path) {
          lastBackupAtRef.current = Date.now();
          if (!silent) alert(`备份成功：${result.path}`);
        } else if (!silent) {
          alert(`备份失败：${result.error || '未知错误'}`);
        }
      } finally {
        setIsBackingUp(false);
      }
    },
    [projectPath, isBackingUp]
  );

  // Auto backup every 5 minutes (silent)
  useEffect(() => {
    if (!projectPath) return;
    const interval = window.setInterval(() => {
      // Avoid backing up too frequently if user clicks manual backup
      if (Date.now() - lastBackupAtRef.current < 60_000) return;
      runBackup(true);
    }, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [projectPath, runBackup]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  const loadFileTree = async (folderPath: string) => {
    setIsLoading(true);
    try {
      if (window.electronAPI?.listFiles) {
        const result = await window.electronAPI.listFiles(folderPath);
        if (result.success && result.files) {
          setFileTree(result.files.map(item => ({ ...item, loaded: false })));
        }
      }
    } catch (error) {
      console.error('Failed to load file tree:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFolderChildren = async (folderPath: string): Promise<FileItem[]> => {
    try {
      if (window.electronAPI?.listFiles) {
        const result = await window.electronAPI.listFiles(folderPath);
        if (result.success && result.files) {
          return result.files.map(item => ({ ...item, loaded: false }));
        }
      }
    } catch (error) {
      console.error('Failed to load folder children:', error);
    }
    return [];
  };

  const updateTreeAtPath = (
    items: FileItem[],
    targetPath: string,
    updater: (item: FileItem) => FileItem
  ): FileItem[] => {
    return items.map((i) => {
      if (i.path === targetPath) return updater(i);
      if (i.children) return { ...i, children: updateTreeAtPath(i.children, targetPath, updater) };
      return i;
    });
  };

  const toggleFolder = async (item: FileItem) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(item.path)) {
      newExpanded.delete(item.path);
    } else {
      newExpanded.add(item.path);
      // Load children if not loaded
      if (!item.loaded && item.type === 'folder') {
        const children = await loadFolderChildren(item.path);
        setFileTree((prev) =>
          updateTreeAtPath(prev, item.path, (i) => ({ ...i, children, loaded: true }))
        );
      }
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileClick = (item: FileItem) => {
    setSelectedItem(item);
    if (item.type === 'file') {
      onLoadFile(item.path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: FileItem | null, parentPath: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
      parentPath,
    });
    if (item) {
      setSelectedItem(item);
    }
  };

  const getTargetFolderPath = (): string | null => {
    if (!projectPath) return null;
    if (contextMenu?.item?.type === 'folder') return contextMenu.item.path;
    if (contextMenu?.parentPath) return contextMenu.parentPath;
    return projectPath;
  };

  const openCreateDialog = (type: 'flowchart' | 'folder', parentPath: string) => {
    setCreateDialog({ type, parentPath });
    setCreateName(type === 'flowchart' ? '未命名流程图' : '新建文件夹');
  };

  const createFlowchartFile = async (parentPath: string, name: string) => {
    if (!window.electronAPI?.saveFileToPath) {
      alert('Electron API 不可用');
      return;
    }
    const fileName = name.trim();
    if (!fileName) return;

    try {
      const separator = parentPath.includes('\\') ? '\\' : '/';
      const filePath =
        parentPath +
        (parentPath.endsWith('/') || parentPath.endsWith('\\') ? '' : separator) +
        fileName +
        '.json';
      const newFlowchart = createFlowchart();
      const json = serializeFlowchart(newFlowchart);
      const result = await window.electronAPI.saveFileToPath(filePath, json);
      if (!result.success) {
        alert('创建流程图文件失败');
        return;
      }

      // Keep parent folder expanded (VSCode-like)
      setExpandedFolders((prev) => new Set(prev).add(parentPath));
      await loadFileTree(projectPath!);
      if (onRefresh) onRefresh();
      onLoadFile(filePath);
    } catch (error) {
      console.error('Failed to create flowchart:', error);
      alert('创建流程图文件失败');
    }
  };

  const createFolder = async (parentPath: string, name: string) => {
    if (!window.electronAPI?.createFolder) {
      alert('Electron API 不可用');
      return;
    }
    const folderName = name.trim();
    if (!folderName) return;

    try {
      const result = await window.electronAPI.createFolder(parentPath, folderName);
      if (!result.success) {
        alert('创建文件夹失败');
        return;
      }

      setExpandedFolders((prev) => new Set(prev).add(parentPath));
      await loadFileTree(projectPath!);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('创建文件夹失败');
    }
  };

  const confirmCreate = async () => {
    if (!createDialog) return;
    const { type, parentPath } = createDialog;
    const name = createName.trim();
    if (!name) return;

    setCreateDialog(null);

    if (type === 'flowchart') {
      await createFlowchartFile(parentPath, name);
    } else {
      await createFolder(parentPath, name);
    }
  };

  const handleDelete = async (item: FileItem) => {
    if (!window.electronAPI?.deleteFile) return;
    const confirmMessage = item.type === 'folder' 
      ? `确定要删除文件夹 "${item.name}" 及其所有内容吗？`
      : `确定要删除文件 "${item.name}" 吗？`;
    
    if (confirm(confirmMessage)) {
      try {
        const result = await window.electronAPI.deleteFile(item.path);
        if (result.success) {
          await loadFileTree(projectPath!);
          setSelectedItem(null);
          if (onRefresh) onRefresh();
        } else {
          alert('删除失败');
        }
      } catch (error) {
        console.error('Failed to delete:', error);
        alert('删除失败');
      }
    }
    setContextMenu(null);
  };

  const openRenameDialog = (item: FileItem) => {
    setRenameDialog({ item });
    const base = item.type === 'file' ? item.name.replace(/\.json$/i, '') : item.name;
    setRenameName(base);
  };

  const confirmRename = async () => {
    if (!renameDialog || !window.electronAPI?.renamePath) return;
    const item = renameDialog.item;
    const nextName = renameName.trim();
    if (!nextName) return;

    setRenameDialog(null);

    const result = await window.electronAPI.renamePath(item.path, nextName);
    if (!result.success || !result.path) {
      alert(result.error || '重命名失败');
      return;
    }

    onFilePathChanged?.(item.path, result.path);
    await loadFileTree(projectPath!);
    if (onRefresh) onRefresh();
  };

  const moveIntoFolder = async (sourcePath: string, destFolderPath: string) => {
    if (!window.electronAPI?.moveToFolder) return;
    if (sourcePath === destFolderPath) return;

    const result = await window.electronAPI.moveToFolder(sourcePath, destFolderPath);
    if (!result.success || !result.path) {
      alert(result.error || '移动失败');
      return;
    }

    setExpandedFolders((prev) => new Set(prev).add(destFolderPath));
    onFilePathChanged?.(sourcePath, result.path);
    await loadFileTree(projectPath!);
    if (onRefresh) onRefresh();
  };

  const renderFileItem = (item: FileItem, level: number = 0, parentPath: string | null = null): React.ReactNode => {
    const isExpanded = expandedFolders.has(item.path);
    const isFolder = item.type === 'folder';
    const isSelected = selectedItem?.path === item.path;

    const paddingLeft = 10 + level * 14;

    return (
      <div key={item.path} data-file-item={item.path}>
        <div
          className={`treeItem${isSelected ? ' selected' : ''}${dragOverFolderPath === item.path ? ' dragOver' : ''}`}
          style={{ paddingLeft }}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData(
              'application/x-flowchart-path',
              JSON.stringify({ path: item.path, type: item.type })
            );
          }}
          onClick={() => {
            setSelectedItem(item);
            if (isFolder) toggleFolder(item);
            if (item.type === 'file') onLoadFile(item.path);
          }}
          onContextMenu={(e) => handleContextMenu(e, item, parentPath || projectPath)}
          onDragOver={(e) => {
            if (!isFolder) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverFolderPath(item.path);
          }}
          onDragLeave={() => {
            if (dragOverFolderPath === item.path) setDragOverFolderPath(null);
          }}
          onDrop={async (e) => {
            if (!isFolder) return;
            e.preventDefault();
            setDragOverFolderPath(null);
            try {
              const raw = e.dataTransfer.getData('application/x-flowchart-path');
              if (!raw) return;
              const payload = JSON.parse(raw) as { path: string; type: 'file' | 'folder' };
              if (!payload?.path) return;
              if (payload.path === item.path) return;
              await moveIntoFolder(payload.path, item.path);
            } catch {
              // ignore
            }
          }}
        >
          <span className="twistie">{isFolder ? (isExpanded ? '▾' : '▸') : ''}</span>
          <span className="treeIcon">{isFolder ? '📁' : '📄'}</span>
          <span className="treeLabel" title={item.name}>
            {item.name}
          </span>
        </div>
        {isFolder && isExpanded && item.children && (
          <div>
            {item.children.map((child) => renderFileItem(child, level + 1, item.path))}
          </div>
        )}
      </div>
    );
  };

  // If no project is open, show welcome screen
  if (!projectPath) {
    return (
      <div className="explorer">
        <div className="panelHeader">EXPLORER</div>
        <div className="emptyState">
          <div style={{ fontSize: '44px' }}>📁</div>
          <div>未打开文件夹</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="vsBtn vsBtnPrimary" onClick={onOpenProject}>
              打开文件夹
            </button>
            <button className="vsBtn" onClick={onNewProject}>
              新建项目
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Project is open, show file tree
  return (
    <div
      className="explorer"
      onContextMenu={(e) => {
        // Right click on empty area
        e.preventDefault();
        e.stopPropagation();
        const target = e.target as HTMLElement;
        if (target === e.currentTarget || !target.closest('[data-file-item]')) {
          handleContextMenu(e, null, projectPath);
        }
      }}
    >
      <div className="panelHeader">EXPLORER</div>

      <div className="explorerSubHeader" title={projectPath}>
        <div className="explorerTitle">
          <span style={{ color: 'var(--vscode-fg-muted)' }}>📂</span>
          <span className="explorerTitleName">{projectPath.split(/[/\\]/).pop() || projectPath}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="vsBtn vsBtnIcon"
            title="刷新"
            onClick={() => loadFileTree(projectPath)}
          >
            ↻
          </button>
          <button className="vsBtn vsBtnIcon" title="打开文件夹" onClick={onOpenProject}>
            📂
          </button>
          <button
            className="vsBtn vsBtnIcon"
            title={isBackingUp ? '备份中...' : '备份当前文件夹（打包为 zip 到 backups/）'}
            onClick={() => runBackup(false)}
            disabled={isBackingUp}
            style={{ opacity: isBackingUp ? 0.6 : 1, cursor: isBackingUp ? 'not-allowed' : 'pointer' }}
          >
            ⬇
          </button>
        </div>
      </div>

      <div className="tree">
        {isLoading ? (
          <div style={{ padding: '14px', color: 'var(--vscode-fg-muted)', fontSize: 12 }}>加载中...</div>
        ) : fileTree.length === 0 ? (
          <div style={{ padding: '14px', color: 'var(--vscode-fg-muted)', fontSize: 12 }}>
            文件夹为空（右键创建）
          </div>
        ) : (
          fileTree.map((item) => renderFileItem(item, 0, projectPath))
        )}
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="ctxMenu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {(() => {
            const targetFolder = getTargetFolderPath();
            const isFolderTarget = contextMenu.item?.type === 'folder' || contextMenu.item == null;

            return (
              <>
                {contextMenu.item?.type === 'file' && (
                  <div
                    className="ctxItem"
                    onClick={() => {
                      onLoadFile(contextMenu.item!.path);
                      setContextMenu(null);
                    }}
                  >
                    打开
                  </div>
                )}

                {contextMenu.item && (
                  <div
                    className="ctxItem"
                    onClick={() => {
                      const item = contextMenu.item!;
                      setContextMenu(null);
                      openRenameDialog(item);
                    }}
                  >
                    重命名
                  </div>
                )}

                {isFolderTarget && targetFolder && (
                  <>
                    <div
                      className="ctxItem"
                      onClick={() => {
                        setContextMenu(null);
                        openCreateDialog('flowchart', targetFolder);
                      }}
                    >
                      新建流程图
                    </div>
                    <div
                      className="ctxItem"
                      onClick={() => {
                        setContextMenu(null);
                        openCreateDialog('folder', targetFolder);
                      }}
                    >
                      新建文件夹
                    </div>
                  </>
                )}

                {contextMenu.item && (
                  <div
                    className="ctxItem danger"
                    onClick={async () => {
                      await handleDelete(contextMenu.item!);
                    }}
                  >
                    删除
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {createDialog && (
        <div
          className="modalBackdrop"
          onMouseDown={(e) => {
            // click outside to close
            if (e.target === e.currentTarget) setCreateDialog(null);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modalTitle">
              {createDialog.type === 'flowchart' ? '新建流程图' : '新建文件夹'}
            </div>
            <input
              className="modalInput"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirmCreate();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setCreateDialog(null);
                }
              }}
            />
            <div className="modalActions">
              <button className="vsBtn" onClick={() => setCreateDialog(null)}>
                取消
              </button>
              <button className="vsBtn vsBtnPrimary" onClick={confirmCreate}>
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {renameDialog && (
        <div
          className="modalBackdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRenameDialog(null);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modalTitle">
              重命名{renameDialog.item.type === 'folder' ? '文件夹' : '文件'}
            </div>
            <input
              className="modalInput"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirmRename();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setRenameDialog(null);
                }
              }}
            />
            <div className="modalActions">
              <button className="vsBtn" onClick={() => setRenameDialog(null)}>
                取消
              </button>
              <button className="vsBtn vsBtnPrimary" onClick={confirmRename}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
