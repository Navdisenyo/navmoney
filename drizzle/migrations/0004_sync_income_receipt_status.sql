CREATE OR REPLACE FUNCTION public.guard_income_transaction_payments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  already_received numeric(14,2);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO already_received
  FROM public.income_receipts
  WHERE income_transaction_id = NEW.id AND user_id = NEW.user_id;

  IF already_received > NEW.amount THEN
    RAISE EXCEPTION 'Income total cannot be less than payments already received';
  END IF;

  NEW.status := CASE
    WHEN already_received > 0 AND already_received >= NEW.amount THEN 'received'
    ELSE 'expected'
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER income_transactions_sync_receipt_status
  BEFORE INSERT OR UPDATE ON public.income_transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_income_transaction_payments();

UPDATE public.income_transactions SET status = status;