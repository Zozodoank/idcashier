-- Function to get the current user's tenant_id bypassing RLS
CREATE OR REPLACE FUNCTION auth_user_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$;

-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view their tenant members" ON public.users;

-- Recreate policy using the secure function
CREATE POLICY "Users can view their tenant members"
ON public.users
FOR SELECT
TO public
USING (
  tenant_id = auth_user_tenant_id()
);

-- Ensure user can always see themselves (redundant but safe)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
TO public
USING (
  id = auth.uid()
);