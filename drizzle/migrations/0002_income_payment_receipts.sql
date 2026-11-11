CREATE UNIQUE INDEX IF NOT EXISTS income_transactions_id_user_unique
  ON public.income_transactions (id, user_id);
CREATE TABLE public.income_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  income_transaction_id uuid NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  received_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT income_receipts_income_owner_fk
    FOREIGN KEY (income_transaction_id, user_id)
    REFERENCES public.income_transactions (id, user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_receipts TO authenticated;
GRANT ALL ON public.income_receipts TO service_role;
ALTER TABLE public.income_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY income_receipts_select_own ON public.income_receipts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY income_receipts_insert_own ON public.income_receipts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY income_receipts_update_own ON public.income_receipts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY income_receipts_delete_own ON public.income_receipts
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX income_receipts_income_date_idx
  ON public.income_receipts (user_id, income_transaction_id, received_date);