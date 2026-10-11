# 01B — Captura remota del esquema

29-09-2026, Ecuador. **Dos dumps SQL acotados capturados; restauración y paridad completa pendientes. NO-GO clínico.**

## Cinco preguntas

| Pregunta | Contrato |
| --- | --- |
| Por qué existe | Comprobar que el contrato local probado corresponde al proyecto que recibirá la aplicación |
| Qué debe ocurrir | Capturar solo esquema de staging y proyecto vinculado; comparar objetos, privilegios y migraciones sin pacientes |
| Qué no debe ocurrir | Exportar datos clínicos, publicar secretos, ejecutar `db pull/push/reset` o llamar respaldo a un catálogo parcial |
| Cómo verificar | Proyecto identificado por ref, exit0 de `pg_dump`, hashes, tamaño, contenido solo de esquema y comparación con catálogos vivos |
| Cómo deshacer | Las capturas son de solo lectura; eliminar los archivos privados si ya no hacen falta, conservando el manifiesto. Nunca usar el SQL sin prueba aislada de restauración |

## Identidad y método

- `cliniaplus-staging`: `phihonofwyerpfgqfekt`.
- Proyecto vinculado a la configuración actual de la app y a la CLI: `Auto-SNet`, `leqsrfyjvuxxdsubjjin`. Se lo denomina **vinculado**, sin inferir aprobación de producción.
- La sesión CLI puede listar proyectos. `.env.local` tiene URL de Auto-SNet; no almacena contraseña PostgreSQL. Los archivos de enlace tampoco la contienen. Las credenciales temporales de CLI se eliminaron del disco tras la captura.
- Dos consultas `SELECT` contra el catálogo de PostgreSQL se ejecutaron vía conexión Supabase; cada respuesta es una sola sentencia para tener una captura consistente dentro de ese proyecto. Se guardaron fuera de Git en `tools/local-supabase/supabase/.temp/remote-stage-catalog-20260929-1.private.json` y `remote-linked-catalog-20260929-1.private.json`.
- No se consultaron filas de pacientes ni bytes de Storage. Los catálogos incluyen definiciones de funciones y se tratan como privados. La consulta exacta es `docs/production/evidence/2026-09-27/capture-scoped-metadata.sql`; alcance de esquemas `public`, `logs` y `security_internal`, más políticas de Storage y configuración de buckets. **No incluye la definición completa administrada de Auth/Storage ni configuración de correo/redirecciones.**

[Manifiesto público con SHA256, cantidades y procedencia](evidence/2026-09-29-schema-audit/catalog-summary.json). Ambos archivos privados están ignorados por Git. Las 11 categorías comparables coinciden con las capturas del27-09; es estabilidad de ese subconjunto, no paridad con la release.

## Diferencias que bloquean la promoción

| Elemento observado | Staging | Proyecto vinculado | Aceptación requerida |
| --- | ---: | ---: | --- |
| Relaciones del catálogo acotado | 28 | 31 | Resolver diferencias con migraciones revisadas |
| Funciones | 10 | 30 | Verificar allowlist/RPC y permisos efectivos |
| Políticas | 13 | 97 | Cerrar matriz clínica por rol y clínica |
| Buckets configurados | 0 | 10 | Definir buckets privados finales, tamaños/tipos y Storage API |
| Migraciones registradas | 12 | 57 | Reconciliar secuencia e historial sin forzar `db push` |
| RPC `get_clinic_operational_report` | ausente | ausente | Integrar/verificar en staging; el candidato SQL local sí la incluye |

Las cantidades comparan proyectos en estados históricos diferentes. No se asume que las 97 políticas sean deseables ni que los diez buckets deban copiarse. El objetivo es el contrato mínimo de Clinia+ sin finanzas activas.

## Dumps SQL capturados y límites

La CLI `supabase db dump` falló primero por Docker Desktop apagado. Tras iniciarlo, intentó descargar una imagen PostgreSQL grande; se interrumpió para proteger el espacio libre. Ese primer archivo de **0 bytes no es un dump**. No se ejecutó `db pull/push/reset`.

Se usó entonces `pg_dump` de una imagen PostgreSQL **ya presente** en Docker, mediante [cliente acotado](../../scripts/clinia-remote-schema-local-client.cjs), sin iniciar otro servidor ni descargar una imagen. Ambos procesos terminaron **exit0**. Los archivos privados están ignorados por Git:

| Proyecto | Archivo privado bajo `tools/local-supabase/supabase/.temp/` | Bytes | SHA256 |
| --- | --- | ---: | --- |
| Staging | `2026-09-29-staging-schema-local-client.sql` | 79.202 | `fe8d692856e96091eac8ae48f6ce2438c6fab85ea8e4c01679a4a000cb0a4347` |
| Vinculado | `2026-09-29-linked-schema-local-client.sql` | 177.577 | `e251b969c0b6df8c5281ecf753aedca1af146799d84ba41fc9a892a5fdb599f3` |

`pg_dump --schema-only --quote-all-identifiers --role postgres` incluyó `public`, `logs` y `security_internal`. Los dumps tienen cabecera PostgreSQL y la tabla `public.patients`; no contienen sentencias de nivel superior `COPY` ni `INSERT INTO`. Staging tiene 25 `CREATE TABLE`, 10 `CREATE FUNCTION` y 11 `CREATE POLICY` en esos esquemas; el vinculado, 25, 30 y 75. Tablas físicas y funciones coinciden en cantidad con los catálogos remotos independientes. Las políticas del catálogo suman también Storage, excluido de estos dumps; sus cantidades no deben igualarse.

[Manifiesto de los dumps](evidence/2026-09-29-schema-audit/schema-dump-summary.json). **No se ha probado la restauración aislada.** Auth/Storage administrados, configuración SMTP/redirecciones y bytes de objetos no están incluidos. Por ello son capturas SQL del esquema seleccionado, **no respaldos completos ni prueba de paridad de release**.

El disco C: llegó a unos 43 MB libres tras la descarga interrumpida. No se inició una restauración ni una nueva pila local con ese margen; `docker system df` no mostró recursos recuperables significativos y no se borraron imágenes/volúmenes. Hay que recuperar espacio antes de la prueba aislada de restauración y de los gates de API/Storage.

Una credencial temporal de CLI apareció accidentalmente en la salida de una herramienta durante una comprobación. Los dos archivos que contenían credenciales temporales se eliminaron del disco. Una consulta posterior a `pg_roles` en ambos proyectos no encontró ningún rol `cli_login_postgres.%` activo. No se imprimen ni conservan valores de credenciales en la evidencia pública; la salida histórica de la herramienta no se puede retirar.

## Handoff

```text
ENCARGO: 01B
COMMIT / ENTORNO: f96fbb8 + delta; Supabase staging y proyecto vinculado
ESTADO: PARCIAL
CAMBIOS: dos catálogos y dos SQL privados de solo esquema; manifiestos públicos; cliente pg_dump acotado
PRUEBAS Y EVIDENCIA: SELECT por proyecto; 11 categorías estables; pg_dump exit0 ambos; hashes, tamaño, 25 tablas por proyecto y ausencia de COPY/INSERT de nivel superior
RIESGOS: restauración no probada; Auth/Storage/configuración/bytes y paridad desplegada pendientes; disco C: casi lleno
REVERSIÓN: ninguna mutación remota por capturas de solo lectura; SQL privados pueden eliminarse cuando exista respaldo aprobado
REQUISITOS SIGUIENTES: recuperar espacio; restauración aislada sin datos, configuración administrada y continuación 01A/02
```

Referencia oficial: [flujo local y diferencia entre `db pull` y `db dump`](https://supabase.com/docs/guides/local-development/cli-workflows).
