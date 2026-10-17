# Clinia+ — Plan ejecutable de cierre para producción

Fecha: **28 de septiembre de 2026**. Repositorio: `C:\Users\aleja\Documents\0-dev\denta-pro`.

**Estado de partida: PARCIAL / NO-GO clínico.** Este documento define trabajo y aceptación futura; no autoriza despliegue, cambios en producción ni uso con pacientes reales.

## 1. Qué se conserva y qué falta

Base Git observada: `f96fbb898ec2a0615dec293ee3e5ce0a9b41b170`, con cambios acumulados que deben conservarse. No hay todavía una release completa e inmutable que reúna toda la evidencia.

| Área | Evidencia disponible | Cierre pendiente |
| --- | --- | --- |
| Inventario | 36 comportamientos, mapa de rutas y comparación documental con Dentalink, Dentally y Curve | Resolver sus aceptaciones; no repetir una investigación general de competidores |
| Migraciones | Convergencia SQL acotada de 17 tablas operativas en dos clones locales | Cadena final con RPC de informes; instalación limpia y upgrade; APIs del contrato final; esquema/configuración remotos completos |
| Permisos | Pruebas locales de Auth, RLS, RPC y Storage; algunos casos de membresía retirada | Matriz completa, carreras reales de revocación, archivos privados y consumidores restantes |
| Agenda | Estados, exclusión de solapamientos, auditoría y recorrido persistido de recepción | Disponibilidad laboral, reintentos/idempotencia y sincronización entre clientes |
| Recetas | Acceso rápido, selección de paciente, URL, recarga y Atrás verificados localmente | Emisión clínica, autoría histórica, reimpresión, firma y PDF aprobados |
| Informes | Conteos operativos exactos, JWT ordinarios y PDF operativo local | Integrarlos en cadena final; completar las métricas y actualización del dashboard |
| Finanzas | Retiro de varios flujos, catálogo y reportes sin alterar valores históricos | Consumidores, exportaciones y rutas legacy restantes |
| UX y velocidad | Algunas pantallas móviles/oscuro, carga diferida y reducción de bundles | Todas las pantallas, teclado/zoom, diagnóstico de lentitud y carga representativa |
| Seguridad y operación | Checkpoints y controles locales parciales | ASVS, privacidad, recuperación de base y bytes de Storage, UAT y release desplegada |

Fuentes del estado: [progreso](IMPLEMENTATION_PROGRESS.md), [última continuación](01_04_06_CONTINUACION_2026-09-28.md), [resumen de verificación](evidence/2026-09-28-convergence/verification-summary.json) e [inventario](00_INVENTARIO_DE_CIERRE.md). El checkpoint [M7](../security/M7_PRODUCTION_ACCEPTANCE_2026-09-22.md) aporta requisitos todavía necesarios; sus limitaciones de infraestructura describen su fecha, no sustituyen la evidencia local posterior.

Al preparar este plan se comprobaron **35/35 huellas sin cambios** del último manifiesto. Este es un control sobre fuentes seleccionadas, no un nuevo ensayo funcional. El resumen anterior registra build aprobado y 33 pruebas sin fallos; **no se ejecutaron de nuevo para redactar el plan**. No se encontró `.github/workflows`; implementar CI es trabajo pendiente.

La navegación local pequeña registrada tardó **1,3–4,4 segundos antes del último ajuste de autoridad**. No permite identificar por sí sola la causa actual ni afirmar que la lentitud esté solucionada. Los clones SQL tampoco tienen una API/Auth/Storage independiente que demuestre paridad completa.

## 2. Alcance de la primera release

**Usuarios:** odontólogo, recepción y administrador de clínica, con permisos explícitos. **Idioma:** español. **Mercado inicial:** Ecuador.

Incluir:

- Alta, edición, búsqueda y archivo de pacientes; vínculos familiares, tutor y contacto de emergencia diferenciados.
- Agenda del personal, disponibilidad, estados, seguimiento y métricas operativas reales.
- Historia odontológica, HCU-033, odontograma FDI, evoluciones, recetas y documentos verificables.
- Adjuntos privados, importación CSV demográfica y exportaciones autorizadas.
- Equipo e invitaciones, configuración persistida, correos Auth y WhatsApp manual revisable.
- Recuperación, auditoría, mantenimiento y controles de privacidad necesarios para operar.

Excluir de los flujos activos:

- Pagos de pacientes, saldos, facturas, pagadores, reportes financieros y analítica familiar.
- Reserva pública, marketing automatizado y una bandeja WhatsApp que no tenga integración real.
- Automatización de mensajes, importación clínica universal y afirmaciones de firma electrónica cualificada.

Los datos financieros históricos se conservan. El control técnico de acceso a la suscripción SaaS se mantiene; esta versión no necesita desarrollar un sistema comercial de cobros.

**Arquitectura:** continuar con Next.js, TypeScript, Supabase, React Query, shadcn/Radix y las utilidades PDF existentes. Usar `Architecture_map.md` como índice y comprobarlo contra código: contiene referencias antiguas a versiones, finanzas y acceso público a objetos. No introducir microservicios, un segundo sistema de estado o nuevos proveedores sin una necesidad medida.

Las skills son apoyo técnico. Las instrucciones del usuario prevalecen: no trasladar del skill clínico facturación, retención universal de 5–10 años, consentimiento como única base legal o acceso público a archivos clínicos. La conservación, las bases legales y el requisito de firma se deciden con el responsable competente.

## 3. Método de ejecución y uso de modelos

### Una tarea verificable por entrega

1. Seleccionar un ID de la tabla; leer sus dependencias y evidencia disponible.
2. Escribir las cinco preguntas: **por qué existe; qué debe ocurrir; qué no debe ocurrir; cómo verificar; cómo deshacer**.
3. Fijar aceptación y riesgos antes de editar; identificar archivos y contratos afectados.
4. Implementar el cambio coherente mínimo. Validar entrada y autoridad en el servidor/base, aunque la interfaz ya limite la acción.
5. Verificar caminos permitidos, denegados y fallos relevantes con datos sintéticos. Una prueba mock no acredita autorización desplegada.
6. Registrar versión, entorno, cambios, resultados reales, evidencia, reversión y pendientes.
7. Revisar si la aceptación está satisfecha. Cerrar o entregar un bloqueo concreto; no comenzar una refactorización general.

**Un agente escritor a la vez.** Un revisor independiente puede leer el delta de permisos, migraciones y documentos clínicos. Trabajos documentales independientes pueden prepararse en paralelo; dos agentes no deben modificar el mismo contrato de datos.

**Prioridad:** P0 compromete seguridad, privacidad o integridad; P1 impide completar una tarea necesaria de la release. Ambos bloquean lanzamiento. P2/P3 son mejoras no críticas que pueden diferirse con responsable y motivo; no deben ocultar un incumplimiento obligatorio. Mantener la clasificación de los IDs del inventario y corregirla solo con evidencia.

### Reglas de calidad del código

- Tipos y contratos explícitos; validación de entrada en cada límite de servidor. Compartir reglas de dominio, sin confiar en validación del cliente.
- Consultas con columnas autorizadas y paginación; caché por clínica/usuario/rol; cancelación e invalidación de respuestas obsoletas.
- Transacciones y restricciones de BD para integridad concurrente; resultados ambiguos se reconcilian antes de reintentar una mutación.
- Migraciones compatibles con la aplicación vigente, preflight de datos e índices justificados por consultas. Evitar `DROP` o reescrituras globales para simplificar el upgrade.
- Errores seguros y útiles en español; logs con contexto mínimo, sin tokens, datos clínicos ni contenido completo de perfiles.
- Revisión del delta, tipos/lint y pruebas que cubran el riesgo real. No desactivar controles para obtener un build verde ni añadir pruebas que solo repitan la implementación.

La asignación siguiente es una recomendación de ingeniería. Sol se usa para lógica y verificación con riesgo; Luna para cambios acotados, interfaz y documentación. Se basa en la [guía oficial de selección de OpenAI](https://developers.openai.com/api/docs/guides/model-selection). Elegir el modelo/esfuerzo en Codex; nombrarlo en el prompt no cambia la configuración.

- `low`: cambios pequeños y bien definidos.
- `medium`: trabajo acotado con varias piezas conocidas.
- `high`: integración, casos de error y decisiones técnicas relevantes.
- `xhigh`: migraciones, autoridad, revisión independiente y recuperación/lanzamiento.
- `max`: reservado para un problema identificado que siga sin resolverse tras una entrega `xhigh` y revisión de evidencia. No usarlo como valor inicial.

### Reglas para ahorrar tiempo y tokens

- No rehacer el inventario 00 ni los cambios que ya pasan, salvo drift o un riesgo concreto.
- Leer primero este ID, el progreso y los archivos afectados; usar `rg` y consultas con columnas explícitas.
- Reutilizar fixtures, componentes y pruebas existentes. Los runners actuales son de una sola ejecución; crear un nuevo intento revisado, conservando el anterior.
- Las verificaciones locales se pueden completar mientras se consigue paridad remota. **No habilitan promoción ni lanzamiento.**
- Una prueba fallida se investiga; no repetirla sin hipótesis. Si hace falta una acción del usuario, pedir exactamente esa acción y continuar trabajo independiente.
- Probar el delta durante cada tarea; ejecutar la regresión completa en integración y release. No ampliar pruebas por rutina.
- No usar `.env.local` para aceptación: actualmente apunta a producción. Usar el launcher aislado `scripts/clinia-local-app.cjs` y revisar su guard antes de cada entorno nuevo.
- No borrar bases, volúmenes o evidencia; no resetear staging ocupado. No desplegar `.next-clinia-acceptance`.
- No enviar WhatsApp/correos reales ni activar costes sin autorización existente para ese destinatario/operación.

## 4. Asignación completa y dependencias

Los IDs 01–15 mantienen continuidad con los encargos anteriores. A/B divide un encargo en entregas concretas. **PREP** agrega trazabilidad y una primera CI.

| ID | Entrega | Agente | Esfuerzo | Dependencias para verificar cierre |
| --- | --- | --- | --- | --- |
| PREP | Snapshot revisable, alcance y CI mínima | Luna | medium | Ninguna |
| 01A | Cadena final limpia/upgrade con API real | Sol | xhigh | PREP |
| 01B | Paridad remota, configuración y mantenimiento PostgreSQL | Sol | high | 01A; acceso de solo lectura/esquema completo |
| 02A | Roles, aislamiento y revocación real | Sol | xhigh | 01A; 01B para afirmar cierre remoto |
| 02B | Storage y todos sus consumidores | Sol | high | 02A; 01B para afirmar cierre remoto |
| 12A | Diagnóstico temprano y corrección de lentitud | Sol | high | Baseline PREP; pruebas 02A para modificar Auth/caché |
| 04 | Completar retiro financiero y superficies excluidas | Sol | high | 02A |
| 03 | Regresión del acceso rápido a recetas | Luna | medium | 02A; emisión completa depende de 09B |
| 05 | Agenda, disponibilidad, idempotencia y clientes concurrentes | Sol | high | 01A, 02A, 04 |
| 06 | Dashboard exacto e integración de informes | Sol | medium | 05 y RPC final de 01A |
| 07A | Pacientes, menores, familia y archivo | Sol | medium | 02A, 04 |
| 07B | Onboarding, equipo y configuración persistida | Sol | high | 02A, 02B; correos reales de 10B |
| 08 | CSV y exportaciones completas/autorizadas | Sol | high | 07A, 02B; 09A/09B para exportación clínica; decisiones de privacidad previas de 13B, sin esperar su cierre final |
| 09A | HCU-033, odontograma, evolución e integridad clínica | Sol | high | 02A, 07A |
| 09B | Recetas, firma visible, PDF y autoría histórica | Sol | high | 09A, 02B, 07B |
| 10A | Notificaciones reales y apertura manual WhatsApp | Sol | medium | 05, 07A, 02A |
| 10B | Supabase Auth y correo de extremo a extremo | Sol | medium | 01B, 02A; destinatarios de prueba autorizados |
| 11A | Responsive, oscuro y accesibilidad de los flujos | Luna | high | Flujos 03–10 funcionalmente estables |
| 11B | Landing y enlaces coherentes con la release | Luna | low | Alcance de PREP y capacidades verificadas |
| 12B | Carga representativa y presupuestos de rendimiento | Sol | high | 12A, 05–11A; 01B para medición desplegada |
| 13A | ASVS 5.0.0 nivel 2 y corrección de hallazgos | Sol | xhigh | 01–12 finalizados en candidato desplegado |
| 13B | LOPDP, derechos, conservación y aprobación responsable | Sol | high | Preparar/aprobar políticas desde PREP; verificar su implementación final con 01B, 08, 09 y aprobación humana |
| 14A | Operación, alertas, CI final y recuperación real | Sol | xhigh | CI desde PREP; cerrar con 01B, 02B y candidato estable |
| 14B | Manual técnico, soporte y mantenimiento | Luna | medium | Procedimientos verificados de 01–14A |
| 15A | UAT odontólogo/recepción y cierre de defectos | Sol | high | 03–14; participantes humanos disponibles |
| 15B | Go/No-Go, ensayo y liberación controlada | Sol | xhigh | Todos los anteriores y aprobaciones requeridas |

### Secuencia práctica

1. **Fundación:** PREP → 01A → 02A/02B. Preparar 01B y 13B en paralelo documental; mantener visible cualquier bloqueo remoto.
2. **Velocidad y tareas diarias:** 12A → 04 → 05 → 06 → 07A/07B. Mantener la navegación 03 como regresión, sin reconstruir su editor.
3. **Documentos e intercambio:** 09A → 09B → 08; 10A y 10B según sus dependencias. La parte demográfica de 08 puede adelantarse después de 07A.
4. **Calidad final:** 11A → 11B → 12B. CI, logs y revisión de seguridad acompañan cada entrega; aquí se prepara su evaluación completa sobre el candidato estable.
5. **Liberación:** 13A/13B + 14A → 14B → 15A → 15B.

No esperar a la última semana para programar aprobación clínica, privacidad y restauración: sus responsables y condiciones se identifican en PREP. La paridad remota 01B bloquea la aceptación desplegada, aunque permita progreso sintético independiente.

## 5. Subplanes con aceptación y reversión

### PREP — Luna / medium

**Objetivo:** que todas las pruebas posteriores identifiquen una versión reproducible y un alcance finito.

1. Revisar cambios acumulados y preservar un snapshot completo, incluyendo listado de archivos y hashes; separar secretos/artefactos privados. No sobrescribir el trabajo anterior.
2. Vincular los 36 IDs del inventario a estos encargos y marcar evidencia reutilizable, pendiente o desactualizada. Un ID no se cierra por existir código.
3. Añadir scripts verificables para tipos, lint, build y pruebas por dominio, y una CI mínima equivalente. Usar lockfile y runtime declarado; comprobar el comando de lint del Next instalado antes de automatizarlo.
4. Documentar entornos y responsables de aprobación clínica, privacidad y recuperación. Añadir plantillas de evidencia/redacción de secretos.

**Aceptación:** una copia limpia del snapshot instala con lockfile y ejecuta los comandos; CI falla ante un error real de tipos/prueba; no incluye credenciales ni contacta producción.

**Entrada:** `package.json`, lockfile, `test/production/`, progreso y manifiestos. **Reversión:** revertir únicamente la nueva automatización/documentación; conservar snapshot y trabajo anterior.

### 01A — Sol / xhigh

**Objetivo:** disponer de un único contrato final de base de datos que la aplicación realmente pueda utilizar.

1. Consolidar el orden baseline → M7 → autoridad/Storage → agenda → convergencia → informes. Incluir `get_clinic_operational_report` en el contrato/allowlist final.
2. Preparar scripts reproducibles para instalación desde una baseline Supabase vacía y upgrade desde esquema completo de referencia. Conservar los intentos SQL actuales; no llamarlos instalación remota completa.
3. Aplicar en entornos nuevos sintéticos. Verificar columnas, grants, RLS, RPC, triggers, índices, FKs compuestas y configuración requerida. Conservar filas históricas y valores fuera del alcance.
4. Probar el resultado mediante Auth/PostgREST/Storage reales. Usar una instancia aislada o un cambio de conexión revisado que conserve la primaria ocupada; dos clones SQL no sustituyen esta prueba.
5. Ensayar una migración fallida y su contención/reanudación documentada sin retirar controles de seguridad.

**Aceptación:** instalación limpia y upgrade convergen al mismo contrato declarado; las operaciones permitidas funcionan por API, las denegadas fallan; datos sintéticos e historial se conservan. Cada divergencia queda resuelta o excluida con motivo.

**Entrada:** `docs/production/reconciliation/`, `scripts/verify-clinia-operational-convergence.cjs`, migraciones locales y fixtures. **Reversión:** contener el delta y volver al artefacto compatible; no restaurar grants inseguros ni borrar datos para repetir.

### 01B — Sol / high

**Objetivo:** demostrar que lo probado representa el entorno que recibirá la release.

1. Identificar proyectos local/staging/producción en modo lectura. Obtener un dump solo de esquema completo y configuración redactada, o acceso PostgreSQL de solo lectura guardado fuera de Git.
2. Comparar historial, objetos, políticas, extensiones, Auth, redirects, correo, buckets y límites. Separar diferencias intencionales de brechas materiales; no copiar pacientes.
3. Preparar promoción a staging con preflight, respaldo, orden, bloqueos y contención. No resetear staging ocupado como atajo.
4. Revalidar la versión de PostgreSQL y ensayar mantenimiento de seguridad en un entorno nuevo. Revisar cambios de extensiones aplicables antes de cambiar versiones; no ejecutar reindexaciones indiscriminadas.

**Aceptación:** inventario remoto completo y plan de diferencias reproducible; candidato final probado en staging representativo; ninguna diferencia crítica sin tratamiento. Si falta acceso, entregar bloqueo exacto y mantener la evidencia local con su alcance.

**Reversión:** conservar dumps/configuración/versiones anteriores; ensayar el procedimiento soportado. Una restauración requiere autorización y respaldo: no asumir que un downgrade de base revierte cambios.

Referencia de mantenimiento: [cambios PostgreSQL 15.19/17.11 de Supabase](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes). La versión se vuelve a comprobar al ejecutar, sin fijar aquí una actualización futura a ciegas.

### 02A — Sol / xhigh

**Objetivo:** mínimo privilegio verificable por rol, clínica y operación.

1. Cerrar matriz owner/odontólogo/recepción/miembro retirado/anónimo para tablas, campos, vistas, RPC, Server Actions y endpoints. Aprobar explícitamente el acceso clínico de administración; pertenencia no equivale a autorización para todo.
2. Probar clínicas A/B con JWT obtenidos de Auth ordinario. Cubrir lectura, escritura y referencias cruzadas de paciente/profesional/tutor; recepción no obtiene historia clínica general.
3. Verificar retirada real de rol, cambio de clínica, token anterior, sesión expirada y respuestas retrasadas. Limpiar caché/formulario/publicaciones cuando cambia autoridad; conservar borrador únicamente durante revalidación del mismo scope confirmado.
4. Comprobar auditoría y derechos: resultado motivado, evento único, invariantes y rollback ante fallo de auditoría. Ensayar contención por API, no solo SQL.
5. Revisar privilegios por defecto, funciones definer/search_path y exposición de esquemas. Un key administrativo no demuestra permisos ordinarios.

**Aceptación:** toda celda aplicable de la matriz tiene evidencia positiva/negativa en el contrato final; no hay filtración entre clínicas ni mutación indebida; revocación y carreras dejan un resultado seguro sin publicar datos del contexto anterior.

**Entrada:** `components/auth-context.tsx`, `components/dashboard-wrapper.tsx`, `middleware.ts`, consultas y reconciliación 02. **Reversión:** deshabilitar la operación afectada manteniendo RLS/grants restrictivos; no recuperar una política amplia para arreglar la UI.

### 02B — Sol / high

**Objetivo:** acceso coherente a archivos, fotografías, firma y branding.

1. Inventariar cada bucket y consumidor: upload, vista previa, PDF, descarga, borrado y URLs guardadas. Separar branding publicable de información identificable/sensible según política aprobada.
2. Implementar rutas de objeto delimitadas por clínica/paciente, tipos/tamaños permitidos, validación del contenido y política de reemplazo. No confiar únicamente en la extensión del archivo.
3. Sustituir accesos públicos indebidos y verificar URLs firmadas con caducidad corta; probar path manipulado, bucket legacy, clínica ajena, retirado y anónimo.
4. Definir limpieza de cargas huérfanas y conservación. Una URL ya firmada puede seguir válida hasta caducar; documentar ese límite y el mecanismo de contención requerido. Una descarga entregada no se puede retractar.

**Aceptación:** archivos autorizados abren y se incorporan al PDF; accesos indebidos por API fallan; ningún consumidor necesita hacer público un archivo clínico para funcionar; pruebas de caducidad y límites registradas.

**Entrada:** `components/avatar-upload.tsx`, `components/patient-files.tsx`, firma/PDF y políticas de Storage. **Reversión:** contener acceso/subida y corregir las referencias conservando bytes; no borrar ni publicitar el bucket como solución.

### 12A — Sol / high

**Objetivo:** localizar y corregir la lentitud percibida antes de pulir detalles visuales.

1. Medir landing, login, dashboard, búsqueda, agenda y ficha en build de producción local aislado. Separar carga fría/caliente y navegación interna; registrar hardware, commit, sesión y dataset.
2. Trazar TTFB/render, requests Auth, consultas, caché y bundles. Comprobar duplicación de verificaciones, waterfalls, polling, imágenes y consultas lentas; no atribuirlo a RAM o Supabase sin evidencia.
3. Corregir primero el cuello confirmado: consultas paralelas independientes, selección de columnas, índices justificados, carga diferida o revalidación redundante. Mantener autoridad viva e invalidación por clínica/usuario.
4. Repetir solo las mediciones afectadas y regresiones de seguridad. Preparar una lista corta del siguiente cuello con evidencia.

**Aceptación:** causa principal identificada con traza y mejora medida en condiciones comparables; ningún bypass de autorización/caché compartida. Si persiste un componente lento, queda cuantificado, no declarado resuelto.

**Reversión:** retirar la optimización concreta y mantener las verificaciones de autoridad. El cierre de escala/objetivos corresponde a 12B.

### 04 — Sol / high

**Objetivo:** completar el alcance sin finanzas en todas las superficies activas.

1. Buscar pagos, balances, facturas, precios, pagadores y marketing en rutas, endpoints, PDFs, exports, consultas, familias y componentes legacy.
2. Retirar campos/acciones del flujo; cerrar los endpoints excluidos en servidor. Conservar control técnico de suscripción y datos históricos.
3. Verificar que agendar, editar paciente, informar y exportar no lean ni generen registros financieros.

**Aceptación:** recorridos y requests activos sin datos financieros; llamadas directas a operaciones excluidas fallan de forma segura; valores históricos intactos. No basta ocultar botones.

**Reversión:** revertir el delta compatible preservando los bloqueos y la historia; no abrir endpoints retirados durante contención.

### 03 — Luna / medium

**Objetivo:** conservar la solución de «Nueva Receta Médica» y verificarla en la release final.

1. Reutilizar selector y editor existentes; comprobar acción rápida → paciente → pestaña/editor.
2. Probar enlace directo, recarga, Atrás, paciente inexistente y rol de recepción en navegador.
3. Después de 09B, comprobar emisión persistida y descarga autorizada desde este mismo recorrido.

**Aceptación:** ningún «page not found» en el flujo válido; estados seguros en inválidos; navegación y autorización real coherentes. La emisión no queda verificada solo por abrir la pestaña.

**Entrada:** dashboard, `/recipes`, ficha del paciente y selector. **Reversión:** quitar temporalmente la acción afectada y conservar acceso válido desde ficha; no duplicar un segundo editor.

### 05 — Sol / high

**Objetivo:** agenda confiable en condiciones reales de operación.

1. Completar horarios laborales, pausas, ausencias y profesional activo; validar duración/paciente/clínica y rango temporal en servidor. Definir si habrá excepción autorizada fuera de horario y cómo se audita.
2. Conservar seis estados y transiciones aprobadas: scheduled, confirmed, arrived, completed, cancelled, no_show. UTC al persistir; America/Guayaquil al presentar.
3. Probar exclusión transaccional de intervalos activos del mismo odontólogo, intervalos consecutivos, reprogramación y cancelación. No depender del calendario del navegador para detectar conflictos.
4. Implementar identidad de operación/reintento seguro y rechazo de edición obsoleta. Un timeout ambiguo debe reconciliarse antes de repetir una creación.
5. Verificar dos clientes con cambios simultáneos y actualización de agenda/listas; preservar formulario ante conflicto y mostrar resultado en español.

**Aceptación:** solicitudes concurrentes al mismo intervalo producen una sola cita válida; reintentos no duplican; citas consecutivas permitidas; estados y métricas coherentes tras recarga; cambios auditados y notificados a los clientes autorizados.

**Entrada:** calendario, editor, quick appointment, RPC/migración agenda. **Reversión:** contener creación/reprogramación si falla integridad; conservar citas y auditoría, no eliminar la restricción antisolapamientos.

### 06 — Sol / medium

**Objetivo:** dashboard útil, exacto y sin trabajo duplicado.

1. Definir pacientes activos, citas de hoy/próximas, atendidos y ausencias con período y denominador visibles. Reutilizar los contratos operativos existentes.
2. Separar totales exactos de listas limitadas; invalidar consultas tras cambios de citas/pacientes y evitar refrescos redundantes.
3. Completar carga, vacío, error/reintento y permisos de cada rol. Aclarar en UI qué es conteo actual y qué es métrica del período.
4. Probar medianoche Guayaquil, cancelaciones, no_show, filtros, paginación y fixtures conocidos.

**Aceptación:** cifras reconciliadas con registros persistidos; ninguna cifra viene del tamaño de una lista paginada; cambiar estado actualiza agenda, dashboard e informe sin divergencia.

**Entrada:** `hooks/use-dashboard-data.ts`, dashboard, `lib/operational-reports.mjs`, informes. **Reversión:** ocultar la métrica defectuosa y conservar la lista operativa; no reemplazarla por cifras hardcoded.

### 07A — Sol / medium

**Objetivo:** una ficha simple, segura y suficiente para odontólogo/recepción.

1. Verificar registro, validación de documentos, búsqueda, edición y archivo, incluidos documentos alternativos y pacientes extranjeros.
2. Implementar vínculos familiares, tutor del menor y emergencia como conceptos separados. Una relación familiar no concede acceso a la historia de otro miembro.
3. Evitar referencias entre clínicas y edición accidental de familiares; retirar pagadores y analítica familiar.
4. Revisar duplicados y archivo frente a historia/citas existentes. No fusionar pacientes por nombre ni borrar historia por una acción de UI.

**Aceptación:** paciente adulto/menor/extranjero completan el flujo; tutor coherente; editar uno no modifica otro; recepción obtiene solo datos autorizados; archivo conserva relaciones necesarias y custodia.

**Entrada:** lista/ficha, `components/add-patient-form.tsx`, `components/family-center.tsx`, validaciones. **Reversión:** retirar el control nuevo o corregir vínculos auditados; no borrar pacientes ni registros clínicos.

### 07B — Sol / high

**Objetivo:** poner una clínica y su equipo a trabajar sin estados ficticios.

1. Probar creación/onboarding de clínica con datos sintéticos y verificar suscripción/acceso técnico sin incorporar cobros de pacientes.
2. Completar invitación, aceptación, expiración, reenvío y retirada de miembros; una invitación no permite autoconcederse owner ni entrar en otra clínica.
3. Persistir y releer nombre, dirección, logo, perfil profesional y horarios. Corregir ajustes/switches que solo muestran toast y no guardan nada; diferir controles sin uso real.
4. Verificar permisos, actualización del PDF y fallo parcial/reintento sin duplicar clínica o invitación. El flujo completo de correo se cierra con 10B.

**Aceptación:** clínica sintética → equipo → paciente → cita sin intervención en BD; datos guardados sobreviven recarga; invitado recibe únicamente el rol aprobado; retirado pierde acceso real.

**Entrada:** `app/actions/register-clinic.ts`, `app/actions/invite-member.ts`, dentists, settings, perfil. **Reversión:** suspender invitaciones/onboarding afectado conservando clínicas/cuentas; no elevar roles para reparar un flujo.

### 09A — Sol / high

**Objetivo:** fidelidad e integridad del registro clínico odontológico.

1. Obtener la versión del Formulario 033 y guía aplicables de fuentes oficiales MSP; documentar trazabilidad campo/símbolo/validación. El mapa y el skill no son una aprobación normativa.
2. Verificar FDI adulto/temporal/mixto, superficies, hallazgos y cálculo CPO/ceo con casos revisados por odontólogo. No introducir decisiones clínicas automáticas.
3. Completar guardado/reapertura, evolución/autor/fecha y correcciones trazables. Revisar edición concurrente para evitar sobrescritura silenciosa de historia.
4. Resolver periodontograma: conservar solo si datos, unidades y flujo actual se validan; de lo contrario retirarlo de la release con decisión clínica documentada.
5. Verificar permisos, alertas, vacíos y recuperación de errores sin perder contenido ni mezclar pacientes.

**Aceptación:** casos adulto, menor, dentición mixta y ficha extensa conservan datos al reabrir; índices y símbolos aprobados; correcciones preservan autoría; odontólogo ecuatoriano firma la revisión funcional pendiente.

**Entrada:** HCU, odontograma, periodontograma, medical records y modelo clínico. **Reversión:** bloquear una captura defectuosa y corregir por evolución/adenda; no destruir ni reescribir evidencia clínica emitida.

### 09B — Sol / high

**Objetivo:** emitir y reimprimir documentos que coincidan con el registro persistido.

1. Generar HCU/receta desde datos guardados, con identidad clínica/paciente/profesional, fecha, dirección, logo, indicaciones y firma visible aprobada según el documento.
2. Resolver autoría histórica: cambios de nombre/logo/firma/perfil no deben modificar silenciosamente un documento ya emitido. Conservar versión/snapshot y correcciones trazables.
3. Definir emisión idempotente, reimpresión y resultado incierto tras timeout; no crear otra receta al descargar de nuevo.
4. Verificar publicaciones pendientes tras retirada de permiso/cambio de paciente/clínica y archivos de firma privados. Revalidar justo antes de generar/entregar cuando corresponda.
5. Renderizar, abrir e imprimir documentos mínimos, extensos y multipágina; comprobar tablas, acentos, saltos y contenido contra la ficha. Recoger aprobación clínica y de requisitos de firma.

**Aceptación:** documento/registro reconciliados, autor y fecha estables, reimpresión consistente, sin cortes ni pacientes mezclados, recepción no emite; aprobación humana registrada. Firma dibujada/visible no se presenta como firma cualificada.

**Entrada:** `lib/pdf-client.ts`, `lib/pdf-generator.ts`, prescriptions, firma y configuración. **Reversión:** contener emisión/exportación y conservar documento/versiones; una emisión incorrecta se corrige con trazabilidad, no mediante borrado silencioso.

### 08 — Sol / high

**Objetivo:** migrar demografía sin duplicados y exportar con alcance verificable.

1. Definir CSV versionado y plantilla española; mapear formatos representativos de otros sistemas mediante muestras autorizadas/anonimizadas. No prometer compatibilidad universal.
2. Implementar vista previa, mapeo, validación por fila, identificación fuerte de duplicados, confirmación e informe. Nunca unir personas por coincidencia de nombre.
3. Limitar tamaño/lotes y aplicar identidad de importación para reintentos. Probar acentos, comillas, saltos, documentos alternativos, duplicados y fallo parcial con más de 1.000 filas.
4. Exportar todas las filas autorizadas con paginación de servidor, columnas explícitas, conteo reconciliado y neutralización de fórmulas CSV. Probar límites API y escrituras concurrentes.
5. Separar exportación demográfica de archivo clínico/derechos. Para este último, implementar solicitud, alcance por paciente/solicitante, snapshot coherente y entrega segura de registros más bytes de adjuntos, según política aprobada.

**Aceptación:** importación confirmada y reintentada no duplica; informe exacto de aceptadas/rechazadas; exportación supera 1.000 sin truncado ni finanzas; autorizaciones de demografía y clínica no se confunden; entrega de derechos no se marca cumplida por descargar metadatos.

**Reversión:** cancelar antes de confirmar; después, rollback selectivo solo del lote nuevo no modificado y compatible con auditoría/custodia. Nunca borrar pacientes que hayan recibido citas o historia. Descargas entregadas no se pueden deshacer.

### 10A — Sol / medium

**Objetivo:** comunicación útil con estados honestos.

1. Reemplazar contador/eventos ficticios de campana por eventos de cita delimitados por usuario/clínica, estado leído persistido y deduplicación.
2. Validar teléfono internacional; abrir WhatsApp manualmente con texto español mínimo y revisable por personal. Evitar diagnóstico/medicación en texto prellenado.
3. Registrar intento de apertura, sin afirmar enviado, entregado o leído. Retirar apariencia de bandeja o conexión inexistente.
4. Probar número inválido, sin permiso, lectura entre sesiones y eventos tras reprogramación/cancelación. No enviar mensajes reales en pruebas.

**Aceptación:** agenda genera eventos correctos, campana refleja registros reales y lectura persistida; enlace/teléfono validados; sin filtración de clínica ni estados de entrega inventados.

**Entrada:** campana, hooks, `lib/notifications.ts`, acciones de agenda. **Reversión:** deshabilitar el enlace/evento nuevo manteniendo auditoría; no convertirlo en envío automático.

### 10B — Sol / medium

**Objetivo:** autenticación e invitaciones completas mediante correo.

1. Inspeccionar Supabase Auth, SMTP Resend, dominio/remitente, plantillas españolas, redirecciones exactas y separación de entornos. Verificar DNS configurado y tracking de enlaces.
2. Probar confirmación, invitación, recuperación y cambio de contraseña, con buzón local primero y destinatarios externos sintéticos autorizados después.
3. Probar enlace vencido/reutilizado, callback alterado, redirección externa, enumeración de cuentas, límites y reenvíos. Asegurar que ninguna pantalla queda en bucle.
4. Comprobar MFA de usuarios privilegiados y procedimiento de recuperación con responsabilidad explícita; cerrar sesión ante operaciones sensibles según política.

**Aceptación:** cada flujo llega y termina en el entorno/usuario correctos; tokens inválidos y redirects externos fallan de forma segura; logs/plantillas no revelan secretos. Mailpit local no demuestra entrega SMTP externa.

**Reversión:** mantener configuración anterior verificada y contener invitaciones/callback afectados; no ampliar redirects a comodines para solucionar un fallo.

### 11A — Luna / high

**Objetivo:** realizar el trabajo diario sin cortes, superposiciones ni fatiga evitable.

1. Revisar login/onboarding, dashboard, agenda, pacientes, clínica, receta, CSV y ajustes usando las cinco preguntas. Reducir pasos y duplicaciones con componentes existentes.
2. Probar 320, 360, 768 y 1280 px; teclado, zoom 200 %, texto largo y estados carga/vacío/error. Revisar menú flotante, portales, calendarios, tablas, diálogos y tabs.
3. Cerrar claro/oscuro/sistema, persistencia, contraste, foco y flash inicial. Usar tokens, no parches de color por pantalla.
4. Aplicar WCAG 2.2 AA en controles aplicables: labels, orden/foco visible, errores comprensibles y navegación sin ratón. Complementar automatización con revisión manual.

**Aceptación:** matriz de recorridos con capturas estables y pruebas de teclado; ningún control crítico queda tapado, cortado o inaccesible; el dato/formulario correcto permanece claro; no regresiones de permisos.

**Reversión:** revertir ajustes de layout/tokens del delta preservando funcionalidad; no ocultar datos necesarios para hacer pasar una captura.

### 11B — Luna / low

**Objetivo:** landing profesional y fiel a lo que se puede usar.

1. Revisar login/CTA en móvil y escritorio, enlaces, contacto y estados reales.
2. Ajustar copy español a pacientes, agenda y gestión odontológica; eliminar finanzas, servicios excluidos y promesas no verificadas.
3. Revisar metadata, contenido indexable, imágenes y accesibilidad básica. Evitar efectos que empeoren carga sin beneficio operativo.

**Aceptación:** enlaces válidos y CTA claro; copy coincide con alcance y evidencia, sin certificaciones/automatización inventadas. Las mediciones se incluyen en 12B.

**Reversión:** revertir texto/estilo conservando enlaces funcionales y afirmaciones correctas.

### 12B — Sol / high

**Objetivo:** demostrar capacidad bajo carga representativa y velocidad de interacción.

1. Preparar dataset sintético de 5.000 pacientes por clínica, historial de citas representativo y 10 usuarios concurrentes con roles reales. Validar plan/costes antes de cargar remoto.
2. Medir dashboard, búsqueda, agenda y ficha en candidato de producción; separar local de staging desplegado, carga fría/caliente, tráfico permitido de respuestas denegadas y errores.
3. Medir consultas completas con RLS, endpoints, navegación, memoria y Core Web Vitals. Aplicar `EXPLAIN`/índices a consultas identificadas; no quitar RLS ni sobrecargar polling.
4. Optimizar y repetir solo cuellos confirmados. Registrar muestras, percentiles, dispositivo/red, duración y script reproducible.

**Aceptación propuesta:** p95 de consultas operativas dashboard/búsqueda ≤800 ms; LCP ≤2,5 s, INP ≤200 ms y CLS ≤0,1 en perfil acordado; cero conflictos que terminen en doble reserva y cero errores inesperados en el ensayo. Estos objetivos son del producto, no garantías de proveedor.

Los objetivos de Core Web Vitals de campo se evalúan en **percentil 75**, separados por dispositivo. El laboratorio sirve para prelaunch; los datos de campo se recogen tras el piloto con telemetría sin datos clínicos. No afirmar cumplimiento de campo sin muestras suficientes. [Definición oficial de Web Vitals](https://web.dev/articles/vitals).

**Reversión:** retirar optimización específica, mantener índices correctos/autoridad y detener carga sintética; documentar límites de capacidad y bloqueos sin inventar resultados.

### 13A — Sol / xhigh

**Objetivo:** verificación independiente de seguridad del candidato completo.

1. Mapear requisitos aplicables de **OWASP ASVS 5.0.0 nivel 2**, con IDs versionados y justificación de no aplicables. Añadir controles por riesgo clínico.
2. Revisar sesiones/MFA, autorización/IDOR, inyección/XSS, CSRF/origin de mutations, SSRF cuando aplique, archivos, secretos, APIs/RPC, límites, logs, dependencias y configuración desplegada.
3. Probar abusos con cuentas sintéticas y límites acordados; hacer reproducible cada hallazgo. Revisar supply chain/lockfile y eliminar versiones flotantes al cambiar dependencias, sin actualización masiva ajena.
4. Corregir hallazgos confirmados con cambio mínimo, repetir su prueba y la regresión relevante; registrar riesgos residuales y controles compensatorios.

**Aceptación:** cero P0/P1 o vulnerabilidades críticas/altas abiertas; cada requisito aplicable tiene evidencia o bloqueo explícito; revisión por un agente/sesión que no sea el autor del cambio riesgoso. No presentar el resultado como certificación.

**Reversión:** contención segura de la superficie antes de revertir; nunca restaurar la vulnerabilidad para recuperar el flujo. [OWASP ASVS oficial](https://owasp.org/projects/asvs).

### 13B — Sol / high + responsable de privacidad

**Objetivo:** operación de datos de salud documentada y aprobada para Ecuador.

1. Inventariar propósitos, categorías, flujos, responsables/encargados, proveedores, regiones y transferencias. Separar consentimiento clínico, aviso de privacidad y base jurídica del tratamiento.
2. Evaluar riesgos/impacto, necesidad de DPD y demás obligaciones según el uso real con asesor/responsable competente. Verificar normativa vigente, distinguiendo proyectos normativos de normas aprobadas.
3. Definir conservación por registro, archivo, bloqueo legal y disposición; no automatizar eliminación por un plazo universal ni borrar historia al cerrar una cuenta.
4. Cerrar solicitudes de acceso/rectificación/portabilidad/supresión con identificación, alcance autorizado, decisión motivada y entrega trazable; probar errores y excepciones de custodia.
5. Aprobar avisos, acuerdos con clínicas/encargados, incidentes y responsables. GDPR se añade si el mercado/tratamiento lo hace aplicable.

**Aceptación:** documentos y decisiones aprobados por responsable identificado; flujos técnicos coinciden con esas políticas; no hay derechos marcados como cumplidos sin entrega/resolución real. El agente prepara y verifica implementación; no firma aprobación jurídica.

**Reversión:** suspender el tratamiento nuevo o publicación no aprobada; conservar evidencia y obligaciones de custodia. Referencia actual: [guía SPDP de riesgos e impacto](https://spdp.gob.ec/wp-content/uploads/2026/06/guia_v2_vfinal.pdf).

### 14A — Sol / xhigh

**Objetivo:** operar, detectar fallos y recuperar el servicio y sus datos.

1. Completar CI: lockfile/runtime, tipos, lint, build, pruebas de contratos y seguridad, integración con entorno sintético, smoke de navegador y artefacto identificado. Proteger secretos y evitar logs con datos clínicos.
2. Configurar observabilidad mínima para fallo de login, errores serverless/RPC, consultas lentas, carga/descarga y respaldo. Logs con correlation ID y contexto mínimo; alarmas con responsable y runbook. Probar alertas sintéticas.
3. Revisar configuración Vercel: env separados, región/proximidad con BD, duración/tamaño de funciones, límites de archivos, pooling si se usa conexión SQL directa, preview restringida y callbacks. No añadir polling ni conexiones innecesarias.
4. Diseñar respaldo de base, **bytes de Storage**, configuración y material de recuperación. Cifrado, acceso mínimo y conservación aprobada. Un backup de BD solo guarda metadatos de objetos, no sus bytes.
5. Ejecutar restauración aislada real, verificar hashes de archivos, relaciones, permisos y recorridos. Medir pérdida recuperable **RPO ≤1 hora** y tiempo hasta operación verificada **RTO ≤4 horas**. Ensayar despliegue/rollback e incidente.
6. Si la plataforma/cadencia actual no soporta esos objetivos, presentar alternativa concreta/coste para aprobación. No activarlo sin autorización ni redefinir el objetivo para hacer pasar la prueba.

**Aceptación:** CI repetible, alertas probadas, restauración de DB+Storage funcional y mediciones RPO/RTO dentro del objetivo; rollback de app compatible con esquema ensayado; responsable operativo identificado.

**Reversión:** recuperar artefacto compatible o contener escrituras; restauraciones requieren plan aprobado, no borrar el entorno vigente. [Backups de Supabase](https://supabase.com/docs/guides/platform/backups) y [checklist de producción](https://supabase.com/docs/guides/deployment/going-into-prod).

### 14B — Luna / medium

**Objetivo:** que otro ingeniero pueda operar la release sin reconstruir su historia.

1. Consolidar arquitectura, entornos, permisos, contratos, migraciones, instalación, deploy y rollback según implementación comprobada.
2. Crear diagnóstico por síntoma: 404, Auth/correo, RLS, Storage, conflicto de cita, PDF, CSV y lentitud; incluir cómo comprobar, causa posible y solución verificada.
3. Documentar tareas periódicas, accesos responsables, actualización de dependencias, recuperación e incidentes. Referenciar scripts, evidencia y versiones.
4. Realizar una lectura/ejecución de procedimientos por un ingeniero o agente distinto; corregir pasos que dependan de conocimiento privado.

**Aceptación:** un tercero levanta staging sintético y ejecuta diagnóstico/recuperación siguiendo el manual; instrucciones sin secretos ni pasos destructivos implícitos; documentación no promete controles pendientes.

**Reversión:** versionar correcciones documentales, manteniendo el procedimiento anterior identificado como histórico.

### 15A — Sol / high + odontólogo y recepción

**Objetivo:** validar que los usuarios pueden trabajar y que el contenido clínico es correcto.

1. Preparar guion UAT sobre candidato congelado: onboarding/equipo, paciente/tutor, cita, llegada/atención/ausencia, HCU, receta, archivos, CSV, informes y comunicación manual.
2. Ejecutar con odontólogo ecuatoriano y recepción; medir finalización, errores y necesidad de ayuda en móvil/escritorio. Registrar observaciones y aprobación, no rellenarlas por el usuario.
3. Corregir defectos necesarios para el alcance, volver a probar el caso y regresión afectada. Nuevas funcionalidades van al backlog posterior.

**Aceptación:** todos los escenarios críticos completados; cero defectos que bloqueen operación o integridad clínica; aprobación odontológica y de recepción asociada a la versión. Participantes ausentes significa UAT pendiente.

**Reversión:** retirar el candidato de aceptación y volver a la versión sintética estable; no inaugurar uso clínico por ausencia de feedback.

### 15B — Sol / xhigh

**Objetivo:** decidir y ejecutar una liberación controlada con evidencia suficiente.

1. Reunir una matriz por todos los IDs del inventario y de este plan; verificar artefacto/commit, contrato de esquema, configuración, UAT, privacidad, recuperación y seguridad.
2. Emitir Go/No-Go con bloqueos, responsables, evidencia y fecha. No sustituir pendientes por porcentajes de avance.
3. Antes de solicitar autorización de producción, preparar el cambio exacto, respaldo, preflight, ventana, impacto, compatibilidad, rollback y criterio de detenerlo; ensayar en staging.
4. Tras autorización aplicable, promover migraciones revisadas y construir el artefacto de producción con sus variables correctas. No reutilizar el bundle local. Ejecutar smoke con identidades autorizadas y comprobar alertas.
5. Iniciar piloto controlado y observar errores, integridad, consultas y métricas de campo. Ampliar solo con evidencia y responsables; los cambios posteriores vuelven al gate afectado.

**Aceptación:** todas las condiciones de la sección siguiente satisfechas, autorización registrada y resultado de producción verificado. Antes de ejecutar producción, el resultado es «candidato aprobable», no «lanzamiento completado».

**Reversión:** disparadores y responsables definidos; contener escrituras si hay riesgo de integridad y volver al artefacto compatible. Un rollback de frontend no restaura datos ni revoca documentos ya entregados.

## 6. Definición de producción lista

Hay dos decisiones distintas: **candidato apto para autorizar** y **release liberada y verificada**. La primera exige:

| Condición obligatoria | Evidencia de cierre |
| --- | --- |
| Alcance completo y finito | Todos los IDs requeridos satisfechos; funciones diferidas retiradas del flujo; cero P0/P1 abiertos |
| Reproducibilidad | Snapshot/commit inmutable, lockfile, build CI y hash de artefacto; esquema/configuración identificados |
| Migración y permisos | Limpio/upgrade convergentes y APIs reales; matriz por clínica/rol y revocación aprobada |
| Integridad operativa | Agenda concurrente/idempotente, CSV sin truncado/duplicado y métricas reconciliadas |
| Corrección clínica | HCU/odontograma/receta/PDF/versiones revisados y aprobados por odontólogo responsable |
| UX accesible | Recorridos principales, temas, tamaños, teclado y zoom sin bloqueos ni superposiciones críticas |
| Rendimiento | Ensayo 5.000 pacientes/clinica y 10 usuarios; objetivos de laboratorio/API verificados, límites declarados |
| Seguridad y privacidad | ASVS aplicable con evidencia, cero hallazgos críticos/altos; LOPDP y responsabilidades aprobadas |
| Recuperación | Restauración real de DB+Storage/configuración y RPO/RTO medidos; alertas/contención ensayadas |
| Operabilidad | Manual ejecutable, soporte responsable y UAT humano aprobado |

La segunda exige además promoción autorizada, smoke del entorno de producción y observación del piloto. Los Core Web Vitals de campo se validan cuando haya muestra suficiente; falta de muestra se declara expresamente y no se presenta como resultado aprobado.

**No es una certificación de seguridad o cumplimiento legal.** Un build correcto, Docker saludable o todas las pantallas visibles no satisfacen por sí solos estas condiciones.

## 7. Prompt común para ejecutar una tarea

Configurar en Codex el modelo/esfuerzo de la tabla. Pegar este bloque y añadir el subplan del ID elegido; no cargar los 26 subplanes en cada sesión.

```text
Trabaja en C:\Users\aleja\Documents\0-dev\denta-pro.
Ejecuta exclusivamente ID [ID] del documento
docs/production/PLAN_DE_CIERRE_PRODUCCION_2026-09-28.md.

Lee sus dependencias, IMPLEMENTATION_PROGRESS.md y la evidencia pertinente.
Usa Architecture_map.md como índice; contrasta sus afirmaciones con código.
Conserva cambios válidos anteriores. No declares producción lista por build.

Antes de editar, define para cada comportamiento:
1. Por qué existe.
2. Qué debe ocurrir.
3. Qué no debe ocurrir.
4. Cómo demostrarlo.
5. Cómo deshacer o contenerlo sin perder datos.

Fija aceptación y realiza el cambio coherente mínimo.
Usa fuentes oficiales actuales y skills pertinentes al comportamiento.
Mantén español, Ecuador, pacientes/agenda/documentos, sin finanzas de pacientes,
sin reserva pública ni envío automático de WhatsApp.
Valida autoridad y datos en servidor/base; no basta ocultar botones.

Trabaja con datos sintéticos y launcher local aislado.
No uses .env.local para aceptación; no borres/resetées entorno o evidencia,
no copies pacientes reales ni modifiques producción.
No envíes comunicaciones externas ni generes costes sin autorización aplicable.
Preparar pruebas/despliegue es distinto de ejecutar cambios en producción.

Prueba según riesgo: unitarias para lógica; JWT ordinarios/API para permisos;
navegador real para recorridos; render para PDF; restauración real para recuperación.
Reutiliza pruebas existentes y no repitas mutaciones one-shot.
Ante bloqueo, indica requisito exacto y continúa solo trabajo independiente.

Entrega: ID, versión/entorno, cambios, archivos, comandos/resultados reales,
evidencia redactada, reversión, riesgos y dependencia del siguiente ID.
Estado: VERIFICADO en [alcance] | PARCIAL | BLOQUEADO.
No inventes resultados, firmas, envío/entrega, aprobación clínica ni jurídica.
```

### Handoff obligatorio

```text
ID / INVENTARIO RELACIONADO:
MODELO / ESFUERZO:
COMMIT O SNAPSHOT / ESQUEMA / ENTORNO:
ESTADO Y ALCANCE:
ACEPTACIÓN SATISFECHA / PENDIENTE:
CAMBIOS Y ARCHIVOS:
COMANDOS, RESULTADOS Y EVIDENCIA:
RIESGOS Y BLOQUEOS:
REVERSIÓN O CONTENCIÓN:
SIGUIENTE ID HABILITADO:
```

Una entrega parcial puede habilitar una pieza independiente; nunca satisface una dependencia pendiente por omisión. Si el código cambia después de verificar, repetir los gates materialmente afectados para el candidato final.

## 8. Primer encargo que debe ejecutarse

**PREP — Luna / medium.** Preparar snapshot revisable y CI mínima, registrar dependencias/bloqueos y conservar evidencia anterior. Después: **01A — Sol / xhigh**, integrando la RPC de informes y demostrando contrato limpio/upgrade con API real.

Esta es la próxima unidad de trabajo. El diagnóstico 12A se prepara con mediciones de baseline y se implementa después de proteger la autoridad; las mejoras de copy/landing quedan en 11B.

Los requisitos externos se piden cuando haga falta ejecutar su entrega: acceso/esquema de solo lectura para 01B, destinatarios de prueba para 10B, odontólogo/recepción para 09/15A y responsable de privacidad para 13B. Su ausencia no justifica repetir intentos ni inventar aprobación; preparar mientras tanto el trabajo independiente.

## 9. Fuentes y límites de esta planificación

- Estado contrastado con documentos/evidencias del repositorio el 28-09-2026. No se ejecutó en este encargo una auditoría exhaustiva ni una prueba remota.
- Selección de agentes: [OpenAI Model selection](https://developers.openai.com/api/docs/guides/model-selection). Los esfuerzos son una recomendación para este repositorio; confirmar disponibilidad en la interfaz de Codex.
- Verificación técnica: [Supabase Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y [Backups](https://supabase.com/docs/guides/platform/backups).
- Seguridad: [OWASP ASVS 5.0.0](https://owasp.org/projects/asvs). Aplicabilidad y evidencia se documentarán requisito por requisito.
- Rendimiento: [Web Vitals](https://web.dev/articles/vitals). Objetivos API/RPO/RTO son los propuestos para el producto y requieren demostración.
- Privacidad: [SPDP, guía de riesgos e impacto](https://spdp.gob.ec/wp-content/uploads/2026/06/guia_v2_vfinal.pdf). Las decisiones jurídicas corresponden al responsable competente.
- HCU-033: fuente oficial MSP localizada en la investigación, pero su PDF no pudo abrirse con el lector web de esta sesión. Por ello 09A exige obtener y verificar la versión aplicable antes de afirmar conformidad; no se sustituyó por documentos de terceros.

El criterio de cierre es evidencia suficiente para esta release y su uso real. Nuevas funciones o mejoras cosméticas que no afecten esas aceptaciones van al backlog posterior.
