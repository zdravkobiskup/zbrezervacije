ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS base_price numeric,
  ADD COLUMN IF NOT EXISTS sale_price numeric,
  ADD COLUMN IF NOT EXISTS lowest_price_30d numeric;
COMMENT ON COLUMN public.services.base_price IS 'Base price as of 10.09.2026';
UPDATE public.services SET base_price = price WHERE base_price IS NULL;
CREATE OR REPLACE FUNCTION public.clear_lowest_without_sale()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.sale_price IS NULL THEN NEW.lowest_price_30d := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_clear_lowest_without_sale ON public.services;
CREATE TRIGGER trg_clear_lowest_without_sale BEFORE INSERT OR UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.clear_lowest_without_sale();