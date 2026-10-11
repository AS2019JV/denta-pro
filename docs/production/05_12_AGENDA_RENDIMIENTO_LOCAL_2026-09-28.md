# Clinia+ — Agenda y rendimiento local

Fecha: 28-09-2026, Ecuador. Base Git `f96fbb898ec2a0615dec293ee3e5ce0a9b41b170`, checkout con cambios previos conservados. Un escritor de aplicación y revisión independiente con Sol High. **Estado global: PARCIAL / NO-GO clínico.**

Se trabajó en una porción independiente de los encargos05/12 y ajustes acotados de11/landing. Los resultados locales no sustituyen la convergencia01, la matriz completa02 ni una release desplegada. No se modificó producción ni se enviaron mensajes/correos.

## 1. Contrato de trabajo

| Comportamiento | Por qué existe | Qué debe ocurrir | Qué no debe ocurrir | Cómo verificar | Cómo deshacer con seguridad |
| --- | --- | --- | --- | --- | --- |
| Autoridad y caché | Mantener acceso vigente sin recargar datos innecesariamente | Verificar identidad, perfil y membresía; reutilizar caché del mismo ámbito | Publicar respuestas anteriores, conservar caché tras revocación o reabrir sesión durante logout | Carreras simuladas, JWT reales y ráfaga de foco en navegador | Revertir solo los hunks propios; mantener verificación y limpieza de autoridad |
| Agenda | Coordinar recepción y odontólogos | Un editor compartido, datos operativos y horario Guayaquil; guardar antes de mostrar éxito | 403 oculto como calendario vacío, profesional ajeno, notas clínicas de recepción, factura al agendar | RPC/PostgREST reales, recorrido de recepción y recarga | Contener escrituras y restaurar frontend revisado; conservar citas/auditoría |
| Concurrencia y estados | Evitar reservas incompatibles | Una sola cita activa por intervalo/odontólogo/clínica; transiciones válidas auditadas | Solapamiento por carrera, salto directo a completada, borrado de evidencia | Dos JWT simultáneos, escritura directa, estados positivos/negativos | No eliminar restricciones como rollback automático; preparar forward de reparación |
| Navegación y fechas | Mostrar el periodo consultado | Mes con días vecinos, día/semana/lista correctos; citas que cruzan medianoche visibles | Hora dependiente del navegador o cita contada pero invisible | Casos UTC/Los Ángeles/Tokio; límites exclusivos; DOM real | Revertir cambios propios del calendario conservando RPC autorizados |
| Carga de PDF | Abrir la ficha sin descargar el motor de documentos | Cargar motor al descargar; conservar autorización y entradas actuales | Quitar validación o declarar aprobado el documento clínico por descargar bytes | Build y descarga de receta sintética | Volver a imports anteriores sin cambiar contenido ni guardado |
| Landing y móvil | Explicar alcance y permitir entrar | Copy en español, login visible y enlaces reales; controles legibles | Precios, finanzas, testimonios ficticios o título tapado por menú | Cuatro anchos, navegación móvil y capturas | Revertir hunks propios; conservar rutas y datos |

Aceptación definida: build con tipos/lint; pruebas de autorización y concurrencia reales solo locales; recorrido persistido sin catálogo obligatorio; evidencia cuantitativa de navegador y API. No se fijó un SLO de producción con esta muestra pequeña.

## 2. Cambios principales

### Autoridad y peticiones

- `components/auth-context.tsx`: perfil y membresías en paralelo después de identidad verificada; coalescencia de refresh; generación contra respuestas antiguas; timer cancelado durante logout/unmount. La caché permanece solo si usuario, clínica y rol siguen verificados e iguales.
- `middleware.ts`: consultas independientes en paralelo y redirects sobre el origen de la petición, con cookies refrescadas. Sin TTL compartido de permisos ni uso de metadata editable como autoridad.
- La revalidación de foco sigue ocultando/desmontando consumidores durante la comprobación. Puede cerrar formularios abiertos; preservar borradores sin filtrar datos entre ámbitos requiere trabajo específico posterior.
- `hooks/use-dashboard-data.ts`: dos consultas, pacientes demográficos y agenda. Se retiró el total de servicios y su paso obligatorio de onboarding; profesionales se consultan al abrir el editor. Rango de30 días fijado a Guayaquil y total de pacientes separado de muestra reciente. Asistencia/ausencias y actualización exacta en medianoche siguen en06.
- `hooks/use-realtime-notifications.ts`: se retiró la suscripción ficticia y no delimitada a mensajes. No se entrega una bandeja WhatsApp ni la campana completa10A.

### Agenda

- `lib/agenda.mjs` y declaraciones: contratos, seis estados y etiquetas españolas, límites/horario, proyección operativa, agrupación por solapamiento de días y errores seguros.
- `components/appointment-editor.tsx`: editor compartido, selector de paciente a demanda, directorio autorizado, duración5–480 minutos, motivo sin dependencia de servicios, recepción sin notas; errores preservan el formulario. Campos bloqueados mientras guarda.
- Dashboard, calendario y diálogo rápido de paciente utilizan ese editor. El calendario consulta el periodo visible mediante `get_clinic_schedule`; no hace joins financieros ni una lectura clínica global de pacientes/profiles. Realtime se delimita a clínica y existe refetch de respaldo de60s.
- El frontend ofrece solo el estado actual y transiciones activas permitidas al reprogramar. Servidor también las exige. Las citas que cruzan medianoche aparecen en cada día solapado, indicando continuación.
- `app/(dashboard)/layout.tsx`, `components/sidebar.tsx` y calendario: separación del título frente al botón móvil, nombre accesible y fecha con ancho propio. No equivale a verificación WCAG completa.

### Base de datos local

Migración **solo de aceptación**: `tools/local-supabase/supabase/migrations/20260928032932_enforce_operational_agenda.sql`. Generada con CLI y aplicada una vez al `postgres` sintético. No se ejecutó `db push`, reset ni historial legacy remoto.

- Preflight detiene ante historia inválida o solapamientos; no corrige/borrar datos silenciosamente.
- Restricción GiST sobre UUID clínica/odontólogo y `tstzrange [start,end)`: scheduled/confirmed/arrived bloquean; citas consecutivas son válidas; completed/cancelled/no_show liberan el intervalo.
- Guard valida autoridad viva, asignación activa y estados también en escrituras directas. Cancelar una cita de un odontólogo retirado sigue permitido al personal activo; reactivarla con ese profesional falla.
- RPC bloquea fila al actualizar, valida campos operativos y paciente de clínica, y devuelve solo proyección autorizada. Conflicto se presenta sin identidad de otro paciente.
- Auditoría privada `security_internal.appointment_events`: actor real, operación y antes/después de horario/profesional/estado. Sin notas clínicas/finanzas; clientes no tienen SELECT ni exposición de schema.
- Índice parcial `agenda_visible_range`. No se afirma optimización demostrada por EXPLAIN con esta muestra.

La regla de disponibilidad es por clínica y profesional. Agenda del mismo profesional entre clínicas, disponibilidad laboral, token de idempotencia y pruebas de interrupción/reintentos siguen pendientes. La restricción evita reservas activas duplicadas; no ofrece exactamente una emisión por token.

### PDF y landing

- `lib/pdf-client.ts`: imports dinámicos del motor; usado por recetas de paciente, HCU033 y listado de recetas. No se alteró `lib/pdf-generator.ts`, su contenido clínico ni el mecanismo de autorización/guardado.
- Home conserva Next/Tailwind, marca y componentes existentes; contenido estático, sin animaciones JS iniciales, servicios financieros, precios, ranking/testimonios/cifras ficticias o promesas de certificación. Header con anclas reales y login móvil visible. Se mantiene pendiente revisar páginas secundarias y publicar textos legales aprobados.
- `next.config.mjs` y `.gitignore`: build local en `.next-clinia-acceptance`; no pisa `.next` del dev del usuario. Permisos CSP loopback y excepción de normalización únicamente con flag y URL local exacta. `tsconfig.json` incluye los tipos de ese build.

## 3. Evidencia real y fallos conservados

- [Agenda con JWT reales](evidence/2026-09-28-performance/agenda-runtime-02/execution.json): **10/10 casos**, dos solicitudes simultáneas con un único éxito, adyacencia, reschedule, permisos/clinician retirado, estados, escritura directa, auditoría y conservación financiera. SQL administrativo se usa para inspección y fixture retirado/restaurado; autorización ordinaria usa anon-key + sesión real.
- [Contrato y carreras](evidence/2026-09-28-performance/unit-final-reviewed.log): Node test runner **30 tests,0 fallos**, exit0. Incluye conjuntos con mocks; no se presentan como evidencia desplegada.
- [Build final](evidence/2026-09-28-performance/build-final-mobile.log): exit0, Next15.5.26, tipos y lint habilitados. Advertencias de imágenes/hooks de pantallas existentes siguen abiertas.
- [Recepción en navegador](evidence/2026-09-28-performance/browser-agenda.log): creación desde dashboard sin catálogo, persistencia09:00Guayaquil→14:00UTC, reprogramación10:00, recarga y llegada/completado; RPC200, sin errores de página. Fixture conservado, no borrar/recrear para repetir.
- [Latencia API](evidence/2026-09-28-performance/api-latency.json): veinte muestras después de un warmup por RPC, una solicitud concurrente y33 pacientes sintéticos entre dos clínicas.
- [Build previo](evidence/2026-09-28-performance/build-before.log) y [medición previa](evidence/2026-09-28-performance/browser-optimized-before.log) conservados. El calendario previo respondía403: que su título apareciera no demostraba carga funcional.
- Intento inicial de agenda: [registro](evidence/2026-09-28-performance/agenda-runtime.log) y [resultado parcial](evidence/2026-09-28-performance/agenda-runtime/execution.json). Un JWT respondióPGRST303 antes de alcanzar la restricción; no se considera éxito. Se renovaron sesiones y verificó rol vivo; intento02 usa otro día y conserva filas del primero. No se atribuye una causa definitiva al rechazo transitorio.
- Intentos de dev3000 terminaron en timeout de navegación/networkidle, no constituyen una medición válida. Se eligió readiness de elementos visibles y build optimizado local3400. `.env.local` apunta a producción: no usarlo para ensayos clínicos.
- La prueba inicial de PDF usó `tab=recetas` en el script, mientras el contrato interno es `tab=recipes`; fue un error del ensayo y no se emitió documento en ese intento. Se conserva [diagnóstico](evidence/2026-09-28-performance/browser-visuals-pdf.log). Los fallos de comillas de PowerShell/CLI quedan privados porque el runner de login contiene credenciales; se corrigió con `--filename`.
- Captura móvil inicial tomada durante transición del sidebar; su estado final sí era oculto. La captura estable identificó el solapamiento del título y la fecha estrecha, corregidos antes del build final. Se conservan las capturas anteriores.

## 4. Mediciones y límites

Tamaño First Load JS del bundler, misma línea base local:

| Ruta | Antes | Final |
| --- | ---: | ---: |
| Landing |178kB|133kB|
| Dashboard |292kB|284kB|
| Calendario |276kB|257kB|
| Ficha de paciente |447kB|320kB|
| Recetas |375kB|234kB|

Son tamaños de build, no bytes descargados ni tiempos reales. La primera separación parcial de PDF dejó la ficha en462kB; se comprobó que HCU/listado aún importaban el mismo motor y se completó el cambio, obteniendo320kB. No se omite ese build intermedio.

El muestreo previo de dashboard dio ready1.758/5.813/4.369ms; el primer ensayo corregido dio1.172/839/1.464ms. Las capturas de peticiones de foco pueden omitir respuestas aún pendientes: no usar sus cantidades para afirmar una reducción exacta. La coalescencia y conservación de caché tienen pruebas independientes de código.

### Ensayo del build final

[Resumen consolidado](evidence/2026-09-28-performance/verification-summary.json), [fuentes SHA256 y BUILD_ID](evidence/2026-09-28-performance/source-manifest.json).

| Recorrido | Ready observado | Observación |
| --- | --- | --- |
| Dashboard, tres navegaciones |833/1.591/715ms|Mediana833ms; identidad viva y métricas visibles|
| Calendario |589ms|Se espera agenda cargada; RPC200, previo403|
| Pacientes |638ms|Readiness de encabezado; no demuestra carga completa de toda la lista|
| Landing, tres navegaciones |893/143/147ms|Contenido público estático; caché caliente|
| Login |267ms|Campo de correo visible; navegación móvil comprobada por separado|

[Mediciones autenticadas](evidence/2026-09-28-performance/browser-optimized-final.log) y [públicas](evidence/2026-09-28-performance/browser-landing-performance-final.log). Las muestras son laboratorio con navegador y caché; no una mejora causal controlada. LCP/CLS son observaciones hasta el instante de readiness y no resultados de campo ni INP. TransferenciasJS0 indican caché, no ausencia de JavaScript.

[Layout y PDF final](evidence/2026-09-28-performance/browser-visuals-pdf-final.log): sin overflow ni título/menú solapados en320/360/768/1280px; fecha24px de altura en las cuatro muestras; calendario oscuro renderizado. [Landing](evidence/2026-09-28-performance/browser-landing.log): login visible en cuatro anchos y clic móvil llega al formulario.

Capturas inspeccionadas: [agenda360 claro](evidence/2026-09-28-performance/calendar-final-360-light.png), [agenda360 oscuro](evidence/2026-09-28-performance/calendar-final-360-dark.png), [landing360](evidence/2026-09-28-performance/landing-final-360.png), [landing1280](evidence/2026-09-28-performance/landing-final-1280.png). No cubre toda la app, zoom200%, focus trapping del sidebar ni auditoría de accesibilidad completa.

[Receta sintética descargada](evidence/2026-09-28-performance/receta-sintetica-lazy.pdf):6.417bytes, cabeceraPDF y EOF, marcadorPRUEBA TECNICA; emisión persistida y descarga real tras cargar el motor a demanda. **No acredita contenido/firmas/HCU clínicamente aprobados**. El generador se conserva sin cambios. El último ensayo de mutación de citas precede el delta final exclusivamente de layout; lectura, layout, PDF y mediciones sí corresponden al build final.

El primer ensayo público esperaba un heading inexistente en el formulario de login; [timeout conservado](evidence/2026-09-28-performance/browser-landing-performance.log). Se corrigió el criterio del script para esperar el campo real, sin repetir envíos ni modificar la app por ese error de medición.

API local p95: pacientes46,5ms; agenda19,9ms; búsqueda23,9ms. Son tiempos SDK/red/PostgREST/SQL, no tiempo SQL aislado. Muestra pequeña y calentada: **no demuestra el gate5000 pacientes/10 usuarios, INP, p95 remoto ni Core Web Vitals de campo**.

Recursos variaron: antes7.883MB totales y207MB disponibles; [captura posterior](evidence/2026-09-28-performance/host-after.json)761MB disponibles. No atribuir todo el cambio de velocidad al código. El usuario3000 y el entorno aislado3400 son servidores distintos; no se midió online.

## 5. Reversión y operación

1. Guardar el diff/manifest del cambio y revertir solo sus hunks; existen cambios previos válidos sin commit. No `git reset`/clean global.
2. Detener con Ctrl-C el frontend de aceptación únicamente. `scripts/clinia-local-supabase.ps1 -Action Stop` conserva volúmenes; no usar prune/reset/borrar actores ni bytes.
3. Si falla agenda, contener las escrituras y preparar una migración forward revisada. La migración instalada no es idempotente: no reaplicarla ni eliminar constraints/triggers/auditoría automáticamente para restaurar el frontend.
4. Mantener historial, IDs de fixtures y evidencia. `verify-clinia-agenda.cjs N` usa un directorio y día distinto, rechaza evidencia existente; no reutilizarN para repetir mutaciones. Las contraseñas están solo en `.temp`, ignorado.
5. `node scripts/clinia-local-app.cjs build|start` configura Supabase local y deshabilita proveedores externos. **No desplegar `.next-clinia-acceptance`**; producción necesita build propio y revisión de configuración/migración.

No se ejecutó restauración real de base+Storage ni rollback de producción; ese gate15 sigue abierto.

## 6. Próxima secuencia finita

1. **01:** cerrar convergencia clean/upgrade y paridad de esquema/configuración con dump restaurable sin datos; reconciliar diferencias detectadas. Esta migración local05 debe convertirse en forward canónico únicamente después de ese contrato.
2. **02/04:** terminar matriz de roles, revocaciones concurrentes y consumidores restantes; imágenes privadas; catálogo/reportes/exportación/configuración sin datos financieros. No usar la navegación como autorización.
3. **05/06:** disponibilidad laboral, idempotencia, cancelación/recuperación bajo reintentos, actualización entre clientes y pruebas de revocación/links; métricas de asistencia/ausencia con criterios y medianoche. Mantener fixtures conocidos y conteos exactos.
4. **07–10:** tutores y vínculos; CSV demográfico completo; revisión HCU033/odontograma/firmas y PDFs con odontólogo; notificaciones reales/WhatsApp manual y correo Auth con destinatarios autorizados.
5. **11–15:** resto responsive/oscuro/accesibilidad, ensayo5000/10 usuarios y datos de campo; ASVS/LOPDP; manual; restauración aislada de base y bytes de Storage, RPO/RTO, UAT y aprobación Go/No-Go del mismo commit.

Gate adicional actual: el runtime observado sigue enPostgreSQL17.6. Revisar y ensayar actualización de mantenimiento con respaldo/restauración antes de release. Supabase anunció15.19/17.11 y acciones condicionales para extensiones; `btree_gist` requiere detección de índices float conNaN, no reindexar todos los índices UUID de agenda por su nombre. [Cambio oficial del25-09-2026](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes). No se actualizó Docker ni producción automáticamente.

Fuentes técnicas: [rangos/exclusiones PostgreSQL17](https://www.postgresql.org/docs/17/rangetypes.html#RANGETYPES-CONSTRAINT), [carga a demanda Next15](https://nextjs.org/docs/15/app/guides/lazy-loading), [prefetching Next15](https://nextjs.org/docs/15/app/guides/prefetching). Las fuentes orientan implementación; las pruebas arriba son la evidencia del producto.

## Handoff

ENCARGOS:05/12 parcial local; ajustes acotados11/landing.
COMMIT/ENTORNO:baseGit indicada arriba, fuentes sin commit; `clinia-acceptance`, localhost3400.
ESTADO:PARCIAL / NO-GO clínico.
CAMBIOS:agenda operativa, concurrencia/auditoría local, menos consultas, PDF a demanda, landing y corrección móvil.
PRUEBAS:30tests de código,10casos JWT, build final; resultados finales de navegador ligados debajo.
RIESGOS:01/02/04 incompletos;09/13/15 sin aceptación; carga grande y despliegue sin verificar.
REVERSIÓN:hunks propios + contención de escrituras; conservar historial/volúmenes.
SIGUIENTE GATE:convergencia01 y matriz02/04 antes de promocionar estos cambios.
