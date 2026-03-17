
CREATE OR REPLACE FUNCTION public.get_business_working_hours_and_service(p_business_id uuid, p_service_id uuid)
RETURNS TABLE(working_hours jsonb, duration_minutes integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT b.working_hours, s.duration_minutes
  FROM public.businesses b
  CROSS JOIN public.services s
  WHERE b.id = p_business_id
    AND s.id = p_service_id
    AND b.is_active = true
    AND s.is_active = true;
$$;
