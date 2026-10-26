# Clinia+ RC4 — Auth y transporte

Sucesor coherente de48e2e97c048ce0167422eb8ccbb3bc30a879f879:8 archivos del delta Auth Step2 (parche58fb0f91…) y4 del transporte Gate1 (3d0ed8c635fa4a4c47e414bfc4424bac3b0c743d), sin mezclar árboles ajenos.

Resend utiliza el endpoint Auth soportado después de la cuota existente, responde accepted de forma uniforme y la UI no afirma entrega. Elimina la consulta de directorio y las promesas numéricas Auth TTL no comprobadas. El template SMTP propuesto y redirect deben verificarse/autorizarse antes de instalarse; no se cambió configuración alojada. La propuesta de cuota actualizada requiere4HTTP/máximo2correos en destino aislado autorizado; no está ejecutada ni autorizada por este commit.

S3 firma con project_ref y conserva el JWT original de sesión. Requiere capacidad Storagefeature1340/v1.78.0; despliegue managed aún sin verificar. Proveedor incompatible falla cerrado: sin anonlegacy, REST, URLfirmada, clavesS3bypass ni service_role como fallback. No se habilita broker ni se modifica autoridad.

Logger, rutas privadas, cuotas, inscripción, SQL, dependencias/lockfile, workflows y cierreM0 permanecen intactos. CI/Preview propios del nuevo SHA y runtime siguen pendientes;477/Ready del padre no se heredan. El RC_HANDOFF canónico y las matrices actuales están fuera de este commit en el workspace del integrador. No FINAL ni GO; sin Production, rotación compartida, compras ni aceptación humana inferida.
