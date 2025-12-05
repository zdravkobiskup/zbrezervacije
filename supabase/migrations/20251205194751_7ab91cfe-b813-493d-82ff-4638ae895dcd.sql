-- Create employee_groups table for grouping employees
CREATE TABLE public.employee_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  working_hours JSONB DEFAULT '{"monday": "09:00-17:00", "tuesday": "09:00-17:00", "wednesday": "09:00-17:00", "thursday": "09:00-17:00", "friday": "09:00-17:00", "saturday": "closed", "sunday": "closed"}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add working_hours and group_id columns to employees table
ALTER TABLE public.employees 
ADD COLUMN working_hours JSONB DEFAULT NULL,
ADD COLUMN group_id UUID REFERENCES public.employee_groups(id) ON DELETE SET NULL;

-- Enable RLS on employee_groups
ALTER TABLE public.employee_groups ENABLE ROW LEVEL SECURITY;

-- Policies for employee_groups
CREATE POLICY "Business owners can manage employee groups"
ON public.employee_groups
FOR ALL
USING (EXISTS (
  SELECT 1 FROM businesses
  WHERE businesses.id = employee_groups.business_id
  AND businesses.owner_id = auth.uid()
));

CREATE POLICY "Employee groups are viewable by everyone"
ON public.employee_groups
FOR SELECT
USING (TRUE);

-- Trigger for updating updated_at
CREATE TRIGGER update_employee_groups_updated_at
BEFORE UPDATE ON public.employee_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();