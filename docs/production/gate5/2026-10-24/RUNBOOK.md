# Gate5: preparación del 24 octubre 2026

Gate completo **BLOCKED**; demostración alojada **NOT VERIFIED**. La matriz global queda intacta y solo la actualiza el coordinador.

Base exclusiva: `902999c6b7b7ee696982d87e8ce7f6e5087f75e2`. CI histórica `39987122895` FAILURE por dependencias; sus 430 pruebas locales no hacen verde esta base. La matriz compartida menciona `5a7a24af57c645bfc1cf8c70594cc568e03a7176`/CI `40003941444`, pero este chat no recibió del coordinador ese sucesor ni autorización para adoptarlo. No se cambian dependencias, workflows ni base. Se solicita su handoff para integrar/verificar después.

## Implementación y cobertura

- Se reutilizan `probeReadiness`, `/api/health`, `check-clinia-health.cjs` y sus pruebas. Sigue siendo application-auth: una consulta pública Auth, máximo 3 s/4096 bytes, sin service_role, consultas clínicas ni divulgación del proveedor. Un 200 no prueba DB, RLS, Storage, correo, MFA, navegador o aptitud clínica.
- `observeResponse` instrumenta health y las rutas de documentos/medios privados: evento fijo, UUID generado en servidor, operación fija, estado HTTP y duración. El UUID aparece en `X-Correlation-ID`. No consume headers de correlación entrantes, identidad, cuerpo, URL, query, cookies, JWT ni errores del proveedor.
- Los 4xx producen `security.request_rejected`: significa rechazo (incluye input/método/cuota), no atribuye intrusión. Los 5xx/excepciones producen `application.error`. La excepción conserva el contrato del framework; nuestro logger no copia mensaje/stack. Las otras rutas no obtienen correlación nueva.
- El logger conserva firma, severidad y utilidades de masking, pero descarta texto/payload legacy en todos los entornos; emite `application.legacy`. Es un cambio deliberado de diagnóstico: `Error.message`, nombres o PHI bajo claves desconocidas atraviesan el filtrado anterior por nombres. Quien necesite más contexto deberá migrar a un evento cerrado/revisado. No se afirma haber auditado todas las llamadas directas a `console` ni los logs propios del proveedor/framework.
- El fallo del sink no cambia respuestas ni autoridad. Bytes, headers de privacidad y verificaciones siguen en el handler original. No hay endpoint remoto de inyección de fallo.

## Monitor ejecutable, todavía inactivo

`scripts/gate5-monitor.cjs` consulta el health real y puede enviar POSTs reales a un receptor webhook autorizado. Es foreground, sin scheduler instalado. Las pruebas usan transportes sintéticos: no cuentan como alertas alojadas.

`monitor.example.json` conserva CI failure y campos pendientes; el validador lo rechaza. Copiar a `.gate5-private/monitor.json` y completar solo después del handoff verde y autorización humana específica. Este directorio está ignorado y pertenece al worktree. Ningún archivo de coordinación/configuración concede autorización por sí mismo.

Requiere full SHA, CI success del mismo SHA, deployment ID inmutable Ready/Preview, origen exacto (sin alias de rama), exclusividad, propietario nominal, proveedor, canal, destinatario confirmado y turno de hasta 4 h. En operación normal `originKind=immutable-deployment`. Para el ensayo de transición se admite `gate5-exclusive-alias` con `aliasAuthorizationRef` y aprobación humana concreta separada. Las referencias públicas son opacas, sin correos/URLs protegidas. Comparar con recibos actuales del coordinador/proveedor: el validador no consulta Vercel/GitHub ni prueba la veracidad de datos declarados. Journal y webhook identifican SHA/deployment como **expected** y `identity=configuration-only`; la identidad real de cada fase se acredita con el mapeo Vercel, no con el health ni la configuración.

Variables privadas del proceso, fuera de Git/argumentos: `GATE5_WEBHOOK_URL`, `GATE5_WEBHOOK_HOST` exacto aprobado; opcional `GATE5_PREVIEW_ACCESS` solo si ese mecanismo está autorizado para este deployment. El monitor no crea/revoca accesos ni usa credenciales Supabase; no reenvía acceso Preview al receptor. El receptor debe implementar el JSON del script y deduplicar `eventId`/`Idempotency-Key`. La compatibilidad/entrega con un proveedor concreto sigue pendiente; no se contrata ni envía nada aquí.

Comandos desde el worktree propio, únicamente durante un turno autorizado:

```powershell
node scripts/gate5-monitor.cjs validate .gate5-private/monitor.json
node scripts/gate5-monitor.cjs run-authorized .gate5-private/monitor.json
```

No se ejecutaron aquí. `validate` no activa el monitor; `run-authorized` inicia consultas/envíos. No ejecutar sobre la base vulnerable actual. El proceso termina al vencer el turno; renovarlo requiere autorización nueva. Para operación sostenida falta un host/supervisor existente y vigilancia de heartbeat (sin nuevos recursos facturables). Un proceso por estado; tras un crash retirar el lock manualmente solo al verificar que el proceso murió. Una pausa superior a dos intervalos registra `monitor.gap` y reinicia rachas, preservando incidentes/outbox.

Política propuesta, pendiente de aceptación:

| Señal | Umbral | Acción y recuperación | Propietario/destino |
|---|---|---|---|
| Readiness | Cada 60 s; timeout 5 s; 3 fallos seguidos | Incidente y aviso down; 2 éxitos seguidos generan recovered | owner/provider/channel/recipient pendientes |
| application.error | Propuesta: 5 eventos/5 min por deployment/operación | Revisar correlaciones; recuperar tras 5 min sin errores y health estable | Misma guardia; regla proveedor pendiente |
| security.request_rejected | Propuesta: 20 eventos/5 min por deployment/operación | Investigar sin identidad/payload; recuperar tras 5 min bajo umbral | Misma guardia; regla proveedor pendiente |

Solo readiness está implementado en el runner. Las otras reglas requieren destino autorizado de logs y configuración del proveedor; no hay log drain/alertas de logs activos. Retención/acceso requieren decisión del propietario; propuesta inicial de evidencia sintética privada: 14 días, sin eliminación automática ni aceptación legal inventada.

Con cadencia mantenida, objetivo propuesto de detección <=185 s desde el fallo y reconocimiento de recuperación <=125 s desde restauración. Entrega <=60 s tras detección y acuse <=5 min son objetivos pendientes, no mediciones/SLA ni garantías ante pausas/backlog/proveedor. El outbox persiste antes de enviar y reintenta por ciclo con el mismo eventId, sin prometer exactly-once. Un HTTP 2xx es **providerAccepted**, nunca entrega ni acuse humano. La lectura por agente tampoco es acuse.

## Ensayo alojado pendiente

1. Recibir candidato verde, CI y Ready/Preview ligados al SHA; verificar turno exclusivo, entorno aislado compatible, proveedor/canal/destinatario y operador humano. Material de acceso solo privado. No cambiar sesiones de actores ajenos.
2. Verificar health saludable/no-store antes; iniciar monitor autorizado y registrar latidos/activación real del canal. Guardar deployment/SHA y reloj UTC sincronizado en cada fase. El health histórico no sustituye este baseline.
3. Fallo reversible propuesto: nuevo deployment **solo del Preview exclusivo**, mismo código verde, con override de despliegue `CLINIA_HEALTH_ENABLED=0`. No cambiar variables de proyecto/ramas compartidas ni Supabase. Ese nuevo deployment requiere autorización concreta; no se ejecutó/programó. Antes del primer sample, autorizar alias exclusivo, configurar `originKind=gate5-exclusive-alias` y apuntarlo al deployment saludable. Registrar en Vercel mapeo exacto y hora de cada transición; mover solo ese alias al deployment con health deshabilitado. Un mismo proceso/origen observa sano→fallo→recuperado. SHA esperado en configuración no sustituye los deployments reales de cada fase.
4. Observar 503, tres fallos, incidente, aceptación y recibo real de entrega; obtener declaración directa del operador con hora/eventId. Medir desde inyección, detección, entrega y acuse. No rellenar con tiempos sintéticos.
5. Restaurar solo el alias exclusivo al deployment saludable original; observar dos muestras 200 y aviso recovered entregado. Guardar ambos mapeos y la identidad real de cada fase. El runner fija el origen por estado y no demuestra transición entre URLs distintas. No dejar fallo abierto al terminar el turno; retirar solo accesos propios autorizados.

La propuesta de fault/recovery requiere recibir ese alias **exclusivo y autorizado de Gate5**, separado del alias de rama, y registrar mapeos SHA/deployment reales en cada transición. El validador admite dominios vercel.app sin `-git-`; no detecta automáticamente un alias. Configuración y referencia de autorización no equivalen a aprobación ni prueba de identidad. Este punto sigue **BLOCKED** hasta recibir destino y turno; no se usa protección ni alias ajenos.

## Rollback de despliegue pendiente

Falta un **SHA verde anterior conocido y compatible con la DB del Preview**, su deployment Ready/CI y autorización del entorno/alias exclusivo. No se propone `902999c6...` como rollback seguro: tiene dependencias vulnerables. El sucesor mencionado en matriz tampoco acredita compatibilidad automáticamente.

El coordinador debe entregar dos full SHAs/deployment IDs verdes, sus manifest de migraciones y recibo Gate3/4 de compatibilidad con la DB aislada actual. Comparar migraciones y contratos Auth/MFA/RLS/Storage/API; igualdad de archivos por sí sola no prueba compatibilidad DB/config/datos. Si exige DDL inverso, repair/ledger, retirar MFA/RLS/Storage o restore nuevo, detener y coordinar. Gate5 no inicia Docker ni ejecuta esas operaciones.

Usar un alias **nuevo, exclusivo y expresamente autorizado de Gate5**, conservando URL solo en custodia privada y mapeos antes/después. Mover únicamente ese alias entre deployments compatibles e inmutables; comprobar mapeo en Vercel y health/contratos sintéticos autorizados después. No tocar alias de rama/otros gates/Production ni protección ajena. `vercel rollback` apunta a dominios Production y no se usa aquí; tampoco `vercel promote`. Verificar primero `vercel alias --help`; el operador usará `vercel alias set <deployment-inmutable> <alias-exclusivo>` solo tras los prerrequisitos. No hay script que lo ejecute automáticamente.

Registrar checks antes/después, mapeo real, duración, SHAs/deployments, compatibilidad DB, verificación funcional/denegación/privacidad y disposición final del alias. Un plan o cambio de URL en consola no prueba rollback. Fault/recovery del monitor y rollback son evidencias separadas, ambas NOT VERIFIED.

## Evidencia heredada y bloqueos

- `evidence/2026-10-09-release/access-health.json`: health 200/application-auth/no-store de b7a0f2f/FQUr el 9oct, preservado sin reejecutar ni atribuir al nuevo árbol. Motor readiness/one-shot sin cambios; pruebas reutilizadas. Solo cambia el envoltorio de telemetría del endpoint.
- Las 430 pruebas del baseline son históricas. Aquí se ejecutan regresiones afectadas; no restores, suites ajenas ni recertificación Gates3/4. No hay SQL/migraciones nuevas.
- Pendientes concretos: handoff verde e integración decidida por coordinador; CI propia sobre esa base; Preview/alias exclusivos y turno; host de monitor; propietario/proveedor/canal/destinatario autorizados; acceso acotado; entrega real/acuse directo; destino rollback verde y compatible; reglas reales de logs/retención. Sin espera/polling del otro chat.
- Sin Docker, navegador, fixture de caducidad, Production, staging compartido ni clinia-test. Sin notificaciones/recursos nuevos. Publicar este informe no cambia la matriz ni concede GO.

Referencias consultadas el 24oct2026: [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), [Vercel alias](https://vercel.com/docs/cli/alias), [Supabase Auth](https://supabase.com/docs/reference/self-hosting-auth/introduction), [Node AbortSignal](https://nodejs.org/api/globals.html#static-method-abortsignaltimeoutdelay). El índice Supabase changelog markdown y el enlace versionado Node22 no fueron accesibles por el visor; las funciones usadas ya existen en el Node22.20.0 local. No se cambia la integración Supabase.
