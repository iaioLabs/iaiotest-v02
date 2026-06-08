import React, { useState, useEffect } from 'react';
import { supabase, waitForStorage } from '../lib/supabase';
import DOMTreeViewer from './DOMTreeViewer';
import ConsoleViewer from './ConsoleViewer';

const C = {
    bg: '#050810',
    panel: '#080d1a',
    accent: '#00f0ff',
    border: 'rgba(0, 240, 255, 0.12)',
    text: '#e8eaf6',
    muted: '#5a6080',
    error: '#ff3cac',
};

// IAIO Labs Logo placeholder
function IaioImgPlaceholder() {
    return (
        <div style={{
            width: '100%', height: 200,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            background: 'rgba(0,240,255,0.03)',
        }}>
            <svg viewBox="0 0 100 100" style={{ width: 44, height: 44, opacity: 0.35 }}>
                <g>
                    <line x1="10" y1="40" x2="40" y2="40" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
                    <line x1="5" y1="55" x2="35" y2="55" stroke="#7C3AED" strokeWidth="8" strokeLinecap="round" />
                    <line x1="10" y1="70" x2="40" y2="70" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
                </g>
                <path d="M45 55 L60 70 L90 30" stroke="#10B981" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 11, color: C.muted, letterSpacing: '0.06em' }}>Sin captura disponible</span>
        </div>
    );
}

const ReportViewer: React.FC = () => {
    const [issue, setIssue] = useState<any>(null);
    const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
    const [screenshotError, setScreenshotError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'console' | 'network' | 'dom'>('info');

    useEffect(() => {
        async function loadIssue() {
            try {
                // ── Step 1: Get issue ID from query param ──
                const params = new URLSearchParams(window.location.search);
                const id = params.get('id');

                if (!id || id === 'undefined') {
                    console.error('[ReportViewer] No issue ID found in URL params.');
                    setError('No se encontró el ID del reporte en la URL.');
                    setLoading(false);
                    return;
                }



                // ── Step 2: Boot session from URL hash tokens (passed by Panel) ──
                const hash = window.location.hash.substring(1);
                if (hash) {
                    const hashParams = new URLSearchParams(hash);
                    const at = hashParams.get('at');
                    const rt = hashParams.get('rt');
                    if (at && rt) {

                        const { error: sessionError } = await supabase.auth.setSession({
                            access_token: decodeURIComponent(at),
                            refresh_token: decodeURIComponent(rt),
                        });
                        if (sessionError) {
                            console.warn('[ReportViewer] setSession from URL failed:', sessionError.message);
                        }
                    }
                    history.replaceState(null, '', window.location.pathname + window.location.search);
                }

                // ── Step 3: Ensure storage/session is ready ──
                await waitForStorage();
                const { data: { session } } = await supabase.auth.getSession();


                // ── Step 4: Fetch the issue from Supabase ──

                const { data, error: fetchError } = await supabase
                    .from('issues')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (fetchError) {
                    console.error('[ReportViewer] Supabase fetch error:', fetchError.message, '| Code:', fetchError.code);
                    if (fetchError.code === 'PGRST116') {
                        setError('Reporte no encontrado. Puede que no tengas permiso para verlo o el ID sea incorrecto.');
                    } else {
                        setError(`Error al cargar el reporte: ${fetchError.message}`);
                    }
                    setLoading(false);
                    return;
                }

                if (!data) {
                    console.warn('[ReportViewer] Query returned no data for ID:', id);
                    setError('Reporte no encontrado.');
                    setLoading(false);
                    return;
                }


                setIssue(data);

                // ── Step 5: Resolve screenshot URL ──
                if (data.screenshot_url) {

                    setScreenshotUrl(data.screenshot_url);
                } else if (data.screenshot_path) {

                    const { data: signedData, error: signedError } = await supabase.storage
                        .from('screenshots')
                        .createSignedUrl(data.screenshot_path, 3600);

                    if (signedError) {
                        console.warn('[ReportViewer] Signed URL error:', signedError.message);
                        setScreenshotError(true);
                    } else {

                        setScreenshotUrl(signedData.signedUrl);
                    }
                } else {

                    setScreenshotError(true);
                }

                setLoading(false);
            } catch (err: any) {
                console.error('[ReportViewer] Unexpected error:', err);
                setError('Error inesperado: ' + err.message);
                setLoading(false);
            }
        }

        loadIssue();
    }, []);

    // ── Loading state ──────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{
                background: C.bg, color: C.accent, height: '100vh',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 16, fontFamily: "'Space Mono', monospace",
            }}>
                <div style={{
                    width: 40, height: 40,
                    border: `3px solid rgba(0,240,255,0.2)`,
                    borderTopColor: C.accent,
                    borderRadius: '50%',
                    animation: 'rv-spin 1s linear infinite',
                }} />
                <style>{`@keyframes rv-spin { to { transform: rotate(360deg); } }`}</style>
                <span style={{ fontSize: 12, letterSpacing: '0.1em', opacity: 0.7 }}>CARGANDO REPORTE...</span>
            </div>
        );
    }

    // ── Error state ────────────────────────────────────────────────────────────
    if (error || !issue) {
        return (
            <div style={{
                background: C.bg, height: '100vh',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 16, padding: 40, textAlign: 'center',
            }}>
                <svg viewBox="0 0 100 100" style={{ width: 56, height: 56, marginBottom: 8 }}>
                    <g>
                        <line x1="10" y1="40" x2="40" y2="40" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
                        <line x1="5" y1="55" x2="35" y2="55" stroke="#7C3AED" strokeWidth="8" strokeLinecap="round" />
                        <line x1="10" y1="70" x2="40" y2="70" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
                    </g>
                    <path d="M45 55 L60 70 L90 30" stroke="#10B981" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h2 style={{ color: C.error, fontFamily: "'Inter', sans-serif", fontSize: 18, margin: 0 }}>
                    Error al cargar el reporte
                </h2>
                <p style={{ color: C.muted, fontFamily: "'Inter', sans-serif", fontSize: 13, maxWidth: 400, lineHeight: 1.6 }}>
                    {error || 'No se pudo obtener la información del reporte. Intentá abrirlo nuevamente desde el Dashboard.'}
                </p>
                <button
                    onClick={() => window.close()}
                    style={{
                        padding: '10px 20px', borderRadius: 8, border: `1px solid ${C.border}`,
                        background: 'transparent', color: C.muted, cursor: 'pointer',
                        fontFamily: "'Inter', sans-serif", fontSize: 13, marginTop: 8,
                    }}
                >
                    Cerrar
                </button>
            </div>
        );
    }

    // ── Severity badge color ───────────────────────────────────────────────────
    const severityColor = issue.severity === 'high'
        ? '#ef4444' : issue.severity === 'medium'
        ? '#f59e0b' : '#10b981';

    // ── Full report view ───────────────────────────────────────────────────────
    return (
        <div style={{ display: 'flex', height: '100vh', background: C.bg, color: C.text, fontFamily: "'Inter', sans-serif" }}>
            {/* Left Panel: Info & Screenshot */}
            <div style={{ width: '400px', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', background: C.panel }}>
                <header style={{ padding: '20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <svg viewBox="0 0 100 100" style={{ width: 20, height: 20 }}>
                        <g>
                            <line x1="10" y1="40" x2="40" y2="40" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
                            <line x1="5" y1="55" x2="35" y2="55" stroke="#7C3AED" strokeWidth="8" strokeLinecap="round" />
                            <line x1="10" y1="70" x2="40" y2="70" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
                        </g>
                        <path d="M45 55 L60 70 L90 30" stroke="#10B981" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <h1 style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>iaio Test</h1>
                    <span style={{
                        marginLeft: 'auto',
                        fontSize: 10, fontWeight: 700, padding: '3px 8px',
                        borderRadius: 12, border: `1px solid ${severityColor}`,
                        color: severityColor, textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                        {issue.severity}
                    </span>
                </header>

                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    {/* Screenshot */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                            Incident Snapshot
                        </div>
                        {screenshotUrl && !screenshotError ? (
                            <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                                <img
                                    src={screenshotUrl}
                                    style={{ width: '100%', display: 'block' }}
                                    alt="Bug Screenshot"
                                    onError={() => {
                                        console.warn('[ReportViewer] Screenshot image failed to render — showing placeholder.');
                                        setScreenshotError(true);
                                    }}
                                />
                            </div>
                        ) : (
                            <IaioImgPlaceholder />
                        )}
                    </div>

                    {/* Bug ID */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Bug ID</div>
                        <div style={{ color: C.accent, fontFamily: "'Space Mono', monospace", fontSize: '11px', wordBreak: 'break-all' }}>{issue.id}</div>
                    </div>

                    {/* URL */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>URL</div>
                        <div style={{ fontSize: '12px', overflowWrap: 'anywhere', color: C.text, opacity: 0.85 }}>{issue.url}</div>
                    </div>

                    {/* AI Analysis */}
                    {issue.ai_analysis && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>AI Analysis</div>
                            <div style={{
                                fontSize: '12px', color: C.accent, lineHeight: '1.6',
                                background: 'rgba(0, 240, 255, 0.05)', padding: '12px',
                                borderRadius: '4px', border: `1px solid rgba(0, 240, 255, 0.1)`,
                            }}>
                                {issue.ai_analysis}
                            </div>
                        </div>
                    )}

                    {/* Browser Info */}
                    {issue.browser_info && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Device Info</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {issue.browser_info.screen && (
                                    <div style={{ fontSize: '12px', color: C.text, opacity: 0.8 }}>
                                        📐 {issue.browser_info.screen}
                                    </div>
                                )}
                                {issue.browser_info.language && (
                                    <div style={{ fontSize: '12px', color: C.text, opacity: 0.8 }}>
                                        🌐 {issue.browser_info.language}
                                    </div>
                                )}
                                {issue.browser_info.isMobile !== undefined && (
                                    <div style={{ fontSize: '12px', color: C.text, opacity: 0.8 }}>
                                        {issue.browser_info.isMobile ? '📱 Mobile' : '🖥️ Desktop'}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Tabs */}
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
                                transition: 'all 0.2s',
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>

                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                    {activeTab === 'info' && (
                        <div style={{ padding: '40px', maxWidth: '600px', overflowY: 'auto', height: '100%' }}>
                            <h2 style={{ fontSize: '22px', color: C.accent, marginBottom: '16px', lineHeight: 1.3 }}>
                                {issue.title}
                            </h2>

                            {issue.description && (
                                <p style={{ color: C.text, lineHeight: '1.8', opacity: 0.9, marginBottom: 32 }}>
                                    {issue.description}
                                </p>
                            )}

                            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '20px', marginTop: 8 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div>
                                        <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', marginBottom: '4px' }}>Severity</div>
                                        <div style={{ fontSize: '13px', color: severityColor, fontWeight: 700 }}>{issue.severity?.toUpperCase()}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', marginBottom: '4px' }}>Reported At</div>
                                        <div style={{ fontSize: '13px' }}>
                                            {new Date(issue.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    {issue.browser_info?.screen && (
                                        <div>
                                            <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', marginBottom: '4px' }}>Resolution</div>
                                            <div style={{ fontSize: '13px' }}>{issue.browser_info.screen}</div>
                                        </div>
                                    )}
                                    <div>
                                        <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', marginBottom: '4px' }}>Device</div>
                                        <div style={{ fontSize: '13px' }}>{issue.browser_info?.isMobile ? 'Mobile' : 'Desktop'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'console' && (
                        <div style={{ height: '100%', overflow: 'hidden' }}>
                            <ConsoleViewer logs={
                                Array.isArray(issue.console)
                                    ? issue.console.map((c: any) => `[${c.timestamp || ''}] [${(c.level || 'LOG').toUpperCase()}] ${c.message || JSON.stringify(c)}`).join('\n')
                                    : ''
                            } />
                        </div>
                    )}

                    {activeTab === 'network' && (
                        <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
                            {(!issue.network || issue.network.length === 0) ? (
                                <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', paddingTop: 60 }}>
                                    No hay registros de red capturados para este reporte.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {issue.network.map((req: any, i: number) => {
                                        const isError = req.status >= 400 || req.error;
                                        return (
                                            <div key={i} style={{
                                                padding: '12px 16px',
                                                border: `1px solid ${isError ? 'rgba(255,60,172,0.3)' : C.border}`,
                                                background: isError ? 'rgba(255,60,172,0.03)' : 'rgba(0,240,255,0.02)',
                                                borderRadius: 8,
                                                display: 'flex',
                                                gap: 16,
                                                alignItems: 'center',
                                                fontSize: 12,
                                                fontFamily: "'Space Mono', monospace"
                                            }}>
                                                <div style={{
                                                    fontWeight: 700,
                                                    color: isError ? C.error : (req.method === 'GET' ? C.accent : '#f59e0b'),
                                                    minWidth: 48
                                                }}>
                                                    {req.method || 'REQ'}
                                                </div>
                                                <div style={{
                                                    color: req.status >= 400 ? C.error : C.muted,
                                                    fontWeight: 700,
                                                    minWidth: 40
                                                }}>
                                                    {req.status || '---'}
                                                </div>
                                                <div style={{
                                                    flex: 1,
                                                    wordBreak: 'break-all',
                                                    color: C.text,
                                                    opacity: 0.9
                                                }}>
                                                    {req.url}
                                                </div>
                                                <div style={{ color: C.muted, fontSize: 10 }}>
                                                    {req.type || 'fetch'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'dom' && (
                        <div style={{ height: '100%', overflow: 'auto', padding: '24px' }}>
                            {issue.dom ? (
                                <DOMTreeViewer domString={issue.dom} />
                            ) : (
                                <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', paddingTop: 60 }}>
                                    No hay snapshot del DOM disponible para este reporte.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportViewer;
