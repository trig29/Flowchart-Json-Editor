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
 * Node tag (type) for story authoring.
 * Color in UI represents the tag.
 */
export type NodeTag = 'root' | 'dialogue' | 'option' | 'choiceFlag' | 'comment';

/**
 * Node in the flowchart
 * Designed to be extensible for narrative events and game logic
 */
export interface Node {
  id: string;
  position: Position;
  size: Size;
  tag: NodeTag;
  /**
   * For `dialogue` nodes, this is the line content (supports newlines).
   * For other tags, this is the main content (supports newlines).
   */
  text: string;
  /**
   * Dialogue speaker name. Only meaningful when tag === 'dialogue'.
   * Single-line input in UI.
   */
  actor?: string;
  /**
   * For `choiceFlag` nodes, store how many child nodes it currently has.
   * This value is derived from outgoing edges and should be kept in sync.
   */
  childCount?: number;
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

