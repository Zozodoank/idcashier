-- Update password for developer account (jho.j80@gmail.com)
-- New password: @Se06070786

UPDATE users 
SET password = '$2b$10$SCYEqDn/mMnIsLtysbRJGu4bXf1sCavGcXs.JCp/Mj831sLWkFb3O' 
WHERE email = 'jho.j80@gmail.com';

-- Verify the update
SELECT id, name, email, role FROM users WHERE email = 'jho.j80@gmail.com';