-- 1. Ukloni javni pristup businesses tabeli za osjetljive podatke
-- Koristit ćemo get_public_businesses() funkciju koja već isključuje email/phone

-- Ažuriraj policy za profiles - eksplicitno blokiraj anonimni pristup
DROP POLICY IF EXISTS "Business owners can view limited client data" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles with restrictions"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    auth.uid() = id
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 2. Ažuriraj employee_groups policy da bude strožija
DROP POLICY IF EXISTS "Employee groups viewable by authenticated users for booking" ON public.employee_groups;

CREATE POLICY "Employee groups viewable only by business owners and authenticated clients"
ON public.employee_groups
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    -- Business owner može vidjeti svoje grupe
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = employee_groups.business_id 
      AND b.owner_id = auth.uid()
    )
    OR
    -- Autentificirani korisnici mogu vidjeti grupe za aktivne biznise (potrebno za booking)
    (
      has_role(auth.uid(), 'client'::app_role)
      AND EXISTS (
        SELECT 1 FROM businesses b
        WHERE b.id = employee_groups.business_id 
        AND b.is_active = true
      )
    )
  )
);

-- 3. Funkcija za sigurno dohvaćanje podataka o biznisu (bez emaila i telefona za javnost)
CREATE OR REPLACE FUNCTION public.get_public_businesses()
RETURNS TABLE(
  id uuid, 
  name text, 
  description text, 
  category text, 
  address text, 
  image_url text, 
  working_hours jsonb, 
  is_active boolean, 
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    b.id,
    b.name,
    b.description,
    b.category,
    b.address,
    b.image_url,
    b.working_hours,
    b.is_active,
    b.created_at
  FROM public.businesses b
  WHERE b.is_active = true
  ORDER BY b.created_at DESC;
$$;

-- 4. Funkcija za dohvaćanje kontakt podataka biznisa samo za autentificirane korisnike
CREATE OR REPLACE FUNCTION public.get_business_contact(p_business_id uuid)
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
    AND auth.uid() IS NOT NULL;
$$;

-- 5. Dodaj audit log za praćenje pristupa osjetljivim podacima
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Samo admini mogu vidjeti audit log
CREATE POLICY "Admins can view audit log"
ON public.security_audit_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Samo sustav može unositi u audit log (preko SECURITY DEFINER funkcija)
CREATE POLICY "System can insert audit log"
ON public.security_audit_log
FOR INSERT
WITH CHECK (true);

-- 6. Funkcija za logiranje pristupa
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action text,
  p_table_name text,
  p_record_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.security_audit_log (user_id, action, table_name, record_id)
  VALUES (auth.uid(), p_action, p_table_name, p_record_id);
END;
$$;