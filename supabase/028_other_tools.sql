-- Release 48: "Other tools & third-party solutions" (free text) on professional profiles.
-- It is visible to companies like the other skills text (an anonymous profile still shows it, it contains no name).
create or replace function public._consultant_public_keys() returns text[]
language sql immutable as
$$ select array['firstName','lastName','headline','summary','city','country','nationality','availability',
               'industries','languages','level','linkedin','otherSkills','otherTools','photo','programs','roleType','roleTypes','skills','specialties','workPrefs','yearsExp'] $$;

select 'ok' as release48;
