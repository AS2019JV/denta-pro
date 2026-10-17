# PREP — Reproducibilidad y CI mínima

28-09-2026, Ecuador. Base `f96fbb898ec2a0615dec293ee3e5ce0a9b41b170` con trabajo anterior conservado. **PREP local VERIFICADO; CI remoto PENDIENTE / NO-GO clínico.** La copia aislada completó instalación, tipos, lint, 83 pruebas y build, exit0. No hay ejecución publicada de GitHub Actions ni autorización de producción.

## Cinco preguntas y aceptación

| Pregunta | Contrato |
| --- | --- |
| Por qué existe | Repetir checks sobre fuentes identificadas y conservar el trabajo acumulado |
| Qué debe ocurrir | Copia de fuentes sin privados; instalación congelada; tipos/lint/contratos/build con configuración sintética; error real provoca exit distinto de cero |
| Qué no debe ocurrir | Leer/copiar secretos al snapshot, heredar credenciales arbitrarias, contactar proveedores externos o sobrescribir `.next` de la app activa |
| Cómo verificar | Hashes de copia, `npm ci`, runner completo y negativos de entorno/red/propagación de error |
| Cómo deshacer | Revertir solo scripts/configuración del delta y conservar snapshots, fuentes y evidencia anteriores; no borrar dependencias activas |

## Implementación

- `scripts/clinia-release-snapshot.cjs`: copia las fuentes visibles por Git, incluye cambios válidos no commiteados, clasifica privados antes de leerlos, rechaza symlinks/secretos detectables y comprueba SHA256 de cada copia. Registra exclusiones. No es un backup integral del Git, los privados o bytes clínicos.
- `.release-snapshots/` se ignora en Git y TypeScript; cada ID es único. No se borra para repetir.
- `scripts/clinia-verify.cjs`: entorno mediante allowlist de variables del sistema, proveedor ficticio loopback, credenciales sintéticas y `NODE_OPTIONS` propio. Ejecuta tipos, lint, contratos y build; propaga el fallo y bloquea build fuera de snapshot/runner GitHub.
- `scripts/clinia-ci-network-guard.cjs`: deniega fetch/TCP externos y permite loopback/IPC para los checks. Es defensa de proceso para herramientas de confianza, **no aislamiento del SO ni prueba de APIs/JWT**.
- `types/next.d.ts` permite comprobar tipos antes de generar el `next-env.d.ts` ignorado. ESLint tiene `root:true`; el tracing de Next parte del directorio de configuración, sin heredar el proyecto padre del snapshot.
- Workflow sin secrets/deploy, con permiso `contents:read`, credenciales de checkout no persistidas y Actions fijadas a hashes oficiales verificados. CI usa instalación sin scripts de paquetes; integración Supabase/navegador permanece en gates separados.
- Runtime de baseline fijado a Node22.20.0/npm10.9.3, igual al entorno de esta verificación. **No es aprobación del mantenimiento de seguridad del runtime**; el candidato de producción debe revalidar/ensayar el parche LTS soportado en13/14 antes de liberar.
- [Matriz de los36 comportamientos](RELEASE_ACCEPTANCE_MATRIX.md) vincula tareas, evidencia y responsables pendientes. No crea aprobaciones humanas.

El grafo de dependencias del lockfile se comparó contra la primera copia: intacto; solo se agregó la metadata de Node. No se actualizaron paquetes de manera indiscriminada.

## Operación

```powershell
node scripts/clinia-release-snapshot.cjs <id-unico>
```

En la **copia creada**, no en el checkout activo:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
```

Los comandos individuales `npm run typecheck`, `npm run test:production` y `node scripts/clinia-verify.cjs lint` no requieren Docker. `npm run build:verification` exige snapshot/runner para proteger `.next`. Los nuevos comandos no sustituyen el launcher local de aceptación ni el build de despliegue con configuración autorizada.

En este equipo el shim `npm` del usuario apunta a una ruta que no existe. Se utilizó el CLI instalado junto a Node: `node 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' ...`; no se cambió PATH ni se instaló npm global.

## Evidencia e intentos conservados

| Intento | Resultado/alcance |
| --- | --- |
| `prep-20260928-1` | Snapshot inicial576fuentes; preserva el estado anterior a la revisión de aislamiento |
| `prep-20260928-2` | Snapshot576fuentes; instalación646paquetes aprobada; tipos pasan; lint falla por herencia del config padre antes de ejecutar tests/build, conservado en `verification.log` |
| `prep-20260928-3` | Snapshot577fuentes; instalación offline646paquetes aprobada; tipos, lint, 83tests y build completan, exit0 |
| Tests de contrato actuales |83pruebas, cero fallos; pruebas de red usan un servidor loopback y rechazan destino externo antes de conectar |
| Revisión independiente | Dos hallazgos de aislamiento corregidos: herencia de variables ajenas y lectura previa de privados; no llamadas reales a producción |

La instalación del tercer intento falló inicialmente por EPERM de acceso del sandbox a la caché npm; la repetición aprobada fuera del sandbox completó. Los errores de permisos no se presentan como fallos de código ni se solucionaron debilitando la configuración de la app.

[Evidencia pública](evidence/2026-09-28-prep/verification-summary.json), [log completo](evidence/2026-09-28-prep/verification.log) y manifiesto de la copia identifican este resultado. Snapshot SHA256: `2ed96c4f1464737c49690a3839b42a9259bc7e6a287e8c51894d407c02a932eb`; buildID `rYVq5KXtdhAF5xvnwoJm-`. Después de compilar se comprobaron las 577 entradas: cero diferencias en la copia y en las mismas rutas del workspace. Documentación añadida después se identifica en el manifiesto del delta; no requiere atribuirle ejecución al build anterior.

La compilación tardó3,8min en esta máquina; no es una medida de navegación de la app. Lint/build conservan advertencias de imágenes/hooks, deprecación de `next lint` y dependencias Supabase/Edge Runtime. No se omitieron los checks ni se presentan esas advertencias como resueltas. Se atenderán por componente/riesgo en los gates correspondientes.

No se ejecutó CI remoto: el workflow todavía debe integrarse en una versión revisada y ejecutarse en GitHub. No afirmar validación de Linux, proveedor SMTP, staging remoto, carga representativa o restauración por estos resultados locales.

## Reversión

Conservar snapshots y manifiestos. Revertir únicamente las nuevas entradas de scripts, engine/runtime y configuración de tooling contra el delta revisado; mantener todos los cambios anteriores. No ejecutar reset/prune ni eliminar `.next`, `node_modules`, bases o volúmenes activos.

## Siguiente dependencia

01A: la cadena SQL acotada ya incorpora informes en [attempt3](evidence/2026-09-28-convergence/attempt-3/execution.json); instalación limpia/upgrade completo y API real siguen pendientes. 01B: hay [catálogos remotos y dos dumps SQL acotados](01B_CAPTURA_ESQUEMA_2026-09-29.md); restauración aislada, Auth/Storage administrados y configuración remota completa siguen pendientes. 02–15 mantienen sus gates de seguridad, funcionalidad, recuperación y aprobación humana.

## Handoff

```text
ENCARGO: PREP
COMMIT / ENTORNO: f96fbb8 + snapshot prep-20260928-3 / Windows local sintético
ESTADO: VERIFICADO local; PARCIAL para ejecución Linux/GitHub
CAMBIOS: snapshot, runner aislado, CI mínima, matriz de 36 IDs
PRUEBAS Y EVIDENCIA: instalación congelada; tipos/lint; 83/83; build exit0; hashes
RIESGOS: warnings vigentes, runtime de baseline pendiente de mantenimiento, CI no ejecutada remotamente
REVERSIÓN: revertir solo el delta de tooling; conservar snapshots y trabajo previo
REQUISITOS DEL SIGUIENTE ENCARGO: recuperar espacio; 01A API/clean; 01B restauración aislada/configuración
```

Fuentes de decisiones de tooling: [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/), [seguridad GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use), [ESLint Next15](https://nextjs.org/docs/15/app/api-reference/config/eslint). La fijación de Node actual preserva esta baseline; no acredita que sea el parche adecuado para producción.
