/**
 * Panel.tsx — iaio Test v2
 *
 * Floating React panel injected into the page.
 * Flow: screenshot → AI analysis → fill form → Send Report (email)
 *
 * Auth: none (open endpoints for now — TODO: Bearer token when multi-team)
 *
 * The DevTools data (console, network, DOM) is captured and sent
 * in the report payload but NOT displayed here — it lives in the
 * interactive web report (viewer.html).
 *
 * Design: iaio Labs dark glassmorphism
 */

import { useState, useEffect } from 'react'
import type { LogEntry, NetworkEntry } from './index'
import ImageEditor from './ImageEditor'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Metadata {
  url: string
  resolution: string
  consoleLogs: string
  networkLogs: string
  consoleEntries: LogEntry[]
  networkEntries: NetworkEntry[]
  dom: string
  systemInfo: { userAgent: string; platform: string; language: string }
}

interface PanelProps {
  metadata: Metadata
  onClose: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND = 'http://localhost:3000'
const EMAIL_STORAGE_KEY = 'iaio_report_email'

const C = {
  bg: '#050810',
  surface: '#080d1a',
  cyan: '#00f0ff',
  violet: '#7b5cff',
  magenta: '#ff3cac',
  text: '#e8eaf6',
  muted: '#5a6080',
  border: 'rgba(0,240,255,0.1)',
} as const

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function Panel({ metadata, onClose }: PanelProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [sendMethod, setSendMethod] = useState<'link' | 'email' | 'jira' | 'github' | 'azure' | 'trello'>('link')
  const [email, setEmail] = useState('')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [visible, setVisible] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  // Mount animation
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  // Load saved email
  useEffect(() => {
    chrome.storage.local.get(EMAIL_STORAGE_KEY, (result) => {
      if (result[EMAIL_STORAGE_KEY]) setEmail(result[EMAIL_STORAGE_KEY])
    })
  }, [])

  // Capture screenshot → trigger AI analysis
  useEffect(() => {
    const rootEl = document.getElementById('iaio-panel-root');
    if (rootEl) {
      rootEl.style.opacity = '0';
      rootEl.style.visibility = 'hidden';
    }

    chrome.runtime.sendMessage({ action: 'captureScreenshot' }, (response) => {
      if (rootEl) {
        rootEl.style.opacity = '1';
        rootEl.style.visibility = 'visible';
      }

      if (response?.success && response.screenshot) {
        setScreenshot(response.screenshot)
        runAIAnalysis(response.screenshot)
      } else {
        setAiSuggestion('Screenshot capture failed. Add context manually.')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runAIAnalysis(screenshotData: string) {
    setIsAnalyzing(true)
    try {
      const res = await fetch(`${BACKEND}/analyze-bug`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshot: screenshotData,
          consoleLogs: metadata.consoleLogs,
          networkLogs: metadata.networkLogs,
          url: metadata.url,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('[iaio] /analyze-bug error', res.status, data)
        setAiSuggestion('AI Analysis is warming up...')
        return
      }
      setAiSuggestion(data.suggestion ?? 'No suggestion returned.')
    } catch (err) {
      console.error('[iaio] /analyze-bug network error', err)
      setAiSuggestion('AI Analysis is warming up...')
    } finally {
      setIsAnalyzing(false)
    }
  }

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  function handleEmailBlur() {
    if (email.trim()) chrome.storage.local.set({ [EMAIL_STORAGE_KEY]: email.trim() })
  }

  async function handleSubmit() {
    if (!title.trim()) return
    if (sendMethod === 'email' && !email.trim()) return
    
    setIsSubmitting(true)
    setStatus(null)
    setGeneratedLink(null)

    try {
      console.log('[iaio Test] Sending metadata to backend:', {
        consoleLogs: metadata.consoleLogs,
        consoleEntries: metadata.consoleEntries,
        networkEntries: metadata.networkEntries
      });
      const res = await fetch(`${BACKEND}/send-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sendMethod === 'email' ? email.trim() : 'direct@iaiolabs.com',
          title,
          notes,
          aiSuggestion,
          screenshotBase64: screenshot,
          url: metadata.url,
          resolution: metadata.resolution,
          consoleLogs: metadata.consoleLogs,
          networkLogs: metadata.networkLogs,
          consoleEntries: metadata.consoleEntries,
          networkEntries: metadata.networkEntries,
          dom: metadata.dom,
          systemInfo: {
            userAgent: metadata.systemInfo.userAgent,
            platform: metadata.systemInfo.platform,
            language: metadata.systemInfo.language,
          },
        }),
      })

      const data = await res.json()
      console.info('[iaio] /send-report →', res.status, data)

      if (data.success) {
        if (sendMethod === 'link' && data.reportUrl) {
          setGeneratedLink(data.reportUrl)
          setStatus({ type: 'success', message: '¡Link generado! Podés copiarlo o abrirlo.' })
        } else {
          setStatus({ type: 'success', message: '¡Reporte enviado! Revisá tu bandeja 📧' })
          setTimeout(handleClose, 2200)
        }
      } else {
        setStatus({ type: 'error', message: mapError(data.error, data.code) })
      }
    } catch (err) {
      console.error('[iaio] /send-report network error', err)
      setStatus({ type: 'error', message: 'Sin conexión — verificá tu internet' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = title.trim().length > 0 && (sendMethod !== 'email' || email.trim().length > 0) && !isSubmitting

  let hostname = ''
  try { hostname = new URL(metadata.url).hostname } catch { hostname = metadata.url }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {isEditorOpen && screenshot && (
        <ImageEditor
          screenshot={screenshot}
          onClose={() => setIsEditorOpen(false)}
          onSave={(editedBase64) => setScreenshot(editedBase64)}
        />
      )}
      <style>{`
        @keyframes iaio-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes iaio-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        #iaio-panel-root * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        #iaio-panel-root button { cursor: pointer; }
        #iaio-panel-root textarea { resize: vertical; }
        #iaio-panel-root ::-webkit-scrollbar { width: 4px; }
        #iaio-panel-root ::-webkit-scrollbar-track { background: transparent; }
        #iaio-panel-root ::-webkit-scrollbar-thumb {
          background: rgba(0,240,255,0.15);
          border-radius: 2px;
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '24px',
          width: '380px',
          maxHeight: '82vh',
          zIndex: 2147483647,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
          color: C.text,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 0 0 1px rgba(0,240,255,0.04), 0 0 48px rgba(0,240,255,0.06), 0 24px 64px rgba(0,0,0,0.7)',
          transform: visible
            ? (isEditorOpen ? 'translateY(20px) scale(0.95)' : 'translateY(0) scale(1)')
            : 'translateY(16px) scale(0.97)',
          opacity: visible ? (isEditorOpen ? 0.1 : 1) : 0,
          pointerEvents: isEditorOpen ? 'none' : 'auto',
          transition: 'transform 0.28s cubic-bezier(0.175,0.885,0.32,1.275), opacity 0.22s ease',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${C.border}`,
          background: C.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: C.cyan, boxShadow: `0 0 10px ${C.cyan}`,
              animation: 'iaio-pulse 2s ease-in-out infinite',
            }} />
            <span style={{
              fontSize: '14px', fontWeight: 700, letterSpacing: '0.06em',
              background: `linear-gradient(135deg, ${C.cyan} 0%, ${C.violet} 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              iaio Test
            </span>
            <span style={{
              fontSize: '10px', color: C.muted,
              background: 'rgba(0,240,255,0.05)',
              padding: '2px 8px', borderRadius: '10px',
              border: `1px solid ${C.border}`, letterSpacing: '0.04em',
            }}>
              v2.0
            </span>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'none', border: 'none', color: C.muted,
              fontSize: '22px', lineHeight: 1, padding: '2px 6px',
              borderRadius: '6px', transition: 'color 0.15s, background 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseOut={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = 'none' }}
            aria-label="Close panel"
          >×</button>
        </div>

        {/* ── Scrollable Body ── */}
        <div style={{
          overflowY: 'auto', flex: 1, padding: '16px 18px',
          display: 'flex', flexDirection: 'column', gap: '14px',
        }}>
          {/* Screenshot */}
          <EvidenceSnapshotPreview
            screenshot={screenshot}
            onClick={() => screenshot && setIsEditorOpen(true)}
          />

          {/* AI Analysis */}
          <div>
            <FieldLabel>
              <span style={{ color: C.cyan, marginRight: '6px' }}>◈</span>
              AI Analysis
              {isAnalyzing && <span style={{ marginLeft: '8px', color: C.muted, fontWeight: 400 }}>analyzing…</span>}
            </FieldLabel>
            <div style={{
              padding: '12px 14px',
              background: 'rgba(0,240,255,0.025)',
              border: `1px solid rgba(0,240,255,0.1)`,
              borderRadius: '8px', fontSize: '12px', lineHeight: 1.65,
              color: isAnalyzing ? C.muted : C.text,
              minHeight: '88px',
              display: 'flex',
              alignItems: isAnalyzing ? 'center' : 'flex-start',
              justifyContent: isAnalyzing ? 'center' : 'flex-start',
              fontFamily: "'Space Mono', 'Courier New', monospace",
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {isAnalyzing ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <Spinner color={C.cyan} size={18} />
                  <span style={{ fontSize: '11px', letterSpacing: '0.04em' }}>Analyzing with Claude…</span>
                </div>
              ) : (
                aiSuggestion || 'AI suggestion will appear after screenshot capture.'
              )}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 0 0', marginTop: '4px' }}>
            <FieldLabel>Finalize Report</FieldLabel>
          </div>

          {/* Send Method */}
          <div>
            <FieldLabel>SEND REPORT TO *</FieldLabel>
            <select
              value={sendMethod}
              onChange={e => setSendMethod(e.target.value as any)}
              style={{ ...inputBaseStyle, marginBottom: sendMethod === 'email' ? '8px' : '0', cursor: 'pointer' }}
              onFocus={e => (e.target.style.borderColor = C.cyan)}
              onBlur={e => (e.target.style.borderColor = C.border)}
            >
              <option value="link">Direct Link (Open in Browser)</option>
              <option value="email">Email Address</option>
              <option value="jira" disabled>Jira (Soon)</option>
              <option value="github" disabled>GitHub (Soon)</option>
              <option value="azure" disabled>Azure (Soon)</option>
              <option value="trello" disabled>Trello (Soon)</option>
            </select>
            
            {sendMethod === 'email' && (
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={e => {
                  handleEmailBlur();
                  e.target.style.borderColor = C.border;
                }}
                placeholder="you@company.com"
                style={inputBaseStyle}
                onFocus={e => (e.target.style.borderColor = C.cyan)}
              />
            )}
          </div>

          {/* Title */}
          <div>
            <FieldLabel>Issue Title *</FieldLabel>
            <input
              type="text" value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What's broken?"
              style={inputBaseStyle}
              onFocus={e => (e.target.style.borderColor = C.cyan)}
              onBlur={e => (e.target.style.borderColor = C.border)}
            />
          </div>

          {/* Notes */}
          <div>
            <FieldLabel>Notes (optional)</FieldLabel>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Steps to reproduce, expected vs actual…"
              rows={3}
              style={{ ...inputBaseStyle, minHeight: '76px' }}
              onFocus={e => (e.target.style.borderColor = C.cyan)}
              onBlur={e => (e.target.style.borderColor = C.border)}
            />
          </div>

          {/* Page meta */}
          <div style={{ fontSize: '11px', color: C.muted, display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span>{hostname}</span>
            <span style={{ color: 'rgba(90,96,128,0.4)' }}>·</span>
            <span>{metadata.resolution}</span>
            <span style={{ color: 'rgba(90,96,128,0.4)' }}>·</span>
            <span>{metadata.systemInfo.platform}</span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '14px 18px', borderTop: `1px solid ${C.border}`,
          background: C.bg, display: 'flex', flexDirection: 'column',
          gap: '10px', flexShrink: 0,
        }}>
          {status && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px',
              fontSize: '12px', fontWeight: 600, textAlign: 'center',
              background: status.type === 'success' ? 'rgba(0,240,255,0.07)' : 'rgba(255,60,172,0.08)',
              color: status.type === 'success' ? C.cyan : C.magenta,
              border: `1px solid ${status.type === 'success' ? 'rgba(0,240,255,0.18)' : 'rgba(255,60,172,0.2)'}`,
            }}>
              {status.message}
            </div>
          )}

          {generatedLink ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedLink);
                  setStatus({ type: 'success', message: '¡Copiado al portapapeles! 📋' });
                }}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: '10px', border: `1px solid ${C.cyan}`,
                  background: 'transparent', color: C.cyan,
                  fontWeight: 700, fontSize: '14px',
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  cursor: 'pointer', transition: 'background 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(0,240,255,0.1)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                Copiar
              </button>
              <button
                onClick={() => window.open(generatedLink, '_blank')}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: '10px', border: 'none',
                  background: `linear-gradient(135deg, ${C.cyan} 0%, ${C.violet} 100%)`,
                  color: '#000', fontWeight: 700, fontSize: '14px',
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  cursor: 'pointer', transition: 'opacity 0.2s',
                  boxShadow: '0 0 20px rgba(0,240,255,0.2)',
                }}
                onMouseOver={e => e.currentTarget.style.opacity = '0.88'}
                onMouseOut={e => e.currentTarget.style.opacity = '1'}
              >
                Abrir →
              </button>
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                padding: '12px 16px', borderRadius: '10px', border: 'none',
                background: canSubmit
                  ? `linear-gradient(135deg, ${C.cyan} 0%, ${C.violet} 100%)`
                  : 'rgba(0,240,255,0.07)',
                color: canSubmit ? '#000' : C.muted,
                fontWeight: 700, fontSize: '14px',
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                transition: 'opacity 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: canSubmit ? '0 0 20px rgba(0,240,255,0.2)' : 'none',
              }}
              onMouseOver={e => { if (canSubmit) e.currentTarget.style.opacity = '0.88' }}
              onMouseOut={e => { e.currentTarget.style.opacity = '1' }}
            >
              {isSubmitting ? (
                <><Spinner color="#000" size={14} />{sendMethod === 'link' ? 'Generando...' : 'Enviando...'}</>
              ) : (
                sendMethod === 'link' ? 'Generate Link →' : 'Send Report →'
              )}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Error mapping ────────────────────────────────────────────────────────────

function mapError(error?: string, code?: string): string {
  if (code === 'validation_error') return 'Revisá que el email esté bien escrito'
  if (code === 'missing_required_field') return 'Ingresá tu email para recibir el reporte'
  const msg = (error || '').toLowerCase()
  if (msg.includes('email is required')) return 'Ingresá tu email para recibir el reporte'
  if (msg.includes('validation') || msg.includes('422') || msg.includes('invalid email'))
    return 'Revisá que el email esté bien escrito'
  return 'Algo salió mal — intentá de nuevo'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EvidenceSnapshotPreview({ screenshot, onClick }: { screenshot: string | null, onClick: () => void }) {
  return (
    <div
      onClick={screenshot ? onClick : undefined}
      style={{
        borderRadius: '10px', overflow: 'hidden',
        border: `1px solid ${C.border}`, background: C.bg,
        aspectRatio: '16/9', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        cursor: screenshot ? 'pointer' : 'default',
        position: 'relative',
      }}>
      {screenshot ? (
        <>
          <img src={screenshot} alt="Page screenshot"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          {/* Hover Overlay */}
          <div
            className="snapshot-overlay"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 240, 255, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.2s',
              backdropFilter: 'blur(2px)',
            }}
          >
            <span style={{
              background: C.surface,
              padding: '8px 16px', borderRadius: '20px',
              border: `1px solid ${C.cyan}`,
              color: C.cyan, fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em',
              boxShadow: '0 0 10px rgba(0,240,255,0.2)',
            }}>
              Click to Edit
            </span>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: C.muted, fontSize: '12px' }}>
          <Spinner color={C.cyan} size={20} />
          <span>Capturing screenshot…</span>
        </div>
      )}
      <style>{`
        .snapshot-overlay { opacity: 0; }
        div:hover > .snapshot-overlay { opacity: 1; }
      `}</style>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center',
      fontSize: '11px', fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: C.muted, marginBottom: '6px',
    }}>
      {children}
    </label>
  )
}

function Spinner({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size,
      border: '2px solid rgba(255,255,255,0.08)',
      borderTopColor: color, borderRadius: '50%',
      animation: 'iaio-spin 0.65s linear infinite',
      flexShrink: 0,
    }} />
  )
}

const inputBaseStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: '8px',
  color: C.text,
  fontSize: '13px',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  outline: 'none',
  display: 'block',
  transition: 'border-color 0.18s',
}
