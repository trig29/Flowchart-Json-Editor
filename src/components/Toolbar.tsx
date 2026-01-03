/**
 * Toolbar component with actions for creating nodes, saving, loading, etc.
 */

import React from 'react';

interface ToolbarProps {
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  onSave: () => void;
  onLoad: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  currentFilePath?: string | null;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onSave,
  onLoad,
  onExportPNG,
  onExportSVG,
  currentFilePath,
}) => {
  const fileLabel = currentFilePath ? currentFilePath.split(/[/\\]/).pop() : null;

  return (
    <div className="topBar">
      <button
        onClick={onUndo}
        className="vsBtn vsBtnIcon"
        disabled={!canUndo}
        title="撤回（Ctrl+Z）"
        style={{ opacity: canUndo ? 1 : 0.5, cursor: canUndo ? 'pointer' : 'not-allowed' }}
      >
        ↶
      </button>

      <button
        onClick={onRedo}
        className="vsBtn vsBtnIcon"
        disabled={!canRedo}
        title="前进（Ctrl+Shift+Z）"
        style={{ opacity: canRedo ? 1 : 0.5, cursor: canRedo ? 'pointer' : 'not-allowed' }}
      >
        ↷
      </button>

      <div className="toolbarSep" />

      <button
        onClick={onSave}
        className="vsBtn"
        title={currentFilePath ? `保存到: ${currentFilePath.split(/[/\\]/).pop()}` : '保存文件'}
      >
        {currentFilePath ? '保存' : '另存为'}
      </button>

      <button
        onClick={onLoad}
        className="vsBtn"
        title="从文件选择对话框加载流程图"
      >
        加载文件
      </button>

      <div className="toolbarSep" />

      <button
        onClick={onExportPNG}
        className="vsBtn"
      >
        导出 PNG
      </button>

      <button
        onClick={onExportSVG}
        className="vsBtn"
      >
        导出 SVG
      </button>

      <div className="toolbarSpacer" />
      <div className="pathPill" title={currentFilePath || ''}>
        {fileLabel ? `当前文件: ${fileLabel}` : '未选择文件'}
      </div>
    </div>
  );
};

