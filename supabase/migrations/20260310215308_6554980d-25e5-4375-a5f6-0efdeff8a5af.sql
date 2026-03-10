
-- Materials/inventory table
CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'kom',
  current_quantity numeric NOT NULL DEFAULT 0,
  min_quantity numeric NOT NULL DEFAULT 0,
  price_per_unit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage materials" ON public.materials
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = materials.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = materials.business_id AND b.owner_id = auth.uid()));

-- Service materials (normatives) - how much material each service uses
CREATE TABLE public.service_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  quantity_needed numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_id, material_id)
);

ALTER TABLE public.service_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage service materials" ON public.service_materials
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.services s 
    JOIN public.businesses b ON b.id = s.business_id 
    WHERE s.id = service_materials.service_id AND b.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.services s 
    JOIN public.businesses b ON b.id = s.business_id 
    WHERE s.id = service_materials.service_id AND b.owner_id = auth.uid()
  ));

-- Material transactions log
CREATE TABLE public.material_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  quantity_change numeric NOT NULL,
  type text NOT NULL DEFAULT 'manual',
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.material_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can view material transactions" ON public.material_transactions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.materials m
    JOIN public.businesses b ON b.id = m.business_id
    WHERE m.id = material_transactions.material_id AND b.owner_id = auth.uid()
  ));

CREATE POLICY "Business owners can insert material transactions" ON public.material_transactions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.materials m
    JOIN public.businesses b ON b.id = m.business_id
    WHERE m.id = material_transactions.material_id AND b.owner_id = auth.uid()
  ));

-- Trigger to update materials.updated_at
CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-deduct materials when booking is completed
CREATE OR REPLACE FUNCTION public.deduct_materials_on_booking_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Insert transaction records and deduct from materials
    INSERT INTO public.material_transactions (material_id, quantity_change, type, booking_id, notes)
    SELECT sm.material_id, -sm.quantity_needed, 'auto_deduct', NEW.id,
      'Automatski oduzeto za rezervaciju ' || NEW.id::text
    FROM public.service_materials sm
    WHERE sm.service_id = NEW.service_id;

    -- Update current quantities
    UPDATE public.materials m
    SET current_quantity = m.current_quantity - sm.quantity_needed
    FROM public.service_materials sm
    WHERE sm.material_id = m.id AND sm.service_id = NEW.service_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER deduct_materials_on_complete
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.deduct_materials_on_booking_complete();
