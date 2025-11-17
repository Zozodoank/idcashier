import { createClient } from '@supabase/supabase-js';

async function getToken() {
  const supabase = createClient(
    'https://eypfeiqtvfxxiimhtycc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzEyODEsImV4cCI6MjA3NjQwNzI4MX0.mB5EVpFQbayjPvAuEmg98tsyrhFW_FQxf2SCQhdZHSI'
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'testing@idcashier.my.id',
    password: 'Tesajakalobisa'
  });

  if (error) {
    console.error('Login error:', error.message);
    return;
  }

  console.log(data.session.access_token);
}

getToken();
