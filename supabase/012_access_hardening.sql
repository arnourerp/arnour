-- release28: access hardening
-- 1) admin functions can no longer be called by signed-out visitors at all (they already refused inside)
-- 2) an admin must have a CONFIRMED email address (an unconfirmed sign-up with the admin's email is never admin)
create or replace function public._is_admin() returns boolean
language sql stable security definer set search_path = public, auth as
$$ select auth.uid() is not null and exists (
     select 1 from public.admin_emails a join auth.users u on lower(u.email) = lower(a.email)
      where u.id = auth.uid() and u.email_confirmed_at is not null) $$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and p.proname not like '\_%'
       and (p.proname like 'admin\_%' or p.prosrc like '%_require_admin%')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

select 'ok' as release28;
