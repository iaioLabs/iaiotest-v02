import React, { useState, useMemo } from 'react'

interface InteractiveInspectorProps {
    domString: string
}

const C = {
    tag: '#00f0ff',
    attr: '#7b5cff',
    value: '#ff3cac',
    text: '#e8eaf6',
    muted: '#5a6080',
    bg: '#050810',
}

interface NodeProps {
    node: Node
    depth: number
}

const InspectorNode: React.FC<NodeProps> = ({ node, depth }) => {
    const [isExpanded, setIsExpanded] = useState(depth < 2)

    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim()
        if (!text) return null
        return (
            <div style={{ paddingLeft: '20px', color: C.text, fontSize: '12px', opacity: 0.8, margin: '2px 0' }}>
                {text}
            </div>
        )
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return null

    const element = node as Element
    const tagName = element.tagName.toLowerCase()
    const attributes = Array.from(element.attributes)
    const hasChildren = element.childNodes.length > 0 && Array.from(element.childNodes).some(n => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()))

    return (
        <div style={{ paddingLeft: depth === 0 ? 0 : '16px', fontFamily: "'Space Mono', monospace" }}>
            <div
                onClick={() => hasChildren && setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: hasChildren ? 'pointer' : 'default',
                    fontSize: '12px',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    transition: 'background 0.2s',
                }}
                onMouseOver={e => hasChildren && (e.currentTarget.style.background = 'rgba(0,240,255,0.05)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
            >
                {hasChildren && (
                    <span style={{
                        display: 'inline-block',
                        width: '12px',
                        marginRight: '4px',
                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s',
                        color: C.muted,
                        fontSize: '10px'
                    }}>
                        ▶
                    </span>
                )}
                {!hasChildren && <span style={{ width: '16px' }} />}

                <span style={{ color: C.tag }}>&lt;{tagName}</span>
                {attributes.map(attr => (
                    <React.Fragment key={attr.name}>
                        <span style={{ color: C.attr, marginLeft: '8px' }}> {attr.name}</span>
                        <span style={{ color: C.tag }}>=</span>
                        <span style={{ color: C.value }}>"{attr.value}"</span>
                    </React.Fragment>
                ))}
                <span style={{ color: C.tag }}>&gt;</span>

                {!isExpanded && hasChildren && (
                    <span style={{ color: C.muted, marginLeft: '4px' }}>...</span>
                )}
                {!isExpanded && hasChildren && (
                    <span style={{ color: C.tag }}>&lt;/{tagName}&gt;</span>
                )}
            </div>

            {isExpanded && hasChildren && (
                <div style={{ borderLeft: `1px solid rgba(90,96,128,0.2)`, marginLeft: '10px' }}>
                    {Array.from(element.childNodes).map((child, i) => (
                        <InspectorNode key={i} node={child} depth={depth + 1} />
                    ))}
                </div>
            )}

            {isExpanded && hasChildren && (
                <div style={{ paddingLeft: '16px', fontSize: '12px', color: C.tag }}>
                    &lt;/{tagName}&gt;
                </div>
            )}
        </div>
    )
}

const InteractiveInspector: React.FC<InteractiveInspectorProps> = ({ domString }) => {
    const parsedDoc = useMemo(() => {
        try {
            const parser = new DOMParser()
            const doc = parser.parseFromString(domString, 'text/html')
            return doc.body
        } catch (e) {
            console.error('Failed to parse DOM string', e)
            return null
        }
    }, [domString])

    if (!parsedDoc) {
        return <div style={{ color: C.muted, fontSize: '13px' }}>Invalid DOM fragment.</div>
    }

    return (
        <div style={{
            background: C.bg,
            color: C.text,
            padding: '16px',
            borderRadius: '8px',
            fontSize: '13px',
            overflowX: 'auto',
            maxHeight: '100%',
        }}>
            {Array.from(parsedDoc.childNodes).map((node, i) => (
                <InspectorNode key={i} node={node} depth={0} />
            ))}
        </div>
    )
}

export default InteractiveInspector
