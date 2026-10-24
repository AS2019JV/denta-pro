# Step2 — caducidad clínica, checkpoint24oct2026

**Caducidad: BLOCKED de ejecución HTTP. Step2 PARTIAL; Production NO-GO.** El vencimiento natural está corroborado, pero todavía falta el login NUEVO del titular y su request ordinario. No se ha enviado redención, ni se interpreta un estado DB vencido como PASS runtime.

## Identidad y candidato

Base fija `5a7a24af57c645bfc1cf8c70594cc568e03a7176`, obtenida de la sección vigente del coordinador; CI40003941444 SUCCESS/completed/workflow_dispatch del mismo SHA, verificada por gh. PreviewDSCZLhuZTEpkMK34H4Y5uocJaUmp Ready/Preview y fuente SHA completa comprobados en Vercel. El alias y main no se usan como identidad. El handoff902999c/CI39987122895 fallido no se considera verde.

Worktree nativo propio `C:/Users/aleja/.codex/worktrees/clinia-invitation-expiry/denta-pro`; rama exclusiva `codex/step2-clinical-expiry-20261024`, HEAD base5a7a24af. Ningún cambio de aplicación/SQL, ningún merge/push/build/CI nueva/Docker. Evidencia/harness exclusivamente en este worktree. Matriz global y recibos ajenos sin edición.

## Hechos ejecutados

| Control | Resultado |
|---|---|
| Reloj DB | PASS de observación:24oct06:14:10.329124UTC >23oct23:14:19.707469UTC. Ahora es24oct en Ecuador. `clock-and-fixture-before.json`. |
| Fixture | Sigue pending/auth_ready, accepted_by/at NULL, ReceptionB; mismo email, token SHA256b2d03228c6184004ebd8888e13e907afefcdf29e52cfedf517a96eed9ca65665 y expires_at original.0membresías/0clínicas propias; confirmado/no baneado/perfil activo. No aceptar/rotar/reemitir/revocar. |
| Destinatario | invite-expiry-b@auth.cliniaplus.com / UID979d0bea-07c7-470f-b188-9c029d1a0701, coincide con invitación. Las sesiones históricas de17oct no se usarán. |
| Contrato | Definiciones vivas de redeem_verified_clinic_invitation, clinia_session_active y lock_clinia_session observadas sin mutación. Sesión/identidad/perfil/token/email/rol preceden a pending/expiry; emisor/clínica se comprueban después. `live-guard-contracts.json`. |
| Evidencia previa válida | Los7handlers/fuentes seleccionados no cambiaron entre627ff7a y5a7a24af; contrato vivo de redención idéntico SHA256adc8312bd72e5538646f9135a73ec590d4a85ad98510e1f1627966efc64974b8 al recibo17oct. Se conserva preparación/identidad/digest/expiry histórica, sin trasladar aceptación runtime. `historical-evidence-reuse.json`. |
| Custodia original | Correo original16oct23:14:20UTC recuperado por lectura autorizada; token extraído sin abrir enlace Auth y cotejado con digest original. Custodia ignorada solo en worktree propio. `token-custody.json`. |
| Turno navegador | Titular confirmó exclusividad para este chat. Login exacto de DSCZ accesible usando acceso propio de Vercel; no se creó/cambió/revocó enlace compartido ni acceso ajeno. |
| Inicio nuevo/HTTP | BLOCKED: solicitud humana pendiente para incógnito nuevo, contraseña y TOTP existentes. No JWT capturado,0probes HTTP Auth/RPC y0POST redención del experimento. |
| Harness | `node --check .temp/clinical-expiry.cjs` PASS. Sin suites de aplicación/restore repetidas. Snapshot máximo45s, hashes de3guardas, mismo JWT congelado, Origin inmutable, una sola redención y sin retries/refresh. Fuente pública archivada para revisión. |

## Ejecución pendiente y prueba causal exigida

El titular debe iniciar sesión nueva en contexto limpio contra DSCZ como el destinatario exacto, sin abrir su invitación. La ausencia de clínica es esperada. Copiar únicamente un GET `/auth/v1/user` ordinario de staging a `.temp/expiry-recipient.private.curl` en ESTE worktree; nunca un POST de contraseña/token ni valores en chat. La siguiente sesión deberá ser nueva respecto del reloj de inicio de este bloque.

Modos preparados: bind→probe; snapshot DB independiente fresco que vincule hash de SID/UID/AMR password+TOTP/AAL2, perfil/Auth activos, email/rol/token exactos, pending, expires_at pasado, emisor/clínica utilizables y hashes de3guardas; después único redeem y snapshot DB posterior independiente. HTTP403/42501/Invitation denied solo se atribuirá a expiry si todas las guardas previas se acreditan y no cambian autoridad/invitación. El contrato hace rollback y conserva pending; no se espera convertirlo administrativamente a expired.

No hay prueba de rechazo aún. Tampoco se usa el enlace Auth vencido como sustituto. Si falta una precondición, detener sin modificar profile, miembros, trial, reloj o capacidades. No repetir automáticamente el envío.

## Límites y handoff

Preparación histórica no sustituye el login nuevo. No se cerrarán cuotas clínica120/global1000, otros requisitos Step2, gates3–7, incidentes históricos/service_role abiertos, cuarentena clinia-test ni aceptación clínica/legal. Producción NO-GO, sin aceptación de riesgos ni reparación de ledger.

Al cerrar el bloque se eliminará toda custodia privada y se registrará su ausencia. No se afirmará logout global; no se tocarán sesiones de otros actores ni accesos ajenos. Las pestañas temporales del agente se cerrarán. No se ha creado acceso temporal propio que requiera revocación.

El `handoff.json` de este worktree es una entrega local para el coordinador, no una actualización de la matriz compartida. Revisión Luna6 final del delta pendiente de recibos de cierre.
