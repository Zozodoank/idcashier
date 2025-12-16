-- CEK PERMISSIONS AKUN DEMO
-- Jalankan di Supabase SQL Editor

SELECT 
    email,
    role,
    permissions
FROM users
WHERE email = 'demo@idcashier.my.id';
