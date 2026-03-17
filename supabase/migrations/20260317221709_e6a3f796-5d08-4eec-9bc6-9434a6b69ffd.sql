
CREATE OR REPLACE FUNCTION public.get_business_owner_for_notification(p_business_id uuid)
RETURNS TABLE(owner_id uuid, owner_email text, owner_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT b.owner_id, p.email, p.full_name
  FROM public.businesses b
  JOIN public.profiles p ON p.id = b.owner_id
  WHERE b.id = p_business_id;
$$;
