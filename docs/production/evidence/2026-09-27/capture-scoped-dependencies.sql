WITH objs AS (
SELECT 'pg_class'::regclass AS classid,c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal')
UNION ALL SELECT 'pg_proc'::regclass,p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','logs','security_internal')
UNION ALL SELECT 'pg_type'::regclass,t.oid FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','logs','security_internal')
UNION ALL SELECT 'pg_constraint'::regclass,k.oid FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace WHERE n.nspname IN ('public','logs','security_internal')
UNION ALL SELECT 'pg_attrdef'::regclass,a.oid FROM pg_attrdef a JOIN pg_class c ON c.oid=a.adrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal')
UNION ALL SELECT 'pg_rewrite'::regclass,r.oid FROM pg_rewrite r JOIN pg_class c ON c.oid=r.ev_class JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal')
UNION ALL SELECT 'pg_policy'::regclass,p.oid FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','logs','security_internal','storage')
UNION ALL SELECT 'pg_trigger'::regclass,t.oid FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace fn ON fn.oid=p.pronamespace WHERE NOT t.tgisinternal AND (n.nspname IN ('public','logs','security_internal') OR (n.nspname='auth' AND fn.nspname IN ('public','logs','security_internal')))
)
SELECT clock_timestamp() AS "capturedAt",coalesce(jsonb_agg(jsonb_build_object('dependent',pg_identify_object(d.classid,d.objid,d.objsubid)::text,'referenced',pg_identify_object(d.refclassid,d.refobjid,d.refobjsubid)::text,'type',d.deptype) ORDER BY pg_identify_object(d.classid,d.objid,d.objsubid)::text,pg_identify_object(d.refclassid,d.refobjid,d.refobjsubid)::text,d.deptype),'[]') AS dependencies FROM pg_depend d JOIN objs o ON o.classid=d.classid AND o.oid=d.objid;

