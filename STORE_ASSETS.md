# Guía de Assets para Chrome Web Store (v2.6.0)

Este documento centraliza los requisitos gráficos inamovibles que nos exigirá el Developer Dashboard de Chrome al momento de subir la extensión comercialmente, junto con tres propuestas temáticas para las capturas de pantalla promocionales que destacarán las capacidades de **IAIO Test**.

## 1. Íconos de Extension (Obligatorios)
Chrome requiere el logotipo del software estrictamente sin paddings excesivos en las siguientes densidades de pixeles. Recomendación: Transparencia PNG.

- [ ] **16 x 16 px**: Ícono del panel de extensiones y favicon del Chrome Store.
- [ ] **48 x 48 px**: Ícono usado en la ventana de gestión de extensiones local.
- [ ] **128 x 128 px**: Ícono de instalación en la pre-visualización de Store.

## 2. Marquesina Promocional (Store Header)
- [ ] **Marquesina Pequeña (440 x 280 px)**: Usualmente un patrón abstracto de fondo con el logo centrado. Sirve de cabecera visual para categorizaciones. No incluir texto que deba ser legible.
- [ ] **Banner Promocional (Opcional - 1400 x 560 px)**: Utilizado si Google nos destaca en portada.

## 3. Capturas de Pantalla (Screenshots)
*Dimensiones fijadas:* 1280 x 800 px o 640 x 400 px. Obligatoriamente 1 como mínimo, sugerimos subir las 3.

### Idea 1: "One-Click Magic" (Enfoque en UX)
- **Visual**: Un navegador de fondo desenfocado con un error de web visible, con el widget (Panel flotante [DEV MODE v2.6.0]) asomándose por la esquina inferior derecha nítido, luciendo su estilo glassmorphism.
- **Copy incrustado**: *"Reporta incidencias sin salir de la pestaña actual. En 1 clic."*

### Idea 2: "Data Focus" (Enfoque en los Diagnósticos Desacoplados)
- **Visual**: Un plano asimétrico dividido en dos pantallas, a la izquierda la vista nativa de devtools y a la derecha una captura grande del `ReportViewer` con el tab `Network` abierto y el registro marcando un error `500` coloreado en neón rosa.
- **Copy incrustado**: *"Logs de Consola y Network capturados automáticamente. Dile adiós al Copy+Paste."*

### Idea 3: "Privacy & Sync" (Enfoque Jira & Supabase)
- **Visual**: Un dashboard web elegante donde se ve el tablero kanban integrado con Supabase bajo el lema del Auth "Log in via Google", contrastando íconos de seguridad o encriptación.
- **Copy incrustado**: *"By Your Own Database. Tus tickets y bugs van directos a *tu* infraestructura."*
