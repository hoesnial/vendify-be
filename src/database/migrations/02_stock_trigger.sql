-- ============================================
-- TRIGGER: Auto-update slots stock from stock_logs
-- ============================================

CREATE OR REPLACE FUNCTION update_stock_from_log()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the current_stock in slots table
    -- quantity_change contains the delta (negative for dispense, positive for restock)
    UPDATE slots
    SET current_stock = current_stock + NEW.quantity_change,
        updated_at = NOW()
    WHERE id = NEW.slot_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists to allow safe re-run
DROP TRIGGER IF EXISTS trigger_update_stock_from_log ON stock_logs;

CREATE TRIGGER trigger_update_stock_from_log
AFTER INSERT ON stock_logs
FOR EACH ROW
EXECUTE FUNCTION update_stock_from_log();
