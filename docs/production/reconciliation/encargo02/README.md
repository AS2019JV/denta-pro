# Encargo 02 — propuesta de autoridad y contratos locales

**APLICADO SOLO LOCAL / ACEPTACIÓN PARCIAL / NO DESPLEGABLE.** Encargo01 sigue parcial. Esta carpeta no es respaldo ni aprobación clínica. M7 sigue NOT READY. Nunca ejecutar por MCP remoto, db push o sobre staging ocupado. [Instalación local](../../evidence/2026-09-27/primary-install/execution.json): baseline/M7/owners/buckets/forward/verify aprobados. [Matriz real](../../evidence/2026-09-27/auth-matrix/execution.json):24/25 iniciales; [corrección](../../evidence/2026-09-27/auth-profile-state/execution.json): enum invited/suspended y perfil archivado deniegan con JWT previo. No se sobrescribió el intento fallido.

El plan de16 casos en acceptance-cases.json se conserva como plan, no resultado. Faltan cobertura extendida/derechos/contención/carreras, consumidores/browser y paridad remota. Alta de servicios permanece cerrada hasta contrato04 sin price; UPDATE conserva el precio histórico. Forward no idempotente: exige cuerpos M7 anteriores y los sustituye; una segunda ejecución debe fallar. Correcciones aplicadas antes de instalar: firma purge(uuid), orden HCU, triggers HCU/auditoría canónicos, síntesis preserva campos ausentes, allowlist de firmas y grants positivos exactos.

## Cinco preguntas, fijadas antes de implementar

1. **¿Por qué existe?** Para que una membresía activa determine acceso por clínica y recepción pueda trabajar con demografía y agenda sin obtener historia, notas clínicas ni finanzas.
2. **¿Qué hace exactamente?** Cierra grants y RPC históricos; comprueba perfil y membresía vivos; ofrece contratos JSON explícitos; conserva referencias compuestas M7, autoría e historial; protege Storage y bloquea finanzas en el servidor.
3. **¿Qué está prohibido?** Datos reales, SQL remoto, restaurar grants vulnerables, JWT fabricados como evidencia de Auth, depender de `user_metadata`, elevar por `profiles.clinic_id`/propietario sin membresía, borrar históricos, poner saldos existentes a cero, reserva pública y WhatsApp automático.
4. **¿Cómo se verifica?** Primero revisión offline de contratos y catálogos exactos; después instalación limpia y upgrade convergentes en01, fixtures sintéticos y JWT emitidos por Auth, PostgREST/RPC/Storage con positivos y negativos, y consumidores/browser. Un check estático no acepta02.
5. **¿Cómo se deshace?** Antes de commit, ROLLBACK. Después, `containment.sql` revoca todo acceso cliente de este alcance sin borrar filas, funciones, objetos o bytes; la reapertura exige otro forward revisado. No se reactivan permisos históricos para restaurar funcionamiento.

## Criterios de aceptación, fijados antes de implementar

- Identidad Docker y puertos loopback verificados por el ejecutor, no solamente una variable SQL. PostgreSQL17, Auth/Storage reales. Sesión SQL `app.scoped_fixture_authorized=local-synthetic` y `app.encargo02_authorized=reviewed-local-forward`; ambos son intención, no prueba de destino.
-01 aceptado para el alcance declarado: baseline representativa y upgrade pre-M7 + M7 o stage-M7 comprobados. Las capturas no son un dump ni prueban restore remoto.
- M7 compuesto/familia/clínico/derechos/auditoría sigue vigente y validado. Ninguna migración intenta corregir inconsistencias borrándolas.
- owner/doctor/receptionist/removed/anonymous y dos clínicas: cada permiso positivo persiste y cada prohibición devuelve error/ninguna fila sin alterar datos. Revocación, democión, perfil suspendido y metadata editable probados con JWT previo intacto.
- Recepción no lee `patients`/`appointments` base, tablas clínicas ni notas; sus RPC proyectan demografía y agenda. Doctor/owner tampoco reciben finanzas por tabla, vista o RPC. Datos financieros históricos quedan intactos.
- Referencias paciente/familia/doctor/autor/archivo entre clínicas rechazadas. Autoría y partición inmutables. Storage lista/sube/lee/firma/reemplaza bytes sintéticos según matriz; rutas inválidas y roles retirados denegados.
-0 resultados y offset vacío tienen conteo correcto; agenda con más de25 pacientes/citas usa join, sin N+1 ni truncado silencioso; rango máximo93 días. Entrada desconocida, tipos inválidos y `data_consent` inexistente fallan honestamente.
- Consumidores autorizados adaptados por04/root: ningún wildcard ni campo financiero; recepción usa mutaciones RPC y no nota de agenda. El control de concurrencia/doblebooking queda para05; este documento no lo declara resuelto.
- Ejecutar contención en destino descartable y verificar que conserva filas/bytes; guardar comandos, códigos y salida sanitizada. Browser/acciones Auth SSR y firma/habilitación profesional siguen gates distintos.

## Fuentes exactas y decisiones

- `../../evidence/2026-09-27/catalog-{prod,stage}-scoped.metadata.json` y sus dependencies: captura prod03:12:04.196217Z, stage03:11:44.553099Z; PostgreSQL17.6 observado. No recaptura de filas.
- `supabase/migrations/20260922194927_enforce_clinical_tenant_links_and_rights_audit.sql`: preservar M7. El forward exige sus constraints/triggers; no vuelve a añadirlos sobre stage-M7.
- Variante producción pre-M7: aplicar M7 exactamente una vez antes de este forward. Variante stage-M7: usarlo directamente tras reconciliación. No elegir variante por `current_database()`.
- `clinic_members(user_id,clinic_id)` UNIQUE existe; `role,status` son text nullable. `profiles.status` es `user_status`, `deleted_at` existe. Ninguna autoridad usa clínica primaria ni JWT de rol/clínica. Owner sigue alcance clínico fijado, pero **propiedad no acredita habilitación profesional**; resolver09 sin cambiar roles silenciosamente.
- `patients.data_consent` no existe en ninguna captura: no se añade ni se inventa una base legal. El RPC rechaza la clave; modelo de consentimiento pendiente07/13.
- No borrado físico cliente de pacientes, historia ni bytes clínicos. `deleted_at` clínico se mantiene como archivo por clínicos/owner donde corresponde; revisión de custodia/retención no se simula con una edad fija.
- `services.price`, `patients.account_balance`, `insurance_provider`, `policy_number`, tablas/vistas/RPC financieros quedan sin grants cliente. Columnas/grants antiguos se revocan antes de conceder la lista explícita; nunca modificar sus valores para ocultarlos.

## Contratos públicos acordados

Todos comprueban identidad no anónima, `profiles.status='active'`, `profiles.deleted_at IS NULL`, `clinic_members.status='active'` y rol permitido en la clínica solicitada. Funciones definer justificadas por proyección estrecha; `search_path=''`, nombres cualificados, EXECUTE solo authenticated. Los helpers privados no están expuestos.

| Firma | Retorno y alcance |
| --- | --- |
| `get_patient_demographics(p_clinic_id uuid,p_search text='',p_limit integer=25,p_offset integer=0,p_patient_id uuid=NULL)` | JSON `{items,total_count}`, mismo snapshot, orden created_at DESC/id DESC, límite1..100, offset>=0, search<=200. |
| `save_patient_demographics(p_clinic_id uuid,p_data jsonb,p_patient_id uuid=NULL)` | JSON objeto demográfico proyectado; null ID crea, otro ID actualiza paciente de esa clínica; claves desconocidas rechazadas, ausencia conserva y JSONnull limpia solo campos nullable. |
| `get_clinic_staff_directory(p_clinic_id uuid)` | JSON array `id,full_name,specialization,avatar_url,role,title`, JOIN perfil/membresía vivos. No licencia/contacto personal de compañeros para recepción. |
| `get_clinic_schedule(p_clinic_id uuid,p_start timestamptz,p_end timestamptz)` | JSON `{items,total_count}`. Overlap `start_time<p_end AND end_time>p_start`, rango(0,93d], sin truncado. Campos operacional + nested `patients/profiles`; notas solo clínicos. |
| `save_clinic_appointment(p_clinic_id uuid,p_data jsonb,p_appointment_id uuid=NULL)` | JSON proyección de agenda. Campos paciente, clínico, inicio/fin, tipo/estado; `notes` solo doctor/owner. Valida intervalo y referencia clínica. Concurrencia05 pendiente. |
| `get_patients_with_stats(uuid,text,integer,integer,text,text,boolean,uuid)` | Se reemplaza por JSON clínico `{items,total_count}`; mismos nombres de parámetros, sin cálculos/lecturas billings, solo owner/doctor. Retorno cambia:04 debe adaptar consumidores. |
| `remove_clinic_member(p_target_user_id uuid,p_clinic_id uuid)` | Owner vivo retira membresía de un miembro no owner en esa clínica; no elimina Auth ni cambia perfil/clínica primaria/historia. |

Demografía proyectada: `id,clinic_id,first_name,last_name,cedula,email,phone,address,city,state,birth_date,gender,status,occupation,guardian_name,medical_record_number,emergency_contact,emergency_phone,marital_status,preferred_contact_method,avatar_url,family_representative_id,family_relationship,is_family_head,created_at,updated_at`.

Mutación demográfica excluye IDs, fechas de auditoría, avatar/familia (hasta su workflow separado), toda historia, `tags` y texto libre de referencias, saldo/seguro/consentimiento. Estados paciente: active/inactive; contacto phone/email/whatsapp solo preferencia, nunca envío. `avatar_url` existente puede leerse como path pero no se acepta URL arbitraria por esta mutación.

Storage clínico: una vez registrado `patient_files.file_path`, no se reemplazan ni borran esos bytes por cliente; subir otra versión con otro path. Avatares propios permiten upsert con INSERT/SELECT/UPDATE; doctor avatars usa `<user_id>/<filename>`, lectura entre compañeros solo si comparten clínica viva. Branding usa `<clinic_id>/<filename>`, bucket privado y escritura owner. Esto requiere adaptar el uso actual de URL pública/path legacy en UI; no se promete compatibilidad de esos consumidores antes de su gate.

## Matriz mínima

| Recurso | Owner | Doctor | Recepción | Retirado/anónimo |
| --- | --- | --- | --- | --- |
| Demografía RPC propia clínica | Leer/crear/editar | Leer/crear/editar | Leer/crear/editar whitelist | Denegar |
| Agenda RPC propia clínica | Leer/crear/editar | Leer/crear/editar | Operacional sin notas | Denegar |
| Patients/appointments base | Clínico, sin finanzas | Clínico, sin finanzas | Denegar | Denegar |
| Historia/HCU/recetas/notas/archivos | Clínico | Clínico; edición propia autoría | Denegar | Denegar |
| Perfil propio | Leer/editar datos personales, no autoridad | Igual | Igual | Solo perfil propio no clínico, sin edición si inactivo |
| Directorio de personal | Proyección | Proyección | Proyección | Denegar |
| Branding | Escribir propia clínica | Lectura | Lectura | Denegar escritura |
| Patient avatars | Demografía propia clínica | Igual | Igual | Denegar |
| Finanzas y marketing automático | Sin grants cliente | Sin grants | Sin grants | Sin grants |

## Ejecución y limitaciones

`forward.sql` exige M7 completo y entorno sintetico marcado; es propuesta fuera de legacy migrations. No crea usuarios ni aplica SQL. `verify.sql` inspecciona catálogo y privilegios, sin elevarlo a prueba JWT. `containment.sql` corta acceso conservando historial. `acceptance-cases.json` es plan de casos reales; no resultado ejecutado. `test/production/encargo02-contract.test.cjs` valida offline campos contra ambas capturas y controles estructurales; no prueba PL/pgSQL, transacciones, RLS o provider.

Fuentes oficiales consultadas: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [column grants](https://supabase.com/docs/guides/database/postgres/column-level-security), [Storage](https://supabase.com/docs/guides/storage/security/access-control), [sesiones](https://supabase.com/docs/guides/auth/sessions). Revocar membresía bloquea nuevas operaciones aunque el JWT no expire; una URL firmada previamente emitida puede seguir válida hasta su TTL. No se declara revocación de bytes descargados o enlaces ya emitidos.
