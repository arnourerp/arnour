-- Release 55: a live role can go back to draft without telling its applicants "the role is now closed".
-- Before: any change of a role away from "open" sent every applicant "...has decided not to move forward this time".
-- Now: that message (and the closing time) only comes with closed / filled. Moving to draft sends nothing and clears the closing time.
-- Applicants keep their applications; they still see the role (marked "On hold" in the app), nobody else does.
create or replace function public._job_closed() returns trigger
language plpgsql security definer set search_path = public as
$$
declare a record; who text; ttl text;
begin
  if old.status = 'open' and new.status in ('closed', 'filled') then
    new.closed_ts := (extract(epoch from now())*1000)::bigint;
    ttl := left(coalesce(new.data->>'title', 'the role'), 120);
    for a in select * from public.applications where job_id = new.id and not closed_notified and consultant_id is distinct from new.hired_id loop
      who := public._ent_label_job(new.company_id, a.consultant_id, new.id);
      insert into public.notifications(user_key, type, text, link)
      values (a.consultant_id, 'job', 'The role "' || ttl || '" is now closed. Thank you for applying — ' || who || ' has decided not to move forward this time.', '#/c/applied');
    end loop;
    update public.applications set closed_notified = true where job_id = new.id and consultant_id is distinct from new.hired_id;
  elsif new.status = 'draft' then
    new.closed_ts := null;
  elsif old.status <> 'open' and new.status = 'open' then
    new.closed_ts := null;
  end if;
  return new;
end $$;

select 'ok' as release55;
