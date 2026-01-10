-- Create a secure function to get employee public info for booking
-- This function returns only non-sensitive employee data
CREATE OR REPLACE FUNCTION public.get_employees_for_booking(p_business_id uuid)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  name text,
  color text,
  group_id uuid,
  working_hours jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 
    e.id,
    e.business_id,
    e.name,
    e.color,
    e.group_id,
    e.working_hours
  FROM public.employees e
  WHERE e.business_id = p_business_id 
    AND e.is_active = true;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_employees_for_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employees_for_booking(uuid) TO anon;