-- Sync missing users from public.users into auth.users with temporary default password
-- WARNING: For production, prefer creating users via Auth API and avoid storing passwords in public.users

-- Ensure pgcrypto is enabled for crypt/gen_salt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO auth.users (id, instance_id, email, email_confirmed_at, encrypted_password, created_at, updated_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM auth.instances LIMIT 1),
  u.email,
  NOW(),
  crypt('Demo2025', gen_salt('bf')),
  NOW(),
  NOW()
FROM public.users u
LEFT JOIN auth.users au ON au.email = u.email
WHERE au.id IS NULL;


