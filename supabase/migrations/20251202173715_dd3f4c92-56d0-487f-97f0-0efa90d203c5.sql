-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add employee_id to bookings (nullable for backwards compatibility)
ALTER TABLE public.bookings ADD COLUMN employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

-- Enable RLS on employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Employees are viewable by everyone (for booking purposes)
CREATE POLICY "Employees are viewable by everyone"
ON public.employees
FOR SELECT
USING (is_active = true OR EXISTS (
  SELECT 1 FROM businesses WHERE businesses.id = employees.business_id AND businesses.owner_id = auth.uid()
));

-- Business owners can manage their employees
CREATE POLICY "Business owners can manage employees"
ON public.employees
FOR ALL
USING (EXISTS (
  SELECT 1 FROM businesses WHERE businesses.id = employees.business_id AND businesses.owner_id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();