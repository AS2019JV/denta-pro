# Clinia+ — Integración local de autoridad, pacientes y recetas

Fecha: 27-09-2026, Ecuador. Base Git `f96fbb898ec2a0615dec293ee3e5ce0a9b41b170`, con cambios previos conservados y sin commit nuevo. Entorno: Supabase Docker `clinia-acceptance`, frontend optimizado local en `127.0.0.1:3400`. **Estado global PARCIAL / NO-GO clínico.** Sin despliegue ni mutaciones de producción.

## Contrato y cinco preguntas

| Comportamiento | Por qué existe | Qué debe ocurrir | Qué no debe ocurrir | Verificación | Reversión |
| --- | --- | --- | --- | --- | --- |
| Autoridad y cambio de clínica | Aplicar permisos actuales por clínica | Identidad verificada, perfil activo, membresía activa y rol RPC coincidentes; invalidación de caché y formularios al cambiar autoridad | Permisos de metadata; respuesta tardía restaura una sesión revocada; datos anteriores visibles durante resolución | Pruebas conductuales de AuthProvider, middleware y consultas; JWT reales del entorno sintético | Retirar solo hunks propios; no reintroducir fallback inseguro para resolver un error |
| Dashboard operativo | Facilitar tareas de recepción y odontólogo | Totales separados de muestras; consultas delimitadas; alta demográfica compartida; errores y reintento | Finanzas, comparaciones ficticias o éxito ficticio de notificaciones | Fixtures de conteo y navegador; contratos con fallo/abort/respuesta tardía | Hunks de dashboard, hooks, selector y control técnico |
| Lista demográfica | Registrar y editar sin exponer historia clínica a recepción | Búsqueda, paginación de servidor, edición validada y conteo exacto | Exportación parcial anunciada como completa; formulario clínico para recepción | Alta/edición local real, persistencia de teléfono/fecha y segunda página | Hunks de lista/helper; conservar registros persistidos |
| Acceso rápido a recetas | Elegir el paciente antes de abrir su editor | Selección, URL con pestaña, recarga y Atrás coherentes | 404, paciente ajeno o acceso clínico de recepción | Navegador con Auth real; autorización de guardado tiene pruebas de código separadas | Hunks de navegación/editor/acción, sin eliminar recetas |
| URL del entorno local | Conservar el alcance de cookies de Auth | Redirecciones en el mismo origen loopback configurado | Cambio involuntario a localhost; relajación de CSP de producción | Middleware, configuración y navegador en build optimizado | Retirar opción local y reconstruir; detener solo proceso de ensayo |

## Cambios integrados

- `lib/clinic-authority.mjs`, `components/auth-context.tsx`, `components/dashboard-wrapper.tsx`, `middleware.ts`: selección de clínica autorizada por datos actuales, sin confiar en roles de metadata; cancelación e invalidación inmediata de respuestas anteriores. El listener de Auth agenda las consultas fuera del callback síncrono para evitar el bloqueo del cliente. No sustituye RLS ni autorización en servidor.
- `hooks/use-dashboard-data.ts`, dashboard y selector: RPC demográfico/agenda/personal, conteos separados de listas limitadas, alcance clínica/actor/rol y errores visibles. Alta rápida lleva al mismo formulario demográfico en `/patients?new=1`.
- Lista y detalle de paciente con helpers `patient-demographics`/`patient-detail`: recepción conserva demografía y agenda; detalle clínico restringido. Retiradas interfaces financieras y familiares de estas superficies. Tutores y CSV siguen pendientes de sus encargos.
- Recetas consulta `cedula`, sin columna inexistente `identification`. HCU vacío utiliza `maybeSingle`, con filtro explícito de clínica y paciente. No se verificó emisión de PDF ni acreditación profesional en este recorrido.
- Sidebar retira campana/eventos y mensajes ficticios; notificaciones reales y apertura revisada de WhatsApp siguen en10A.
- Fuentes del sistema sustituyen descargas externas de Google. Configuración local permite solo la API loopback exacta cuando el launcher aislado la habilita. El launcher blanquea variables de archivos dotenv existentes y configura únicamente Supabase sintético; proveedores externos deshabilitados.

## Evidencia y límites

Las pruebas de aplicación reúnen **64 comprobaciones de código aprobadas**: autoridad/carrera/CSP8, recetas11, middleware3, retiro financiero13, dashboard8, detalle10 y demografía11. Son pruebas unitarias/contractuales con dobles de dependencias; no64 recorridos desplegados. El delta final de configuración repite CSP/middleware en [canonical-config-tests.log](evidence/2026-09-27/canonical-config-tests.log).

Evidencia de APIs reales separada: [Auth/RPC/PostgREST/Storage](evidence/2026-09-27/auth-matrix/execution.json), [perfil con JWT previo](evidence/2026-09-27/auth-profile-state/execution.json) y [auditoría/derechos continuada](evidence/2026-09-27/auth-rights-continued/execution.json). Se conservan fallos iniciales de fixtures y expectativas, junto a sus correcciones; no se reescriben como éxitos.

El [registro final](evidence/2026-09-27/frontend-ui-verification.json) conserva los exit codes reales: build 0, configuración/middleware 4/4, recepción 0, login propietario 0 y navegación de recetas 0. El [build final](evidence/2026-09-27/frontend-build-loopback-normalization.log) no desactiva tipos/lint y conserva advertencias de otras pantallas. [Huellas de 24 fuentes seleccionadas y BUILD_ID](evidence/2026-09-27/frontend-source-manifest.json), sin afirmar snapshot completo de release. Comprobadas intactas al cerrar. JSON de resultados validado. `git diff --check` informa espacios finales y una línea vacía final en dashboard/detalle: pendiente cosmético, sin alterar las fuentes del build verificado.

En navegador real: dashboard informa 32 pacientes de clínica A; recepción mantiene teléfono editado y fecha 1990-01-01 del alta anterior, búsqueda y página 2, sin botón clínico ni financiero; la ficha clínica directa vuelve al listado en el mismo origen. Recetas pasa selección, URL de pestaña, recarga y Atrás. No se emitió receta ni se descargó PDF. La primera prueba creó un solo paciente y editó su teléfono; las dos continuaciones no repiten mutaciones.

Capturas sintéticas: [recepción](../../output/playwright/reception-patients-canonical.png) y [editor](../../output/playwright/owner-recipes-loopback.png). Revisión visual a1280px: listado claro y jerarquía funcional; editor de receta con columnas estrechas y campos truncados, pendiente11. No se acepta responsive/oscuro/accesibilidad por estas capturas. Logs con código de login, contraseñas y JWT permanecen en `.temp`, ignorado por Git; solo resultados permitidos y [salida redactada](evidence/2026-09-27/browser-reception-loopback.redacted.log) se publican como evidencia.

## Fallo encontrado durante verificación

El primer recorrido de recepción completó alta y edición, pero el acceso directo a ficha clínica redirigió a `localhost` y perdió la cookie de `127.0.0.1`. Un test aislado del middleware no detectó la segunda normalización del adaptador de Next.js15.5.26. Se conserva el intento fallido y se corrige `skipMiddlewareUrlNormalize` únicamente en aceptación local, además del destino canónico. [Opción oficial para Next15](https://nextjs.org/docs/15/app/api-reference/file-conventions/middleware#advanced-middleware-flags). No se repite la mutación para comprobar la corrección.

## Próximos gates, en orden

1. **01/02:** concluir forward de convergencia scoped stage/prod, constraints/FK/typmods/sequence/callbacks con preflight que no corrija datos arbitrariamente. Obtener dump/configuración remota de solo lectura; catálogo JSON no es respaldo. Completar matriz02, contención y restauración, revocación concurrente, MIME/tamaño y consumidores de imágenes privadas con URL firmada. No habilitar clientes financieros como atajo.
2. **04/05/06:** adaptar calendario/catálogo/reportes/configuración/exportación restantes; crear servicio con autorización de servidor (INSERT cliente está cerrado); cero lecturas financieras en flujos activos. Luego estados/UTC–Guayaquil y restricción transaccional de solapamientos; después métricas por periodo exacto. No afirmar concurrencia por una comprobación previa en frontend.
3. **07–10:** tutores y menores; CSV demográfico idempotente/paginado; HCU y PDFs persistidos, firma/autoría histórica/logo; WhatsApp manual y notificaciones reales; Auth SMTP, invitación y confirmación sin activar por metadata.
4. **11–15:** responsive/oscuro/accesibilidad con evidencia visual; medición de latencias/LCP/INP/CLS; ASVS y decisiones LOPDP; manual operativo; recuperación aislada de DB **y bytes Storage**, UAT de odontólogo/recepción y aprobaciones reales. Solo entonces decisión de lanzamiento.

## Reversión y operación

No usar `git reset`, `git clean` ni restauración completa desde HEAD: hay trabajo anterior válido. Comparar y retirar hunks de esta tanda; conservar fixtures, históricos y evidencia de fallos. Detener el proceso local y Compose del proyecto propio conservando volúmenes. SQL02 tiene contención revisable, pero no se ha ensayado ni acredita recuperación.

`node scripts/clinia-local-app.cjs build` y `start` producen/ejecutan **un artefacto de aceptación local**. No desplegar ese `.next`: se construyó con configuración pública local; las claves privadas se suministran al proceso de ensayo. Una release necesita build separado de su entorno y revisión de secretos. El servicio local no demuestra ejecución de Vercel, paridad remota ni rendimiento de campo.

## Handoff

- **ENCARGO:** integración02/03 y porciones04a–04c.
- **COMMIT / ENTORNO:** base indicada; fuente local sin commit, Supabase sintético y navegador local.
- **ESTADO:** PARCIAL; evidencia local acotada.
- **RIESGOS:** dependencias y gates anteriores; no cumplimiento legal ni producción listos.
- **SIGUIENTE:** cerrar contrato01/02 y consumidores restantes antes de aceptar04–06.
