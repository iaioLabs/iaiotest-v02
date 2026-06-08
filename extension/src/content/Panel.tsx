/**
 * Panel.tsx — iaio Test v2
 *
 * Floating React panel injected into the page.
 * Flow: screenshot → AI analysis → fill form → Send Report (email)
 *
 * Auth: none (open endpoints for now)
 *
 * The DevTools data (console, network, DOM) is captured and sent
 * in the report payload but NOT displayed here — it lives in the
 * interactive web report (viewer.html).
 *
 * Design: iaio Labs dark glassmorphism
 */

import { useState, useEffect } from 'react'
export interface LogEntry {
  timestamp: string
  level: 'error' | 'warn' | 'log'
  message: string
}

export interface NetworkEntry {
  type: string
  url: string
  status?: number
  method?: string
  error?: string
  timestamp: string
}

import ImageEditor from './ImageEditor'
import { loginWithGoogle, getSession, logout, type UserSession } from './authService'

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

const BACKEND = process.env.VITE_BACKEND_URL || 'http://localhost:3000'
const BACKEND_AUTH_HEADER = process.env.VITE_API_SECRET
  ? { Authorization: `Bearer ${process.env.VITE_API_SECRET}` }
  : {}
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
  const [session, setSession] = useState<UserSession | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Mount animation
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  // Load saved session and email
  useEffect(() => {
    getSession().then(s => {
      if (s) {
        setSession(s)
        setEmail(s.user.email)
      }
    })

    chrome.storage.local.get([EMAIL_STORAGE_KEY, `report_${metadata.url}`], (result) => {
      if (result[EMAIL_STORAGE_KEY]) setEmail(result[EMAIL_STORAGE_KEY])
      if (result[`report_${metadata.url}`]) {
        setGeneratedLink(result[`report_${metadata.url}`])
        setStatus({ type: 'success', message: 'Hay un reporte reciente en esta página.' })
      }
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
    // Offline mode: bypass the backend fetch
    setAiSuggestion('Conecte su propia API Key de IA en Configuración para usar esta funcionalidad (Próximamente)')
  }

  async function handleLogin() {
    setIsLoggingIn(true)
    setAuthError(null)
    try {
      const s = await loginWithGoogle()
      setSession(s)
      setEmail(s.user.email)
      setStatus({ type: 'success', message: `¡Hola ${s.user.email}! Login exitoso.` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Login Error]', msg)
      setStatus({ type: 'error', message: `Login fallido: ${msg}` })
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function handleLogout() {
    await logout()
    setSession(null)
    setEmail('')
    setAuthError(null)
  }

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  function handleReset() {
    setTitle('')
    setNotes('')
    setGeneratedLink(null)
    setStatus(null)
    chrome.storage.local.remove(`report_${metadata.url}`)
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
    setAuthError(null)

    try {
      // ── 1. Get real Supabase session via background — single source of truth, no fallbacks ──
      const sbSession = await getSession()

      if (!sbSession || !sbSession.user?.id) {
        setAuthError('Sesión expirada. Por favor, cerrá sesión e iniciá de nuevo para continuar reportando.')
        setIsSubmitting(false)
        return
      }

      const finalUserId = sbSession.user.id

      // ── 2. Send to Supabase via Background Script ──────────────────────────
      // The background will: upload screenshot → insert issue row → return issueId
      chrome.runtime.sendMessage({
        action: 'createIssue',
        payload: {
          user_id: finalUserId,
          title: title.trim(),
          description: notes.trim() || aiSuggestion,
          severity: 'medium',
          url: metadata.url,
          ai_analysis: 'Pendiente de conexión',
          browser_info: {
            screen: `${window.screen.width}x${window.screen.height}`,
            userAgent: navigator.userAgent,
            language: navigator.language,
            isMobile: /Mobi|Android/i.test(navigator.userAgent)
          },
          console: metadata.consoleEntries,
          network: metadata.networkEntries,
          dom: metadata.dom,
          // Screenshot is extracted by the background before DB insert
          screenshotBase64: screenshot ?? undefined,
        }
      }, async (response) => {
        if (chrome.runtime.lastError) {
          setIsSubmitting(false)
          setStatus({ type: 'error', message: chrome.runtime.lastError.message || 'Error interno de extensión' })
          return
        }

        if (!response?.success) {
          setIsSubmitting(false)
          const errData = response?.error
          const errMsg = typeof errData === 'string' ? errData : JSON.stringify(errData || 'Error desconocido')
          setStatus({ type: 'error', message: `Error Supabase: ${errMsg}` })
          return
        }

        // ── 3. Supabase insert succeeded ─────────────────────────────────────
        const issueId: string | undefined = response.issueId
        setIsSubmitting(false)
        setStatus({ type: 'success', message: '¡Éxito! Reporte guardado.' })

        if ((sendMethod === 'link' || sendMethod === 'email') && issueId) {
          // Build a direct link to the Supabase-backed extension viewer
          const viewerBase = chrome.runtime.getURL('viewer/index.html')
          const viewerUrl = `${viewerBase}?id=${issueId}`
          setGeneratedLink(viewerUrl)
          chrome.storage.local.set({ [`report_${metadata.url}`]: viewerUrl })
          setTimeout(() => handleClose(), 4000)
        } else if (sendMethod === 'link' || sendMethod === 'email') {
          // Fallback: open Dashboard so user can find the new report there
          setStatus({ type: 'success', message: '¡Éxito! Reporte guardado. Abrí el Dashboard para verlo.' })
          setTimeout(() => handleClose(), 3000)
        }

        // ── 4. Try legacy backend (non-blocking) — keep for email delivery ───
        if (sendMethod === 'email' && email.trim()) {
          fetch(`${BACKEND}/send-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...BACKEND_AUTH_HEADER },
            body: JSON.stringify({
              url: metadata.url,
              title: title.trim(),
              notes: notes.trim(),
              email: email.trim(),
              resolution: metadata.resolution,
              aiSuggestion,
              screenshotBase64: screenshot,
              systemInfo: metadata.systemInfo
            })
          }).catch(() => {
            console.warn('[Panel] Legacy backend email delivery failed — issue already saved in Supabase.')
          })
        }
      })
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Sin conexión — verificá tu internet' })
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
        {/* ── Dev Mode Badge ── */}
        <div style={{
          background: '#ffeb3b',
          color: '#000',
          fontSize: '10px',
          fontWeight: 800,
          textAlign: 'center',
          padding: '4px 0',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          borderBottom: '1px solid rgba(0,0,0,0.1)',
        }}>
          [ DEV MODE v2.6.2 ]
        </div>

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
            <svg viewBox="0 0 100 100" style={{ width: '18px', height: '18px' }}>
              <g>
                <line x1="10" y1="40" x2="40" y2="40" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
                <line x1="5" y1="55" x2="35" y2="55" stroke="#7C3AED" strokeWidth="8" strokeLinecap="round" />
                <line x1="10" y1="70" x2="40" y2="70" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
              </g>
              <path d="M45 55 L60 70 L90 30" stroke="#10B981" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
              v2.6.2
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={async () => {
                const base = chrome.runtime.getURL('viewer/index.html');
                try {
                  const s = await getSession();
                  if (s?.access_token && s?.refresh_token) {
                    // Pass tokens via hash fragment (not logged by servers, cleared after read)
                    window.open(`${base}?view=dashboard#at=${encodeURIComponent(s.access_token)}&rt=${encodeURIComponent(s.refresh_token)}`);
                  } else {
                    window.open(`${base}?view=dashboard`);
                  }
                } catch {
                  window.open(`${base}?view=dashboard`);
                }
              }}
              style={{
                background: 'none', border: 'none', color: C.muted,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '6px', borderRadius: '6px', transition: 'color 0.15s, background 0.15s',
                cursor: 'pointer'
              }}
              onMouseOver={e => { e.currentTarget.style.color = C.cyan; e.currentTarget.style.background = 'rgba(0,240,255,0.1)' }}
              onMouseOut={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = 'none' }}
              title="Ir al Dashboard"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button
              onClick={handleClose}
              style={{
                background: 'none', border: 'none', color: C.muted,
                fontSize: '22px', lineHeight: 1, padding: '2px 6px',
                borderRadius: '6px', transition: 'color 0.15s, background 0.15s',
                cursor: 'pointer'
              }}
              onMouseOver={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseOut={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = 'none' }}
              aria-label="Close panel"
            >×</button>
          </div>
        </div>

        {!session ? (
          /* ── Login View (Auth Guard) ── */
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '40px 24px',
            textAlign: 'center', gap: '20px'
          }}>
            <div style={{
              width: '64px', height: '64px', background: 'rgba(0,240,255,0.05)',
              borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${C.border}`, marginBottom: '8px'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.cyan} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </div>

            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Bienvenido a iaio</h2>
              <p style={{ fontSize: '13px', color: C.muted, lineHeight: 1.5 }}>
                Iniciá sesión para persistir tus reportes y acceder a tu dashboard personal.
              </p>
            </div>

            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: isLoggingIn ? 'rgba(0,240,255,0.1)' : `linear-gradient(135deg, ${C.cyan} 0%, ${C.violet} 100%)`,
                color: isLoggingIn ? C.muted : '#000', fontWeight: 700, fontSize: '14px',
                cursor: isLoggingIn ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                boxShadow: isLoggingIn ? 'none' : '0 8px 24px rgba(0,240,255,0.2)'
              }}
            >
              {isLoggingIn ? (
                <><Spinner color={C.cyan} size={16} /> Conectando...</>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335" />
                  </svg>
                  Login con Google
                </>
              )}
            </button>

            {authError && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', fontSize: '12px',
                fontWeight: 600, textAlign: 'center',
                background: 'rgba(255,60,172,0.08)',
                color: C.magenta, border: `1px solid rgba(255,60,172,0.2)`,
                marginTop: '-8px',
              }}>
                {authError}
              </div>
            )}

            <p style={{ fontSize: '11px', color: 'rgba(90,96,128,0.5)' }}>
              Al continuar, aceptás nuestros términos de servicio.
            </p>
          </div>
        ) : (
          /* ── Scrollable Body (Authenticated) ── */
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

            {/* User profile / Logout */}
            <div style={{
              marginTop: 'auto', padding: '12px 0', borderTop: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%', background: C.cyan,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000',
                  fontSize: '10px', fontWeight: 800
                }}>
                  {(session.user.name?.[0] || session.user.email[0]).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: C.text }}>{session.user.name}</span>
                  <span style={{ fontSize: '10px', color: C.muted }}>{session.user.email}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  background: 'none', border: 'none', color: C.magenta, fontSize: '11px',
                  fontWeight: 600, cursor: 'pointer', opacity: 0.7
                }}
                onMouseOver={e => e.currentTarget.style.opacity = '1'}
                onMouseOut={e => e.currentTarget.style.opacity = '0.7'}
              >
                Cerrar Sesión
              </button>
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
        )}

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                  Ver Reporte →
                </button>
              </div>
              <button
                onClick={handleReset}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '10px', border: `1px solid rgba(255,255,255,0.1)`,
                  background: 'rgba(255,255,255,0.03)', color: C.text,
                  fontWeight: 600, fontSize: '13px',
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  cursor: 'pointer', transition: 'background 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                + Crear Nuevo Reporte
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
