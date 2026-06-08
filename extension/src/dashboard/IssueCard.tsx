import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Issue } from './types';

interface IssueCardProps {
  issue: Issue;
}

// IAIO Labs logo placeholder SVG (inline, used when image fails or is missing)
function IaioPlaceholder() {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '10px',
      background: 'linear-gradient(135deg, rgba(0,240,255,0.04) 0%, rgba(123,92,255,0.06) 100%)',
    }}>
      {/* IAIO Labs Logo */}
      <svg viewBox="0 0 100 100" style={{ width: 36, height: 36, opacity: 0.4 }}>
        <g>
          <line x1="10" y1="40" x2="40" y2="40" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
          <line x1="5" y1="55" x2="35" y2="55" stroke="#7C3AED" strokeWidth="8" strokeLinecap="round" />
          <line x1="10" y1="70" x2="40" y2="70" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
        </g>
        <path d="M45 55 L60 70 L90 30" stroke="#10B981" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontSize: '10px', color: 'rgba(90,96,128,0.5)', letterSpacing: '0.06em' }}>Sin captura</span>
    </div>
  );
}

export default function IssueCard({ issue }: IssueCardProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  // ── Resolve screenshot URL ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function resolveImage() {
      setImgLoading(true);
      setImgError(false);

      // Priority 1: Use the stored screenshot_url directly (public bucket or pre-signed)
      if (issue.screenshot_url) {

        if (!cancelled) {
          setImgSrc(issue.screenshot_url);
          setImgLoading(false);
        }
        return;
      }

      // Priority 2: Generate a signed URL from the storage path
      if (issue.screenshot_path) {

        try {
          const { data, error } = await supabase.storage
            .from('screenshots')
            .createSignedUrl(issue.screenshot_path, 3600); // 1-hour signed URL

          if (error) {
            console.warn(`[IssueCard] [${issue.id}] Signed URL error:`, error.message);
            if (!cancelled) { setImgError(true); setImgLoading(false); }
            return;
          }


          if (!cancelled) {
            setImgSrc(data.signedUrl);
            setImgLoading(false);
          }
        } catch (err: any) {
          console.error(`[IssueCard] [${issue.id}] Unexpected error generating signed URL:`, err.message);
          if (!cancelled) { setImgError(true); setImgLoading(false); }
        }
        return;
      }

      // Priority 3: No image data available

      if (!cancelled) { setImgError(true); setImgLoading(false); }
    }

    resolveImage();
    return () => { cancelled = true; };
  }, [issue.id, issue.screenshot_url, issue.screenshot_path]);

  // ── Open detail viewer (pass session tokens via hash so RLS works) ──────────
  const handleViewDetail = async () => {

    const base = chrome.runtime.getURL(`viewer/index.html`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && session?.refresh_token) {
        const url = `${base}?id=${issue.id}#at=${encodeURIComponent(session.access_token)}&rt=${encodeURIComponent(session.refresh_token)}`;
        window.open(url, '_blank');
      } else {
        window.open(`${base}?id=${issue.id}`, '_blank');
      }
    } catch {
      window.open(`${base}?id=${issue.id}`, '_blank');
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(issue.url);
  };

  const severityClass = `badge-${issue.severity.toLowerCase()}`;

  return (
    <div className="issue-card">
      <div className="card-header">
        <h3 className="card-title" title={issue.title}>{issue.title}</h3>
      </div>

      <div className="card-meta">
        <span className={`badge ${severityClass}`}>
          {issue.severity}
        </span>
        {/* SLOT: Jira Status (Mocked) */}
        <span className="status-slot">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}></span>
          Open
        </span>
      </div>

      {/* ── Screenshot Thumbnail ───────────────────────────────────────── */}
      <div className="card-preview" style={{ position: 'relative', overflow: 'hidden' }}>
        {imgLoading ? (
          /* Loading skeleton shimmer */
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(90deg, rgba(0,240,255,0.04) 25%, rgba(0,240,255,0.08) 50%, rgba(0,240,255,0.04) 75%)',
            backgroundSize: '200% 100%',
            animation: 'iaio-shimmer 1.5s infinite',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <style>{`@keyframes iaio-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
          </div>
        ) : imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={`Captura del bug: ${issue.title}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => {
              console.warn(`[IssueCard] [${issue.id}] Image failed to render — showing placeholder.`);
              setImgError(true);
            }}
          />
        ) : (
          <IaioPlaceholder />
        )}
      </div>

      <div className="card-footer">
        <button
          className="btn-icon"
          onClick={handleCopyUrl}
          title="Copiar URL del Bug"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button className="btn-primary" onClick={handleViewDetail}>
          Ver Detalle
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>
    </div>
  );
}
