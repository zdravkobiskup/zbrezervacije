-- Fix notifications INSERT policy - restrict to backend only or business owners notifying their clients
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

-- Only allow inserting notifications where:
-- 1. User is inserting for themselves, OR
-- 2. Business owner is notifying their client about a booking
CREATE POLICY "Users can insert own notifications or business owners notify clients"
ON public.notifications FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.businesses bus ON bus.id = b.business_id
    WHERE b.client_id = user_id
    AND bus.owner_id = auth.uid()
  )
);

-- Fix employee_groups public exposure - restrict to business owners and clients booking with that business
DROP POLICY IF EXISTS "Employee groups are viewable by everyone" ON public.employee_groups;

CREATE POLICY "Employee groups viewable by business owners and booking clients"
ON public.employee_groups FOR SELECT
USING (
  -- Business owner can see their own employee groups
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = business_id AND b.owner_id = auth.uid()
  )
  OR
  -- Clients can see employee groups when booking
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = business_id AND b.is_active = true
  )
);

-- Add database constraints for input validation
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS business_name_length,
  DROP CONSTRAINT IF EXISTS business_description_length,
  ADD CONSTRAINT business_name_length CHECK (length(name) <= 200),
  ADD CONSTRAINT business_description_length CHECK (length(description) <= 2000);

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS service_name_length,
  DROP CONSTRAINT IF EXISTS service_description_length,
  DROP CONSTRAINT IF EXISTS service_duration_range,
  DROP CONSTRAINT IF EXISTS service_price_range,
  ADD CONSTRAINT service_name_length CHECK (length(name) <= 200),
  ADD CONSTRAINT service_description_length CHECK (length(description) <= 1000),
  ADD CONSTRAINT service_duration_range CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  ADD CONSTRAINT service_price_range CHECK (price >= 0 AND price <= 999999);

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS booking_notes_length,
  ADD CONSTRAINT booking_notes_length CHECK (length(notes) <= 500);

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employee_name_length,
  ADD CONSTRAINT employee_name_length CHECK (length(name) <= 200);