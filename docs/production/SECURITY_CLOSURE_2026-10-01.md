# Clinia+ — cierre de seguridad del 01-10-2026

**NO-GO clínico.** Revisión de ingeniería por áreas y correcciones locales; no certificación ASVS/LOPDP, escaneo formal completo del plugin ni aceptación desplegada. Se conserva el checkout anterior, sin commit, despliegue, modificación remota ni comunicaciones reales. El [plan de cierre](PLAN_DE_CIERRE_PRODUCCION_2026-09-28.md) y la [matriz](RELEASE_ACCEPTANCE_MATRIX.md) siguen vigentes.

## Arquitectura comprobada en código

| Límite | Implementación y control | Límite de evidencia |
| --- | --- | --- |
| Aplicación | Next App Router/React, páginas de clínica, agenda, pacientes, recetas e informes | Compilación y contratos locales; aceptación clínica/UAT pendiente |
| Identidad | Supabase Auth; cliente SSR por cookies; `getUser()` en middleware, acciones y API | Auth desplegado/MFA/hook y flujo de alta todavía pendientes |
| Clínica y roles | `clinic_members`, perfil activo/no eliminado; preferencia de clínica no concede permisos; RPC `get_clinic_member_role` | Contrato canónico reconciliado local, no supuesto sobre versiones remotas |
| Datos y API | Browser con clave anon/JWT → PostgREST/RPC; privilegios por columna, RLS, funciones con search_path fijo y guardas de FK/autoridad | Cadena SQL local previa acotada; instalación limpia y upgrade remoto completos pendientes |
| Operaciones privilegiadas | Auth Admin/invitaciones y destinatarios de correo usan service role solo en servidor después de autorización | Requieren configuración y pruebas del mismo candidato desplegado; aceptación confiable de invitación pendiente |
| Archivos | Cuatro buckets privados; rutas por clínica/paciente o usuario; firma temporal solicitada con cliente ordinario | Pruebas reales de todas las familias de objetos, caducidad y recuperación pendientes |
| Proveedores | Resend en servidor; pagos/webhook deshabilitados con 503 | Abuso, cuotas y entrega de correo pendientes; no se enviaron mensajes |
| Auditoría/logs | Auditoría SQL privada de autoridad/agenda/derechos; logger con redacción | No acredita retención, centralización ni alarmas operativas |
| CI/release | Acciones por SHA, permisos contents:read, checkout sin credenciales persistentes, npm ci, entorno sintético sin red de proveedores | CI remota, promoción, rollback y variables del despliegue sin verificar |
| Recuperación | Dumps de esquema seleccionados y validador de manifiestos | No restauración demostrada de DB, bytes de Storage ni configuración |

## Amenazas, prioridad y correcciones

Las reproducciones ejecutan fuentes reales con clientes/proveedores sintéticos. Demuestran la decisión vulnerable del código; no son pruebas de explotación de un proyecto desplegado. Las regresiones conservan positivos autorizados y niegan las rutas anteriores.

| ID/severidad | Ruta y evidencia de impacto | Corrección local |
| --- | --- | --- |
| S01 / alta-P1 | Confirmación con sesión y `next=javascript:...` llega a `router.push`, incluso sin OTP | Destinos internos constantes permitidos; helper común en componente y ambos handlers; ninguna query/hash del atacante se propaga |
| S02 / alta-P1 | Correo acepta metadata histórica sin membresía o tras error; perfil suspendido con membresía activa también despacha | RPC de rol viva, errores denegados, sin fallback de ownership/metadata/mocks; JWT Bearer también identifica las consultas; cookie exige JSON y origen exacto |
| S03 / alta-P1 | Invitación permite propietario histórico demovido, perfil ausente/eliminado y sobrescribe autoridad del invitado | Exigir RPC viva=clinic_owner; eliminar upsert privilegiado de rol/perfil; validar entrada y errores; escape HTML |
| S04 / media-P2 | Registro público incorpora enlace HTML atacante en correo de confirmación; reenvío usa metadata sin escapar | Escape de texto/atributos y validación de registro en servidor; restricciones de tamaño/MIME del logo, sin afirmar validación completa de contenido |
| S05 / funcional-P2 | Avatar profesional usa ruta plana incompatible con RLS; consumidores piden URLs públicas para buckets privados | Ruta usuario/archivo, resolución privada y guardas contra publicación fuera de la autoridad vigente; no se abren buckets |

La revisión adversaria encontró y cerró también el éxito falso ante rechazo de Resend y el bloqueo de reintento de invitaciones. El rechazo explícito expira solo la invitación nueva mediante actualización condicional confirmada; una entrega incierta conserva la pendiente y requiere revisión. Registro conserva la cuenta creada y ofrece reenvío, sin afirmar entrega. La contraseña de registro se valida en cliente/servidor con12–128caracteres. No se presenta como certificación de política de contraseñas.

El logo de receta se firma nuevamente al exportar; la prueba con reloj posterior a301s evita reutilizar una URL vencida. `family-center` no tiene consumidores y `messages` está deshabilitado: sus imágenes legacy y las rutas planas/externas históricas quedan diferidas, sin abrir buckets como reparación.

La RPC viva exige que el **contrato canónico** esté instalado: estas correcciones no autorizan promover la aplicación a los esquemas remotos antiguos. Las firmas temporales son capacidades reutilizables hasta caducar; revocar un miembro no retracta una descarga entregada.

## Validación y alcance

El registro final de comandos, resultados y hashes está en [evidencia de esta entrega](evidence/2026-10-01-security/execution.json). Las advertencias previas de hooks/imágenes se mantienen explícitas; ningún control de tipos/lint fue desactivado.

Snapshot `security-20261001-final`:611archivos, instalación congelada646paquetes, verificación completa tipos/lint/119tests/build **exit0**. Regresión adicional de seguridad63/63,exit0. Revisión adversaria final34/34 sobre las correcciones. Estas34pruebas se solapan con las anteriores y no se suman como cobertura adicional. Advertencias de Supabase en Edge Runtime y de serialización/carga de imágenes/hooks quedan abiertas; no se verificó ejecución Edge desplegada.

- Auditorías npm actuales de producción y completas: cero avisos conocidos; no prueba ausencia de vulnerabilidades futuras/no publicadas.
- Escaneo local de reglas de credenciales: archivos de texto visibles para Git/snapshot, sin imprimir valores. No cubre historial, archivos ignorados ni inventario de secretos desplegados. Inspección separada de variables públicas locales no encontró claves privilegiadas.
- CI incorpora escaneo de credenciales y fallo ante avisos npm altos/críticos de producción. Está configurada; no ejecutada remotamente en esta entrega.
- Matriz API ampliada en `verify-clinia-contract-api.cjs`: cuatro buckets, bytes, firma/caducidad, escritura ajena, listado de otra clínica, JWT anterior a revocación. Preparación/sintaxis no acreditan que haya pasado.

## Bloqueos de producción y siguiente secuencia

| Estado | Gate necesario | Acción concreta/evidencia de cierre |
| --- | --- | --- |
| VERIFIED local / BLOCKED integración por recursos al inspeccionar | Build aislado final / servicios de integración | Build completado exit0. Liberar al menos2GB RAM y verificar recursos antes de arrancar únicamente aceptación local. Docker respondió; todos los servicios estaban detenidos, RAM inicial435572KiB, segunda lectura1423596KiB y final482804KiB. Disco observado:15841206272bytes libres |
| NOT VERIFIED | 01A/01B: baseline limpia, upgrade, paridad y mantenimiento PostgreSQL | Restaurar capturas de solo esquema en destino nuevo aislado con Auth/Storage reales, reconciliar historial y probar contrato final; no usar db push/reset sobre proyectos ocupados |
| PARTIALLY VERIFIED | 02A/02B: aislamiento/revocación/Storage completos | Ejecutar nueva matriz API con JWT ordinarios y navegador, perfil suspendido/eliminado, democión, errores, concurrencia y contención; repetir en contrato limpio/upgrade y candidato desplegado |
| NOT VERIFIED | 10B y abuso de correo | Flujo confiable de alta/aceptación que no convierta metadata editable en autoridad; límites compartidos por actor/IP/destinatario, desafío y cuotas. El Map de correo es solo por proceso y los métodos Auth Admin públicos no heredan límites de signup ordinario |
| NOT VERIFIED | 14A: recuperación real y monitoreo | Restaurar DB+bytes+configuración en destino independiente; comparar contenido, medir RPO/RTO reales y probar alertas sintéticas con responsable |
| NOT VERIFIED | Configuración del release | Variables/secretos por entorno, validación por función, hook/MFA/protección de contraseñas/redirects, CI remoto y candidato idéntico. `lib/env.ts` aún tolera configuración inválida mediante defaults |
| NOT VERIFIED | 07–15: producto clínico, privacidad y UAT | Mantener pendientes tutores/CSV/HCU/recetas/autoría, idempotencia/concurrencia, UX/carga, custodia/LOPDP y firma profesional; revisión por odontólogo/privacidad y Go/No-Go documentados |

El artefacto histórico `docs/security/DR_DRILL_EVIDENCE_LATEST.json` no acredita recuperación: `dr-drill-runner.cjs` valida manifiestos, flags y tiempos suministrados; no restaura una base ni verifica bytes recuperados. Se conserva como histórico y no se utiliza para aprobar este gate.

Ante fallo de la matriz API se conserva el intento, sus actores y volumen. El launcher rechaza drift de estado administrado; un intento posterior necesita continuación revisada, no borrar fixtures ni cambiar silenciosamente el snapshot. Detener únicamente el candidato aislado cuando corresponda; no restaurar grants vulnerables.

Se trabajó con inspección → amenazas → reproducción → prioridad → corrección → regresión → revisión adversaria. El siguiente ciclo depende de recursos y evidencia externa; **quedan bloqueos críticos y no se declara el objetivo de producción alcanzado**.

## Fuentes actuales consultadas

- [Supabase: RLS y privilegios](https://supabase.com/docs/guides/database/postgres/row-level-security): comprobar grants y políticas conjuntamente; mantener claves privilegiadas en servidor.
- [Supabase: backups](https://supabase.com/docs/guides/platform/backups): el respaldo de base no contiene bytes de Storage.
- [Supabase: changelog](https://supabase.com/changelog): mantenimiento PostgreSQL 17.6→17.11 requiere ensayo; no se actualizó el servidor.
- [Next: useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router): nunca pasar URLs no confiables a push/replace.
