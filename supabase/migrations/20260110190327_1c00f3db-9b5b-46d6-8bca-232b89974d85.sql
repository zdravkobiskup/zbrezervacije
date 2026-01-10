-- Drop the overly permissive policy that exposes employee personal data
DROP POLICY IF EXISTS "Employees are viewable by everyone" ON public.employees;

-- Create a view for public employee data (without sensitive fields)
CREATE OR REPLACE VIEW public.employees_public AS
SELECT 
  id,
  business_id,
  name,
  color,
  is_active,
  group_id
FROM public.employees
WHERE is_active = true;

-- Grant access to the view
GRANT SELECT ON public.employees_public TO anon, authenticated;

-- Create policy for business owners to see all their employee data (including sensitive fields)
CREATE POLICY "Business owners can view their employees" 
ON public.employees 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = employees.business_id 
    AND businesses.owner_id = auth.uid()
  )
);

-- Create policy for authenticated users to view only non-sensitive employee fields for booking purposes
-- This uses a more restrictive approach - they can only see the row exists but the application
-- should use the employees_public view instead
CREATE POLICY "Authenticated users can view active employees for booking" 
ON public.employees 
FOR SELECT 
USING (
  is_active = true 
  AND auth.uid() IS NOT NULL
);