CREATE POLICY "Allow tenant access on sales" ON sales
        FOR ALL
        USING (
            user_id = auth.uid()
            OR
            user_id IN (
                SELECT id FROM users WHERE tenant_id = auth.uid()
            )
            OR
            user_id = (
                SELECT id FROM users WHERE email = 'demo@idcashier.my.id'
            )
            OR
            email IN ('jho.j80@gmail.com')
        )
        WITH CHECK (
            user_id = auth.uid()
            OR
            user_id IN (
                SELECT id FROM users WHERE tenant_id = auth.uid()
            )
            OR
            user_id = (
                SELECT id FROM users WHERE email = 'demo@idcashier.my.id'
            )
        );