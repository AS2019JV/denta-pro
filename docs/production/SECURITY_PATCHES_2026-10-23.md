# Candidato de parches de seguridad — 23 octubre 2026

Base inmutable: `902999c6b7b7ee696982d87e8ce7f6e5087f75e2`. Su CI `39987122895` falló en audit; sus 430 pruebas locales no se convierten en aceptación de este sucesor.

## Cambio y consumo real

Se fija Next.js **15.5.28** dentro de la misma versión mayor y se actualiza DOMPurify transitivo **3.4.16 → 3.4.17**, admitido por `jspdf@4.2.1` (`^3.3.1`). El lockfile actualiza únicamente Next, @next/env, sus ocho binarios SWC y DOMPurify. Se conserva React18, jsPDF4.2.1, sharp0.35.5 y todos los controles de CI.

La aplicación usa App Router y Server Actions de autenticación y recetas; por ello aplica el aviso [GHSA-p3m5-59mp-jv5r](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r), cuyo decoder recibe solicitudes antes de la validación de negocio. El [boletín oficial](https://nextjs.org/blog/nextjs-security-update-october-14-2026) prescribe15.5.28. No se ejecutó un ataque de agotamiento contra servicios compartidos; la corrección se acredita por resolución de versiones, audit y compatibilidad, sin afirmar una reproducción del exploit.

El aviso de imágenes [GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) depende de Image Optimization y Linux/glibc. El lockfile base ya imponía sharp0.35.5, workaround oficial. El árbol mutable instalado en la raíz de trabajo contenía0.35.4; ese árbol no se usa como candidato ni como evidencia de instalación reproducible. Debe comprobarse sharp desde la resolución del propio Next tras `npm ci`.

DOMPurify es una dependencia opcional de jsPDF. Los consumidores `lib/pdf-generator.ts`, `lib/pdf-generator-budget.ts` y `lib/reports-pdf.ts` generan texto/tablas/imágenes; no llaman `doc.html()` ni al sanitizador. Los modos no predeterminados afectados no son una ruta de explotación demostrada de Clinia+. Se elimina de todos modos la versión afectada mediante su patch compatible. Véanse [release3.4.17](https://github.com/cure53/DOMPurify/releases/tag/3.4.17) y [aviso de shadow roots](https://github.com/cure53/DOMPurify/security/advisories/GHSA-cg2g-xh64-v4q7).

## Verificación exigida para este sucesor

- Instalación desde lockfile sin scripts de ciclo de vida, audit de producción sin filtros ni excepciones.
- Resolución instalada de Next/DOMPurify/sharp, revisión del diff y regresiones existentes de PDF real, publicación, autoridad, autenticación y middleware.
- CI propia completa: secret scan, audit, tipos, lint, pruebas y build. Los recibos posteriores deben vincular el SHA exacto; este documento no anticipa su resultado.
- Preview exacto con staging `phihonofwyerpfgqfekt`, nunca configuración de producción ni `clinia-test`. La configuración de una rama anterior no se presume heredada.

## Reutilización y límites

El delta no cambia SQL, scripts de recuperación, perfil, manifiesto, Auth/MFA de Supabase ni sus imágenes. La recuperación p8 conserva únicamente su alcance cerrado respecto al backup anterior: dos MFA originales y53bytes,130.356s locales, sin RPO actual ni SLA. No se repite restore. No prueba recorridos web de este candidato ni adopción histórica alojada.

La demo requiere cuentas sintéticas existentes y sesiones ordinarias. No se habilitan miembros, principal documental o permisos para eludir un fallo. Un principal previamente desactivado puede bloquear archivo privado; se registra el resultado y se solicita una autorización separada si exige configuración compartida.

Producción NO-GO. No se modifica esquema/configuración compartida, ledger, invitación protegida, clinia-test ni M7. La demo no sustituye aceptación clínica/privacidad ni gates obligatorios.
