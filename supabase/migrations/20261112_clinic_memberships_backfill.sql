-- Re-enrol every auth user into Perth Paediatrics + Azure Mind.
-- Fixes "Forbidden for this clinic" when opening referral originals.

insert into public.clinic_memberships (clinic_id, user_id, role)
select c.id, u.id, 'clinician'
from auth.users u
cross join public.clinics c
where c.slug in ('perth-paediatrics', 'azure-mind')
on conflict (clinic_id, user_id) do nothing;
