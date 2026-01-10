-- Drop the view that caused security definer warning
DROP VIEW IF EXISTS public.employees_public;

-- Drop the too-permissive authenticated policy
DROP POLICY IF EXISTS "Authenticated users can view active employees for booking" ON public.employees;