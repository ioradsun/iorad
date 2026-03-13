create or replace function public.get_dashboard_company_stats()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total', count(*)::int,
    'school', count(*) filter (where category = 'school')::int,
    'business', count(*) filter (where category = 'business' or category is null)::int,
    'partner', count(*) filter (where category = 'partner')::int,
    'newThisWeek', count(*) filter (where created_at >= now() - interval '7 days')::int,
    'stageCounts', jsonb_build_object(
      'prospect', count(*) filter (where stage = 'prospect')::int,
      'active_opp', count(*) filter (where stage = 'active_opp')::int,
      'customer', count(*) filter (where stage = 'customer')::int,
      'expansion', count(*) filter (where stage = 'expansion')::int
    )
  )
  from public.companies;
$$;
