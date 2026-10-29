BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
SELECT 'OWNER_V_ID:'||jsonb_build_object(
 'identity',jsonb_build_object('sessionUser',session_user,'currentUser',current_user,'database',current_database(),'version',current_setting('server_version_num'),'readOnly',current_setting('transaction_read_only'),'defaultReadOnly',current_setting('default_transaction_read_only'),'serverAddress',host(inet_server_addr()),'serverPort',inet_server_port()),
 'object',(SELECT jsonb_build_object('schema',n.nspname,'name',c.relname,'oid',c.oid::text,'ownerOID',c.relowner::text,'owner',r.rolname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='storage' AND c.relname='objects'),
 'permissions',jsonb_build_object('storageSchemaUsage',has_schema_privilege(current_user,'storage','USAGE'),'storageSchemaCreate',has_schema_privilege(current_user,'storage','CREATE'),'objectsSelect',has_table_privilege(current_user,'storage.objects','SELECT'),'objectsTrigger',has_table_privilege(current_user,'storage.objects','TRIGGER'),'effectiveOwner',(SELECT pg_has_role(current_user,c.relowner,'USAGE') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND c.relname='objects'))
)::text;
ROLLBACK;