# Clinia+ — Matriz de cierre por comportamiento

Fecha de inicio: 28-09-2026. **Estado global: NO-GO clínico.**

Actualización04-10: [Production Acceptance Matrix vigente](CANDIDATE_READINESS_2026-10-04.md). La arquitectura de entrega clínica por servidor y sus controles son pruebas locales; todavía no cierran el P1 de URLs cacheadas ni los gates externos. Esta matriz histórica conserva su evidencia y no equivale a aprobación clínica/privacidad.

Actualización03-10: [gates del candidato y evidencia real](CANDIDATE_READINESS_2026-10-03.md). La aceptación completa de cada comportamiento sigue separada de las pruebas técnicas acotadas.

Esta matriz conecta los 36 IDs del [inventario](00_INVENTARIO_DE_CIERRE.md) con las tareas del [plan](PLAN_DE_CIERRE_PRODUCCION_2026-09-28.md). Una evidencia local acotada se conserva y reutiliza; no cierra automáticamente la aceptación desplegada de un comportamiento.

Evidencia actual: [progreso](IMPLEMENTATION_PROGRESS.md), [convergencia/autoridad/informes](01_04_06_CONTINUACION_2026-09-28.md), [agenda/rendimiento](05_12_AGENDA_RENDIMIENTO_LOCAL_2026-09-28.md). **PARTIALLY VERIFIED** indica que aún falta una prueba, integración o aprobación material. **NOT VERIFIED** indica que falta su aceptación completa, aunque exista implementación.

| Inventario | Comportamiento | Encargos responsables | Estado para release | Qué falta para cerrar |
| --- | --- | --- | --- | --- |
| 00-01 | Evidencia y versión | PREP, 15B | PARTIALLY VERIFIED | Candidato544a092/CI remota222 tests verificados y PR draft; falta cierre de aceptación/despliegue/legacy suite |
| 00-02 | Entornos, esquema y clínica | 01A, 01B, 02A | PARTIALLY VERIFIED | Cadena final/API, limpio/upgrade y paridad remota |
| 00-03 | Registro, login y recuperación | 02A, 07B, 10B | PARTIALLY VERIFIED | Revocación completa, correo y flujo desplegado |
| 00-04 | Equipo, roles e invitaciones | 02A, 07B, 10B | PARTIALLY VERIFIED | Matriz completa e invitación real sin elevación |
| 00-05 | Sin finanzas activas | 04 | PARTIALLY VERIFIED | Consumidores y exports legacy, historial intacto |
| 00-06 | Navegación/acciones rápidas | 03, 11A | PARTIALLY VERIFIED | Regresión final y emisión clínica desde el recorrido |
| 00-07 | Dashboard, totales y caché | 06, 12A | PARTIALLY VERIFIED | Asistencia/ausencias y actualización coherente |
| 00-08 | Alta/edición demográfica | 07A, 02A | PARTIALLY VERIFIED | Casos de documentos, menores y matriz final |
| 00-09 | Búsqueda y ficha | 07A, 11A, 12B | PARTIALLY VERIFIED | Todos los roles, dispositivos y carga representativa |
| 00-10 | Familia/tutor | 07A, 13B | NOT VERIFIED | Vínculos diferenciados y política de representación |
| 00-11 | Horarios/disponibilidad | 05 | PARTIALLY VERIFIED | Pausas, ausencias y excepciones aprobadas |
| 00-12 | Cita/solapamientos | 05, 02A | PARTIALLY VERIFIED | Concurrencia local/alojada verificada; falta UAT e integración del candidato desplegado |
| 00-13 | Reprogramación | 05 | PARTIALLY VERIFIED | Edición obsoleta, idempotencia y sincronización |
| 00-14 | Estados/cancelación | 05, 06 | PARTIALLY VERIFIED | Integración final con métricas/eventos |
| 00-15 | Catálogo de tratamientos | 04, 07B | PARTIALLY VERIFIED | Consumidores restantes y permisos finales |
| 00-16 | Historia/HCU-033 | 09A, 13B | PARTIALLY VERIFIED | Bytes/render/contexto técnico verificado; falta aceptación clínica MSP/custodia |
| 00-17 | FDI/CPO-ceo | 09A | NOT VERIFIED | Casos adulto/temporal/mixto aprobados |
| 00-18 | Periodontograma | 09A | NOT VERIFIED | Validar o retirar del flujo con decisión clínica |
| 00-19 | Evoluciones/notas | 09A, 02A | NOT VERIFIED | Autoría, correcciones y edición concurrente |
| 00-20 | Recetas/reimpresión | 09B, 03 | PARTIALLY VERIFIED | Emisión idempotente y documento histórico consistente |
| 00-21 | Firma/credenciales | 09B, 07B | NOT VERIFIED | Fuente aprobada, permisos y requisito clínico/legal |
| 00-22 | Adjuntos/imágenes | 02B, 09B, 14A | BLOCKED | Revocación CDN falla con200 cacheado incluso25m32s tras expiración JWT; RLS/firma ajenos y recuperación local de bytes verificados |
| 00-23 | WhatsApp manual | 10A | NOT VERIFIED | Teléfono/texto/revisión y estados honestos |
| 00-24 | Marketing/bandejas/automatización | 04, 10A, 11B | PARTIALLY VERIFIED | Retiro completo de ejecución y promesas fuera de alcance |
| 00-25 | Importación CSV | 08 | NOT VERIFIED | Más de 1.000 filas, duplicados y fallos parciales |
| 00-26 | Exportación y entrega clínica | 08, 13B | NOT VERIFIED | Alcance, snapshot consistente, bytes y entrega autorizada |
| 00-27 | Privacidad/derechos/custodia | 13B, 02A, 08 | PARTIALLY VERIFIED | Políticas aprobadas y flujo completo conforme a ellas |
| 00-28 | Perfil/configuración clínica | 07B, 09B | PARTIALLY VERIFIED | Persistencia real y autoría histórica de documentos |
| 00-29 | Reportes operativos | 06, 01A | PARTIALLY VERIFIED | RPC integrada en cadena SQL acotada; API final y regresión desplegada |
| 00-30 | Ajustes/notificaciones | 07B, 10A | NOT VERIFIED | Preferencias persistidas y eventos reales |
| 00-31 | Onboarding/simplicidad | 07B, 15A | NOT VERIFIED | Clínica/equipo operables y UAT |
| 00-32 | Landing y promesas | 11B | PARTIALLY VERIFIED | Copy/enlaces finales coherentes con evidencia |
| 00-33 | Errores/accesibilidad/dispositivos | 11A, 12A, 12B | PARTIALLY VERIFIED | Matriz completa, teclado/zoom y medidas |
| 00-34 | Arquitectura/documentación | PREP, 14B | PARTIALLY VERIFIED | Manual basado en el candidato verificado |
| 00-35 | Respaldo/restauración | 14A | PARTIALLY VERIFIED | Restore local DB+bytes+config y overlays probado; falta backup alojado/escala/RPO-RTO acordados/alertas |
| 00-36 | Aceptación/liberación | 15A, 15B | NOT VERIFIED | UAT, aprobaciones y promoción autorizada |

## Responsables que deben identificarse

| Responsabilidad | Responsable/confirmación actual | Antes de |
| --- | --- | --- |
| Implementación y evidencia técnica | Agente ejecutor; titular del proyecto valida la entrega | Cada gate |
| Acceso/esquema remoto de solo lectura | Titular del proyecto; acceso concreto pendiente | Cierre 01B |
| Revisión HCU/odontograma/recetas | Odontólogo ecuatoriano habilitado; persona y disponibilidad pendientes | Cierre 09/15A |
| Representación, custodia y privacidad | Responsable de privacidad o asesor competente; designación pendiente | Políticas 13B y release |
| Aceptación de recepción | Usuario de recepción designado; disponibilidad pendiente | 15A |
| Operación y autorización de producción | Titular designa operador, aprobador y contacto de incidentes | 14A/15B |

Una firma o aprobación solo se registra cuando existe. El estado cambia por evidencia y alcance, no por porcentaje de avance.

