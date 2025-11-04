// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, getUserEmailFromToken } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== developer-operations START ===');
    
    // Get authorization token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization token required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    // Verify token and get user email
    const userEmail = await getUserEmailFromToken(token);
    
    // Only jho.j80@gmail.com can perform developer operations
    if (userEmail !== 'jho.j80@gmail.com') {
      return new Response(
        JSON.stringify({ error: 'Access denied. Developer privileges required.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Create Supabase client using service role
    const supabase = createSupabaseClient();

    // Parse the request body
    const { operation, userId, months, reason, email, newPassword } = await req.json();
    
    // Validate input
    if (!operation) {
      return new Response(
        JSON.stringify({ error: 'Operation is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // For operations that require userId, validate here
    const requiresUserId = ['delete', 'extend', 'ban'];
    if (requiresUserId.includes(operation) && !userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required for this operation' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    let result;
    let message;

    switch (operation) {
      case 'delete':
        // Check if target user is protected
        const { data: targetUserData, error: targetUserError } = await supabase
          .from('users')
          .select('email')
          .eq('id', userId)
          .single();
        
        if (targetUserError) {
          throw new Error('User not found');
        }
        
        // Prevent deleting protected users
        if (targetUserData.email === 'demo@idcashier.my.id' || targetUserData.email === 'jho.j80@gmail.com') {
          return new Response(
            JSON.stringify({ error: 'Cannot delete protected user' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          );
        }
        
        // Delete user from auth.users
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
        if (deleteError) {
          throw new Error(`Failed to delete user: ${deleteError.message}`);
        }
        
        result = { userId };
        message = 'User deleted successfully';
        break;

      case 'extend':
        if (!months || typeof months !== 'number' || months <= 0) {
          return new Response(
            JSON.stringify({ error: 'Valid months parameter required for extend operation' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            }
          );
        }

        // Get current subscription or create new one
        const { data: currentSub } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        let newEndDate;
        if (currentSub) {
          // Extend from current end date or today, whichever is later
          const currentEndDate = new Date(currentSub.end_date);
          const today = new Date();
          const baseDate = currentEndDate > today ? currentEndDate : today;
          newEndDate = new Date(baseDate);
          newEndDate.setMonth(newEndDate.getMonth() + months);

          // Update existing subscription
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              end_date: newEndDate.toISOString().split('T')[0],
              updated_at: new Date().toISOString()
            })
            .eq('id', currentSub.id);

          if (updateError) {
            throw new Error(`Failed to update subscription: ${updateError.message}`);
          }
        } else {
          // Create new subscription
          const today = new Date();
          newEndDate = new Date(today);
          newEndDate.setMonth(newEndDate.getMonth() + months);

          const { error: createError } = await supabase
            .from('subscriptions')
            .insert({
              id: crypto.randomUUID(),
              user_id: userId,
              plan_name: `${months}_months`,
              duration: months,
              amount: 0, // This is an admin operation, no payment involved
              start_date: today.toISOString().split('T')[0],
              end_date: newEndDate.toISOString().split('T')[0],
              status: 'active'
            });

          if (createError) {
            throw new Error(`Failed to create subscription: ${createError.message}`);
          }
        }

        result = { userId, newEndDate: newEndDate.toISOString().split('T')[0], months };
        message = `Subscription extended by ${months} months`;
        break;

      case 'ban':
        // Disable user by setting end_date to yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        // Get current subscription
        const { data: banSub } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (banSub) {
          // Update existing subscription to expire yesterday
          const { error: banError } = await supabase
            .from('subscriptions')
            .update({
              end_date: yesterday.toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
              status: 'inactive'
            })
            .eq('id', banSub.id);

          if (banError) {
            throw new Error(`Failed to ban user: ${banError.message}`);
          }
        } else {
          // Create expired subscription
          const { error: createBanError } = await supabase
            .from('subscriptions')
            .insert({
              id: crypto.randomUUID(),
              user_id: userId,
              plan_name: 'expired',
              duration: 0,
              amount: 0,
              start_date: yesterday.toISOString().split('T')[0],
              end_date: yesterday.toISOString().split('T')[0],
              status: 'inactive'
            });
          if (createBanError) {
            throw new Error(`Failed to create expired subscription: ${createBanError.message}`);
          }
        }

        result = { userId };
        message = 'User banned successfully (subscription expired)';
        break;

      case 'reset_password': {
        if (!email) {
          return new Response(
            JSON.stringify({ error: 'Email is required for reset_password operation' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            }
          );
        }

        // Find user by email
        const { data: authUser, error: findError } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single();

        if (findError) {
          return new Response(
            JSON.stringify({ error: 'User not found' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 404
            }
          );
        }

        const targetUserId = authUser.id;

        // Update password using admin API
        const { error: updPwdErr } = await supabase.auth.admin.updateUserById(targetUserId, {
          password: newPassword || '@Testing123',
        });

        if (updPwdErr) {
          throw new Error(`Failed to update user password: ${updPwdErr.message}`);
        }

        // Ensure public.users exists
        const { error: upsertUserErr } = await supabase
          .from('users')
          .upsert({
            id: targetUserId,
            email,
            name: email.split('@')[0],
            role: 'owner',
            tenant_id: targetUserId,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }, { onConflict: 'id' });
        if (upsertUserErr) {
          throw new Error(`Failed to upsert public.users: ${upsertUserErr.message}`);
        }

        result = { userId: targetUserId, email };
        message = 'Password reset successful and user ensured in public.users';
        break;
      }

      // Removed 'ensure_testing_user' operation as account creation is now handled by the register page
      // All account creation should be done through the auth-register Edge Function or RegisterPage

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid operation. Supported: delete, extend, ban, reset_password' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        );
    }

    console.log('=== developer-operations SUCCESS ===');

    return new Response(
      JSON.stringify({
        success: true,
        operation,
        result,
        message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Developer operations error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});