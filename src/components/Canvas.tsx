/**
 * Canvas component with zoom and pan support
 * Handles the main rendering surface for the flowchart
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Flowchart, Node, Edge, Position } from '../models/types';
import { NodeComponent } from './Node';
import { EdgeComponent } from './Edge';

interface CanvasProps {
  flowchart: Flowchart;
  selectedNodeIds: Set<string>;
  selectedEdgeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
  onNodesSelect: (ids: string[] | Set<string>) => void;
  onClearSelection: () => void;
  onEdgeSelect: (edgeId: string | null) => void;
  onNodeMove: (nodeId: string, position: Position) => void;
  onNodeUpdate: (nodeId: string, updates: Partial<Node>) => void;
  onEdgeDelete: (edgeId: string) => void;
  connectingFrom: { nodeId: string; pointId: string } | null;
  onConnectionStart: (nodeId: string, pointId: string) => void;
  onConnectionEnd: (nodeId: string, pointId: string) => void;
  onConnectionCancel: () => void;
  onViewStateChange?: (viewState: { x: number; y: number; scale: number }) => void;
  onMouseMove?: (pos: Position) => void;
  initialViewState?: { x: number; y: number; scale: number };
  canvasRef?: React.RefObject<HTMLDivElement>;
  onNodeInteractionStart?: () => void;
  onNodeInteractionEnd?: () => void;
}

// Helper function to convert screen coordinates to canvas coordinates
const screenToCanvas = (
  screenX: number,
  screenY: number,
  canvasRect: DOMRect,
  transform: { x: number; y: number; scale: number }
): Position => {
  return {
    x: (screenX - canvasRect.left - transform.x) / transform.scale,
    y: (screenY - canvasRect.top - transform.y) / transform.scale,
  };
};

export const Canvas: React.FC<CanvasProps> = ({
  flowchart,
  selectedNodeIds,
  selectedEdgeId,
  onNodeSelect,
  onNodesSelect,
  onClearSelection,
  onEdgeSelect,
  onNodeMove,
  onNodeUpdate,
  onEdgeDelete,
  connectingFrom,
  onConnectionStart,
  onConnectionEnd,
  onConnectionCancel,
  onViewStateChange,
  onMouseMove,
  initialViewState,
  canvasRef: externalCanvasRef,
  onNodeInteractionStart,
  onNodeInteractionEnd,
}) => {
  const internalCanvasRef = useRef<HTMLDivElement>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const [transform, setTransform] = useState(initialViewState || { x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [tempConnection, setTempConnection] = useState<Position | null>(null);
  const panPointerIdRef = useRef<number | null>(null);
  const panStartClientRef = useRef<Position>({ x: 0, y: 0 });
  const panStartTransformRef = useRef<{ x: number; y: number; scale: number }>({ x: 0, y: 0, scale: 1 });
  
  // Marquee selection state
  const [isMarquee, setIsMarquee] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<Position | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<Position | null>(null);
  const marqueePointerIdRef = useRef<number | null>(null);
  const rightDragThresholdPx = 5;

  const cancelPan = useCallback(() => {
    const pid = panPointerIdRef.current;
    panPointerIdRef.current = null;
    setIsPanning(false);
    // Best-effort release pointer capture if it is still held.
    if (pid != null) {
      try {
        canvasRef.current?.releasePointerCapture(pid);
      } catch {
        // ignore
      }
    }
  }, [canvasRef]);

  // Update transform when initialViewState changes (e.g., after loading)
  React.useEffect(() => {
    if (initialViewState) {
      setTransform(initialViewState);
    }
  }, [initialViewState]);

  // Notify parent of view state changes
  React.useEffect(() => {
    if (onViewStateChange) {
      onViewStateChange(transform);
    }
  }, [transform, onViewStateChange]);

  // Pan with pointer events (supports mouse drag on empty area)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Right button for marquee selection
      if (e.button === 2) {
        const target = e.target as HTMLElement | null;
        const clickedOnNode = target?.closest?.('[data-node]');
        const clickedOnEdge = target?.closest?.('svg path');
        
        // Only start marquee on empty canvas area
        if (!clickedOnNode && !clickedOnEdge && e.target === e.currentTarget) {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const startPos = screenToCanvas(e.clientX, e.clientY, rect, transform);
            setMarqueeStart(startPos);
            setMarqueeCurrent(startPos);
            setIsMarquee(true);
            marqueePointerIdRef.current = e.pointerId;
            // Don't preventDefault yet - wait for drag threshold
          }
        }
        return;
      }

      // Middle button always pans, left button pans only on empty area
      const isMiddle = e.button === 1;
      const isLeft = e.button === 0;

      if (!isMiddle && !isLeft) return;
      if (!isMiddle && connectingFrom) return;
      if (isMarquee) return; // Don't pan while marquee is active

      const target = e.target as HTMLElement | null;
      const clickedOnNode = target?.closest?.('[data-node]');
      const clickedOnEdge = target?.closest?.('svg path');

      if (!isMiddle && (clickedOnNode || clickedOnEdge)) return;

      panPointerIdRef.current = e.pointerId;
      panStartClientRef.current = { x: e.clientX, y: e.clientY };
      panStartTransformRef.current = transform;
      setIsPanning(true);

      // Capture pointer so dragging continues even if cursor leaves the canvas
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [connectingFrom, transform, isMarquee, canvasRef]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Handle marquee selection
    if (marqueePointerIdRef.current === e.pointerId && marqueeStart) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const currentPos = screenToCanvas(e.clientX, e.clientY, rect, transform);
        setMarqueeCurrent(currentPos);
        
        // Check if drag distance exceeds threshold
        const dx = e.clientX - (rect.left + (marqueeStart.x * transform.scale + transform.x));
        const dy = e.clientY - (rect.top + (marqueeStart.y * transform.scale + transform.y));
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > rightDragThresholdPx && !isMarquee) {
          setIsMarquee(true);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          e.preventDefault();
        } else if (isMarquee) {
          e.preventDefault();
        }
      }
      return;
    }

    if (!isPanning) return;
    if (panPointerIdRef.current !== e.pointerId) return;

    const dx = e.clientX - panStartClientRef.current.x;
    const dy = e.clientY - panStartClientRef.current.y;
    const start = panStartTransformRef.current;

    setTransform((prev) => ({
      ...prev,
      x: start.x + dx,
      y: start.y + dy,
    }));
  }, [isPanning, marqueeStart, transform, isMarquee, canvasRef]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Handle marquee end
    if (marqueePointerIdRef.current === e.pointerId) {
      if (isMarquee && marqueeStart && marqueeCurrent) {
        // Calculate selected nodes
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const minX = Math.min(marqueeStart.x, marqueeCurrent.x);
          const maxX = Math.max(marqueeStart.x, marqueeCurrent.x);
          const minY = Math.min(marqueeStart.y, marqueeCurrent.y);
          const maxY = Math.max(marqueeStart.y, marqueeCurrent.y);
          
          const selectedIds: string[] = [];
          flowchart.nodes.forEach((node) => {
            // Check if node AABB intersects with marquee rectangle
            const nodeLeft = node.position.x - node.size.width / 2;
            const nodeRight = node.position.x + node.size.width / 2;
            const nodeTop = node.position.y - node.size.height / 2;
            const nodeBottom = node.position.y + node.size.height / 2;
            
            // Intersection check
            if (!(nodeRight < minX || nodeLeft > maxX || nodeBottom < minY || nodeTop > maxY)) {
              selectedIds.push(node.id);
            }
          });
          
          if (selectedIds.length > 0) {
            onNodesSelect(selectedIds);
          } else {
            onClearSelection();
          }
        }
      }
      
      setIsMarquee(false);
      setMarqueeStart(null);
      setMarqueeCurrent(null);
      marqueePointerIdRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    if (panPointerIdRef.current !== e.pointerId) return;
    panPointerIdRef.current = null;
    setIsPanning(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, [isMarquee, marqueeStart, marqueeCurrent, flowchart, onNodesSelect, onClearSelection, canvasRef]);

  // If the app loses focus (dialogs, alt-tab), pointerup might never fire.
  // Make sure panning doesn't stay "stuck" and block subsequent interactions.
  useEffect(() => {
    const onBlur = () => cancelPan();
    window.addEventListener('blur', onBlur);
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') cancelPan();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [cancelPan]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        // Convert mouse screen coordinates to canvas coordinates
        const canvasX = (e.clientX - rect.left - transform.x) / transform.scale;
        const canvasY = (e.clientY - rect.top - transform.y) / transform.scale;
        const canvasPos = { x: canvasX, y: canvasY };
        
        // Report mouse position to parent for paste positioning
        if (onMouseMove) {
          onMouseMove(canvasPos);
        }
        
        if (connectingFrom) {
          // Show temporary connection line
          setTempConnection(canvasPos);
        }
      }
    },
    [transform, connectingFrom, onMouseMove]
  );

  // Global mouse move handler for temporary connection line
  useEffect(() => {
    if (connectingFrom) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          // Convert mouse screen coordinates to canvas coordinates
          const canvasX = (e.clientX - rect.left - transform.x) / transform.scale;
          const canvasY = (e.clientY - rect.top - transform.y) / transform.scale;
          setTempConnection({ x: canvasX, y: canvasY });
        }
      };

      window.addEventListener('mousemove', handleGlobalMouseMove);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
      };
    }
  }, [connectingFrom, transform]);

  const handleMouseUp = useCallback(() => {
    // Panning is handled by global mouse up event
    setTempConnection(null);
  }, []);

  // Zoom with mouse wheel - use native event listener with passive: false
  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const canvasElement = canvasRef.current;
      if (!canvasElement) return;
      const rect = canvasElement.getBoundingClientRect();
      // 视窗中心点（屏幕坐标）
      const centerScreenX = rect.left + rect.width / 2;
      const centerScreenY = rect.top + rect.height / 2;
      setTransform((prev) => {
        const newScale = Math.max(0.1, Math.min(3, prev.scale * delta));
        // 缩放前视窗中心对应的画布坐标
        const before = {
          x: (centerScreenX - rect.left - prev.x) / prev.scale,
          y: (centerScreenY - rect.top - prev.y) / prev.scale,
        };
        // 缩放后应调整的偏移量，使视窗中心内容保持不变
        const newX = centerScreenX - rect.left - before.x * newScale;
        const newY = centerScreenY - rect.top - before.y * newScale;
        return { ...prev, scale: newScale, x: newX, y: newY };
      });
    };

    // Add event listener with passive: false to allow preventDefault
    canvasElement.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvasElement.removeEventListener('wheel', handleWheel);
    };
  }, [canvasRef]);

  // Click on canvas to deselect - handled by transformed container onClick

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && connectingFrom) {
        onConnectionCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connectingFrom, onConnectionCancel]);

  const handleInteractionStart = useCallback(() => {
    onNodeInteractionStart?.();
  }, [onNodeInteractionStart]);

  const handleInteractionEnd = useCallback(() => {
    onNodeInteractionEnd?.();
  }, [onNodeInteractionEnd]);

  return (
    <div
      ref={canvasRef}
      className="canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onLostPointerCapture={() => {
        cancelPan();
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#f5f5f5',
        cursor: isMarquee ? 'crosshair' : isPanning ? 'grabbing' : connectingFrom ? 'crosshair' : 'grab',
        touchAction: 'none',
      }}
    >
      <div
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
        onMouseDown={(e) => {
          // Allow panning when clicking on the transformed container background
          if (e.button === 0 && !connectingFrom && !isMarquee && e.target === e.currentTarget) {
            const target = e.target as HTMLElement;
            const clickedOnNode = target.closest('[data-node]');
            const clickedOnEdge = target.closest('svg path');
            
            if (!clickedOnNode && !clickedOnEdge) {
              // This is handled by pointer events, but we can prevent default here
              e.preventDefault();
              e.stopPropagation();
            }
          }
        }}
        onClick={(e) => {
          // Click on the transformed container (background)
          // Only deselect if not panning and not marquee (to avoid deselecting while dragging)
          if (e.target === e.currentTarget && !isPanning && !isMarquee && e.button === 0) {
            onClearSelection();
            if (connectingFrom) {
              onConnectionCancel();
            }
          }
        }}
        onContextMenu={(e) => {
          // Prevent context menu if marquee is active
          if (isMarquee) {
            e.preventDefault();
          }
        }}
      >
        {/* Render edges first (behind nodes) - use single SVG container */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 0,
            overflow: 'visible',
          }}
        >
          {flowchart.edges.map((edge) => {
            const sourceNode = flowchart.nodes.find((n) => n.id === edge.sourceNodeId);
            const targetNode = flowchart.nodes.find((n) => n.id === edge.targetNodeId);
            if (!sourceNode || !targetNode) return null;

            const sourcePoint = sourceNode.connectionPoints.find((p) => p.id === edge.sourcePointId);
            const targetPoint = targetNode.connectionPoints.find((p) => p.id === edge.targetPointId);
            if (!sourcePoint || !targetPoint) return null;

            // Calculate connection point positions using node position and connection point relative position
            const sourceX = sourceNode.position.x + sourcePoint.position.x;
            const sourceY = sourceNode.position.y + sourcePoint.position.y;
            const targetX = targetNode.position.x + targetPoint.position.x;
            const targetY = targetNode.position.y + targetPoint.position.y;

            const dx = targetX - sourceX;
            const controlPoint1X = sourceX + dx * 0.5;
            const controlPoint1Y = sourceY;
            const controlPoint2X = targetX - dx * 0.5;
            const controlPoint2Y = targetY;

            const path = `M ${sourceX} ${sourceY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${targetX} ${targetY}`;
            const isSelected = edge.id === selectedEdgeId;

            return (
              <g key={edge.id}>
                {/* Invisible hit area for selection */}
                <path
                  d={path}
                  stroke="transparent"
                  strokeWidth="20"
                  fill="none"
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdgeSelect(edge.id);
                  }}
                />
                {/* Visible edge */}
                <path
                  d={path}
                  stroke={isSelected ? '#2196f3' : (edge.color || '#666')}
                  strokeWidth={isSelected ? 3 : 2}
                  fill="none"
                  markerEnd="url(#arrowhead-canvas)"
                />
              </g>
            );
          })}
          {/* Arrow head marker definition */}
          <defs>
            <marker
              id="arrowhead-canvas"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#666" />
            </marker>
          </defs>
        </svg>

        {/* Temporary connection line */}
        {connectingFrom && tempConnection && (() => {
          const sourceNode = flowchart.nodes.find((n) => n.id === connectingFrom.nodeId);
          if (!sourceNode) return null;
          const sourcePoint = sourceNode.connectionPoints.find(
            (p) => p.id === connectingFrom.pointId
          );
          if (!sourcePoint) return null;
          
          // Use connection point's relative position
          const sourceX = sourceNode.position.x + sourcePoint.position.x;
          const sourceY = sourceNode.position.y + sourcePoint.position.y;

          const dx = tempConnection.x - sourceX;
          const controlPoint1X = sourceX + dx * 0.5;
          const controlPoint1Y = sourceY;
          const controlPoint2X = tempConnection.x - dx * 0.5;
          const controlPoint2Y = tempConnection.y;

          const path = `M ${sourceX} ${sourceY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${tempConnection.x} ${tempConnection.y}`;

          return (
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1,
                overflow: 'visible',
              }}
            >
              <path
                d={path}
                stroke="#2196f3"
                strokeWidth="2"
                strokeDasharray="5,5"
                fill="none"
              />
            </svg>
          );
        })()}

        {/* Marquee selection rectangle */}
        {isMarquee && marqueeStart && marqueeCurrent && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(marqueeStart.x, marqueeCurrent.x),
              top: Math.min(marqueeStart.y, marqueeCurrent.y),
              width: Math.abs(marqueeCurrent.x - marqueeStart.x),
              height: Math.abs(marqueeCurrent.y - marqueeStart.y),
              border: '2px dashed #2196f3',
              backgroundColor: 'rgba(33, 150, 243, 0.1)',
              pointerEvents: 'none',
              zIndex: 100,
            }}
          />
        )}

        {/* Render nodes */}
        {flowchart.nodes.map((node) => (
          <NodeComponent
            key={node.id}
            node={node}
            isSelected={selectedNodeIds.has(node.id)}
            onSelect={() => onNodeSelect(node.id)}
            onMove={(position) => onNodeMove(node.id, position)}
            onUpdate={(updates) => onNodeUpdate(node.id, updates)}
            onConnectionStart={onConnectionStart}
            onConnectionEnd={onConnectionEnd}
            connectingFrom={connectingFrom}
            canvasTransform={transform}
            canvasRef={canvasRef}
            onInteractionStart={handleInteractionStart}
            onInteractionEnd={handleInteractionEnd}
          />
        ))}
      </div>
    </div>
  );
};

