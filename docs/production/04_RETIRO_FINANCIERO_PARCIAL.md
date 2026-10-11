# ENCARGO04 — Retiro financiero independiente — PARCIAL

Fecha: 2026-09-26. Ambiente: checkout local. Índices: `Architecture_map.md` y `00_INVENTARIO_DE_CIERRE.md`, especialmente 00-05. **No apto para declarar producción ni cero finanzas completo.**

La preparación fue solo lectura. Esta porción recibió escritura exclusiva después de ENCARGO03. Se preservaron sus cambios recientes en dashboard, el árbol sucio y los históricos. No hubo cambios de base, nuevas RPC, migraciones, despliegues, operaciones remotas, proveedores ni correos. La verificación de metadata de staging reportada por el coordinador pertenece a ENCARGO01; este documento no la extiende a JWT, permisos reales o esta porción.

## Cinco preguntas y aceptación previa

1. **¿Por qué?** Retirar los cobros accesibles desde Next.js y la factura automática al reservar una cita, sin esperar contratos nuevos de pacientes.
2. **¿Qué se espera?** `/billing` y `/pay/[id]` rechazan en servidor; subscribe y webhook responden 503 sin leer request, usar proveedor o base; los tres formularios crean solo cita sin importe/precio. El control técnico de acceso por suscripción permanece sin destino de cobro.
3. **¿Qué está prohibido?** Borrar o poner en cero finanzas históricas, reemplazar RPC por un acceso que evada roles, modificar base/proveedores/correos, reactivar pagos por flag o declarar todo 00-05 cerrado.
4. **¿Cómo comprobarlo?** Ejecutar handlers reales transpilados en un contexto aislado con imports restringidos y request que falla si se lee; ejecutar los handlers de cita extraídos mediante AST con mocks que rechazan tablas/campos financieros; TypeScript local y revisar diff contra copias previas. Build final, navegador, JWT y PostgREST quedan con el coordinador y los encargos dependientes.
5. **¿Cómo deshacer?** Restaurar solamente cambios propios contra copias previas, después de comparar con cambios posteriores. No usar reset/clean ni tocar tablas. Restaurar rutas de cobro es reactivar una capacidad y necesita nuevo alcance aprobado.

**Aceptación de esta porción:** handlers financieros sin ejecución de proveedor/DB; páginas rechazadas mediante `notFound()` en Server Components; creación de citas sin factura automática ni campos económicos; carga de servicios de reserva limitada a id/nombre/duración; reglas técnicas de trial/bypass/tier conservadas. **Aceptación global pendiente:** cero lecturas/escrituras financieras en todos los recorridos y acceso directo por API, demostrado por rol/clínica en ambiente aislado.

## Cambios exactos

| Archivo | Resultado local |
| --- | --- |
| `app/(dashboard)/billing/page.tsx` | Página de servidor mínima que llama `notFound()`. Código financiero previo conservado en copia temporal. |
| `app/(dashboard)/pay/[id]/page.tsx` | Página de servidor mínima que llama `notFound()`. Retira código financiero muerto detrás de `notFound()` cliente. |
| `app/api/payments/subscribe/route.ts` | POST solo responde 503; retira cuerpo muerto y imports de Kushki, credenciales, cookies y DB. |
| `app/api/webhooks/kushki/route.ts` | POST solo responde 503; no inspecciona firma/body ni crea cliente privilegiado o modifica payments/clinics. No confirma procesamiento ficticio del webhook. |
| `app/(dashboard)/dashboard/page.tsx` | Retira toggle/importe/precio del formulario, defaults económicos y creación de billings; respuesta de insert de cita solo id. Conserva cambios de recetas de ENCARGO03. |
| `components/calendar/modern-calendar.tsx` | Mismo retiro en creación de cita. Servicios solo id/nombre/duración; pacientes del selector y perfiles usan campos explícitos necesarios para la UI existente. Mantiene duración del servicio y usa `specialization`, presente en ambos catálogos capturados, en lugar de la etiqueta anterior `specialty`. |
| `components/quick-appointment-dialog.tsx` | Servicios sin price en consulta ni etiqueta; duración permanece. Su handler ya creaba únicamente cita. |
| `hooks/use-dashboard-data.ts` | Solo loader de servicios pasa de wildcard a id/nombre/duración y tipo sin price. Resto del hook financiero pendiente. |
| `components/subscription-blocker.tsx` | Conserva lectura trial_ends_at/bypass_subscription/subscription_tier y evaluación previa; retira excepción y CTA /billing. Mensaje dirige al responsable de clínica sin ejecutar contacto. |
| `test/production/financial-retirement.test.cjs` | 13 comprobaciones conductuales directas, sin proceso hijo de node --test. |

No se cambió contrato de RPC de pacientes/familias, listado/detalle/CSV/reportes/PrivacyTab, reglas de autoridad ni tablas financieras. La proyección del selector de calendario conserva campos clínicos previamente usados: su autorización específica sigue pendiente de ENCARGO02. No se amplió ningún permiso.

## Evidencia local y límites

- `node test/production/financial-retirement.test.cjs`: exit 0, **13 comprobaciones conductuales**. Dos handlers rechazan sin leer request/importar proveedor o DB; dos páginas invocan rechazo antes de acceso; tres handlers de cita probados con éxito, conflicto y fallo de DB. Solo se acepta tabla appointments, payload exactamente clínico/operativo y respuesta de éxito coherente. Getter price lanza si se consulta.
- `.\node_modules\.bin\tsc.cmd --noEmit --incremental false`: exit 0. Primera ejecución detectó dos campos clínicos usados por UI fuera de la proyección del calendario; se añadieron explícitamente has_diabetes/has_hypertension y se repitió con éxito.
- Revisión de diff contra copias previas: confirma únicamente cambios de esta porción, sin reemplazar las modificaciones de ENCARGO03. Los tests transpilan código real pero usan dependencias simuladas: **no equivalen a navegador, HTTP real, PostgREST ni RLS**.
- Build consolidado final ejecutado por el coordinador: exit0, con advertencias restantes registradas en [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md). Se conservaron también intentos previos y sus fallos. No se probaron interacciones de navegador, bloqueo técnico con sesiones reales, conflictos concurrentes ni integridad remota.
- Next.js conserva manejo de métodos no exportados. Solo POST financiero tiene respuesta explícita 503; no existe handler con ejecución económica. Estado HTTP de páginas y otros métodos debe observarse en build/navegador final.

## Pendientes completos de 00-05

1. **Dashboard y caché:** `use-dashboard-data.ts` aún consulta billings y pacientes con wildcard/anidado; dashboard conserva agregaciones recentBillings/monthlyRevenue/pendingRevenue. Scope de clínica, claves de caché y autoridad también dependen de ENCARGO02. Crear cita ya no escribe factura, pero refreshData todavía refresca billings: no se afirma cero lecturas en ese recorrido.
2. **Agenda:** calendario conserva join billings de citas, alertas/importes de deuda y UI financiera del historial. El retiro autorizado cubre creación, no todas las lecturas. Cambiar clínicas y rol sigue requiriendo prueba real.
3. **Pacientes/intake:** saldo, seguro/póliza, tipos/schema, payloads de alta/update y respuestas completas permanecen. Listado/detalle aún usan get_patients_with_stats, saldo y total_billed; ficha mantiene PatientPayments y facturas del historial. Omitir campos económicos en futuras actualizaciones debe preservar valores existentes.
4. **Familia/pagadores/fidelidad:** get_family_unit_with_stats calcula dinero, FamilyCenter presenta responsabilidad financiera/total pagado, badges usan totalBilled/threshold_billed. No reinterpretar pagador histórico como tutor legal; mantener parentesco sin conferir autoridad clínica. `patient-info-carousel.tsx` también conserva seguro/póliza.
5. **Contratos DB/API:** get_patients_with_stats y get_family_unit_with_stats consultan billings/retornan finanzas. Seleccionar menos columnas después de RPC no elimina el cálculo interno. Definir proyección segura según ENCARGO02, grants/RLS y exposición directa a billings/invoices/payments/payment_methods/RPC, sin romper históricos. ENCARGO01 sigue PARCIAL: hacen falta actores JWT y pruebas reales de roles/aislamiento.
6. **Catálogo:** services-manager y ServicesTab legacy contienen price en formularios/templates/queries/payloads; confirmar default/nullabilidad de servicios nuevos antes de omitir precio. No introducir price:0 como arreglo ni poner históricos a cero.
7. **Reportes/PDF:** reports lee pacientes/servicios wildcard y calcula price/estimatedDemand; reports-pdf mantiene revenue. Retirar dinero y definir métricas operativas completas por periodo sin claims de totales paginados.
8. **CSV/JSON/portabilidad:** pacientes exporta saldo/seguro/póliza y puede importar account_balance; PrivacyTab exporta pacientes/servicios con wildcard. Restringir campos antes de lectura/escritura, no sanear después; conteos, alcance, auditoría y permisos pertenecen a los encargos de traslado/privacidad.
9. **Navegación/configuración:** componentes legacy dashboard/user-nav conservan entrada Billing; sidebar tiene aviso ficticio de pago; SubscriptionTab conserva planes/precios/consulta comercial. Nuevas rutas rechazadas evitan operación, pero estas superficies pueden llevar a un destino retirado y necesitan simplificación. SubscriptionBlocker ya no genera ese destino.
10. **Functions históricas/remotas:** admin-emergency-override escribe payments como auditoría con amount:0; loyalty-marketing usa total_billed/vip_threshold_amount. No tocadas ni desplegadas. Coordinación con ENCARGO02/04/13 y contrato de auditoría técnica aprobado antes de reactivar o sustituir.
11. **Código económico desconectado/históricos:** billing components, patient-payments, invoicing, Kushki, sri-service, pdf-generator-budget y tipos de DB no necesitan destrucción. Validar que ninguna ruta activa restante los conecte; preservar facturas/pagos/datos históricos. Restricción de plantilla payment_reminder requiere completar ENCARGO04 y revisar comunicación en ENCARGO10; no se alteró aquí.
12. **Claims y recepción técnica:** revisar landing/manual/ajustes para concordar con alcance; webhook 503 no cancela reintentos o cobros ya configurados en proveedor. Configuración externa requiere su propio encargo autorizado; esta edición no acredita efecto remoto.

## Reversión y entrega

Copias previas de los nueve archivos existentes: `C:\Users\aleja\AppData\Local\Temp\clinia-encargo04-d0e25b64-e943-4291-b083-fd84aedfe869` (misma estructura relativa). Incluyen los cambios anteriores de ENCARGO03. Comparar antes de restaurar porque el árbol contiene trabajo ajeno y continuará cambiando. Documento y test son archivos nuevos de esta porción.

Las copias son temporales, no respaldo duradero de repositorio ni datos. No hay rollback de datos porque no se ejecutaron escrituras remotas o migraciones. **Estado global ENCARGO04: PARCIAL.** Escritura exclusiva liberada al entregar al coordinador.

## Continuación 2026-09-27 — slice de dashboard con contratos02

Esta sección actualiza el estado de las cuatro áreas indicadas; los pendientes anteriores se conservan como registro de la primera porción. La coordinación informó contratos02 instalados y probados localmente. Aquí se realizaron cambios de código local y pruebas con dependencias simuladas, sin SQL, conexión de producción, build, dev ni navegador.

### Cinco preguntas de esta continuación

1. **¿Por qué?** Eliminar la lectura/refresco financiero del dashboard y adaptar sus caminos operativos a autoridad viva y proyecciones autorizadas de ENCARGO02.
2. **¿Qué se espera?** Cuatro loaders delimitados por clínica/actor/rol, sin wildcard clínico ni finanzas; errores distintos de vacío; pacientes recientes y búsqueda demográficos; reservas/estados vía RPC sin notes para recepción; acceso técnico decidido por booleano del servidor.
3. **¿Qué está prohibido?** Fallback de metadata, datos cacheados de otra clínica, notas clínicas de recepción, CTA de cobro, inferir plan/días desde booleano, afirmar concurrencia o integraciones de pacientes/familia ya completadas.
4. **¿Cómo comprobarlo?** TypeScript local, pruebas conductuales de loaders/payloads/errores/respuestas tardías y revisión de diferencias contra copias previas. Navegador y JWT/RLS local se verifican por el coordinador sobre el entorno aislado.
5. **¿Cómo deshacer?** Comparar/restaurar únicamente cambios de este slice contra copias temporales; preservar otros encargos y cualquier cambio posterior. Sin reset/clean ni alteración de históricos.

### Retirado/adaptado en este slice

- `hooks/use-dashboard-data.ts`: eliminado billings y su refetch/loading/retorno. Pacientes usa get_patient_demographics JSON items/total_count; personal usa get_clinic_staff_directory JSON array y filtra profesionales; agenda usa get_clinic_schedule JSON items/total_count con rango de 30 días; servicios consulta id/name/duration_minutes con clinic_id y count exacto. Keys incluyen clínica/actor/rol vivo; queries disabled sin autoridad, con AbortSignal y error explícito. Total de pacientes separado de la muestra de diez.
- `app/(dashboard)/dashboard/page.tsx`: eliminadas agregaciones financieras. Métricas de pacientes/servicios usan total autorizado; citas futuras programadas/confirmadas se cuentan antes de limitar presentación a cinco y explicitan próximos 30 días. Onboarding ya no confunde paciente demográfico con historia clínica. Recepción no monta AddPatientForm clínico ni editor de recetas/notas; recientes llevan al listado demográfico. Selección/formularios/branding se limpian al cambiar alcance.
- Reservar y confirmar/cancelar en dashboard usa save_clinic_appointment. Comprobación previa de conflicto usa get_clinic_schedule sobre el intervalo solicitado, con cancelación/respuesta tardía y error explícito. La reserva usa duración del servicio y valida profesional del directorio vivo. Notes se omite del payload de recepción. Se retiró el botón que fingía reagendar cambiando solo el estado a rescheduled; edición de fecha/hora sigue en el encargo de agenda.
- `components/async-patient-select.tsx`: sustituyó SELECT base por get_patient_demographics con búsqueda parametrizada, límite5 y consumo items; cancela request anterior, descarta respuesta tardía y limpia al cambiar clínica/actor/rol. Error visible distinto de sin resultados.
- `components/subscription-blocker.tsx`: sustituyó columnas técnicas clinics no concedidas al cliente por check_subscription_active({check_clinic_id}) boolean. Estado checking/allowed/denied/error, reintento y limpieza de alcance; no inventa plan ni días de prueba y no enlaza a cobros. La UI técnica no reemplaza autorización de servidor/RLS.

### Pruebas y alcance de evidencia

- `.\node_modules\.bin\tsc.cmd --noEmit --incremental false`: exit0 tras adaptar las cuatro áreas. Se corrigió el orden de abortSignal antes de single en la consulta de branding.
- `node test/production/financial-retirement.test.cjs`: exit0, 13 comprobaciones conductuales; harness de dashboard adaptado al nuevo RPC. Calendario y quick-dialog mantienen sus pruebas anteriores, sin declarar su integración02 completa.
- `node test/production/dashboard-authorized-contracts.test.cjs`: exit0, 8 comprobaciones conductuales de loaders/keys/AbortSignal, total separado, respuesta inválida, falta de autoridad, payloads clínicos/recepción y fallo de servidor, selector tardío/error y control técnico booleano.
- Pruebas locales de código con mocks; **no evidencia de navegador, sesiones reales, conexión real a provider ni RLS de este slice**. El coordinador hará la verificación de navegador/JWT local y el build final consolidado.

### Pendientes que permanecen

Los puntos1 del dashboard financiero y búsqueda demográfica base quedan resueltos en los loaders de este slice. La creación clínica de paciente que conserva dashboard monta AddPatientForm para clínicos/owner: **ese formulario todavía pertenece al trabajo posterior de intake**, por lo que no se declara cero finanzas en todo recorrido que parte del dashboard.

Pacientes/listado/detalle/formularios, consentimiento/data_consent, familia, catálogo completo, CSV/JSON/PrivacyTab, reportes/PDF, ajustes comerciales, joins/alertas de billings de calendario y funciones/proveedor históricos siguen pendientes. Los consumidores de get_patients_with_stats deben adaptarse a su nuevo JSON; no se tocaron en este slice. Recepción puede llegar al listado desde recientes, pero la adaptación de ese listado aún no queda acreditada aquí.

La comprobación de conflicto es previa a guardar y **no cierra la carrera concurrente**: exclusión/serialización DB y aceptación de ENCARGO05 pendientes. Rango de agenda usa medianoche local del navegador; política explícita de zona Guayaquil en todos los formularios queda para agenda. Configuración externa de webhook/reintentos sigue requiriendo revisión antes de despliegue.

Copias previas de esta continuación: `C:\Users\aleja\AppData\Local\Temp\clinia-encargo04-dashboard-5294039b-f095-4146-8d7f-b00d5ff78189`, con cuatro archivos fuente, test anterior y este documento antes del slice. El nuevo test de contratos es adicional. **Global04 sigue PARCIAL.**

## Handoff

- **ENCARGO:** 04, porción local independiente.
- **COMMIT / ENTORNO:** base `f96fbb898ec2a0615dec293ee3e5ce0a9b41b170`, cambios locales sin commit; sin despliegue.
- **ESTADO:** PARCIAL.
- **CAMBIOS / PRUEBAS:** nueve archivos existentes y prueba/documento nuevos; 13 comprobaciones aprobadas, también ejecutadas por el coordinador; build consolidado en IMPLEMENTATION_PROGRESS.md.
- **RIESGOS / REVERSIÓN:** los doce pendientes anteriores; restaurar solo hunks propios contra copias previas. No borrar históricos ni reactivar cobros automáticamente.
- **REQUISITOS DEL SIGUIENTE ENCARGO:** completar 01/02 y retiro financiero pendiente antes de aceptar agenda/dashboard como versión sin finanzas. ENCARGO05 no iniciado.


## Continuación local 04b/04c: ficha y listado demográfico (27 septiembre 2026)

Estado global: **PARCIAL**. Sin despliegue, SQL, proveedores ni conexiones de producción.

### Cinco preguntas y aceptación
1. ¿Qué autoridad y contrato usa el listado? Rol vivo doctor/clinic_owner/receptionist y RPC get_patient_demographics con items/total_count; la ficha clínica usa get_patients_with_stats solo doctor/clinic_owner.
2. ¿Qué datos edita? Whitelist explícita de datos personales y contacto, nombres obligatorios, longitudes y fecha de nacimiento compatibles con servidor. save_patient_demographics devuelve proyección; sin consentimiento, notas clínicas, pagos, seguros, avatar ni relaciones familiares en payload.
3. ¿Qué se retiró? Listado anterior clínico/financiero, fidelidad monetaria, acciones familiares y CSV incompleto. En ficha: pagos, saldos, seguro/póliza, fidelidad monetaria y billings del historial; edición AddPatientForm y avatar editable ocultos. Recetas y HCU permanecen.
4. ¿Cómo falla? Error/reintento distinto de vacío, ámbitos clinic/actor/role con abortos y descarte de respuestas tardías; guardar conserva formulario al rechazar servidor. Listado paginado12 y búsqueda300ms; conteo exacto del servidor, historial ficha limitado100. new=1 abre después de verificar autoridad y cierre elimina flag; browser-back cierra.
5. ¿Cómo aceptar y revertir? TSC local sin emitir y tests conductuales directos de ficha/demografía. Copias previas por slice en temp; revertir solo archivos de este alcance y conservar cambios anteriores.

### Límites y pendientes
- Importación/exportación completas corresponden al encargo08; controles ocultos. Tutor/familia corresponde al07 y no se adapta aquí. guardian_name no se edita en este formulario.
- PatientFiles conserva queries internas por patient_id; conteo ficha filtra clinic_id y montaje se protege por ámbito, con RLS backend. Adaptación interna pendiente.
- QuickAppointmentDialog y agenda general pendientes de contrato operativo autorizado. La ficha conserva entrada existente; no se afirma adaptación completa.
- Falta validación real de navegador del listado, recepción, creación/edición, paginación y cambio de clínica. Tests locales no son evidencia de producción.
- Cancelar una solicitud cliente descarta su respuesta; no garantiza deshacer una mutación ya aceptada por servidor.
- Resto de catálogo, reportes, configuración, familias y CSV financieros del inventario permanece pendiente; no se declara retiro financiero completo.

## Cierre de integración local del27-09-2026

El coordinador sustituyó también el alta antigua del dashboard para todos los roles por `/patients?new=1`; ya no monta AddPatientForm en esa superficie. Se retiran comparaciones vacías/ficticias con mes anterior y eventos hardcoded de sidebar. Autoridad usa membresías vivas y las consultas se cancelan/limpian al cambiar sesión o clínica.

[Evidencia consolidada](02_04_VERIFICACION_LOCAL_2026-09-27.md): build optimizado0, 64 comprobaciones de código aprobadas y recorrido real local. Recepción creó un paciente sintético, editó su teléfono y verificó fecha persistida, búsqueda, conteo32 y paginación. La continuación final comprueba bloqueo clínico y mismo origen de Auth sin repetir altas/ediciones. Acceso rápido a recetas del propietario pasa selección, recarga y Atrás. No son pruebas de producción ni cubren cambio de clínica en navegador.

Los pendientes anteriores de navegador quedan resueltos solo para esos recorridos. Continúan calendario, catálogo, reportes, configuración, demás rutas y retiro financiero completo. No se acepta concurrencia, CSV, PDF ni preparación clínica por esta tanda.
