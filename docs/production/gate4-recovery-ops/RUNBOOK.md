# Gate4: operación y recuperación

Base fijada: 902999c6b7b7ee696982d87e8ce7f6e5087f75e2. Rama propia codex/gate4-recovery-ops. Gate4 BLOCKED; producción NO-GO. La matriz global solo la edita el coordinador.

## Política propuesta y herramienta ejecutable

policy.proposed.json propone backup diario 02:00 America/Guayaquil, edad máxima/RPO de 24h, RTO de 4h, ensayo mensual y tras cambios materiales, retención de 7 diarios/4 semanales/3 mensuales y al menos dos copias independientes verificadas. Son objetivos técnicos para decisión del responsable, sin aprobación, activación ni garantía de dimensionamiento. La retención de backups no decide conservación o eliminación de historias clínicas; esa decisión clínica/legal sigue pendiente.

El evaluador es un verificador de entradas y criterios. No autentica firmas ni la autoridad de documentos aportados y nunca autoriza operaciones. No tiene transporte de red, captura, borrado, envío de alertas ni scheduler. Incluso con entradas completas devuelve revisión humana y operationalGo=false. Una cadena en approval o un JSON de coordinación no constituyen autorización.

Desde este worktree:
    node scripts/clinia-gate4-recovery-ops.cjs evaluate docs/production/gate4-recovery-ops/policy.proposed.json docs/production/evidence/2026-10-24-gate4-recovery-ops/operational-input.json <UTC-now>
    node scripts/clinia-gate4-recovery-ops.cjs retention docs/production/gate4-recovery-ops/policy.proposed.json docs/production/evidence/2026-10-24-gate4-recovery-ops/local-catalog.json <UTC-now>

UTC-now debe ser un timestamp explícito terminado en Z, por ejemplo 2026-10-24T18:00:00.000Z. evaluate termina con código 2 si hay bloqueos; 1 rechaza entradas inválidas. retention solo propone KEEP o REVIEW_EXPIRY_ONLY y nunca elimina. Originales, holds, archivos no verificados, claves no recuperables y falta de copias independientes quedan KEEP. No hay tarea programada instalada: falta destino, responsable y canal de alertas autorizado. El responsable debe revisar cada resultado y demostrar alerta/acuse antes de activar un monitor.

## Captura de un backup nuevo: procedimiento aún no ejecutado

Reutilizar scripts/clinia-recovery-envelope.cjs y el paquete fijado de docs/production/recovery-profile; no reemplazar sus hashes, contratos o historial. El capturador histórico gate3-hosted-backup.cjs es una receta atada al origen, sysid, credenciales y snapshot del 21oct: NO reejecutarlo, copiarlo como tarea general o reinterpretar su autorización histórica. Una captura alojada nueva necesita autorización exacta independiente.

Antes de esa captura, el responsable identifica fuente, snapshot/ventana y escritores, y se prueba la barrera coherente de DB y Storage. Una transacción DB no congela por sí sola el contenido de objetos. Guardar comienzo/fin UTC y huellas completas de filas, secuencias, Auth/MFA, configuración, catálogos, objetos y bytes; rechazar drift, faltantes o componentes no portables. Generar una clave nueva por captura; AES-256-GCM autentica antes de parsear. Escribir ciphertext y clave a destinos NUEVOS distintos con creación exclusiva, ACL restringida y sin texto plano persistido. Conservar la clave anterior mientras exista su backup.

No recapturar ni recuperar sobre producción, staging compartido o el test en cuarentena. No subir archivos, crear recursos facturables, reparar ledger ni cambiar configuración como parte de este procedimiento.

## Copias locales y recuperación independiente del chat

Los dos directorios privados creados por este gate están en .gate4-private/archives/custody-01 y .gate4-private/keys/custody-01, con acceso solo usuario actual/SYSTEM. Están ignorados y no se incluyen en commits, handoff ni kit. La clave es sensible y sigue en el mismo equipo: separación lógica, sin custodia independiente/offsite.

La entrada humana concreta de destinos/custodios quedó documentada como pendiente por instrucción del usuario. custody-request.json recoge esas decisiones. La acción mínima es autorizar dos ubicaciones y custodios separados, transferir la copia cifrada y el kit a una ubicación independiente y proteger/transferir la clave por la vía separada aprobada; otro operador debe recuperarlos en otro equipo. El responsable registra los accesos y verifica recuperación sin el chat ni el disco original. No basta un enlace, metadata de upload, checksum local o DPAPI ligada al equipo perdido.

El wrapper de custodia permite verificar otra vez las copias existentes sin el origen:
    pwsh -NoLogo -NoProfile -File scripts/clinia-gate4-custody.ps1 -Mode Verify -Attempt custody-01 -ReceiptName <nombre-nuevo>.json

Usar siempre el wrapper PowerShell: comprueba Git/worktree, exclusión y ACL antes de Node; el codec solo acredita autenticación del archivo. Nunca reutilizar Prepare ni un nombre de recibo. Un fallo parcial conserva los archivos. Los secretos se procesan en memoria; zero-fill de buffers no promete borrado de todas las copias que pueda mantener el runtime JavaScript.

Para reconstruir el alcance p8 desde un equipo distinto hacen falta: un checkout canónico del SHA aprobado, el kit completo, Docker Desktop Linux local/Node22/PowerShell7, las cuatro imágenes por digest, archivo y clave independientes y un destino nunca usado. Seguir docs/production/recovery-profile/README.md; no ejecutar ahora. Las identidades p1..p8 ya tienen historia; comprobar p9 antes de elegirlo o preparar un perfil nuevo revisado. Las rutas, comprobaciones y ACL se deben preparar en el nuevo equipo, sin asumir que existen los directorios originales. Recuperar el perfil cerrado no abre la aplicación.

El kit local recovery-kit-XX.zip (versión vigente en RESULTADO.md) contiene fuentes del perfil, dependencias recursivas de sus manifiestos, codec, estos procedimientos, contratos, digests y manifiesto de archivos. No contiene backup, clave ni imágenes Docker. Debe copiarse a custodia autorizada y probarse desde un equipo independiente antes de considerarlo operativo. Las imágenes no exportadas son una dependencia de disponibilidad pendiente; no hay prueba de reconstrucción sin red ni control del registro.

## Delta positivo/selectivo pendiente: contrato previo a ejecución

La copia p8 está cerrada. Su 403 propio y ajeno, y Storage 400/inner404, no pasan selectiveEvidence. Las 15 pruebas del evaluador usan entradas sintéticas; no son peticiones HTTP reales ni prueba de aplicación recuperada.

Preparación obligatoria para el ensayo pendiente:
1. Recibir handoff del coordinador con SHA completo final, CI del mismo SHA y entorno exacto. Comparar contratos/hashes; conservar p8 solo donde el diff no los invalide. El sucesor de seguridad citado en la matriz no sustituye ese handoff.
2. Fijar un contrato local NUEVO revisado con identidad/sysid/red/volúmenes propios ausentes, sin puertos públicos, rutas sin solapamiento y recursos actuales. No usar el alias de producción, project-ref alojado, archivos de coordinación como autorización ni IDs del bloque de caducidad.
3. Restaurar en esa copia exclusivamente el delta necesario para acceso positivo. Usar guardas locales reales de versión/sysid/catálogos, sin fingir que el local es el destino alojado. No relajar ACL/RLS/grants, regenerar factores o habilitar una autoridad desactivada para forzar PASS. Si el contrato positivo necesita un cambio de autoridad no aprobado, detener y pedir decisión concreta al coordinador.
4. Password y TOTP originales deben dar AAL2; usuario de clínica propia debe obtener una fila/identidad esperada, el otro actor cero filas o denegación inequívoca, y anon denegación. No aceptar servicio privilegiado como actor ordinario.
5. Los objetos privados siguen el broker de la arquitectura: autorización ordinaria en aplicación, principal de entrega dedicado de mínimo alcance, GET completo/hash/Range y cabeceras privadas/no-store, y otra clínica/anon sin bytes. Un GET service_role o un objeto oculto para todos no sustituyen la entrega de aplicación. En la última evidencia funcional el principal estaba disabled/expired; no se habilita aquí.
6. Medir desde el comienzo declarado de preparar el destino hasta el último byte/Auth/MFA/config/catálogo/invariante/HTTP requerido. El volumen de 53 bytes no es representativo de producción. Toda falla conserva destino/recibos; resultado incierto de COMMIT exige reconciliación READ ONLY; jamás reintento automático.

No se ha definido/aplicado SQL nuevo de apertura ni ejecutado ese ensayo de aplicación. Estado NOT VERIFIED por candidato final/contrato de aplicación y entorno pendientes, según instrucción del usuario. No se presenta un diseño como prueba positiva.

## Reconciliación y RPO/RTO

Antes de COMMIT exigir comparación íntegra con el contrato, las 58 tablas, 3 secuencias y 35 cohortes del snapshot correspondiente. Antes de login comprobar fidelidad; después distinguir sesiones/challenges nuevos legítimos de restauración de filas históricas. Verificar todos los bytes/versiones y configuración capturada, factores originales y límites de raíces externas/SMTP/OAuth/gateway/Realtime.

Ante falla antes de COMMIT, leer estado y exigir igualdad antes de declarar rollback; p4/p6 ya lo probaron para ese paquete. setval y bytes no tienen rollback transaccional completo. Después de COMMIT o resultado indeterminado, suspender clientes, conservar destino/volúmenes, reconciliar estado y usar OTRO destino nuevo si falta recuperación. No recuperar sobre el origen ni importar/reparar ledger.

RPO actual exige prueba fresca del origen autorizado, identidad del snapshot y barrera de escritores, comparando todos los commits y bytes hasta el incidente. Copiar fielmente el archivo del 21oct acredita esa copia; no RPO0 del origen actual. El RTO p8 de 130.356s sigue siendo únicamente del laboratorio cerrado con imágenes en caché. La métrica de custodia de este gate cubre su propio inicio y todos sus checks; no es un restore/RTO.

## Referencias oficiales revisadas el 24oct2026

- https://supabase.com/docs/guides/platform/backups : la copia DB conserva metadata Storage; los objetos requieren copia propia.
- https://supabase.com/docs/guides/self-hosting/restore-from-platform : restauración DB y límites de transferencia de objetos/configuración.
- https://supabase.com/changelog : se consultó HTML porque el endpoint changelog.md no fue accesible desde el entorno.
- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically : el cambio del 30oct afecta grants por defecto de tablas nuevas; conservar explícitamente el contrato, sin añadir grants para conseguir un PASS.
