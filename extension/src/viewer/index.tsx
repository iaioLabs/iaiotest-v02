import React from 'react';
import ReactDOM from 'react-dom/client';
import ReportViewer from './ReportViewer';

/**
 * Entry point for the standalone Report Viewer.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ReportViewer />
    </React.StrictMode>
);
