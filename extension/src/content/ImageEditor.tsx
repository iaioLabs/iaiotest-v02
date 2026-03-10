import React, { useState, useRef } from 'react';
import { Rnd } from 'react-rnd';

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
    bg: '#050810',
    surface: '#080d1a',
    cyan: '#00f0ff',
    violet: '#7b5cff',
    magenta: '#ff3cac',
    text: '#e8eaf6',
    muted: '#5a6080',
    border: 'rgba(0,240,255,0.1)',
} as const;

interface ImageEditorProps {
    screenshot: string;
    onClose: () => void;
    onSave?: (editedImage: string) => void;
}

type AnnotationType = 'box' | 'arrow' | 'text';

interface Annotation {
    id: string;
    type: AnnotationType;
    x: number;
    y: number;
    width: number | string;
    height: number | string;
    text?: string;
}

const mergeCanvas = async (originalSrc: string, annotations: Annotation[], containerRef: React.RefObject<HTMLDivElement>): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            if (!containerRef.current) return resolve(originalSrc);
            
            const containerBox = containerRef.current.getBoundingClientRect();
            
            const imgRatio = img.naturalWidth / img.naturalHeight;
            const containerRatio = containerBox.width / containerBox.height;
            
            let drawWidth = containerBox.width;
            let drawHeight = containerBox.height;
            let offsetX = 0;
            let offsetY = 0;

            if (imgRatio > containerRatio) {
                // Image is wider than container, height is constrained
                drawHeight = drawWidth / imgRatio;
                offsetY = (containerBox.height - drawHeight) / 2;
            } else {
                // Image is taller than container, width is constrained
                drawWidth = drawHeight * imgRatio;
                offsetX = (containerBox.width - drawWidth) / 2;
            }
            
            const scaleX = img.naturalWidth / drawWidth;
            const scaleY = img.naturalHeight / drawHeight;
            
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(originalSrc);

            ctx.drawImage(img, 0, 0);

            annotations.forEach(ann => {
                const ax = ann.x;
                const ay = ann.y;
                let aw = typeof ann.width === 'string' ? parseInt(ann.width) : ann.width;
                let ah = typeof ann.height === 'string' ? parseInt(ann.height) : ann.height;
                if (isNaN(aw)) aw = 100;
                if (isNaN(ah)) ah = 100;

                // For text width that is 'auto'
                if (ann.type === 'text') {
                    aw = Math.max(100, (ann.text?.length || 10) * 15);
                }

                const imgX = (ax - offsetX) * scaleX;
                const imgY = (ay - offsetY) * scaleY;
                const imgW = aw * scaleX;
                const imgH = ah * scaleY;

                ctx.save();
                ctx.lineWidth = Math.max(4 * scaleX, 1);
                ctx.strokeStyle = '#ff3cac'; // C.magenta
                ctx.fillStyle = '#ff3cac';

                if (ann.type === 'box') {
                    ctx.strokeRect(imgX, imgY, imgW, imgH);
                } else if (ann.type === 'arrow') {
                    const startX = imgX;
                    const startY = imgY + imgH / 2;
                    const endX = imgX + imgW;
                    const endY = startY;

                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();

                    const headSize = 14 * scaleX;
                    ctx.beginPath();
                    ctx.moveTo(endX + (2 * scaleX), endY);
                    ctx.lineTo(endX - headSize, endY - (10 * scaleY));
                    ctx.lineTo(endX - headSize, endY + (10 * scaleY));
                    ctx.closePath();
                    ctx.fill();
                } else if (ann.type === 'text') {
                    const fontSize = 24 * scaleY;
                    ctx.font = `bold ${fontSize}px sans-serif`;
                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowBlur = 4 * scaleX;
                    ctx.textBaseline = 'top';
                    ctx.fillText(ann.text || '', imgX, imgY);
                }
                ctx.restore();
            });

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(originalSrc);
        img.src = originalSrc;
    });
};

export default function ImageEditor({ screenshot, onClose, onSave }: ImageEditorProps) {
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    const addAnnotation = (type: AnnotationType) => {
        const newAnn: Annotation = {
            id: Math.random().toString(36).substring(2, 11),
            type,
            x: 50,
            y: 50,
            width: type === 'text' ? 'auto' : 100,
            height: type === 'text' ? 'auto' : 100,
            text: type === 'text' ? 'Type here...' : undefined,
        };
        setAnnotations([...annotations, newAnn]);
    };

    const updateAnnotation = (id: string, updates: Partial<Annotation>) => {
        setAnnotations(annos => annos.map(a => a.id === id ? { ...a, ...updates } : a));
    };

    const renderAnnotation = (ann: Annotation) => {
        const isArrow = ann.type === 'arrow';
        const isText = ann.type === 'text';

        return (
            <Rnd
                key={ann.id}
                bounds="parent"
                size={{ width: ann.width, height: ann.height }}
                position={{ x: ann.x, y: ann.y }}
                onDragStop={(e, d) => updateAnnotation(ann.id, { x: d.x, y: d.y })}
                onResizeStop={(e, direction, ref, delta, position) => {
                    updateAnnotation(ann.id, {
                        width: ref.style.width,
                        height: ref.style.height,
                        ...position,
                    });
                }}
                enableResizing={!isText} // Text size depends on font and content for this simple version
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                }}
            >
                {ann.type === 'box' && (
                    <div style={{ width: '100%', height: '100%', border: `4px solid ${C.magenta}`, borderRadius: '4px' }} />
                )}

                {isArrow && (
                    // Simple CSS arrow stretching to fit the bounds
                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '100%', height: '4px', background: C.magenta }} />
                        <div style={{
                            position: 'absolute', right: '-2px',
                            width: 0, height: 0,
                            borderTop: '10px solid transparent',
                            borderBottom: '10px solid transparent',
                            borderLeft: `14px solid ${C.magenta}`,
                        }} />
                    </div>
                )}

                {isText && (
                    <input
                        autoFocus
                        type="text"
                        value={ann.text}
                        onChange={(e) => updateAnnotation(ann.id, { text: e.target.value })}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: C.magenta,
                            fontSize: '24px',
                            fontWeight: 'bold',
                            fontFamily: 'sans-serif',
                            outline: 'none',
                            textShadow: '0px 0px 4px rgba(0,0,0,0.8)',
                            width: `${Math.max(100, (ann.text?.length || 10) * 15)}px`,
                        }}
                    />
                )}
            </Rnd>
        );
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(5, 8, 16, 0.95)',
                zIndex: 2147483647 + 1, // Higher than Panel to appear over it
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                boxSizing: 'border-box',
                backdropFilter: 'blur(8px)',
            }}
        >
            {/* ── Toolbar ── */}
            <div
                style={{
                    position: 'absolute',
                    top: '24px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '12px',
                    background: C.surface,
                    padding: '8px',
                    borderRadius: '12px',
                    border: `1px solid ${C.border}`,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                }}
            >
                <ToolButton onClick={() => addAnnotation('box')} label="Box ⬜" />
                <ToolButton onClick={() => addAnnotation('arrow')} label="Arrow ↗️" />
                <ToolButton onClick={() => addAnnotation('text')} label="Text T" />
            </div>

            {/* ── Header actions ── */}
            <div
                style={{
                    position: 'absolute',
                    top: '24px',
                    right: '32px',
                    display: 'flex',
                    gap: '16px',
                }}
            >
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: `1px solid ${C.border}`,
                        color: C.text,
                        padding: '8px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                        fontSize: '14px',
                        transition: 'background 0.2s',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
                >
                    Cancel
                </button>
                <button
                    id="apply-btn"
                    onClick={async () => {
                        const btn = document.getElementById('apply-btn') as HTMLButtonElement;
                        if (btn) btn.innerText = 'Applying...';
                        
                        if (onSave && annotations.length > 0) {
                            try {
                                const merged = await mergeCanvas(screenshot, annotations, containerRef);
                                onSave(merged);
                            } catch (e) {
                                console.error('Canvas merge failed', e);
                                onSave(screenshot);
                            }
                        } else if (onSave) {
                            onSave(screenshot);
                        }
                        onClose();
                    }}
                    style={{
                        background: C.magenta,
                        border: 'none',
                        color: '#fff',
                        fontWeight: 700,
                        padding: '8px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                        fontSize: '14px',
                        transition: 'opacity 0.2s',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
                    onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
                >
                    Apply Changes
                </button>
            </div>

            {/* ── Image Workspace ── */}
            <div
                ref={containerRef}
                style={{
                    position: 'relative',
                    maxWidth: '90%',
                    maxHeight: '80vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                    border: `1px solid rgba(255,60,172,0.2)`, // Magenta subtle hint
                    boxShadow: '0 0 40px rgba(0,0,0,0.8)',
                    userSelect: 'none',
                }}
            >
                <img
                    src={screenshot}
                    alt="Screenshot to edit"
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        display: 'block',
                        pointerEvents: 'none', // Allow RND to be dragged over it easily
                    }}
                />

                {/* Render Annotations Overlay */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                    {annotations.map(renderAnnotation)}
                </div>
            </div>
        </div>
    );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function ToolButton({ onClick, label }: { onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            style={{
                background: 'transparent',
                border: 'none',
                color: C.text,
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                transition: 'background 0.2s, color 0.2s',
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255,60,172,0.1)';
                e.currentTarget.style.color = C.magenta;
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = C.text;
            }}
            title={`Add ${label}`}
        >
            {label}
        </button>
    );
}
