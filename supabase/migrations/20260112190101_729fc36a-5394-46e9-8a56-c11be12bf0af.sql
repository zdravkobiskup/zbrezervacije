-- Ažuriraj businesses SELECT policy da NE vraća email i phone za javnost
-- Umjesto toga koristimo get_public_businesses() funkciju

-- 1. Ukloni staru policy
DROP POLICY IF EXISTS "Businesses are viewable by everyone" ON public.businesses;

-- 2. Kreiraj novu restrictivnu policy - za select samo owner i admin mogu vidjeti sve, ostali preko funkcije
CREATE POLICY "Businesses viewable with restrictions"
ON public.businesses
FOR SELECT
USING (
  -- Owner vidi svoj biznis
  owner_id = auth.uid()
  OR
  -- Admin vidi sve
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Aktivni biznisi vidljivi svima (ali samo kroz get_public_businesses za javne podatke)
  (is_active = true AND auth.uid() IS NOT NULL)
);

-- 3. Kreiraj VIEW za javne podatke biznisa (bez emaila i telefona)
CREATE OR REPLACE VIEW public.public_businesses_view AS
SELECT 
  id,
  name,
  description,
  category,
  address,
  image_url,
  working_hours,
  is_active,
  created_at
FROM public.businesses
WHERE is_active = true;

-- 4. Ažuriraj profiles policy - samo vlastiti profil
DROP POLICY IF EXISTS "Authenticated users can view profiles with restrictions" ON public.profiles;

CREATE POLICY "Users can only view own profile"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 5. Funkcija za sigurno dohvaćanje ograničenih profil podataka za booking
CREATE OR REPLACE FUNCTION public.get_booking_client_info(p_booking_id uuid)
RETURNS TABLE(client_name text, client_email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.full_name as client_name,
    p.email as client_email
  FROM public.profiles p
  JOIN public.bookings b ON b.client_id = p.id
  JOIN public.businesses bus ON bus.id = b.business_id
  WHERE b.id = p_booking_id
    AND bus.owner_id = auth.uid();
$$;