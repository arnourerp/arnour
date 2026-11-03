-- Release 44: draft roles.
-- A draft is a role with status 'draft' (already allowed by save_job; only the owner can see it, nobody is matched or alerted).
-- When a draft is published (draft -> open) its "posted" time restarts, so it does not look days old on its first day.
create or replace function public._job_publish_ts() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if old.status = 'draft' and new.status = 'open' then
    new.posted_ts := (extract(epoch from now())*1000)::bigint;
  end if;
  return new;
end $$;

drop trigger if exists jobs_publish_ts on public.jobs;
create trigger jobs_publish_ts before update on public.jobs for each row execute function public._job_publish_ts();

revoke execute on function public._job_publish_ts() from public, anon, authenticated;

select 'ok' as release44;
