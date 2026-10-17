# Encargo 03: acceso rápido a recetas

**Estado: PARCIAL.** El código y las pruebas locales están preparados. No se ha validado una sesión real en staging, RLS con JWT reales ni la ruta de rechazo en navegador; la clínica de staging todavía no tiene datos representativos. No se hicieron cambios en producción.

## Cambio entregado localmente

- El acceso rápido del dashboard muestra un selector compartido de pacientes y navega a `/patients/{uuid}?tab=recipes`.
- La ficha deriva el tab de `useSearchParams` con lista permitida: carga directa, recarga, navegación a otra query del mismo paciente y Atrás/Adelante comparten una única fuente. El editor existente permanece en la ficha.
- El selector busca pacientes de la clínica actual, limpia resultados al cambiar de clínica o ante error y permite seleccionar cada resultado con teclado.
- La emisión solo se presenta a doctor y propietario cuya membresía se confirma con `get_clinic_member_role` y cuyo perfil está activo. La acción de servidor repite estas comprobaciones.
- La acción usa sesión de cookies, `auth.getUser()`, rol vivo, perfil activo y paciente no eliminado de la misma clínica; inserta con el cliente autenticado sujeto a RLS. No usa service role y devuelve mensajes sin detalles SQL ni datos del paciente.
- El servidor valida UUID, entre 1 y 20 medicamentos, longitudes de medicamento/dosis/duración e indicaciones. El PDF se genera únicamente después de guardar con éxito. Se retiró el control de correo que afirmaba un envío inexistente.
- Las lecturas de recetas, plantillas, datos de paciente y clínica del editor incluyen la clínica actual. La búsqueda y guardado excluyen pacientes eliminados.
- Usuarios no autorizados no cargan historia/plantillas desde este componente ni reciben el editor o su descarga. Se limpian borrador, historial y encabezado al cambiar usuario/paciente/clínica; las respuestas obsoletas se ignoran y el diálogo del dashboard se cierra al cambiar contexto.
- Los loaders del editor usan callbacks estables y el efecto declara sus dependencias completas; no se suprime la regla de hooks ni se añade un bucle de recarga por cada render.

## Pruebas locales y alcance

`node test/production/prescription-policy.test.cjs`: **11/11 aprobadas, exit 0**, ejecutadas por el coordinador el 26-09-2026. Verifican navegación con UUID, destinos fijos, tabs permitidos, validación de entrada y el orden de autorización/guardado. Los casos de autorización usan dobles inyectados de sesión, RPC, perfil, paciente e inserción; demuestran que los rechazos no llaman a insertar. No prueban tokens JWT, PostgREST, RLS ni navegador real. El runner con `--test` falló previamente con `spawn EPERM` antes de aserciones; ejecutar el archivo directamente ejecuta sus pruebas node:test sin crear ese subprocess.

`.\\node_modules\\.bin\\tsc.cmd --noEmit`: **exit 0** tras las correcciones de integración del coordinador. El build final se registra en el estado de implementación; estas pruebas no comprueban clicks ni layout.

## Cinco preguntas del comportamiento afectado

1. **Por qué existe:** iniciar una receta para un paciente concreto desde la tarea frecuente del dashboard.
2. **Qué debe ocurrir:** seleccionar paciente de la clínica, abrir editor existente por URL y guardar con identidad autorizada antes de descargar.
3. **Qué no debe ocurrir:** 404 por ruta inventada, emisión de recepción, datos de otra clínica, campos arbitrarios o éxito de correo/guardado inexistente.
4. **Cómo verificar:** pruebas locales indicadas y, para cerrar, el recorrido y los rechazos reales de staging descritos abajo.
5. **Cómo deshacer:** revertir hunks propios con las copias previas; conservar recetas persistidas y cambios ajenos.

## Aceptación pendiente en staging

1. ¿El usuario doctor activo puede emitir en su clínica actual y aparece la receta guardada en el historial?
2. ¿Un propietario activo puede emitir, y un usuario con otro rol no ve el editor ni logra guardar por acción directa?
3. ¿Se rechazan por igual membresía revocada, perfil suspendido, error del RPC, sesión ausente y paciente eliminado o de otra clínica?
4. ¿`/patients/{uuid}?tab=recipes` abre el editor tras carga directa y refresco, y Atrás/Adelante restaura el tab anterior?
5. ¿La sesión real conserva el `clinic_id` esperado por la política RLS de inserción y puede leer historial/plantillas solo de esa clínica?

## Evidencia requerida para pasar a completo

Registrar el SHA desplegado en staging, usuario sintético/rol/clínica, resultado de cada caso positivo y negativo, respuesta HTTP/RPC redactada, comprobación de cero filas insertadas en rechazos, estado de RLS y captura de carga directa/refresco/Atrás/Adelante. No incluir nombres, cédulas, tokens ni contenido de recetas en el informe.

## Dependencias y límites

- Firma, acreditación profesional, documento emitido persistido y reimpresión histórica requieren encargo09. Los catálogos capturados de ambos proyectos contienen specialization/license_number; su existencia no acredita validez profesional. Se conserva su lectura junto con full_name para evitar sustituir datos existentes por valores genéricos. Verificar las credenciales y la etiqueta de registro sigue pendiente antes del uso clínico. La reimpresión aún atribuye al usuario que consulta y requiere corrección. Correo de recetas no implementado ni anunciado.
- La ficha existente consulta `get_patients_with_stats`; este cambio mantiene ese contrato y no sustituye el RPC ni afirma haber corregido su auditoría.
- La política vigente de inserción exige que el `clinic_id` del JWT corresponda a la clínica actual. Se debe validar esta condición en staging con el flujo de cambio de clínica.
- La verificación de RLS existente sigue siendo obligatoria; los tests locales de Node no sustituyen una ejecución autenticada en Supabase.
- Fuentes actuales usadas: [Next.js useSearchParams](https://nextjs.org/docs/app/api-reference/functions/use-search-params), [seguridad de Server Actions](https://nextjs.org/docs/app/guides/data-security), [SSR Supabase](https://supabase.com/docs/guides/auth/server-side). modern-web-guidance se consultó; una recuperación adicional fue interrumpida y se continuó con documentación oficial. Se conserva Next15, sin cambiar middleware por proxy de Next16.

## Reversión

Revertir únicamente los cambios de este encargo en dashboard, ficha de paciente, selector, editor de prescripciones, acción de servidor, helper/política, prueba y este documento. Antes de editar, se guardaron copias del estado de los cuatro componentes iniciales en `C:\Users\aleja\AppData\Local\Temp\denta-pro-encargo03-before-20260926`. Los archivos nuevos de acción, helper, prueba y documento se pueden retirar individualmente. No usar `git reset` ni restaurar archivos completos desde `HEAD`: el checkout ya tenía cambios previos ajenos a este encargo.

## Handoff

- **ENCARGO:** 03.
- **COMMIT / ENTORNO:** base `f96fbb898ec2a0615dec293ee3e5ce0a9b41b170`, cambios locales sin commit; checkout local, sin despliegue.
- **ESTADO:** PARCIAL.
- **CAMBIOS / PRUEBAS:** descritos arriba; build y huellas finales centralizados en IMPLEMENTATION_PROGRESS.md.
- **RIESGOS / REVERSIÓN:** staging, autorización desplegada y documentos clínicos pendientes; copias previas y reversión por hunks.
- **REQUISITOS DEL SIGUIENTE ENCARGO:** esta porción no habilita aceptación de roles/RLS. Completar 01/02 antes de validar emisión clínica o contratos financieros dependientes.

## Continuación verificada del27-09-2026

La [integración local](02_04_VERIFICACION_LOCAL_2026-09-27.md) sustituye la autoridad por membresías vivas y adapta selector/ficha a contratos02. `cedula` es la columna existente para el editor; se elimina la consulta errónea de `identification`. Tab financiero retirado también de la política de navegación.

Navegador real sobre Supabase sintético y build optimizado: clic en acción rápida, selección, apertura del editor, recarga y Atrás **aprobados**, [log final](evidence/2026-09-27/browser-recipe-loopback.log), exit0. Recepción no ve navegación de recetas y una URL clínica directa redirige al listado con la sesión conservada. El primer fallo de redirección local se conserva y fue corregido antes del ensayo final.

Estado03 continúa **PARCIAL**: esta evidencia cierra navegación local, no emisión por Server Action con cada rol/JWT, PDF, firma, autoría histórica ni operación desplegada. Los apartados anteriores registran la primera implementación; su afirmación de falta de navegador queda actualizada por esta sección.
