# Gate7 — preparación de recorridos y aceptación humana

24 octubre 2026, America/Guayaquil. Preparación documental completada; recorridos finales **NOT VERIFIED**. Producción **NO-GO**.

El usuario confirmó que no dispone del handoff del candidato final y pidió documentarlo como pendiente. No se espera haciendo polling. No hubo navegador, acceso alojado, Docker, despliegue, restore, correo, consultas de pacientes, cambios de acceso, DDL, RLS, MFA ni reparación de ledger.

## Identidad

- Base de preparación inmutable: `902999c6b7b7ee696982d87e8ce7f6e5087f75e2`.
- Rama exclusiva: `codex/gate7-clinical-acceptance`, worktree propio creado y registrado con herramienta nativa. No se alteró el checkout compartido.
- Base: 430 pruebas locales históricas PASS; CI `39987122895` FAIL por dependencias. **No es candidata verde**. No se repite esa CI ni se duplica el parche de seguridad.
- La sección vigente documenta sucesor `5a7a24af57c645bfc1cf8c70594cc568e03a7176`, CI `40003941444` SUCCESS 433/433 y deployment `DSCZLhuZTEpkMK34H4Y5uocJaUmp`. Se releyeron recibos y se confirmó en GitHub el job offline-contracts SUCCESS y el estado Vercel success. No equivale a asignación de candidato final ni autorización alojada.
- Preview/entorno: identidad por recibo del 23 octubre; **no revalidada en vivo**. No se publican URLs protegidas ni se usa un alias móvil como identidad.
- Pendientes: designación de SHA final/base de integración por coordinador, turno de navegador, clínica exclusiva, actores elegibles y destino de custodia autorizados.

## Flujos

| Flujo | Evidencia histórica reutilizada | Gate7 final |
|---|---|---|
| Paciente guardado/reabierto | PASS acotado: alta/edición en 8590022f9db7bf676e68536267086f6f8739176c, lectura en 5a7a24af57c645bfc1cf8c70594cc568e03a7176; no es alta nueva en 5a7 | NOT VERIFIED |
| HCU guardada/reabierta, autor/fecha/ID | Denegación de exportación no guardada en b7a0f2fff972b0b71dc7ad5664a4dc2b13d0bf2d y contratos locales existentes; sin recibo completo de HCU final guardada | NOT VERIFIED |
| Odontograma FDI/CPO-ceo | Función presente en código; declaraciones del UAT histórico sin recibo suficiente para aceptación final | NOT VERIFIED |
| Cita crear/editar/recargar | PASS en 5a7 con actor sintético; sin aceptación de concurrencia o todos los roles | NOT VERIFIED |
| Receta/autoría/reimpresión | PASS técnico histórico b7: emisión browser/acción/fila, PDF 6587 bytes con ID/autor y reimpresión 6529 bytes; habilitación profesional no validada | NOT VERIFIED |
| Exportación PDF/JSON | Informe PDF en 5a7 PASS acotado, 10472 bytes/una página; JSON presente en código, excluye binarios y snapshot consistente | NOT VERIFIED |
| Archivo/custodia | Subida/listado/metadata PASS en 5a7; descarga propia FAIL por broker deshabilitado/vencido y credenciales ausentes, según recibo | NOT VERIFIED; FAIL histórico conservado |
| Menores/consentimiento/corrección | Campos/casillas, edición y solicitudes presentes; validez y resolución completa no demostradas | NOT VERIFIED / REQUIRES-HUMAN |
| Límites de rol | Negativos históricos específicos; no prueban API/bytes/roles finales completos | NOT VERIFIED |

No se ejecutaron nuevos recorridos de producto: no se inventan PASS/FAIL. El incidente de custodia privilegiada y la descarga privada histórica permanecen pendientes del responsable correspondiente; no se presume contención.

## Entrega y reutilización

[Matriz ejecutable](MATRIZ_RECORRIDOS.md), [demo cinco minutos](DEMO_5_MIN.md), [aceptación humana](ACEPTACION_HUMANA.md), [privacidad/LOPDP](PRIVACIDAD_LOPDP.md), [comandos](COMANDOS.md), evidencia saneada y un sobre no secreto `handoff.json` en `.release-snapshots/gate7-delivery-2026-10-24/`, fuera del commit para fijar su SHA real sin autorreferencia.

Los recibos siguen válidos como historial del SHA/entorno/actor/alcance originales. El diff 902→5a7 tiene siete archivos: dependencias, presentación de nacimiento, helper/regresión y documento de seguridad; no cambia SQL ni los consumidores HCU/receta/JSON revisados. La dependencia PDF sí cambia: no se transfiere automáticamente la prueba de bytes b7 a 5a7. No se repiten suites o restores por este delta documental. No hay correcciones nuevas de aplicación/SQL: no se reprodujo un defecto nuevo dentro del entorno autorizado.

`docs/security/CLINICAL_UAT_SPECIFICATION_AND_SIGN_OFF.md` contiene afirmaciones de firmas y PASS sin respaldo utilizable en estos recibos. No son aceptaciones verificadas ni se copian identidades, registros o firmas. La skill dental-clinical-standards se usa como guía; su referencia a branding público, firma o plazos genéricos no sustituye el modelo privado vigente ni revisión profesional.

La fase alojada requiere SHA verde final, CI ligada a él, deployment/entorno y alcance/turno explícitos, clínica y roles exclusivos, fixtures y destino seguro. No se reutilizan fixtures históricos ni los de otros gates. Cambios necesarios de schema/RLS/MFA/autoridad central se remiten primero al coordinador con reproducción saneada. Solo el coordinador integra y actualiza la matriz global. Esta entrega no concede GO, firma clínica ni conformidad legal.
