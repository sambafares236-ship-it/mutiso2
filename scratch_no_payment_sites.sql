select s.id, s.site_name, s.subscription_tier, s.subscription_start, s.subscription_end, s.approved_at, p.email_address, p.full_name
from public.sites s
join public.profiles p on p.id = s.owner_id
where s.status = 'active'
  and not exists (select 1 from public.subscription_payment sp where sp.site_id = s.id and sp.status = 'completed')
order by s.approved_at asc nulls last;
