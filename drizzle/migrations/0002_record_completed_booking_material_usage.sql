CREATE OR REPLACE FUNCTION public.set_booking_material_usage(p_booking_id uuid, p_material_id uuid, p_quantity numeric)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_booking public.bookings%ROWTYPE; v_material public.materials%ROWTYPE; v_used numeric; v_delta numeric;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = v_booking.business_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Nemate pristup ovoj rezervaciji';
  END IF;
  IF v_booking.status IS DISTINCT FROM 'completed' THEN RAISE EXCEPTION 'Rezervacija mora biti završena'; END IF;
  IF p_quantity IS NULL OR p_quantity < 0 OR p_quantity::text IN ('NaN', 'Infinity', '-Infinity') THEN RAISE EXCEPTION 'Unesite valjanu količinu'; END IF;
  SELECT * INTO v_material FROM public.materials WHERE id = p_material_id AND business_id = v_booking.business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Materijal ne pripada ovoj tvrtki'; END IF;
  SELECT COALESCE(-SUM(quantity_change), 0) INTO v_used FROM public.material_transactions
    WHERE booking_id = p_booking_id AND material_id = p_material_id AND type IN ('auto_deduct', 'manual_deduct');
  v_delta := p_quantity - v_used;
  IF v_delta > 0 AND v_material.current_quantity < v_delta THEN RAISE EXCEPTION 'Nedovoljno materijala na skladištu'; END IF;
  IF v_delta <> 0 THEN
    UPDATE public.materials SET current_quantity = current_quantity - v_delta WHERE id = p_material_id;
    INSERT INTO public.material_transactions (material_id, quantity_change, type, booking_id, notes)
      VALUES (p_material_id, -v_delta, 'manual_deduct', p_booking_id, 'Stvarna potrošnja za završenu rezervaciju');
  END IF;
  RETURN v_material.current_quantity - v_delta;
END;
$$;
REVOKE ALL ON FUNCTION public.set_booking_material_usage(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_booking_material_usage(uuid, uuid, numeric) TO authenticated;
GRANT ALL ON public.materials, public.material_transactions TO service_role;