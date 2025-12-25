/**
 * Core data models for the flowchart editor.
 * These types are designed to be serializable to JSON and extensible
 * for future narrative/game script integration.
 */

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Connection point on a node (input or output)
 */
export interface ConnectionPoint {
  id: string;
  type: 'input' | 'output';
  position: Position; // Relative to node center
}

/**
 * Node in the flowchart
 * Designed to be extensible for narrative events and game logic
 */
export interface Node {
  id: string;
  position: Position;
  size: Size;
  text: string;
  backgroundColor: string;
  connectionPoints: ConnectionPoint[];
  // Future extensibility: metadata for narrative events, conditions, etc.
  metadata?: Record<string, unknown>;
}

/**
 * Edge connecting two nodes
 */
export interface Edge {
  id: string;
  sourceNodeId: string;
  sourcePointId: string;
  targetNodeId: string;
  targetPointId: string;
  color?: string; // Edge color
  // Future extensibility: conditions, triggers, etc.
  metadata?: Record<string, unknown>;
}

/**
 * View state for canvas (position and zoom)
 */
export interface ViewState {
  x: number;
  y: number;
  scale: number;
}

/**
 * Complete flowchart data structure
 * This is the root model that gets serialized to JSON
 */
export interface Flowchart {
  nodes: Node[];
  edges: Edge[];
  viewState?: ViewState; // Canvas view state (position and zoom)
  metadata?: Record<string, unknown>;
}

