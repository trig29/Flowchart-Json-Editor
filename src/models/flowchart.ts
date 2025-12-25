/**
 * Flowchart data model and operations.
 * Pure data layer - no rendering logic here.
 */

import { Flowchart, Node, Edge, Position, Size, ConnectionPoint } from './types';

/**
 * Create a new empty flowchart
 */
export function createFlowchart(): Flowchart {
  return {
    nodes: [],
    edges: [],
    metadata: {},
  };
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
    text: '新节点',
    backgroundColor: '#e3f2fd',
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
  return {
    nodes: data.nodes,
    edges: data.edges,
    metadata: data.metadata || {},
  };
}

