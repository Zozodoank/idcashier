// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';
import {
    calculateExtendedEndDate,
    getDerivedSubscriptionStatus,
    getEffectiveSubscription,
    getPlanNameForDuration,
    parseStoredDate,
    toDateOnly,
} from '../_shared/subscription.ts';

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

type RegisterResponse = {
  success: boolean;
  message?: string;
  userId?: string;
  isPriceCardRegistration?: boolean;
  requiresEmailVerification?: boolean;
  emailVerificationSent?: boolean;
  error?: string;
  details?: any;
};

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

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

        // Service role client (DB writes & admin)
        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });

        // Anon client (needed for signUp to trigger confirmation email)
        const supabaseAnon = createClient(supabaseUrl, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });

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
                // IMPORTANT:
                // - For trial email registrations (non price-card, not paid), we MUST send verification email.
                //   Using admin.createUser() does NOT send signup confirmation email.
                // - Therefore: use anon.auth.signUp() for trial email registrations.
                // - For paid/price-card flows we keep admin.createUser() and auto-confirm email after payment.

                const isTrialEmailSignup = !isPriceCardRegistration && !paymentCompleted;
                let authData: any = null;
                let authError: any = null;
                let requiresEmailVerification = false;

                if (isTrialEmailSignup) {
                  const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('VITE_SITE_URL') || 'https://idcashier.com';
                  const { data, error } = await supabaseAnon.auth.signUp({
                    email: email.toLowerCase().trim(),
                    password,
                    options: {
                      emailRedirectTo: `${siteUrl}/login?verified=true`,
                      data: {
                        name,
                        phone: phone || '',
                        role,
                        is_trial_user: true,
                        payment_completed: false,
                        is_price_card_registration: false,
                      }
                    }
                  });
                  authData = data;
                  authError = error;
                  // Supabase signUp returns user even if unconfirmed.
                  requiresEmailVerification = true;
                } else {
                  const { data, error } = await supabase.auth.admin.createUser({
                    email: email.toLowerCase().trim(),
                    password,
                    // IMPORTANT:
                    // - Trial email signup must require verification.
                    // - Price-card/paid flow must NOT require verification (user should be able to login, but app access is gated by subscription).
                    email_confirm: isPriceCardRegistration ? true : (paymentCompleted ? true : false),
                    user_metadata: {
                      name,
                      phone: phone || '',
                      role,
                      is_trial_user: false,
                      payment_completed: paymentCompleted || false,
                      payment_pending: isPriceCardRegistration && !paymentCompleted,
                      is_price_card_registration: isPriceCardRegistration,
                    },
                  });
                  authData = data;
                  authError = error;
                }

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

                // Attach verification flags to request body for response
                (body as any).__requiresEmailVerification = requiresEmailVerification;
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
                    payment_pending: isPriceCardRegistration && !paymentCompleted,
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
        const { data: existingSub } = await getEffectiveSubscription(
            supabase,
            userId,
            'id, start_date, end_date, status, plan_name, duration, created_at, updated_at'
        );

        if (paymentCompleted) {
            // PAYMENT COMPLETED: Create or update subscription with selected duration
            // Calculate end date based on plan duration (default 1 month = 30 days)
            const durationMonths = planDuration || 1;
            const requestedStartDate = new Date();
            const requestedEndDate = calculateExtendedEndDate(null, durationMonths, requestedStartDate);
            const currentEndDate = parseStoredDate(existingSub?.end_date);
            const shouldPreserveExistingWindow =
                !!currentEndDate && currentEndDate > requestedEndDate;
            const startDate =
                shouldPreserveExistingWindow && existingSub?.start_date
                    ? parseStoredDate(existingSub.start_date) || requestedStartDate
                    : requestedStartDate;
            const endDate = shouldPreserveExistingWindow ? currentEndDate! : requestedEndDate;
            const subscriptionStatus = getDerivedSubscriptionStatus(toDateOnly(endDate), new Date());
            const planName = getPlanNameForDuration(durationMonths);

            console.log(`Creating/updating subscription for paid user: ${userId}, duration: ${durationMonths} months`);

            if (existingSub) {
                // Update existing subscription
                const { error: updateSubError } = await supabase
                    .from('subscriptions')
                    .update({
                        start_date: toDateOnly(startDate),
                        end_date: toDateOnly(endDate),
                        status: subscriptionStatus,
                        updated_at: new Date().toISOString(),
                        plan_name: planName,
                        duration: durationMonths
                    })
                    .eq('id', existingSub.id);

                if (updateSubError) {
                    console.error('Error updating subscription:', updateSubError);
                } else {
                    console.log(`Subscription updated for user ${userId} - active until ${toDateOnly(endDate)}`);
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
                        start_date: toDateOnly(startDate),
                        end_date: toDateOnly(endDate),
                        status: subscriptionStatus,
                        plan_name: planName,
                        duration: durationMonths
                    });

                if (subError) {
                    console.error('Error creating subscription:', subError);
                } else {
                    console.log(`New subscription created for user ${userId} - active until ${toDateOnly(endDate)}`);
                }
            }

            // Also auto-confirm email for paid users and clear pending-payment metadata
            const { data: currentPaidAuthUser } = await supabase.auth.admin.getUserById(userId);
            await supabase.auth.admin.updateUserById(userId, {
                email_confirm: true,
                user_metadata: {
                    ...(currentPaidAuthUser?.user?.user_metadata || {}),
                    payment_completed: true,
                    payment_pending: false,
                    email_verified: true,
                    is_trial_user: false,
                    is_price_card_registration: isPriceCardRegistration
                }
            });

        } else if (!isPriceCardRegistration && !skipTrial) {
            // TRIAL USER: only create the default trial for a brand-new account.
            // Existing subscription rows must be preserved so expired accounts do not
            // become active again simply because this sync endpoint ran.

            const requestedTrialDays = typeof body.trialDays === 'number' ? body.trialDays : 7;
            const trialDays = requestedTrialDays > 0 ? requestedTrialDays : 7;

            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + trialDays);

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
                        start_date: toDateOnly(startDate),
                        end_date: toDateOnly(endDate),
                        status: 'active',
                        plan_name: 'trial',
                        duration: trialDays
                    });

                if (subError) {
                    console.error('Subscription error:', subError);
                    return new Response(
                      JSON.stringify({
                        success: false,
                        error: 'Failed to create trial subscription',
                        details: (subError as any)?.message || subError
                      }),
                      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
                    );
                } else {
                    console.log(`Trial subscription created for user ${userId} (${trialDays} days)`);
                }
            // Trial refresh is intentionally disabled so expired users do not
            // become active again when this endpoint runs for sync/recovery.
            } else if (false) {
                const { error: updateTrialError } = await supabase
                    .from('subscriptions')
                    .update({
                        start_date: startDate.toISOString().split('T')[0],
                        end_date: endDate.toISOString().split('T')[0],
                        status: 'active',
                        // When refreshing trial we always reset to trial metadata
                        plan_name: 'trial',
                        duration: trialDays,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingSub.id);

                if (updateTrialError) {
                    console.error('❌ Error updating trial subscription:', updateTrialError);
                    return new Response(
                      JSON.stringify({
                        success: false,
                        error: 'Failed to refresh trial subscription',
                        details: (updateTrialError as any)?.message || updateTrialError
                      }),
                      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
                    );
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

        const requiresEmailVerification = Boolean((body as any).__requiresEmailVerification);
        const responseBody: RegisterResponse = {
          success: true,
          message: isPriceCardRegistration
            ? 'Registration successful. Please complete payment to activate your account.'
            : (requiresEmailVerification
              ? 'Registration successful. Please check your email to verify your account.'
              : 'Registration successful.'),
          userId,
          isPriceCardRegistration,
          requiresEmailVerification,
          emailVerificationSent: requiresEmailVerification
        };

        return new Response(
          JSON.stringify(responseBody),
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
