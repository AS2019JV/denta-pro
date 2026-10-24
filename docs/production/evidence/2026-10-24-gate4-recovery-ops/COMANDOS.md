# Comandos y resultados Gate4

Todos se ejecutaron en C:/Users/aleja/.codex/worktrees/clinia-gate4-recovery/denta-pro, salvo lecturas explícitas del paquete/recibos históricos en el checkout compartido. No hubo cambios en este último.

- create_worktree nativo: ref902999c6b7b7ee696982d87e8ce7f6e5087f75e2, nombreclinia-gate4-recovery. Completado y adjuntado al chat.
- git switch -c codex/gate4-recovery-ops dentro del worktree nuevo: PASS; HEAD exacto902999c.
- node scripts/clinia-recovery-package.cjs: FAIL inicial por CRLF. Recuperación por git show del blob exacto para cada fuente del manifiesto exclusivamente en este worktree; ninguna alteración semántica ni global de Git. Ver checkout-canonicalization.json. Verificación posterior PASS164.
- Docker por ruta absoluta: --version29.8.0, contextshowdesktop-linux, versiónServer29.8.0, contextinspectnamedpipe local. ps mostró0contenedores activos. No start/up/run/stop/volúmenes/redes Docker ejecutados por Gate4.
- node --test test/production/gate4-recovery-ops.test.cjs: PASS13/13. No suite430, npm install/build/audit/CI nuevos.
- pwsh -NoLogo -NoProfile -File scripts/clinia-gate4-custody.ps1 -Mode Prepare -Attempt custody-01 -ReceiptName local-copy.json -SourceArchive <archivo-sintético-original-local> -SourceKey <clave-original-local>: autenticación/copia PASS; escritura del primer recibo ACL FAIL por parámetroNoClobber inválido. Se conserva local-copy.json y se registra el fallo en execution-notes.json.
- Tras sustituir escritura por FileMode.CreateNew: -Mode Verify -Attempt custody-01 -ReceiptName local-reopen.json: PASS lectura, sin recopia ni restore.
- Tras incorporar medición completa: -Mode Verify -Attempt custody-01 -ReceiptName local-final-verification.json: PASS;0.567s todo el alcance local. Recibos de contenido/ACL/timing separados.
- Dos invocaciones negativas reales: Prepare sobre custody-01 existente y Verify con recibo existente, ambas exit1 esperado. Comparación de ciphertext, clave y recibo antes/después exacta; sin imprimir clave/hash de clave. Ver custody-no-overwrite-tests.json.
- Parser PowerShell de ambos scripts:0errores. Los scripts JS nuevos se ejecutaron a través de sus comandos pertinentes; no dependen de instalar paquetes.
- evaluate con policy.proposed.json y operational-input.json, usando UTC guardado en operational-decision.json: BLOCKED esperado. No autorización implícita ni GO.
- retention con local-catalog.json: PLAN_ONLY_NO_DELETION; ambas copiasKEEP.
- pwsh -NoLogo -NoProfile -File scripts/clinia-gate4-recovery-kit.ps1 -KitId kit-01: PASS176fuentes, ZIP/expand NUEVOS y hashes164pins.1062860bytes/SHA256 en kit-01.json. Ningún backup/clave/imágenes incluidos.
- Escáner acotado previo al ZIP:191archivos de kit/evidencia,0valores privados conocidos/patrones. No es auditoría completa.

Los parámetros privados se suministraron por rutas locales, nunca contraseñas/TOTP/JWT en argumentos o salida. Las pruebas de evaluación con entradas sintéticas no equivalen a HTTP desplegado. La lectura/autenticación local del archivo no revalida el origen alojado.

Delta tras la única revisión Luna6:
- Se corrigieron la aceptación selectiva no-store/Range y la comprobación de enlaces antecesores.
- Misma suite NUEVA de Gate4 repetida por ese diff:15/15PASS; tests-final.json. No se repitieron las430 históricas.
- Junction real en un antecesor de archivo sintético denegada; ruta ordinaria aceptada. kit-junction-negative.json.
- kit-02 nuevo:ZIP1063384bytes/SHA256fdb7546accd054f84abcf2512cf756464aca1878ba9949d492bde66e2f19c219,176fuentes; extracción/hash164pinsPASS. kit-01 conservado como histórico.
- Escáner acotado kit02/evidencia:197archivos,0hallazgos. Escáner Git-visible final registrado separadamente. Sin segunda auditoría.
