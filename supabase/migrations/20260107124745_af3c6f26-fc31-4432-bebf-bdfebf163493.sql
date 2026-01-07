-- Allow business owners to insert bookings for their own business
CREATE POLICY "Business owners can insert bookings for their business"
ON public.bookings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM businesses
    WHERE businesses.id = bookings.business_id
    AND businesses.owner_id = auth.uid()
  )
);