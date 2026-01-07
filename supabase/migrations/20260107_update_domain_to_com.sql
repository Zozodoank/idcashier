-- Migration to update domain from idcashier.my.id to idcashier.com
-- Run this script in the Supabase SQL Editor to migrate existing users.

-- 1. Update email in auth.users
UPDATE auth.users
SET email = REPLACE(email, '@idcashier.my.id', '@idcashier.com')
WHERE email LIKE '%@idcashier.my.id';

-- 2. Update email in public.users
UPDATE public.users
SET email = REPLACE(email, '@idcashier.my.id', '@idcashier.com')
WHERE email LIKE '%@idcashier.my.id';

-- 3. Update email in user metadata (auth.users)
-- This updates the top-level 'email' field in metadata if it exists and matches
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  raw_user_meta_data,
  '{email}',
  to_jsonb(REPLACE(raw_user_meta_data->>'email', '@idcashier.my.id', '@idcashier.com'))
)
WHERE raw_user_meta_data->>'email' LIKE '%@idcashier.my.id';

-- 4. Update any other tables if necessary (e.g. if email is stored elsewhere)
-- Example: UPDATE subscriptions SET user_email = ...
