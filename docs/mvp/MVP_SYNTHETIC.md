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
- Registro autónomo de odontólogos desde `/signup`, con aviso de evaluación y pacientes ficticios. Reutiliza validación, presupuesto durable de correo, Auth sin confirmar, intención privada y completion canónico; no usa metadata del cliente como autoridad. Confirmación de correo y MFA preceden al acceso clínico. Google continúa fuera del piloto.
- Login permite crear cuenta sin invitación. El formulario conserva entradas ante error, evita envíos simultáneos y sólo avanza tras respuesta afirmativa del servidor. La respuesta a cuentas ya existentes es genérica y no se exponen errores internos del proveedor ni el directorio de clínicas.
- Documentos, imágenes privadas, PDF/recetas, pagos, finanzas, reportes, marketing, mensajería y configuración fuera del recorrido. Middleware, acciones/handlers afectados y publicación PDF deniegan antes de efectos; los consumidores excluidos se desmontan o deshabilitan.

## Configuración de despliegue propuesta, todavía sin aplicar

Usar Preview exclusivo de esta rama, con los mismos nombres de variables existentes. No copiar `.env` ni secretos entre worktrees.

| Variable | Contrato |
|---|---|
| `NEXT_PUBLIC_CLINIA_PILOT_MODE` | `synthetic`; única bandera nueva, pública y sin secretos |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fbtlldubzomocuhpvweg.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Referencia privada a la clave pública vigente del mismo proyecto; nunca una credencial privilegiada |
| `NEXT_PUBLIC_APP_URL` | Origen HTTPS exacto del Preview aprobado y de los redirects Auth |

La validación rechaza modo desconocido, destino distinto de clinia-test y `VERCEL_ENV=production` en modo sintético. La rama `codex/clinia-mvp-synthetic` rechaza despliegue Vercel sin modo sintético. Una futura alternativa de proyecto requiere revisión explícita de esa vinculación. La bandera controla capacidades; no concede autoridad de DB ni sustituye RLS. Se debe verificar que bundle cliente y servidor usan el mismo modo en el deployment definitivo.

El push de esta rama ejecuta CI con tipos, lint, contratos y compilación sintética. Se conserva `vercel.json` congelado por el paquete histórico de recuperación; no se cambian sus pins para obtener PASS. Vercel puede intentar construir la rama al publicarla: la guarda de configuración rechaza la rama sin modo sintético y rechaza cualquier otro backend. La publicación de código no acredita apertura del producto. Configurar el modo y habilitar el Preview únicamente después de verificar valores exclusivos de esta rama y compatibilidad/permisos del backend. No reutilizar secretos de otras ramas o Production. Además de las variables públicas, registro requiere referencias privadas vigentes de `SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_ABUSE_HASH_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CLINIA_EMAIL_ENABLED=1` y SMTP Auth/redirects correctos para reenvío y recuperación. No incluir sus valores en evidencia.

No se han aplicado cambios de configuración Vercel, Auth, permisos, roles, DDL ni reapertura de esquema. El usuario informó reactivación de clinia-test; la lectura Management está saneada en `evidence/project-metadata-20261031.json`. Encender el proyecto no acredita retirar su cuarentena.

## Comprobación reproducible

1. Instalar el lockfile: `npm ci --ignore-scripts --no-audit --no-fund`.
2. Crear snapshot real: `node scripts/clinia-release-snapshot.cjs <id-unico>`.
3. Instalar las mismas dependencias en ese snapshot o vincular sólo el node_modules del mismo candidato/lockfile, sin `.env` ni custodia.
4. Desde el snapshot: `node scripts/clinia-pilot-verify.cjs`.

El ejecutor reutiliza tipos, lint y suite del verificador RC5 congelado; compila después con modo sintético y el proveedor offline fijo. Mantiene guardas de red, sentinel de credencial cliente y trazado de plantilla Auth. No modifica pins del paquete de recuperación histórico ni requiere secretos reales. Resultados y huellas del snapshot se entregan separados del código; no equivalen a CI alojada.

El recibo anterior `5a81247` conserva comprobaciones de la versión por invitación; no acredita este registro público. La nueva revisión requiere `/signup` disponible, avisos visibles y navegación login/registro en portátil y móvil. El proveedor offline no permite acreditar entrega de correo, login, persistencia ni RLS alojados.

En Windows, conservar bytes Git originales para artefactos congelados. Los cambios de finales de línea del checkout no justifican cambiar sus hashes, manifiestos ni expectativas. No hacer stage global del checkout compartido.

## Barreras antes de acceso externo

1. El coordinador entrega y obtiene autorización del paquete exacto para inspección/compatibilidad/apertura mínima de clinia-test. No reutilizar 50-open ni M7 históricos por inferencia. Conservar los fixtures, la cuarentena y la evidencia de recuperación válida.
2. Verificar que registro directo en Auth sin intención no concede clínica/rol; conservar las denegaciones de tablas/RPC/Storage excluidas. Los bloqueos de Next no impiden por sí solos llamadas directas a Supabase. El registro propio usa el servidor; no requiere habilitar indiscriminadamente Auth signup.
3. Probar dos registros autónomos y clínicas independientes con correo confirmado, MFA, recuperación y revocación. El contrato RC5 crea trial de 14 días: antes de ofrecer evaluación sin vencimiento comercial, aplicar el cambio revisado sólo en clinia-test dentro del enrollment canónico, con `subscription_status=active`, `trial_ends_at=NULL`, `bypass_subscription=false`. Sin bypass global, escrituras de entitlement por clientes, tablas ni RPC paralelas. Este ajuste DB sigue pendiente; la UI no lo acredita.
4. Ejecutar CI del SHA final y desplegar ese mismo SHA en Preview con configuración vinculada. No heredar 526/526 ni Ready de RC5 para este sucesor.
5. Probar pacientes/citas/HCU/odontograma/evolución con recarga y nueva sesión, errores de red, roles y dos clínicas. Completar teclado/tablet/móvil y navegación con borradores sobre el candidato alojado.
6. Comprobar monitor/aviso/acuse, suspensión y recuperación mínima del piloto; obtener aceptación de apertura sintética del propietario.

El expediente de reutilización se mantiene con el coordinador en `docs/production/mvp/2026-10-30-clinia-test-reuse/`. Este documento no edita ni sustituye su matriz global.

## Uso previsto y límites

Por instrucción del propietario, el registro es público y autónomo; se retira la entrega de invitaciones privadas y el límite funcional de tres cuentas. Cada odontólogo confirma su correo, completa MFA y obtiene su propia clínica sintética mediante el contrato canónico. El correo acredita control del buzón, no habilitación profesional. No introducir datos de pacientes reales en la prueba ni en comentarios. Se conservan cinco tareas y acceso revocable; no ofrecer duración indefinida hasta resolver el entitlement DB indicado arriba.

Estado de apertura sintética: pendiente de barreras alojadas y aceptación del propietario. Estado clínico real: NO-GO. La evaluación sintética no acredita aceptación clínica, privacidad, recuperación integral, RPO/RTO ni producción.

Presupuesto: el usuario informó 27 % de cuota semanal disponible al inicio de implementación; objetivo de consumo 15–20 puntos semanales. Sin telemetría de cuenta no se calcula gasto a partir de mensajes ni se garantiza encaje. No se han creado recursos de pago ni comprado servicios.
