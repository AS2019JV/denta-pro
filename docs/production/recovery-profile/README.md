# Perfil de recuperación sintética alojado → local

Sucesor de bdba2368, exclusivamente local. No aplica instaladores, M7, apertura o cambios alojados. El backup AES-GCM original y su clave se suministran en custodia privada separada; ninguna fila o clave forma parte del paquete. `manifest.json` fija fuentes ejecutables, contratos, plantilla y dependencias SQL heredadas. No modifica los paquetes anteriores.

## Contrato

PG17.11, Auth2.197.0 y Storage1.80.2 con imágenes por digest. Auth82/Storage74 son recuentos del historial; no identifican versiones del servicio. Las migraciones oficiales inicializan sus propios historiales; refresh está deshabilitado y no se importa ni repara ningún ledger. `managed-differences.json` identifica las35 diferencias anteriores. Iceberg local y15 posiciones físicas por atributos eliminados permanecen variantes explícitas; no hay paridad física alojada ni comparador con exclusiones.

La restauración conserva todas las58 tablas capturadas y3 estados de secuencia, permisos/propietarios/RLS/restricciones/funciones/triggers/índices del contrato. Las ACL del dump son incrementales respecto a privilegios iniciales: el orden es cuerpo sin ACL → retirar exclusivamente derechos extra locales → ACL originales → guardas exactas → COMMIT. Así se conservan también los permisos originales por columna. Un grantor distinto no se repara: aborta la guarda. `setval` y bytes no son transaccionales; se realizan después, registrando cada resultado antes de avanzar. No se afirma rollback completo de esas etapas.

## Custodia y requisitos

Windows PowerShell7/Node22 y Docker Desktop Linux mediante su named pipe local. Imágenes del manifiesto disponibles; red interna, sin puertos publicados y volúmenes DB/Storage nuevos. Máximo704MiB para los cuatro servicios activos, comprobación acotada de memoria disponible en la VM; no se alteran recursos globales. Directorios privados usuario/SYSTEM, sin enlaces/reparse points. Backup y clave permanecen en las rutas privadas conocidas del workspace. La copia y clave en el mismo equipo no equivalen a custodia independiente/offsite.

Establecer `CLINIA_RECOVERY_WORKSPACE` al workspace privado autorizado antes de ejecutar. Los destinos admitidos son únicamente `clinia-recovery-20261022-p1..p9`; debe elegirse una identidad nunca utilizada. Ningún comando elimina volúmenes ni reintenta un restore comprometido.

## Orden de ejecución

Desde este candidato, usar el directorio `docs/production/recovery-profile/harness/`:

1. `node scripts/clinia-recovery-package.cjs` verifica todos los hashes antes de escribir.
2. `node <harness>/gate3-recovery-new-runtime.cjs prepare pN` comprueba ausencia, recursos y aislamiento; genera credenciales locales nuevas y tres archivos privados.
3. `node <harness>/gate3-recovery-new-runtime.cjs start pN` inicializa únicamente dependencias managed oficiales.
4. `node <harness>/gate3-recovery-validate-managed.cjs pN` exige contrato, autoridad e historiales exactos antes de importar.
5. `node <harness>/gate3-recovery-database-drill-v6.cjs pN atomic-failure` ensaya un aborto intencional antesCOMMIT y exige igualdad completa con el estado inicial. Conserva y detiene ese destino.
6. En OTRO destino nuevo, `node <harness>/gate3-recovery-complete-run.cjs pM` prepara, restaura y verifica el alcance cerrado. Se detiene al primer fallo y conserva volúmenes/evidencia. No reejecutar una fase ya enviada.

Las tablas se comparan mediante COPY por columnas explícitas, huellas exactas de filas y las35 cohortes antes de iniciar servicios. Las tres secuencias se aplican una sola vez y se leen inmediatamente. Ante pérdida de conexión/timeout, el recibo queda indeterminado: reconciliar mediante lectura y no repetir. Los bytes se reconstruyen usando los adaptadores FileBackend/TenantLocation de la imagen oficial fijada; no se cambia `storage.objects` ni se simula una subida de usuario. Se leen todos los bytes por el adaptador y HTTP privilegiado, incluyendo Range.

Ambos usuarios usan password → challenge → TOTP ORIGINAL, sin sustituir IDs/secretos ni regenerar factores. Las sesiones y sus cambios legítimos posteriores a login se distinguen de la igualdad del snapshot anterior al login. JWT/issuer y backend se reconstruyen para el entorno local; no se asegura portabilidad de tokens alojados, raíces Vault/pgsodium no capturadas, SMTP/OAuth, gateway, Realtime, PITR o cluster físico.

## Límites y tratamiento de fallos

El baseline capturado está cerrado. HTTP403 clínico y ocultación de objetos Storage no prueban un contrato positivo para la propia clínica ni aislamiento selectivo de una aplicación abierta. Las comprobaciones ordinarias nunca usan service_role; la preparación/backup/lectura privilegiada de bytes se identifica aparte. No se abren permisos para conseguir PASS. Una continuación positiva requiere propuesta/autorización separada.

El RPO respecto al origen actual no se puede medir sin nueva evidencia autorizada. Fidelidad al snapshot se acredita por sus huellas, no por una captura histórica ni por el tiempo54.236s. El tiempo completo del perfil local incluye inicialización, restore y todas las verificaciones del alcance cerrado; es una medición de laboratorio, sin SLA/RPO/RTO operativos aprobados. El uso del adaptador oficial es específico de la versión fijada y no constituye garantía del proveedor para una restauración alojada.

ProducciónNO-GO; Gate3 sigueBLOCKED para adopción alojada/M7/apertura y para la historiaB. No acepta dockets ni firma actas.
