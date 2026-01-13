-- Ukloni postojeću policy i kreiraj strožije politike
DROP POLICY IF EXISTS "Business owners can manage employees" ON public.employees;

-- 1. SELECT - samo business owner i admin mogu vidjeti zaposlenike
CREATE POLICY "Only business owners can view employees"
ON public.employees
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = employees.business_id 
    AND b.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 2. INSERT - samo business owner može dodati zaposlenike
CREATE POLICY "Business owners can insert employees"
ON public.employees
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = employees.business_id 
    AND b.owner_id = auth.uid()
  )
);

-- 3. UPDATE - samo business owner može ažurirati zaposlenike
CREATE POLICY "Business owners can update employees"
ON public.employees
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = employees.business_id 
    AND b.owner_id = auth.uid()
  )
);

-- 4. DELETE - samo business owner može brisati zaposlenike
CREATE POLICY "Business owners can delete employees"
ON public.employees
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = employees.business_id 
    AND b.owner_id = auth.uid()
  )
);