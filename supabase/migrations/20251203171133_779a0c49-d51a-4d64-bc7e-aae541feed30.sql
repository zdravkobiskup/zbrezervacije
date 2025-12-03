-- Allow clients to delete (cancel) their own bookings
CREATE POLICY "Clients can delete their own bookings"
ON public.bookings
FOR DELETE
USING (auth.uid() = client_id);

-- Allow business owners to delete bookings for their business
CREATE POLICY "Business owners can delete bookings for their business"
ON public.bookings
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM businesses
  WHERE businesses.id = bookings.business_id
  AND businesses.owner_id = auth.uid()
));

-- Admin policies for businesses
CREATE POLICY "Admins can view all businesses"
ON public.businesses
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all businesses"
ON public.businesses
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Admin policies for user_roles (to view all users)
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admin policies for profiles (to view all profiles)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admin policies for bookings
CREATE POLICY "Admins can view all bookings"
ON public.bookings
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all bookings"
ON public.bookings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));