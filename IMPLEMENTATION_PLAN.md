# IMPLEMENTATION_PLAN.md — iaio Test

> **Regla:** Este archivo se actualiza ANTES de escribir código para cualquier cambio que afecte más de 2 archivos o una nueva funcionalidad. Es el contrato técnico de cada sesión de trabajo.

---

## Estado Actual del Plan

**Versión activa:** `2.6.0`
**Última actualización:** `2026-03-30`
**Estado:** ✅ Sin cambios en curso — aguardando próxima tarea

---

## Plantilla para próximos cambios

> Copiar y completar esta sección cuando inicie un nuevo plan.

### Objetivo
Sanear el código de la extensión eliminando los secretos y contraseñas (Supabase URL, Anon Key, y Google Client ID) que se encontraban *hardcodeados* como variables literales en el código. Implementar un puente seguro mediante variables de entorno `VITE_*` interpretadas al momento del compilado (build-time).

### Archivos Afectados
| Archivo | Tipo de cambio | Motivo |
|---------|---------------|--------|
| `src/lib/supabase.ts` | MODIFY | Reemplazar las constantes de URL/Key por `import.meta.env.*`. |
| `src/background/index.ts` | MODIFY | Eliminar las 3 constantes duplicadas para utilizar `.env` y exportar variables validadas. |
| `/extension/package.json` | MODIFY | Bump versión a 2.5.0. |
| `/extension/public/manifest.json` | MODIFY | Bump versión a 2.5.0. |
| `src/content/Panel.tsx` | MODIFY | Modificar badge UI de Dev Mode a `v2.5.0`. |

### Decisiones Técnicas
- **Security Check temprano**: Crearemos un pequeño módulo de aserción al inicio de los archivos para asegurar que las variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_CLIENT_ID`) estén definidas en `import.meta.env`. De no estarlo, lanzará un error crítico en consola advirtiendo al developer de forma temprana sin crashear silenciosamente las llamadas asíncronas de red.
- **Evitar leaks**: No se imprimirá ningún `console.log` de los valores de `.env`.

### Checklist de QA
- [ ] Compilar extensión con `npm run build` sin errores, para verificar que Vite inyecta bien las variables.
- [ ] Confirmar visualmente que ya no queda el string pre-grabado en el código base.
- [ ] Actualizar `CHANGELOG.md` con release notes de la v2.5.0.
- [ ] Actualizar el mapamundi del proyecto en `activeContext.md`.

### Pasos de Rollback
- Revertir los cambios en `supabase.ts` y `background/index.ts` a utilizar literales de string de commit previo.

> Copiar y completar esta sección cuando inicie un nuevo plan.

### Objetivo
<!-- Describir en 2-3 oraciones qué problema se resuelve y por qué. -->

### Archivos Afectados
| Archivo | Tipo de cambio | Motivo |
|---------|---------------|--------|
| `path/to/file.ts` | MODIFY / NEW / DELETE | Razón del cambio |

### Decisiones Técnicas
<!-- Decisiones de diseño relevantes, trade-offs, alternativas descartadas. -->

### Checklist de QA
- [ ] `npm run build` sin errores en `/extension`
- [ ] Verificar referencias con grep antes de renombrar cualquier símbolo
- [ ] Probar flujo completo en extensión recargada en Chrome
- [ ] Confirmar en DevTools (background SW) que los logs esperados aparecen
- [ ] Actualizar `CHANGELOG.md` con las release notes
- [ ] Bumpar versión en `manifest.json`, `package.json` y badge de `Panel.tsx`
- [ ] Actualizar `activeContext.md` con el nuevo estado

### Pasos de Rollback
<!-- Qué hacer si la implementación falla y hay que revertir. -->

---

## Historial de Planes Completados

### Plan 2.6.0 — Store Preparation & Clean Code ✅
**Completado:** `2026-03-30`

**Objetivo:**
Acondicionar el estado general de la extensión para su entrega inicial a la Chrome Web Store mediante la depuración de logs informativos, la redacción de Metadatos SEO en Manifest.json y la escritura de los dos documentos pivótales legales (`STORE_ASSETS.md` y `PRIVACY_POLICY.md`).

**Decisiones Técnicas:**
- **Store Graphics:** Creados checklist gráficos según requerimientos rigurosos de Google Dashboard.
- **Duplicate Manifest Error:** Resuelto fallo de empaquetado donde Vite inyectaba un `manifest.json` falso en el build del `/viewer`. Ajustado en `vite.viewer.config.ts` (`copyPublicDir: false`) e incluido cascada de `rm -f dist/viewer/manifest.json` en scripts NPM para seguridad post-build.

**QA completado:** ✅ Clean build (`rm -rf dist`) libre de errores (v2.6.0). ✅ `grep console.log` verificando la erradicación total en `src/`.

---

### Plan 2.4.2 — Refactor de Datos para Diagnósticos (Supabase JSONB) ✅
**Completado:** `2026-03-30`

**Objetivo:**
Desacoplar los datos técnicos de depuración (`console`, `network`, `dom`) en columnas estructuradas separadas en Supabase. Esto permitirá que el `ReportViewer` cuente con pestañas dedicadas y fidedignas para análisis técnico, sin sobrecargar la columna `browser_info` (la cual mantenemos como backup).

**Archivos afectados:**
| Archivo | Cambio |
|---------|--------|
| `src/dashboard/types.ts` | Agregadas las claves opcionales `console`, `network`, `dom`. |
| `src/content/Panel.tsx` | Las claves de logs se inyectan en el payload `action: 'createIssue'` de `handleSubmit()`. |
| `src/viewer/ReportViewer.tsx` | Habilitadas las pestañas `console` y `network` con vistas interactivas (Componente + in-line Table). |

**Decisiones Técnicas:**
- **Backend transparente**: No fue necesario modificar `background/index.ts` dado que ya usufructúa de destructuración y pasaje dinámico (`...issueFields`).

**QA completado:** ✅ Build test sin errores (v2.4.2). ✅ Cambios marcados en `CHANGELOG.md` y `activeContext.md`.

**Incidentes Resueltos:**
- **Schema Drift (PGRST204):** Durante el test end-to-end local, falló el insert dado que la base de datos esperaba columnas precisas (`console`, `network`, `dom`) mientras el schema cache de PostgREST estaba desactualizado. Resuelto renonbrando DB columns a los campos exactos documentados, corriendo `NOTIFY pgrst, 'reload schema'` y forzando rebuild del Service Worker con un nuevo log.

---

### Plan 2.4.0 — Dashboard & Supabase Pipeline ✅
**Completado:** `2026-03-30`

### Plan 2.4.1 — Version Bump ✅
**Completado:** `2026-03-30`
