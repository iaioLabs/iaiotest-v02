# Política de Privacidad de IAIO Test

**Última actualización:** 30 de Marzo, 2026

En **IAIO Labs**, priorizamos el control soberano sobre tu información. IAIO Test ha sido concebida bajo el modelo estructural BYOD (*Bring Your Own Database*). Esta extensión funciona únicamente como un mediador silencioso, no almacenando remotamente ni minando telemetría de tus hábitos de navegación bajo nuestra propia infraestructura.

### 1. ¿Qué datos recopilamos?
Al operar, IAIO Test obtiene acceso temporal para recopilar bajo el accionar explícito del usuario (mediante click en "Crear Reporte"):
- Información técnica sobre el Documento Visible (DOM Snapshot).
- Entradas interceptadas de la consola de desarrollo de esa pestaña (`console.log`, `error`, etc).
- Datos interceptados de la red y peticiones originadas por la pestaña.
- Una o varias capturas de pantalla de la ventana visible del navegador, excluyendo pestañas background o inalteradas.
- Información básica de metadata referida a sesión y usuario Google de la autenticación OAuth2 requerida.

### 2. ¿Dónde se alojan estos datos?
La característica distintiva de QA Automation de **IAIO Test** reside en que la herramienta inyecta esta información única y directamente en una instancia hospedada y configurada por su propia agencia, empresa o equipo (*tu* infraestructura Supabase vinculada por variables de entorno locales). 
- **No mantenemos bases de datos centralizadas de IAIO Labs** para recibir o interrogar este tráfico saliente.
- Ningún dato es analizado sin el consentimiento explícito brindado al presionar el panel de captura.
- Las capturas de pantalla son dirigidas directamente hacia los Buckets de Storage autorizados con tokens limitados JWT RLS controlados por el ecosistema de tu servicio DBaaS elegido.

### 3. Autenticación (Google OAuth)
Recopilamos permisos de identidad mediante la API oficial de logueo social (Google Identity Services) exclusivamente para vincular cryptográficamente el reporte emitido en tu navegador con una Fila autenticada permitida mediante Row Level Security. No conservamos ni guardamos las contraseñas provistas de terceros. Nuestra extensión asume flujos implícitos invisibles.

### 4. Cambios a nuestra política
Cualquier alteración a esta política se anunciará bajo nuevas versiones de despliegue mediante actualizaciones automatizadas controladas por las políticas del Chrome Web Store. Tus datos pasados operados mediante software client-side anterior a la promulgación ya estriban ajenos a nuestra intromisión de resarcimiento o acceso.

Si usted o su oficina tiene dudas sobre la seguridad e higiene perimetral en la aplicación, por favor comuníquese con el equipo DevSecOps en support@iaiolabs.com.
