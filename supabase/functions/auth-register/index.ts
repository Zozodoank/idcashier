// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';

// Supabase subscriptions table uses `id` as NOT NULL without default in this project.
// Always generate an ID when inserting new subscriptions to avoid silent failures.
const generateUuid = () => {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for older runtimes
    // @ts-ignore
    return (globalThis as any).crypto?.randomUUID?.() || null;
  }
};

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
    trialDays?: number; // Optional: explicit trial duration requested by client
    userId?: string; // Optional: provided for OAuth sync
    oauthUserId?: string; // Legacy OAuth field
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
        const body = (await req.json()) as RegisterRequest;
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
        } = body;

        const resolvedUserId = providedUserId || body.oauthUserId || (body as any).user_id;

        // Validate input
        if (!email || (!password && !resolvedUserId) || !name) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Email, name, and (password OR userId) are required',
                    received: {
                        email: !!email,
                        name: !!name,
                        hasPassword: !!password,
                        resolvedUserId: resolvedUserId || null
                    }
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

        let userId = resolvedUserId;

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

            // First check if user already exists in public users table (linked to Auth)
            const { data: existingPublicUser } = await supabase
                .from('users')
                .select('id')
                .eq('email', email.toLowerCase().trim())
                .maybeSingle();

            if (existingPublicUser) {
                console.log('User found in public records, using existing ID:', existingPublicUser.id);
                userId = existingPublicUser.id;
            } else {
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
                    // If auth user already exists, attempt to recover by email
                    const message = authError.message?.toLowerCase() || '';
                    if (message.includes('already') || message.includes('exists') || message.includes('duplicate')) {
                        console.warn('Auth user already exists. Attempting recovery by email...');
                        const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
                        if (listError) {
                            console.error('List users error:', listError);
                            return new Response(
                                JSON.stringify({
                                    success: false,
                                    error: 'User already exists but could not recover auth user',
                                    details: listError.message
                                }),
                                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                            );
                        }
                        const foundUser = listData?.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase().trim());
                        if (!foundUser) {
                            return new Response(
                                JSON.stringify({
                                    success: false,
                                    error: 'User already exists but could not find auth user'
                                }),
                                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
                            );
                        }
                        userId = foundUser.id;
                    } else {
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
                } else {
                    userId = authData.user.id;
                }
            }
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

        // Ensure userId is defined
        if (!userId) {
            throw new Error('User ID is required');
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
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: 'Failed to create user profile',
                        details: userError.message
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
            .select('id, end_date, status, plan_name, duration')
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
                const newId = generateUuid();
                if (!newId) {
                    console.error('❌ Failed to generate UUID for subscription insert');
                    throw new Error('Failed to generate subscription id');
                }
                const { error: subError } = await supabase
                    .from('subscriptions')
                    .insert({
                        id: newId,
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
            // TRIAL USER: Always ensure user gets a fresh trial window.
            // Previously: trial was only created if no subscription existed.
            // This caused "expired" for users who had an old/expired subscription (e.g. previous failed attempt).
            // New behavior:
            // - If no subscription exists: insert trial
            // - If subscription exists but expired: update to new trial window from today
            // - If subscription exists and still active (e.g. paid): do not override

            const requestedTrialDays = typeof body.trialDays === 'number' ? body.trialDays : 7;
            const trialDays = requestedTrialDays > 0 ? requestedTrialDays : 7;

            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + trialDays);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const existingEnd = existingSub?.end_date ? new Date(existingSub.end_date) : null;
            if (existingEnd && !isNaN(existingEnd.getTime())) {
                existingEnd.setHours(0, 0, 0, 0);
            }

            const isExistingExpired = !existingSub || !existingEnd || existingEnd < today || existingSub.status === 'expired';

            if (!existingSub) {
                const newId = generateUuid();
                if (!newId) {
                    console.error('❌ Failed to generate UUID for trial subscription insert');
                    throw new Error('Failed to generate subscription id');
                }

                const { error: subError } = await supabase
                    .from('subscriptions')
                    .insert({
                        id: newId,
                        user_id: userId,
                        start_date: startDate.toISOString().split('T')[0],
                        end_date: endDate.toISOString().split('T')[0],
                        status: 'active',
                        plan_name: 'trial',
                        duration: trialDays
                    });

                if (subError) {
                    console.error('Subscription error:', subError);
                } else {
                    console.log(`Trial subscription created for user ${userId} (${trialDays} days)`);
                }
            } else if (isExistingExpired) {
                const { error: updateTrialError } = await supabase
                    .from('subscriptions')
                    .update({
                        start_date: startDate.toISOString().split('T')[0],
                        end_date: endDate.toISOString().split('T')[0],
                        status: 'active',
                        plan_name: (existingSub as any)?.plan_name || 'trial',
                        duration: (existingSub as any)?.duration || trialDays,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingSub.id);

                if (updateTrialError) {
                    console.error('❌ Error updating trial subscription:', updateTrialError);
                } else {
                    console.log(`✅ Trial subscription refreshed for user ${userId} (${trialDays} days)`);
                }
            } else {
                console.log('ℹ️ Existing subscription still active; not overriding with trial', {
                    userId,
                    existingEndDate: existingSub.end_date,
                    existingStatus: existingSub.status
                });
            }
        } else {
            console.log('Skipping trial subscription for price card registration (will be activated after payment)');
        }

        console.log('User synced/registered successfully:', {
            userId,
            email,
            isPriceCardRegistration,
            skipTrial,
            isOAuthSync: !!resolvedUserId
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
                stack: error?.stack || null
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        );
    }
});
