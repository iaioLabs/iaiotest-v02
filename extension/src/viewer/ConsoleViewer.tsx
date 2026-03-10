import React from 'react';

const C = {
    error: '#ff3cac',
    warn: '#fb923c',
    info: '#00f0ff',
    text: '#e8eaf6',
    muted: '#5a6080',
};

interface ConsoleViewerProps {
    logs: string; // Plain text or stringified logs
}

/**
 * ConsoleViewer Component
 * Renders logs with severity-based coloring.
 */
const ConsoleViewer: React.FC<ConsoleViewerProps> = ({ logs }) => {
    const lines = React.useMemo(() => {
        if (!logs) return [];
        return logs.split('\n').filter(line => line.trim());
    }, [logs]);

    const getLogStyle = (line: string) => {
        const upper = line.toUpperCase();
        if (upper.includes('ERROR') || upper.includes('FAILED')) return { color: C.error, borderLeft: `2px solid ${C.error}` };
        if (upper.includes('WARN')) return { color: C.warn, borderLeft: `2px solid ${C.warn}` };
        return { color: C.info, borderLeft: `2px solid rgba(0, 240, 255, 0.2)` };
    };

    return (
        <div style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: '12px',
            background: '#050810',
            padding: '12px',
            height: '100%',
            overflowY: 'auto'
        }}>
            {lines.length === 0 ? (
                <div style={{ color: C.muted }}>No logs captured in this report.</div>
            ) : (
                lines.map((line, i) => (
                    <div key={i} style={{
                        ...getLogStyle(line),
                        padding: '4px 12px',
                        marginBottom: '2px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                    }}>
                        {line}
                    </div>
                ))
            )}
        </div>
    );
};

export default ConsoleViewer;
