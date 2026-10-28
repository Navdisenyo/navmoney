<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Architecture rules

- Personal finance app (investments, income, expenses, loans/EMIs). All app
  tables live in `public` and carry `user_id` referencing `public.profiles`
  (never `auth.users` directly). Strict per-owner RLS: one USING/WITH CHECK
  policy per operation per table, scoped to `auth.uid()`. Cross-user
  references are impossible by design: composite FKs on (id, user_id).
- Money columns are always `numeric(14,2)` — never float. Values: amounts
  must be > 0 (income/expense/EMI), >= 0 for principal/loan amounts.
- Auth methods enabled: email/password (confirmation on, no auto-confirm),
  Google, and Lovable. Signup provisioning (profile + user_settings with INR
  default + 14 default expense categories) happens in the
  `handle_new_user` trigger on auth.users — do not seed these in app code.
- Never create new Supabase Edge Functions for app logic; use
  `createServerFn` with `requireSupabaseAuth` middleware (bearer attacher
  `attachSupabaseAuth` is registered in `src/start.ts`) for anything reading
  user data, so RLS applies. Public routes under `/api/public/` must verify
  the caller themselves.
- EMI double-count prevention: a paid EMI payment is linked to exactly one
  expense row via `expenses.emi_payment_id` (partial-unique index). Cash-flow
  sums must use that link, not both modules.
- Duplicate guards: unique index on received income
  (user, category, title, received_date, amount) and on recurring expenses
  (user, title, due_date, amount); recurring-expense generation must rely on
  these plus an idempotent generation key, never "check then insert".
