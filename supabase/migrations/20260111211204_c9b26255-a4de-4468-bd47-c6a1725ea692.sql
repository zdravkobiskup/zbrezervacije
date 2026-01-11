-- Create a secure function to get booking availability without exposing private data
CREATE OR REPLACE FUNCTION public.get_booking_availability(
  p_business_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  booking_date date,
  booking_time time,
  employee_id uuid,
  duration_minutes int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    b.booking_date,
    b.booking_time,
    b.employee_id,
    s.duration_minutes
  FROM bookings b
  JOIN services s ON s.id = b.service_id
  WHERE b.business_id = p_business_id
    AND b.booking_date BETWEEN p_start_date AND p_end_date
    AND b.status IN ('pending', 'confirmed')
  ORDER BY b.booking_date, b.booking_time;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_booking_availability(uuid, date, date) TO authenticated;

-- Drop the overly permissive policy for authenticated users
DROP POLICY IF EXISTS "Authenticated users can view bookings for availability" ON public.bookings;