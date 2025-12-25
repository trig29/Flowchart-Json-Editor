## Flowchart JSON Editor（流程图 JSON 编辑器）

一个基于 **Electron + React + TypeScript** 的桌面应用，用来编辑“节点-连线”形式的流程图，并以 **JSON** 作为可扩展的数据存储格式。适合分支叙事、对话树、游戏脚本结构整理等场景。

## 功能

- **流程图编辑**
  - 新增节点、拖拽移动、调整节点尺寸
  - 节点连线（有向连接）与删除
  - 画布缩放/平移
- **属性面板**
  - 节点：文本（支持换行）、背景色、宽高、删除
  - 连接：颜色、删除
- **撤销 / 重做**
  - 支持常见操作的撤销重做（见下方“快捷键”与“限制说明”）
- **项目/文件管理（类似 VSCode Explorer）**
  - 打开文件夹 / 新建项目（选择一个目录作为项目根）
  - 仅展示 `.json` 文件；支持文件夹展开
  - 右键：新建流程图（`.json`）、新建文件夹、重命名、删除
  - 拖拽：把文件/文件夹移动到其他文件夹
  - 切换文件时自动保存当前文件（已有路径时）
- **导出**
  - 导出 **PNG**：节点文本自动换行（会保留手动换行）
  - 导出 **SVG**
- **项目备份**
  - 备份当前项目文件夹为 zip 到 `<项目>/backups/`
  - 自动备份：每 5 分钟静默执行一次（也可手动点击备份按钮）
  - 备份会排除：`backups/`、`node_modules/`、`dist/`、`dist-react/`、`release/`、`.git/`

## 快捷键

- **Ctrl/Cmd + S**：保存
- **Ctrl/Cmd + Z**：撤销
- **Ctrl/Cmd + Shift + Z**：重做
- **Delete / Backspace**：删除选中的节点或连接（输入框/文本编辑中不会触发）

## 撤销/重做的限制说明

为了避免历史记录过于碎片化，目前的撤销/重做主要覆盖：

- **节点**：移动、调整尺寸、背景色（以及连接点等结构性变更）
- **连接**：颜色

说明：**节点文本编辑目前不进入撤销栈**（属于即时更新）。

## 数据格式（JSON）

流程图文件本质是一个可序列化对象：

```json
{
  "nodes": [
    {
      "id": "node-0",
      "position": { "x": 400, "y": 300 },
      "size": { "width": 150, "height": 80 },
      "text": "新节点",
      "backgroundColor": "#e3f2fd",
      "connectionPoints": [
        { "id": "node-0-input", "type": "input", "position": { "x": 0, "y": -40 } },
        { "id": "node-0-output", "type": "output", "position": { "x": 0, "y": 40 } }
      ],
      "metadata": {}
    }
  ],
  "edges": [
    {
      "id": "edge-xxx",
      "sourceNodeId": "node-0",
      "sourcePointId": "node-0-output",
      "targetNodeId": "node-1",
      "targetPointId": "node-1-input",
      "color": "#666",
      "metadata": {}
    }
  ],
  "viewState": { "x": 0, "y": 0, "scale": 1 },
  "metadata": {}
}
```

## 开发环境

### 环境要求

- Node.js 18+
- npm

### 安装依赖

```bash
npm install
```

### 本地开发（热更新）

```bash
npm run dev
```

说明：会启动 Vite（默认 `http://localhost:5173`）并在其就绪后拉起 Electron。

### 仅启动前端（浏览器预览，可用于调 UI）

```bash
npm run dev:react
```

注意：此模式下没有 Electron 的文件系统能力（`window.electronAPI` 不可用），保存/加载/导出/备份等会受限。

### 构建

```bash
npm run build
```

输出：
- 前端构建产物：`dist-react/`
- 主进程编译产物：`dist/`

## 打包（Windows 安装包）

### 标准打包

```bash
npm run dist
```

也可以只生成解压目录（不生成安装包）：

```bash
npm run pack
```

产物目录：`release/`
- 安装包：`release/Flowchart Json Editor Setup *.exe`
- 解压目录：`release/win-unpacked/Flowchart Json Editor.exe`

### 备用打包（避免旧目录被占用导致清理失败）

当 `release/win-unpacked` 被系统占用（常见于刚运行过打包后的 exe）导致 `EPERM unlink ...` 时，可用：

```bash
npm run dist:alt
```

产物目录：`release-alt/`

## 目录结构

- **`electron/`**：Electron 主进程与 preload（文件系统、导出、备份等 IPC）
- **`src/`**：React 渲染进程（画布、节点/连线、属性面板、文件树等）
- **`src/models/`**：数据模型与纯函数（创建/更新/序列化/反序列化）
- **`dist/`**：主进程编译输出（由 `tsc -p tsconfig.electron.json` 生成）
- **`dist-react/`**：前端构建输出（由 Vite 生成）
- **`release/`**：electron-builder 打包输出（安装包与 win-unpacked）

## 常见问题（打包/运行）

- **打包时报 `EPERM: operation not permitted, unlink ... release\\win-unpacked\\...`**
  - 原因：旧的 `win-unpacked` 文件被占用（运行中的程序/资源管理器/杀软等）。
  - 处理：关闭占用进程后再打包，或直接使用 `npm run dist:alt` 输出到新目录。
- **打包后启动报 `Cannot find module 'archiver-utils'`**
  - 原因：主进程的 zip 备份功能依赖 `archiver`，其传递依赖在生产包中缺失。
  - 处理：确保 `archiver-utils` 在 `dependencies` 中，执行 `npm install` 后重新打包。

## License

MIT

