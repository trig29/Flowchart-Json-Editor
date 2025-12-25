/**
 * Edge component - renders a connection between two nodes
 * Uses SVG for smooth rendering
 */

import React from 'react';
import { Edge, Node } from '../models/types';

interface EdgeComponentProps {
  edge: Edge;
  nodes: Node[];
  isSelected: boolean;
  onSelect: () => void;
}

export const EdgeComponent: React.FC<EdgeComponentProps> = ({
  edge,
  nodes,
  isSelected,
  onSelect,
}) => {
  const sourceNode = nodes.find((n) => n.id === edge.sourceNodeId);
  const targetNode = nodes.find((n) => n.id === edge.targetNodeId);

  if (!sourceNode || !targetNode) {
    return null;
  }

  const sourcePoint = sourceNode.connectionPoints.find((p) => p.id === edge.sourcePointId);
  const targetPoint = targetNode.connectionPoints.find((p) => p.id === edge.targetPointId);

  if (!sourcePoint || !targetPoint) {
    return null;
  }

  // Calculate connection point positions: at top/bottom edge centers
  // Node position is center, so top edge is at position.y - height/2, bottom edge is at position.y + height/2
  const sourceX = sourceNode.position.x; // Center horizontally
  const sourceY = sourceNode.position.y + (sourcePoint.type === 'input' ? -sourceNode.size.height / 2 : sourceNode.size.height / 2);
  const targetX = targetNode.position.x; // Center horizontally
  const targetY = targetNode.position.y + (targetPoint.type === 'input' ? -targetNode.size.height / 2 : targetNode.size.height / 2);

  // Calculate control points for bezier curve
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const controlPoint1X = sourceX + dx * 0.5;
  const controlPoint1Y = sourceY;
  const controlPoint2X = targetX - dx * 0.5;
  const controlPoint2Y = targetY;

  const path = `M ${sourceX} ${sourceY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${targetX} ${targetY}`;

  // Arrow head at target
  const angle = Math.atan2(targetY - controlPoint2Y, targetX - controlPoint2X);
  const arrowLength = 10;
  const arrowWidth = 6;
  const arrowX = targetX - Math.cos(angle) * arrowLength;
  const arrowY = targetY - Math.sin(angle) * arrowLength;

  const arrowPath = `M ${targetX} ${targetY} L ${arrowX - arrowWidth * Math.sin(angle)} ${
    arrowY + arrowWidth * Math.cos(angle)
  } L ${arrowX + arrowWidth * Math.sin(angle)} ${arrowY - arrowWidth * Math.cos(angle)} Z`;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* Invisible hit area for selection */}
      <path
        d={path}
        stroke="transparent"
        strokeWidth="20"
        fill="none"
        style={{ pointerEvents: 'all', cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      />
      {/* Visible edge */}
      <path
        d={path}
        stroke={isSelected ? '#2196f3' : (edge.color || '#666')}
        strokeWidth={isSelected ? 3 : 2}
        fill="none"
        markerEnd={`url(#arrowhead-${edge.id})`}
      />
      {/* Arrow head */}
      <defs>
        <marker
          id={`arrowhead-${edge.id}`}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3, 0 6"
            fill={isSelected ? '#2196f3' : (edge.color || '#666')}
          />
        </marker>
      </defs>
    </svg>
  );
};

