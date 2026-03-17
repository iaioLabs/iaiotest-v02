import React, { useState, useEffect } from 'react';
import DOMTreeViewer from './DOMTreeViewer';
import ConsoleViewer from './ConsoleViewer';

const C = {
    bg: '#050810',
    panel: '#080d1a',
    accent: '#00f0ff',
    border: 'rgba(0, 240, 255, 0.12)',
    text: '#e8eaf6',
    muted: '#5a6080',
};

const ReportViewer: React.FC = () => {
    const [report, setReport] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'console' | 'network' | 'dom'>('info');

    useEffect(() => {
        // In production, the data might be injected into window.__REPORT_DATA__
        // For now, we fetch from the API using the ID in the URL
        // Determine ID from query param OR path
        const params = new URLSearchParams(window.location.search);
        let id = params.get('id');

        // Fallback: extract from path (/report/ID)
        if (!id) {
            const pathParts = window.location.pathname.split('/');
            id = pathParts[pathParts.length - 1];
        }

        if (id && id !== 'report') {
            fetch(`/api/report/${id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) setReport(data.report);
                })
                .catch(err => console.error('Error loading report', err));
        }
    }, []);

    if (!report) {
        return (
            <div style={{ background: C.bg, color: C.accent, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Mono', monospace" }}>
                LOADING REPORT...
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', height: '100vh', background: C.bg, color: C.text, fontFamily: "'Inter', sans-serif" }}>
            {/* Left Panel: Info & Screenshot */}
            <div style={{ width: '400px', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', background: C.panel }}>
                <header style={{ padding: '20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '12px', height: '12px', background: C.accent, borderRadius: '2px' }} />
                    <h1 style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>iaio Test</h1>
                </header>

                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Incident Snapshot</div>
                        <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                            <img
                                src={report.screenshotFile ? `/uploads/${report.screenshotFile}` : ''}
                                style={{ width: '100%', display: 'block' }}
                                alt="Bug Screenshot"
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Bug ID</div>
                        <div style={{ color: C.accent, fontFamily: "'Space Mono', monospace", fontSize: '13px' }}>{report.id}</div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Url</div>
                        <div style={{ fontSize: '13px', overflowWrap: 'anywhere' }}>{report.url}</div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>AI Hypothesis</div>
                        <div style={{ fontSize: '12px', color: C.accent, lineHeight: '1.6', background: 'rgba(0, 240, 255, 0.05)', padding: '12px', borderRadius: '4px', border: `1px solid rgba(0, 240, 255, 0.1)` }}>
                            {report.aiSuggestion || "No AI suggestion available."}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel: Interactive Tabs */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <nav style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.panel }}>
                    {(['info', 'console', 'network', 'dom'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '16px 24px',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: activeTab === tab ? `2px solid ${C.accent}` : '2px solid transparent',
                                color: activeTab === tab ? C.accent : C.muted,
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>

                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                    {activeTab === 'dom' && (
                        <div style={{ height: '100%', overflow: 'auto', padding: '24px' }}>
                            <DOMTreeViewer domString={report.dom} />
                        </div>
                    )}
                    {activeTab === 'console' && (
                        <ConsoleViewer logs={report.consoleLogs} />
                    )}
                    {activeTab === 'network' && (
                        <ConsoleViewer logs={report.networkLogs} />
                    )}
                    {activeTab === 'info' && (
                        <div style={{ padding: '40px', maxWidth: '600px' }}>
                            <h2 style={{ fontSize: '24px', color: C.accent, marginBottom: '16px' }}>{report.title}</h2>
                            <p style={{ color: C.text, lineHeight: '1.8', opacity: 0.9 }}>{report.notes || "No additional notes provided."}</p>

                            <div style={{ marginTop: '40px', borderTop: `1px solid ${C.border}`, paddingTop: '20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div>
                                        <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', marginBottom: '4px' }}>Platform</div>
                                        <div style={{ fontSize: '13px' }}>{report.systemInfo?.platform || 'Unknown'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', marginBottom: '4px' }}>Resolution</div>
                                        <div style={{ fontSize: '13px' }}>{report.resolution}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportViewer;
