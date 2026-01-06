-- Create a security definer function to get user role without RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id
$$;

-- Create a function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND role = 'admin'
  )
$$;

-- Create a function to check if user is manager
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND role = 'manager'
  )
$$;

-- Drop existing policies on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view their team" ON public.profiles;
DROP POLICY IF EXISTS "Managers can update their team" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Recreate policies using security definer functions
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Managers can view their team"
ON public.profiles FOR SELECT
USING (public.is_manager(auth.uid()) AND (manager_id = auth.uid() OR id = auth.uid()));

CREATE POLICY "Managers can update their team"
ON public.profiles FOR UPDATE
USING (public.is_manager(auth.uid()) AND manager_id = auth.uid());

-- Fix policies on other tables that reference profiles
DROP POLICY IF EXISTS "Admins can do anything with POIs" ON public.points_of_interest;
DROP POLICY IF EXISTS "Managers can view POIs in their neighborhoods" ON public.points_of_interest;
DROP POLICY IF EXISTS "Managers can insert POIs" ON public.points_of_interest;
DROP POLICY IF EXISTS "Sellers can view POIs in their neighborhoods or created by them" ON public.points_of_interest;
DROP POLICY IF EXISTS "Sellers can insert POIs" ON public.points_of_interest;

CREATE POLICY "Admins can do anything with POIs"
ON public.points_of_interest FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Managers can view POIs in their neighborhoods"
ON public.points_of_interest FOR SELECT
USING (public.is_manager(auth.uid()));

CREATE POLICY "Managers can insert POIs"
ON public.points_of_interest FOR INSERT
WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "Sellers can view POIs they created"
ON public.points_of_interest FOR SELECT
USING (created_by = auth.uid());

CREATE POLICY "Sellers can insert POIs"
ON public.points_of_interest FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Fix policies on visits
DROP POLICY IF EXISTS "Admins can do anything with visits" ON public.visits;
DROP POLICY IF EXISTS "Managers can view team visits" ON public.visits;
DROP POLICY IF EXISTS "Sellers can manage their own visits" ON public.visits;

CREATE POLICY "Admins can do anything with visits"
ON public.visits FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Managers can view team visits"
ON public.visits FOR SELECT
USING (public.is_manager(auth.uid()));

CREATE POLICY "Sellers can manage their own visits"
ON public.visits FOR ALL
USING (user_id = auth.uid());

-- Fix policies on customers
DROP POLICY IF EXISTS "Admins can do anything with customers" ON public.customers;
DROP POLICY IF EXISTS "Managers can view team customers" ON public.customers;
DROP POLICY IF EXISTS "Sellers can manage their own customers" ON public.customers;

CREATE POLICY "Admins can do anything with customers"
ON public.customers FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Managers can view team customers"
ON public.customers FOR SELECT
USING (public.is_manager(auth.uid()));

CREATE POLICY "Sellers can manage their own customers"
ON public.customers FOR ALL
USING (seller_id = auth.uid());