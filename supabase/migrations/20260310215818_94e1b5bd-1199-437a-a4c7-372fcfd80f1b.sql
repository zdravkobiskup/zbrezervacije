
-- Function to check low stock and create notifications
CREATE OR REPLACE FUNCTION public.check_low_stock_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_business_owner_id uuid;
  v_material_name text;
  v_current_qty numeric;
  v_min_qty numeric;
  v_unit text;
BEGIN
  -- Only trigger on quantity decrease
  IF NEW.current_quantity < OLD.current_quantity AND NEW.current_quantity <= NEW.min_quantity THEN
    -- Get material info and business owner
    SELECT b.owner_id, NEW.name, NEW.current_quantity, NEW.min_quantity, NEW.unit
    INTO v_business_owner_id, v_material_name, v_current_qty, v_min_qty, v_unit
    FROM public.businesses b
    WHERE b.id = NEW.business_id;

    IF v_business_owner_id IS NOT NULL THEN
      -- Check if we already sent a notification for this material in last 24h
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = v_business_owner_id
          AND type = 'low_stock'
          AND message LIKE '%' || v_material_name || '%'
          AND created_at > now() - interval '24 hours'
      ) THEN
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
          v_business_owner_id,
          'Niska zaliha: ' || v_material_name,
          v_material_name || ' ima samo ' || v_current_qty || ' ' || v_unit || ' (minimum: ' || v_min_qty || ' ' || v_unit || '). Preporučamo narudžbu.',
          'low_stock'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on materials table when quantity changes
CREATE TRIGGER check_low_stock_after_update
  AFTER UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.check_low_stock_notifications();
