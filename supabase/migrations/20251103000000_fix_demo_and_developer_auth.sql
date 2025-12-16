BEGIN;

-- Function to fix demo and developer auth users
CREATE OR REPLACE FUNCTION public.fix_demo_and_developer_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  demo_user_id UUID := '11111111-1111-1111-1111-111111111111'; -- Consistent demo user ID
  developer_user_id UUID := '2613fd95-e6ae-49ad-8235-da2897b7531e'; -- From insert-developer.sql
BEGIN
  -- Fix demo user
  -- Delete existing user if exists
  PERFORM auth.admin_delete_user(demo_user_id);
  
  -- Insert demo user into auth.users
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role
  ) VALUES (
    demo_user_id,
    'demo@idcashier.my.id',
    crypt('Demo2025', gen_salt('bf')), -- bcrypt hash
    NOW(), -- Auto-confirm email
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Demo User"}'::jsonb,
    'authenticated'
  );
  
  -- Insert/Update public.users with ON CONFLICT handling
  INSERT INTO public.users (
    id,
    email,
    name,
    role,
    tenant_id
  ) VALUES (
    demo_user_id,
    'demo@idcashier.my.id',
    'Demo User',
    'owner',
    demo_user_id
  )
  ON CONFLICT (id) 
  DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    tenant_id = EXCLUDED.tenant_id;
  
  -- Fix developer user
  -- Delete existing user if exists
  PERFORM auth.admin_delete_user(developer_user_id);
  
  -- Insert developer user into auth.users
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role
  ) VALUES (
    developer_user_id,
    'jho.j80@gmail.com',
    crypt('@Se06070786', gen_salt('bf')), -- bcrypt hash
    NOW(), -- Auto-confirm email
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Developer"}'::jsonb,
    'authenticated'
  );
  
  -- Insert/Update public.users with ON CONFLICT handling
  INSERT INTO public.users (
    id,
    email,
    name,
    role,
    tenant_id
  ) VALUES (
    developer_user_id,
    'jho.j80@gmail.com',
    'Developer',
    'admin',
    developer_user_id
  )
  ON CONFLICT (id) 
  DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    tenant_id = EXCLUDED.tenant_id;
END;
$$;

-- Execute the function
SELECT public.fix_demo_and_developer_auth();

-- Drop the function after execution
DROP FUNCTION public.fix_demo_and_developer_auth();

COMMIT;