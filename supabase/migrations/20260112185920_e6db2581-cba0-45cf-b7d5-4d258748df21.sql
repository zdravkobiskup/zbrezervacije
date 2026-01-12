-- Popravi security_audit_log policy da koristi SECURITY DEFINER funkciju umjesto WITH CHECK (true)
DROP POLICY IF EXISTS "System can insert audit log" ON public.security_audit_log;

-- Umjesto toga, insert će se raditi samo preko log_security_event funkcije
-- koja je SECURITY DEFINER i ima pristup
-- Blokiraj direktni INSERT od korisnika
CREATE POLICY "No direct insert to audit log"
ON public.security_audit_log
FOR INSERT
WITH CHECK (false);

-- Ažuriraj funkciju da bypassira RLS
DROP FUNCTION IF EXISTS public.log_security_event(text, text, uuid);

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
  -- SECURITY DEFINER funkcija bypassira RLS
  INSERT INTO public.security_audit_log (user_id, action, table_name, record_id)
  VALUES (auth.uid(), p_action, p_table_name, p_record_id);
EXCEPTION
  WHEN OTHERS THEN
    -- Ignoriraj greške u logiranju da ne prekidaju normalni flow
    NULL;
END;
$$;