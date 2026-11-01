-- Release 32: module families for BTP / Data / IBP modules (match fix).
-- The catalog stores only fin/log/tech, so those modules had no family. They now fall back to the built-in family,
-- exactly like the website (APP.MODULE_FAMILY_DEFAULT). Catalog value still wins when set.
create or replace function public._m_fam(mod text) returns text
language sql stable security definer set search_path = public as
$$ select coalesce(
  (select family from public.catalog_modules where id = mod and family <> '' order by (select pos from public.catalog_products p where p.id = product_id), product_id limit 1),
  case
    when mod in ('fi','co','cfin','groupreporting','trm','fico','fscm','grants') then 'fin'
    when mod in ('sd','mm','pp','qm','pm','ewm','tm','cs','ps','scm','cbc','ehs','gts') then 'log'
    when mod in ('abap','basis','hanadba','securitygrc','solman','po','bobods','fioriui5') then 'tech'
    when mod in ('integration','eventmesh') then 'btp-int'
    when mod in ('buildapps','buildpa','basfiori','cap','abapcloud','workzone') then 'btp-build'
    when mod in ('btpadmin','identity','hanacloud') then 'btp-plat'
    when mod in ('bistories','planning') then 'da-analytics'
    when mod in ('datasphere','bw','bods') then 'da-dwh'
    when mod in ('mdg','datamigration','archiving') then 'da-gov'
    when mod in ('ibp') then 'scm-plan'
    when mod in ('dmc','apm','oms') then 'scm-exec'
    else null end) $$;

revoke execute on function public._m_fam(text) from public, anon, authenticated;

select 'ok' as release32;
