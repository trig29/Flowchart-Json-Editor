import { Node, NodeTag } from './types';

export interface NodeTagDef {
  tag: NodeTag;
  label: string;
  color: string;
}

export const NODE_TAGS: NodeTagDef[] = [
  { tag: 'root', label: '开始', color: '#E0E0E0' },
  { tag: 'dialogue', label: '对话', color: '#E3F2FD' },
  { tag: 'option', label: '选项', color: '#E8F5E9' },
  { tag: 'choiceFlag', label: '选择标志', color: '#FFF9C4' },
  { tag: 'comment', label: '注释', color: '#F3E5F5' },
];

export const NODE_TAGS_SELECTABLE: NodeTagDef[] = NODE_TAGS.filter((t) => t.tag !== 'root');

export function getNodeTagDef(tag: NodeTag): NodeTagDef {
  const found = NODE_TAGS.find((t) => t.tag === tag);
  return found || NODE_TAGS[0]!;
}

export function getTagLabel(tag: NodeTag): string {
  return getNodeTagDef(tag).label;
}

export function getTagColor(tag: NodeTag): string {
  return getNodeTagDef(tag).color;
}

export function normalizeNode(raw: Partial<Node>): Node {
  const tag = (raw.tag as NodeTag) || 'dialogue';
  const backgroundColor = getTagColor(tag);

  const size = raw.size || { width: 150, height: 80 };
  const id = String(raw.id || '');
  const defaultConnectionPoints = id
    ? [
        { id: `${id}-input`, type: 'input' as const, position: { x: 0, y: -size.height / 2 } },
        { id: `${id}-output`, type: 'output' as const, position: { x: 0, y: size.height / 2 } },
      ]
    : [];

  const node: Node = {
    id,
    position: raw.position || { x: 0, y: 0 },
    size,
    tag,
    text: typeof raw.text === 'string' ? raw.text : '',
    actor: typeof raw.actor === 'string' ? raw.actor : undefined,
    childCount: typeof raw.childCount === 'number' ? raw.childCount : undefined,
    backgroundColor,
    connectionPoints:
      Array.isArray(raw.connectionPoints) && raw.connectionPoints.length > 0
        ? raw.connectionPoints
        : defaultConnectionPoints,
    metadata: raw.metadata,
  };

  // Ensure dialogue actor exists (UI expects string)
  if (node.tag === 'dialogue' && node.actor == null) node.actor = '';
  if (node.tag === 'choiceFlag' && typeof node.childCount !== 'number') node.childCount = 0;
  if (node.tag === 'root') node.text = '对话开始';
  // Non-dialogue: actor is not used
  if (node.tag !== 'dialogue') node.actor = undefined;
  if (node.tag !== 'choiceFlag') node.childCount = undefined;

  return node;
}

export function getNodeDisplayText(node: Node): string {
  if (node.tag === 'root') {
    return '对话开始';
  }
  if (node.tag === 'choiceFlag') {
    return `选项数量：${node.childCount ?? 0}`;
  }
  if (node.tag === 'dialogue') {
    const actor = (node.actor || '').trim();
    if (actor) return `${actor}\n${node.text || ''}`.trimEnd();
  }
  return node.text || '';
}


