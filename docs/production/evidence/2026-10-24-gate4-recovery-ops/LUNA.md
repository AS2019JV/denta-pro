# Luna6 — única revisión acotada del delta Gate4

Revisión estática y READ ONLY, sin auditoría general, ejecución independiente, suite ni restore. No constituye aceptación humana.

Luna6 señaló dos defectos materiales:
1. El contrato selectivo podía devolver PASS sin comprobar no-store/Range exigidos por el runbook.
2. La guarda del kit revisaba reparse del archivo final sin comprobar todos los directorios antecesores.

Disposición por el agente principal, sin segunda revisión:
- Corregido: entrega completa exige no-store; Range exige206, inicio/fin/total,8bytes(o tamaño menor),hash exacto del prefijo y no-store. Nuevas regresiones de esas omisiones PASS; suite del delta15/15.
- Corregido: Assert-KitNoReparse recorre archivo y todos los antecesores; también comprueba padres de destinos. Prueba REAL con junction en un antecesor de un archivo sintético: rechazo esperado, ruta ordinaria aceptada. Recibo kit-junction-negative.json.
- Kit01 se conserva como histórico previo a esos fixes. Kit02 nuevo usa las correcciones, se extrajo en otro directorio y verificó todas las huellas y164pins. Ningún restore repetido.

Luna también confirmó que los recibos delimitan custodia en el mismo equipo, sin offsite/operador independiente, sin backup/clave/imágenes en el kit, decisión BLOCKED y operationalGo=false. Se añadió measurementScope explícito a la salida final del evaluador para distinguir los130.356s históricos de p8 del RTO operativo no verificado.

Resultado de revisión: PARTIAL con los dos hallazgos anteriores corregidos y comprobados por el principal; sin re-review de Luna ni PASS de producción.
