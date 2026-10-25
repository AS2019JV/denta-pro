# Gate7 — avance incremental desde bddad198

Se conserva íntegro el paquete anterior: checklist, demo y hojas de aceptación. No se reejecutaron sus suites ni se copiaron firmas. Esta carpeta contiene únicamente asignación propuesta, reproducción/corrección acotada de edad y bloqueos actuales.

## Avance automático

- Se leyó RC_HANDOFF v1.2 y se detectó durante el cierre su avance a v1.5. SHA ejecutable sin cambio: `254996d89b68d11aec43e82f8184e01035b55696`, árbol `2ba4e231747575d312e2419e61869bed42573e09`, CI40116990280 FAILURE; Preview83WHkLXSCDVsdoHXjxC6KjoVRa6v Ready por recibo, sin visita nueva. Hash v1.5 y copia privada observada: evidence/rc-binding.json. No se suplió por baseline verde histórico ni alias.
- Gate7 conserva runtimeTurnAuthorized=false; entorno, turno, clínica, actores y fixtures null. Contrato DB: proyecto staging según recibo, tres contratos seleccionados y ledger documentados; compatibilidad RC/paridad/adopción no demostradas. No consulta DB ni fixture nueva.
- Propuesta revisable en [MANIFIESTO_PROPUESTO.json](MANIFIESTO_PROPUESTO.json): una clínica ficticia exclusiva, owner/doctor/receptionist existentes elegibles y exclusivos, dos pacientes propios, cita/receta/PDF y hasta tres versiones HCU. Nada de autoridad manual, cuentas ajenas, recursos facturables o envío.
- Reproducción local del código exacto RC: al24oct2026, nacimiento25oct2008 devuelve18 en ficha y las dos rutas HCU; esperado17. Fallan3/21 filas de fecha/zona (Guayaquil: víspera de cumpleaños, fin de año y víspera de aniversario bisiesto). Se conserva [antes](evidence/age-before.json) y el [harness](evidence/age-probe.source.cjs). Son datos ficticios sin actor/backend, no un FAIL browser.
- [CALENDAR_AGE.patch](CALENDAR_AGE.patch): corrección mínima preparada para el RC exacto, **no aplicada al release/RC compartido**. Reutiliza validador existente de fecha calendario, compara año/mes/día sin convertir nacimiento en UTC y alimenta ficha/HCU/campo fecha. Conserva etiqueta de nacimiento y parches de seguridad. No cambia schema/RLS/MFA/autoridad, recetas o finanzas.
- Regresión afectada nueva: **4/4 PASS**,0 fallos/omitidos,21 combinaciones fecha/zona revisadas por helper y rutas reales; no sumar esas comprobaciones como pruebas E2E distintas. Se verificó apply --check contra bytes originales y roundtrip de los cinco archivos en copia aislada. [Recibo](evidence/patch-verification.json). Sin suites completas, installs de dependencias, nueva CI, build o typecheck. La prueba corre funciones/bloques reales con reloj fijo; no sustituye componente completo, persistencia o browser.
- Fuente técnica actual consultada: MDN documenta que la cadena solo fecha implica UTC. [Date.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse). modern-web-guidance offline no estuvo en caché (ENOTCACHED); no se instaló. Supabase changelog markdown no fue servido por el navegador; no se implementó funcionalidad o configuración Supabase.

El parche usa el aniversario aritmético1mar para29feb en año no bisiesto y registra17 al28feb/18 al1mar para2008→2026; no decide capacidad, consentimiento ni regla legal/clínica. Esa decisión sigue humana. El entorno de prueba usa reloj local inyectado en tres zonas y no cambia reloj del sistema.

## Ejecución pendiente, separada por dependencia

| Recorridos | Estado / qué falta |
|---|---|
| G7-01 paciente nuevo/reapertura/HCU/autoría; G7-02 FDI/CPO; G7-03 cita; G7-04 receta/reimpresión; G7-07 menor/corrección y edad UI | NOT VERIFIED: no hay RC verde asignado ni turno/fixtures/actores/contrato autorizados. Una vez asignados, no esperar solo por Gate1. |
| G7-05 exportación | NOT VERIFIED: ejecutar parte independiente cuando se autoricen gates comunes; retener solo la exportación que necesite realmente broker/documento bloqueado. |
| G7-06 descarga/bytes/render/custodia | NOT VERIFIED/BLOCKED: gates comunes y disposición/entrega específica Gate1; no habilitar broker/config/autoridad desde Gate7. |
| Parche edad preparado | PASS local focalizado; NOT INTEGRATED. Coordinador decide integración en sucesor; CI propia, tipos/build y browser de ese SHA pendientes. No ejecutar CI sobre árbol vulnerable sin cambios de dependencias a cargo del responsable. |

Cada futura fila utilizará registro ya definido: SHA/CI/deployment/proyecto, actor/rol exclusivo, ID sintético, acción, lectura persistida por ID/clínica con autor/fecha/versión, bytes/hash cuando corresponda y denegaciones pertinentes sin efecto. El actor de esta reproducción local es null, explícitamente no un usuario ordinario de backend.

Finanzas: se solicitó al coordinador confirmar alcance congelado; su comentario técnico indica exclusión de finanzas activas y conservación del control técnico de acceso a suscripción SaaS. No se añade billing/pagos/contabilidad al manifiesto ni se interpreta el control de suscripción como recorrido financiero aceptado. Falta vincular la decisión en el handoff asignado.

## Decisiones humanas

El usuario respondió que propietario, odontólogo habilitado y responsable de privacidad cualificado **siguen sin designar**. Identidad, habilitación/competencia, sesión y aceptación explícita por persona/SHA permanecen null. [Sesión corta propuesta](SESION_REVISION.md):15min, conserva demo5min y hojas previas. Sin invitaciones ni firmas/validación profesional fabricadas.

Se solicitó al coordinador un handoff ejecutable versionado, alcance congelado, clínica/actores/turno y destino/custodio/retención de evidencias. El mensaje de coordinación es una propuesta, no autorización. Custodia de credencial/incidente, configuración global y entrega privada permanecen en sus gates. Production NO-GO.

## Reproducción y entrega

Dentro del worktree Gate7:
```powershell
node .release-snapshots/gate7-resume-20261024/probe.cjs
node .release-snapshots/gate7-resume-20261024/build-patch.cjs
$env:NODE_PATH='C:/Users/aleja/Documents/0-dev/denta-pro/node_modules'
node --test .release-snapshots/gate7-resume-20261024/after/test/production/age-boundaries.test.cjs
```

Fuentes reproducibles saneadas del probe, builder y prueba se incluyen en evidence/. El builder requiere ubicar age-boundaries.test.cjs junto a él y usar la raíz del worktree; lee fuentes del SHA exacto por git show y solo escribe la copia ignorada before/after. No aplicar al checkout compartido. Nueva ejecución solo si un diff la invalida o para validar el sucesor integrado; estos comandos documentan lo ya ejecutado.

El sobre no secreto `handoff.json` se guarda fuera del commit, ignorado, para fijar su resultSHA real sin autorreferencia. Solo el coordinador integra y actualiza la matriz global. Esta rama entrega artefacto de parche, no un release modificado. Las rutas de source hashes normalizados y raw son distintas y explícitas en el recibo.
