# iaio Test — Task Board

> **Regla de sesión:** Antes de empezar cualquier tarea, consultá este archivo.
> Cuando completás algo, movelo a ✅ COMPLETADO.
> **BE** = Backend | **FE** = Frontend/Extension

---

## 🔄 SPRINT ACTIVO — 24 May 2026

### Objetivo del sprint: preparación Chrome Web Store

#### En curso
- [ ] **[BLOCKER 🔴 SUPABASE]** El proyecto Supabase `oojifvsjhuwixqjvraqg.supabase.co` no resuelve en DNS (NXDOMAIN). Es la "fuente de verdad" según CLAUDE.md y está caída/eliminada. Descubierto al validar el login post-fix del redirect_uri. Pendiente: verificar en app.supabase.com qué pasó, y o bien restaurar el proyecto, o crear uno nuevo + reconstruir schema (tabla `issues` + bucket `screenshots` + RLS) y actualizar `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` en `.env`.
- [ ] **[BE]** Restringir CORS — reemplazar `app.use(cors())` abierto por origins específicos (mejor hacerlo cuando definamos el dominio del backend deployado + el ID definitivo de la extensión en el store)

---

## 🚀 SPRINT PRÓXIMO

- [ ] **[FE]** Selector de severidad en el formulario del Panel (baja prioridad) — hoy `severity` está hardcodeado a `'medium'`; el viewer/dashboard ya tienen la UI de colores low/medium/high lista, falta el control para elegirla
- [ ] **[BE]** Deploy del backend (Railway o Render) — salir de localhost
- [ ] **[BE/FE]** Resolver el doble sistema de reportes: el email apunta a `.../report/:id` (storage local legacy del backend), no al viewer de Supabase de la extensión. Decidir cuál es el canónico al deployar (recomendado: link al viewer de Supabase)
- [ ] **[FE]** Verificar flujo completo E2E post-deploy: botón → panel → send report → email
- [ ] **[FE/STORE]** Submit a Chrome Web Store — preparar assets, screenshots, descripción
- [ ] **[FE/AUTH]** Verificar OAuth consent screen en Google Cloud Console: estado (Testing vs Production), test users si Testing, branding/scopes si va a Production. Sin esto, usuarios fuera de la lista de test users ven "Access blocked"
- [ ] **[FE/AUTH]** Housekeeping: eliminar OAuth client legacy `Login iaioTest Local` (tipo Extensión de Chrome, `752859870848-b2cl...`) en proyecto `iaiotest-dev`. No se usa (el código usa `launchWebAuthFlow` que requiere el tipo Aplicación web). HACER SOLO DESPUÉS de validar que el login funciona con el cliente actual.

---

## 📋 BACKLOG — POST LANZAMIENTO

- [ ] Screen recording del bug (como Loom) — requiere `chrome.tabCapture` + MediaRecorder
- [ ] Integración Azure DevOps
- [ ] Integración Linear
- [ ] Integración GitHub Issues
- [ ] Panel de analytics (Pulse)
- [ ] Modo offline
- [ ] Multi-idioma

---

## 💡 IDEAS FUTURAS

- [ ] AI que graba y analiza el flujo del bug
- [ ] Slack notifications
- [ ] Dashboard web de reportes
- [ ] BYOK (Bring Your Own Key) para AI analysis

---

## ✅ COMPLETADO

### Sprint Web Store (Jun 2026)
- [x] **[FE/AUTH]** Fijar extension ID permanente vía `"key"` RSA en `manifest.json`. Resuelve `redirect_uri_mismatch` para siempre (unpacked y store comparten ID). Private key en `extension/.keys/` (gitignored). ID nuevo: `bdeopioingmemofeejeiehmfogijakje`. Documentado en CLAUDE.md.
- [x] **[FE]** Versión unificada a `2.6.2` en las 4 fuentes (manifest, package.json, ambos badges de Panel.tsx) + entrada en CHANGELOG
- [x] **[FE/BE]** Auditoría de consistencia back↔front del contrato `Issue` — ruta de Supabase (Panel → background → viewer/dashboard) verificada 100% consistente, incluyendo shapes anidados de console/network
- [x] **[BE]** Limpieza del payload de email en `server.js`: `sendBugReport()` ahora recibe solo los 5 campos que el email usa de verdad (eliminados parámetros fantasma que `emailService` ignoraba)
- [x] **[FE]** SVG attrs kebab-case → camelCase en `Panel.tsx` (8 ocurrencias: stroke-width/linecap/linejoin) — verificado que los SVG de `content/index.ts` quedan en kebab-case porque van por `innerHTML` (no son JSX)
- [x] **[FE]** Eliminada función muerta `mapError()` en `Panel.tsx`
- [x] **[FE]** Eliminada función muerta `injectFonts()` en `content/index.ts`
- [x] **[BE]** Eliminado empty else block en `background/index.ts`

### Infraestructura
- [x] Estructura base del proyecto v2 (extension + backend)
- [x] Manifest MV3 sin popup estándar
- [x] Build system: tres Vite configs (IIFE content + ESM background + React viewer/dashboard)
- [x] Extension carga correctamente en Chrome
- [x] `.env` + `.env.example` con vars de entorno
- [x] `.gitignore` — `.env` y `node_modules/` protegidos
- [x] Secrets movidos a ruta externa (`/secrets-iaiolabs/.env`) — fuera del repo
- [x] Path de secrets parametrizado (`SECRETS_PATH` env var + fallback dev)

### Extension (FE)
- [x] Background service worker (`captureVisibleTab`)
- [x] inject.js en Main World — hookea `console.*` y `fetch/XHR` del contexto real de la página
- [x] Botón flotante bottom-right con diseño iaio Labs (cyan glow)
- [x] Panel React inyectado en página (z-index máximo, sin shadow DOM)
- [x] Screenshot preview en el panel
- [x] Masking de campos sensibles antes del screenshot (password, cc, CVV, tokens)
- [x] Campo de email persistido en `chrome.storage.sync`
- [x] Formulario: título + notas opcionales
- [x] Dashboard — lista de issues (Cards con shimmer + Table view)
- [x] Report Viewer — 4 tabs (Info / Console / Network / DOM)
- [x] ImageEditor — anotaciones sobre el screenshot (canvas merge)
- [x] Google OAuth — auth via background service worker
- [x] ChromeStorageAdapter + `waitForStorage()` — bridge Supabase ↔ chrome.storage.local
- [x] Hash token handoff — paso de sesión del Panel al Dashboard/Viewer via URL hash
- [x] `Authorization: Bearer <API_SECRET>` en llamadas al backend

### Backend (BE)
- [x] `emailService.js` con Resend SDK — email de notificación con link al viewer
- [x] `aiService.js` — Anthropic SDK (actualmente mocked / fallback)
- [x] `jiraService.js` (Jira REST API v3 — opcional)
- [x] `storageService.js` — persistencia local de reportes (JSON + PNG)
- [x] Rate limiting (`express-rate-limit`) en todos los endpoints
- [x] Auth middleware — `Authorization: Bearer <API_SECRET>` en endpoints de mutación
- [x] Health check enriquecido (`GET /health`) con stats
- [x] Reports API — `GET /api/reports` paginado + `DELETE /api/report/:id`
- [x] Seguridad BE actualizada con dev (May 2026) — revisión de secrets y middleware
- [x] CLAUDE.md creado — contexto arquitectural para Claude Code

### Store Preparation
- [x] Limpieza de `console.log` de debug (29 trazadores eliminados)
- [x] `PRIVACY_POLICY.md` redactada
- [x] `STORE_ASSETS.md` documentado
- [x] `manifest.json` mejorado para SEO/store
