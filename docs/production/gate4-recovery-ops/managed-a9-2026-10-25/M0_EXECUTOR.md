# M0 — ejecutor concreto para revisión

Alcance exclusivo: inicialización vacía de DB/Auth/Storage en clinia-gate3-20261020-a9. El contrato4c8b61e0c2df354d58be32f8f3d583aba17c2b7d5979ebe55f9e9cb57c8e20d7 y Composefc56a725b7e325cfcffb3a60c3de333dbd8ea5de2f2512018b05206bc68d416e permanecen intactos. No M7, baseline, seed, upgrade, apertura, restore ni SQL de aplicación.

## CLI y cierre

Ejecutor: scripts/clinia-gate4-managed-m0.cjs.
Auxiliar Windows: scripts/clinia-gate4-m0-custody.ps1.
Fuentes y datos transitivos exactos: docs/production/evidence/2026-10-25-gate4-m0-harness/executor-closure.json.
Pruebas nuevas: test/production/gate4-managed-m0.test.cjs. Son distintas de las15históricas; no se repitieron estas últimas, p8 ni la copia.

Dry-run real:
    node scripts/clinia-gate4-managed-m0.cjs dry-run --receipt m0-dry-run-release.json

Cada recibo usa nombre NUEVO. El nombre anterior ya está ocupado y su rechazo es intencional. El dry-run bloquea cualquier comando Docker mutador, acepta solo inventario/config --quiet y custodia AssertAbsent. No despacha operaciones para crear privateDir, lease, claves, contenedores, redes, volúmenes o sonda. La igualdad global de inventarios no se presume: el último control quedó PARTIAL por cambio del ID de bridge, mientras a9 y su carpeta privada siguen ausentes. El recibo explicita que la admisión de memoria live sigue pendiente para initialize.

La ejecución siguiente NO se hizo y NO está aprobada. Solo puede plantearse tras CI propia del nuevo ejecutor y aprobación humana directa del alcance:
    $taskAuthorizationReference=Read-Host 'Referencia human: de la aprobación específica ya recibida'
    node scripts/clinia-gate4-managed-m0.cjs initialize --approved-contract-sha 4c8b61e0c2df354d58be32f8f3d583aba17c2b7d5979ebe55f9e9cb57c8e20d7 --authorization-ref $taskAuthorizationReference --receipt m0-initialize.json

Escribir una referencia o pasar flags NO concede autorización; solo vincula una invocación ya autorizada. Ningún JSON de coordinación ni la revisión mecánica de otro chat la sustituye. No se ha inventado referencia humana.

## Guardas efectivas del código

1. Hashes fijos de contrato/Compose, inicializador nativo, cuatro dependencias congeladas y primitivas de custodia; rechazo de links, host distinto de Windows/localnamedpipe, ubicación privada distinta del contrato y rama distinta de Gate4.
2. Ausencia exacta de identidades en contenedores/volúmenes/red;0running ajenos; subred sin solapamientos de Docker/rutas específicas. No cierra ni revoca recursos ajenos.
3. Solo initialize autorizado realiza sonda de MemAvailable efímera/read-only/network-none, con paths de volúmenes de imagen en tmpfs. Umbral704MiB actual; memoria total no basta. No pull ni ajuste global.
4. Carpeta managed-a9 creada atómicamente, herencia de DACL protegida usuario/SYSTEM desde el padre ya validado y sin secretos antes de esa verificación. Primitivas de validación reutilizadas del script de custodia existente, sin ejecutarle su flujo de copia histórica.
5. Lease nuevo por wx; material nuevo de signingMaterial existente. Escrituras exclusivas de credentials/pgsodium/compose; ningún archivo histórico leído/copied. Directorio existente, incluso parcial, bloquea todo intento siguiente.
6. Una sola llamada a up de DB y otra a Auth/Storage con --no-deps, --pull never y wait acotado. No loop/retry ni PostgREST.
7. Verificación efectiva de imágenes, labels, red, montajes, RW, puertos vacíos, límites, OOM/health. SQL fijo BEGIN READ ONLY para versión170011/sysid REAL/rol/migracionesAuth82Storage74 y vacío. No parámetro SQL arbitrario ni suplantación de guarda alojada.
8. Recibos antes de fases con resultado inicialmente indeterminado; último check y tiempo soloM0. Nunca RTO operacional/RPO. No se inventa sysid ni se sustituye una expectativa por resultado.
9. Si falla tras envío de start, limpieza solo de IDs cuyos nombres/imágenes/labels prueban propiedad. Comprobación de parada; error de transporte queda como limpieza no acreditada, no como ausencia. No rm/down/volúmenes borrados. Objetivo, lease, claves y diagnósticos privados preservados; no nuevo intento ni aplicación.
10. Fallo de preparación no intenta start/stop de otros. El recibo conserva fase fallida, archivos privados presentes sin sus valores y acción de reconciliación sin replay.

Al completar M0, Gate4 conserva el lease en espera de otro alcance. No transfiere a Gate3 permiso de escribir appSQL. PostgREST64MiB sigue como fase posterior independiente, con umbral768MiB y contrato JWT ordinario propio.

## Evidencia y límites

La suite M0 y sintaxis verifican el nuevo código; dry-run verifica su rama read-only. No prueban la inicialización real ni su salud/versión/sysid/emptiness, que siguen NOT EXECUTED.

La primera comparación externa observó cambio de ID de bridge y se preserva como FAIL de esa aserción global; causa NOT VERIFIED,0eventos en consulta acotada no acreditan causa. Los recibos posteriores distinguen guardas de dispatch, inventarios puntuales y ausencia del destino; no se modifica Docker para ocultar el caso ni se promete estabilidad continua.

## CI/identidad que falta

La CI462 del RC95b pertenece a la aplicación anterior; NO prueba este ejecutor nuevo. El cierre transitivo queda pinneado y el código versionado en la rama exclusiva Gate4. No se lanza CI redundante sobre el árbol histórico ni se fusiona trabajo ajeno.

Antes de proponer initialize, el coordinador debe fijar el sucesor/base de integración del ejecutor, conservar estos blobs o revisar cualquier delta y obtener CI propia del SHA que los contiene. CI del ejecutor: NOT VERIFIED. No se acepta una excepción de riesgo ni se hereda el éxito de95b. Tampoco se relajan las guardas de ruta/contrato para ejecutar desde otro checkout.
