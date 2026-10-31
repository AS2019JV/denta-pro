# Clinia+ — entrega de producto para evaluación sintética

Fecha: 31 de octubre de 2026, America/Guayaquil.
Base: RC5 `ba47f5273fef85fca1cf92784c8ff8c7b50faf54`.
Rama: `codex/clinia-mvp-synthetic`.

## Comportamiento implementado

- Historia médica derivada de la última HCU persistida, filtrada por clínica/paciente y borrado lógico. Sin alergias, notas, tratamientos ni autores precargados.
- Una sola ruta de escritura clínica: HCU-033 y su trigger canónico de resumen. Se retira el escritor alternativo del odontograma.
- Guardado sin doble envío simultáneo; borrador conservado ante respuesta incierta y sin repetir automáticamente la escritura. La confirmación sólo aparece tras respuesta satisfactoria.
- Aviso de cambios pendientes en enlaces, navegación programática, cierre/recarga y recorrido del historial. En el piloto, la edición requiere un navegador con historial indexado; el aviso explica actualizar el navegador si falta esa capacidad. Las regresiones son locales; falta comprobar Atrás/Adelante con una sesión alojada ordinaria.
- Lectura de autoría desde metadatos de la fila; los nombres de sesión escritos manualmente no acreditan autoría. Fechas nuevas de ficha y sesiones en America/Guayaquil.
- Bienvenida con cinco tareas y comentarios por el canal privado del propietario. El texto copiado excluye identificadores y parámetros.
- Modo sintético con entrada por invitación, sin Google ni registro público en la interfaz. Registro bloqueado también en Server Action y helper compartido usado por callbacks; invitación y recuperación se conservan.
- Documentos, imágenes privadas, PDF/recetas, pagos, finanzas, reportes, marketing, mensajería y configuración fuera del recorrido. Middleware, acciones/handlers afectados y publicación PDF deniegan antes de efectos; los consumidores excluidos se desmontan o deshabilitan.

## Configuración de despliegue propuesta, todavía sin aplicar

Usar Preview exclusivo de esta rama, con los mismos nombres de variables existentes. No copiar `.env` ni secretos entre worktrees.

| Variable | Contrato |
|---|---|
| `NEXT_PUBLIC_CLINIA_PILOT_MODE` | `synthetic`; única bandera nueva, pública y sin secretos |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fbtlldubzomocuhpvweg.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Referencia privada a la clave pública vigente del mismo proyecto; nunca una credencial privilegiada |
| `NEXT_PUBLIC_APP_URL` | Origen HTTPS exacto del Preview aprobado y de los redirects Auth |

La validación rechaza modo desconocido, destino distinto de clinia-test y `VERCEL_ENV=production` en modo sintético. Una futura alternativa de proyecto requiere revisión explícita de esa vinculación. La bandera controla capacidades; no concede autoridad de DB ni sustituye RLS. Se debe verificar que bundle cliente y servidor usan el mismo modo en el deployment definitivo.

No se han aplicado cambios de configuración Vercel, Auth, permisos, roles, DDL ni reapertura de esquema. El usuario informó reactivación de clinia-test; la lectura Management está saneada en `evidence/project-metadata-20261031.json`. Encender el proyecto no acredita retirar su cuarentena.

## Comprobación reproducible

1. Instalar el lockfile: `npm ci --ignore-scripts --no-audit --no-fund`.
2. Crear snapshot real: `node scripts/clinia-release-snapshot.cjs <id-unico>`.
3. Instalar las mismas dependencias en ese snapshot o vincular sólo el node_modules del mismo candidato/lockfile, sin `.env` ni custodia.
4. Desde el snapshot: `node scripts/clinia-pilot-verify.cjs`.

El ejecutor reutiliza tipos, lint y suite del verificador RC5 congelado; compila después con modo sintético y el proveedor offline fijo. Mantiene guardas de red, sentinel de credencial cliente y trazado de plantilla Auth. No modifica pins del paquete de recuperación histórico ni requiere secretos reales. Resultados y huellas del snapshot se entregan separados del código; no equivalen a CI alojada.

La comprobación HTTP local observó `/login` 200, `/signup` 403/no-store, `/api/clinical-documents` 403/no-store y `/` 307 hacia login. La inspección visual local confirmó aviso/invitación y ausencia de Google/registro en portátil. No hubo login, escritura clínica ni prueba de RLS real mediante el navegador offline. La captura móvil se interrumpió y no acredita QA móvil.

En Windows, conservar bytes Git originales para artefactos congelados. Los cambios de finales de línea del checkout no justifican cambiar sus hashes, manifiestos ni expectativas. No hacer stage global del checkout compartido.

## Barreras antes de acceso externo

1. El coordinador entrega y obtiene autorización del paquete exacto para inspección/compatibilidad/apertura mínima de clinia-test. No reutilizar 50-open ni M7 históricos por inferencia. Conservar los fixtures, la cuarentena y la evidencia de recuperación válida.
2. Verificar cierre del registro directo en Auth y denegaciones de tablas/RPC/Storage excluidas para los evaluadores. Los bloqueos de Next no impiden por sí solos llamadas directas a Supabase.
3. Configurar tres evaluadores aprobados, una clínica sintética por evaluador, con custodia privada, MFA, recuperación y revocación comprobadas. Identidades y destinatarios aún no suministrados.
4. Ejecutar CI del SHA final y desplegar ese mismo SHA en Preview con configuración vinculada. No heredar 526/526 ni Ready de RC5 para este sucesor.
5. Probar pacientes/citas/HCU/odontograma/evolución con recarga y nueva sesión, errores de red, roles y dos clínicas. Completar teclado/tablet/móvil y navegación con borradores sobre el candidato alojado.
6. Comprobar monitor/aviso/acuse, suspensión y recuperación mínima del piloto; obtener aceptación de apertura sintética del propietario.

El expediente de reutilización se mantiene con el coordinador en `docs/production/mvp/2026-10-30-clinia-test-reuse/`. Este documento no edita ni sustituye su matriz global.

## Uso previsto y límites

Tres odontólogos inicialmente, acceso autónomo revocable sin plazo comercial de siete días, únicamente pacientes ficticios. Cada evaluador recibe por canal privado un acceso individual, cinco tareas y la instrucción de reportar dónde se detuvo, qué esperaba y qué impediría utilizar el producto. No introducir datos de pacientes reales en la prueba ni en comentarios.

Estado de apertura sintética: pendiente de barreras alojadas y aceptación del propietario. Estado clínico real: NO-GO. La evaluación sintética no acredita aceptación clínica, privacidad, recuperación integral, RPO/RTO ni producción.

Presupuesto: el usuario informó 27 % de cuota semanal disponible al inicio de implementación; objetivo de consumo 15–20 puntos semanales. Sin telemetría de cuenta no se calcula gasto a partir de mensajes ni se garantiza encaje. No se han creado recursos de pago ni comprado servicios.
