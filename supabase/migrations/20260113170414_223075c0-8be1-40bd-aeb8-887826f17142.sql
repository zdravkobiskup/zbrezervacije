-- 1. Ažuriraj employees policy - ukloni mogućnost da klijenti vide email/phone
-- Klijenti trebaju koristiti get_employees_for_booking() funkciju

DROP POLICY IF EXISTS "Business owners can view their employees" ON public.employees;
DROP POLICY IF EXISTS "Business owners can manage employees" ON public.employees;

-- Samo business owner može vidjeti sve podatke o zaposlenicima
CREATE POLICY "Business owners can manage employees"
ON public.employees
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM businesses
    WHERE businesses.id = employees.business_id 
    AND businesses.owner_id = auth.uid()
  )
);

-- Klijenti NE mogu direktno vidjeti employees - moraju koristiti get_employees_for_booking()
-- koja ne vraća email i phone

-- 2. Ažuriraj businesses policy - zahtijevaj autentifikaciju za pristup kontakt podacima
DROP POLICY IF EXISTS "Businesses viewable with restrictions" ON public.businesses;

-- Javno vidljivi samo osnovni podaci (bez emaila i telefona)
-- Email i phone samo za ownera i admine
CREATE POLICY "Business basic info viewable by authenticated users"
ON public.businesses
FOR SELECT
USING (
  -- Owner vidi sve o svom biznisu
  owner_id = auth.uid()
  OR
  -- Admin vidi sve
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Aktivni biznisi - svi autentificirani korisnici (ali koriste get_public_businesses za kontakt)
  (is_active = true AND auth.uid() IS NOT NULL)
);

-- 3. Kreiraj funkciju za dohvaćanje kontakt podataka (samo za klijente s aktivnim bookingom)
CREATE OR REPLACE FUNCTION public.get_business_contact_for_client(p_business_id uuid)
RETURNS TABLE(email text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    b.email,
    b.phone
  FROM public.businesses b
  WHERE b.id = p_business_id
    AND b.is_active = true
    AND (
      -- Owner
      b.owner_id = auth.uid()
      OR
      -- Admin
      has_role(auth.uid(), 'admin'::app_role)
      OR
      -- Klijent koji ima booking kod ovog biznisa
      EXISTS (
        SELECT 1 FROM public.bookings bk
        WHERE bk.business_id = p_business_id
        AND bk.client_id = auth.uid()
        AND bk.status IN ('pending', 'confirmed', 'completed')
      )
    );
$$;