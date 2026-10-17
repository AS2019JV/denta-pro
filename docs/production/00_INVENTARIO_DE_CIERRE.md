# ENCARGO 00 — Inventario finito de cierre de Clinia+

Fecha de revisión: **25 de septiembre de 2026**. Base: checkout local en `f96fbb898ec2a0615dec293ee3e5ce0a9b41b170`, con modificaciones previas sin confirmar. Este documento revisa ese árbol de trabajo; no demuestra que el código esté desplegado.

**Estado: NO APTO para autorizar producción clínica.** El criterio de seguridad sigue siendo [M7](../security/M7_PRODUCTION_ACCEPTANCE_2026-09-22.md). El [reporte anterior](../../PRODUCTION_READINESS.md) queda como historial de afirmaciones pendientes de corroboración. Completar este inventario no equivale a completar los controles, obtener aprobación clínica/legal ni autorizar una migración o lanzamiento.

## 1. Alcance cerrado y autoridad

Producto: SaaS dental en español para Ecuador, centrado en pacientes, agenda de personal, historia clínica, recetas y documentos. LOPDP es la base de privacidad; las obligaciones clínicas y la validez de documentos requieren revisión de responsables ecuatorianos.

- **Sin finanzas:** cero campos, consultas, escrituras, cálculos, importaciones, exportaciones o flujos de cobro/facturación/pagos dentro del producto de este cierre. Conservar datos históricos y código útil fuera del flujo activo; no destruir tablas para cumplir esta decisión.
- Agenda operada por personal autorizado; no reservas públicas ni autónomas.
- WhatsApp: teléfono y borrador revisados, apertura manual de click-to-chat. No envío automático, no recepción, no bandeja sincronizada, no confirmación de entrega.
- Familia/tutor: vínculos simples, sin representante de pago ni acceso clínico heredado por parentesco.
- Importación inicial: CSV demográfico con revisión previa. Migraciones clínicas y de archivos requieren un encargo posterior específico.
- Firma visible del profesional: evidencia gráfica y atribución de autoría; validez jurídica, firma electrónica y aprobación clínica son controles separados.
- No IA diagnóstica, CRM, campañas, integraciones de imagen, DICOM/PACS ni nuevos módulos para alcanzar el cierre.

Cada decisión conserva un ID estable. P0 bloquea el uso con datos clínicos reales; P1 bloquea la aceptación funcional del piloto; P2 se difiere y debe quedar fuera del flujo activo. Una dependencia nombra otro ID; una aceptación es una condición futura, no un resultado ya obtenido. No se abrirá trabajo adicional salvo que una prueba de estos IDs descubra un fallo necesario para satisfacer su aceptación.

## 2. Evidencia y límites

| Nivel | Qué demuestra | Qué no demuestra |
| --- | --- | --- |
| ESTÁTICA | Ruta, consulta, rama o texto presente en el checkout revisado | Comportamiento desplegado, autorización efectiva, UX real |
| LOCAL | Comando reproducible y resultado sobre una revisión identificada | UAT, proveedor, RLS/Storage remoto o recuperación real |
| STAGING | API y navegador con usuarios/JWT reales, datos sintéticos, revisión y proyecto identificados | Aprobación legal o idéntica configuración de producción |
| HUMANA | Responsable identificable revisa un caso y aprueba su resultado | Otros casos, versiones o ambientes |
| OPERATIVA | Restauración y controles observados, logs y objetos verificables | Recuperación demostrada por constantes, hashes o declaraciones |

En este encargo se verificó estructura y código mediante lecturas dirigidas. No se ejecutaron mutaciones remotas, migraciones ni pruebas con pacientes. No se ejecutó una nueva suite/build porque solo se editan documentos. Los ensayos futuros usarán dos clínicas sintéticas A/B y usuarios propietario, odontólogo, recepción, inactivo y ajeno. Toda evidencia debe registrar fecha, revisión, ambiente, actor/rol, esperado, observado, comando o pasos, salida/errores y estado verificado/no verificado; sin credenciales ni datos reales.

La existencia de `STAGE_MIGRATION_CONVERGENCE_EVIDENCE.json` no valida por sí sola la equivalencia completa entre ambientes ni pruebas con JWT y API. `prod-chk-a02-uat-protocol.test.cjs` lee documentos y código; no observa a un clínico utilizando el producto. `scripts/dr-drill-runner.cjs:261` evalúa manifiestos y tiempos recibidos como argumentos y calcula un SHA-256; no ejecuta una restauración. Un hash prueba correspondencia de bytes, no aprobación de una persona ni autenticidad de la recuperación. Estas distinciones sustituyen cualquier interpretación de los checks del reporte como certificación.

### Catálogo remoto de solo lectura aportado por el coordinador

Consulta actual: **26-09-2026 aproximadamente 03:17 UTC / 25-09 Ecuador**. Proyectos identificados por metadatos, sin extraer filas de pacientes ni credenciales. La consulta no cambia producción.

| Metadato | Producción: Auto-SNet `leqsrfyjvuxxdsubjjin` | Staging: cliniaplus-staging `phihonofwyerpfgqfekt` |
| --- | --- | --- |
| Región / motor | sa-east-1 / PostgreSQL 17.6 | sa-east-1 / PostgreSQL 17.6 |
| Tablas base public | 24 | 24 |
| Columnas reportadas de relaciones public, incluidas vistas | 300 | 285 |
| Relaciones public, incluidas vistas/secuencias | 29 | 26 |
| Políticas public / Storage | 72 / 22 | 11 / 2 |
| Funciones public | 28 | 7 |
| Triggers personalizados public/auth/storage | 22 | 14 |
| Buckets | 10 | 0 |
| Entradas de historial de migraciones | 57 | 11 |

La diferencia de columnas procede de vistas ausentes/distintas, **no de quince columnas faltantes en tablas base**. Faltan en staging `dashboard_stats_view`, `patient_stats_view`, `recall_queue`; `receptionist_patient_view` difiere (producción incluye `patient_id`/`last_visit_date`; staging `id`/`cedula`/`created_at`). Staging agrega `data_rights_requests.resolution_notes`, cambio intencional M7 que debe preservarse.

Faltan 22 funciones presentes en producción, entre ellas `get_patient_profile_secure`, `get_patients_with_stats`, `get_family_unit_with_stats`, `accept_clinic_invitation` y `custom_access_token_hook`; hay funciones adicionales solo en staging, por lo que la diferencia neta no representa el número de ausentes. También faltan triggers Auth de creación/verificación de usuario, `logs.log_patient_view`; `logs.access_audit` tiene tres políticas en producción y ninguna en staging. Esquemas observados: producción `public`/`logs`; staging además `security_internal`. Configuración efectiva de Auth, activación de hooks y proveedor no verificados por el conector disponible.

Staging vacío confirmado por conteos agregados de sus 24 tablas public, `auth.users` y `storage.objects`. **No existe paridad utilizable todavía.** El siguiente encargo debe comparar contratos necesarios con los cambios M7 intencionales; no copiar políticas débiles de producción ni asumir que más políticas significa mayor seguridad. Preferir reconciliación aditiva revisada en el staging existente y preservación de cambios válidos, sin reset ni nuevo proyecto/costo como primera opción. Los conteos y ausencia de datos habilitan esa investigación; no autorizan por sí solos DDL ni prueban RLS/Storage/recorridos.

## 3. Referencias oficiales consultadas

Consulta web del 25-09-2026. Son referentes de flujo, no instrucciones para copiar todo su alcance ni evidencia sobre Clinia+.

| Referente | Agenda y registro clínico | Documentos e importación | Decisión para Clinia+ |
| --- | --- | --- | --- |
| Dentalink | Presenta agenda, historia clínica, evolución y recetas integradas. [Producto oficial](https://www.softwaredentalink.com/) | Su ayuda describe carga con plantilla, identificación del paciente y apoyo de onboarding; el alcance varía por país. [Carga masiva](https://ayuda.softwaredentalink.com/es/articles/9488192-carga-masiva-en-dentalink) | Una ficha por paciente y CSV guiado. No prometer importación universal ni trasladar funciones financieras. |
| Dentally | Su ayuda organiza calendario, ficha y charting como tareas diferenciadas. [Centro de ayuda](https://help.dentally.com/en/) | Permite adjuntar documentos a correspondencia. Su proceso de migración revisa datos en sandbox y trata documentos/imágenes por separado. [Correspondencia](https://help.dentally.com/en/articles/3566449-how-to-use-the-correspondence-tab), [Migración](https://www.dentally.com/en-gb/insights-hub/dentally-migration-made-simple-what-you-need-to-know) | Revisión previa al ingreso, trazabilidad de adjuntos y separación explícita de metadatos y binarios. La bandeja de Dentally no justifica afirmar una integración WhatsApp propia. |
| Curve Dental | Agrupa scheduling, charting y Files and Letters. [Funciones](https://www.curvedental.com/feature-overview) | Su guía exige cotejar citas/perfiles/historia en pacientes y explica que documentos y perio necesitan tratamiento separado. [Conversion Homework](https://curvedental.zendesk.com/hc/en-us/articles/49071551478547-Conversion-Homework) | Validar resultados completos, no solo número de filas; mantener sencilla la secuencia paciente → cita → atención → documento. |

Inferencia de diseño: reducir entradas duplicadas y promesas de automatización facilita revisión y capacitación. La simplicidad de Clinia+ se comprobará con tareas reales, no se presume a partir de páginas comerciales. Supabase distingue autorización por RLS de autenticación y aclara que backup de base de datos no incluye los objetos Storage: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Backups](https://supabase.com/docs/guides/platform/backups). La consulta del índice `changelog.md` no fue accesible; no se implementan cambios Supabase en este encargo.

## 4. Mapa de rutas y superficies revisadas

Los grupos `(dashboard)`, `(auth)` y `(landing)` no forman parte de la URL.

| Ruta/superficie actual | Usuario previsto | Decisión/IDs |
| --- | --- | --- |
| `/`, `/sobre-nosotros`, `/schedule-demo` | Visitante | Simplificar afirmaciones y petición de demo; 00-32 |
| `/login`, `/signup`, `/forgot-password`, `/update-password`, `/auth/confirm`, `/auth/callback`, `/api/auth/confirm` | Usuario/invitado | Conservar con autorización comprobada; 00-03 |
| `/dashboard` | Personal activo | Simplificar resumen, acciones y onboarding; 00-06, 00-07, 00-31 |
| `/patients`, `/patients/[id]` | Recepción demográfica; clínico para salud | Corregir alcance/roles/exportación; 00-08 a 00-10, 00-16 a 00-22, 00-25, 00-26 |
| `/calendar`, cita rápida, lista y dashboard | Personal activo | Corregir disponibilidad, concurrencia y estados; 00-11 a 00-14 |
| `/recipes` | Odontólogo habilitado | Conservar hub y corregir emisión/reimpresión; 00-20, 00-21 |
| `/dashboard/services`, servicios en configuración | Propietario/encargado autorizado | Una entrada canónica sin precios; 00-15 |
| `/dentists`, `/profile`, `/clinic` | Propietario/equipo según permiso | Corregir autoridad, perfil y horario; 00-04, 00-11, 00-28 |
| `/settings` | Usuario para preferencias; propietario para privacidad/equipo | Simplificar y garantizar persistencia real; 00-27 a 00-30 |
| `/reports` | Propietario, alcance agregado aprobado | Simplificar a operación sin valores económicos; 00-29 |
| `/billing`, `/pay/[id]`, suscripción, métodos de pago, `/api/payments/subscribe`, `/api/webhooks/kushki` | Fuera de alcance | Retirar del flujo activo y bloquear endpoints; 00-05 |
| `/messages`, `/marketing`, automatización/recall | Fuera del piloto salvo click-to-chat manual | Diferir bandeja/campañas; conservar solo contacto manual; 00-23, 00-24 |
| `/api/send-email`, invitación/reenvío y acciones de settings | Servidor autenticado para finalidad permitida | Solo correo transaccional necesario y acciones autorizadas; 00-03, 00-04, 00-15, 00-24 |
| Notificaciones, logo/avatar, errores, accesibilidad | Personal/visitante según superficie | 00-30, 00-33 |

## 5. Inventario de comportamientos y cinco preguntas

### 00-01 — Estado de evidencia y preparación — **corregir · P0**

**Usuario:** propietario, responsable de liberación. **Evidencia:** `PRODUCTION_READINESS.md`, M7, tests UAT/DR descritos arriba.

1. **¿Por qué existe?** Decidir con evidencia si puede operarse la clínica.
2. **¿Qué debe hacer exactamente?** Separar verificado/no verificado y vincular cada aceptación al ambiente/revisión y responsable.
3. **¿Qué está prohibido?** Convertir texto, mocks, checks estáticos o hashes en UAT, restauración, firma humana o certificación.
4. **¿Cómo se verifica?** Trazar cada afirmación a resultados reproducibles y aprobación humana cuando corresponda.
5. **¿Cómo se deshace de forma segura?** Retirar una afirmación no sustentada manteniendo historial y evidencia original.

**Aceptación:** ninguna afirmación de preparación vigente sin evidencia apropiada; el banner antecede al reporte histórico. **Dependencia:** ninguna; debe preceder a toda implementación.

### 00-02 — Separación de ambientes, esquema y tenant — **corregir · P0**

**Usuario:** equipo técnico, clínica A/B. **Evidencia:** M7, migraciones locales y artefacto de convergencia; estado remoto requiere registro independiente.

1. **Por qué:** impedir asociaciones y accesos entre clínicas y cambios accidentales en producción.
2. **Esperado:** identificar ambiente, versión PostgreSQL, migraciones, tablas, vistas, funciones, triggers, grants, RLS y Storage; reconciliar clean install y upgrade en staging.
3. **Prohibido:** aplicar DDL/migraciones a producción por esta revisión; usar clave privilegiada como prueba de RLS; asumir paridad por cantidad de tablas.
4. **Verificación:** inventario de metadatos de solo lectura; luego pruebas API/JWT positivas y negativas por entidad y rol en staging sintético.
5. **Deshacer:** detener el despliegue; recuperar staging según plan probado; conservar el manifiesto anterior y no alterar datos clínicos.

**Aceptación:** esquema/grants/políticas requeridos convergen; enlaces paciente/clínica/médico/familia ajenos se rechazan; aislamiento A/B y usuarios inactivos probado. **Dependencia:** 00-01; recurso externo: staging aislado y configuración identificada.

### 00-03 — Registro, login, recuperación y sesión — **conservar y corregir · P0**

**Usuario:** propietario que registra clínica, invitado y personal. **Evidencia:** `middleware.ts`, `auth-context.tsx`, acciones de registro/confirmación; el contexto contiene fallback a `user_metadata.role`.

1. **Por qué:** entrar y recuperar acceso de forma comprensible.
2. **Esperado:** sesión validada en servidor, rol/membresía activos controlados por servidor; recuperación/confirmación con URL permitida y errores claros.
3. **Prohibido:** conceder autoridad desde metadata editable, fallback a propietario, sesión de clínica anterior o mensaje de éxito si falló correo/provisión.
4. **Verificación:** signup, invitación, confirmación, reset, logout y revocación en navegador; JWT antiguo y llamadas directas negativas.
5. **Deshacer:** revocar acceso/credencial y desactivar onboarding; conservar registros y reparar la cuenta de forma auditada.

**Aceptación:** actor sin rol activo queda fuera; invitación/reset funcionan con proveedor real; logout/cambio de clínica limpian datos y caché. **Dependencia:** 00-02, 00-04, correo transaccional configurado.

### 00-04 — Equipo, roles e invitaciones — **corregir · P0**

**Usuario:** propietario, odontólogo, recepción. **Evidencia:** `invite-member.ts`, `/dentists`, filtros de sidebar y `get_clinic_member_role`.

1. **Por qué:** asignar responsabilidades mínimas y retirar acceso.
2. **Esperado:** propietario administra personal; odontólogo atiende y prescribe; recepción maneja demografía/contacto/agenda. Propietario administrativo no recibe permiso clínico por defecto sin habilitación aprobada.
3. **Prohibido:** recepción modifica diagnósticos/firma/licencia; invitar propietarios; ocultar UI como único control; autoridad ambigua entre perfil y membresía.
4. **Verificación:** matriz SELECT/INSERT/UPDATE/DELETE/RPC/Storage con JWT reales, autoría, invitación duplicada, usuario demovido/inactivo y clínica ajena.
5. **Deshacer:** suspender/revocar miembro y restaurar rol previo aprobado; no eliminar sus documentos clínicos.

**Aceptación:** matriz aprobada por responsable clínico/propietario y aplicada en servidor/RLS; las referencias a médicos exigen membresía válida. **Dependencia:** 00-02; revocación completa también requiere 00-03.

### 00-05 — Cero finanzas en el flujo activo — **retirar · P0**

**Usuario:** todo usuario. **Evidencia:** dashboard/hook lee `billings`; dashboard y calendario insertan `billings`; formularios/importación usan `account_balance`; ficha incluye pagos y join de facturas; familia usa `total_billed`; reportes usan precios/demanda monetaria. Checkout llama `notFound()` y subscribe devuelve 503; el webhook aún contiene escrituras.

1. **Por qué:** delimitar el primer producto sin administración financiera.
2. **Esperado:** retirar controles, payloads, lecturas, cálculos, exports y efectos secundarios financieros de todas las rutas activas; endpoints de pago inhabilitados en servidor.
3. **Prohibido:** solo ocultar menú; escribir factura al agendar; exportar saldos; dejar webhook/suscripción operables; borrar históricos para simular cumplimiento.
4. **Verificación:** búsqueda dirigida más red del navegador y pruebas API: intake, agenda, familia, servicios, reportes, configuración, CSV/JSON no transmiten campos económicos ni acceden a tablas financieras.
5. **Deshacer:** revertir código documentado sin destruir tablas; cualquier reactivación requiere otro alcance y aprobación.

**Aceptación:** todos los recorridos autorizados cumplen cero lecturas/escrituras financieras; rutas directas y endpoints no habilitan cobros. **Dependencia:** 00-01; control API validado con 00-02/00-04.

### 00-06 — Navegación y acciones rápidas — **corregir · P1**

**Usuario:** personal autorizado por acción. **Evidencia:** dashboard línea 500 apunta `/dashboard/recipes`; App Router contiene `/recipes`, sin página `/dashboard/recipes`; sidebar sí apunta a la ruta correcta. Riesgo 404 identificado estáticamente, pendiente navegador.

1. **Por qué:** abrir tareas frecuentes sin perder contexto.
2. **Esperado:** paciente, cita, recetas y servicio apuntan a entradas canónicas con controles de rol y contexto.
3. **Prohibido:** ruta inexistente, acción financiera o acceso clínico para recepción.
4. **Verificación:** clic y URL directa por cada rol, escritorio/móvil, regreso e ID inválido.
5. **Deshacer:** retirar temporalmente una acción defectuosa o revertir su destino; sin tocar registros.

**Aceptación:** ninguna acción activa termina en 404 inesperado ni formulario sin contexto; historial/regreso coherentes. **Dependencia:** 00-04, 00-05.

### 00-07 — Dashboard, totales y caché — **simplificar y corregir · P1**

**Usuario:** personal activo. **Evidencia:** `use-dashboard-data.ts:10` limita pacientes a 10, adjunta `totalCount` al array; dashboard muestra `patients.length`. Próximas citas se recortan a cinco antes de mostrar algunos contadores; claves de consulta no incluyen clínica.

1. **Por qué:** conocer agenda del día y acceder a pacientes recientes.
2. **Esperado:** separar total agregado de lista limitada, fecha de clínica y permisos; caché incluye clínica/actor y se invalida después de cambios.
3. **Prohibido:** mostrar el tamaño de una página como total; mezclar cachés de clínicas; cifras económicas o ejemplos ficticios.
4. **Verificación:** más de 10 pacientes y cinco citas, límites de API, medianoche Guayaquil, cambio A/B, mutación y error de red.
5. **Deshacer:** ocultar el KPI que no puede garantizarse; mantener lista etiquetada como reciente y agenda operativa.

**Aceptación:** totales exactos para filtros definidos o explícitamente no disponibles; ninguna caché ajena después de cambiar clínica. **Dependencia:** 00-02, 00-04, 00-05, 00-11.

### 00-08 — Alta y edición demográfica — **corregir · P1**

**Usuario:** recepción y personal habilitado. **Evidencia:** `add-patient-form.tsx`, validaciones, ficha; el payload actual incluye saldo.

1. **Por qué:** identificar y contactar a la persona correcta.
2. **Esperado:** nombre, identificación según tipo, nacimiento, contacto y tutor cuando corresponda; validación ecuatoriana sin excluir pasaporte/extranjeros o persona sin cédula.
3. **Prohibido:** datos financieros, clínica del payload manipulable, duplicados silenciosos, editar salud con permiso demográfico.
4. **Verificación:** adulto/menor, cédula válida/inválida, pasaporte, fechas futuras, identidad duplicada, guardado y recarga por rol.
5. **Deshacer:** corregir datos con rastro de autor; archivar altas equivocadas según custodia aprobada, sin hard delete clínico.

**Aceptación:** persistencia y mensajes exactos; campos mínimos aprobados; demografía separada de antecedentes/consentimientos clínicos. **Dependencia:** 00-02, 00-04, 00-05, 00-27.

### 00-09 — Búsqueda, filtros y ficha del paciente — **simplificar y corregir · P1**

**Usuario:** recepción demográfica; clínico para salud. **Evidencia:** `get_patients_with_stats` y paginación en listado/detalle; RPC comparte estadísticas y datos financieros/clínicos.

1. **Por qué:** localizar paciente y conservar su identidad durante atención.
2. **Esperado:** búsqueda/paginación estables por nombre/identificación, paciente activo correcto y ficha con secciones permitidas; consulta mínima por rol.
3. **Prohibido:** enviar campos clínicos a recepción y luego ocultarlos; indicadores de fidelidad monetaria, filtros sin backend o paciente de otra clínica.
4. **Verificación:** ID ajeno/ausente, resultados vacíos, segunda página, búsqueda rápida, enlace profundo y respuesta RPC por cada actor.
5. **Deshacer:** quitar filtro no soportado y volver a consulta simple autorizada; preservar URL/registro.

**Aceptación:** lista, total y detalle concuerdan; sin PII clínica innecesaria en respuesta demográfica; contexto visible en pantallas pequeñas. **Dependencia:** 00-02, 00-04, 00-05, 00-08.

### 00-10 — Familia y tutor — **simplificar · P1**

**Usuario:** recepción para vínculo demográfico; clínico para contexto autorizado. **Evidencia:** `family-center.tsx` usa `get_family_unit_with_stats`, representantes de pago y total pagado; campos `family_representative_id`/relación/cabeza en ficha.

1. **Por qué:** identificar tutor/contacto responsable y vínculos familiares.
2. **Esperado:** vínculo explícito dentro de clínica, relación y contacto; distinguir parentesco de representación legal y registrar soporte cuando requerido.
3. **Prohibido:** deuda/pago agrupado, herencia automática de acceso o consentimiento, ciclos/autovínculos y familiares de clínica ajena.
4. **Verificación:** menor y tutor, hermanos, contacto sin tutela, cambio/desvinculación, A/B y ausencia de campos económicos en RPC.
5. **Deshacer:** desvincular con registro del cambio; no eliminar personas ni trasladar historia clínica.

**Aceptación:** parentesco/tutor simple y entendible; permiso clínico independiente; no aparece representante de pago. **Dependencia:** 00-02, 00-05, 00-08, aprobación de custodia/representación en 00-27.

### 00-11 — Horarios, médicos y disponibilidad — **corregir · P1**

**Usuario:** propietario configura; personal consulta y agenda. **Evidencia:** `/clinic`, `/dentists`, calendario, perfil, selección de médicos y servicio.

1. **Por qué:** conocer cuándo y con quién se puede atender.
2. **Esperado:** horario de clínica/profesional, duración y excepciones acordadas; zona `America/Guayaquil`; médicos activos de esa clínica.
3. **Prohibido:** usar zona del dispositivo como autoridad, ofrecer médico inactivo o hueco no disponible; booking público/autónomo.
4. **Verificación:** límites horario/fecha, excepción, diferentes médicos, duración, navegador con otra zona y acceso ajeno.
5. **Deshacer:** restaurar horario anterior y revisar citas afectadas con operador; no cancelar pacientes automáticamente.

**Aceptación:** disponibilidad mostrada coincide con regla de servidor y agenda; reglas mínimas documentadas sin inventar un nuevo módulo. **Dependencia:** 00-02, 00-04, 00-15.

### 00-12 — Crear cita y excluir solapamientos — **corregir · P0**

**Usuario:** recepción/odontólogo autorizado. **Evidencia:** calendario, dashboard y quick dialog verifican conflicto y luego realizan insert separado; `calendar-conflict.ts` consulta intervalos.

1. **Por qué:** reservar una atención válida una sola vez.
2. **Esperado:** paciente/médico/servicio válidos, fin mayor que inicio, intervalos contiguos permitidos y exclusión atómica de solapamientos por clínica/médico en servidor.
3. **Prohibido:** depender de check-then-insert cliente, doble envío, aceptar conflicto al fallar consulta, producir factura.
4. **Verificación:** dos solicitudes simultáneas reales para mismo intervalo y actor distinto, hueco contiguo, citas canceladas, error y reintento.
5. **Deshacer:** cancelar la cita equivocada con motivo y rastro; no borrar para ocultar un conflicto.

**Aceptación:** exactamente una reserva concurrente aceptada cuando hay conflicto; misma regla en todos los puntos de entrada y API directa. **Dependencia:** 00-02, 00-04, 00-05, 00-11.

### 00-13 — Reprogramar y mover citas — **corregir · P1**

**Usuario:** personal autorizado. **Evidencia:** update/drag del calendario, ediciones y comprobación separada de conflicto.

1. **Por qué:** ajustar agenda sin perder duración ni trazabilidad.
2. **Esperado:** aplicar la misma exclusión atómica que crear, preservar duración y registrar cambio visible; confirmar destino cuando hay movimiento significativo.
3. **Prohibido:** cambiar solo inicio dejando fin inválido, sobrescribir edición concurrente o presentar éxito si update falla.
4. **Verificación:** arrastre y formulario al mismo hueco, conflicto concurrente, otra fecha/médico y error de servidor.
5. **Deshacer:** devolver al intervalo anterior solo si sigue libre; si no, operador elige otro hueco.

**Aceptación:** UI vuelve al estado persistido tras rechazo y no pierde cita ni duración. **Dependencia:** 00-12.

### 00-14 — Estados y cancelación de cita — **conservar y corregir · P1**

**Usuario:** personal autorizado. **Evidencia:** `appointment-list.tsx`, calendario y dashboard tienen acciones de estado.

1. **Por qué:** representar confirmada, atendida, cancelada o no asistida según catálogo acordado.
2. **Esperado:** un catálogo/transiciones comunes, motivo y autor cuando corresponde; agenda/lista/resumen coherentes.
3. **Prohibido:** cobrar al marcar atendida, cerrar historia sin acto clínico o eliminar cita/historial por cancelación.
4. **Verificación:** transición válida/inválida, reintento, usuario ajeno y recarga cruzada entre las tres vistas.
5. **Deshacer:** corrección de estado auditada; reapertura revalida disponibilidad y no reescribe documentos emitidos.

**Aceptación:** estados persistidos coinciden en todos los componentes; cancelación libera hueco conforme 00-12. **Dependencia:** 00-05, 00-12, 00-13.

### 00-15 — Catálogo de servicios — **simplificar · P1**

**Usuario:** propietario o encargado expresamente autorizado; personal selecciona. **Evidencia:** dos gestores en `/dashboard/services` y settings; `seedClinicServices` consulta `clinic_memberships` y usa cliente privilegiado.

1. **Por qué:** nombrar atención y definir duración sin duplicar entrada.
2. **Esperado:** nombre/duración/estado en una pantalla canónica, referencias históricas conservadas y autoridad de servidor explícita para seed/edición.
3. **Prohibido:** precios/tarifas, seed privilegiado basado solo en pertenencia, nombres de tabla asumidos o borrar servicio referenciado.
4. **Verificación:** crear/editar/desactivar/seleccionar, referencias históricas, actor no autorizado y ruta duplicada redirigida.
5. **Deshacer:** restaurar nombre/duración/estado previo; reactivar en vez de recrear IDs históricos.

**Aceptación:** ninguna operación económica; catálogo único y duración utilizada por todos los formularios de cita. **Dependencia:** 00-02, 00-04, 00-05.

### 00-16 — Historia y Formulario 033 — **corregir · P0**

**Usuario:** odontólogo habilitado; responsable clínico revisa. **Evidencia:** `hcu033-form.tsx`, `patient-medical-records.tsx`, almacenamiento `hcu033_forms`/`clinical_records`.

1. **Por qué:** documentar atención dental y antecedentes con identificación inequívoca.
2. **Esperado:** datos compartidos coherentes, autor/fecha/clinica/paciente, guardado verificable, campos y versión revisados frente a norma ecuatoriana vigente.
3. **Prohibido:** recepción lee/edita historia por una vista amplia; marcar formulario clínicamente aprobado por presencia de campos o checkbox.
4. **Verificación:** caso sintético completo y corrección, recarga, edición concurrente, PDF y comparación por clínico responsable; API negativa por rol/A/B.
5. **Deshacer:** nueva corrección trazable; conservar evolución previa y aplicar custodia aprobada, no destruir ficha.

**Aceptación:** profesional revisa contenido y PDF de la revisión exacta; guardado no pierde campos; política clínica efectiva. **Dependencia:** 00-02, 00-04, 00-08, 00-21, 00-27.

### 00-17 — Odontograma FDI y CPO/ceo — **conservar y corregir · P1**

**Usuario:** odontólogo. **Evidencia:** odontograma interactive/preview, constantes y HCU; existen componentes de odontograma alternativos.

1. **Por qué:** registrar piezas/superficies/estado y representar indicadores verificables.
2. **Esperado:** misma notación FDI adulta/temporal, orientación, simbología y cálculo en editor, persistencia, preview y PDF; editor canónico.
3. **Prohibido:** diagnóstico automático, índices sin regla clínica aprobada, confundir pieza/superficie o pérdida silenciosa al limpiar.
4. **Verificación:** casos sintéticos adulto/niño/mixto, superficies, colores, índices, deshacer, guardado/recarga y revisión clínica de PDF.
5. **Deshacer:** stack local antes de guardar y corrección versionada después; confirmación al limpiar.

**Aceptación:** todas las representaciones concuerdan y se operan por teclado/táctil; no se presume conformidad normativa por un test de strings. **Dependencia:** 00-16, 00-33.

### 00-18 — Periodontograma — **conservar condicionado · P1**

**Usuario:** odontólogo. **Evidencia:** `periodontogram.tsx` contiene mediciones bucales/linguales, sangrado, movilidad y furcación; persistencia depende del consumidor.

1. **Por qué:** conservar mediciones periodontales si se incluyen en la historia aprobada.
2. **Esperado:** rango/unidad y piezas acordados clínicamente, persistencia y representación recuperable; alcance mínimo existente.
3. **Prohibido:** mostrar editor que pierde datos al recargar; interpretar umbral visual como diagnóstico o añadir motor nuevo.
4. **Verificación:** medir, guardar, recargar y exportar caso sintético con valores vacíos/límite; revisión clínica.
5. **Deshacer:** restaurar valores previos con rastro; si no puede aceptarse, diferir módulo completo y no guardar parcialmente.

**Aceptación:** recorrido completo comprobado o desactivado explícitamente antes del piloto. **Dependencia:** 00-16, aprobación clínica de alcance.

### 00-19 — Evoluciones, notas y tratamientos — **corregir · P0**

**Usuario:** odontólogo habilitado. **Evidencia:** `patient-medical-records`, HCU y `patient-files` también escriben notas.

1. **Por qué:** saber qué se realizó, cuándo y por quién.
2. **Esperado:** separar nota administrativa de clínica; autor, fecha, paciente/clínica y correcciones trazables; tratamiento describe atención sin precio.
3. **Prohibido:** autoría falsificada, borrar evolución como reversión, permitir nota clínica a recepción o sobrescribir simultáneamente sin aviso.
4. **Verificación:** crear/corregir/recargar por autores distintos, permisos directos, conflicto de edición y consistencia de historial.
5. **Deshacer:** adenda/corrección con motivo que conserva el original.

**Aceptación:** historial conserva atribución y revisión; todos los puntos de escritura aplican misma regla. **Dependencia:** 00-02, 00-04, 00-05, 00-16.

### 00-20 — Recetas, plantillas y reimpresión — **corregir · P0**

**Usuario:** odontólogo prescriptor. **Evidencia:** hub `/recipes`, `patient-prescriptions.tsx:166` genera con `signature: null`; reimpresión usa firma de `rx.data`.

1. **Por qué:** emitir instrucciones farmacológicas atribuibles al profesional.
2. **Esperado:** medicamento/dosis/frecuencia/duración e indicaciones claras, paciente, médico/licencia, fecha y firma visible; snapshot de emisión para reimpresión.
3. **Prohibido:** plantilla equivale a prescripción aprobada, autocompletar sin revisión, reimpresión cambia autor/datos emitidos, receta aparentemente firmada sin firma.
4. **Verificación:** crear con/sin firma, revisar PDF real, guardar/recargar/reimprimir; rechazo por recepción y A/B; clínico aprueba contenido.
5. **Deshacer:** anular/corregir con rastro y nueva versión; no alterar retrospectivamente el documento entregado.

**Aceptación:** PDF legible coincide con receta persistida y snapshot profesional; faltantes se señalan antes de emisión. **Dependencia:** 00-04, 00-16, 00-21, aprobación clínica/legal del documento.

### 00-21 — Firma y credenciales visibles — **corregir · P0**

**Usuario:** profesional; responsable clínico/legal revisa. **Evidencia:** `signature-pad`, campo `firma_profesional`, generadores PDF y perfil.

1. **Por qué:** hacer visible quién revisó/emite el registro/documento.
2. **Esperado:** captura o imagen asociada al autor autorizado y versión emitida, licencia verificable y estado de revisión explícito.
3. **Prohibido:** dibujar firma ajena, inferir firma jurídica por PNG o SHA-256, permitir a recepción editar licencia/firma, afirmar validez legal sin aprobación.
4. **Verificación:** PDF y registro coinciden, sin firma hay aviso/bloqueo según política aprobada; actor ajeno no modifica; responsable valida licencia y requisito legal.
5. **Deshacer:** revocar imagen para nuevas emisiones y conservar documentos históricos; registrar corrección/anulación.

**Aceptación:** firma visible y atribución técnica probadas; aprobación clínica/legal documentada por separado antes del uso aplicable. **Dependencia:** 00-04, 00-28, responsable externo.

### 00-22 — Adjuntos e imágenes de paciente — **corregir · P0**

**Usuario:** clínico; recepción solo documentos administrativos autorizados. **Evidencia:** `patient-files.tsx` separa Storage y metadata, usa URLs firmadas; avatar/preview también acceden a archivos.

1. **Por qué:** recuperar radiografía, foto o consentimiento del paciente correcto.
2. **Esperado:** tipo/tamaño/nombre validado, ruta por clínica/paciente, Storage privado, metadata coherente y descarga autorizada con expiración.
3. **Prohibido:** URL pública clínica, path ajeno, objeto huérfano sin recuperación, borrar archivo sujeto a custodia o prometer PACS/DICOM.
4. **Verificación:** upload/download real, URL vencida, metadata falla tras upload, Storage falla, nombre malicioso, A/B y roles negativos.
5. **Deshacer:** retirar asociación o versionar según custodia; compensar fallo de carga solo para objeto nuevo confirmado y sin referencia.

**Aceptación:** archivo descargado corresponde al contenido subido y permisos; restore de binarios requerido en 00-35. **Dependencia:** 00-02, 00-04, 00-27.

### 00-23 — WhatsApp manual — **conservar y simplificar · P1**

**Usuario:** recepción/personal que contacta paciente. **Evidencia:** `lib/communication.ts`, listado de pacientes y appointment-list tienen normalización distinta del teléfono.

1. **Por qué:** contactar de forma manual y revisada para coordinación.
2. **Esperado:** misma validación de teléfono/código de país, paciente y destinatario visibles, borrador editable antes de abrir `wa.me`.
3. **Prohibido:** envío desde Clinia+, declarar entregado/leído, sincronizar inbox, incluir diagnóstico o receta por defecto, abrir número vacío/incorrecto.
4. **Verificación:** número Ecuador local/internacional, extranjero/inválido, acentos del borrador, cancelación y apertura manual; red sin llamada a API de envío.
5. **Deshacer:** cancelar antes de abrir; cerrar pestaña no retracta mensaje que el operador haya enviado en WhatsApp.

**Aceptación:** UI explica que se abre WhatsApp y operador revisa/envía allí; no existe evidencia ficticia de entrega. **Dependencia:** 00-08, 00-27, 00-24.

### 00-24 — Bandejas, marketing, automatización y recall — **diferir · P2; retirar promesas/ejecución · P0**

**Usuario:** propietario/personal. **Evidencia:** `/messages` opera tabla de mensajes internos, no WhatsApp; `/marketing`, recall y automation-settings tienen superficies adicionales.

1. **Por qué:** hoy agregan capacidades más amplias que el primer piloto.
2. **Esperado:** retirar entrada/ejecución de campañas, bots y bandeja del flujo de cierre; conservar únicamente correo transaccional de auth/invitación y contacto manual aprobado.
3. **Prohibido:** presentar mensajes internos como inbox WhatsApp; activar envíos por guardar ajustes o consentimiento genérico.
4. **Verificación:** menú y rutas directas no exponen capacidades diferidas; endpoints/jobs/provider sin envíos salientes fuera de auth/invitación aprobada.
5. **Deshacer:** restaurar código desde revisión preservada únicamente bajo nuevo encargo; no eliminar mensajes históricos.

**Aceptación:** ninguna promesa ni ejecución de automatización/contacto masivo; correos necesarios revisados por finalidad/allowlist. **Dependencia:** 00-03, 00-05, 00-27.

### 00-25 — Importación CSV demográfica — **simplificar y corregir · P0**

**Usuario:** propietario u operador autorizado para importación. **Evidencia:** `/patients` parsea CSV/JSON, mapea `account_balance`, hace upsert por lotes e intenta insertar membresía cuando falta contexto.

1. **Por qué:** cargar pacientes existentes sin reescribir a mano.
2. **Esperado:** plantilla CSV explícita demográfica, codificación/delimitador/fechas validados, preview y errores por fila, política de duplicado explícita, lote trazable y confirmación antes de escribir.
3. **Prohibido:** crear membresía/autoridad para arreglar importación; importar finanzas/salud por coincidencias de cabecera; sobreescribir registros existentes sin aprobación; afirmar éxito total cuando hubo fallos.
4. **Verificación:** BOM/acentos/comillas/delimitador/saltos de línea, cédula/pasaporte/fechas, duplicados, lote grande, fallo intermedio y reintento con sintéticos.
5. **Deshacer:** preview no escribe; revertir solo altas del lote verificadas sin uso posterior. Para updates aprobados conservar valores previos y revisar cambios concurrentes; nunca borrar en masa una historia ya atendida.

**Aceptación:** conteos aceptados/rechazados concuerdan, idempotencia sin duplicados y sin elevación de autoridad; CSV primero, importación clínica/JSON general diferida. **Dependencia:** 00-02, 00-04, 00-05, 00-08.

### 00-26 — Exportación demográfica y clínica — **corregir · P0**

**Usuario:** propietario para exportación clínica; otros solo alcance demográfico expresamente autorizado. **Evidencia:** `/patients:322` exporta array cargado (paginado) y saldo, promete auditoría; PrivacyTab exporta metadata paginada de varias tablas, no bytes/snapshot consistente.

1. **Por qué:** entregar datos autorizados y facilitar traslado sin pérdidas silenciosas.
2. **Esperado:** distinguir CSV demográfico, extracto clínico autorizado y paquete de archivos; alcance/filtros/conteo explícitos, auditoría real, transporte seguro y consistencia definida.
3. **Prohibido:** llamar base completa a páginas cargadas; incluir saldo; prometer auditoría/IP sin evento real; declarar portabilidad completa con metadata o acceso de propietario solo en botón.
4. **Verificación:** más de 1.000 registros y row cap menor, concurrencia, fallo de tabla, campos permitidos, CSV seguro frente a fórmulas y adjuntos descargables; permisos API.
5. **Deshacer:** cancelar entrega pendiente y eliminar artefacto temporal bajo política; una descarga ya entregada no se retracta. Registrar entrega/incidente si corresponde.

**Aceptación:** alcance y conteos completos o error inequívoco; solicitudes/entrega trazables; no datos económicos ni URLs públicas clínicas. **Dependencia:** 00-02, 00-04, 00-05, 00-22, 00-27.

### 00-27 — Privacidad, derechos, consentimientos y custodia — **corregir · P0**

**Usuario:** paciente/representante por canal validado; propietario responsable de atender. **Evidencia:** PrivacyTab, intake/HCU, `data_rights_requests`, `clinic_audit_logs`, M7.

1. **Por qué:** administrar datos de salud con finalidad y responsabilidad identificables.
2. **Esperado:** inventario de finalidades/base legal, avisos, responsable/encargado, transferencias, solicitudes pendientes y resolución motivada; consentimiento clínico separado de tratamiento de datos; retención y bloqueos legales por registro.
3. **Prohibido:** plazo universal de custodia supuesto, checkbox equivale a certificación, export equivale a solicitud cumplida, purge por antigüedad o parentesco equivale a representación.
4. **Verificación:** responsable jurídico/privacidad ecuatoriano aprueba textos/proceso; pending → resolución válida produce exactamente un audit; roles ajenos, completed INSERT y reescritura terminal rechazados por API.
5. **Deshacer:** rectificar mediante versión/adenda; suspender procesamiento no requerido; solicitudes/auditoría conservadas, borrado solo bajo decisión legítima documentada.

**Aceptación:** aprobación humana con responsable/fecha/versiones; proceso probado y no claims LOPDP genéricos; auditoría sin PII innecesaria ni writes cliente privilegiados. **Dependencia:** 00-02, 00-04, responsable externo de privacidad.

### 00-28 — Perfil profesional y configuración de clínica — **conservar y corregir · P1**

**Usuario:** profesional modifica su perfil permitido; propietario configura clínica/equipo.

1. **Por qué:** identificar clínica y profesional en atención/documentos.
2. **Esperado:** nombre/contacto/especialidad/licencia según permiso, horario en entrada canónica, logos/avatares seguros; persistencia real y consistencia con documentos emitidos.
3. **Prohibido:** recepción modifica credenciales, perfil cambia autoridad, editar configuración ajena, cambiar retrospectivamente receta emitida o exponer foto clínica pública.
4. **Verificación:** edición/recarga y cambio A/B, imagen fallida, actor no autorizado y snapshot de receta/historia.
5. **Deshacer:** restaurar campos/imagen anteriores para documentos futuros; históricos mantienen snapshot.

**Aceptación:** perfil/clinica/PDF concuerdan donde corresponde; permisos y persistencia probados. **Dependencia:** 00-04, 00-11, 00-22.

### 00-29 — Reportes operativos — **simplificar · P1**

**Usuario:** propietario con alcance agregado aprobado. **Evidencia:** `/reports` consulta pacientes/citas/servicios y calcula `price`/`estimatedDemand`.

1. **Por qué:** conocer citas atendidas/canceladas y carga de agenda.
2. **Esperado:** métricas operativas sin dinero, filtros/periodo/definiciones visibles, totales por consulta completa, sin ranking clínico que decida automáticamente.
3. **Prohibido:** demanda monetaria/ingresos, proyecciones financieras, conclusiones clínicas por estadística o emitir PDF con datos ajenos.
4. **Verificación:** dataset sintético conocido, diferentes filtros/zonas/límites, export PDF y permisos.
5. **Deshacer:** retirar métrica no confiable y volver a lista/agenda; no recalcular ni mutar pacientes.

**Aceptación:** números corresponden al dataset/periodo y no leen/calculan valor económico; reporte no imprescindible puede ocultarse hasta cumplir. **Dependencia:** 00-05, 00-07, 00-14, 00-26.

### 00-30 — Ajustes y notificaciones reales — **simplificar y corregir · P1**

**Usuario:** cada usuario para preferencias; propietario para ajustes compartidos. **Evidencia:** `notification-bell.tsx:10` inicia contador 3; sidebar tiene arrays ficticios; settings ofrece notificaciones/seguridad/idiomas/zonas.

1. **Por qué:** preferencias comprensibles y avisos de eventos reales.
2. **Esperado:** español/Guayaquil como configuración del piloto; guardar persiste y se refleja tras recarga; notificaciones vacías si no hay eventos autorizados.
3. **Prohibido:** contador/inbox de ejemplo en producción, toggle de seguridad sin efecto real, ajuste que activa envío o inglés parcial como promesa de soporte.
4. **Verificación:** clínica vacía, evento conocido, leído/no leído, recarga/cambio de actor, guardar y fallo de servidor; revisar autoridad de cada toggle.
5. **Deshacer:** restaurar preferencias previas; retirar control sin backend, conservando ajustes almacenados fuera de flujo activo.

**Aceptación:** no hay datos ficticios ni éxito simulado; controles no soportados desactivados/retirados y sin automatización. **Dependencia:** 00-04, 00-24, 00-28.

### 00-31 — Onboarding y simplicidad diaria — **simplificar · P1**

**Usuario:** propietario/recepción/odontólogo nuevo. **Evidencia:** dashboard infiere historia creada por `patients.length > 0`; componentes legacy dashboard conservan rutas/menús más amplios.

1. **Por qué:** ayudar a configurar y completar la primera jornada.
2. **Esperado:** checklist de tareas verificables (perfil/horario/servicio/paciente/cita), una entrada por función y guía mínima en español por rol.
3. **Prohibido:** alta demográfica equivale a historia clínica completa; pasos de cobro/campañas; duplicación de paneles o acciones decorativas sin resultado.
4. **Verificación:** nuevo usuario ejecuta paciente → cita → atención → receta/documento; medir errores, ayudas y tiempo observado con responsable.
5. **Deshacer:** retirar paso engañoso y simplificar entrada sin borrar progreso clínico.

**Aceptación:** tarea completada desde estado vacío por usuarios de los tres roles; objetivo de tiempo y tolerancia de errores acordados antes de UAT, no inventados como resultado. **Dependencia:** 00-06 a 00-23 según recorrido, 00-33.

### 00-32 — Sitio público, demo y afirmaciones comerciales — **corregir · P1**

**Usuario:** visitante y propietario potencial. **Evidencia:** landing, pricing/feature cards, `/schedule-demo`, documentos/manual.

1. **Por qué:** explicar servicio y solicitar demostración.
2. **Esperado:** describir únicamente alcance disponible o claramente futuro; solicitud de demo con datos mínimos, destinatario y política de privacidad.
3. **Prohibido:** prometer cobros, reserva clínica pública, integración WhatsApp/inbox, portabilidad completa, certificación, respaldo/restauración o UAT no probados.
4. **Verificación:** revisar textos/links/formularios y un envío de demo autorizado; cotejar cada claim con inventario y evidencia.
5. **Deshacer:** corregir publicación/claim y cancelar formulario temporalmente si entrega falla; conservar solicitud legítima bajo finalidad aprobada.

**Aceptación:** todos los claims activos concuerdan con alcance y estado; demo no crea cita de paciente ni ejecuta cobro. **Dependencia:** 00-01, 00-05, 00-24, 00-27, 00-36.

### 00-33 — Errores, accesibilidad y dispositivos — **corregir · P1**

**Usuario:** recepción/odontólogo/propietario en escritorio, tableta y móvil. **Evidencia:** formularios, master-detail, SVG, global error/loading; tests de strings previos no demuestran interacción.

1. **Por qué:** realizar tareas sin pérdida de información ni bloqueos evitables.
2. **Esperado:** loading/empty/error reales, focus/teclado, contraste, labels, confirmación de cambios pendientes y formularios legibles sin tapar paciente/alertas.
3. **Prohibido:** toast éxito tras fallo, doble submit, datos de paciente en logs/error, controles inaccesibles o scroll que oculta identidad durante atención.
4. **Verificación:** recorridos críticos con teclado, lector donde corresponda, tres viewports, error red/permisos/storage y refresh; baseline WCAG vigente acordado para el piloto.
5. **Deshacer:** restaurar layout/interacción anterior comprobado; recuperar borrador autorizado sin almacenar datos clínicos en medio inseguro.

**Aceptación:** tareas críticas completables y errores recuperables sin pérdida/filtración; evidencia visual/interactiva, no solo CSS presente. **Dependencia:** módulos activos de 00-06 a 00-30.

### 00-34 — Arquitectura y documentos canónicos — **corregir · P1**

**Usuario:** mantenedor/operador. **Evidencia:** `Architecture_map.md` afirma PostgreSQL 15 y portabilidad JSON amplia, contiene índices y enlaces que pueden divergir; manual/reportes de preparación previos.

1. **Por qué:** localizar responsabilidad, datos y pruebas sin ejecutar procedimientos equivocados.
2. **Esperado:** mapa basado en versión/objeto/consulta verificados, entrada canónica, roles, límites y fuente de evidencia; distinguir export metadata de binarios.
3. **Prohibido:** tratar mapa/manual como evidencia desplegada, copiar versión de stack no confirmada o registrar credenciales/pacientes.
4. **Verificación:** contrastar rutas/componentes/tablas/RPC/Storage con checkout y manifiesto remoto identificado; cada link local existente.
5. **Deshacer:** versionar corrección preservando historial; retirar instrucciones operativas obsoletas del camino activo.

**Aceptación:** documentación activa no contradice alcance/roles/ambiente; versión PostgreSQL no se afirma sin consulta actual. Actualización del mapa queda para el encargo correspondiente. **Dependencia:** 00-02 y decisiones funcionales consolidadas.

### 00-35 — Respaldo, restauración y operación segura — **corregir · P0**

**Usuario:** operador autorizado y propietario. **Evidencia:** RUNBOOK, runner y JSON DR; runner evalúa inputs en memoria.

1. **Por qué:** continuar atención y recuperar datos ante fallo.
2. **Esperado:** backup de DB y bytes Storage con permisos/configuración, restore en destino aislado, integridad/descarga observadas, tiempos medidos; responsables, alertas e incidentes definidos.
3. **Prohibido:** hash/cálculo de tiempos equivale a restore, DB backup incluye archivos, probar recuperación contra producción o declarar MFA/hook sin verificación.
4. **Verificación:** restaurar backup conocido en ambiente desechable y comparar manifiestos/contenidos; logs originales, inicio/fin medidos, prueba login/permisos/descarga y controles de secretos/Auth.
5. **Deshacer:** detener restore inseguro y conservar origen; retirar destino sintético solo tras verificar ruta/ambiente y preservar evidencia; activar contingencia clínica definida.

**Aceptación:** DB y Storage recuperados con permisos correctos y RTO/RPO acordados medidos; operador/fecha/resultado verificables, incidentes y retención aprobados. **Dependencia:** 00-02, 00-22, 00-27; acceso operativo externo.

### 00-36 — Aceptación y liberación — **conservar gate explícito · P0**

**Usuario:** responsable de liberación, clínico, propietario y privacidad.

1. **Por qué:** autorizar una revisión concreta y un alcance concreto con riesgos conocidos.
2. **Esperado:** P0/P1 aplicables resueltos o función retirada; CI de revisión exacta, staging real, UAT humana, privacidad, DR y plan de canary/rollback aprobados.
3. **Prohibido:** declarar listo por conteo de tests, suite estática, aprobación de un documento generado o extrapolar staging a producción.
4. **Verificación:** checklist con IDs, evidencia y firmas humanas independientes; confirmar configuración/artefacto de producción antes de paso autorizado.
5. **Deshacer:** detener canary, volver a revisión/configuración aprobada y preservar escrituras clínicas con reconciliación; rollback de código no elimina automáticamente datos nuevos.

**Aceptación:** decisión escrita del responsable con revisión/ambiente/fecha/alcance; ninguna migración/despliegue por este inventario. **Dependencia:** 00-01 a 00-35 para superficies activas; P2 cerrados como diferidos sin exposición.

## 6. Orden obligatorio y salida por etapa

1. **Verdad y límite:** 00-01, identificación de 00-02, 00-05 y retiro de ejecución/promesas de 00-24. Salida: estado NO APTO explícito, alcance económico cero y evidencia separada por ambiente.
2. **Autoridad y custodia:** completar 00-02/00-04, 00-03 y 00-27; revisar permisos de 00-22. Salida: roles y aislamiento probados en staging; proceso de privacidad aprobado. No usar información clínica real si falta esta salida.
3. **Operación mínima:** 00-08/00-09/00-10, 00-15/00-11/00-12, 00-13/00-14, 00-06/00-07. Salida: intake y agenda operables sin finanzas ni carreras conocidas.
4. **Atención y documentos:** 00-28/00-21, 00-16/00-17/00-18/00-19/00-20/00-22. Salida: clínico valida historia, firma visible, recetas y adjuntos recuperables. 00-18 se acepta o se retira.
5. **Traslado y contacto:** 00-25/00-26/00-23, 00-29/00-30. Salida: demografía CSV revisable, exports honestos y contacto manual claro.
6. **Revisión final del producto:** 00-31/00-33/00-34/00-32. Salida: recorridos por rol, UI y documentación coherentes. Resolver en estas etapas cualquier dependencia anterior aún abierta.
7. **Recuperación y decisión:** 00-35/00-36. Salida: evidencias reales, responsables y decisión explícita. Solo después puede proponerse lanzamiento/migración bajo autorización correspondiente.

En cada etapa: seleccionar ID, escribir aceptación antes de editar, realizar el cambio mínimo coherente, observar caminos permitidos/denegados, registrar archivos/comandos/resultados/riesgos y revisar si hay una solución más simple que conserve trabajo válido. No declarar gate cerrado si una dependencia o verificación material sigue pendiente.

## 7. Resultado de ENCARGO 00 y reversión documental

**Completado:** inventario de 36 IDs, mapa de rutas/superficies, decisiones de alcance, comparación oficial y banner de evidencia en reporte histórico. **No completado por este encargo:** correcciones funcionales, aprobación de privacidad/clínica, pruebas remotas/UAT/DR, certificación o preparación de producción. Todos los IDs funcionales siguen pendientes de sus aceptaciones.

Cambios limitados a este archivo y un prefijo en `PRODUCTION_READINESS.md`; el cuerpo del reporte se conserva. Reversión: retirar únicamente el prefijo delimitado `ENCARGO00_EVIDENCE_STATUS` y revertir este nuevo archivo si se abandona el inventario. No utilizar `git reset/clean` porque el checkout contiene modificaciones previas de otras tareas. Sin cambios a migraciones, aplicación, base remota, configuración o datos.
