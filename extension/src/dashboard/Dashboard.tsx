import React, { useState, useEffect } from 'react';
import { supabase, waitForStorage } from '../lib/supabase';
import { Issue } from './types';
import IssueCard from './IssueCard';
import IssueTable from './IssueTable';
import './dashboard.css';

export default function Dashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userMeta, setUserMeta] = useState<{ name: string; email: string } | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Inject body class for dashboard-specific global styles (like background)
    document.body.classList.add('dashboard-mode');

    const loadAuth = async () => {
      try {
        // ── Step 1: Boot from URL token (passed by Panel when opening Dashboard) ──
        // Tokens are in the URL hash: #at=ACCESS_TOKEN&rt=REFRESH_TOKEN
        const hash = window.location.hash.substring(1); // strip '#'
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
              console.warn('[Dashboard] setSession from URL failed:', sessionError.message);
            }
          }

          // Clear the hash from the URL bar (security: don't leave tokens visible)
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }

        // ── Step 2: Read session (from setSession above OR chrome.storage.local adapter) ──
        await waitForStorage();
        const { data: { session: sbSession } } = await supabase.auth.getSession();

        if (sbSession?.user?.id) {
          setUserId(sbSession.user.id);
          setUserMeta({
            name: (sbSession.user.user_metadata?.full_name as string) || sbSession.user.email || 'Usuario',
            email: sbSession.user.email ?? '',
          });
          fetchIssues(sbSession.user.id);
        } else {
          setLoading(false);
          setError('No detectamos tu sesión. Por favor, abrí la extensión en cualquier web e iniciá sesión con Google para ver tu dashboard.');
        }
      } catch (err: any) {
        setLoading(false);
        setError('Error al obtener la sesión: ' + err.message);
      }
    };

    loadAuth();

    // Reactively update if auth state changes while the tab is open
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sbSession) => {
      if (sbSession?.user?.id) {
        setUserId(sbSession.user.id);
        setUserMeta({
          name: (sbSession.user.user_metadata?.full_name as string) || sbSession.user.email || 'Usuario',
          email: sbSession.user.email ?? '',
        });
        setError(null);
        fetchIssues(sbSession.user.id);
      } else {
        setUserId(null);
        setUserMeta(null);
      }
    });

    return () => {
      document.body.classList.remove('dashboard-mode');
      subscription.unsubscribe();
    };
  }, []);

  async function fetchIssues(userId: string) {
    try {
      setLoading(true);


      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });



      if (error) throw error;
      setIssues(data as Issue[]);
    } catch (err: any) {
      console.error('[Dashboard] fetchIssues error:', err);
      setError('Hubo un problema al cargar los reportes. Revisa la consola.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="dash-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--accent-cyan)' }}>
        <div style={{ animation: 'iaio-spin 1s linear infinite', width: 40, height: 40, border: '3px solid rgba(0,240,255,0.2)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%' }}></div>
        <style dangerouslySetInnerHTML={{__html: `@keyframes iaio-spin { to { transform: rotate(360deg); } }`}}></style>
      </div>
    );
  }

  return (
    <div className="dash-container">
      <header className="dash-header">
        <div className="dash-logo">
          {/* Minimalist IAIO Labs Logo */}
          <svg viewBox="0 0 100 100" style={{ width: 28, height: 28 }}>
            <g>
              <line x1="10" y1="40" x2="40" y2="40" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
              <line x1="5" y1="55" x2="35" y2="55" stroke="#7C3AED" strokeWidth="8" strokeLinecap="round" />
              <line x1="10" y1="70" x2="40" y2="70" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
            </g>
            <path d="M45 55 L60 70 L90 30" stroke="#10B981" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="dash-logo-text">iaio Test Dashboard</span>
        </div>

        {userMeta && (
          <div className="dash-user-info">
            <div className="dash-user-details" style={{ textAlign: 'right' }}>
              <span className="dash-user-name">{userMeta.name || 'Usuario'}</span>
              <span className="dash-user-email">{userMeta.email}</span>
            </div>
            <div className="dash-avatar">
              {(userMeta.name?.[0] || userMeta.email?.[0] || '?').toUpperCase()}
            </div>
          </div>
        )}
      </header>

      {error ? (
        <div className="empty-state" style={{ borderColor: 'var(--severity-high)' }}>
          <div className="empty-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--severity-high)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2 className="empty-title">Acceso Restringido</h2>
          <p className="empty-desc">{error}</p>
        </div>
      ) : issues.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
          <h2 className="empty-title">Sin Reportes Aún</h2>
          <p className="empty-desc">
            Aún no has generado ningún reporte con esta cuenta. Abre la extensión de iaio Test en cualquier página para capturar tu primer bug.
          </p>
        </div>
      ) : (
        <>
          <div className="dash-controls">
            <h1 className="dash-title">Mis Reportes ({issues.length})</h1>
            <div className="view-switch">
              <button 
                className={viewMode === 'cards' ? 'active' : ''} 
                onClick={() => setViewMode('cards')}
                title="Vista de Tarjetas"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </button>
              <button 
                className={viewMode === 'table' ? 'active' : ''} 
                onClick={() => setViewMode('table')}
                title="Vista de Tabla"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          {viewMode === 'cards' ? (
            <div className="cards-grid">
              {issues.map(issue => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          ) : (
            <IssueTable issues={issues} />
          )}
        </>
      )}
    </div>
  );
}
