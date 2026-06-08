# CHANGELOG — iaio Test Extension

> **Regla de equipo:** Antes de entregar cualquier nueva versión, actualizar este archivo es la primera tarea obligatoria.
> Formato: versión más reciente arriba, más antigua abajo.

---

## [2.6.2] — 2026-06-03 — *"Version Sync"*

Unificación de la versión a través de todas las fuentes de verdad. Antes del submit al Web Store, las distintas fuentes mostraban valores divergentes (2.6.0 / 2.6.1 / 2.6.2 / 2.4).

### Cambios
- **Versión unificada a `2.6.2`** en las 4 fuentes:
  - `manifest.json` → `2.6.2` (la que cuenta para Chrome Web Store)
  - `package.json` → `2.6.2`
  - `Panel.tsx` → badge DEV MODE `[ DEV MODE v2.6.2 ]`
  - `Panel.tsx` → badge header `v2.6.2`

---

## [2.6.0] — 2026-03-30 — *"Store Preparation"*

Versión pulida con aspiraciones comerciales. Limpieza masiva de Output y reestructuración de imagen pública.

### Cambios
- **Limpieza de Código:** Exterminados los 29 trazadores de depuración (`console.log`) de todo el directorio de extensión `src/`. Mantenidos los trazos de error para capturar fallas silenciosas en producción controlada.
- **Copywriting y Metadata:** `manifest.json` mejorado para SEO; la herramienta ahora se promueve profesionalmente bajo "La herramienta definitiva para QA Automation".
- **Store Policies:** Documentados gráficamente (`STORE_ASSETS.md`) y redactada de cero la `PRIVACY_POLICY.md` en cumplimiento con Web Store Guidelines, puntualizando el aprovisionamiento soberano de BBDD en Supabase (BYOD).

---

## [2.5.0] — 2026-03-30 — *"Config Sanitation"*

Refactor masivo de seguridad arquitectónica. Todos los secretos que antes figuraban *hardcodeados* en el código fuente fueron desplazados hacia un archivo `.env` local para asegurar la integridad de subida al control de versiones del repositorio público/privado de IAIO Labs.

### Cambios
- **Supabase y Autenticación:** 
  - Las constantes exportadas de `src/lib/supabase.ts` y las duplicadas en `src/background/index.ts` fueron erradicadas permanentemente del código.
  - El sistema de build-time inyectará las llaves seguras desde `.env` via `import.meta.env`.
  - Agregadas salvaguardas de `throw new Error` críticos si llegasen a iniciar sin una configuración de `.env` cargada adecuadamente.
- **QA y Mantenimiento:** Limpieza de la carpeta `/dist` y compilación correcta. El `grep` verificó exitosamente que las cadenas no volvieron a escaparse en el source code.

---

## [2.4.2] — 2026-03-30 — *"Diagnósticos Técnicos Desacoplados"*

Se ha refactorizado la captura y visualización de datos de diagnóstico (`console`, `network`, `dom`) para utilizar columnas nativas estructuradas (JSONB/Text) en Supabase, permitiendo analíticas futuras independientes y un ReportViewer más robusto.

### Cambios
- **Tipos y Content Script:** 
  - La interfaz `Issue` soporta `console`, `network`, y `dom` nativos.
  - El payload enviado por `Panel.tsx` inyecta las variables `consoleEntries`, `networkEntries` y `dom` al backend.
- **Backend Background (`background/index.ts`):** 
  - Opera de forma transparente esparciendo de manera dinámica los nuevos campos insertados en Supabase gracias al `...issueFields` rest operator.
- **ReportViewer:**
  - Habilitados los tabs interactivos activos `[Console, Network, DOM]`.
  - Parseo automático en vivo y coloreo de logs de consola.
  - Visualización in-line rápida para eventos de red capturados.
- **QA:** `browser_info` mantenido por seguridad. Build sin errores.

---

## [2.4.1] — 2026-03-30

### Cambios
- Bump de versión sincronizado en los 3 archivos fuente de verdad:
  - `manifest.json` → `"version": "2.4.1"`
  - `package.json` → `"version": "2.4.1"`
  - `Panel.tsx` → badge `[ DEV MODE v2.4.1 ]`

---

## [2.4.0] — 2026-03-30 — *"Dashboard & Supabase Pipeline"*

Versión de integración completa entre el Dashboard y Supabase como única fuente de verdad. Se eliminó la dependencia del backend Express para visualización de reportes.

### Dashboard — Miniaturas (Thumbnails)

- **`types.ts`** — Se agregaron dos nuevos campos al tipo `Issue`:
  - `screenshot_url` — URL pública o pre-firmada guardada al momento del insert.
  - `screenshot_path` — Ruta en Storage para generar signed URLs on-demand.
- **`IssueCard.tsx`** — Reescrito completamente:
  - Carga la imagen real desde Supabase Storage con lógica de 3 prioridades: `screenshot_url` directo → `createSignedUrl()` desde `screenshot_path` → placeholder.
  - Shimmer skeleton animado mientras la imagen carga.
  - Placeholder elegante con logo IAIO Labs cuando no hay imagen o falla la carga.
  - `console.log` en cada paso del fetch para debugging en DevTools.

### Dashboard — Navegación al Detalle

- **`IssueCard.tsx`** y **`IssueTable.tsx`**:
  - Botón "Ver Detalle" corregido para usar `chrome.runtime.getURL('viewer/index.html')` (URL correcta dentro del contexto de extensión).
  - Pasan tokens de sesión (`#at=...&rt=...`) en el hash de la URL al abrir el viewer para que las queries RLS-protegidas funcionen en la nueva pestaña.

### ReportViewer — Migración a Supabase

- **`ReportViewer.tsx`** — Reescrito completamente:
  - Ahora fetchea el issue desde Supabase: `supabase.from('issues').select('*').eq('id', id).single()`.
  - Reemplaza el viejo `fetch('/api/report/${id}')` al backend Express que nunca funcionó dentro del contexto de extensión Chrome.
  - Hereda la sesión desde los tokens del hash de URL (mismo patrón que el Dashboard).
  - Loading state controlado: spinner mientras carga, mensaje de error específico si falla (incluyendo código `PGRST116` para "no encontrado").
  - Genera `signedUrl` para el screenshot si existe `screenshot_path`.
  - Placeholder IAIO Labs si no hay imagen disponible.
  - `console.log` claro en cada paso: sesión, fetch, imagen.

### Background — Pipeline de Screenshot a Storage

- **`background/index.ts`** — Handler `createIssue` actualizado:
  - Separa `screenshotBase64` del resto del payload antes del INSERT.
  - Convierte el base64 a `Blob` con `dataUrlToBlob()` (funciona en Service Worker, sin APIs de DOM).
  - Sube al bucket `screenshots` con ruta `{userId}/issue_{timestamp}.png`.
  - Bucket público → usa `getPublicUrl()` para obtener una URL permanente sin token.
  - Upload **no-fatal**: si la imagen falla, el reporte igual se crea correctamente.
  - Logs QA diferenciados: `✅` upload ok, `❌` upload fallido, `🌐` URL pública obtenida.
  - Cambió `Prefer: return=representation` para recibir el `id` del issue creado.
  - Helper `dataUrlToBlob()` con validación de entrada: guarda contra URL malformada o payload vacío.

### Panel — Envío de Screenshot

- **`Panel.tsx`** — Handler `handleSubmit` actualizado:
  - Incluye `screenshotBase64: screenshot` en el payload de `createIssue`.
  - Usa el `issueId` retornado por el background para construir el link del viewer (`viewer/index.html?id={issueId}`) sin depender del backend Express.
  - El backend Express queda como llamada secundaria no-bloqueante solo para envío de email.

---

*Generado por Antigravity (iaio Labs AI pair programmer)*
