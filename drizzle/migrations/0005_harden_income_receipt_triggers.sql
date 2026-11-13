CREATE OR REPLACE FUNCTION public.check_income_receipt_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  transaction_total numeric(14,2);
  already_received numeric(14,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.user_id IS DISTINCT FROM OLD.user_id OR
    NEW.income_transaction_id IS DISTINCT FROM OLD.income_transaction_id
  ) THEN
    RAISE EXCEPTION 'Receipt ownership and income link cannot be changed';
  END IF;

  SELECT amount INTO transaction_total
  FROM public.income_transactions
  WHERE id = NEW.income_transaction_id AND user_id = NEW.user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Income record not found';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(SUM(amount), 0) INTO already_received
    FROM public.income_receipts
    WHERE income_transaction_id = NEW.income_transaction_id
      AND user_id = NEW.user_id
      AND id <> OLD.id;
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO already_received
    FROM public.income_receipts
    WHERE income_transaction_id = NEW.income_transaction_id
      AND user_id = NEW.user_id;
  END IF;

  IF already_received + NEW.amount > transaction_total THEN
    RAISE EXCEPTION 'Receipt total cannot exceed expected income';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_income_receipt_total() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_income_receipt_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_income_transaction_payments() FROM PUBLIC, anon, authenticated;