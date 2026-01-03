/**
 * Property panel for editing selected node and edge properties
 */

import React, { useState } from 'react';
import { Node, Edge, NodeTag } from '../models/types';
import { NODE_TAGS, NODE_TAGS_SELECTABLE, getTagColor } from '../models/nodeTag';

interface PropertyPanelProps {
  node: Node | null;
  edge: Edge | null;
  onNodeUpdate: (nodeId: string, updates: Partial<Node>) => void;
  onNodeDelete: (nodeId: string) => void;
  onEdgeUpdate: (edgeId: string, updates: Partial<Edge>) => void;
  onEdgeDelete: (edgeId: string) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  node,
  edge,
  onNodeUpdate,
  onNodeDelete,
  onEdgeUpdate,
  onEdgeDelete,
}) => {
  const [textAreaHeight, setTextAreaHeight] = useState(80);

  // Show edge properties if edge is selected
  if (edge && !node) {
    return (
      <div style={{ padding: '14px' }}>
        <div className="panelHeader" style={{ margin: '-14px -14px 12px -14px' }}>
          <span>属性</span>
          <span style={{ fontSize: '11px', color: 'var(--vscode-fg-muted)' }}>连接</span>
        </div>
        <h3 style={{ marginTop: 0, color: 'var(--vscode-fg)' }}>连接属性</h3>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            颜色
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[
              { name: '默认', color: '#666' },
              { name: '蓝色', color: '#2196f3' },
              { name: '绿色', color: '#4caf50' },
              { name: '红色', color: '#f44336' },
              { name: '橙色', color: '#ff9800' },
              { name: '紫色', color: '#9c27b0' },
              { name: '粉色', color: '#e91e63' },
              { name: '青色', color: '#00bcd4' },
            ].map((colorOption) => (
              <button
                key={colorOption.color}
                onClick={() => {
                  const current = edge.color || '#666';
                  if (current === colorOption.color) return;
                  onEdgeUpdate(edge.id, { color: colorOption.color });
                }}
                style={{
                  flex: '1 1 calc(25% - 6px)',
                  minWidth: '60px',
                  height: '32px',
                  backgroundColor: colorOption.color,
                  border: (edge.color || '#666') === colorOption.color ? '3px solid #2196f3' : '2px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: (edge.color || '#666') === colorOption.color ? '0 2px 4px rgba(33, 150, 243, 0.3)' : 'none',
                }}
                title={colorOption.name}
              />
            ))}
          </div>
        </div>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
          <button
            onClick={() => {
              if (confirm('确定要删除这条连接吗？')) {
                onEdgeDelete(edge.id);
              }
            }}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            删除连接
          </button>
        </div>

        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <div>连接 ID: {edge.id}</div>
          </div>
        </div>
      </div>
    );
  }

  // Show node properties if node is selected
  if (node) {
    return (
      <div style={{ padding: '14px' }}>
        <div className="panelHeader" style={{ margin: '-14px -14px 12px -14px' }}>
          <span>属性</span>
          <span style={{ fontSize: '11px', color: 'var(--vscode-fg-muted)' }}>节点</span>
        </div>
        <h3 style={{ marginTop: 0, color: 'var(--vscode-fg)' }}>节点属性</h3>

        {node.tag === 'root' ? (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
              根节点（Root）
            </label>
            <div style={{ fontSize: '12px', color: 'var(--vscode-fg-muted)' }}>
              该节点为每张流程图的唯一入口：<b>对话开始</b>。不可新建、不可修改类型/内容，仅允许移动与缩放。
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
              类型（Tag）
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {NODE_TAGS_SELECTABLE.map((t) => {
                const active = node.tag === t.tag;
                return (
                  <button
                    key={t.tag}
                    onClick={() => {
                      if (node.tag === t.tag) return;
                      const updates: Partial<Node> = {
                        tag: t.tag as NodeTag,
                        backgroundColor: getTagColor(t.tag),
                      };
                      // Only dialogue node has actor
                      if (t.tag === 'dialogue') {
                        updates.actor = node.actor ?? '';
                      } else {
                        updates.actor = undefined;
                      }
                      onNodeUpdate(node.id, updates);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: active ? '2px solid #2196f3' : '1px solid #ddd',
                      background: 'var(--vscode-panel-bg, #fff)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      boxShadow: active ? '0 2px 4px rgba(33, 150, 243, 0.2)' : 'none',
                    }}
                    title={t.label}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        backgroundColor: t.color,
                        border: '1px solid rgba(0,0,0,0.12)',
                        flex: '0 0 auto',
                      }}
                    />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>
              提示：节点颜色用于表示 Tag，不同颜色代表不同类型。
            </div>
          </div>
        )}

        {node.tag === 'dialogue' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              角色（Actor）
            </label>
            <input
              type="text"
              value={node.actor ?? ''}
              onChange={(e) => onNodeUpdate(node.id, { actor: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
              }}
              placeholder="例如：旁白 / NPC 名称 / 角色名"
            />
            <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
              提示：Actor 为单行文本。
            </div>
          </div>
        )}

        {node.tag === 'root' ? null : node.tag === 'choiceFlag' ? (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              选项数量
            </label>
            <div
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                background: 'rgba(0,0,0,0.02)',
              }}
              title="该数量由从该节点出发的连线数量自动计算"
            >
              {node.childCount ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
              提示：该值由“从本节点出发的连线数量”自动计算，无需手动编辑。
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              {node.tag === 'dialogue' ? '台词（Line）' : '文本'}
            </label>
            <div style={{ position: 'relative' }}>
              <textarea
                value={node.text}
                onChange={(e) => onNodeUpdate(node.id, { text: e.target.value })}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.max(80, Math.min(300, target.scrollHeight))}px`;
                  setTextAreaHeight(Math.max(80, Math.min(300, target.scrollHeight)));
                }}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  maxHeight: '300px',
                  height: `${textAreaHeight}px`,
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  overflowY: 'auto',
                }}
                placeholder="输入文本（支持换行）"
              />
              <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                提示：按 Enter 换行，可拖拽右下角调整大小
              </div>
            </div>
          </div>
        )}

        {/* 宽高属性已移除：请在画布上使用缩放点调整节点大小 */}

        {node.tag === 'root' ? null : (
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
            <button
              onClick={() => {
                if (confirm('确定要删除这个节点吗？')) {
                  onNodeDelete(node.id);
                }
              }}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              删除节点
            </button>
          </div>
        )}

        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <div>节点 ID: {node.id}</div>
            <div style={{ marginTop: '4px' }}>Tag: {NODE_TAGS.find((t) => t.tag === node.tag)?.label || node.tag}</div>
            <div style={{ marginTop: '4px' }}>
              位置: ({Math.round(node.position.x)}, {Math.round(node.position.y)})
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default empty state
  return (
    <div style={{ padding: '14px' }}>
      <div className="panelHeader" style={{ margin: '-14px -14px 12px -14px' }}>
        <span>属性</span>
        <span />
      </div>
      <h3 style={{ marginTop: 0, color: 'var(--vscode-fg)' }}>属性</h3>
      <p style={{ color: 'var(--vscode-fg-muted)' }}>选择一个节点或连接以编辑其属性</p>
    </div>
  );
};
