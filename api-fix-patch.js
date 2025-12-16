// API Fix Patch untuk salesAPI.getById()
// Replace line 968-989 di src/lib/api.js

// Replace这段代码:
/*
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single()
        .setHeader('Authorization', `Bearer ${token}`);
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
*/

// With这段代码:
      // Get environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Decode token to get email (avoid supabase.auth.getUser which has API key issues)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      const payload = JSON.parse(atob(tokenParts[1]));
      const userEmail = payload.email;
      
      if (!userEmail) {
        throw new Error('No email found in token');
      }
      
      console.log('📧 User email from token:', userEmail);
      
      // Get user profile from users table by EMAIL using direct fetch
      const userProfileController = new AbortController();
      const userProfileTimeout = setTimeout(() => {
        console.error('⏰ User profile fetch timeout (10s)');
        userProfileController.abort();
      }, 10000);
      
      let userResponse;
      try {
        userResponse = await fetch(
          `${supabaseUrl}/rest/v1/users?select=id,name,email,role,tenant_id,permissions,created_at&email=eq.${encodeURIComponent(userEmail)}`,
          {
            method: 'GET',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            signal: userProfileController.signal
          }
        );
        clearTimeout(userProfileTimeout);
      } catch (fetchError) {
        clearTimeout(userProfileTimeout);
        if (fetchError.name === 'AbortError') {
          throw new Error('User profile fetch timeout');
        }
        throw fetchError;
      }
      
      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.error('User profile fetch failed:', userResponse.status, errorText);
        throw new Error(`Failed to get user profile: ${userResponse.statusText}`);
      }
      
      const userDataArray = await userResponse.json();
      if (!userDataArray || userDataArray.length === 0) {
        throw new Error('User profile not found');
      }
      
      const userData = userDataArray[0];
      console.log('✅ User profile loaded:', userData.email);