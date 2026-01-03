## 流程图 JSON 文件存储结构说明（数据层）

本说明只描述 **JSON 文件的数据结构** 与字段含义，刻意忽略任何 UI / 画布表现。

---

## 顶层结构：Flowchart

一个流程图文件是一个对象，主要字段如下：

- **`nodes`**：节点数组（必填）
- **`edges`**：连线数组（必填）
- **`viewState`**：视图状态（可选）
- **`metadata`**：扩展信息（可选）

示意结构：

```json
{
  "nodes": [],
  "edges": [],
  "viewState": { "x": 0, "y": 0, "scale": 1 },
  "metadata": {}
}
```

---

## 节点结构：Node

`nodes[]` 中每个元素是一个节点对象。

### 1) 基础字段（所有节点都会有）

- **`id: string`**：节点唯一标识（在当前流程图中应唯一）
- **`position: { x: number, y: number }`**：节点位置（坐标系由应用内部定义）
- **`size: { width: number, height: number }`**：节点尺寸
- **`tag: string`**：节点类型（见下方“Tag 列表与约束”）
- **`backgroundColor: string`**：节点背景色（当前实现中与 `tag` 绑定）
- **`connectionPoints: ConnectionPoint[]`**：连接点数组（用于连线端点引用）
- **`metadata?: object`**：预留扩展字段（可选）

`ConnectionPoint` 结构：

- **`id: string`**：连接点 id（通常由节点 id 派生，如 `node-1-input` / `node-1-output`）
- **`type: "input" | "output"`**：输入/输出连接点
- **`position: { x: number, y: number }`**：连接点相对节点中心的偏移

### 2) 内容字段（随 tag 不同而不同）

节点内容主要由以下字段表达：

- **`text: string`**
  - 当 `tag = "dialogue"`：表示台词 **Line**（允许换行）
  - 当 `tag = "option"` / `tag = "comment"`：表示该节点的主文本（允许换行）
  - 当 `tag = "root"`：固定为 `"对话开始"`（见约束）
  - 当 `tag = "choiceFlag"`：不使用，当前实现会强制为空字符串

- **`actor?: string`**
  - 仅当 `tag = "dialogue"` 时有意义，表示说话人（单行文本）
  - 其他 tag 下不使用（通常应省略或为 `undefined`）

- **`childCount?: number`**
  - 仅当 `tag = "choiceFlag"` 时有意义
  - 表示该节点“子节点数量”
  - **注意：这是派生值**，当前实现会根据“从该节点出发的连线数量”自动计算并保持一致

---

## 连线结构：Edge

`edges[]` 中每个元素是一条有向连线（source → target）。

字段：

- **`id: string`**：连线唯一标识
- **`sourceNodeId: string`**：源节点 id
- **`sourcePointId: string`**：源连接点 id（应属于源节点的 `connectionPoints`）
- **`targetNodeId: string`**：目标节点 id
- **`targetPointId: string`**：目标连接点 id（应属于目标节点的 `connectionPoints`）
- **`color?: string`**：连线颜色（可选）
- **`metadata?: object`**：预留扩展字段（可选）

> 关联关系：`Edge` 通过 `sourceNodeId/targetNodeId` 关联节点，通过 `sourcePointId/targetPointId` 关联连接点。

---

## viewState（可选）

用于保存视图状态（与数据语义无关，但会随文件保存）：

- **`x: number`**：平移 X
- **`y: number`**：平移 Y
- **`scale: number`**：缩放

---

## Tag 列表与约束

当前实现支持的 `tag` 值：

- **`"root"`**：根节点（每张流程图唯一）
- **`"dialogue"`**：对话节点（actor + line）
- **`"option"`**：选项节点
- **`"choiceFlag"`**：选择标志（用于多个选项的父节点）
- **`"comment"`**：注释节点（不进入剧本的解释性内容）

### root 约束

- 每张流程图应且仅应有 **一个** `tag="root"` 的节点
- `root` 的 `text` 固定为 `"对话开始"`

### choiceFlag 约束

- `choiceFlag.text` 不使用（当前实现会强制为空）
- `choiceFlag.childCount` 为派生值：
  - 等于 `edges` 中 `sourceNodeId === choiceFlag.id` 的数量

### backgroundColor 约束

当前实现中 `backgroundColor` 会随 `tag` 统一设置（可视作派生/受约束字段）。

---

## 兼容性说明（旧文件）

应用在读取旧 JSON 时会做“规范化”：

- 若节点缺少 `tag`：默认当作 `"dialogue"`
- 若缺少 `actor`：对话节点补为空字符串
- 若缺少 `connectionPoints`：会补默认 input/output 连接点
- 会补齐/去重 `root` 节点，并重算 `choiceFlag.childCount`

---

## 严格 JSON Schema（Draft 2020-12）

以下 Schema 用于对单个流程图文件进行结构校验（应用层仍会做“规范化/派生字段重算”）。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.local/flowchart.schema.json",
  "title": "Flowchart",
  "type": "object",
  "additionalProperties": false,
  "required": ["nodes", "edges"],
  "properties": {
    "nodes": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/node" },
      "contains": { "$ref": "#/$defs/rootNode" },
      "minContains": 1,
      "maxContains": 1
    },
    "edges": {
      "type": "array",
      "items": { "$ref": "#/$defs/edge" }
    },
    "viewState": {
      "type": "object",
      "additionalProperties": false,
      "required": ["x", "y", "scale"],
      "properties": {
        "x": { "type": "number" },
        "y": { "type": "number" },
        "scale": { "type": "number" }
      }
    },
    "metadata": {
      "type": "object"
    }
  },
  "$defs": {
    "position": {
      "type": "object",
      "additionalProperties": false,
      "required": ["x", "y"],
      "properties": {
        "x": { "type": "number" },
        "y": { "type": "number" }
      }
    },
    "size": {
      "type": "object",
      "additionalProperties": false,
      "required": ["width", "height"],
      "properties": {
        "width": { "type": "number", "minimum": 0 },
        "height": { "type": "number", "minimum": 0 }
      }
    },
    "connectionPoint": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "type", "position"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "type": { "type": "string", "enum": ["input", "output"] },
        "position": { "$ref": "#/$defs/position" }
      }
    },
    "nodeBase": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "position", "size", "tag", "text", "backgroundColor", "connectionPoints"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "position": { "$ref": "#/$defs/position" },
        "size": { "$ref": "#/$defs/size" },
        "tag": {
          "type": "string",
          "enum": ["root", "dialogue", "option", "choiceFlag", "comment"]
        },
        "text": { "type": "string" },
        "actor": { "type": "string" },
        "childCount": { "type": "integer", "minimum": 0 },
        "backgroundColor": { "type": "string", "minLength": 1 },
        "connectionPoints": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/$defs/connectionPoint" }
        },
        "metadata": { "type": "object" }
      }
    },
    "rootNode": {
      "allOf": [
        { "$ref": "#/$defs/nodeBase" },
        {
          "properties": { "tag": { "const": "root" }, "text": { "const": "对话开始" } },
          "not": {
            "anyOf": [
              { "required": ["actor"] },
              { "required": ["childCount"] }
            ]
          }
        }
      ]
    },
    "dialogueNode": {
      "allOf": [
        { "$ref": "#/$defs/nodeBase" },
        {
          "properties": { "tag": { "const": "dialogue" } },
          "required": ["actor"],
          "not": { "required": ["childCount"] }
        }
      ]
    },
    "choiceFlagNode": {
      "allOf": [
        { "$ref": "#/$defs/nodeBase" },
        {
          "properties": {
            "tag": { "const": "choiceFlag" },
            "text": { "const": "" }
          },
          "required": ["childCount"],
          "not": { "required": ["actor"] }
        }
      ]
    },
    "optionNode": {
      "allOf": [
        { "$ref": "#/$defs/nodeBase" },
        {
          "properties": { "tag": { "const": "option" } },
          "not": {
            "anyOf": [
              { "required": ["actor"] },
              { "required": ["childCount"] }
            ]
          }
        }
      ]
    },
    "commentNode": {
      "allOf": [
        { "$ref": "#/$defs/nodeBase" },
        {
          "properties": { "tag": { "const": "comment" } },
          "not": {
            "anyOf": [
              { "required": ["actor"] },
              { "required": ["childCount"] }
            ]
          }
        }
      ]
    },
    "node": {
      "oneOf": [
        { "$ref": "#/$defs/rootNode" },
        { "$ref": "#/$defs/dialogueNode" },
        { "$ref": "#/$defs/choiceFlagNode" },
        { "$ref": "#/$defs/optionNode" },
        { "$ref": "#/$defs/commentNode" }
      ]
    },
    "edge": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "sourceNodeId", "sourcePointId", "targetNodeId", "targetPointId"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "sourceNodeId": { "type": "string", "minLength": 1 },
        "sourcePointId": { "type": "string", "minLength": 1 },
        "targetNodeId": { "type": "string", "minLength": 1 },
        "targetPointId": { "type": "string", "minLength": 1 },
        "color": { "type": "string" },
        "metadata": { "type": "object" }
      }
    }
  }
}
```

> 说明：
> - Schema 已强制 `nodes` 中 **恰好一个** `tag="root"`。
> - `choiceFlag.childCount` 与 `backgroundColor` 属于派生/受约束字段；即使 JSON 合法，应用在加载/编辑后仍可能重写它们以保持一致性。


