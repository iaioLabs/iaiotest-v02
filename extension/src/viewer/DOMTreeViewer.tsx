import React, { useState } from 'react';

/**
 * Colors and Theme Constants (iaioLabs Style)
 */
const C = {
    tag: '#00f0ff', // Cyan
    attr: '#7b5cff', // Violet
    value: '#ff3cac', // Pink
    text: '#e8eaf6', // Off-white
    muted: '#5a6080', // Blue-grey
    bg: '#050810',   // Deep Navy
    border: 'rgba(0, 240, 255, 0.12)',
};

interface DOMTreeViewerProps {
    domString: string;
}

interface TreeNode {
    id: string;
    type: number; // Node types (ELEMENT_NODE, TEXT_NODE, etc)
    name: string;
    attributes: { name: string; value: string }[];
    content?: string;
    children: TreeNode[];
}

/**
 * DOMTreeViewer Component
 * Renders a hierarchical, interactive tree of a DOM fragment.
 */
const DOMTreeViewer: React.FC<DOMTreeViewerProps> = ({ domString }) => {
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));

    // Parse the DOM string into a basic JSON tree structure
    const tree = React.useMemo(() => {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(domString, 'text/html');
            const body = doc.body;

            const parseNode = (node: Node, path: string): TreeNode | null => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent?.trim();
                    if (!text) return null;
                    return {
                        id: path,
                        type: node.nodeType,
                        name: '#text',
                        attributes: [],
                        content: text,
                        children: [],
                    };
                }

                if (node.nodeType !== Node.ELEMENT_NODE) return null;

                const element = node as Element;
                return {
                    id: path,
                    type: node.nodeType,
                    name: element.tagName.toLowerCase(),
                    attributes: Array.from(element.attributes).map(a => ({ name: a.name, value: a.value })),
                    children: Array.from(element.childNodes)
                        .map((c, i) => parseNode(c, `${path}-${i}`))
                        .filter(Boolean) as TreeNode[],
                };
            };

            return Array.from(body.childNodes)
                .map((n, i) => parseNode(n, `root-${i}`))
                .filter(Boolean) as TreeNode[];
        } catch (e) {
            console.error('Failed to parse DOM', e);
            return [];
        }
    }, [domString]);

    const toggleNode = (id: string) => {
        const next = new Set(expandedNodes);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedNodes(next);
    };

    const renderNode = (node: TreeNode, depth: number) => {
        const isExpanded = expandedNodes.has(node.id);
        const hasChildren = node.children.length > 0;

        if (node.type === Node.TEXT_NODE) {
            return (
                <div key={node.id} style={{ paddingLeft: '24px', color: C.text, opacity: 0.7, margin: '2px 0' }}>
                    "{node.content}"
                </div>
            );
        }

        return (
            <div key={node.id} style={{ paddingLeft: depth === 0 ? 0 : '16px' }}>
                <div
                    onClick={() => hasChildren && toggleNode(node.id)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: hasChildren ? 'pointer' : 'default',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        transition: 'background 0.2s',
                        whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => hasChildren && (e.currentTarget.style.background = 'rgba(0, 240, 255, 0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    {hasChildren && (
                        <span style={{
                            display: 'inline-block',
                            width: '12px',
                            marginRight: '4px',
                            transform: isExpanded ? 'rotate(90deg)' : 'none',
                            transition: 'transform 0.15s',
                            color: C.muted,
                            fontSize: '10px'
                        }}>
                            ▶
                        </span>
                    )}
                    {!hasChildren && <span style={{ width: '16px' }} />}

                    <span style={{ color: C.tag }}>&lt;{node.name}</span>
                    {node.attributes.map(attr => (
                        <React.Fragment key={attr.name}>
                            <span style={{ color: C.attr, marginLeft: '8px' }}> {attr.name}</span>
                            <span style={{ color: C.tag }}>=</span>
                            <span style={{ color: C.value }}>"{attr.value}"</span>
                        </React.Fragment>
                    ))}
                    <span style={{ color: C.tag }}>&gt;</span>

                    {!isExpanded && hasChildren && <span style={{ color: C.muted, margin: '0 4px' }}>...</span>}
                    {!isExpanded && hasChildren && <span style={{ color: C.tag }}>&lt;/{node.name}&gt;</span>}
                </div>

                {isExpanded && hasChildren && (
                    <div style={{ borderLeft: `1px solid rgba(0, 240, 255, 0.08)`, marginLeft: '10px' }}>
                        {node.children.map(child => renderNode(child, depth + 1))}
                    </div>
                )}

                {isExpanded && hasChildren && (
                    <div style={{ paddingLeft: '16px', color: C.tag }}>
                        &lt;/{node.name}&gt;
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: '13px',
            color: C.text,
            lineHeight: '1.5'
        }}>
            {tree.map(node => renderNode(node, 0))}
        </div>
    );
};

export default DOMTreeViewer;
