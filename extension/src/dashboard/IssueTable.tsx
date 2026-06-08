import React from 'react';
import { supabase } from '../lib/supabase';
import { Issue } from './types';

interface IssueTableProps {
  issues: Issue[];
}

export default function IssueTable({ issues }: IssueTableProps) {
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Open detail viewer passing session tokens so RLS works in the new tab
  const handleViewDetail = async (issue: Issue) => {

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

  return (
    <div className="dash-table-wrapper">
      <table className="dash-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Title</th>
            <th>Severity</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {issues.map(issue => (
            <tr key={issue.id}>
              <td>
                <span className="status-slot" style={{ display: 'inline-flex' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}></span>
                  Open
                </span>
              </td>
              <td className="title-col" title={issue.title}>
                {issue.title}
              </td>
              <td>
                <span className={`badge badge-${issue.severity.toLowerCase()}`}>
                  {issue.severity}
                </span>
              </td>
              <td className="date-col">
                {formatDate(issue.created_at)}
              </td>
              <td>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn-icon"
                    onClick={() => {

                      navigator.clipboard.writeText(issue.url);
                    }}
                    title="Copiar URL"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => handleViewDetail(issue)}
                    title="Ver Detalle"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
