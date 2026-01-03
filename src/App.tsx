/**
 * Main application component
 * Manages flowchart state and coordinates all interactions
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Flowchart, Node, Edge, Position } from './models/types';
import {
  createFlowchart,
  createNode,
  addNode,
  updateNode,
  removeNode,
  createEdge,
  addEdge,
  removeEdge,
  serializeFlowchart,
  deserializeFlowchart,
  applyDerivedFlowchart,
} from './models/flowchart';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { PropertyPanel } from './components/PropertyPanel';
import { FileExplorer } from './components/FileExplorer';
import { useUndoRedo } from './hooks/useUndoRedo';
import { getNodeDisplayText } from './models/nodeTag';

function App() {
  const {
    state: flowchart,
    stateRef: flowchartRef,
    setState: setFlowchart,
    setStateWithHistory,
    startTransaction,
    commitTransaction,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
    isTransactionActive
  } = useUndoRedo<Flowchart>(createFlowchart());

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string;
    pointId: string;
  } | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeIdCounter = useRef(0);
  const canvasViewStateRef = useRef<{ x: number; y: number; scale: number } | null>(null);

  // Undo/Redo Handlers
  const handleUndo = useCallback(() => {
    undo();
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectingFrom(null);
  }, [undo]);

  const handleRedo = useCallback(() => {
    redo();
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectingFrom(null);
  }, [redo]);

  const isUndoableNodeUpdate = (updates: Partial<Node>): boolean => {
    // Only: move/resize/backgroundColor are undoable. Text is not undoable.
    if ('backgroundColor' in updates) return true;
    if ('tag' in updates) return true;
    if ('size' in updates) return true;
    if ('position' in updates) return true;
    if ('connectionPoints' in updates) return true;
    return false;
  };

  const isUndoableEdgeUpdate = (updates: Partial<Edge>): boolean => {
    return 'color' in updates;
  };

  // Node operations
  const handleAddNode = useCallback(() => {
    // Calculate center of visible canvas area
    let centerX = 400;
    let centerY = 300;
    
    if (canvasViewStateRef.current && canvasRef.current) {
      const viewState = canvasViewStateRef.current;
      const rect = canvasRef.current.getBoundingClientRect();
      
      const visibleCenterX = (rect.width / 2 - viewState.x) / viewState.scale;
      const visibleCenterY = (rect.height / 2 - viewState.y) / viewState.scale;
      
      centerX = visibleCenterX;
      centerY = visibleCenterY;
    }
    
    const newNode = createNode(
      `node-${nodeIdCounter.current++}`,
      { x: centerX, y: centerY },
      { width: 150, height: 80 }
    );
    setStateWithHistory(applyDerivedFlowchart(addNode(flowchartRef.current, newNode)));
  }, [flowchartRef, setStateWithHistory]);

  const handleNodeMove = useCallback((nodeId: string, position: Position) => {
    // During move (drag), we update state directly without history history is handled by transaction
    setFlowchart(updateNode(flowchartRef.current, nodeId, { position }));
  }, [flowchartRef, setFlowchart]);

  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<Node>) => {
    // Root node is read-only except position/size/connectionPoints (allow move/resize).
    const currentNode = flowchartRef.current.nodes.find((n) => n.id === nodeId);
    if (currentNode?.tag === 'root') {
      const safeUpdates: Partial<Node> = {};
      if (updates.position) safeUpdates.position = updates.position;
      if (updates.size) safeUpdates.size = updates.size;
      if (updates.connectionPoints) safeUpdates.connectionPoints = updates.connectionPoints;
      // Ignore any other changes (tag/text/actor/backgroundColor/etc.)
      updates = safeUpdates;
    }

    const undoable = isUndoableNodeUpdate(updates);
    
    // Text-only edits are not undoable
    if (!undoable) {
      setFlowchart(updateNode(flowchartRef.current, nodeId, updates));
      return;
    }

    // Determine if this is an "immediate" update or part of a transaction
    // However, since PropertyPanel inputs might fire multiple times, 
    // we rely on the parent component calling startTransaction/commitTransaction for inputs
    // For now, assume PropertyPanel updates are immediate unless wrapped
    
    // Note: Canvas interactions (drag) handle transactions via onNodeInteractionStart/End
    // PropertyPanel interactions (resize inputs) handle transactions via onNodeEditStart/End
    
    // If we are just receiving an update, check if we should push to history
    // But wait, the hook handles transactions internally via startTransaction/commitTransaction
    // If we are in a transaction (drag), setFlowchart is enough (transaction logic is handled by commit)
    
    // We don't have direct access to "are we in a transaction" state from here easily without exposing more refs,
    // but the pattern is:
    // 1. startTransaction() called
    // 2. setFlowchart() called many times
    // 3. commitTransaction() called -> saves history if changed
    
    // If we are NOT in a transaction (e.g. single click color change), we should use setStateWithHistory
    // But how do we know?
    // We can assume that if it's coming from PropertyPanel without start/end events, it's immediate.
    // The PropertyPanel calls onNodeEditStart/End.
    
    // Simplified logic: The UI components decide transaction boundaries.
    // Here we just update.
    // BUT: If no transaction is active, setFlowchart WON'T save history.
    // We need to know if we should use setStateWithHistory.
    
    // Let's modify the PropertyPanel/Canvas usage slightly:
    // For single-shot updates (like color picker closing), we might want setStateWithHistory.
    // But `handleNodeUpdate` is generic.
    
    // We'll rely on a small heuristic:
    // If it's a "continuous" update (drag/resize), the caller calls startTransaction/commitTransaction.
    // In that case, we use `setFlowchart` here.
    // If it's a "discrete" update (button click), we should use `setStateWithHistory`.
    
    // To solve this cleanly without changing all signatures:
    // We can assume that if onNodeUpdate is called, we update the state.
    // Whether it generates history depends on whether a transaction is open.
    // BUT the hook doesn't auto-detect "no transaction open -> create one-off history".
    // We need to handle that.
    
    // Let's assume discrete updates unless we know better?
    // Or just use setFlowchart and let the caller manage transactions?
    // Problem: standard `setState` in hook doesn't auto-push history.
    
    // Let's just always use `setFlowchart`.
    // AND: We need to ensure that single-click actions are wrapped in start/commit or use setStateWithHistory.
    // But `handleNodeUpdate` is called by PropertyPanel for both continuous (input typing) and discrete.
    
    // Actually, PropertyPanel inputs for numbers call onNodeEditStart/End.
    // So those are transactions.
    // Color picker? Usually discrete change.
    
    // Current approach in App.tsx was:
    // `interactionActiveRef` check.
    
    // Let's reimplement `applyImmediateFlowchartUpdate` style logic but using the hook.
    
    // We can use a ref to track if we are in an explicit transaction from UI events.
    // The hook has internal transaction tracking but we need to know whether to call setState or setStateWithHistory.
    
    // ACTUALLY: The hook's `startTransaction` just marks the start state.
    // `commitTransaction` saves the difference.
    // If we call `setStateWithHistory`, it pushes history immediately.
    
    // So:
    // If we are in a transaction (drag), call `setFlowchart`.
    // If we are NOT in a transaction (color click), call `setStateWithHistory`.
    
    // We need to track transaction state in App component to make this decision.
    // We can add `isTransactionActive` state or ref in App.
    
    // Let's rely on the transaction refs we pass to Canvas/PropertyPanel.
    // We'll implement wrapper functions for start/end transaction that update a local ref.
    
    // See `isTransactionActiveRef` below.
    
    if (isTransactionActiveRef.current) {
        console.log('App: Node Updated in Transaction');
        setFlowchart(updateNode(flowchartRef.current, nodeId, updates));
    } else {
        console.log('App: Node Updated with History');
        setStateWithHistory(applyDerivedFlowchart(updateNode(flowchartRef.current, nodeId, updates)));
    }
  }, [flowchartRef, isUndoableNodeUpdate, setFlowchart, setStateWithHistory]);

  // Transaction tracking
  const isTransactionActiveRef = useRef(false);

  const handleTransactionStart = useCallback(() => {
    if (isTransactionActiveRef.current) return;
    isTransactionActiveRef.current = true;
    startTransaction();
  }, [startTransaction]);

  const handleTransactionEnd = useCallback(() => {
    if (!isTransactionActiveRef.current) return;
    isTransactionActiveRef.current = false;
    commitTransaction();
  }, [commitTransaction]);


  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
  }, []);

  // Edge operations
  const handleConnectionStart = useCallback((nodeId: string, pointId: string) => {
    setConnectingFrom({ nodeId, pointId });
  }, []);

  const handleConnectionEnd = useCallback(
    (nodeId: string, pointId: string) => {
      if (!connectingFrom || connectingFrom.nodeId === nodeId) {
        setConnectingFrom(null);
        return;
      }

      // Check for duplicate edge
      const fc = flowchartRef.current;
      const duplicate = fc.edges.some(
        (e) =>
          e.sourceNodeId === connectingFrom.nodeId &&
          e.sourcePointId === connectingFrom.pointId &&
          e.targetNodeId === nodeId &&
          e.targetPointId === pointId
      );

      if (duplicate) {
        console.warn('连接已存在，跳过创建');
        setConnectingFrom(null);
        return;
      }

      const sourceExists = fc.nodes.some((n) => n.id === connectingFrom.nodeId);
      const targetExists = fc.nodes.some((n) => n.id === nodeId);

      if (!sourceExists || !targetExists) {
        console.error('源节点或目标节点不存在');
        setConnectingFrom(null);
        return;
      }

      try {
        const newEdge = createEdge(
          `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          connectingFrom.nodeId,
          connectingFrom.pointId,
          nodeId,
          pointId
        );
        setStateWithHistory(applyDerivedFlowchart(addEdge(fc, newEdge)));
      } catch (error) {
        console.error('创建连接失败:', error);
      }

      setConnectingFrom(null);
    },
    [connectingFrom, flowchartRef, setStateWithHistory]
  );

  const handleConnectionCancel = useCallback(() => {
    setConnectingFrom(null);
  }, []);

  const handleEdgeSelect = useCallback((edgeId: string | null) => {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
  }, []);

  const handleEdgeDelete = useCallback((edgeId: string) => {
    setStateWithHistory(applyDerivedFlowchart(removeEdge(flowchartRef.current, edgeId)));
    setSelectedEdgeId(null);
  }, [flowchartRef, setStateWithHistory]);

  const handleEdgeUpdate = useCallback((edgeId: string, updates: Partial<Edge>) => {
    const undoable = isUndoableEdgeUpdate(updates);
    
    if (!undoable) {
       setFlowchart({
        ...flowchartRef.current,
        edges: flowchartRef.current.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...updates } : edge)),
      });
      return;
    }

    if (isTransactionActive()) {
        setFlowchart({
            ...flowchartRef.current,
            edges: flowchartRef.current.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...updates } : edge)),
        });
    } else {
        setStateWithHistory({
            ...flowchartRef.current,
            edges: flowchartRef.current.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...updates } : edge)),
        });
    }
  }, [flowchartRef, isUndoableEdgeUpdate, setFlowchart, setStateWithHistory, isTransactionActive]);

  const handleNodeDelete = useCallback((nodeId: string) => {
    const n = flowchartRef.current.nodes.find((x) => x.id === nodeId);
    if (n?.tag === 'root') return;
    setStateWithHistory(applyDerivedFlowchart(removeNode(flowchartRef.current, nodeId)));
    setSelectedNodeId(null);
  }, [flowchartRef, setStateWithHistory]);

  // File operations
  const handleSave = useCallback(async () => {
    if (!window.electronAPI) {
      alert('Electron API 不可用。正在浏览器模式下运行。');
      const json = serializeFlowchart(flowchart);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flowchart.json';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    try {
      const flowchartWithViewState = {
        ...flowchart,
        viewState: canvasViewStateRef.current || undefined,
      };
      const json = serializeFlowchart(flowchartWithViewState);
      
      if (currentFilePath) {
        const result = await window.electronAPI.saveFileToPath(currentFilePath, json);
        if (result.success) {
          console.log('File saved:', result.path);
          alert('文件已保存');
        } else {
          alert('保存文件失败');
        }
      } else if (projectPath) {
        const fileName = prompt('请输入文件名（不含扩展名）:', '未命名流程图');
        if (fileName && fileName.trim()) {
          const separator = projectPath.includes('\\') ? '\\' : '/';
          const filePath = projectPath + (projectPath.endsWith('/') || projectPath.endsWith('\\') ? '' : separator) + fileName.trim() + '.json';
          const result = await window.electronAPI.saveFileToPath(filePath, json);
          if (result.success && result.path) {
            setCurrentFilePath(result.path);
            console.log('File saved:', result.path);
            alert('文件已保存');
          } else {
            alert('保存文件失败');
          }
        }
      } else {
        const result = await window.electronAPI.saveFile(json);
        if (result.success && result.path) {
          setCurrentFilePath(result.path);
          console.log('File saved:', result.path);
          alert('文件已保存');
        } else {
          alert('保存文件失败');
        }
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      alert('保存文件失败');
    }
  }, [flowchart, projectPath, currentFilePath]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const isEditingText =
        !!active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          (active as HTMLElement).isContentEditable);

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSave();
        return;
      }

      if (isCtrlOrCmd && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        if (isEditingText) return;
        e.preventDefault();
        handleRedo();
        return;
      }

      if (isCtrlOrCmd && (e.key === 'z' || e.key === 'Z')) {
        if (isEditingText) return;
        e.preventDefault();
        handleUndo();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isEditingText) return;
        if (selectedEdgeId) {
          e.preventDefault();
          handleEdgeDelete(selectedEdgeId);
          return;
        }
        if (selectedNodeId) {
          const n = flowchartRef.current.nodes.find((x) => x.id === selectedNodeId);
          if (n?.tag === 'root') return;
          e.preventDefault();
          handleNodeDelete(selectedNodeId);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, handleUndo, handleRedo, selectedEdgeId, selectedNodeId, handleEdgeDelete, handleNodeDelete]);

  const handleLoad = useCallback(async () => {
    if (!window.electronAPI) {
      alert('Electron API 不可用。正在浏览器模式下运行。');
      return;
    }

    try {
      const result = await window.electronAPI.loadFile();
      if (result.success && result.data) {
        const loadedFlowchart = deserializeFlowchart(result.data);
        resetHistory();
        setFlowchart(loadedFlowchart);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        if (result.path) {
          setCurrentFilePath(result.path);
          const pathParts = result.path.split(/[/\\]/);
          pathParts.pop(); 
          const extractedProjectPath = pathParts.join(pathParts[0]?.includes('\\') ? '\\' : '/');
          setProjectPath(extractedProjectPath);
        }
        
        if (loadedFlowchart.viewState) {
          canvasViewStateRef.current = loadedFlowchart.viewState;
        }
        
        const maxId = Math.max(...loadedFlowchart.nodes.map(n => {
          const match = n.id.match(/node-(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        }), 0);
        nodeIdCounter.current = maxId + 1;
        console.log('File loaded:', result.path);
      }
    } catch (error) {
      console.error('Failed to load file:', error);
      alert('加载文件失败。请检查文件格式。');
    }
  }, [resetHistory, setFlowchart]);

  // Project management handlers
  const handleNewProject = useCallback(async () => {
    if (!window.electronAPI) {
      alert('Electron API 不可用。正在浏览器模式下运行。');
      resetHistory();
      setFlowchart(createFlowchart());
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setProjectPath(null);
      setCurrentFilePath(null);
      nodeIdCounter.current = 0;
      return;
    }

    try {
      const result = await window.electronAPI.createProjectFolder();
      if (result.success && result.path) {
        setProjectPath(result.path);
        resetHistory();
        setFlowchart(createFlowchart());
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        nodeIdCounter.current = 0;
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('创建项目失败');
    }
  }, [resetHistory, setFlowchart]);

  const handleOpenProject = useCallback(async () => {
    if (!window.electronAPI) {
      alert('Electron API 不可用。正在浏览器模式下运行。');
      return;
    }

    try {
      const result = await window.electronAPI.openProjectFolder();
      if (result.success && result.path) {
        setProjectPath(result.path);
        resetHistory();
        setFlowchart(createFlowchart());
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setCurrentFilePath(null);
        nodeIdCounter.current = 0;
      }
    } catch (error) {
      console.error('Failed to open project:', error);
      alert('打开项目失败');
    }
  }, [resetHistory, setFlowchart]);

  const handleLoadFile = useCallback(async (filePath: string) => {
    if (!window.electronAPI) {
      alert('Electron API 不可用。正在浏览器模式下运行。');
      return;
    }

    try {
      if (currentFilePath && currentFilePath !== filePath && window.electronAPI.saveFileToPath) {
        try {
          const flowchartWithViewState = {
            ...flowchart,
            viewState: canvasViewStateRef.current || undefined,
          };
          const jsonToSave = serializeFlowchart(flowchartWithViewState);
          await window.electronAPI.saveFileToPath(currentFilePath, jsonToSave);
        } catch (e) {
          console.warn('Auto-save failed:', e);
        }
      }

      const result = await window.electronAPI.loadFileFromPath(filePath);
      if (result.success && result.data) {
        const loadedFlowchart = deserializeFlowchart(result.data);
        resetHistory();
        setFlowchart(loadedFlowchart);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setCurrentFilePath(filePath);
        
        if (loadedFlowchart.viewState) {
          canvasViewStateRef.current = loadedFlowchart.viewState;
        }
        
        const maxId = Math.max(...loadedFlowchart.nodes.map(n => {
          const match = n.id.match(/node-(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        }), 0);
        nodeIdCounter.current = maxId + 1;
      }
    } catch (error) {
      console.error('Failed to load file:', error);
      alert('加载文件失败。请检查文件格式。');
    }
  }, [currentFilePath, flowchart, resetHistory, setFlowchart]);

  const handleSaveFile = useCallback(async (filePath: string, data: string) => {
    if (!window.electronAPI) {
      alert('Electron API 不可用。正在浏览器模式下运行。');
      return;
    }

    try {
      const result = await window.electronAPI.saveFileToPath(filePath, data);
      if (result.success) {
        console.log('File saved:', result.path);
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      alert('保存文件失败');
    }
  }, []);

  const handleExportPNG = useCallback(async () => {
    try {
      if (flowchart.nodes.length === 0) {
        alert('没有节点可导出');
        return;
      }

      const padding = 50;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      flowchart.nodes.forEach((node) => {
        minX = Math.min(minX, node.position.x - node.size.width / 2);
        minY = Math.min(minY, node.position.y - node.size.height / 2);
        maxX = Math.max(maxX, node.position.x + node.size.width / 2);
        maxY = Math.max(maxY, node.position.y + node.size.height / 2);
      });

      const width = maxX - minX + padding * 2;
      const height = maxY - minY + padding * 2;
      const offsetX = -minX + padding;
      const offsetY = -minY + padding;

      const canvas = document.createElement('canvas');
      const scale = 2;
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        alert('无法创建画布上下文');
        return;
      }

      ctx.scale(scale, scale);
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, width, height);

      flowchart.edges.forEach((edge) => {
        const sourceNode = flowchart.nodes.find((n) => n.id === edge.sourceNodeId);
        const targetNode = flowchart.nodes.find((n) => n.id === edge.targetNodeId);
        if (!sourceNode || !targetNode) return;

        const sourcePoint = sourceNode.connectionPoints.find((p) => p.id === edge.sourcePointId);
        const targetPoint = targetNode.connectionPoints.find((p) => p.id === edge.targetPointId);
        if (!sourcePoint || !targetPoint) return;

        const sourceX = sourceNode.position.x + offsetX;
        const sourceY = sourceNode.position.y + (sourcePoint.type === 'input' ? -sourceNode.size.height / 2 : sourceNode.size.height / 2) + offsetY;
        const targetX = targetNode.position.x + offsetX;
        const targetY = targetNode.position.y + (targetPoint.type === 'input' ? -targetNode.size.height / 2 : targetNode.size.height / 2) + offsetY;

        const dx = targetX - sourceX;
        const controlPoint1X = sourceX + dx * 0.5;
        const controlPoint1Y = sourceY;
        const controlPoint2X = targetX - dx * 0.5;
        const controlPoint2Y = targetY;

        ctx.beginPath();
        ctx.moveTo(sourceX, sourceY);
        ctx.bezierCurveTo(controlPoint1X, controlPoint1Y, controlPoint2X, controlPoint2Y, targetX, targetY);
        ctx.strokeStyle = edge.color || '#666';
        ctx.lineWidth = 2;
        ctx.stroke();

        const angle = Math.atan2(targetY - controlPoint2Y, targetX - controlPoint2X);
        const arrowLength = 10;
        const arrowWidth = 6;
        const arrowX = targetX - Math.cos(angle) * arrowLength;
        const arrowY = targetY - Math.sin(angle) * arrowLength;

        ctx.beginPath();
        ctx.moveTo(targetX, targetY);
        ctx.lineTo(arrowX - arrowWidth * Math.sin(angle), arrowY + arrowWidth * Math.cos(angle));
        ctx.lineTo(arrowX + arrowWidth * Math.sin(angle), arrowY - arrowWidth * Math.cos(angle));
        ctx.closePath();
        ctx.fillStyle = edge.color || '#666';
        ctx.fill();
      });

      flowchart.nodes.forEach((node) => {
        const x = node.position.x - node.size.width / 2 + offsetX;
        const y = node.position.y - node.size.height / 2 + offsetY;

        ctx.fillStyle = node.backgroundColor;
        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 2;
        const radius = 8;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + node.size.width - radius, y);
        ctx.quadraticCurveTo(x + node.size.width, y, x + node.size.width, y + radius);
        ctx.lineTo(x + node.size.width, y + node.size.height - radius);
        ctx.quadraticCurveTo(x + node.size.width, y + node.size.height, x + node.size.width - radius, y + node.size.height);
        ctx.lineTo(x + radius, y + node.size.height);
        ctx.quadraticCurveTo(x, y + node.size.height, x, y + node.size.height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#333';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const paddingX = 10;
        const maxTextWidth = Math.max(10, node.size.width - paddingX * 2);
        const lineHeight = 18;

        const wrapLine = (text: string): string[] => {
          const trimmed = text.replace(/\r/g, '');
          if (!trimmed) return [''];

          const result: string[] = [];
          let current = '';

          const tokens = trimmed.includes(' ') ? trimmed.split(/(\s+)/) : Array.from(trimmed);

          for (const token of tokens) {
            const test = current + token;
            if (ctx.measureText(test).width <= maxTextWidth) {
              current = test;
              continue;
            }

            if (current.trim().length > 0) {
              result.push(current.trimEnd());
              current = token.trimStart();
              continue;
            }

            let chunk = '';
            for (const ch of Array.from(token)) {
              const t = chunk + ch;
              if (ctx.measureText(t).width <= maxTextWidth) {
                chunk = t;
              } else {
                if (chunk) result.push(chunk);
                chunk = ch;
              }
            }
            current = chunk;
          }

          if (current.length > 0) result.push(current.trimEnd());
          return result.length ? result : [''];
        };

        const manualLines = getNodeDisplayText(node).split('\n');
        const wrappedLines = manualLines.flatMap((l) => wrapLine(l));

        const maxLines = Math.max(1, Math.floor((node.size.height - 12) / lineHeight));
        let finalLines = wrappedLines;
        if (wrappedLines.length > maxLines) {
          finalLines = wrappedLines.slice(0, maxLines);
          const lastIdx = finalLines.length - 1;
          const ellipsis = '…';
          let last = finalLines[lastIdx];
          while (last.length > 0 && ctx.measureText(last + ellipsis).width > maxTextWidth) {
            last = last.slice(0, -1);
          }
          finalLines[lastIdx] = (last || '').trimEnd() + ellipsis;
        }

        const startY = node.position.y + offsetY - ((finalLines.length - 1) * lineHeight) / 2;
        finalLines.forEach((line, index) => {
          ctx.fillText(line, node.position.x + offsetX, startY + index * lineHeight);
        });
      });

      const dataURL = canvas.toDataURL('image/png');

      let defaultFileName = 'flowchart.png';
      if (currentFilePath) {
        const pathParts = currentFilePath.split(/[/\\]/);
        const fileName = pathParts[pathParts.length - 1];
        if (fileName) {
          const nameWithoutExt = fileName.replace(/\.json$/, '');
          defaultFileName = `${nameWithoutExt}.png`;
        }
      }

      if (window.electronAPI) {
        const result = await window.electronAPI.exportImage(dataURL, 'png', defaultFileName);
        if (result.success) {
          alert('PNG 导出成功');
        } else {
          alert('PNG 导出失败');
        }
      } else {
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = defaultFileName;
        a.click();
      }
    } catch (error) {
      console.error('Failed to export PNG:', error);
      alert('导出 PNG 失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }, [flowchart, currentFilePath]);

  const handleExportSVG = useCallback(async () => {
    const svg = generateSVG(flowchart);

    if (window.electronAPI) {
      await window.electronAPI.exportImage(svg, 'svg');
    } else {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flowchart.svg';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [flowchart]);

  const generateSVG = (fc: Flowchart): string => {
    const padding = 50;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    fc.nodes.forEach((node) => {
      minX = Math.min(minX, node.position.x - node.size.width / 2);
      minY = Math.min(minY, node.position.y - node.size.height / 2);
      maxX = Math.max(maxX, node.position.x + node.size.width / 2);
      maxY = Math.max(maxY, node.position.y + node.size.height / 2);
    });

    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const offsetX = -minX + padding;
    const offsetY = -minY + padding;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
    svg += `<rect width="${width}" height="${height}" fill="#f5f5f5"/>`;

    fc.edges.forEach((edge) => {
      const sourceNode = fc.nodes.find((n) => n.id === edge.sourceNodeId);
      const targetNode = fc.nodes.find((n) => n.id === edge.targetNodeId);
      if (!sourceNode || !targetNode) return;

      const sourcePoint = sourceNode.connectionPoints.find((p) => p.id === edge.sourcePointId);
      const targetPoint = targetNode.connectionPoints.find((p) => p.id === edge.targetPointId);
      if (!sourcePoint || !targetPoint) return;

      const x1 = sourceNode.position.x + sourcePoint.position.x + offsetX;
      const y1 = sourceNode.position.y + sourcePoint.position.y + offsetY;
      const x2 = targetNode.position.x + targetPoint.position.x + offsetX;
      const y2 = targetNode.position.y + targetPoint.position.y + offsetY;

      const dx = x2 - x1;
      const controlX1 = x1 + dx * 0.5;
      const controlY1 = y1;
      const controlX2 = x2 - dx * 0.5;
      const controlY2 = y2;

      svg += `<path d="M ${x1} ${y1} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${x2} ${y2}" 
        stroke="#666" stroke-width="2" fill="none" marker-end="url(#arrowhead)"/>`;
    });

    svg += `<defs><marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <polygon points="0 0, 10 3, 0 6" fill="#666"/>
    </marker></defs>`;

    fc.nodes.forEach((node) => {
      const x = node.position.x - node.size.width / 2 + offsetX;
      const y = node.position.y - node.size.height / 2 + offsetY;
      svg += `<rect x="${x}" y="${y}" width="${node.size.width}" height="${node.size.height}" 
        fill="${node.backgroundColor}" stroke="#1976d2" stroke-width="2" rx="8"/>`;
      const nodeText = getNodeDisplayText(node).replace(/\n/g, ' ');
      svg += `<text x="${node.position.x + offsetX}" y="${node.position.y + offsetY}" 
        text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="500" fill="#333">${escapeXML(
        nodeText
      )}</text>`;
    });

    svg += '</svg>';
    return svg;
  };

  const escapeXML = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const selectedNode = flowchart.nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedEdge = flowchart.edges.find((e) => e.id === selectedEdgeId) || null;

  return (
    <div className="appShell">
      <Toolbar
        onUndo={handleUndo}
        canUndo={canUndo}
        onRedo={handleRedo}
        canRedo={canRedo}
        onSave={handleSave}
        onLoad={handleLoad}
        onExportPNG={handleExportPNG}
        onExportSVG={handleExportSVG}
        currentFilePath={currentFilePath}
      />
      <div className="workbench">
        <div className="paneLeft">
          <FileExplorer
            projectPath={projectPath}
            onNewProject={handleNewProject}
            onOpenProject={handleOpenProject}
            onLoadFile={handleLoadFile}
            onSaveFile={handleSaveFile}
            onFilePathChanged={(oldPath, newPath) => {
              if (currentFilePath === oldPath) {
                setCurrentFilePath(newPath);
              }
            }}
            onRefresh={() => {
              // FileExplorer handles refresh internally; kept for compatibility
            }}
          />
        </div>
        <div ref={canvasRef} className="paneCenter">
          <Canvas
            flowchart={flowchart}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            onNodeSelect={handleNodeSelect}
            onEdgeSelect={handleEdgeSelect}
            onNodeMove={handleNodeMove}
            onNodeUpdate={handleNodeUpdate}
            onEdgeDelete={handleEdgeDelete}
            connectingFrom={connectingFrom}
            onConnectionStart={handleConnectionStart}
            onConnectionEnd={handleConnectionEnd}
            onConnectionCancel={handleConnectionCancel}
            onViewStateChange={(viewState) => {
              canvasViewStateRef.current = viewState;
            }}
            initialViewState={canvasViewStateRef.current || undefined}
            canvasRef={canvasRef}
            onNodeInteractionStart={handleTransactionStart}
            onNodeInteractionEnd={handleTransactionEnd}
          />
          <button
            className="fabAddNode"
            title="添加节点"
            onClick={(e) => {
              e.stopPropagation();
              handleAddNode();
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            +
          </button>
        </div>
        <div className="paneRight">
          <PropertyPanel
            node={selectedNode}
            edge={selectedEdge}
            onNodeUpdate={(nodeId, updates) => handleNodeUpdate(nodeId, updates)}
            onNodeDelete={handleNodeDelete}
            onEdgeUpdate={handleEdgeUpdate}
            onEdgeDelete={handleEdgeDelete}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
