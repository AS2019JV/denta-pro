# Revisión independiente Luna6 — delta final de caducidad

Revisor: /root/clinical_expiry_luna6 (mismo revisor del checkpoint; solo lectura de evidencia y contratos, sin repetir pruebas ni leer archivos privados).

Veredicto: VERIFIED para el rechazo runtime de esta invitación vencida. Los artefactos enlazan el mismo JWT y SID; la sesión ordinaria pasa ambos probes; el snapshot inmediato confirma la invitación vencida y pending, el token coincidente, precondiciones válidas y los tres guards. El único POST ocurrió 3798 ms después del snapshot y devolvió 403 / 42501 / Invitation denied, sin reintentos ni refresh. El snapshot independiente posterior conserva el estado de la invitación, el digest y los guards, sin membresías nuevas.

El token coincide con el original y no se abrió el enlace. La limpieza local informa todos los archivos privados enumerados ausentes y no afirma logout global.

Esto verifica solo el caso negativo de caducidad. Step2 sigue PARTIAL y Producción NO-GO; clínica120 y global1000 quedan fuera del alcance.


Suplemento revisado por el mismo Luna6: token-shape-supplement.json confirma longitud56 dentro de1–512 y una única fila coincidente, con mismo digest/pending/expiry. Mantiene VERIFIED; no se repitió el POST. Cierre de incógnito/clipboard atribuido a confirmación humana, sin afirmar logout global.
