# Gate4 — recuperación operativa, 24oct2026 Ecuador

**Gate4 BLOCKED; trabajo independiente local PASS acotado. Producción NO-GO.** Base exacta 902999c6b7b7ee696982d87e8ce7f6e5087f75e2; rama codex/gate4-recovery-ops y worktree propio. No integra ramas ajenas ni altera la matriz global.

## Cobertura reutilizada

Se leyeron la sección vigente de PRODUCTION_ACCEPTANCE_2026-10-07.md y siete recibos concretos de recuperación; sus SHA256 están en reused-evidence.json. p8 sigue acreditando su snapshot sintético cerrado: 58 tablas, 3 secuencias, 35 cohortes, 27 invariantes cero, ambos TOTP originales y 53 bytes, 130.356s incluyendo todos los checks del alcance cerrado. Los fallos anteriores y volúmenes se preservan; p8, suites430 y restores no se repitieron.

La base 902999c conserva CI39987122895 FAILURE por Next/DOMPurify. La matriz registra al sucesor 5a7a24af57c645bfc1cf8c70594cc568e03a7176/CI40003941444, pero el coordinador no entregó candidato integrado final a este gate. No se adopta ese sucesor ni se hereda su CI/Preview. No se modifica el parche de seguridad, lockfile o workflows y no se lanza otra CI sobre el árbol vulnerable.

El checkout nativo inicial convirtió fuentes a CRLF y falló el manifiesto. Se recuperaron únicamente bytes Git exactos del SHA fijado en este worktree, sin editar contratos ni configuración Git compartida. Las 164 fuentes vuelven a coincidir. checkout-canonicalization.json conserva el fallo/corrección; el diff publicable solo incluye Gate4 y su exclusión privada.

## Huecos cerrados en este alcance

- Política propuesta ejecutable para evaluar cobertura, caducidad, métricas, candidato/CI/entorno y custodia. Cada bloqueo queda explícito y ningún resultado concede GO. No captura ni borra, envía, programa o sube.
- Plan conservador de retención ejecutado: ambas copias KEEP. Propuesta 7diarios/4semanales/3mensuales y mínimo2 independientes verificadas; sin decisión clínica/legal de conservación ni aprobación operativa.
- Copia NUEVA del ciphertext y de la clave a carpetas distintas ignoradas del worktree, ACL usuario/SYSTEM y sin enlaces/reparse. El origen conserva hashes y ACL. AES-GCM autentica antes de parsear; dump exacto490818bytes,35cohortes, configuración y contratos, payload de2factores originales y53bytes exactos comprobados. No se ejecutó login ni restore nuevo.
- Clave incorrecta, manipulación y truncación rechazadas en memoria. Un error del wrapper al escribir su primer recibo ACL se preservó como fallo; la copia no se reintentó y se verificó en lectura tras corregir CreateNew.
- Kit vigente02 sin backup, clave ni imágenes:176archivos, ZIP1063384bytes, SHA256fdb7546accd054f84abcf2512cf756464aca1878ba9949d492bde66e2f19c219. Kit01 se preserva como histórico anterior a los dos fixes de Luna. Extracción NUEVA, todas las huellas y las164fuentes del perfil PASS. Suplementa un checkout exacto; no es recuperación offline completa de la aplicación.
-15/15 regresiones propias PASS: aprobación ausente, SHA/CI distinto, RPO histórico, tiempo completo, retención/holds/claves y falso positivo selectivo. Los casos selectivos son entradas sintéticas del verificador, sin HTTP real. No se afirma un PASS positivo de aplicación.
- Escaneo acotado del kit02/recibos:197archivos sin valores privados conocidos ni patrones del escáner existente. No es auditoría de seguridad completa.

## Métricas y custodia

Verificación completa de custodia: inicio2026-10-24T06:45:06.0030856Z, último check/recibo ACL06:45:06.5745982Z; cronómetro0.567s. El alcance incluye guardas de worktree, ACL inicial/final, autenticación, huellas del dump y todos los bytes capturados, payloads originales y controles negativos. La duración de Node aislada se identifica aparte; ninguna es restore/RTO de producción.

p8 conserva130.356s como métrica histórica de laboratorio cerrado con imágenes en caché. **RPO del origen actual NOT VERIFIED**, sin lectura/captura nueva. Los objetivos propuestos son RPO24h/RTO4h y backup diario02:00Ecuador; no están aprobados y53bytes no dimensionan volumen real.

Custodia REAL: copias y kit en el mismo equipo, con clave lógicamente separada y ACL restringida. Custodia independiente/offsite y segundo operador/equipo **NOT VERIFIED**. Ningún upload ni transferencia. custody-request.json prepara las decisiones; el usuario indicó expresamente documentarlas como pendientes.

## Bloqueos y siguiente acción mínima

1. Coordinador: entregar SHA final completo, CI del mismo SHA y entorno/turno/contrato positivo exactos. El diseño local está en RUNBOOK.md y selectiveEvidence rechaza acceso cerrado para todos, autoridad privilegiada y bytes incorrectos. No se inicia aplicación ni se define/aplica apertura SQL sin ese contrato; no se amplían grants ni se habilita el broker desactivado para conseguir un PASS.
2. Responsable: aprobar o sustituir objetivos, retención, volumen y responsables de alerta/acuse. La evaluación BLOCKED de operational-decision.json es una decisión técnica sobre entradas, no aceptación humana.
3. Responsable: identificar y autorizar ubicación/custodio de copia, ubicación/custodio separado de clave y operador independiente. Acción mínima posterior: colocar/recuperar copia cifrada+kit y clave separada en destinos aprobados; otro operador debe recuperar desde otro equipo sin el chat ni la única copia del PC. Requiere comprobar originalMFA/config/todos los bytes/entrega privada y medir hasta el último check.
4. Recuperación completa de producción, volumen representativo, SMTP/OAuth/gateway/Realtime/raíces externas, controles positivos de aplicación y RPO actual siguen NOT VERIFIED. No se fabrican aprobaciones clínicas/legales.

Docker29.8.0/contextdesktop-linux/namedpipe local se verificaron;0contenedores en ejecución en ese momento.0stacks nuevos,0volúmenes mutados,0recursos facturables,0navegadores/accesos,0acciones alojadas. Producción/staging/test en cuarentena e invitación/destinatario de caducidad sin interacción.

El handoff y este informe solo existen en la rama propia. Publicarlos aquí no modifica la matriz del coordinador ni integra el trabajo. Única revisión Luna6: dos hallazgos acotados (no-store/Range y enlaces antecesores) corregidos por el principal;15regresiones y negativa real de junction PASS. No segunda auditoría ni aceptación humana; ver LUNA.md.
