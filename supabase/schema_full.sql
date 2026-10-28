-- ============================================================================
-- Personal Investment / Income / Expense / Savings app — initial schema
--
-- Tables: profiles, user_settings, expense_categories, investments,
--         income_transactions, expenses, loans, emi_payments
--
-- Ownership model: every user-owned row carries user_id referencing
-- public.profiles, which references auth.users. Cross-record integrity
-- (e.g. an expense's category or an income's investment must belong to the
-- same user) is enforced with composite foreign keys on (id, user_id), so a
-- row can never point at another user's record — not even via a crafted id.
--
-- Money: numeric(14,2) everywhere (never float). Rounding of derived values
-- happens in the app calculation layer, consistently half-up, 2 decimals.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (the only table that may reference auth.users directly)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- user_settings — one row per user, created automatically at signup
-- ---------------------------------------------------------------------------

create table public.user_settings (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  currency       text not null default 'INR' check (btrim(currency) <> ''),
  date_format    text not null default 'DD/MM/YYYY' check (btrim(date_format) <> ''),
  week_start     text not null default 'MON' check (week_start in ('MON', 'SUN')),
  monthly_budget numeric(14, 2) check (monthly_budget is null or monthly_budget >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- expense_categories — default categories seeded per user at signup;
-- users can add custom categories. Unique per user (case-insensitive).
-- (id, user_id) is uniquely indexed so other tables can build composite
-- foreign keys that guarantee same-user references.
-- ---------------------------------------------------------------------------

create table public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (btrim(name) <> ''),
  color      text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index expense_categories_user_name_unique
  on public.expense_categories (user_id, lower(btrim(name)));
create unique index expense_categories_id_user_unique
  on public.expense_categories (id, user_id);
create index expense_categories_user_idx on public.expense_categories (user_id);

-- ---------------------------------------------------------------------------
-- investments
-- ---------------------------------------------------------------------------

create table public.investments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  name               text not null check (btrim(name) <> ''),
  type               text not null check (type in (
                       'fd', 'rd', 'savings_account', 'mutual_fund', 'stocks',
                       'bonds', 'ppf', 'epf', 'real_estate', 'other')),
  institution        text,
  principal_amount   numeric(14, 2) not null check (principal_amount >= 0),
  current_value      numeric(14, 2) check (current_value is null or current_value >= 0),
  annual_rate        numeric(6, 3) not null default 0 check (annual_rate >= 0),
  rate_type          text not null default 'fixed' check (rate_type in ('fixed', 'variable')),
  start_date         date not null,
  maturity_date      date check (maturity_date is null or maturity_date >= start_date),
  compounding_method text not null default 'annually' check (compounding_method in (
                       'simple', 'monthly', 'quarterly', 'half_yearly', 'annually')),
  payout_frequency   text not null default 'reinvested' check (payout_frequency in (
                       'monthly', 'quarterly', 'annually', 'at_maturity', 'reinvested', 'variable')),
  notes              text,
  status             text not null default 'active' check (status in ('active', 'matured', 'closed')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint investments_current_value_type_check check (
    current_value is null or type in ('savings_account', 'mutual_fund', 'stocks', 'real_estate', 'other'))
);

create unique index investments_id_user_unique on public.investments (id, user_id);
create index investments_user_status_idx on public.investments (user_id, status);
create index investments_user_type_idx on public.investments (user_id, type);
create index investments_user_start_date_idx on public.investments (user_id, start_date);

-- ---------------------------------------------------------------------------
-- income_transactions
-- investment_income rows may optionally link to an investment owned by the
-- same user (composite FK). Deleting the investment nulls the link, never
-- the ownership column.
-- Anti-duplicate guard: the same received income (user, category, title,
-- date, amount) can be recorded only once, so received cash flow cannot be
-- silently double-counted.
-- ---------------------------------------------------------------------------

create table public.income_transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  investment_id  uuid,
  title          text not null check (btrim(title) <> ''),
  category       text not null check (category in (
                   'salary', 'business', 'rental', 'investment_income',
                   'freelance', 'other')),
  amount         numeric(14, 2) not null check (amount > 0),
  received_date  date not null,
  recurrence     text not null default 'one_time' check (recurrence in (
                   'one_time', 'weekly', 'monthly', 'quarterly', 'annually')),
  status         text not null default 'expected' check (status in ('expected', 'received')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint income_investment_link_category_check check (
    investment_id is null or category = 'investment_income')
);

alter table public.income_transactions
  add constraint income_transactions_investment_fk
  foreign key (investment_id, user_id)
  references public.investments (id, user_id)
  on delete set null (investment_id) on update cascade;

create unique index income_transactions_received_dedupe
  on public.income_transactions (user_id, category, title, received_date, amount)
  where status = 'received';
create index income_transactions_user_received_idx
  on public.income_transactions (user_id, received_date);
create index income_transactions_user_status_idx
  on public.income_transactions (user_id, status, received_date);
create index income_transactions_user_category_idx
  on public.income_transactions (user_id, category);
create index income_transactions_investment_idx
  on public.income_transactions (investment_id);

-- ---------------------------------------------------------------------------
-- expenses
-- category_id must belong to the same user (composite FK). An expense may
-- reference one EMI payment (same-user composite FK, added below after
-- emi_payments exists) — that link is the single source of truth that stops
-- an EMI from being counted once in the EMI module and again as an expense.
-- Anti-duplicate guard for generated recurring rows: same user/title/due
-- date/amount recurring expense can exist only once.
-- ---------------------------------------------------------------------------

create table public.expenses (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  category_id         uuid not null references public.expense_categories (id) on delete cascade,
  emi_payment_id      uuid,
  title               text not null check (btrim(title) <> ''),
  amount              numeric(14, 2) not null check (amount > 0),
  due_date            date not null,
  payment_date        date,
  payment_status      text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'overdue')),
  recurrence          text not null default 'one_time' check (recurrence in (
                        'one_time', 'weekly', 'monthly', 'quarterly', 'annually')),
  payment_method      text,
  notes               text,
  recurrence_end_date date check (recurrence_end_date is null or recurrence_end_date >= due_date),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint expenses_paid_requires_payment_date check (
    payment_status <> 'paid' or payment_date is not null)
);

alter table public.expenses
  add constraint expenses_category_fk
  foreign key (category_id, user_id)
  references public.expense_categories (id, user_id)
  on update cascade;

create unique index expenses_id_user_unique on public.expenses (id, user_id);
create unique index expenses_recurring_dedupe
  on public.expenses (user_id, title, due_date, amount)
  where recurrence <> 'one_time';
create unique index expenses_emi_payment_unique
  on public.expenses (emi_payment_id) where emi_payment_id is not null;
create index expenses_user_due_date_idx on public.expenses (user_id, due_date);
create index expenses_user_status_idx on public.expenses (user_id, payment_status, due_date);
create index expenses_user_category_idx on public.expenses (user_id, category_id);
create index expenses_user_payment_date_idx on public.expenses (user_id, payment_date);
create index expenses_user_recurrence_idx on public.expenses (user_id, recurrence);

-- ---------------------------------------------------------------------------
-- loans
-- ---------------------------------------------------------------------------

create table public.loans (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  name                   text not null check (btrim(name) <> ''),
  lender                 text,
  original_amount        numeric(14, 2) not null check (original_amount >= 0),
  outstanding_principal  numeric(14, 2) check (outstanding_principal is null or outstanding_principal >= 0),
  emi_amount             numeric(14, 2) not null check (emi_amount > 0),
  interest_rate          numeric(6, 3) check (interest_rate is null or interest_rate >= 0),
  start_date             date not null,
  end_date               date check (end_date is null or end_date >= start_date),
  monthly_due_day        smallint not null check (monthly_due_day between 1 and 28),
  remaining_installments integer check (remaining_installments is null or remaining_installments >= 0),
  status                 text not null default 'active' check (status in ('active', 'closed')),
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index loans_id_user_unique on public.loans (id, user_id);
create index loans_user_status_idx on public.loans (user_id, status);

-- ---------------------------------------------------------------------------
-- emi_payments — one row per installment. (loan_id, installment_number) is
-- unique per loan so the same installment can never be recorded twice.
-- ---------------------------------------------------------------------------

create table public.emi_payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  loan_id            uuid not null,
  installment_number integer not null check (installment_number >= 1),
  due_date           date not null,
  amount             numeric(14, 2) not null check (amount > 0),
  status             text not null default 'unpaid' check (status in ('unpaid', 'paid', 'overdue')),
  paid_date          date check (status <> 'paid' or paid_date is not null),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint emi_payments_loan_fk
    foreign key (loan_id, user_id)
    references public.loans (id, user_id)
    on delete cascade on update cascade,

  constraint emi_payments_loan_installment_unique unique (loan_id, installment_number)
);

create unique index emi_payments_id_user_unique on public.emi_payments (id, user_id);
create index emi_payments_user_due_date_idx on public.emi_payments (user_id, due_date);
create index emi_payments_user_status_idx on public.emi_payments (user_id, status, due_date);
create index emi_payments_loan_due_idx on public.emi_payments (loan_id, due_date);

-- Link expenses <-> EMI payments (same-user composite FK; deleting the EMI
-- payment only clears the link on the expense).
alter table public.expenses
  add constraint expenses_emi_payment_fk
  foreign key (emi_payment_id, user_id)
  references public.emi_payments (id, user_id)
  on delete set null (emi_payment_id) on update cascade;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
create trigger trg_expense_categories_updated_at before update on public.expense_categories
  for each row execute function public.set_updated_at();
create trigger trg_investments_updated_at before update on public.investments
  for each row execute function public.set_updated_at();
create trigger trg_income_transactions_updated_at before update on public.income_transactions
  for each row execute function public.set_updated_at();
create trigger trg_expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
create trigger trg_loans_updated_at before update on public.loans
  for each row execute function public.set_updated_at();
create trigger trg_emi_payments_updated_at before update on public.emi_payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Signup provisioning (allowed auth-lifecycle trigger): every new user gets
-- a profile, user settings (INR default) and the 14 default expense
-- categories automatically.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_categories text[] := array[
    'Mobile bill', 'Electricity', 'Internet', 'Grocery', 'Doctor / medical',
    'Rent', 'EMI / loan repayment', 'Transport', 'Education', 'Insurance',
    'Shopping', 'Entertainment', 'Household', 'Other expenses'
  ];
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, new.phone, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.expense_categories (user_id, name, is_default)
  select new.id, c, true
  from unnest(v_default_categories) as c
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the cached profile email in sync when the auth user changes it.
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = coalesce(new.email, new.phone, '')
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email, phone on auth.users
  for each row execute function public.handle_user_updated();

-- ---------------------------------------------------------------------------
-- Lock down helper functions: no direct execution by clients
-- ---------------------------------------------------------------------------

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_updated() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security — strict per-owner isolation
-- Every table gets RLS enabled plus owner-scoped policies for the
-- authenticated role. anon gets no grants and no policies: zero access.
-- ---------------------------------------------------------------------------

alter table public.profiles           enable row level security;
alter table public.user_settings      enable row level security;
alter table public.expense_categories enable row level security;
alter table public.investments        enable row level security;
alter table public.income_transactions enable row level security;
alter table public.expenses           enable row level security;
alter table public.loans              enable row level security;
alter table public.emi_payments       enable row level security;

-- profiles: users may read and edit only their own profile. Row creation and
-- deletion are handled by the auth lifecycle triggers / auth cascade.
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- user_settings
create policy "user_settings_select_own" on public.user_settings
  for select to authenticated using (user_id = auth.uid());
create policy "user_settings_update_own" on public.user_settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- expense_categories
create policy "expense_categories_select_own" on public.expense_categories
  for select to authenticated using (user_id = auth.uid());
create policy "expense_categories_insert_own" on public.expense_categories
  for insert to authenticated with check (user_id = auth.uid() and is_default = false);
create policy "expense_categories_update_own" on public.expense_categories
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "expense_categories_delete_own" on public.expense_categories
  for delete to authenticated using (user_id = auth.uid());

-- investments
create policy "investments_select_own" on public.investments
  for select to authenticated using (user_id = auth.uid());
create policy "investments_insert_own" on public.investments
  for insert to authenticated with check (user_id = auth.uid());
create policy "investments_update_own" on public.investments
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "investments_delete_own" on public.investments
  for delete to authenticated using (user_id = auth.uid());

-- income_transactions
create policy "income_transactions_select_own" on public.income_transactions
  for select to authenticated using (user_id = auth.uid());
create policy "income_transactions_insert_own" on public.income_transactions
  for insert to authenticated with check (user_id = auth.uid());
create policy "income_transactions_update_own" on public.income_transactions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "income_transactions_delete_own" on public.income_transactions
  for delete to authenticated using (user_id = auth.uid());

-- expenses
create policy "expenses_select_own" on public.expenses
  for select to authenticated using (user_id = auth.uid());
create policy "expenses_insert_own" on public.expenses
  for insert to authenticated with check (user_id = auth.uid());
create policy "expenses_update_own" on public.expenses
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "expenses_delete_own" on public.expenses
  for delete to authenticated using (user_id = auth.uid());

-- loans
create policy "loans_select_own" on public.loans
  for select to authenticated using (user_id = auth.uid());
create policy "loans_insert_own" on public.loans
  for insert to authenticated with check (user_id = auth.uid());
create policy "loans_update_own" on public.loans
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "loans_delete_own" on public.loans
  for delete to authenticated using (user_id = auth.uid());

-- emi_payments
create policy "emi_payments_select_own" on public.emi_payments
  for select to authenticated using (user_id = auth.uid());
create policy "emi_payments_insert_own" on public.emi_payments
  for insert to authenticated with check (user_id = auth.uid());
create policy "emi_payments_update_own" on public.emi_payments
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "emi_payments_delete_own" on public.emi_payments
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants. The Data API has no default privileges on public, so grant
-- explicitly. anon is deliberately left without any grant: no anonymous
-- access to financial data. service_role keeps full access for server code.
-- ---------------------------------------------------------------------------

grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select, update on public.user_settings to authenticated;
grant all on public.user_settings to service_role;

grant select, insert, update, delete on public.expense_categories to authenticated;
grant all on public.expense_categories to service_role;

grant select, insert, update, delete on public.investments to authenticated;
grant all on public.investments to service_role;

grant select, insert, update, delete on public.income_transactions to authenticated;
grant all on public.income_transactions to service_role;

grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;

grant select, insert, update, delete on public.loans to authenticated;
grant all on public.loans to service_role;

grant select, insert, update, delete on public.emi_payments to authenticated;
grant all on public.emi_payments to service_role;

-- Defense in depth: make sure anon has nothing on any of these tables.
revoke all on public.profiles, public.user_settings, public.expense_categories,
  public.investments, public.income_transactions, public.expenses,
  public.loans, public.emi_payments
from anon;
alter function public.set_updated_at() set search_path = '';
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.handle_user_updated() set search_path = public, pg_temp;-- ---------------------------------------------------------------------------
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
