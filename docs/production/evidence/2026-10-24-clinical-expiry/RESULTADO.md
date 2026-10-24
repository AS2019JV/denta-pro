# Step2 — caducidad clínica verificada,24oct2026

**Caducidad: VERIFIED para este único caso negativo. Step2 PARTIAL; Production NO-GO.** Luna6 mantiene VERIFIED tras revisar los recibos runtime y el suplemento de formato/lookup. La matriz global no fue editada.

## Candidato y alcance

Aplicación bajo prueba: `5a7a24af57c645bfc1cf8c70594cc568e03a7176`, Preview `DSCZLhuZTEpkMK34H4Y5uocJaUmp`, CI `40003941444` SUCCESS del mismo SHA, revalidada por lectura. Ready/Preview/fuente completa de Vercel revalidados antes del intento. Main y el alias móvil no se usan como identidad. El baseline902999c/CI39987122895 fallido queda histórico, sin aceptación verde.

Worktree nativo propio: `C:/Users/aleja/.codex/worktrees/clinia-invitation-expiry/denta-pro`; rama `codex/step2-clinical-expiry-20261024`, HEAD5a7a24af. Sin código de aplicación/SQL nuevo, commit, push, CI nueva, stack Docker ni recurso facturable. Solo harness/evidencia local sin secretos. Los7handlers seleccionados y el contrato vivo de redención coinciden con627ff7a: se reutiliza esa evidencia de fuente/preparación, sin trasladar aceptación runtime de otro Preview.

## Prueba ejecutada

| Evidencia | Resultado |
|---|---|
| Reloj DB | now24oct06:14:10UTC ya superaba expires_at original23oct23:14:19.707469UTC (=23oct18:14:19.707469Ecuador). Se volvió a comprobar en el snapshot inmediato de16:03:37.406037UTC. |
| Identidad/sesión nueva | Titular usó contexto limpio, contraseña y TOTP existente: sesión creada24oct15:42:44UTC, TOTP15:47:01UTC, AAL2. Exacto invite-expiry-b@auth.cliniaplus.com / UID979d0bea-07c7-470f-b188-9c029d1a0701. Cero autoridad clínica; pantalla de falta de clínica esperada. `ordinary-session-binding.json`. |
| JWT ordinario | Captura solo GET /auth/v1/user, Origin del host inmutable de DSCZ, API key pública; sin credencial privilegiada. JWT/SID congelados por digest, sin refresh. La captura guardada inicialmente en la carpeta anterior se trasladó únicamente a este worktree, sin imprimirla; no se reutilizó un JWT histórico. |
| Probes reales | GET Auth user200 y RPC clinia_session_active200/true, una vez al validar el actor y otra inmediatamente antes del POST. Mismo JWT/SID por digest. No se presentan como pruebas nuevas de logout/MFA/aislamiento. |
| Precondiciones independientes | `immediate-before.json`: confirmado/no anónimo/no baneado/no eliminado, perfil activo, sesión exacta viva/AAL2/password+TOTP nueva, email de invitación coincidente, auth_ready, rol receptionist, pending, accepted_by/at NULL,0membresías/0clínicas propias, emisor owner y clínica utilizables. Tres hashes de guardas vivos coinciden con sus definiciones capturadas. |
| Capacidad original | Titular copió el enlace ORIGINAL del correo16oct a archivo local ignorado; el harness extrajo el token sin abrir el enlace Auth. Digest SHA256b2d03228c6184004ebd8888e13e907afefcdf29e52cfedf517a96eed9ca65665 coincide con checkpoint e invitación. No reemisión, rotación ni revocación. `token-custody-runtime.json`. |
| Único intento | POST real PostgREST a redeem_verified_clinic_invitation con token original y JWT congelado:24oct16:03:41.204UTC (=11:03:41.204Ecuador), snapshotAge3798ms. Respuesta403 / SQLSTATE42501 / Invitation denied.0retries, refreshUsed=false. `redemption-http.json`. |
| Estado posterior independiente |16:04:04.7208UTC: todos los campos del snapshot salvo reloj DB idénticos; pending, mismo digest/expires_at/rol/destinatario, sin accepted_by/at,0membresías/0clínicas propias; misma sesión viva y tres guardas iguales. `immediate-after.json`, `http-state-comparison.json`. |
| Formato/lookup | Suplemento read-only posterior: token original de longitud56, válida1..512, y una única fila con ese token. Mismo digest/estado/expiry: no token NULL, tamaño inválido ni lookup de otra fila. `token-shape-supplement.json`. No segundo POST. |

## Motivo causal y contrato

El contrato observado evalúa lock/sesión, identidad confirmada, perfil y token/email/rol antes del guard pending/expiry; las comprobaciones de emisor/clínica vienen después. La sesión ordinaria pasó Auth y la comprobación de sesión viva solo4ms antes de iniciar la redención. Las demás precondiciones previas están corroboradas por lectura DB y el mismo token por digest. En estado pending, expires_at no nulo y pasado es el primer predicado fallido. Por eso el403 se atribuye a **caducidad clínica**, no a sesión/identidad/MFA ni al TTL del enlace Auth.

El RPC levanta excepción y revierte la transacción: el estado esperado es seguir pending, sin crear autoridad. No actualiza administrativamente la fila a expired. Las lecturas posteriores son consistentes con ese contrato. La comprobación de formato es posterior y se documenta como suplemento, ligada al mismo digest inalterado; no se fabrica una medición previa.

## Limpieza, límites y entrega

Se eliminaron6 archivos privados (captura, JWT congelado, token, clave privada/pública temporal y enlace). `private-cleanup.json` allAbsent=true. El titular confirmó la acción combinada solicitada de cerrar su ventana incógnita y reemplazar el portapapeles; no se leyó su contenido para verificarlo. No se afirma logout global ni revocación de filas Auth. No se cerraron sesiones ajenas.

Acceso temporal Preview: **N/A, ninguno creado/cambiado/revocado**. Se usó acceso propio ya disponible y la redención ordinaria contra staging; no se sustituyeron ni revocaron enlaces de otros chats. Pestaña temporal del agente cerrada al terminar.

La revisión automática bloqueó trasladar la capacidad en texto plano a un conector y una creación que podía sobrescribir custodia; se resolvió mediante archivo local del titular y creación atómica sin sobrescritura. El token nunca se colocó en un comando ejecutado ni en recibos públicos. `tool-review-disposition.json`. El checkpoint previo, sus detenciones y su limpieza están preservados, sin representarlos como redenciones.

Comandos: gh run view40003941444; git diff de las7fuentes seleccionadas; node --check; modos bind/probe/custody/redeem/cleanup de `.temp/clinical-expiry.cjs`; consultas MCP execute_sql SELECT guardadas en los recibos.5requests HTTP del harness:4probes y1redención. Ninguna suite/restore repetida ni correo enviado.

No DDL/config compartida, perfil/membresía/trial/reloj alterados, ledger/incident repair, Production, clinia-test/M7 ni gates3–7. El incidente service_role histórico no se considera reparado ni aceptado. Clínica120/global1000 y otros requisitos Step2 permanecen fuera de alcance/NOT VERIFIED; el caso no concede GO general.

**Luna6: VERIFIED acotado**, sin impedimento en este delta. `luna-final-review.md`. `handoff.json` entrega el resultado local al coordinador; publicar este informe aquí no cambia la matriz global. Siguiente acción única: el coordinador integre el handoff de caducidad en su matriz manteniendo los demás pendientes.
