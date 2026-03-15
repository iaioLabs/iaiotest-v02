/**
 * Content Script — iaio Test v2
 *
 * Responsibilities:
 *  1. Hook console errors/warnings/logs into logBuffer
 *  2. Hook fetch + XHR (all requests) into networkBuffer
 *  3. Inject Google Fonts
 *  4. Inject floating "iaio" button (bottom-right)
 *  5. On button click: mount / unmount the React Panel
 *  6. Mask / unmask sensitive fields before/after screenshot
 */

import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import Panel from './Panel'

// ─── Diagnostic Buffers ───────────────────────────────────────────────────────

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

const logBuffer: LogEntry[] = []
const networkBuffer: NetworkEntry[] = []
const MAX_LOG = 100
const MAX_NET = 50

// ─── Main World Hook Injection ────────────────────────────────────────────────
// Now handled native via manifest.json (mainWorldHook.js) to bypass strict CSP


window.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.source === 'iaio-test-hook') {
    // Message received from Main World
  }
  if (event.data?.source !== 'iaio-test-hook') return;
  if (event.data.type === 'LOG') {
    logBuffer.push(event.data.payload);
    if (logBuffer.length > MAX_LOG) logBuffer.shift();
  } else if (event.data.type === 'NETWORK') {
    networkBuffer.push(event.data.payload);
    if (networkBuffer.length > MAX_NET) networkBuffer.shift();
  }
});

// ─── Metadata Helper ──────────────────────────────────────────────────────────

function collectMetadata() {
  return {
    url: window.location.href,
    title: document.title,
    resolution: `${window.screen.width}x${window.screen.height}`,
    // Strings for AI analysis (error + warn only, failed network only)
    consoleLogs: logBuffer
      .filter((l) => l.level !== 'log')
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n'),
    networkLogs: networkBuffer
      .filter((n) => !n.status || n.status >= 400)
      .map((n) => `[${n.timestamp}] ${n.type} ${n.method ?? ''} ${n.url} → ${n.status ?? n.error ?? ''}`)
      .join('\n'),
    // Structured arrays for the DevTools UI tabs
    consoleEntries: [...logBuffer],
    networkEntries: [...networkBuffer],
    dom: document.documentElement.outerHTML,
    systemInfo: {
      userAgent: navigator.userAgent,
      platform: (navigator as any).userAgentData?.platform || navigator.platform || 'Unknown',
      language: navigator.language,
    },
  }
}

// ─── Panel State ──────────────────────────────────────────────────────────────

let panelRoot: Root | null = null
let panelContainer: HTMLDivElement | null = null
let isPanelOpen = false

function openPanel() {
  if (isPanelOpen) return
  isPanelOpen = true

  panelContainer = document.createElement('div')
  panelContainer.id = 'iaio-panel-root'
  document.body.appendChild(panelContainer)

  panelRoot = createRoot(panelContainer)
  const metadataObj = collectMetadata();

  panelRoot.render(
    React.createElement(Panel, {
      metadata: metadataObj,
      onClose: closePanel,
    })
  )
}

function closePanel() {
  if (!isPanelOpen || !panelRoot || !panelContainer) return
  panelRoot.unmount()
  panelContainer.remove()
  panelRoot = null
  panelContainer = null
  isPanelOpen = false
}

// ─── Floating Button ──────────────────────────────────────────────────────────

function injectFonts() {
  if (document.getElementById('iaio-fonts')) return
  const link = document.createElement('link')
  link.id = 'iaio-fonts'
  link.rel = 'stylesheet'
  link.href =
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap'
  document.head.appendChild(link)
}

function injectButton() {
  if (document.getElementById('iaio-floating-btn')) return

  const style = document.createElement('style')
  style.id = 'iaio-btn-style'
  style.textContent = `
    #iaio-floating-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      background: #080d1a;
      border: 1px solid rgba(0,240,255,0.35);
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 0 24px rgba(0,240,255,0.15), 0 8px 32px rgba(0,0,0,0.5);
      transition: transform 0.25s cubic-bezier(0.175,0.885,0.32,1.275),
                  border-color 0.2s, box-shadow 0.2s;
      user-select: none;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    #iaio-floating-btn:hover {
      transform: translateY(-4px) scale(1.08);
      border-color: rgba(0,240,255,0.7);
      box-shadow: 0 0 32px rgba(0,240,255,0.3), 0 12px 40px rgba(0,0,0,0.6);
    }
    #iaio-floating-btn svg {
      flex-shrink: 0;
    }
  `
  document.head.appendChild(style)

  const btn = document.createElement('button')
  btn.id = 'iaio-floating-btn'
  btn.setAttribute('aria-label', 'Report bug with iaio Test')
  btn.innerHTML = `
    <svg viewBox="0 0 100 100" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
      <g>
        <line x1="10" y1="40" x2="40" y2="40" stroke="#64748B" stroke-width="8" stroke-linecap="round" />
        <line x1="5" y1="55" x2="35" y2="55" stroke="#7C3AED" stroke-width="8" stroke-linecap="round" />
        <line x1="10" y1="70" x2="40" y2="70" stroke="#64748B" stroke-width="8" stroke-linecap="round" />
      </g>
      <path d="M45 55 L60 70 L90 30" stroke="#10B981" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `

  btn.addEventListener('click', () => {
    if (isPanelOpen) {
      closePanel()
    } else {
      openPanel()
    }
  })

  document.body.appendChild(btn)
}

// ─── Sensitive Field Masking ──────────────────────────────────────────────────

const SENSITIVE_SELECTORS = [
  'input[type="password"]',
  'input[autocomplete="current-password"]',
  'input[autocomplete="new-password"]',
  'input[autocomplete="cc-number"]',
  'input[autocomplete="cc-csc"]',
  'input[autocomplete="cc-exp"]',
  'input[name*="password" i]',
  'input[name*="passwd" i]',
  'input[name*="secret" i]',
  'input[name*="token" i]',
  'input[name*="credit" i]',
  'input[name*="card" i]',
  'input[name*="cvv" i]',
  'input[name*="ssn" i]',
  'input[id*="password" i]',
  'input[id*="passwd" i]',
  'input[id*="secret" i]',
].join(',')

function maskSensitiveFields() {
  const fields = document.querySelectorAll<HTMLElement>(SENSITIVE_SELECTORS)
  fields.forEach((el) => {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return

    const mask = document.createElement('div')
    mask.className = 'iaio-sensitive-mask'
    Object.assign(mask.style, {
      position: 'fixed',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      background: '#0d1425',
      border: '1px solid rgba(0,240,255,0.15)',
      borderRadius: '4px',
      zIndex: '2147483645',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      letterSpacing: '0.2em',
      color: 'rgba(0,240,255,0.4)',
      fontFamily: 'monospace',
      pointerEvents: 'none',
    })
    mask.textContent = '••••••••'
    document.body.appendChild(mask)
  })
}

function unmaskSensitiveFields() {
  document.querySelectorAll('.iaio-sensitive-mask').forEach((el) => el.remove())
}

// ─── Message Listener (from background) ──────────────────────────────────────

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'maskSensitiveFields') {
    maskSensitiveFields()
    sendResponse({ done: true })
  }
  if (request.action === 'unmaskSensitiveFields') {
    unmaskSensitiveFields()
    sendResponse({ done: true })
  }
})

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  injectFonts()
  injectButton()
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
(function () {
})();
