(function () {
    const MAX_LOG = 100;
    const MAX_NET = 50;

    console.info('[iaio Test] Main world hook successfully loaded and running in MAIN world.');

    function formatArgs(args) {
        return args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    }

    function sendToIsolated(type, payload) {
        window.postMessage({ source: 'iaio-test-hook', type, payload }, '*');
    }

    // Hook Console using Proxy to prevent other scripts from unhooking us easily
    const originalConsole = window.console;

    function createConsoleHook(level) {
        const originalMethod = originalConsole[level];
        return function (...args) {
            sendToIsolated('LOG', { timestamp: new Date().toISOString(), level, message: formatArgs(args) });
            originalMethod.apply(originalConsole, args);
        };
    }

    // Replace the console methods
    window.console.error = createConsoleHook('error');
    window.console.warn = createConsoleHook('warn');
    window.console.log = createConsoleHook('log');
    window.console.info = createConsoleHook('info');

    // Hook Global Errors (Uncaught Exceptions & CSP Violations)
    window.addEventListener('error', (event) => {
        let message = event.message || 'Unknown Error';
        if (event.error && event.error.stack) {
            message += `\n${event.error.stack}`;
        }
        sendToIsolated('LOG', { timestamp: new Date().toISOString(), level: 'error', message });
    }, true); // Use capture phase to catch resource loading errors too

    // Hook Unhandled Promise Rejections
    window.addEventListener('unhandledrejection', (event) => {
        let message = 'Unhandled Promise Rejection';
        if (event.reason) {
            message += `: ${typeof event.reason === 'object' ? JSON.stringify(event.reason, Object.getOwnPropertyNames(event.reason)) : event.reason}`;
        }
        sendToIsolated('LOG', { timestamp: new Date().toISOString(), level: 'error', message });
    });

    // Hook Fetch
    const _originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const [resource, config] = args;
        const url = resource instanceof Request ? resource.url : String(resource);
        const method = (config && config.method) ? config.method : 'GET';
        const timestamp = new Date().toISOString();
        try {
            const response = await _originalFetch(...args);
            sendToIsolated('NETWORK', { type: 'FETCH', url, status: response.status, method, timestamp });
            return response;
        } catch (err) {
            sendToIsolated('NETWORK', { type: 'FETCH_ERROR', url, method, error: String(err.message || err), timestamp });
            throw err;
        }
    };

    // Hook XHR
    const _originalXHROpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this.addEventListener('load', function () {
            sendToIsolated('NETWORK', {
                type: 'XHR',
                url: url.toString(),
                status: this.status,
                method,
                timestamp: new Date().toISOString(),
            });
        });
        this.addEventListener('error', function () {
            sendToIsolated('NETWORK', {
                type: 'XHR_ERROR',
                url: url.toString(),
                method,
                error: 'Network Error',
                timestamp: new Date().toISOString(),
            });
        });
        return _originalXHROpen.apply(this, [method, url, ...rest]);
    };
})();
