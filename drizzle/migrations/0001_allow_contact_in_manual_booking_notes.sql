CREATE OR REPLACE FUNCTION public.validate_booking_notes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sensitive_patterns text[] := ARRAY[
    '\d{3}[-.\s]?\d{3}[-.\s]?\d{3,4}',
    '\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}',
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
  ];
  pattern text;
  is_owner boolean;
BEGIN
  IF NEW.notes IS NOT NULL THEN
    IF length(NEW.notes) > 500 THEN
      RAISE EXCEPTION 'Notes field cannot exceed 500 characters';
    END IF;

    SELECT EXISTS (SELECT 1 FROM businesses b WHERE b.id = NEW.business_id AND b.owner_id = auth.uid()) INTO is_owner;

    -- Business owners entering manual bookings may store client contact details
    IF is_owner AND NEW.notes LIKE '[RUČNA REZERVACIJA]%' THEN
      RETURN NEW;
    END IF;

    FOREACH pattern IN ARRAY sensitive_patterns LOOP
      IF NEW.notes ~* pattern THEN
        RAISE EXCEPTION 'Notes field cannot contain sensitive personal data (phone numbers, card numbers, or email addresses)';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;