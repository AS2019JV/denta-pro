# ENCARGO 01 — Reconciliación de staging

**Estado: PARCIAL. Reconstrucción scoped y pruebas sobre Supabase local real entregadas; staging remoto todavía no es representativo ni autoriza datos clínicos reales.** Revisión: 27-09-2026, checkout base `f96fbb898ec2a0615dec293ee3e5ce0a9b41b170` con cambios previos conservados. Este encargo desarrolla [00-02](00_INVENTARIO_DE_CIERRE.md); [M7](../security/M7_PRODUCTION_ACCEPTANCE_2026-09-22.md) sigue controlando la aceptación. El único cambio remoto continúa siendo el parche de vista descrito abajo, exclusivamente en staging. No hubo cambios de producción, reset remoto, copia de datos clínicos ni envíos.

**Actualización del 27-09:** el fallo inicial por dependencias Auth ausentes se resolvió usando siete servicios Supabase reales, aislados y publicados únicamente en `127.0.0.1`; [operación local](../../tools/local-supabase/README.md). Se reconstruyeron los catálogos scoped stage/prod en bases separadas y se comprobó M7 preservando dos pacientes sintéticos. El fallo de seed ejecutado con rol incorrecto permanece en el log original; la continuación correcta con postgres está registrada en `evidence/2026-09-27/local-runtime-continued/upgrade-seed-owner.log` y `upgrade-m7.log`. No equivale a un dump completo ni a convergencia canónica.

La [base primaria local](evidence/2026-09-27/primary-install/execution.json) instaló baseline, M7, tres propietarios de callbacks, forward02 y verificación en transacciones. [Auth/RPC/PostgREST/Storage](evidence/2026-09-27/auth-matrix/execution.json):24/25 casos iniciales; el restante falló por usar un enum inexistente en el fixture. La [comprobación corregida](evidence/2026-09-27/auth-profile-state/execution.json) pasó invited, suspended y deleted_at conservando el JWT previo. [Derechos y auditoría](evidence/2026-09-27/auth-rights-continued/execution.json) corrigen dos supuestos del test anterior sin ocultar esos fallos. Toda la evidencia procede de datos sintéticos locales; pruebas completas, navegador, paridad remota y recuperación siguen siendo gates separados.

## 1. Cinco preguntas

1. **¿Por qué existe?** Para ensayar las rutas permitidas y sus límites de autorización en un ambiente sintético reproducible, antes de utilizar pacientes reales.
2. **¿Qué debe hacer exactamente?** Identificar y reconciliar contratos de tablas, constraints, vistas, funciones por firma, triggers, RLS, grants, Storage e historial; conservar M7; comprobar clean install y upgrade con JWT/API/navegador reales.
3. **¿Qué está prohibido?** Copiar datos reales, ampliar acceso mediante políticas débiles de producción, activar finanzas/campañas/WhatsApp automático, resetear staging, aplicar a producción o llamar backup a un JSON de metadatos.
4. **¿Cómo se verifica?** Comparación local determinista más catálogos posteriores; después pruebas positivas/negativas de dos clínicas y roles reales sobre PostgREST, RPC, Storage y navegador. Son niveles de evidencia diferentes.
5. **¿Cómo se deshace de forma segura?** Antes del commit, rollback de la transacción. Después, detener el acceso afectado con el SQL de contención, conservar datos/evidencia y reparar con revisión. El ensayo de recuperación completa necesita un backup restaurable y un destino aislado.

## 2. Fuente y límites

| Ambiente | Identidad | Catálogo observado |
| --- | --- | --- |
| Producción | Auto-SNet `leqsrfyjvuxxdsubjjin` | PostgreSQL 17.6, 24 tablas public, 300 columnas incluyendo vistas, 28 funciones public, 72 políticas public/22 Storage, 10 buckets, 57 migraciones |
| Staging | cliniaplus-staging `phihonofwyerpfgqfekt` | PostgreSQL 17.6, 24 tablas public, 285 columnas incluyendo vistas, 7 funciones public, 11 políticas public/2 Storage, 0 buckets, 11 migraciones |

Archivos en [evidence/2026-09-25](evidence/2026-09-25/): `catalog-prod.json`, `catalog-stage.json`, `migrations-prod.json`, `migrations-stage.json`, `staging-row-counts.json`. Ventana de captura **aproximada**: 26-09-2026 03:17–03:20 UTC / 25-09 Ecuador. Los campos `capturedAt` originales son estimaciones, no mediciones exactas. Solo metadatos y conteos agregados; no filas de pacientes ni credenciales. En esa captura staging tenía cero filas en las 24 tablas public, `auth.users` y `storage.objects`. El coordinador reconfirmó el resumen de staging el 26-09 a las 14:57:36 UTC; esa comprobación no reemplaza una recaptura completa previa a aplicar.

**Los catálogos no son dumps ni backups.** No contienen todos los objetos/propietarios/default privileges/configuraciones del proyecto ni bytes Storage. No prueban restauración, clean install, capacidad de conexión con PostgreSQL ni permisos efectivos de un JWT. `customSchema.relations` vuelve a incluir relaciones public: no sumar sus diferencias al total de objetos únicos.

## 3. Comparación reproducible

Herramienta offline: [compare-supabase-catalogs.cjs](../../scripts/compare-supabase-catalogs.cjs). No conecta a Supabase ni ejecuta SQL. Indexa por identidad (incluye firma para overloads), detecta duplicados/secciones ausentes, compara contenido y orden significativo. Normaliza CRLF y orden de ACL/configuración; conserva whitespace de literales SQL y orden de enums. Una diferencia intencional solo se acepta con identidad, razón y **dos hashes exactos**. Si cambia un lado o desaparece, se informa expectativa obsoleta y la diferencia deja de estar aceptada. El SHA-256 identifica contenido; no certifica seguridad ni aprobación.

```powershell
node test/production/catalog-comparison.test.cjs
node scripts/compare-supabase-catalogs.cjs docs/production/evidence/2026-09-25/catalog-prod.json docs/production/evidence/2026-09-25/catalog-stage.json docs/production/evidence/2026-09-25/catalog-expected-differences.json docs/production/evidence/2026-09-25/catalog-comparison.json
exit $LASTEXITCODE
```

Salidas CLI: `0` sin diferencias abiertas; `2` diferencias abiertas; `3` expectativas obsoletas; `1` error de entrada. En este estado **se espera 2**, no un check verde. PowerShell sin `exit $LASTEXITCODE` puede reportar `1` en el wrapper aunque Node haya definido `2`; la línea final conserva la salida nativa. Ejecutar el archivo de pruebas directamente evita el subprocess del runner de Node, que falló con `spawn EPERM` en el sandbox; las pruebas usan `node:test` y `node:assert` y se ejecutaron efectivamente, con **8/8 aprobadas, exit 0**.

| Resultado sobre las capturas | Cantidad | Interpretación |
| --- | --- | --- |
| Comparaciones de identidad distintas | 437 | Incluye metadatos de grant y relaciones repetidas en customSchema; no 437 objetos únicos ni 437 vulnerabilidades |
| Diferencias esperadas con motivo/hash | 60 | M7 e índices de tenant preservados; tampoco prueban comportamiento remoto |
| Diferencias abiertas | 377 | Requieren decisión por contrato/alcance, no copiar automáticamente producción |
| Cambios de columnas base | 7 | Seis `clinic_id` pasan YES→NO en is_nullable; staging agrega `resolution_notes` |
| Cambios de columnas de vistas | 24 | Ausencias/cambios de shape, no quince columnas base faltantes |
| Expectativas obsoletas | 0 | Coinciden con estas capturas concretas |

Evidencia detallada: [catalog-comparison.json](evidence/2026-09-25/catalog-comparison.json) con ambos lados exactos y hashes; [catalog-expected-differences.json](evidence/2026-09-25/catalog-expected-differences.json) con las decisiones conservadoras. `catalog-diff-unclassified.json` conserva la primera comparación sin clasificar. No se ignoran todas las diferencias de RLS/grants por categoría.

## 4. Contratos y decisiones

| Superficie | Diferencia exacta / decisión |
| --- | --- |
| Columnas base | Seis NOT NULL en `patients`, `appointments`, `prescriptions`, `hcu033_forms`, `billings`, `invoices`; `data_rights_requests.resolution_notes` solo en staging. Cambios M7 esperados; preservar. |
| Integridad | FKs compuestas `(patient_id,clinic_id)` sustituyen FKs simples y familia exige clínica coincidente; `patients(id,clinic_id)` es UNIQUE. Preservar M7 y sus triggers de clínico habilitado. Finanzas históricas permanecen fuera del flujo. |
| Constraints faltantes | Staging carece de checks de estados/tipos en citas, invitaciones, derechos y notificaciones; faltan unicidades como token de invitación, miembro usuario/clínica, cédula/clínica y categoría/nombre. Revisar antes de funciones con `ON CONFLICT`; faltantes de finanzas no justifican reactivarla. Hay FKs con acciones ON DELETE diferentes aún sin reconciliar. |
| Vistas | Faltan `dashboard_stats_view`, `patient_stats_view`, `recall_queue`; las dos primeras consultan finanzas y recall contiene alertas médicas. No recrearlas automáticamente en este alcance. La vista de recepción tiene `id/cedula/created_at` en staging frente a `patient_id/last_visit_date` y filtro clínico en producción. Definir un único contrato demográfico en el encargo funcional; conservar columnas actuales durante hardening. |
| Riesgo concreto de vista | `receptionist_patient_view` de staging tiene `options=null`, consulta `patients` sin filtro y grants amplios para anon/authenticated. Una vista del propietario puede eludir RLS. Preparar `security_invoker=true`, quitar anon/PUBLIC y escrituras de authenticated. No conceder políticas adicionales para hacer pasar el ensayo. |
| Funciones | Faltan 22 firmas public de producción; 6 existentes difieren y `guard_data_rights_request_insert()` es solo staging. Ausentes requeridas: perfil/listado/familia, invitaciones/registro, hook y guardas de perfiles. El JSON conserva cada firma y cuerpo exactos. `get_checkout_payment_methods`/`update_billing_status` se mantienen fuera del flujo; no importarlas por paridad. |
| Auditoría incompatible | `logs.log_patient_view(uuid)` de producción inserta `user_id`, `operation`, `old_data`, `new_data`, `created_at`; la tabla real capturada tiene `actor_id`, `action`, `metadata`, `timestamp` (más id/rol/record/clínica). Copiar ese cuerpo fallaría al invocarlo; `get_patient_profile_secure` depende de él. Diseñar y probar adaptación, con autorización de paciente/clínica y sin INSERT directo del cliente en auditoría. |
| Políticas/grants | Producción 72/22 frente a staging 11/2 no significa que producción sea segura. Derechos M7 mantiene evidencias inmutables y resolución de propietario. Faltan políticas necesarias de entidades; otras existentes permiten propietario clínico sin habilitación explícita y UPDATE de notas/archivos no tiene WITH CHECK explícito. Resolver matriz de autoridad, membresía activa y revocación con JWT real. |
| Storage | Diez buckets de producción, ninguno staging. `patient-files`/`patient-avatars` son privados. No crear receipts/Whats-Storage/wstorag ni habilitar DICOM por este encargo. Definir identidad gráfica/avatar/firma con mínimo acceso; revisar rutas paciente/clínica y límites MIME/tamaño. Metadatos y bytes requieren ensayos separados. |
| Auth y triggers | Faltan creación/verificación de usuario y otras guardas de perfil. Una función hook SQL no prueba que Auth la use. Confirmación, SMTP, redirecciones, expiración, MFA/protección de contraseñas y activación del hook son configuración del proyecto no cubierta por estos catálogos ni por el conector actual. |
| Extensiones / Realtime | `pg_cron` solo en producción; no crear un scheduler para el piloto. Ambas capturas no enumeran publicaciones de tablas. No se deduce configuración Realtime/Auth de ese dato. |

La autoridad de UI identificada en la captura histórica se corrigió localmente: perfil/membresía activos y rol RPC por clínica, sin fallbacks de metadata. La integración completa y la evidencia de navegador se registran por separado; ese cambio no demuestra autorización de todos los consumidores.

## 5. Propuesta acotada lista para revisión

Archivo exacto revisado: [encargo01_staging_view_boundary.proposal.sql](reconciliation/encargo01_staging_view_boundary.proposal.sql). **Aplicado solo a staging mediante apply_migration**, versión remota `20260926155227`, nombre `enforce_staging_demographic_view_boundary`. Evidencia antes/después: [staging-view-boundary.json](evidence/2026-09-26/staging-view-boundary.json). El archivo SQL se conserva fuera de la carpeta legacy; no es una baseline local reconciliada. La ayuda `supabase migration new --help` se consultó en CLI 2.117.0; la creación local posterior no se completó tras interrupción/aprobación pendiente. Al integrar la futura baseline, generar archivos mediante CLI y reconciliar expresamente este historial remoto; no inventar nombres ni repetir el parche por un db push ciego.

Cambios completos: transacción; timeout de lock 5 s/statement 30 s; comprobar que existe la vista; `ALTER VIEW ... SET (security_invoker=true)`; revocar todos los privilegios de PUBLIC/anon; revocar escrituras y privilegios accesorios de authenticated, incluido MAINTAIN de PostgreSQL17. No recrea la vista, no cambia columnas, no agrega políticas/grants, no toca M7 ni filas de aplicación. SELECT de authenticated ya existe y queda sujeto a RLS de patients, actualmente sin políticas en staging: se espera acceso vacío/denegado hasta reconciliar autoridad, no se promete éxito funcional.

Comprobación real de metadatos a las **15:52:36.379764 UTC del 26-09-2026**: definición de vista intacta; security_invoker=true; anon sin privilegios de tabla ni columna; authenticated solo SELECT, con MAINTAIN=false; patients RLS=true y cero políticas. El historial pasa de 11 a 12 migraciones. La consulta verifica privilegios efectivos mediante has_table_privilege; no usa acceso elevado como prueba de JWT/RLS o de flujo clínico. La corrección MAINTAIN se verificó contra [PostgreSQL17](https://www.postgresql.org/docs/17/functions-info.html).

Procedimiento utilizado por el coordinador tras revisar el SQL exacto (futuras ejecuciones requieren preflight nuevo):

1. Confirmar por metadatos el proyecto staging `phihonofwyerpfgqfekt`; ejecutar [verify.sql](reconciliation/encargo01_staging_view_boundary.verify.sql) antes y guardar salida/version/actor/fecha reales.
2. Confirmar vista/ACL/definición aún coincidentes y patients con RLS activo. La comprobación de existencia dentro del SQL **no identifica el ambiente**: ambos proyectos llaman postgres a su base. El executor debe fijar `project_id` explícito; jamás inferirlo del checkout/link.
3. Ejecutar exclusivamente esa propuesta en staging y guardar salida, transacción e historial que produzca el mecanismo elegido. Recapturar opciones y grants con verify.sql. Si falla antes de commit, PostgreSQL revierte toda la transacción.
4. Comprobar `security_invoker=true`, ausencia de privilegios PUBLIC/anon, authenticated solo SELECT entre privilegios del catálogo, y ninguna mutación de filas/otros objetos. Después realizar pruebas reales anon y clínica A/B; metadatos no sustituyen ese paso.
5. Si la lectura necesita detenerse tras commit, usar [stop.sql](reconciliation/encargo01_staging_view_boundary.stop.sql): revoca acceso del cliente, mantiene invoker y datos. Es contención segura, no restauración exacta de ACL. Volver a la vista del propietario y grants originales reintroduciría el riesgo y requiere decisión separada. No hacerlo automáticamente para restaurar una UX.

## 6. Prerrequisitos para reconciliación completa (actualizados)

- **Baseline y migraciones:** 57 entradas remotas de producción frente a 11 staging, con identificadores de 14 dígitos distintos de nombres locales. La carpeta legacy mezcla prefijos repetidos de 8 dígitos y `rollback_*.sql`. **No ejecutar `supabase db push` a ciegas desde esa carpeta; no repair/reset/rename para forzar coincidencia.** Definir baseline canónica revisada y ruta forward/upgrade independiente, conservando archivos e historial existentes.
- **Dump fiel y replay:** Docker, psql del contenedor y Supabase local aislado ya están disponibles. Falta una conexión PostgreSQL remota readonly o dump completo apropiado para comprobar una actualización fiel; los JSON scoped no son ese sustituto. No resetear contraseñas productivas ni crear roles remotos como atajo. Credenciales fuera del repo/logs/chat; no restaurar sobre staging ocupado.
- **Revisión por contrato:** extraer/restaurar baseline en destino aislado, aplicar M7 y decisiones de alcance, comparar clean install/upgrade y generar migraciones canónicas. Restaurar una copia no valida las políticas copiadas: cada grants/RLS/función definer necesita revisión y prueba.
- **Config proyecto:** acceso de lectura/configuración Auth/provider/Data API permitido; confirmar hook, roles/grants para Auth, schemas expuestos, SMTP/dominios/callbacks, sin correos reales durante preparación. Obtener una matriz de autoridad aprobada, sobre todo separación propietario administrativo/odontólogo habilitado.
- **Datos sintéticos:** dos clínicas A/B y nueve actores creados mediante Auth real en la primaria local. La preparación administrativa es explícita; las pruebas de acceso ordinario utilizan signInWithPassword y JWT propios, sin service_role. Completar los casos pendientes de la matriz02; no copiar pacientes reales.
- **Recuperación:** backup restaurable más inventario/bytes de objetos y ensayo de restore con RTO/RPO medidos. Catálogos, hashes o argumentos del DR runner no demuestran recuperación.

## 7. Aceptación y handoff

| Gate | Evidencia necesaria | Estado |
| --- | --- | --- |
| Comparación offline | Herramienta, 8 pruebas, JSON exacto, decisiones M7 | VERIFICADO local |
| Vista acotada | SQL revisado + catálogo antes/después + pruebas anon/A/B | APLICADO; metadatos/privilegios VERIFICADOS; JWT/API A/B pendientes |
| Baseline clean install/upgrade | Dump/runtime/destino, replay, historial coherente y diferencias justificadas | NO VERIFICADO; prerrequisito externo |
| Acceso clínico | Matriz aprobada y positivos/negativos reales para PostgREST/RPC/Storage, JWT viejo/inactivo | NO VERIFICADO |
| Auth y proveedor | Registro/invitación/confirmación/reset y hook efectivo | NO VERIFICADO |
| Navegador y operación | Recorridos permitidos + restore DB/Storage + rollback probado | NO VERIFICADO |

Ninguna afirmación de paridad, clean install o producción clínica completada. El coordinador aplicó el parche acotado y verificó sus metadatos; la reconciliación restante requiere los prerrequisitos anteriores. Encargos independientes de código local pueden avanzar con su estado parcial explícito, pero los gates que dependen de staging no se marcan completos.

## 8. Referencias oficiales actuales

Consulta del 26-09-2026: [RLS y seguridad de vistas](https://supabase.com/docs/guides/database/postgres/row-level-security), [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook), [backups y límite de Storage](https://supabase.com/docs/guides/platform/backups), [CLI](https://supabase.com/docs/reference/cli/supabase-migration-new). El endpoint Markdown devolvió tipo no soportado; se verificaron páginas HTML y búsqueda oficial MCP.

El [changelog del 25-09](https://supabase.com/changelog) anuncia minor PostgreSQL 15.19/17.11 y casos ltree/pgcrypto/btree_gist/operadores al restaurar. Los proyectos observados siguen en 17.6. No se realizó upgrade ni escaneo de datos cifrados; revisar aplicabilidad/versión efectiva antes de un futuro replay, y conservar esa decisión como evidencia operativa.
