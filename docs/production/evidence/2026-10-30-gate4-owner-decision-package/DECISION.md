# Gate4 — decisión offline desde v5.36

**Recomendación:** acreditar primero la vía nativa de migración de `postgres`, sin ampliar autoridad, antes de escoger owner-split. No ejecutar otro sondeo del propietario ni preparar P/S. RC5 y recibos01/02 se conservan. Este paquete no está autorizado para publicación ni ejecución nativa.

| Estado | Conclusión |
|---|---|
| DEMOSTRADO | B02 rechazó `dependencies.0.schemaUsage`. El valor no fue retenido; no atribuir FALSE/NULL/tipo. Las otras dos dependencias permanecen NOT VERIFIED. Cliente normal no prueba cierre remoto ni resultado independiente de ROLLBACK. |
| DEMOSTRADO | El delta modifica únicamente `interpret`: tras validar estrictamente identidad/destino conserva tres observaciones con etiquetas fijas. Mantiene primer rechazo y requisitos globales; identidad inválida no produce metadata de dependencias. SQLd46, transporte, main y marcadores no cambian. |
| DEMOSTRADO | Prueba offline77/77:68 casos dirigidos conservados y9 nuevos. El primer harness falló30 comparaciones por objetos de distintos realms; se corrigió sólo el harness, preservando el log47/77. No CI nueva ni operaciones nativas. |
| DEDUCIDO | Elegir al propietario Storage no es necesariamente la única vía legítima de migración. La documentación nativa permite delegar administración de políticas por tabla; eso no acredita configuración efectiva en a9. |
| OBSERVACIÓN NECESARIA | Una observación consolidada como `postgres` debe determinar configuración nativa, autoridades actuales y dependencias; su credencial/turno/bundle ejecutable aún no están autorizados. |
| DECISIÓN AUTORIDAD | Si la vía nativa existente es aplicable y satisface todo el alcance, revisar un contrato para ese actor. Si no, resolver explícitamente autoridad mínima; no convertir al runtime Storage en administrador Auth. |

## Mecanismo nativo y anclaje

Supabase documenta `postgres` para administración y separa los roles internos Auth/Storage por servicio. Se deben distinguir migración, servicio y usuarios API. [Roles oficiales](https://supabase.com/docs/guides/database/postgres/roles).

`supautils` documenta `policy_grants` para administrar políticas sin propiedad y un indicador de versión para PostgreSQL17. Su configuración upstream actual incluye `postgres`/`storage.objects`; **son fuentes rolling, no prueba del binario ni configuración del digest fijado**. La biblioteca/proxy no debe cargarse, configurarse ni activarse para superar una guarda. Tampoco se recomienda superuser ni membresía privilegiada nueva. [Mecanismo](https://github.com/supabase/supautils#table-ownership-bypass), [configuración upstream](https://github.com/supabase/postgres/blob/develop/ansible/files/postgresql_config/supautils.conf.j2).

Anclaje demostrado local: PG170011 y DB `sha256:d6844e71062a3c8e2f8021d644802850760ef970a45ac163ec8c9f0171075bda`; Auth `sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b`; Storage `sha256:5b070fc2c6266e0e704f30d1772180ecb0890593f5176e7adb2f7a5a17ff3cd4`. CapturaCLI2.117.0 y plantilla StorageVERSION1.72.1 son procedencia documental; correspondencia digest→commit upstream, versiónAuth y configuración efectiva supautils siguen **null**. La propuesta no presume inaplicabilidad a17 ni presencia activa por documentación general.

## Autoridad completa, no sólo propietario

| Superficie | Requisito y límite |
|---|---|
| Public/P | CREATE/USAGE de esquemas, propietario para COMMENT/ALTER/ACL, CREATE de base si corresponde, tipos/lenguajes y dependencias. DefaultACL se aplica por creador efectivo; no equivale a permisos de otro miembro. [PrivilegiosPG17](https://www.postgresql.org/docs/17/ddl-priv.html), [DefaultACL](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html). |
| Locks10 | SHARE ROW EXCLUSIVE necesita autoridad apropiada — MAINTAIN/UPDATE/DELETE/TRUNCATE — no basta SELECT ni una delegación de políticas. No adquirir locks para diagnosticar. [LOCKPG17](https://www.postgresql.org/docs/17/sql-lock.html). |
| Auth2triggers | TRIGGER en auth.users y EXECUTE/resolución de ambas funciones; preservar propietario, políticas y servicio. [TriggersPG17](https://www.postgresql.org/docs/17/sql-createtrigger.html). |
| Storage22 | Propietario según SQL estándar o mecanismo nativo expresamente acreditado. El guard owner-only anterior no demuestra por sí solo que una delegación nativa sea imposible. Su revisión requeriría contrato nuevo, sin relajar identidad. [PolicyPG17](https://www.postgresql.org/docs/17/sql-createpolicy.html). |
| Resolución/post-P | Las22 políticas referencian sin esquema profiles/patients/billings y tres funciones públicas. `search_path` y USAGE importan aunque no aparezca `public.*`. P termina revocando publicUSAGE aPUBLIC y rolesAPI; no ampliar esa cuarentena. Fuente explícita no prueba ACL efectiva, definiciones transitivas, SQL dinámico ni comportamiento futuro. |
| Runtime | Validar por separado anon/authenticated/servicios y los SECURITY DEFINER ya existentes. La capacidad de crear política no concede a sus consumidores acceso a funciones/tablas. No crear nuevos helpers privilegiados ni alterar políticas clínicas. |

Si hubiera cambio necesario, una posibilidad **condicionada, no recomendación de GRANT ejecutable** sería USAGE de esquema exacto y EXECUTE sólo de firmas requeridas para el actor migrador, por propietario/grantor con grant option acreditado. No ALL sobre Auth, membresías, cambio de owner ni autoridad persistente por defecto. Grantor/alcance/duración concretos quedan null hasta la observación; comparar huellas antes/después y revertir únicamente una concesión temporal propia, sin revocar accesos ajenos.

## Próximo paso único

`authority-observation.proposed.sql` reúne6 roles,5 esquemas,41 relaciones esperadas y33 firmas; sólo catálogos, predicados y metadatos GUC permitidos. Cero cuerpos, datos, locks adquiridos o DDL. Una sesión directa `postgres`, READ ONLY, sin fallback/retry; falta autorización y transporte/bundle/CI exactos. Si la identidad falla no entrega metadata. Cualquier error de acceso detiene todo; nunca otorgar permisos para completar la observación.

No se generan payloads P/S. Las autoridades futuras, conservación, resolución post-P y recuperación de estados parciales continúan abiertas. Primero raíz integra/revisa/sella un SHA exacto; una aprobación específica debe cubrir su publicación/CI y otra la observación nativa. Los campos no acreditados siguen null.
