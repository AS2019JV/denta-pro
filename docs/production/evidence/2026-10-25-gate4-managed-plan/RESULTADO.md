# Gate4 — preflight y plan managed-only a9,25oct2026 Ecuador

**Preflight físico PASS puntual; plan preparado para revisión. Inicialización managed NOT EXECUTED; turno NOT ALLOCATED.** Se responde a la propuesta de Gate3 sin duplicar su compatibilidad estática del RC ni iniciar fases de aplicación.

## Evidencia física nueva

Destino propuesto clinia-gate3-20261020-a9 ausente en contenedores/volúmenes/red durante la observación.0contenedores activos;3imágenesDB/Auth/Storage verificadas por sus digests inmutables. Red propuesta interna clinia-gate3-20261020-a9-private,10.253.9.0/24,0solapamientos con Docker/rutas específicas;0puertos publicados previstos.

MemAvailable real3246661632bytes frente a738197504bytes requeridos (640MiB máximos de3servicios+64MiB de margen). No es memoria total ni garantía continua. Se obtuvo con1sonda cat/proc temporal, rootfs read-only, network-none, capacidades retiradas,16MiB, sin SQL ni volumen persistente; cualquier volumen declarado en imagen se cubre con tmpfs. Sonda retirada y catálogo de volúmenes persistentes sin cambios.

No se creó el destino/red/volúmenes. No hay sysid ni PG17.11 efectivos del destino; los valores del contrato son expectativas posteriores al arranque. Ausencia/capacidad/rutas deben comprobarse inmediatamente antes de una inicialización realmente aprobada. Cero procesos activos no equivale a reserva exclusiva.

## Contrato exacto para revisión

managed-only.contract.review.json y la plantilla pública managed-only.compose.proposed.json están en docs/production/gate4-recovery-ops/managed-a9-2026-10-25/. El plan de ejecución en línea está en docs/superpowers/plans/2026-10-25-gate4-managed-a9.md.

SoloDB/Auth/Storage, volúmenes nuevos, red interna, sin puertos, privileged=false/pull_policy=never/restart=no. DB conserva su inicializador managed original por hash; no se cambian las guardas. No se generaron credenciales ni compose privado. La plantilla mantiene TOKENS sin instanciar y no debe iniciarse directamente. Se omitieron2campos inactivos de credenciales S3 del borrador derivado; protocoloS3 deshabilitado y fuentes congeladas sin cambios.

Docker compose config --quiet exit0; comprobaciones estáticas de estructura/hash/SQLinicialmanaged/puertos/límites PASS. Son checks de plan, no prueba de inicialización ni recovery. No se ejecutaron M7/upgrade/apertura/restore ni SQL de aplicación, no se importaron ledgers y no se repitieron p8,15pruebas o la copia verificada.

PostgREST queda explícitamente fuera de esta fase. Su imagen congelada64MiB solo puede añadirse con alcance/aprobación propios después. Llevaría el máximo total a704MiB y el umbral con64MiB de margen a768MiB. Las futuras pruebas JWT ordinarias pertenecen a Gate3; SET ROLE/service_role no las sustituyen.

## RC95b e integridad del handoff

Tupla observada:95b059bea1d985c48a62e81d7237be7dcc19b228/árbol9727796e88f0a9fd9b90d00773c8215f376af112, CI40160132494SUCCESS, Preview7bnyGT3TV3WnX2newWEA4oNnb7CsReady. No FINAL ni aceptación runtime. Los fallos antiguos de254996d/902999c no bloquean por sí mismos este sucesor.

Primera preparación rechazó el envelope JSON672201… frente al sidecarefe54f… antes de crear plantilla/credenciales; se notificó al coordinador. Se preservan ese rechazo y la diferencia de campos de reciboCIv2(headSHA/runId frente a headSha/databaseId del lectorv1). No se modificó el lectorv1 ni se ejecutaron sus9tests.

La observación final registra v2026-10-25-v2.4-integrity-repaired con JSON/checksum coincidentes. El contrato.review usa ese recibo; los borradores y rechazos anteriores permanecen. Se verificó la tupla y un único blob de plantilla del RC, sin repetir los contratos/17grupos/bootstrap/canonical/recovery ya comprobados por Gate3.

## Pendiente exacto

Revisión y autorización humana aplicable para este contrato managed-only exacto y turno de Gate4. No se asignó writer ni lease. Tras esa autorización: admisión fresca, preparación privada restringida, inicialización nativa únicamente y recibo real de versión/sysid/salud/emptiness/mounts/puertos. Ante falla: detener solo servicios propios y preservar destino/recibos; no reintentar ni avanzar aplicaciones.

Esta fase no habilita SQL de aplicación, M7, apertura o restore. Las decisiones humanas de custodia/offsite/operador/equipo/objetivos/retención siguen pendientes y no afectan la validez puntual de esta propuesta física; tampoco quedan resueltas por ella.

Se entrega recibo saneado al coordinador. Sin cambios a matriz global, otros chats, Production/staging/cuarentena o accesos. Sin otra Luna/auditoría.
