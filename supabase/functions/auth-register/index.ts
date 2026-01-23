// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
};

interface RegisterRequest {
    email: string;
    password?: string; // Optional for OAuth sync
    name: string;
    phone?: string;
    role?: string;
    isPriceCardRegistration?: boolean;
    skipTrial?: boolean;
    userId?: string; // Optional: provided for OAuth sync
    oauthProvider?: string; // Optional: to indicate OAuth flow
    paymentCompleted?: boolean;
    planDuration?: number; // Subscription duration in months
}

// @ts-ignore: Deno is available in Supabase Edge Functions runtime
Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const {
            email,
            password,
            name,
            phone,
            role = 'owner',
            isPriceCardRegistration = false,
            skipTrial = false,
            userId: providedUserId,
            oauthProvider,
            paymentCompleted,
            planDuration = 1
        }: RegisterRequest = await req.json();

        // Validate input
        if (!email || (!password && !providedUserId) || !name) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Email, name, and (password OR userId) are required'
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                }
            );
        }

        // Create Supabase client with service role key
        const supabase = createClient(
            // @ts-ignore: Deno is available at runtime
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore: Deno is available at runtime
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );

        let userId = providedUserId;

        // If userId is NOT provided, we need to create the auth user
        if (!userId) {
            if (!password) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: 'Password is required for new user creation'
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                );
            }

            // Create user in auth
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: email.toLowerCase().trim(),
                password,
                email_confirm: paymentCompleted ? true : false,
                user_metadata: {
                    name,
                    phone: phone || '',
                    role,
                    is_trial_user: !isPriceCardRegistration && !paymentCompleted,
                    payment_completed: paymentCompleted || false,
                    is_price_card_registration: isPriceCardRegistration,
                },
            });

            if (authError) {
                console.error('Auth error:', authError);
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: authError.message
                    }),
                    {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 400,
                    }
                );
            }
            userId = authData.user.id;
        } else {
            // OAuth Case: User already exists in Auth, just update metadata if needed
            console.log(`Syncing existing user ${userId} to public tables`);

            // Optionally update metadata to ensure consistency
            await supabase.auth.admin.updateUserById(userId, {
                user_metadata: {
                    name,
                    phone: phone || '',
                    role,
                    is_trial_user: !isPriceCardRegistration && !paymentCompleted,
                    payment_completed: paymentCompleted || false,
                    is_price_card_registration: isPriceCardRegistration,
                    oauth_provider: oauthProvider
                }
            });
        }

        // Check if public profile already exists to avoid duplicate key error
        const { data: existingProfile } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

        if (!existingProfile) {
            // Create user in public.users table
            const { error: userError } = await supabase
                .from('users')
                .insert({
                    id: userId,
                    name,
                    email: email.toLowerCase().trim(),
                    // If syncing OAuth, we can default role/status
                    role: role || 'owner',
                    tenant_id: userId, // Self-reference for owner
                    // status: isPriceCardRegistration ? 'inactive' : 'active'
                });

            if (userError) {
                console.error('User table error:', userError);
                // Only delete Auth user if we just created it (not for OAuth sync)
                if (!providedUserId) {
                    await supabase.auth.admin.deleteUser(userId!);
                }

                return new Response(
                    JSON.stringify({
                        success: false,
                        error: 'Failed to create user profile'
                    }),
                    {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 500,
                    }
                );
            }
        } else {
            console.log('Public profile already exists, skipping creation');
        }

        // Handle Subscription
        // Check if subscription exists first
        const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('id, end_date, status')
            .eq('user_id', userId)
            .maybeSingle();

        if (paymentCompleted) {
            // PAYMENT COMPLETED: Create or update subscription with selected duration
            const startDate = new Date();
            const endDate = new Date();

            // Calculate end date based on plan duration (default 1 month = 30 days)
            const durationMonths = planDuration || 1;
            endDate.setDate(endDate.getDate() + (durationMonths * 30));

            console.log(`Creating/updating subscription for paid user: ${userId}, duration: ${durationMonths} months`);

            if (existingSub) {
                // Update existing subscription
                const { error: updateSubError } = await supabase
                    .from('subscriptions')
                    .update({
                        start_date: startDate.toISOString().split('T')[0],
                        end_date: endDate.toISOString().split('T')[0],
                        status: 'active',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingSub.id);

                if (updateSubError) {
                    console.error('Error updating subscription:', updateSubError);
                } else {
                    console.log(`Subscription updated for user ${userId} - active until ${endDate.toISOString().split('T')[0]}`);
                }
            } else {
                // Create new subscription
                const { error: subError } = await supabase
                    .from('subscriptions')
                    .insert({
                        user_id: userId,
                        start_date: startDate.toISOString().split('T')[0],
                        end_date: endDate.toISOString().split('T')[0],
                        status: 'active'
                    });

                if (subError) {
                    console.error('Error creating subscription:', subError);
                } else {
                    console.log(`New subscription created for user ${userId} - active until ${endDate.toISOString().split('T')[0]}`);
                }
            }

            // Also auto-confirm email for paid users
            await supabase.auth.admin.updateUserById(userId, {
                email_confirm: true,
                user_metadata: {
                    payment_completed: true,
                    email_verified: true
                }
            });

        } else if (!isPriceCardRegistration && !skipTrial) {
            // TRIAL USER: Only create trial subscription if NOT from price card AND not skipped
            if (!existingSub) {
                const startDate = new Date();
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + 7);

                const { error: subError } = await supabase
                    .from('subscriptions')
                    .insert({
                        user_id: userId,
                        start_date: startDate.toISOString().split('T')[0],
                        end_date: endDate.toISOString().split('T')[0],
                        status: 'active'
                    });

                if (subError) {
                    console.error('Subscription error:', subError);
                } else {
                    console.log(`Trial subscription created for user ${userId}`);
                }
            }
        } else {
            console.log('Skipping trial subscription for price card registration (will be activated after payment)');
        }

        console.log('User synced/registered successfully:', {
            userId,
            email,
            isPriceCardRegistration,
            skipTrial,
            isOAuthSync: !!providedUserId
        });

        return new Response(
            JSON.stringify({
                success: true,
                message: isPriceCardRegistration
                    ? 'Registration successful. Please complete payment to activate your account.'
                    : 'Registration successful. Please check your email to verify your account.',
                userId,
                isPriceCardRegistration,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 201,
            }
        );
    } catch (error: any) {
        console.error('Registration error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        );
    }
});
