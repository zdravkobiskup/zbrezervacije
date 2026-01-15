-- =============================================
-- FIX 1: User Roles Self-Assignment Vulnerability
-- Users should NOT be able to assign themselves roles
-- Only allow through secure SECURITY DEFINER function
-- =============================================

-- Drop the insecure INSERT policy
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;

-- Create secure function for initial client role assignment during signup
CREATE OR REPLACE FUNCTION public.assign_client_role_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only assign 'client' role automatically on signup
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger for automatic client role on new user
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_client_role_on_signup();

-- Only admins can insert roles (for manual role upgrades)
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete roles
CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- FIX 2: Business Contact Details Exposure
-- Create view that hides email/phone from regular users
-- =============================================

-- Create public view without sensitive contact info
CREATE OR REPLACE VIEW public.businesses_public
WITH (security_invoker = on) AS
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

-- Grant access to the view
GRANT SELECT ON public.businesses_public TO authenticated;
GRANT SELECT ON public.businesses_public TO anon;

-- Update businesses SELECT policy - only owners and admins see full data
DROP POLICY IF EXISTS "Business basic info viewable by authenticated users" ON public.businesses;

CREATE POLICY "Business owners and admins can view full business data"
ON public.businesses
FOR SELECT
USING (
  owner_id = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- =============================================
-- FIX 3: Profiles Table - Clean up duplicate policies
-- =============================================

-- Drop duplicate/redundant SELECT policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
-- Keep only "Users can only view own profile" which already has admin check

-- =============================================
-- FIX 4: Employees - Mark as properly secured (already fixed)
-- The get_employees_for_booking function excludes email/phone
-- =============================================
-- No changes needed - RLS is already correct