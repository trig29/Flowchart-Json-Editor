/**
 * Flowchart data model and operations.
 * Pure data layer - no rendering logic here.
 */

import { Flowchart, Node, Edge, Position, Size, ConnectionPoint } from './types';
import { getTagColor, normalizeNode, getNodeDisplayText } from './nodeTag';

function createRootNode(existingIds: Set<string> = new Set()): Node {
  const preferredId = 'root';
  const id = existingIds.has(preferredId) ? 'root-node' : preferredId;
  const size: Size = { width: 180, height: 80 };
  return {
    id,
    position: { x: 400, y: 200 },
    size,
    tag: 'root',
    text: '对话开始',
    actor: undefined,
    childCount: undefined,
    backgroundColor: getTagColor('root'),
    connectionPoints: [
      { id: `${id}-input`, type: 'input', position: { x: 0, y: -size.height / 2 } },
      { id: `${id}-output`, type: 'output', position: { x: 0, y: size.height / 2 } },
    ],
  };
}

function ensureSingleRoot(flowchart: Flowchart): Flowchart {
  const roots = flowchart.nodes.filter((n) => n.tag === 'root');
  if (roots.length === 1) return flowchart;

  const ids = new Set(flowchart.nodes.map((n) => n.id));

  // No root: add one at the start.
  if (roots.length === 0) {
    return { ...flowchart, nodes: [createRootNode(ids), ...flowchart.nodes] };
  }

  // Multiple roots: keep the first, downgrade others to dialogue nodes.
  let kept = false;
  const nodes = flowchart.nodes.map((n) => {
    if (n.tag !== 'root') return n;
    if (!kept) {
      kept = true;
      return { ...n, text: '对话开始', actor: undefined, childCount: undefined, backgroundColor: getTagColor('root') };
    }
    return { ...n, tag: 'dialogue', actor: '', backgroundColor: getTagColor('dialogue') };
  });

  return { ...flowchart, nodes };
}

export function applyDerivedFlowchart(flowchart: Flowchart): Flowchart {
  const withRoot = ensureSingleRoot(flowchart);
  const outgoingCounts = new Map<string, number>();
  for (const e of withRoot.edges) {
    outgoingCounts.set(e.sourceNodeId, (outgoingCounts.get(e.sourceNodeId) || 0) + 1);
  }

  const nodes: Node[] = withRoot.nodes.map((n) => {
    const tag = n.tag || 'dialogue';
    const base: Node = { ...n, tag, backgroundColor: getTagColor(tag) };
    if (tag === 'root') {
      return {
        ...base,
        text: '对话开始',
        actor: undefined,
        childCount: undefined,
      };
    }
    if (tag === 'choiceFlag') {
      return {
        ...base,
        text: '',
        actor: undefined,
        childCount: outgoingCounts.get(n.id) || 0,
      };
    }
    return {
      ...base,
      childCount: undefined,
    };
  });

  return { ...withRoot, nodes };
}

/**
 * Create a new empty flowchart
 */
export function createFlowchart(): Flowchart {
  return applyDerivedFlowchart({
    nodes: [createRootNode()],
    edges: [],
    metadata: {},
  });
}

/**
 * Create a new node with default properties
 */
export function createNode(
  id: string,
  position: Position,
  size: Size = { width: 150, height: 80 }
): Node {
  return {
    id,
    position,
    size,
    tag: 'dialogue',
    text: '新节点',
    actor: '',
    backgroundColor: getTagColor('dialogue'),
    connectionPoints: [
      { id: `${id}-input`, type: 'input', position: { x: 0, y: -size.height / 2 } },
      { id: `${id}-output`, type: 'output', position: { x: 0, y: size.height / 2 } },
    ],
  };
}

/**
 * Add a node to the flowchart
 */
export function addNode(flowchart: Flowchart, node: Node): Flowchart {
  return {
    ...flowchart,
    nodes: [...flowchart.nodes, node],
  };
}

/**
 * Update a node in the flowchart
 */
export function updateNode(
  flowchart: Flowchart,
  nodeId: string,
  updates: Partial<Node>
): Flowchart {
  return {
    ...flowchart,
    nodes: flowchart.nodes.map((node) =>
      node.id === nodeId ? { ...node, ...updates } : node
    ),
  };
}

/**
 * Remove a node and all connected edges
 */
export function removeNode(flowchart: Flowchart, nodeId: string): Flowchart {
  return {
    ...flowchart,
    nodes: flowchart.nodes.filter((node) => node.id !== nodeId),
    edges: flowchart.edges.filter(
      (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId
    ),
  };
}

/**
 * Create a new edge
 */
export function createEdge(
  id: string,
  sourceNodeId: string,
  sourcePointId: string,
  targetNodeId: string,
  targetPointId: string
): Edge {
  return {
    id,
    sourceNodeId,
    sourcePointId,
    targetNodeId,
    targetPointId,
  };
}

/**
 * Add an edge to the flowchart
 */
export function addEdge(flowchart: Flowchart, edge: Edge): Flowchart {
  // Validate that nodes exist
  const sourceExists = flowchart.nodes.some((n) => n.id === edge.sourceNodeId);
  const targetExists = flowchart.nodes.some((n) => n.id === edge.targetNodeId);

  if (!sourceExists || !targetExists) {
    throw new Error('Source or target node does not exist');
  }

  // Check for duplicate edges - more comprehensive check
  const duplicate = flowchart.edges.some(
    (e) =>
      e.sourceNodeId === edge.sourceNodeId &&
      e.sourcePointId === edge.sourcePointId &&
      e.targetNodeId === edge.targetNodeId &&
      e.targetPointId === edge.targetPointId
  );

  if (duplicate) {
    // Return unchanged flowchart instead of throwing error
    // This prevents crashes when duplicate connections are attempted
    return flowchart;
  }

  return {
    ...flowchart,
    edges: [...flowchart.edges, edge],
  };
}

/**
 * Remove an edge from the flowchart
 */
export function removeEdge(flowchart: Flowchart, edgeId: string): Flowchart {
  return {
    ...flowchart,
    edges: flowchart.edges.filter((edge) => edge.id !== edgeId),
  };
}

/**
 * Serialize flowchart to JSON
 */
export function serializeFlowchart(flowchart: Flowchart): string {
  return JSON.stringify(flowchart, null, 2);
}

/**
 * Deserialize JSON to flowchart
 */
export function deserializeFlowchart(json: string): Flowchart {
  const data = JSON.parse(json);
  // Basic validation
  if (!data.nodes || !Array.isArray(data.nodes)) {
    throw new Error('Invalid flowchart format: missing nodes array');
  }
  if (!data.edges || !Array.isArray(data.edges)) {
    throw new Error('Invalid flowchart format: missing edges array');
  }

  // Normalize nodes for backward compatibility (older files may not have tag/actor)
  const nodes: Node[] = data.nodes.map((n: Partial<Node>) => normalizeNode(n));

  return applyDerivedFlowchart({
    nodes,
    edges: data.edges,
    metadata: data.metadata || {},
  });
}

/**
 * Calculate the required height for a node based on its text content
 * This function measures text with word wrapping and returns the minimum height needed
 * Usage: Call this when node text or width changes to determine if height adjustment is needed
 */
export function calculateNodeHeight(node: Node): number {
  // Constants matching the rendering styles
  const FONT_SIZE = 14;
  const LINE_HEIGHT = 18;
  const PADDING = 8; // Top and bottom padding
  const TAG_AREA_HEIGHT = 30; // Space for tag badge at top
  const MIN_HEIGHT = 50; // Minimum node height
  
  // Check if we're in a browser environment
  if (typeof document === 'undefined') {
    return Math.max(MIN_HEIGHT, node.size.height);
  }
  
  // Available width for text (node width minus left/right padding)
  const availableWidth = Math.max(20, node.size.width - PADDING * 2);
  
  // Create a temporary canvas to measure text width
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Fallback: estimate based on text length
    const displayText = getNodeDisplayText(node);
    const estimatedLines = Math.max(1, Math.ceil(displayText.length / 20));
    return Math.max(MIN_HEIGHT, TAG_AREA_HEIGHT + estimatedLines * LINE_HEIGHT + PADDING * 2);
  }
  
  ctx.font = `${FONT_SIZE}px sans-serif`;
  
  // Get the display text (handles dialogue actor + text, choiceFlag count, etc.)
  const displayText = getNodeDisplayText(node);
  
  // Split by manual line breaks first
  const manualLines = displayText.split('\n');
  let totalLines = 0;
  
  for (const line of manualLines) {
    if (!line.trim()) {
      totalLines += 1; // Empty line still takes space
      continue;
    }
    
    // Measure text width and calculate how many wrapped lines are needed
    const words = line.includes(' ') ? line.split(/(\s+)/) : Array.from(line);
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width <= availableWidth) {
        currentLine = testLine;
      } else {
        // Current line is full, start a new line
        if (currentLine.trim().length > 0) {
          totalLines += 1;
          currentLine = word.trimStart();
        } else {
          // Word itself is too long, break it character by character
          for (const char of Array.from(word)) {
            const testChar = currentLine + char;
            const charMetrics = ctx.measureText(testChar);
            if (charMetrics.width <= availableWidth) {
              currentLine = testChar;
            } else {
              if (currentLine.length > 0) {
                totalLines += 1;
              }
              currentLine = char;
            }
          }
        }
      }
    }
    
    // Add the last line
    if (currentLine.length > 0) {
      totalLines += 1;
    }
  }
  
  // Ensure at least one line
  if (totalLines === 0) {
    totalLines = 1;
  }
  
  // Calculate total height
  const textHeight = totalLines * LINE_HEIGHT;
  const totalHeight = TAG_AREA_HEIGHT + textHeight + PADDING * 2;
  
  return Math.max(MIN_HEIGHT, totalHeight);
}

/**
 * Auto-adjust node height based on text content
 * Returns updated node with adjusted height if needed
 */
export function autoAdjustNodeHeight(node: Node): Node {
  const requiredHeight = calculateNodeHeight(node);
  
  // Only adjust if current height is less than required
  if (node.size.height < requiredHeight) {
    const heightDiff = requiredHeight - node.size.height;
    
    // Update connection points to maintain their position relative to node center
    const updatedConnectionPoints = node.connectionPoints.map((p) => {
      if (p.type === 'input') {
        return { ...p, position: { x: 0, y: -requiredHeight / 2 } };
      }
      if (p.type === 'output') {
        return { ...p, position: { x: 0, y: requiredHeight / 2 } };
      }
      return p;
    });
    
    return {
      ...node,
      size: { ...node.size, height: requiredHeight },
      connectionPoints: updatedConnectionPoints,
    };
  }
  
  return node;
}

