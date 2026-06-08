# CLAUDE.md — IAIO Test

Archivo de contexto para Claude Code. Se carga automáticamente al inicio de cada sesión.

---

## Working Agreement — Cofounder Mode

> Esta sección define **cómo trabajamos juntos**, no qué construimos. Tiene prioridad sobre cualquier comportamiento por defecto. El owner trabajó antes con un asistente que tomaba decisiones de rumbo por su cuenta y era complaciente; eso le generó ansiedad y un rumbo incierto. No repetir ese patrón.

1. **El rumbo lo marca el owner.** Decisiones de dirección —publicar, deployar, migrar arquitectura, cambiar de prioridad— NUNCA se toman unilateralmente. Se ponen sobre la mesa con opciones y trade-offs, y el owner elige. Yo ejecuto y advierto riesgos; no fijo el destino.

2. **Honestidad por encima de complacencia.** Decir lo que es verdad aunque no guste. Nada de "sí a todo". Si algo está mal, incompleto, o es mala idea, se dice claro y con el porqué. Un cofounder complaciente hunde el barco más rápido.

3. **Cambios quirúrgicos, verificados.** Leer antes de tocar. Editar lo mínimo necesario. Verificar (build/typecheck) antes y después. No romper lo que ya funciona.

4. **Explicar el porqué, no solo el qué.** La ansiedad nace de la incertidumbre. Cuando hay un riesgo o una decisión técnica, explicarla en términos claros para que el owner entienda el panorama, no solo el resultado.

5. **Memoria compartida contra el drift.** `CLAUDE.md` (arquitectura + este acuerdo) y `TASKS.md` (sprint activo) son el contrato. Arrancar cada sesión leyéndolos para no perder el hilo entre back y front.

6. **Antes de pedir un E2E, auditar los 3 ejes MV3.** No solo el contrato de datos. Los tres ejes son:
   - **Data** — back↔front: tipos, shapes, nombres de campo en toda la cadena.
   - **Auth** — OAuth client_id, redirect_uri (`chrome.runtime.id`), key del manifest, scopes, ID del store vs unpacked. Especialmente: si el manifest no tiene `"key"`, el extension ID es inestable y el redirect URI autorizado en Google Cloud Console se desincroniza con cualquier cambio de path.
   - **Permissions** — host_permissions, permissions, CSP, masking, RLS de Supabase.

---

## Product Overview

**IAIO Test** es una extensión de Chrome para reporte de bugs. El usuario objetivo es horizontal: equipos de QA en empresas, desarrolladores solos, y cualquier persona que necesite reportar un bug en una web.

**Problema que resuelve:** cuando un tester encuentra un bug, la información que llega al desarrollador suele ser incompleta ("el botón no funciona"). IAIO Test captura automáticamente el contexto completo del browser en el momento exacto del bug.

**Propietario / equipo:** proyecto solo dev. Backend en localhost, Chrome Web Store como próximo hito de deploy.

---

## User Flow (completo)

```
[Cualquier página web]
       │
       ▼
 Botón flotante iaio (bottom-right, inyectado por content script)
       │
       ▼
 Panel React se abre
  ├── Screenshot capturado automáticamente (mask → capture → unmask)
  ├── Console logs capturados (via inject.js en Main World)
  ├── Network requests capturados (via inject.js en Main World)
  └── DOM snapshot capturado
       │
       ▼
 Usuario completa: Título + Notas opcionales
       │
       ▼
 Background Service Worker:
  ├── Sube screenshot a Supabase Storage (bucket: screenshots)
  └── Inserta issue row en Supabase DB
       │
       ├──► Link al Report Viewer generado (chrome-extension://...viewer/index.html?id=X)
       └──► [Opcional / no-bloqueante] Backend Express → email via Resend SDK
       │
       ▼
 Dashboard (ícono grilla en header del Panel)
  ├── Lista todos los issues del usuario (Supabase, filtrado por user_id)
  ├── Vista Cards (thumbnails con shimmer) o Table
  └── "Ver Detalle" → Report Viewer
       │
       ▼
 Report Viewer (página standalone)
  ├── Tab Info    → título, descripción, severidad, metadata del device
  ├── Tab Console → logs capturados coloreados
  ├── Tab Network → requests con método, status, URL
  └── Tab DOM     → snapshot del HTML al momento del bug
```

---

## Architecture

### Capas de la extensión (MV3)

| Contexto | Archivo | Rol |
|---|---|---|
| Content Script | `src/content/index.ts` | Inyecta botón, hookea mensajes de inject.js, masking de campos sensibles |
| Content Script | `src/content/Panel.tsx` | UI React principal (panel flotante) |
| Main World Script | `public/inject.js` | Hookea `console.*` y `fetch/XHR` en el contexto real de la página |
| Background SW | `src/background/index.ts` | Auth Google OAuth, captura screenshot, upload a Storage, insert a Supabase |
| Viewer/Dashboard | `src/viewer/ReportViewer.tsx` | Página standalone de detalle del reporte |
| Viewer/Dashboard | `src/dashboard/Dashboard.tsx` | Página standalone con todos los reportes del usuario |

### Backend Express (`backend/src/`)

Capa secundaria — **no es la fuente de verdad**. Su rol actual es email (Resend SDK) y Jira (opcional). El futuro del backend está por definir; puede migrar a Supabase Edge Functions.

### Base de datos

**Supabase** es la única fuente de verdad. Tabla principal: `issues`. Bucket de storage: `screenshots` (público — usa `getPublicUrl()`).

---

## Extension ID Stability — `key` en manifest (crítico)

El `manifest.json` incluye un campo `"key"` (public key RSA en base64 DER). **No tocar sin entender por qué.**

- **Por qué:** Chrome deriva el extension ID de esa key. Sin `"key"`, el ID se deriva del path del unpacked y cambia si movés la carpeta o publicás al store → rompe `chrome.identity.launchWebAuthFlow` (redirect URI mismatch).
- **ID determinístico actual:** `bdeopioingmemofeejeiehmfogijakje`
- **Redirect URI autorizado en Google Cloud:** `https://bdeopioingmemofeejeiehmfogijakje.chromiumapp.org/`
- **Private key:** vive en `extension/.keys/iaio_test_key.pem` (gitignored, permisos 600, NO commitear NUNCA). Si se pierde, hay que regenerar key + reconfigurar el redirect URI en Google Cloud.
- **Al subir al Chrome Web Store:** el store acepta la `"key"` del manifest y mantiene el mismo ID. Cero reconfiguración. NO eliminar la `"key"` del manifest al empaquetar para el store.

## Auth Pattern (crítico)

**Regla de oro:** los content scripts NUNCA importan el cliente Supabase directamente. Toda operación de auth se delega al background via `chrome.runtime.sendMessage`.

```
Panel.tsx / Dashboard / Viewer
        │  sendMessage({ action: 'getSession' })
        ▼
Background Service Worker
        │  supabase.auth.getSession()
        ▼
ChromeStorageAdapter (chrome.storage.local)
```

**ChromeStorageAdapter** (`src/lib/supabase.ts`): adaptador custom que hace de puente entre la interfaz de storage de Supabase JS y `chrome.storage.local`. Mantiene un cache en memoria para que las lecturas sean síncronas. **Siempre llamar `await waitForStorage()`** antes de cualquier operación de auth.

**Hash token handoff:** cuando el Panel abre el Dashboard o el ReportViewer, pasa los tokens de sesión en el hash de la URL (`#at=ACCESS_TOKEN&rt=REFRESH_TOKEN`). La página destino llama `supabase.auth.setSession(...)` y luego limpia el hash con `history.replaceState()`.

---

## Build System

Tres configuraciones Vite independientes que se corren en secuencia:

```bash
# Orden correcto de build:
vite build --config vite.config.ts        # Content script → dist/src/content/index.js (IIFE)
vite build --config vite.bg.config.ts     # Background SW  → dist/src/background/index.js (ESM)
vite build --config vite.viewer.config.ts # Viewer/Dashboard → dist/viewer/ (React app)
```

`vite.config.ts` es el único que tiene `emptyOutDir: true` — los otros no limpian `dist/` para no sobreescribirse entre sí.

---

## Environment Variables

### Extension (`extension/.env`) — no commitear

```env
VITE_SUPABASE_URL=           # URL del proyecto Supabase
VITE_SUPABASE_ANON_KEY=      # Anon key pública de Supabase
VITE_GOOGLE_CLIENT_ID=       # OAuth 2.0 Client ID (debe coincidir con manifest.json oauth2)
VITE_BACKEND_URL=http://localhost:3000  # URL del backend Express
VITE_API_SECRET=             # Mismo valor que API_SECRET del backend (para auth de endpoints)
```

Las vars se inyectan en build time via `define` en los tres Vite configs (`process.env.VITE_*`).

### Backend (en `secrets-iaiolabs/.env`, fuera del repo)

```env
API_SECRET=          # Bearer token para proteger endpoints de mutación
RESEND_API_KEY=      # API key de Resend para envío de emails
FROM_EMAIL=          # Email remitente
ANTHROPIC_API_KEY=   # Actualmente no usado (AI analysis mocked)
PORT=3000
```

El backend carga secrets desde `SECRETS_PATH` env var. En dev, fallback a ruta local hardcodeada (solo funciona en la máquina del dev).

---

## Key Patterns & Decisions

**Screenshot masking:** el background orquesta `mask → captureVisibleTab → unmask`. Los campos sensibles (password, cc-number, cvv, tokens, etc.) se cubren con divs overlay antes de la captura.

**Non-fatal uploads:** si el upload del screenshot a Storage falla, el issue se crea igual en la DB sin screenshot. El error no bloquea el reporte.

**Main World injection:** `inject.js` se inyecta como `<script src="...">` en el DOM (no como content script) para acceder al `window` real de la página y hookear `console.*` y `fetch/XHR`. Comunica los eventos al content script via `window.postMessage` con `source: 'iaio-test-hook'`.

**Email es no-bloqueante:** el fetch al backend `/send-report` tiene `.catch()` que absorbe cualquier error. El issue ya está guardado en Supabase antes de este paso. Si el backend no está corriendo, el reporte se guarda igual.

**Backend auth:** todos los endpoints de mutación requieren `Authorization: Bearer <API_SECRET>`. Si `API_SECRET` no está seteado en el backend, el middleware avisa y deja pasar (comportamiento dev-safe). Endpoints públicos: `/health`, `/report/:id`, `/api/report/:id`.

---

## Sprint Context

> **Regla de sesión:** Antes de implementar cualquier tarea, leer `TASKS.md` para conocer el sprint activo.
> `CLAUDE.md` = arquitectura, patrones y objetivos de mediano/largo plazo (no cambia frecuentemente).
> `TASKS.md` = qué hay que hacer esta semana (se actualiza en cada sesión de trabajo).

---

## Current State

- **Versión:** 2.6.0 (CHANGELOG) — hay un mismatch con el badge en `Panel.tsx` (muestra v2.6.1 en un lugar y v2.4 en otro)
- **AI analysis:** desactivado / mocked. El plan está por definir (BYOK vs servicio propio).
- **Backend:** solo localhost, no deployado.
- **Próximo hito:** publicación en Chrome Web Store.

### Deuda técnica conocida

| Severidad | Issue |
|---|---|
| Media | Mismatch de versión en `Panel.tsx` (badge DEV MODE vs badge header) |
| Media | SVG attrs con kebab-case en JSX (`stroke-width` debe ser `strokeWidth`) — genera warnings |
| Media | CORS abierto (`app.use(cors())`) — necesita restricción de origins en producción |
| Baja | Dead code: función `mapError()` en Panel.tsx (definida, nunca llamada) |
| Baja | Dead code: función `injectFonts()` en content/index.ts (vacía, nunca llamada) |
| Baja | Empty else block en background/index.ts línea ~233 |
| Baja | Path de secrets hardcodeado en server.js (solo funciona en la máquina del dev) |

---

## File Map (rutas importantes)

```
extension/
├── src/
│   ├── content/
│   │   ├── index.ts          # Entry point del content script
│   │   ├── Panel.tsx         # UI principal (panel flotante React)
│   │   ├── ImageEditor.tsx   # Editor de anotaciones sobre el screenshot
│   │   ├── authService.ts    # Wrapper de auth para content scripts (via sendMessage)
│   │   └── InteractiveInspector.tsx
│   ├── background/
│   │   └── index.ts          # Service worker: auth, screenshot, Supabase insert
│   ├── viewer/
│   │   ├── ReportViewer.tsx  # Vista de detalle del reporte (4 tabs)
│   │   ├── ConsoleViewer.tsx
│   │   ├── DOMTreeViewer.tsx
│   │   └── index.tsx
│   ├── dashboard/
│   │   ├── Dashboard.tsx     # Lista de todos los reportes del usuario
│   │   ├── IssueCard.tsx     # Card con thumbnail (shimmer + signed URL)
│   │   ├── IssueTable.tsx    # Vista tabla alternativa
│   │   └── types.ts          # Interface Issue (tipo principal del dominio)
│   └── lib/
│       └── supabase.ts       # Cliente Supabase + ChromeStorageAdapter + waitForStorage
├── public/
│   ├── inject.js             # Script de Main World (hookea console + fetch)
│   └── manifest.json         # MV3 manifest
├── vite.config.ts            # Build: content script (IIFE)
├── vite.bg.config.ts         # Build: background SW (ESM)
└── vite.viewer.config.ts     # Build: viewer + dashboard (React app)

backend/src/
├── server.js                 # Express app, endpoints, rate limiting
├── authMiddleware.js         # Bearer token guard
├── aiService.js              # Anthropic SDK (actualmente mocked)
├── emailService.js           # Resend SDK
├── jiraService.js            # Jira REST API v3 (opcional)
└── storageService.js         # Persistencia local JSON (legacy, Supabase es la fuente de verdad)
```
