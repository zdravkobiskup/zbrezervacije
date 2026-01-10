-- Create a secure function to get public business info for listing
-- This function returns only non-sensitive business data (excludes email and phone)
CREATE OR REPLACE FUNCTION public.get_public_businesses()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  category text,
  address text,
  image_url text,
  working_hours jsonb,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_public_businesses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_businesses() TO anon;