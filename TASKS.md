# iaio Test v2 — Task Board

> Sprint diario. Antes de empezar cualquier tarea, consultá este archivo.
> Cuando completés algo, movelo a ✅ COMPLETADO.
> **BE** = Backend engineer | **FE** = Frontend engineer

---

## ✅ COMPLETADO

### Infraestructura
- [x] Estructura base del proyecto v2 (extension + backend)
- [x] Manifest MV3 sin popup estándar
- [x] Build system: dos Vite configs (IIFE content + ES module background)
- [x] Extension carga correctamente en Chrome
- [x] `.env` + `.env.example` con vars de Resend
- [x] `.gitignore` — `.env` y `node_modules/` protegidos
- [x] Secrets movidos a ruta externa (`/secrets-iaiolabs/.env`) — fuera del repo

### Extension (FE)
- [x] Background service worker (`captureVisibleTab`)
- [x] Content script con hooks de console.error + fetch + XHR
- [x] Botón flotante bottom-right con diseño iaio Labs (cyan glow)
- [x] Inyección de Google Fonts (Plus Jakarta Sans + Space Mono)
- [x] Panel React inyectado en página (z-index máximo, sin shadow DOM)
- [x] Screenshot preview en el panel
- [x] **Masking de campos sensibles antes del screenshot**
  - password, credit card, CVV, tokens nunca se capturan
  - background orquesta: mask → capture → unmask automáticamente
- [x] Campo de email persistido en `chrome.storage.sync`
- [x] Botón "Send Report" — email como destino principal
- [x] Formulario: email + título + notas opcionales

### Backend (BE)
- [x] `aiService.js` con visión (screenshot como imagen base64 a Claude)
- [x] AI análisis automático al abrir el panel (`/analyze-bug` → claude-sonnet-4-6)
- [x] `emailService.js` con **Resend SDK** — email de notificación con link al viewer
- [x] Endpoint `POST /send-report`
- [x] `jiraService.js` (Jira REST API v3 — opcional, config avanzada)
- [x] `storageService.js` — persistencia local de reportes (JSON + PNG)
  - Directorios `data/reports/` y `data/uploads/` se crean automáticamente al iniciar
  - IDs de bug con `crypto.randomUUID()` — sin colisiones
- [x] Web viewer de reportes (`/report/:id`) — SSR con base64 injection
  - DOM inspector estilo Chrome DevTools dark mode
  - Tabs: Info / Console / DOM Inspector
- [x] **Rate limiting** (`express-rate-limit`)
  - `/analyze-bug` y `/send-report`: 5 req/min por IP
  - `/create-issue`: 10 req/min por IP
  - `/report/:id` y `/api/report/:id`: 30 req/min por IP
- [x] **Auth middleware** (`authMiddleware.js`)
  - `Authorization: Bearer <API_SECRET>` requerido en endpoints de mutación
  - Endpoints de lectura (`/report/:id`, `/health`) permanecen públicos
- [x] **Deploy-ready: path de secrets parametrizado**
  - Dev: carga desde `SECRETS_PATH` env var o fallback a ruta local
  - Prod (`NODE_ENV=production`): dotenv se saltea, el host inyecta las vars
- [x] **Reports API** (`storageService.js` + `server.js`)
  - `GET /api/reports?page=1&limit=20` — listado paginado, metadata sin campos pesados (protegido)
  - `DELETE /api/report/:id` — elimina JSON + screenshot (protegido)
  - `getStats()` interno para el health check
- [x] **Health check enriquecido** (`GET /health`)
  - Devuelve: `status`, `version`, `uptime` (segundos), `reports.count`, `reports.lastReportAt`

### Fixes de email
- [x] Screenshot embebido como data URI en HTML + adjunto PNG de respaldo
- [x] Platform detection: `userAgentData.platform` → `navigator.platform` → 'Unknown'
- [x] Metadata explícita en Panel.tsx (url, resolution, consoleLogs, networkLogs, systemInfo)
- [x] `to: [email]` formato array correcto para Resend SDK
- [x] Error code propagado desde emailService → server → Panel
- [x] Mensajes de error amigables en español

---

## 🔄 SPRINT HOY — 4 Mar 2026

### Diagnóstico BE completado — 4 Mar 2026

> **Console/Network vacíos en el viewer — ROOT CAUSE IDENTIFICADA**
> - Pipeline backend verificado: `saveReport → getReport → SSR inject → viewer decode` ✓ (100% funcional)
> - Causa real: el content script corre en **Isolated World** (MV3). Los hooks de `window.fetch` y `console.*` interceptan el contexto del script, NO el de la página. La extensión recibe arrays vacíos y los envía vacíos.
> - **Acción requerida [FE]**: usar `world: "MAIN"` en la config del content script (manifest) + script injector para hookear en el Main World de la página.

---

### Pendiente FE
- [ ] **[FE]** Extension: agregar `Authorization: Bearer <API_SECRET>` en todas las llamadas al backend
  - `API_SECRET` vive en `secrets-iaiolabs/.env` — coordiná con BE para el valor
  - Afecta: fetch a `/analyze-bug` y `/send-report` en `Panel.tsx`
- [ ] **[FE]** Recargar extensión en Chrome con nuevo build
- [ ] **[FE/BE]** Test end-to-end: botón → panel → AI analysis → Send Report → revisar email
- [ ] **[FE]** Verificar screenshot visible en el email
- [ ] **[FE]** Verificar que platform/userAgent no muestran "Unknown"
- [ ] **[FE]** Verificar que campos password quedan tapados en el screenshot

### Pendiente BE
- [ ] **[BE]** Setear valor real de `API_SECRET` en `secrets-iaiolabs/.env`
- [ ] **[BE]** Levantar backend: `cd backend && npm run dev`

---

## 🚀 SPRINT PRÓXIMO

- [ ] **[BE]** Deploy del backend (Railway o Render) para salir de localhost
- [ ] **[FE]** Grabación de pantalla — video del flujo del bug (como Loom)
  - Requiere `chrome.tabCapture` API + MediaRecorder

---

## 📋 BACKLOG — POST LANZAMIENTO

- [ ] Integración Azure DevOps
- [ ] Integración Linear
- [ ] Integración GitHub Issues
- [ ] Panel de analytics (Pulse)
- [ ] Modo offline
- [ ] Multi-idioma

---

## 💡 IDEAS FUTURAS

- [ ] AI que graba el flujo del bug (como Loom)
- [ ] Slack notifications
- [ ] Dashboard web de reportes
