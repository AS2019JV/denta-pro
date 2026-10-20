# Sucesor de adopción Gate3 — ensayo aislado, adopción BLOCKED

Base inmutable: `17837fdbd6700f9c7943583dbd2b4620c6b057d2`. Su CI39315042691/388 pruebas no acredita este sucesor. No cambia código de aplicación. El nuevo SHA y su propia CI se registran fuera de este archivo después del commit.

## Qué contiene y qué permite

`manifest.json` fija20 fuentes en orden y7 artefactos. `forward.sql` contiene las transformaciones explícitas del instalador local: elimina únicamente sus guardas de fixture, conserva las comprobaciones estructurales/de datos y ejecuta como propietario real. No reproduce DML histórico, importa ledgers ni modifica buckets/configuración managed. Las siete transformaciones y sus hashes están en el manifiesto. Los scripts rollback quedan fuera del camino forward.

El contrato completo conserva legacy, precisión numeric, FK restrictivas y vista de recepción de la variante upgrade. Retiene PUBLIC USAGE del baseline y el ACL implícito de subscription_status; no reconstruye columnas ni amplía permisos para igualar representaciones. La captura codifica pg_sequence bigint como texto exacto. Solo se normalizan orden de filas/conjuntos ACL/config y CRLF; no se omiten identidades o campos. Un catálogo histórico no prueba el estado remoto actual.

`clinia-hosted-successor.cjs` compila una transacción con identidad real de servidor, base/roles, advisory lock, locks de tablas, catálogo anterior íntegro,27 invariantes agregadas, cuatro buckets privados/sin otros públicos, SQL forward y catálogo posterior íntegro. Cualquier error aborta la transacción. `execute-clinia-hosted-successor.cjs` usa exclusivamente psql/PGPASSFILE explícitos y TLS verify-full; `check` es READ ONLY y exige autorización separada. Nunca usa el instalador17837fd sobre un remoto ni sus GUC locales.

**El registro alojado está vacío y el transporte deniega todos los destinos.** Ambos refs compartidos están prohibidos incondicionalmente. `clinia-test` (`fbtlldubzomocuhpvweg`) está identificado para planificación; no registrado para DDL. Está vacío y no coincide con `baseline-upgrade.json`: este ejecutor correctamente lo rechazaría. Falta un bootstrap alojado separado, adaptado/revisado/ensayado a PG17.11 y a su inicialización managed; no ejecutar en bruto baseline-upgrade.sql, carpeta histórica ni instalador local. No se afirma que el SQL propuesto sea una adopción alojada lista para ejecutar.

## Autorización, privilegios y recuperación

Las banderas runtime no autorizan un destino. Antes de habilitarlo, un candidato revisado debe fijar ref/host/system identifier, evidencia de aislamiento/privilegios y hashes de autorizaciones humanas separadas para lecturas/cambio. Una cadena `APPROVED` no prueba firma humana. La revisión de release debe vincular el registro con la aprobación auténtica; Codex no la crea ni la firma.

La aprobación del cambio fija `packagePayloadSha256` (artefactos ejecutables sin el registro de aprobaciones y cierre transitivo de siete módulos CJS, UTF8/CRLF→LF). El registro queda pinneado aparte por el manifiesto. Así no hay autorreferencia de hashes. Las dependencias nuevas/dinámicas no pinneadas se rechazan. Recuperación exige bytes exactos del recibo, digest recalculado, identidad/baseline/estado/fecha concordantes, hash aprobado y registrado, antigüedad menor30min. El registro se revisa/versiona antes de cualquier ejecución; un hash por sí solo no acredita que se realizó un restore.

El prototipo usa el propietario postgres real; **mínimo privilegio/delegación alojados NO VERIFICADOS**. No concede membresías, crea credenciales ni autoriza nuevos roles managed. La falta de autoridad necesaria debe abortar y producir un diseño de privilegios para revisión, no un GRANT automático. La disponibilidad de btree_gist/owners/rutinas/Auth/Storage y las diferencias17.6→17.11 requieren prueba propia en el destino aislado.

Rollback previo a COMMIT se ensayó, incluido error después de todo el DDL. Después de COMMIT/escrituras, se requiere backup completo coherente DB/datos/Auth/roles/configuración y bytes Storage más reconciliación de escrituras. El helper `clinia-restore-owner-acls.cjs` solo restaura representaciones ACL por defecto del mismo propietario en nuevas DB locales restauradas; deniega remoto/otras diferencias y nunca es una down migration alojada.

## Verificación y límites

Offline: `node scripts/clinia-hosted-successor.cjs verify` y `node --test test/production/hosted-successor.test.cjs`. Suite completa: `node scripts/clinia-verify.cjs test`. Los recibos nuevos documentan upgrade ocupado, atomicidad, datos/roles/secuencias y restores con Auth password+TOTP, RPC ordinario/denegación entre clínicas y bytes Storage exactos. Fallos iniciales se conservan. Cambios posteriores de autorización no alteran el SQL emitido; prueba offline de identidad enlaza ese SQL con el ensayo ejecutado, sin repetir DDL.

Gate3 sigue BLOCKED; Step2 PARTIAL y producción NO-GO. Un ensayo local no demuestra adopción alojada, CI ni recuperación operativa. Backup/restauración Gate4 es prerrequisito obligatorio, con custodios independientes y objetivos RPO/RTO por aprobar. No se ejecutan gates5–7 ni se interactúa con la invitación protegida.
