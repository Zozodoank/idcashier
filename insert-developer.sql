-- Insert developer user
-- IMPORTANT: Replace 'your-generated-uuid-here' with an actual UUID before running
-- You can generate a UUID at https://www.uuidgenerator.net/
-- Also replace '$2a$10$example_hashed_password' with an actual hashed password

INSERT INTO users (id, name, email, password, role)
VALUES (
  '2613fd95-e6ae-49ad-8235-da2897b7531e',  -- Generated UUID for developer user
  'Developer',
  'jho.j80@gmail.com',
  '$2b$10$SCYEqDn/mMnIsLtysbRJGu4bXf1sCavGcXs.JCp/Mj831sLWkFb3O',  -- bcrypt hash of '@Se06070786'
  'admin'
)
ON CONFLICT (email) DO UPDATE
SET 
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  updated_at = NOW();

-- Instructions:
-- 1. Generate a UUID at https://www.uuidgenerator.net/ (already done above)
-- 2. For the password, you can initially use the provided hash and change it later through the application
-- 3. Run this SQL statement in your Supabase SQL editor