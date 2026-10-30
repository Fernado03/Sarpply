-- 0003_append_only.sql — the ledger and the price snapshot reject mutation.

CREATE OR REPLACE FUNCTION reject_append_only_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER stock_movements_no_update
  BEFORE UPDATE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER stock_movements_no_delete
  BEFORE DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER stock_movements_no_truncate
  BEFORE TRUNCATE ON stock_movements
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER route_batch_prices_no_update
  BEFORE UPDATE ON route_batch_prices
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER route_batch_prices_no_delete
  BEFORE DELETE ON route_batch_prices
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();
