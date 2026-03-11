
-- Create a SECURITY DEFINER function to assign roles during signup (bypasses RLS)
CREATE OR REPLACE FUNCTION public.assign_role_on_signup(p_user_id uuid, p_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
