/**
 * Main application component
 * Manages flowchart state and coordinates all interactions
 */

import { useState, useCallback, useRef } from 'react';
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
} from './models/flowchart';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { PropertyPanel } from './components/PropertyPanel';
import { FileExplorer } from './components/FileExplorer';

function App() {
  const [flowchart, setFlowchart] = useState<Flowchart>(createFlowchart());
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

  // Node operations
  const handleAddNode = useCallback(() => {
    // Calculate center of visible canvas area
    let centerX = 400;
    let centerY = 300;
    
    if (canvasViewStateRef.current && canvasRef.current) {
      const viewState = canvasViewStateRef.current;
      const rect = canvasRef.current.getBoundingClientRect();
      
      // Calculate visible center in canvas coordinates
      // Screen center: (rect.width / 2, rect.height / 2)
      // Convert to canvas coordinates
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
    setFlowchart((fc) => addNode(fc, newNode));
  }, []);

  const handleNodeMove = useCallback((nodeId: string, position: Position) => {
    setFlowchart((fc) => updateNode(fc, nodeId, { position }));
  }, []);

  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<Node>) => {
    setFlowchart((fc) => updateNode(fc, nodeId, updates));
  }, []);

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

      // Check for duplicate edge before creating
      setFlowchart((fc) => {
        const duplicate = fc.edges.some(
          (e) =>
            e.sourceNodeId === connectingFrom.nodeId &&
            e.sourcePointId === connectingFrom.pointId &&
            e.targetNodeId === nodeId &&
            e.targetPointId === pointId
        );

        if (duplicate) {
          // Silently ignore duplicate connections
          console.warn('连接已存在，跳过创建');
          return fc;
        }

        // Validate that nodes exist
        const sourceExists = fc.nodes.some((n) => n.id === connectingFrom.nodeId);
        const targetExists = fc.nodes.some((n) => n.id === nodeId);

        if (!sourceExists || !targetExists) {
          console.error('源节点或目标节点不存在');
          return fc;
        }

        // Create and add edge
        try {
          const newEdge = createEdge(
            `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            connectingFrom.nodeId,
            connectingFrom.pointId,
            nodeId,
            pointId
          );
          return addEdge(fc, newEdge);
        } catch (error) {
          console.error('创建连接失败:', error);
          return fc;
        }
      });

      setConnectingFrom(null);
    },
    [connectingFrom]
  );

  const handleConnectionCancel = useCallback(() => {
    setConnectingFrom(null);
  }, []);

  const handleEdgeSelect = useCallback((edgeId: string | null) => {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
  }, []);

  const handleEdgeDelete = useCallback((edgeId: string) => {
    setFlowchart((fc) => removeEdge(fc, edgeId));
    setSelectedEdgeId(null);
  }, []);

  const handleEdgeUpdate = useCallback((edgeId: string, updates: Partial<Edge>) => {
    setFlowchart((fc) => ({
      ...fc,
      edges: fc.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...updates } : edge)),
    }));
  }, []);

  const handleNodeDelete = useCallback((nodeId: string) => {
    setFlowchart((fc) => removeNode(fc, nodeId));
    setSelectedNodeId(null);
  }, []);

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
      // Save current view state to flowchart before serializing
      const flowchartWithViewState = {
        ...flowchart,
        viewState: canvasViewStateRef.current || undefined,
      };
      const json = serializeFlowchart(flowchartWithViewState);
      
      // If we have a current file path, save to it
      if (currentFilePath) {
        const result = await window.electronAPI.saveFileToPath(currentFilePath, json);
        if (result.success) {
          console.log('File saved:', result.path);
          alert('文件已保存');
        } else {
          alert('保存文件失败');
        }
      } else if (projectPath) {
        // If we have a project but no current file, prompt for filename
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
        // Use dialog to choose location
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

  const handleLoad = useCallback(async () => {
    if (!window.electronAPI) {
      alert('Electron API 不可用。正在浏览器模式下运行。');
      return;
    }

    try {
      const result = await window.electronAPI.loadFile();
      if (result.success && result.data) {
        const loadedFlowchart = deserializeFlowchart(result.data);
        setFlowchart(loadedFlowchart);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        if (result.path) {
          setCurrentFilePath(result.path);
          // Extract project path from file path
          const pathParts = result.path.split(/[/\\]/);
          pathParts.pop(); // Remove filename
          const extractedProjectPath = pathParts.join(pathParts[0]?.includes('\\') ? '\\' : '/');
          setProjectPath(extractedProjectPath);
        }
        
        // Restore view state if available
        if (loadedFlowchart.viewState) {
          canvasViewStateRef.current = loadedFlowchart.viewState;
        }
        
        // Reset node counter based on loaded nodes
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
  }, []);

  // Project management handlers
  const handleNewProject = useCallback(async () => {
    if (!window.electronAPI) {
      alert('Electron API 不可用。正在浏览器模式下运行。');
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
        setFlowchart(createFlowchart());
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        nodeIdCounter.current = 0;
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('创建项目失败');
    }
  }, []);

  const handleOpenProject = useCallback(async () => {
    if (!window.electronAPI) {
      alert('Electron API 不可用。正在浏览器模式下运行。');
      return;
    }

    try {
      const result = await window.electronAPI.openProjectFolder();
      if (result.success && result.path) {
        setProjectPath(result.path);
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
  }, []);

  const handleLoadFile = useCallback(async (filePath: string) => {
    if (!window.electronAPI) {
      alert('Electron API 不可用。正在浏览器模式下运行。');
      return;
    }

    try {
      // Auto-save current file before switching (File Explorer behavior)
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
        setFlowchart(loadedFlowchart);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setCurrentFilePath(filePath);
        
        // Restore view state if available
        if (loadedFlowchart.viewState) {
          canvasViewStateRef.current = loadedFlowchart.viewState;
        }
        
        // Reset node counter based on loaded nodes
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
  }, [currentFilePath, flowchart]);

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

  // Export functions
  const handleExportPNG = useCallback(async () => {
    try {
      // Calculate bounds of all nodes
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

      // Create canvas
      const canvas = document.createElement('canvas');
      const scale = 2; // Higher resolution
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        alert('无法创建画布上下文');
        return;
      }

      // Scale for higher resolution
      ctx.scale(scale, scale);

      // Draw background
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, width, height);

      // Draw edges first (behind nodes)
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

        // Draw arrow head
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

      // Draw nodes
      flowchart.nodes.forEach((node) => {
        const x = node.position.x - node.size.width / 2 + offsetX;
        const y = node.position.y - node.size.height / 2 + offsetY;

        // Draw node background with rounded corners
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

        // Draw node text (auto-wrap within node width, respects manual newlines)
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

          // Prefer breaking on spaces, but also handle CJK (no spaces) by falling back to char splitting.
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

            // Single token longer than the width: hard break by characters.
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

        const manualLines = node.text.split('\n');
        const wrappedLines = manualLines.flatMap((l) => wrapLine(l));

        // If there are too many lines to fit, clamp and add ellipsis.
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

      // Get default filename from current file path
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
        // Update exportImage to accept default filename
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
    // Generate SVG representation of the flowchart
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

  // Generate SVG from flowchart
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

    // Draw edges
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

    // Draw nodes
    fc.nodes.forEach((node) => {
      const x = node.position.x - node.size.width / 2 + offsetX;
      const y = node.position.y - node.size.height / 2 + offsetY;
      svg += `<rect x="${x}" y="${y}" width="${node.size.width}" height="${node.size.height}" 
        fill="${node.backgroundColor}" stroke="#1976d2" stroke-width="2" rx="8"/>`;
      svg += `<text x="${node.position.x + offsetX}" y="${node.position.y + offsetY}" 
        text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="500" fill="#333">${escapeXML(
        node.text
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
        onAddNode={handleAddNode}
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
          />
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

