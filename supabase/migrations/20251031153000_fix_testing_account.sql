BEGIN;

CREATE OR REPLACE FUNCTION public.fix_testing_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    testing_user_id UUID := '98dc3f00-c319-482f-9b2f-d3e915703c69';
BEGIN
    -- Hapus dan recreate data testing
    PERFORM auth.admin_delete_user(testing_user_id);
    
    INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
        is_super_admin, role
    ) VALUES (
        testing_user_id,
        'testing@tes.com',
        crypt('@Testing123', gen_salt('bf')),
        NOW(),
        NOW(), NOW(),
        '{"provider":"email","providers":["email"]}',
        '{"name":"Duitku Testing User"}',
        false,
        'authenticated'
    );

    INSERT INTO public.users (
        id, email, name, role, tenant_id, created_at, updated_at
    ) VALUES (
        testing_user_id,
        'testing@tes.com',
        'Duitku Testing User',
        'owner',
        testing_user_id,
        NOW(),
        NOW()
    );

    INSERT INTO public.subscriptions (
        id, user_id, start_date, end_date, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        testing_user_id,
        (NOW() - INTERVAL '7 days')::date,
        (NOW() - INTERVAL '1 day')::date,
        NOW(),
        NOW()
    );
END;
$$;

SELECT public.fix_testing_account();
COMMIT;