# 01A — API del contrato SQL integrado

**PARCIAL / NO-GO clínico.** Destinos sintéticos secundarios del attempt3. La instalación limpia completa y la paridad remota mantienen gates separados.

## Cinco preguntas y aceptación antes de ejecutar

| Pregunta | Contrato |
| --- | --- |
| Por qué existe | Probar que el contrato SQL con informes funciona mediante Auth/PostgREST/Storage reales |
| Qué debe ocurrir | Servicios oficiales dedicados apuntan al clon exacto; login real produce JWT; operaciones permitidas funcionan y negativos fallan |
| Qué no debe ocurrir | Alterar primaria/producción, reutilizar claves o bytes primarios, publicar fuera de loopback, enviar correo/mensajes, resetear o borrar datos |
| Cómo verificar | Destinos/configuración y migraciones antes/después; JWT de roles ordinarios; permisos/datos/Storage positivos y negativos; comparación de contratos |
| Cómo deshacer | Detener únicamente los servicios del clon; conservar bases, archivos privados, evidencia y volumen; contener un fallo antes de promover |

## Diseño y límites

`scripts/clinia-contract-api.cjs` admite solo los dos destinos exactos del attempt3. Inspecciona Desktop, named pipe y servicios primarios antes de operar. Crea tres servicios por variante, desde image IDs existentes, sin pulls ni servicio DB. Claves propias; SMTP loopback sin entrega y signup público desactivado; publicaciones127.0.0.1; Storage en volumen nuevo propio. Solo una variante corre a la vez, con límite agregado de memoria de1GiB.

Las conexiones usan los roles de servicio existentes y conceden CONNECT únicamente en la base sintética designada. No cambian contraseñas ni atributos globales. PostgREST desactiva DB_CONFIG para no heredar JWT/configuración del cluster. Archivos de Compose/claves y diagnósticos con credenciales permanecen en `.temp` ignorado.

El cluster/roles/red Docker se comparten: esto separa destinos/API/bytes, **no proporciona contención física ante un servicio comprometido**. Las URLs directas sirven para pruebas API; no sustituyen navegador ni gateway/despliegue. La fuente ya contenía M7: no afirmar instalación completa desde cero ni upgrade remoto.

Antes de crear actores se compararán versiones de migración administradas Auth/Storage. Si los servicios migran inesperadamente, detener el candidato y revisar, conservando el clon. No ocultar ese cambio con un rollback automático.

## Operación

```powershell
node scripts/clinia-contract-api.cjs prepare stage
node scripts/clinia-contract-api.cjs start stage
node scripts/clinia-contract-api.cjs inspect stage
node scripts/clinia-contract-api.cjs stop stage
```

`prepare` exige archivos/servicios/volumen nuevos. `start` permite un runtime preparado y verifica que el otro esté detenido. `stop` conserva el volumen y no afecta la app3400. Repetir para `prod` solo después de detener `stage`.

Auth/REST/Storage de stage:56331/56332/56333; prod:56341/56342/56343. Son endpoints locales sintéticos. No usar estos archivos con proyectos remotos, CLI db push ni deploy.

## Evidencia

El primer arranque stage obtuvo Auth y PostgREST saludables; Storage no abrió el puerto antes del límite de salud. El launcher detuvo los tres servicios y preservó base/volumen. Probes: conexión rechazada en5000; logs Storage vacíos; `OOMKilled=false`. El exit137 posterior es compatible con la parada forzada tras no completar shutdown en10s; **no prueba OOM ni una causa concreta de código**. [Resultado y diagnóstico redactado](evidence/2026-09-28-contract-api/preflight-1/execution.json) se conservan; originales con posibles credenciales solo en `.temp` privado.

Una lectura autorizada del host encontró8072628KiB de memoria total y220596KiB disponibles (unos215MiB). Es un factor de recursos observado, no demostración de la causa de toda la lentitud ni una medición de producción. Se pidió liberar memoria antes de repetir el arranque.

Después de detener el candidato, la app existente respondió `/login` con HTTP200 en969ms ([comprobación](evidence/2026-09-28-contract-api/preflight-1/primary-availability.json)). Es una petición de disponibilidad, no un benchmark ni aceptación de rendimiento.

La revisión independiente detectó y corrigió antes de la prueba: mensajes de mismatch que podían imprimir claves; falta de gate de salud/HTTP y stop ante arranque parcial; y rol SQL de seed incompatible con los guards (`postgres` real requerido). No se relajaron controles de autoridad.

`scripts/verify-clinia-contract-api.cjs` prepara actores inventados mediante Auth real y obtiene JWT por password login. Prepara dos clínicas por variante y comprueba demografía, informes con seis estados, agenda, límites clínicos/financieros, bytes Storage, revocación de membresía e historial/migraciones conservados. `finally` detiene solo el candidato. **Aún no ejecutado**; sintaxis/revisión no acreditan sus resultados.

Para continuar cuando los servicios estén saludables:

```powershell
node scripts/verify-clinia-contract-api.cjs stage 1
```

Cada intento exige evidencia y archivo privado de actores nuevos. Un fallo conserva todo; no se sobrescribe para repetir ni se mezclan fixtures de diferentes intentos como si fueran un único pase.

Los hashes de los dos scripts están en el preflight. `node --check` pasó para ambos. `git diff --check` sobre configuración modificada por PREP pasó; el check global detecta whitespace anterior en componentes ajenos y se mantiene como pendiente, sin modificar esos archivos para este encargo.

## Handoff

```text
ENCARGO: 01A
COMMIT / ENTORNO: f96fbb8 + delta documentado / clones locales attempt3
ESTADO: PARCIAL
CAMBIOS: RPC de informes integrada; launcher y verificador API separados
PRUEBAS Y EVIDENCIA: SQL22pasos/7checks/cero diferencias; startup API fallido y detenido; sintaxis/revisión aprobadas
RIESGOS: API matriz no ejecutada; memoria host baja; clean/full upgrade y remoto pendientes
REVERSIÓN: stop del candidato; conservar DB, claves privadas, volumen y evidencia
REQUISITOS SIGUIENTES: recursos para repetir salud/API, dump de esquema para01B
```

## Referencias verificadas

[PostgREST DB config](https://docs.postgrest.org/en/v12/references/configuration.html#db-config), [Storage](https://supabase.com/docs/guides/self-hosting/storage/config), [configuración Supabase](https://github.com/supabase/supabase/blob/master/docker/CONFIG.md). El runtime actual inspeccionado prevalece para imágenes/variables de su versión.
