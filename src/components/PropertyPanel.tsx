/**
 * Property panel for editing selected node and edge properties
 */

import React, { useState } from 'react';
import { Node, Edge } from '../models/types';

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
                onClick={() => onEdgeUpdate(edge.id, { color: colorOption.color })}
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

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            文本
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

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            背景颜色
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[
              { name: '浅蓝', color: '#e3f2fd' },
              { name: '浅绿', color: '#e8f5e9' },
              { name: '浅黄', color: '#fff9c4' },
              { name: '浅橙', color: '#ffe0b2' },
              { name: '浅粉', color: '#fce4ec' },
              { name: '浅紫', color: '#f3e5f5' },
              { name: '白色', color: '#ffffff' },
              { name: '浅灰', color: '#f5f5f5' },
            ].map((colorOption) => (
              <button
                key={colorOption.color}
                onClick={() => onNodeUpdate(node.id, { backgroundColor: colorOption.color })}
                style={{
                  flex: '1 1 calc(25% - 6px)',
                  minWidth: '60px',
                  height: '32px',
                  backgroundColor: colorOption.color,
                  border: node.backgroundColor === colorOption.color ? '3px solid #2196f3' : '2px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: node.backgroundColor === colorOption.color ? '0 2px 4px rgba(33, 150, 243, 0.3)' : 'none',
                }}
                title={colorOption.name}
              />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            宽度
          </label>
          <input
            type="number"
            value={node.size.width}
            onChange={(e) =>
              onNodeUpdate(node.id, { size: { ...node.size, width: parseInt(e.target.value) || 150 } })
            }
            min="50"
            max="500"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            高度
          </label>
          <input
            type="number"
            value={node.size.height}
            onChange={(e) =>
              onNodeUpdate(node.id, { size: { ...node.size, height: parseInt(e.target.value) || 80 } })
            }
            min="50"
            max="500"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
        </div>

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

        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <div>节点 ID: {node.id}</div>
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
