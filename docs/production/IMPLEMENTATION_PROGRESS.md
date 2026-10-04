# Clinia+ — Estado de implementación

## Evidencia vigente — 04-10-2026

**NO-GO.** [Matriz compacta de aceptación y acciones](CANDIDATE_READINESS_2026-10-04.md). Entrega clínica por servidor preparada con JWT humano/RLS, principal aislado, auditoría, límites y revalidación; migración probada únicamente mediante transacción de rollback en DB sintética. HCU usa su trigger atómico existente, sin escritura duplicada. No despliegue nuevo ni cambios de producción; revocación de URLs históricas, Auth alojada, recuperación/alertas y aceptación clínica/LOPDP siguen abiertos. La evidencia del 03-10 siguiente se conserva con su alcance original.

[CI real37175271836](https://github.com/AS2019JV/denta-pro/actions/runs/37175271836), head4cd56a2/merge208f107 con árbol Git idéntico: **256/256**, tipos/lint/build,824 textos sin hallazgos,audit producción0 y93 artefactos de navegador sin sentinel. Los ocho HIGH de herramientas permanecen declarados. Scanner/snapshot ahora rechazan también JWT del principal de entrega; el seguimiento necesita su CI propio. Prueba SQL de migración4 y HCU1 revierten todos sus cambios y dejan DB sintética detenida.

## Evidencia vigente — 03-10-2026

**NO-GO.** [Candidato: arquitectura, gates, evidencias, bloqueo CDN y rollback](CANDIDATE_READINESS_2026-10-03.md). Cadena canónica aplicada solamente a cliniaplus-staging con guardas/readback; producción intacta.

- API alojada **13/13 grupos** con JWT ordinarios, dos clínicas y cuatro buckets privados. Revisión adicional: **P1 CDN**, lectura cacheada200 tras retiro/degradación/logout global/ban aunque RLS/firma nuevos niegan. Revocación completa **BLOCKED**.
- Agenda **8/8 grupos locales**,32 carreras e independencia entre clínicas; ocho carreras alojadas sin HTTP500. HCU/PDF: regresiones de contexto y verificación de bytes/render reales.
- Recuperación DB+Storage+configuración y overlays: **6/6,5/5,6/6**. RTO sintético13021.311s/RPO0 en fuente quiescente; no acredita SLA ni backups alojados.
- Audit producción cero; completo ocho HIGH propagados por braces de build sin parche. Plugin Tailwind dev-only, ninguna versión/integridad cambiada.
- [CI real37160546400](https://github.com/AS2019JV/denta-pro/actions/runs/37160546400), candidato544a092: tipos/lint/**222/222 tests**/build/scan776 textos/audit producción0;92 artefactos de navegador sin sentinel de secreto. Árbol probado y publicado iguales. [PR draft1](https://github.com/AS2019JV/denta-pro/pull/1), sin promoción de producción.
- [CI225/225 del nuevo candidato a281fce](https://github.com/AS2019JV/denta-pro/actions/runs/37163120300) y Preview8ed9JjDyMHXLhqh9Q3sYDB1wy48c Ready: login doctor, dos pacientes propios, paciente ajeno denegado, campos médicos vacíos correctamente etiquetados y logout/redirección anónima verificados en navegador. Variables staging limitadas a esa rama; seis redirects HTTPS exactos sin wildcard. CLI bloqueado por SSO conservado. Resto de matriz runtime/mail/MFA abierto.
- P1 confirmado también25m32s después de expirar el JWT original: Postgres401 por expiración, PDF200/HIT mismo hash en dos rutas. No asumir contención acortando JWT o añadiendo no-store. Revisión independiente valida el alcance de un bucket/región; no acceso anónimo demostrado. Alertas, backup alojado y aceptación profesional/privacidad siguen abiertos.

## Evidencia histórica — 02-10-2026

**NO-GO clínico.** El bloqueo local de recursos fue superado: se ejecutaron restauraciones de esquema capturado, upgrades aislados y la matriz real de Auth/PostgREST/Storage. Se mantienen intactas las bases remotas y los volúmenes locales. No se enviaron correos reales.

- [Matriz del candidato capturado](evidence/2026-10-02-contract-api/captured-linked-v2-1/execution.json): **26/26** con cinco actores, JWT de login real, dos clínicas y cuatro buckets privados. Incluye lectura/escritura/firma ajena, caducidad, metadata falsa y revocación de perfil/membresía. Su alcance es local; no acredita despliegue ni aceptación clínica.
- [Cuotas durables SQL](evidence/2026-10-02-email-budget/attempt-5/execution.json): **12 grupos** reales, concurrencia y reserva atómica, sin guardar correo/IP en claro. [Invitaciones SQL](evidence/2026-10-02-invitation-sql/1/execution.json): **3/3**. Son pruebas SQL; no equivalen al proveedor de correo desplegado.
- [Staging capturado](evidence/2026-10-02-captured-upgrade/stage-3/execution.json) y [proyecto vinculado capturado](evidence/2026-10-02-captured-upgrade/linked-2/execution.json): **14 pasos** de upgrade en cada clon. [Paridad](evidence/2026-10-02-captured-upgrade/parity-2/contract-comparison.json) todavía parcial por permisos heredados de `supabase_auth_admin`; no se eliminaron sin verificar el hook remoto.
- Se reprodujo un **P1 local**: un JWT anterior conservaba lectura clínica después de ban de Auth/logout global. [Antes](evidence/2026-10-02-auth-revocation/before-1/execution.json) y [después](evidence/2026-10-02-auth-revocation/after-1/execution.json): la nueva migración verifica usuario/sesión vivos y la misma prueba niega lectura, rol y perfil. La corrección aún no se desplegó remotamente.
- Snapshot `candidate-20261002-final`: instalación congelada **646 paquetes**, tipos/lint/**151 tests**/build **exit0**; [evidencia](evidence/2026-10-02-release/verification.json). Audit npm completo y producción: cero avisos. Este snapshot precede las últimas correcciones de sesión/enrolamiento/documentos; requiere nueva validación final.
- [Managed Supabase desde volúmenes vacíos](evidence/2026-10-02-clean-managed/attempt-1/execution.json): Auth **7→77** migraciones, Storage **0→68**, cero usuarios/objetos/buckets/tablas de aplicación antes del install. No es recuperación de datos ni respaldo completo.

En cierre: registro/invitaciones con intención privada y sesión verificada; snapshot inmutable de recetas nuevas; instalación y matriz final sobre la base limpia; bundle del navegador con sentinel de secreto de servidor. **No marcar esos gates VERIFIED desde mocks.** CI remota, configuración/despliegue, recuperación DB+bytes+configuración/RPO/RTO, alarmas y aceptación clínica/privacidad siguen pendientes.

## Revisión histórica de seguridad — 01-10-2026

**NO-GO clínico.** [Cierre de seguridad, arquitectura, correcciones y bloqueos](SECURITY_CLOSURE_2026-10-01.md). La revisión por áreas reprodujo fallos de redirección de confirmación, correo e invitaciones con autoridad histórica y HTML de registro; se aplicaron correcciones locales y regresiones de las fuentes reales con proveedores sintéticos. Consumidores de media adaptados a buckets privados, sin abrir permisos. No se modificó producción ni se enviaron mensajes reales.

Snapshot final611archivos: instalación congelada646paquetes, tipos/lint/119tests/build **exit0**. Regresión adicional63/63; revisión adversaria34/34 de casos ya contenidos en esas suites. Escaneo final1099archivos de texto visibles para Git: cero hallazgos en las reglas acotadas; historial/ignorados/desplegado fuera de alcance. Auditorías npm actuales completas/producción: cero avisos conocidos. CI incorpora ambos gates, pero su ejecución remota sigue pendiente. [Comandos/resultados/hashes finales de esta entrega](evidence/2026-10-01-security/execution.json) distinguen pruebas ejecutadas y no ejecutadas. Ningún test con proveedores simulados sustituye JWT/Storage/navegador reales.

Docker local respondió, pero todos los servicios estaban detenidos y la inspección encontró435572KiB de RAM libre; una segunda lectura obtuvo1423596KiB y después del build482804KiB. El build aislado final pasó; **integración BLOCKED por recursos**, con solicitud pendiente de liberar al menos2GB. Disco observado:15,84GB libres. La matriz API preparada ahora incluye cuatro buckets, bytes/firma/caducidad, listado ajeno y revocación; todavía requiere ejecución y revisión sobre la cadena canónica.

Se mantienen01A/01B/02 y los gates de alta confiable, control durable de abuso, recuperación DB+bytes+configuración, alertas, privacidad/autoría y UAT. El `DR_DRILL_EVIDENCE_LATEST.json` histórico no es una restauración real: su generador valida manifiestos/flags/tiempos suministrados. No usar su PASS ni la baseline que ya contenía M7 para cerrar recuperación/instalación limpia.

Los apartados siguientes conservan evidencia histórica y sus límites. La aceptación vigente exige el mismo candidato final, paridad e integración reales.

Fecha: 28-09-2026, Ecuador. Base Git: `f96fbb898ec2a0615dec293ee3e5ce0a9b41b170`, con cambios anteriores conservados. **Estado global: PARCIAL / NO-GO clínico.** No se ha desplegado ni modificado producción.

Plan de cierre vigente: [26 entregas con agente, esfuerzo, dependencias, aceptación y reversión](PLAN_DE_CIERRE_PRODUCCION_2026-09-28.md). La planificación no cambia el estado de aceptación: primero PREP y 01A; la paridad remota, matriz completa, recuperación y aprobaciones humanas siguen pendientes.

## Entregado y límites

| Encargo | Estado actual | Evidencia / pendiente |
| --- | --- | --- |
| PREP — Reproducibilidad y CI | VERIFICADO local; CI remoto pendiente | [Snapshot y runner](PREP_REPRODUCIBILIDAD_CI_2026-09-28.md): copia aislada instala646paquetes, tipos/lint/83tests/build exit0; hashes intactos. Workflow configurado, no ejecutado en GitHub. |
| 00 — Inventario | VERIFICADO documental/estático | [36 comportamientos y cinco preguntas](00_INVENTARIO_DE_CIERRE.md); comparación con Dentalink, Dentally y Curve. No verifica funcionamiento desplegado. |
| 01 — Staging | PARCIAL; cadena SQL declarada con informes y capturas remotas acotadas verificadas | [Attempt3](evidence/2026-09-28-convergence/attempt-3/execution.json):17tablas y RPC de informes convergen en dos clones. [Dos dumps SQL de solo esquema](01B_CAPTURA_ESQUEMA_2026-09-29.md) capturados; restauración aislada, configuración administrada, instalación limpia/API y paridad remota pendientes. |
| 02 — Roles/Storage | PARCIAL; porción local verificada | [SQL y contratos](reconciliation/encargo02/README.md) aplicados solo local. Auth/RPC/PostgREST/Storage y perfil con JWT previo verificados en evidencia separada. Frontend usa identidad y membresías vivas, limpia caché/formularios y rechaza respuestas anteriores. Matriz completa/contención/carreras e imágenes privadas siguen pendientes. |
| 03 — Recetas | PARCIAL; navegación local verificada | [Implementación](03_RECETAS_ACCESO_RAPIDO.md): selector y pestaña con URL; navegador local real verifica selección, recarga y Atrás. Autorización de emisión y PDF clínico completo requieren pruebas separadas; no se declara release desplegada. |
| 04 — Sin finanzas | PARCIAL; retiro ampliado | Dashboard/lista/detalle/calendario, tratamientos, informes y configuración adaptados. Marketing/recordatorio de pago retirados. [Catálogo y reporte local](01_04_06_CONTINUACION_2026-09-28.md) conservan valores históricos. Exportaciones/consumidores legacy y matriz completa pendientes. |
| 05 — Agenda | PARCIAL; porción local verificada |10casos JWT reales y flujo de recepción persistido; estados, exclusión contra solapamientos, horarios y auditoría. Convergencia01/02, disponibilidad laboral, idempotencia y actualización entre clientes pendientes. |
| 06 — Dashboard/informes | PARCIAL; informes operativos locales verificados |RPC nueva con conteos exactos, períodos Guayaquil, seis estados, asistencia y PDF sin finanzas. Owner/doctor/recepción y negativos JWT probados. Tarjetas de asistencia/ausencias y actualización completa del dashboard pendientes. |
| 07–10 | PENDIENTES de cierre |Tutorización, CSV, HCU/PDF clínico, notificaciones/WhatsApp y correos Auth no tienen aceptación completa. Descarga sintética de receta verificada como smoke de carga a demanda. |
| 11 — UX | PARCIAL acotado |Agenda/landing en320/360/768/1280px, oscuro de agenda, título/menú y login móvil. Resto de pantallas, teclado, zoom200% y WCAG pendientes. |
| 12 — Rendimiento | PARCIAL; medido local pequeño |Build optimizado, navegación y p95API con33pacientes sintéticos. Ficha447→320kB, landing178→133kB. No equivale a ensayo5000/10 usuarios ni mediciones de campo. |
| 13–15 | PENDIENTES |Se conservan gates de seguridad/privacidad, manual, restauración de base+Storage, UAT y Go/No-Go. |

## Cambio real de staging

Proyecto: `cliniaplus-staging`, `phihonofwyerpfgqfekt`. Migración remota `20260926155227`, `enforce_staging_demographic_view_boundary`.

- Vista `receptionist_patient_view`: `security_invoker=true`, definición/columnas intactas.
- Anónimo: sin acceso de tabla ni columnas.
- Autenticado: solo SELECT; también revocado MAINTAIN de PostgreSQL17.
- Patients conserva RLS y cero políticas. Hasta reconciliación, esta vista no ofrece lectura funcional a recepción.
- Se cambió únicamente este límite de vista y su historial de migración. No se cargaron filas de pacientes/usuarios ni se crearon recursos.

La consulta elevada de catálogo verifica estos metadatos y privilegios efectivos. **No prueba autorización mediante JWT, PostgREST ni acceso entre clínicas.** La contención posterior está en [stop.sql](reconciliation/encargo01_staging_view_boundary.stop.sql); mantiene datos y seguridad invoker. No restaurar automáticamente los grants vulnerables anteriores.

## Siguiente gate necesario

Para cerrar01 y habilitar02:

1. Runtime aislado **implementado**: [operación local](../../tools/local-supabase/README.md), siete servicios reales y publicación explícita en loopback. Start/Stop conservan volúmenes; no usar CLI start con fixtures ni `.env.local` productivo.
2. Convergencia SQL operativa declarada e informes comprobados en [attempt3](evidence/2026-09-28-convergence/attempt-3/execution.json); ejecutar instalación limpia/upgrade completo y API antes de promocionar. Las bases fuente ya tenían M7; no es reconstrucción remota completa.
3. [Captura directa del29-09](01B_CAPTURA_ESQUEMA_2026-09-29.md): catálogos vivos y dumps SQL de los esquemas de aplicación de ambos proyectos, con hashes y sin datos de pacientes. Restauración aislada, Auth/Storage administrados, archivos y configuración remota siguen pendientes. No resetear contraseña productiva ni tratar estas capturas como respaldo completo.
4. Autoridad, dashboard, selector, lista/detalle, tratamientos e informes adaptados localmente. Completar consumidores restantes, imágenes privadas y retiro04; no usar metadata de rol ni comodines clínicos para recepción.
5. Completar matriz02/contención y recorridos restantes; auditoría/derechos local tiene [continuación aprobada](evidence/2026-09-27/auth-rights-continued/execution.json). Ejecutar clean/upgrade contra el mismo contrato final. Mantener pendientes remotos y aprobación humana explícitos.

No se reseteará staging ocupado ni se copiarán pacientes reales como atajo. El SQL de contención ya aplicado no permite saltar este gate.

## Secuencia restante finita

Después de01/02: completar04; agenda05; métricas06; pacientes/tutores07; CSV08; HCU/recetas/PDF09; WhatsApp/notificaciones10A y Auth10B; responsive/oscuro11; rendimiento12; ASVS/LOPDP13; manual14; recuperación/UAT/Go-No-Go15. Cada entrega mantiene pruebas, reversión y pendientes; solo se avanza una dependencia cuando su evidencia está disponible.

La validación de firma visible, autoría histórica, acreditación profesional, custodia/privacidad y UAT humana sigue abierta. Hay mediciones locales pequeñas; los objetivos de rendimiento a escala y RPO/RTO todavía no se han verificado.

## Verificación histórica del 26-09-2026

Pruebas locales: comparador 8/8, política/guardado de recetas 11/11 y retiro financiero 13/13, exit0. TSC final `--noEmit --incremental false`: exit0. **Build final `npm run build`: exit0**, Next.js15.5.26, con advertencias de imágenes y dependencias de hooks en otras pantallas. La advertencia del editor PatientPrescriptions quedó corregida mediante callbacks y dependencias completas; no se desactivaron lint ni comprobación de tipos.

Evidencia conservada:

- [Registro de resultados reales](evidence/2026-09-26/local-verification.json) y [SHA256 de 22 fuentes/entradas seleccionadas](evidence/2026-09-26/source-manifest.json). Las huellas se comprobaron intactas tras el build. No es un snapshot completo de release ni un commit nuevo.
- [Build final aprobado](evidence/2026-09-26/build-final-repaired.log).
- [Fallo del sandbox](evidence/2026-09-26/build-sandbox.log), por spawn EPERM antes de compilar; se ejecutó después fuera del sandbox con autorización.
- [Primer build aprobado](evidence/2026-09-26/build-approved.log), anterior al ajuste final del editor.
- [Intento con error de sintaxis](evidence/2026-09-26/build-final.log), introducido al ajustar callbacks y corregido antes del TSC/build final. No se ocultó ni se presenta como aprobado.

Los tamaños First Load JS del build son 316kB en dashboard, 281kB en agenda y 517kB en ficha; son datos del bundler, no mediciones LCP/INP/CLS ni latencia Supabase. Evaluar el recorrido real y los bundles en ENCARGO12. Las advertencias restantes se revisarán dentro del comportamiento afectado, sin una limpieza indiscriminada de código ajeno.

Se preservaron cambios previos del checkout; no se creó commit, se desplegó la aplicación ni se cambió producción. Los detalles de archivos y reversión están en cada encargo. Ninguna prueba local sustituye el recorrido desplegado.

## Verificación actual del27-09-2026

[Informe completo de integración](02_04_VERIFICACION_LOCAL_2026-09-27.md), con cinco preguntas, archivos, evidencia, reversión y gates. Build final optimizado local exit0; 64 comprobaciones de código aprobadas y delta final CSP/middleware4/4. [Resultados reales de navegador](evidence/2026-09-27/frontend-ui-verification.json): recepción demográfica/paginación y bloqueo clínico; recetas por acción rápida, recarga y Atrás. La prueba inicial creó/editó un paciente inventado; la continuación final no repite mutaciones.

Se corrigió una redirección local que perdía la cookie por normalización de Next.js. Logs de intentos anteriores se conservan. Credenciales solo en `.temp` ignorado; evidencia pública redactada y [huellas de24 fuentes seleccionadas](evidence/2026-09-27/frontend-source-manifest.json). Las mediciones de bundles no acreditan los objetivos de rendimiento.

**Siguiente trabajo al27-09:** convergencia01 y matriz/consumidores restantes02, después retiro04 completo y agenda05. Ese artefacto histórico `.next` era local y no debe desplegarse; la aceptación actual usa `.next-clinia-acceptance` separado.

## Verificación actual del28-09-2026

[Informe de agenda/rendimiento](05_12_AGENDA_RENDIMIENTO_LOCAL_2026-09-28.md), con contrato de cinco preguntas, migración solo local, archivos, ensayos fallidos conservados, medidas, reversión y secuencia siguiente. [Resumen consolidado](evidence/2026-09-28-performance/verification-summary.json) y [manifest de fuentes](evidence/2026-09-28-performance/source-manifest.json).

Build final exit0 con tipos/lint; Node runner30tests/0fallos;10casos de agenda con JWT ordinarios; navegador recepción crea/reprograma/recarga/completa. Validación final de layout en cuatro anchos, modo oscuro acotado y descarga PDF sintética. Dashboard final ready715–1.591ms; p95RPC19,9–46,5ms en muestra pequeña. Recursos/caché variaron y no se midió online.

Próximo gate: **01 convergencia/paridad y02/04 matriz/consumidores restantes antes de promocionar la migración local**. Luego05/06 disponibilidad/idempotencia/métricas y07–15. PostgreSQL17.6 local requiere ensayar el mantenimiento de versión; no se actualizó ningún proyecto automáticamente. Estado global sigue **PARCIAL / NO-GO clínico**.

## Continuación actual del28-09-2026

[Convergencia, retiro e informes](01_04_06_CONTINUACION_2026-09-28.md): contratos operativos de17tablas coinciden en dos clones secundarios; datos completos conservados, contención SQL con rollback y privilegios por defecto verificados. La RPC de informes pasó seis verificaciones con JWT ordinarios solo en la primaria local. La convergencia de las secundarias todavía no acredita API/Auth/Storage canónicos.

Navegador owner verifica períodos, PDF, edición persistida de tratamiento y configuración. Capturas estables de informes en claro/oscuro y PDF operacional inspeccionados. Reportes485→248kB, tratamientos246→230kB, configuración302→271kB de First Load JS. Navegaciones pequeñas antes del último ajuste de autoridad tardaron1,3–4,4s; la lentitud global y los objetivos de campo siguen abiertos.

Corrección adicional: middleware permite informes operativos al odontólogo; revalidación rutinaria conserva formularios bajo modal de verificación, y logout/cambio de identidad/clínica/rol o fallo los descarta. Publicaciones de informes/recetas y feedback del catálogo se invalidan mientras se comprueba autoridad. Verificación final y hashes se conservan en `evidence/2026-09-28-convergence/verification-summary.json`.

## Ejecución del plan de cierre — PREP y01A

[PREP](PREP_REPRODUCIBILIDAD_CI_2026-09-28.md): una copia aislada identificada por hash completó instalación congelada, tipos, lint,83tests y build, exit0. Checks negativos prueban rechazo de red externa, herencia de secretos y propagación de errores. La app activa de3400 y su build permanecen separados. Se preservan fallos anteriores; warnings y CI remota siguen explícitos.

[Cadena SQL con informes](reconciliation/operational-convergence/README.md): attempt3 pasó22pasos/7checks, con cero diferencias en el contrato declarado y contención transaccional sin pérdida de datos sintéticos. Es avance de01A; no cierra sus pruebas API/instalación limpia ni01B. No se desplegó ni modificó producción en esta continuación.

[API aislada del contrato](01A_API_CONTRATO_LOCAL_2026-09-28.md): launcher/verificador preparados con revisión independiente. Primer start: Auth/REST saludables, Storage no listo; los tres servicios del candidato se detuvieron preservando el volumen y la base. La matriz JWT/bytes no se ejecutó. Host: unos215MiB libres al medir; pendiente liberar recursos y repetir la salud antes de ejecutar fixtures. La primaria3400 sigue separada. La captura01B se solicitó al agente y se documenta abajo.

## Captura remota del29-09-2026

[01B — captura de esquema](01B_CAPTURA_ESQUEMA_2026-09-29.md): el usuario pidió obtenerla directamente. Se capturaron catálogos acotados actuales de staging y proyecto vinculado sin datos de pacientes; 11 categorías de cada uno coinciden con27-09. Staging tiene cero buckets configurados y ambos proyectos carecen de la RPC de informes local. El intento inicial de CLI produjo0bytes; después `pg_dump` con una imagen local existente generó dos SQL solo de esquema:79.202 y177.577bytes, hashes verificados y cantidades de tablas/funciones concordantes con catálogos vivos. **Restauración aislada y respaldo completo siguen pendientes.** El disco C: quedó con menos de100MiB libres; no se inició otra pila, build ni restauración. No se desplegó, reseteó ni aprobó producción.
