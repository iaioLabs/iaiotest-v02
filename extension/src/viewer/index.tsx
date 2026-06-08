import React from 'react';
import ReactDOM from 'react-dom/client';
import ReportViewer from './ReportViewer';
import Dashboard from '../dashboard/Dashboard';

/**
 * Entry point for the standalone Report Viewer and Dashboard.
 * Routes based on ?view=dashboard or default to ?id=... (ReportViewer)
 */
const isDashboard = new URLSearchParams(window.location.search).get('view') === 'dashboard';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        {isDashboard ? <Dashboard /> : <ReportViewer />}
    </React.StrictMode>
);
