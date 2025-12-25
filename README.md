# Flowchart JSON Editor

A desktop Flowchart Editor application built with Electron, React, and TypeScript. Designed specifically for branching narrative and game script writing with extensible data serialization.

## Features

- **Visual Flowchart Editor**: Create and edit narrative logic with a node-based interface
- **Node Management**: 
  - Create, move, and edit nodes
  - Customize node properties (text, color, size)
  - Connection points for linking nodes
- **Edge Connections**: Connect nodes to form directed flowcharts
- **Canvas Interaction**:
  - Zoom and pan support
  - Smooth dragging and selection
- **VSCode-like Explorer**:
  - Project folder tree
  - Drag & drop to move files/folders into another folder
  - Right-click rename / delete
  - Auto-save current file when switching files in the explorer
- **Persistence**:
  - Save and load flowcharts as JSON
  - Export to PNG or SVG images
- **PNG Export Text Wrap**:
  - Auto-wrap node text within the node bounds (keeps manual newlines)
- **Extensible Architecture**: Clean data model designed for future narrative/game script integration

## Architecture

The application follows a clean separation of concerns:

- **Data Layer** (`src/models/`): Pure data structures and operations, independent of rendering
- **Rendering Layer** (`src/components/`): React components for UI and canvas rendering
- **Interaction Logic** (`src/App.tsx`): Coordinates user interactions and state management
- **Electron Layer** (`electron/`): Main process and file system operations

### Data Model

The flowchart is represented as a pure JSON structure:

```json
{
  "nodes": [
    {
      "id": "node-0",
      "position": { "x": 400, "y": 300 },
      "size": { "width": 150, "height": 80 },
      "text": "Start",
      "backgroundColor": "#e3f2fd",
      "connectionPoints": [...]
    }
  ],
  "edges": [
    {
      "id": "edge-123",
      "sourceNodeId": "node-0",
      "sourcePointId": "node-0-output",
      "targetNodeId": "node-1",
      "targetPointId": "node-1-input"
    }
  ],
  "metadata": {}
}
```

This structure is designed to be extensible for future features like:
- Narrative events
- Conditional branches
- Game-specific metadata (flags, variables, triggers)

## Development

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

This will:
1. Start the Vite dev server for React (http://localhost:5173)
2. Launch Electron when the server is ready

### Build

```bash
npm run build
```

This compiles both the React app and Electron main process.

## Packaging (Windows Installer)

```bash
npm run dist
```

Artifacts are generated in `release/`:
- NSIS installer: `release/Flowchart Json Editor Setup *.exe`
- Unpacked app: `release/win-unpacked/Flowchart Json Editor.exe`

## Usage

### Creating Nodes

- Click the "+ Add Node" button in the toolbar
- Nodes appear at the center of the canvas

### Moving Nodes

- Click and drag a node to move it
- Nodes can be positioned anywhere on the canvas

### Editing Nodes

- **Double-click** a node to edit its text inline
- Select a node and use the **Property Panel** on the right to:
  - Change text
  - Modify background color
  - Adjust width and height

### Creating Connections

1. Click on an **output connection point** (orange circle at bottom of node)
2. Drag to an **input connection point** (green circle at top of target node)
3. Release to create the connection

### Deleting Connections

- Select a connection (edge) by clicking on it
- Press `Delete` or `Backspace` to remove it

### Canvas Navigation

- **Zoom**: Use mouse wheel to zoom in/out
- **Pan**: Left mouse drag on empty canvas area (or middle mouse drag)

### Saving and Loading

- **Save**: Click "Save" to export the flowchart as JSON
- **Load**: Click "Load" to import a previously saved flowchart
- **Auto-save on switch**: When you open another file from the explorer, the current file is saved automatically (if it has a file path)

### Exporting Images

- **Export PNG**: Export the flowchart as a PNG image
- **Export SVG**: Export the flowchart as an SVG vector image

## Keyboard Shortcuts

- `Delete` / `Backspace`: Delete selected edge
- `Escape`: Cancel connection in progress

## Future Extensibility

The architecture is designed to support future enhancements:

1. **Narrative Events**: Add event types and metadata to nodes
2. **Conditional Branches**: Support conditional logic in edges
3. **Script Compilation**: Convert flowcharts to executable game scripts
4. **Node Templates**: Pre-defined node types for common narrative patterns
5. **Validation**: Check for common errors (orphaned nodes, cycles, etc.)

## License

MIT

