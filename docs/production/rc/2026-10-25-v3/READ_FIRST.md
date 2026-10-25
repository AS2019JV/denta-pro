# Clinia+ RC3 local — 25 octubre 2026

Sucesor local de 95b059bea1d985c48a62e81d7237be7dcc19b228. Integra exclusivamente 39 archivos nuevos del paquete managed-only/M0 de Gate4 (8a529dce16a4f06f5ab42baf218c376c29b3abaa); conserva sus bytes, cierre transitivo y restricciones de rama/ruta Windows. No modifica dependencias, workflows, rutas privadas, logger, SQL ni controles existentes.

El CLI no puede inicializar desde esta rama/ruta RC: exige el contexto original de Gate4. CI debe cubrir los mismos nueve archivos del cierre 768f85e9388a5657d7e55712f7aeadf157650ab4bc44cfe44f348015812a7b82 antes de proponer cualquier inicialización con autorización y turno propios. Los flags de aprobación son metadatos, no autoridad humana.

Los recibos originales son históricos: el último dry-run mantiene PARTIAL_EXTERNAL_INVENTORY_DRIFT por cambio del ID de bridge, causa NOT VERIFIED. No sustituirlo por la observación intermedia igual ni repetir ensayos para obtener PASS. Sin inicialización, secretos, lease, SQL, M7, apertura ni restore autorizados.

CI y Preview propios del sucesor pendientes. Los 462/462 y Ready de RC2 no se transfieren. El único RC_HANDOFF.json y las matrices vigentes permanecen fuera del commit en el workspace del integrador; las matrices del árbol son snapshots históricos. finalSHA null y Production NO-GO.
