'use strict';
const api = require('./clinia-clean-api.cjs');
const query = `SELECT coalesce(json_agg(x),'[]') FROM (
 SELECT a.attname, r.name AS role,
   has_column_privilege(r.name,'public.appointments',a.attname,'INSERT') AS ins,
   has_column_privilege(r.name,'public.appointments',a.attname,'UPDATE') AS upd
 FROM pg_attribute a CROSS JOIN (VALUES ('authenticated'),('anon'),('service_role')) r(name)
 WHERE a.attrelid='public.appointments'::regclass AND a.attnum>0 AND NOT a.attisdropped
 ORDER BY r.name,a.attnum) x;`;
console.log(api.sql('clean-managed-1', query, 'postgres'));
