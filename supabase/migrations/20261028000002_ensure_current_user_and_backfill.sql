-- ---------------------------------------------------------------------------
-- ensure_current_user: self-healing function callable by authenticated users
-- ---------------------------------------------------------------------------

create or replace function public.ensure_current_user()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_user auth.users%rowtype;
  v_default_categories text[] := array[
    'Mobile bill', 'Electricity', 'Internet', 'Grocery', 'Doctor / medical',
    'Rent', 'EMI / loan repayment', 'Transport', 'Education', 'Insurance',
    'Shopping', 'Entertainment', 'Household', 'Other expenses'
  ];
begin
  if v_user_id is null then
    return;
  end if;

  select * into v_user from auth.users where id = v_user_id;
  if not found then
    return;
  end if;

  insert into public.profiles (id, email, full_name)
  values (
    v_user.id,
    coalesce(v_user.email, v_user.phone, ''),
    coalesce(v_user.raw_user_meta_data ->> 'full_name', v_user.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (v_user.id)
  on conflict (user_id) do nothing;

  insert into public.expense_categories (user_id, name, is_default)
  select v_user.id, c, true
  from unnest(v_default_categories) as c
  on conflict do nothing;
end;
$$;

grant execute on function public.ensure_current_user() to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill any existing users in auth.users
-- ---------------------------------------------------------------------------

insert into public.profiles (id, email, full_name)
select
  id,
  coalesce(email, phone, ''),
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name')
from auth.users
on conflict (id) do nothing;

insert into public.user_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;

insert into public.expense_categories (user_id, name, is_default)
select u.id, c, true
from auth.users u
cross join unnest(array[
  'Mobile bill', 'Electricity', 'Internet', 'Grocery', 'Doctor / medical',
  'Rent', 'EMI / loan repayment', 'Transport', 'Education', 'Insurance',
  'Shopping', 'Entertainment', 'Household', 'Other expenses'
]) as c
on conflict do nothing;
