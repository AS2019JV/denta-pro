# Contrato operativo convergente — ensayo local

**CONVERGENCIA SQL ACOTADA VERIFICADA / NO DESPLEGABLE.** Solo Supabase local `clinia-acceptance`; capturas no son dumps remotos. No aplicar a proyectos remotos ni volver a ejecutar sobre fixtures existentes.

## Cinco preguntas y aceptación

- **Por qué:** staging y producción capturados contienen contratos distintos y callbacks históricos con autoridad incoherente.
- **Qué debe ocurrir:** después de M7, restricciones, columnas operativas, permisos, políticas y callbacks activos convergen. Datos sintéticos y valores financieros históricos permanecen idénticos. El SQL aborta ante duplicados, valores inválidos o drift no revisado.
- **Qué no debe ocurrir:** copiar pacientes, redondear finanzas, resetear staging/local ocupado, restaurar permisos antiguos o proclamar paridad remota completa.
- **Cómo verificar:** clonar las dos bases scoped en destinos nuevos; aplicar propuestas y forward02; comparar contratos reales, probar invariantes SQL y contención transaccional. Probar JWT/API por separado en la primaria; las secundarias no tienen endpoints independientes.
- **Cómo deshacer:** fallo antes de commit revierte esa transacción. Conservar los destinos del ensayo y detener el acceso del componente afectado; no borrar volúmenes ni reabrir grants históricos.

## Secuencia

1. `node scripts/generate-clinia-operational-convergence.cjs`: generación offline, manifiesto/hashes y objetos exactos; revisar antes de ejecutar.
2. `before-authority.sql`: constraints operativos ausentes, FK con borrado restrictivo cuando las capturas difieren, longitud de `clinics.size`, propiedad de secuencia e índices operativos. Validación nunca borra ni normaliza filas.
3. Forward02 original y propietario M7 revisado; buckets de las secundarias son fixtures de configuración, no aceptación de Storage API.
4. `after-authority.sql`: guards y auditoría canónicos, sin fallback de propietario ni GUC editable para autoridad. Conserva M7 y audita únicamente valores de autoridad/campos cambiados, sin contacto personal.
5. Migración de agenda local existente; no repetirla en la primaria donde ya está instalada.
6. Con `--include-reports`, instalar la RPC de informes y verificar con `final-contract/verify.sql`, que incorpora únicamente su firma exacta a la allowlist. El verificador02 histórico queda intacto.
7. Comparación explícita del contrato resultante, conservación de datos/finanzas, negativos y contención.

Las divergencias cerradas de `payments.amount`, `services.price`, vistas y rutinas históricas se registran individualmente con hashes. No se estrechan typmods financieros. No se ha aprobado custodia/retención, habilitación profesional, Auth remoto ni recuperación.

## Ensayo ejecutado del 28-09-2026

`node scripts/verify-clinia-operational-convergence.cjs 2` terminó exit0. [Ejecución](../../evidence/2026-09-28-convergence/attempt-2/execution.json): `SCOPED_SQL_CONVERGENCE_VERIFIED_API_PENDING`, 22 pasos y siete comprobaciones de reporte aprobadas. Destinos nuevos conservados: `clinia_contract_stage_20260928_2` y `clinia_contract_prod_20260928_2`.

Los contratos de las 17 tablas operativas, restricciones, índices, callbacks activos, políticas, grants de funciones, límites de esquemas, privilegios por defecto, secuencia y cuatro buckets necesarios coinciden. Se preservaron filas completas de pacientes/tratamientos y valores históricos. Siete invariantes SQL por destino y un ensayo de contención con rollback comprobaron restricciones y conservación; **son pruebas SQL, no JWT/API**. Las bases origen ya contenían M7: esto no demuestra instalación limpia del contrato remoto completo.

El intento1 conserva el fallo inicial y el resultado anterior a ampliar la aceptación de esquemas/privilegios por defecto. El intento2 es la evidencia vigente para este alcance. El generador es offline; el runner exige destinos nuevos, verifica hashes/estado al continuar y distingue lecturas de commits. No borrar evidencia para repetir.

## Cadena integrada con informes — attempt3

`node scripts/verify-clinia-operational-convergence.cjs 3 --include-reports` terminó exit0. [Ejecución](../../evidence/2026-09-28-convergence/attempt-3/execution.json):22pasos y7checks aprobados. Destinos nuevos `clinia_contract_stage_20260928_3` / `clinia_contract_prod_20260928_3`; la primaria/API activa no se cambió.

La RPC de informes `20260928190221_operational_reports.sql` está incorporada en ambos contratos y en la allowlist final exacta. Hash de ambos contratos: `f72556cdc1ce9b2f2163ed959fe8cdb0b3f9b7fc1fce6b1fb4e792ef7785005a`; [cero diferencias](../../evidence/2026-09-28-convergence/attempt-3/contract-comparison.json). Se repiten invariantes y contención solo porque cambió la cadena; los intentos anteriores permanecen como evidencia de sus versiones.

El runner impide sobrescribir un intento, comprueba modo y hashes para una continuación revisada y exige destinos nuevos. No repetir attempt3 ni resetear bases para convertir un resultado en aprobado.

Esto cierra la incorporación SQL de informes, **no la instalación Supabase limpia ni el upgrade remoto completo ni la API de las secundarias**. Ni la configuración completa de Auth, ni los bytes de Storage, ni la paridad remota se acreditan aquí. La recepción del dump de esquema ofrecido por el usuario habilitará la comparación01B.
