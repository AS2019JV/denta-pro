# Gate4 — ejecutor M0 concreto, cierre25oct2026

**Ejecutor/cierre transitivo pinneados;15regresiones M0 locales PASS. Dry-run con dispatch read-only PASS, invariancia global PARTIAL. CI propia del ejecutor NOT VERIFIED; initialize NOT EXECUTED/NOT AUTHORIZED.**

## Qué está implementado

scripts/clinia-gate4-managed-m0.cjs y scripts/clinia-gate4-m0-custody.ps1 proporcionan el CLI real M0. El procedimiento y comando exacto están en docs/production/gate4-recovery-ops/managed-a9-2026-10-25/M0_EXECUTOR.md. No es solo una lista: incluye prepare/upDB/upAuthStorage/metadata/fallo con guardas ejecutables y journal previo al envío de cada fase.

Contrato4c8b61e0c2df354d58be32f8f3d583aba17c2b7d5979ebe55f9e9cb57c8e20d7 y Composefc56a725b7e325cfcffb3a60c3de333dbd8ea5de2f2512018b05206bc68d416e intactos. Sin cambios a guardas/expectativas/fuentes congeladas, app, dependencias o recursos globales. Firma/ACL existentes reutilizadas; nunca se invoca el flujo histórico de copia/restore.

Cierre transitivo de9fuentes/datos: executor-closure.json, SHA256768f85e9388a5657d7e55712f7aeadf157650ab4bc44cfe44f348015812a7b82.
Ejecutor SHA2565fafb08d8170c9e8dea3026423e47229f5cf460dce56ebbe5bdc1b9154680f13.
Auxiliar SHA256ac065e2de5ffa1bdf2a2b3872e25c2c5f7b8d0686cc81995ce35b81bdd8293ad.
El cierre enumera fuentes, contrato y Compose; no pretende incluir binarios nativos de Node/PowerShell/Git/Docker, cuyos requisitos se declaran aparte.

## Validación realizada

- TDDRED preservado por función faltante, host/limpieza y denegación de mutaciones en dry-run. GREEN final:15/15 casos NUEVOS de test/production/gate4-managed-m0.test.cjs. No son las15históricas de recovery-ops; no se repiten ni suman como prueba del RC.
- Sintaxis Node y parser PowerShellPASS.
- Guardas cubiertas: aprobación ausente/hash incorrecto, identidad ocupada, endpoint remoto, red solapada, MemAvailable insuficiente, puertos/imágenes/montajes/privilegios distintos, metadatos no vacíos, cleanup de identidad incorrecta y secuencia de fallo sin retry/fases posteriores.
- Dry-run final del cierre exacto: exit0,9comandos Docker explícitamente limitados a lectura/config --quiet; custodia AssertAbsent.0start managed/sonda/SQL/aplicación,0claves/carpeta privada/lease, destinoa9ausente.
- El código de initialize existe para revisión, pero NO se invocó ni se generaron datos privados o recursos. No hay sysid/health/version/vacío reales del target; los tests de esas guardas usan fixtures, nunca prueba Supabase.

## Discrepancia externa preservada

La primera aserción de inventario global falló por IDdebridge56ff560c7c0b→dcdb4278ba33. Una observación intermedia coincidió. La última comparación del ejecutor pinneado volvió a cambiar bridge:dcdb4278ba33→7b83c3a26c4a. Contenedores y volúmenes no cambian en esa comparación; no aparecea9. Los tres casos permanecen en sus recibos.

Causa NOT VERIFIED. Consulta única y acotada de eventos devolvió0eventos; no prueba causa ni ausencia de una acción externa. No se modifica Docker ni se atribuye el cambio al helper. Por tanto no se declara invariancia global PASS ni preparación de ejecución completa. release-checks.json conserva PARTIAL_EXTERNAL_INVENTORY_DRIFT, junto al PASS más estrecho de la rama de comandos read-only.

## CI y decisión antes de initialize

La CI40160132494/462delRC95b acredita la aplicación de ese SHA, no los nuevos archivos M0. No se hereda ni se presenta como CI del helper. Código M0 versionado en la rama propia; CI propia aún null. Se entregan artefactos por SHA/hash para que el coordinador fije el sucesor/base y ejecute CI del SHA que contenga el helper. No se lanza CI repetida del árbol histórico ni se fusiona trabajo ajeno.

Antes de proponer initialize: sucesor ejecutor inmutable y CI propia, disposición técnica de la variación observada/entorno, contrato/turno M0 exactos y aprobación humana real. Los flags/reference son solo una vinculación a aprobación externa, no permiso. Ningún mensaje o archivo de coordinación autoriza el inicio.

No M7/baseline/seed/upgrade/open/restore, appSQL o PostgREST; no permisos ampliados ni ledger. Custodia/offsite/objetivos siguen pendientes por separado. Producción NO-GO; sin RTO/RPO nuevo. P8, copia y15pruebas históricas sin repetir; sin otra Luna/auditoría.
