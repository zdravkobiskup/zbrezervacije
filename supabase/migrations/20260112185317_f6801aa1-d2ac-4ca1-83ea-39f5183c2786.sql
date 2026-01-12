-- 1. Dodaj funkciju za sigurno dohvaćanje profila klijenata (samo ime, bez kontakt podataka)
CREATE OR REPLACE FUNCTION public.get_client_profile_for_booking(p_client_id uuid, p_business_id uuid)
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.id,
    p.full_name
  FROM public.profiles p
  WHERE p.id = p_client_id
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.businesses bus ON bus.id = b.business_id
      WHERE b.client_id = p_client_id
        AND b.business_id = p_business_id
        AND bus.owner_id = auth.uid()
    );
$$;

-- 2. Ukloni policy koji dopušta business ownerima vidjeti sve podatke profila
DROP POLICY IF EXISTS "Business owners can view client profiles" ON public.profiles;

-- 3. Kreiraj novu restriktivnu policy za profile - business owners vide samo svoje klijente ali samo preko funkcije
CREATE POLICY "Business owners can view limited client data"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Sigurna funkcija za employee podatke (bez emaila i telefona za klijente)
CREATE OR REPLACE FUNCTION public.get_employees_for_booking(p_business_id uuid)
RETURNS TABLE(id uuid, business_id uuid, name text, color text, group_id uuid, working_hours jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
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

-- 5. Ažuriraj employee_groups policy da zahtijeva autentifikaciju
DROP POLICY IF EXISTS "Employee groups viewable by business owners and booking clients" ON public.employee_groups;

CREATE POLICY "Employee groups viewable by authenticated users for booking"
ON public.employee_groups
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = employee_groups.business_id 
      AND b.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = employee_groups.business_id 
      AND b.is_active = true
    )
  )
);

-- 6. Funkcija za sigurno dohvaćanje radnog vremena grupe (bez internih podataka)
CREATE OR REPLACE FUNCTION public.get_group_working_hours(p_group_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT eg.working_hours
  FROM public.employee_groups eg
  JOIN public.businesses b ON b.id = eg.business_id
  WHERE eg.id = p_group_id
    AND b.is_active = true;
$$;

-- 7. Funkcija za validaciju notes polja (sprječava unos osjetljivih podataka)
CREATE OR REPLACE FUNCTION public.validate_booking_notes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sensitive_patterns text[] := ARRAY[
    '\d{3}[-.\s]?\d{3}[-.\s]?\d{3,4}', -- OIB/telefon pattern
    '\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}', -- kartica pattern
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' -- email pattern
  ];
  pattern text;
BEGIN
  IF NEW.notes IS NOT NULL THEN
    FOREACH pattern IN ARRAY sensitive_patterns
    LOOP
      IF NEW.notes ~* pattern THEN
        RAISE EXCEPTION 'Notes field cannot contain sensitive personal data (phone numbers, card numbers, or email addresses)';
      END IF;
    END LOOP;
    
    -- Ograniči duljinu notes polja
    IF length(NEW.notes) > 500 THEN
      RAISE EXCEPTION 'Notes field cannot exceed 500 characters';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 8. Trigger za validaciju notes polja
DROP TRIGGER IF EXISTS validate_booking_notes_trigger ON public.bookings;
CREATE TRIGGER validate_booking_notes_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_booking_notes();

-- 9. Funkcija za rate limiting (sprječava spam bookinge)
CREATE OR REPLACE FUNCTION public.check_booking_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recent_bookings_count integer;
BEGIN
  -- Provjeri koliko je bookinga korisnik napravio u zadnjih sat vremena
  SELECT COUNT(*)
  INTO recent_bookings_count
  FROM public.bookings
  WHERE client_id = NEW.client_id
    AND created_at > now() - interval '1 hour';
  
  IF recent_bookings_count >= 10 THEN
    RAISE EXCEPTION 'Too many booking requests. Please wait before making another booking.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 10. Trigger za rate limiting
DROP TRIGGER IF EXISTS booking_rate_limit_trigger ON public.bookings;
CREATE TRIGGER booking_rate_limit_trigger
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_booking_rate_limit();