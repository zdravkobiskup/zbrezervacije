-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Business owners can view profiles of clients who have bookings with them
CREATE POLICY "Business owners can view client profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.client_id = profiles.id
      AND EXISTS (
        SELECT 1 FROM public.businesses
        WHERE businesses.id = bookings.business_id
        AND businesses.owner_id = auth.uid()
      )
    )
  );