/**
 * Node component - renders a single flowchart node
 * Handles dragging, selection, and connection point interactions
 */

import React, { useState, useCallback } from 'react';
import { Node, Position, ConnectionPoint } from '../models/types';

interface NodeComponentProps {
  node: Node;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (position: Position) => void;
  onUpdate: (updates: Partial<Node>) => void;
  onConnectionStart: (nodeId: string, pointId: string) => void;
  onConnectionEnd: (nodeId: string, pointId: string) => void;
  connectingFrom: { nodeId: string; pointId: string } | null;
  canvasTransform?: { x: number; y: number; scale: number };
  canvasRef?: React.RefObject<HTMLDivElement>;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | null;

export const NodeComponent: React.FC<NodeComponentProps> = ({
  node,
  isSelected,
  onSelect,
  onMove,
  onUpdate,
  onConnectionStart,
  onConnectionEnd,
  connectingFrom,
  canvasTransform = { x: 0, y: 0, scale: 1 },
  canvasRef,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [resizeStart, setResizeStart] = useState<{ 
    pos: Position; 
    size: { width: number; height: number };
    nodePos: Position;
  }>({
    pos: { x: 0, y: 0 },
    size: { width: 0, height: 0 },
    nodePos: { x: 0, y: 0 },
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(node.text);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.button === 0) {
        // Left click
        onSelect();
        const target = e.target as HTMLElement;
        if (target.dataset.resizeHandle) {
          // Start resizing
          setIsResizing(true);
          setResizeHandle(target.dataset.resizeHandle as ResizeHandle);
          setResizeStart({
            pos: { x: e.clientX, y: e.clientY },
            size: { width: node.size.width, height: node.size.height },
            nodePos: { x: node.position.x, y: node.position.y },
          });
        } else {
          // Start dragging - convert screen coordinates to canvas coordinates
          const rect = canvasRef?.current?.getBoundingClientRect();
          if (rect) {
            const canvasX = (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
            const canvasY = (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;
            setIsDragging(true);
            setDragStart({
              x: canvasX - node.position.x,
              y: canvasY - node.position.y,
            });
          } else {
            setIsDragging(true);
            setDragStart({
              x: e.clientX - node.position.x,
              y: e.clientY - node.position.y,
            });
          }
        }
      }
    },
    [node.position, node.size, onSelect]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Node movement and resizing are handled by global mouse events in useEffect
      // This handler is kept for potential future use but doesn't handle dragging/resizing
      // to avoid coordinate conversion issues
    },
    []
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditing(true);
      setEditText(node.text);
    },
    [node.text]
  );

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(e.target.value);
  }, []);

  const handleTextBlur = useCallback(() => {
    setIsEditing(false);
    if (editText !== node.text) {
      onUpdate({ text: editText });
    }
  }, [editText, node.text, onUpdate]);


  const handleConnectionPointClick = useCallback(
    (e: React.MouseEvent, point: ConnectionPoint) => {
      e.stopPropagation();
      if (connectingFrom) {
        // Complete connection
        if (
          connectingFrom.nodeId !== node.id &&
          point.type === 'input' &&
          connectingFrom.nodeId
        ) {
          onConnectionEnd(node.id, point.id);
        }
      } else {
        // Start connection
        if (point.type === 'output') {
          onConnectionStart(node.id, point.id);
        }
      }
    },
    [connectingFrom, node.id, onConnectionStart, onConnectionEnd]
  );

  // Global mouse handlers for dragging and resizing
  React.useEffect(() => {
    if (isDragging || isResizing) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        const rect = canvasRef?.current?.getBoundingClientRect();
        if (isResizing && resizeHandle) {
          // Resize uses screen coordinates directly (delta)
          const deltaX = (e.clientX - resizeStart.pos.x) / canvasTransform.scale;
          const deltaY = (e.clientY - resizeStart.pos.y) / canvasTransform.scale;
          let newWidth = resizeStart.size.width;
          let newHeight = resizeStart.size.height;
          let newX = resizeStart.nodePos.x;
          let newY = resizeStart.nodePos.y;

          // Handle corner resizing
          if (resizeHandle === 'se') {
            newWidth = Math.max(50, resizeStart.size.width + deltaX);
            newHeight = Math.max(50, resizeStart.size.height + deltaY);
          } else if (resizeHandle === 'sw') {
            newWidth = Math.max(50, resizeStart.size.width - deltaX);
            newHeight = Math.max(50, resizeStart.size.height + deltaY);
            const widthDiff = newWidth - resizeStart.size.width;
            newX = resizeStart.nodePos.x - widthDiff / 2;
          } else if (resizeHandle === 'ne') {
            newWidth = Math.max(50, resizeStart.size.width + deltaX);
            newHeight = Math.max(50, resizeStart.size.height - deltaY);
            const heightDiff = newHeight - resizeStart.size.height;
            newY = resizeStart.nodePos.y - heightDiff / 2;
          } else if (resizeHandle === 'nw') {
            newWidth = Math.max(50, resizeStart.size.width - deltaX);
            newHeight = Math.max(50, resizeStart.size.height - deltaY);
            const widthDiff = newWidth - resizeStart.size.width;
            const heightDiff = newHeight - resizeStart.size.height;
            newX = resizeStart.nodePos.x - widthDiff / 2;
            newY = resizeStart.nodePos.y - heightDiff / 2;
          }

          // Keep connection points pinned to the middle of top/bottom edges
          const updatedConnectionPoints = node.connectionPoints.map((p) => {
            if (p.type === 'input') {
              return { ...p, position: { x: 0, y: -newHeight / 2 } };
            }
            if (p.type === 'output') {
              return { ...p, position: { x: 0, y: newHeight / 2 } };
            }
            return p;
          });

          onUpdate({
            size: { width: newWidth, height: newHeight },
            position: { x: newX, y: newY },
            connectionPoints: updatedConnectionPoints,
          });
        } else if (isDragging && rect) {
          // Convert screen coordinates to canvas coordinates
          const canvasX = (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
          const canvasY = (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;
          onMove({
            x: canvasX - dragStart.x,
            y: canvasY - dragStart.y,
          });
        }
      };

      const handleGlobalMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
        setResizeHandle(null);
      };

      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, isResizing, resizeHandle, dragStart, resizeStart, canvasTransform, canvasRef, onMove, onUpdate, node.connectionPoints]);

  const connectionPointRadius = 6;
  const halfWidth = node.size.width / 2;
  const halfHeight = node.size.height / 2;
  const resizeHandleSize = 8;

  const getResizeCursor = (handle: ResizeHandle): string => {
    if (!handle) return 'grab';
    if (handle === 'nw' || handle === 'se') return 'nwse-resize';
    if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
    return 'grab';
  };

  return (
    <div
      data-node={node.id}
      style={{
        position: 'absolute',
        left: node.position.x - halfWidth,
        top: node.position.y - halfHeight,
        width: node.size.width,
        height: node.size.height,
        backgroundColor: node.backgroundColor,
        border: isSelected ? '3px solid #2196f3' : '2px solid #1976d2',
        borderRadius: '8px',
        cursor: isDragging ? 'grabbing' : isResizing ? getResizeCursor(resizeHandle) : 'grab',
        userSelect: 'none',
        boxShadow: isSelected
          ? '0 4px 8px rgba(33, 150, 243, 0.3)'
          : '0 2px 4px rgba(0, 0, 0, 0.1)',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Resize handles - only show when selected */}
      {isSelected && (
        <>
          {/* Corner handles */}
          <div
            data-resize-handle="nw"
            style={{
              position: 'absolute',
              left: -resizeHandleSize / 2,
              top: -resizeHandleSize / 2,
              width: resizeHandleSize,
              height: resizeHandleSize,
              backgroundColor: '#2196f3',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'nwse-resize',
              zIndex: 20,
            }}
          />
          <div
            data-resize-handle="ne"
            style={{
              position: 'absolute',
              right: -resizeHandleSize / 2,
              top: -resizeHandleSize / 2,
              width: resizeHandleSize,
              height: resizeHandleSize,
              backgroundColor: '#2196f3',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'nesw-resize',
              zIndex: 20,
            }}
          />
          <div
            data-resize-handle="sw"
            style={{
              position: 'absolute',
              left: -resizeHandleSize / 2,
              bottom: -resizeHandleSize / 2,
              width: resizeHandleSize,
              height: resizeHandleSize,
              backgroundColor: '#2196f3',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'nesw-resize',
              zIndex: 20,
            }}
          />
          <div
            data-resize-handle="se"
            style={{
              position: 'absolute',
              right: -resizeHandleSize / 2,
              bottom: -resizeHandleSize / 2,
              width: resizeHandleSize,
              height: resizeHandleSize,
              backgroundColor: '#2196f3',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'nwse-resize',
              zIndex: 20,
            }}
          />
        </>
      )}
      {/* Connection points */}
      {node.connectionPoints.map((point) => {
        // Connection points position is relative to node center
        // Node's left/top is at (position.x - halfWidth, position.y - halfHeight)
        // So connection point position in node's coordinate system is:
        const pointX = halfWidth + point.position.x;
        const pointY = halfHeight + point.position.y;
        const isHighlighted =
          connectingFrom?.nodeId === node.id && connectingFrom?.pointId === point.id;

        return (
          <div
            key={point.id}
            style={{
              position: 'absolute',
              left: pointX - connectionPointRadius,
              top: pointY - connectionPointRadius,
              width: connectionPointRadius * 2,
              height: connectionPointRadius * 2,
              borderRadius: '50%',
              backgroundColor: point.type === 'input' ? '#4caf50' : '#ff9800',
              border: isHighlighted ? '2px solid #2196f3' : '2px solid white',
              cursor: point.type === 'output' ? 'crosshair' : 'pointer',
              zIndex: 10,
            }}
            onClick={(e) => handleConnectionPointClick(e, point)}
            title={point.type === 'input' ? '输入' : '输出'}
          />
        );
      })}

      {/* Node text content */}
      <div
        style={{
          padding: '8px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {isEditing ? (
          <textarea
            value={editText}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                setEditText(node.text);
                setIsEditing(false);
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: '500',
              resize: 'none',
              padding: '4px',
              fontFamily: 'inherit',
            }}
            autoFocus
          />
        ) : (
          <div
            style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#333',
              textAlign: 'center',
              wordWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              overflow: 'hidden',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {node.text.split('\n').map((line, index, array) => (
              <React.Fragment key={index}>
                {line}
                {index < array.length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


