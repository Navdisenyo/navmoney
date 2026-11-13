ALTER TABLE public.income_transactions
  ADD COLUMN due_date date;
UPDATE public.income_transactions
  SET due_date = received_date
  WHERE due_date IS NULL;
CREATE INDEX income_transactions_user_due_date_idx
  ON public.income_transactions (user_id, due_date);

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

  SELECT COALESCE(SUM(amount), 0) INTO already_received
  FROM public.income_receipts
  WHERE income_transaction_id = NEW.income_transaction_id
    AND user_id = NEW.user_id
    AND (TG_OP <> 'UPDATE' OR id <> OLD.id);

  IF already_received + NEW.amount > transaction_total THEN
    RAISE EXCEPTION 'Receipt total cannot exceed expected income';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_income_receipt_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  target_income_id uuid;
  target_user_id uuid;
  transaction_total numeric(14,2);
  already_received numeric(14,2);
BEGIN
  target_income_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.income_transaction_id ELSE NEW.income_transaction_id END;
  target_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;

  SELECT amount INTO transaction_total
  FROM public.income_transactions
  WHERE id = target_income_id AND user_id = target_user_id;
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO already_received
  FROM public.income_receipts
  WHERE income_transaction_id = target_income_id AND user_id = target_user_id;

  UPDATE public.income_transactions
  SET status = CASE WHEN already_received >= transaction_total THEN 'received' ELSE 'expected' END
  WHERE id = target_income_id AND user_id = target_user_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER income_receipts_check_total
  BEFORE INSERT OR UPDATE ON public.income_receipts
  FOR EACH ROW EXECUTE FUNCTION public.check_income_receipt_total();
CREATE TRIGGER income_receipts_sync_status
  AFTER INSERT OR UPDATE OR DELETE ON public.income_receipts
  FOR EACH ROW EXECUTE FUNCTION public.sync_income_receipt_status();

INSERT INTO public.income_receipts (user_id, income_transaction_id, amount, received_date)
SELECT user_id, id, amount, received_date
FROM public.income_transactions
WHERE status = 'received';