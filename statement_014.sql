CREATE POLICY "Allow tenant access on employees" ON employees
        FOR ALL
        USING (
            tenant_id = auth.uid()
            OR
            user_id = auth.uid()
            OR
            tenant_id = (
                SELECT id FROM users WHERE email = 'demo@idcashier.my.id'
            )
            OR
            user_id = (
                SELECT id FROM users WHERE email = 'demo@idcashier.my.id'
            )
            OR
            auth.uid() IN (
                SELECT id FROM users WHERE email IN ('jho.j80@gmail.com')
            )
        )
        WITH CHECK (
            tenant_id = auth.uid()
            OR
            user_id = auth.uid()
            OR
            tenant_id = (
                SELECT id FROM users WHERE email = 'demo@idcashier.my.id'
            )
            OR
            user_id = (
                SELECT id FROM users WHERE email = 'demo@idcashier.my.id'
            )
        );