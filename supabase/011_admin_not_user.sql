-- =====================================================================
-- 011 · Admin accounts are not marketplace users
-- Anything an admin account owns (a professional or company profile, roles,
-- community posts) is hidden from everyone else. Nothing is deleted, so it
-- comes back if the account is ever removed from admin_emails. The admin
-- still sees their own rows. Needs 001 and 005. Safe to run again.
-- =====================================================================
create or replace function public._visible(p_owner uuid, p_sample boolean) returns boolean
language sql stable security definer set search_path = public, auth as
$$ select not (coalesce(p_sample,false) and public._hide_samples())
      and not coalesce((select suspended from public.profiles where user_id = p_owner), false)
      and not exists (select 1 from public.admin_emails ae join auth.users u on lower(u.email) = lower(ae.email) where u.id = p_owner) $$;
