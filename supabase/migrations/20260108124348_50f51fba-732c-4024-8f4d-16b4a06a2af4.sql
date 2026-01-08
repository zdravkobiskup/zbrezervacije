-- Add policy to allow all authenticated users to see bookings for availability checking
-- This is necessary so customers can see which slots are taken (regardless of who booked them)
CREATE POLICY "Authenticated users can view bookings for availability"
  ON public.bookings FOR SELECT
  USING (auth.uid() IS NOT NULL);