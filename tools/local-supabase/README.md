# Clinia+ — Supabase local de aceptación

Proyecto separado: `clinia-acceptance`. Configuración inicial generada mediante CLI 2.117.0; no ejecuta la carpeta legacy `../../supabase/migrations` ni está enlazado a un proyecto remoto.

## Contrato antes de ejecutar

1. **Por qué:** validar Auth, PostgREST, RPC y Storage reales con datos sintéticos; PostgreSQL aislado por sí solo no contiene estos servicios.
2. **Resultado esperado:** stack oficial local, servicios saludables, puertos publicados solo en loopback, migraciones revisables y actores sintéticos. La baseline se verifica por cobertura y convergencia; una reconstrucción de catálogo no se presenta como dump remoto o respaldo.
3. **Prohibido:** leer/copiar datos clínicos, usar `.env.local` de la app, ejecutar db push/reset/repair remoto, exponer claves en logs, activar proveedores externos o confundir local con producción.
4. **Verificación:** inspección Docker efectiva, HTTP de salud, versión PostgreSQL, inventario real y pruebas positivas/negativas con JWT de Auth. No usar service role como prueba de autorización ordinaria.
5. **Reversión:** detener únicamente `clinia-acceptance`, conservando datos/volúmenes; no ejecutar prune, `--no-backup` ni borrado de volúmenes.

## Operación

Desde la raíz del repositorio:

```powershell
./scripts/clinia-local-supabase.ps1 -Action Start
./scripts/clinia-local-supabase.ps1 -Action Inspect
./scripts/clinia-local-supabase.ps1 -Action Stop
```

El script valida el contexto local Desktop y usa `runtime.compose.json`, conservado bajo `.temp` e ignorado por Git. Compose fija **cada puerto publicado en 127.0.0.1** y reutiliza imágenes/volúmenes oficiales capturados; Start no ejecuta `supabase start`. CLI2.117.0 publicó en todas las interfaces pese al default de la red; el arranque inicial vacío se detuvo antes de cargar datos de aplicación. No sobrescribir la captura ni imprimir su configuración privada. El acceso a Docker puede necesitar aprobación acotada fuera del sandbox.

API: `http://127.0.0.1:56321`; DB: puerto56322; buzón de prueba local: puerto56324. Las credenciales generadas y salidas sin redacción quedan únicamente bajo `.temp`, ignorado por Git. Auth usa confirmación, expiración de JWT de15min y contraseña mínima12; correos capturados localmente, sin SMTP externo. El frontend de ensayo se configurará mediante variables de proceso para este entorno, sin alterar el `.env.local` existente.

Studio, analytics, Edge Runtime y S3/vector están desactivados inicialmente. Son diferencias intencionales; no acreditan pruebas de Vercel ni funciones serverless. En esta fase no se aprueba lanzamiento clínico, rendimiento, privacidad o recuperación completa.

## Estado verificado del 27-09-2026

- Siete servicios reales, puertos56321/56322/56324 solo loopback. PostgREST tiene comprobación HTTP porque su imagen no define healthcheck Docker. PostgreSQL17.6 observado; revisión del parche disponible17.11 pendiente, sin upgrade remoto.
- Dos DB secundarios (`clinia_stage_clean`, `clinia_prod_upgrade`) reproducen contratos scoped de las capturas; M7 conserva dos pacientes inventados. **No tienen API/Auth/Storage independiente** ni acreditan convergencia canónica stage/prod.
- `postgres` es ahora la DB primaria sintética de API: prod-deny-v2 → M7 → reatribución revisada de tres callbacks nuevos y schema privado → cuatro buckets configurados por Storage API → forward02 → catálogo verify. [Ejecución](../../docs/production/evidence/2026-09-27/primary-install/execution.json).
- `supabase_admin` solo para DDL baseline/M7 y reatribución acotada; sesión real `postgres` para forward02/mantenimiento. No elevar roles ni fabricar claims JWT. Los permisos ordinarios se comprueban con signInWithPassword y APIs reales.
- [Auth/RPC/Storage](../../docs/production/evidence/2026-09-27/auth-matrix/execution.json):24/25 checks inicialmente. El fallido usó `inactive`, que no existe. [Corrección preservada](../../docs/production/evidence/2026-09-27/auth-profile-state/execution.json): invited/suspended/deleted_at deniegan RPC/Storage con JWT previo; restauración activa verificada.

`prepare-clinia-primary.cjs` y `verify-clinia-auth.cjs` son **one-shot**: rechazan fixtures/evidencia existentes. Cada delta necesita un forward nuevo; no borrar bases/usuarios/evidencia para repetir. Tokens/contraseñas sintéticos quedan en `.temp/encargo02-actors.private.json`; no copiarlos a documentación/chat. No usar `.env.local` de la app: apunta a producción.

02 continúa parcial: faltan matriz extendida/contención/carreras, consumidores restantes y paridad remota01; profesional09/onboarding10B siguen pendientes. [Auditoría/derechos continuada](../../docs/production/evidence/2026-09-27/auth-rights-continued/execution.json) aprobada localmente; no implica ejercicio legal completo. Provisioning conforme a documentación oficial de [Storage](https://supabase.com/docs/reference/javascript/file-buckets-createbucket) y [Auth Admin](https://supabase.com/docs/reference/javascript/auth-admin-createuser).

## Frontend de aceptación aislado

```powershell
node scripts/clinia-local-app.cjs build
node scripts/clinia-local-app.cjs start
```

Desde la raíz; `dev` está disponible para cambios. El launcher inspecciona Docker/API locales, blanquea variables de archivos dotenv y configura Supabase sintético, origen `http://127.0.0.1:3400` y proveedores externos deshabilitados. No usar `npm run dev/build` con `.env.local` productivo para ensayos.

CSP permite exactamente API56321 solo con modo local y URL exacta. `skipMiddlewareUrlNormalize` se activa únicamente en ese modo: Next15 normalizaba la redirección loopback a localhost y perdía cookies; el ensayo final real confirma el origen. En despliegues normales no se activa esa excepción. Configurar NEXT_PUBLIC_APP_URL canónico por entorno/preview.

El launcher actual usa `.next-clinia-acceptance` para build/start/dev, separado de `.next` del usuario. Es un artefacto de aceptación local: **no desplegarlo**. Una release necesita build y variables propios. El proceso frontend puede detenerse con Ctrl-C; no detener Docker ajeno ni borrar volúmenes. Datos de prueba crecen con los ensayos: actualmente32 pacientes enA y uno enB; los actores de Auth y secretos permanecen privados.

[Informe de integración](../../docs/production/02_04_VERIFICACION_LOCAL_2026-09-27.md) y [resultados del navegador](../../docs/production/evidence/2026-09-27/frontend-ui-verification.json). Recepción y acceso rápido a recetas están verificados localmente; las demás rutas y los gates de producción siguen pendientes.

## Agenda y rendimiento del28-09-2026

Una migración adicional revisada fue aplicada **una vez** a la DB primaria sintética: `20260928032932_enforce_operational_agenda.sql`. No reaplicarla ni ejecutar reset/db push para repetir pruebas. Añade estados, guard, auditoría privada, restricción de solapamiento e índice; no contiene reparación destructiva de historia.

[Informe y reversión](../../docs/production/05_12_AGENDA_RENDIMIENTO_LOCAL_2026-09-28.md), [10casos con JWT reales](../../docs/production/evidence/2026-09-28-performance/agenda-runtime-02/execution.json). `node scripts/verify-clinia-agenda.cjs N` requiere un intento nuevo1..28, conserva actores y usa un día diferente; el script no vuelve a instalar esquema. No se repiten mutaciones para obtener otra captura.

La CLI de navegador acepta `run-code --filename`: evita errores de comillas de Windows. Login y estado de sesión se mantienen en archivos privados ignorados; logs públicos usan solamente flujos con información sintética y resultados sin claves. El fixture de receta descargado se marca PRUEBA/NO USO CLÍNICO. Estos resultados no habilitan despliegue ni cierre01/02/09/13/15.

## Convergencia e informes del28-09-2026

[Informe de continuación](../../docs/production/01_04_06_CONTINUACION_2026-09-28.md). El ensayo2 de `verify-clinia-operational-convergence.cjs` conserva nuevos clones `clinia_contract_stage_20260928_2` y `clinia_contract_prod_20260928_2`: contrato SQL operativo declarado coincidente, datos históricos intactos e invariantes/contención SQL verificados. No tienen API independiente; no volver a ejecutarlo sobre evidencia/destinos ocupados.

`20260928190221_operational_reports.sql` fue instalada **una vez solo en la primaria sintética**. No reaplicarla: su guard exige RPC ausente. `verify-clinia-operational-report.cjs 1` terminó con pruebas Auth/JWT/PostgREST reales. La allowlist02 histórica y el ensayo secundario preceden esta RPC; actualizar/reprobar la cadena integrada antes de promocionar, no llamar al verificador antiguo como aceptación del overlay nuevo.

Fixture `12121212-1212-4212-8212-121212121212`: tratamiento inventado editado una vez mediante UI; verify conserva hash histórico. No repetir prepare para sobrescribirlo. Los scripts `browser-authority-*`, `browser-doctor-reports.js` y `browser-operational-*` usan exclusivamente3400. La VM CLI no dispone de `URL`: usar strings o APIs de navegador, y no imprimir logs privados de login.

La revalidación al foco conserva drafts de un scope ya verificado bajo modal bloqueante; cambios/fallos de autoridad borran consumidores. No se omite getUser ni la comprobación viva de membresía. Las navegaciones medidas son locales, secuenciales y pequeñas; no son SLA ni evidencia clínica.
