// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';
import {
    calculateExtendedEndDate,
    ensureTrialSubscription,
    getDerivedSubscriptionStatus,
    getDurationMonthsFromPayment,
    getEffectiveSubscription,
    getPlanNameForDuration,
    parseStoredDate,
    toDateOnly,
} from '../_shared/subscription.ts';

// Pemanggil anonim (alur signup email) hanya boleh menautkan akun yang baru
// saja dibuat. Lihat canLinkFreshSignup().
const SIGNUP_LINK_WINDOW_MS = 15 * 60 * 1000;

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
    /** @deprecated Alias lama dari isPriceCardRegistration. Tetap diterima. */
    skipTrial?: boolean;
    /** @deprecated Diabaikan: durasi trial ditentukan server (TRIAL_DAYS). */
    trialDays?: number;
    userId?: string; // Optional: provided for OAuth sync
    oauthUserId?: string; // Legacy OAuth field
    oauthProvider?: string; // Optional: to indicate OAuth flow
    /** @deprecated Tidak dipercaya lagi: aktivasi berbayar wajib lewat merchantOrderId. */
    paymentCompleted?: boolean;
    /** @deprecated Diabaikan: durasi berbayar diturunkan dari baris payments. */
    planDuration?: number;
    /** Wajib untuk aktivasi berbayar (diverifikasi ke tabel payments). */
    merchantOrderId?: string;
    useHPP?: boolean;
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

// Pemanggil anonim tidak punya sesi (signup email). Akun hanya boleh ditautkan
// bila: email sama, akun baru dibuat (< 15 menit), dan belum punya subscription.
// Ini menutup penyalahgunaan userId dari body (defect #3) tanpa memutus alur
// signup email yang sekarang berjalan.
async function canLinkFreshSignup(supabase: any, userId: string, email: string): Promise<boolean> {
    try {
        const { data, error } = await supabase.auth.admin.getUserById(userId);
        if (error || !data?.user) return false;

        const authEmail = String(data.user.email || '').toLowerCase().trim();
        if (!authEmail || authEmail !== String(email || '').toLowerCase().trim()) return false;

        const createdAt = new Date(data.user.created_at).getTime();
        if (!Number.isFinite(createdAt) || Date.now() - createdAt > SIGNUP_LINK_WINDOW_MS) {
            return false;
        }

        const { data: existingSub } = await getEffectiveSubscription(supabase, userId, 'id');
        return !existingSub;
    } catch (error: any) {
        console.error('canLinkFreshSignup failed:', error?.message || error);
        return false;
    }
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
            merchantOrderId,
        } = body;

        const requestedUserId = providedUserId || body.oauthUserId || (body as any).user_id;

        // Validate input
        if (!email || !name) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Email and name are required',
                    received: {
                        email: !!email,
                        name: !!name,
                    }
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                }
            );
        }

        // Alur price-card berhenti sebelum trial; flag ini hanya "routing hint",
        // bukan penentu durasi (durasi selalu dari server).
        const isPaidFlow = isPriceCardRegistration || skipTrial;
        const normalizedMerchantOrderId =
            typeof merchantOrderId === 'string' && merchantOrderId.trim() ? merchantOrderId.trim() : null;

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

        // ------------------------------------------------------------------
        // Resolusi identitas (defect #3)
        // config.toml menandai verify_jwt = true, tetapi workflow deploy memakai
        // --no-verify-jwt, sehingga kepercayaan pada body HARUS diverifikasi di
        // dalam function ini.
        // ------------------------------------------------------------------
        const authHeader = req.headers.get('Authorization') ?? '';
        const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
            ? authHeader.slice(7).trim()
            : '';
        const isAnonToken = !bearerToken || bearerToken === anonKey;

        let tokenUserId: string | null = null;
        if (!isAnonToken) {
            const { data: tokenUserResult, error: tokenError } = await supabase.auth.getUser(bearerToken);
            if (tokenError || !tokenUserResult?.user) {
                console.error('Invalid session token:', tokenError?.message);
                return new Response(
                    JSON.stringify({ success: false, error: 'Invalid or expired session' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
                );
            }
            tokenUserId = tokenUserResult.user.id;
        }

        // Aktivasi berbayar hanya bila baris payments benar-benar 'completed'.
        let paidPayment: any = null;
        if (normalizedMerchantOrderId) {
            const { data: paymentRow, error: paymentLookupError } = await supabase
                .from('payments')
                .select('id, user_id, amount, product_details, status, created_at, updated_at')
                .eq('merchant_order_id', normalizedMerchantOrderId)
                .maybeSingle();

            if (paymentLookupError) {
                console.error('Payment lookup error:', paymentLookupError);
            }

            if (paymentRow && paymentRow.status === 'completed') {
                paidPayment = paymentRow;
            } else {
                console.log('Payment not completed yet for merchantOrderId', normalizedMerchantOrderId);
            }
        }

        // Dibaca oleh blok metadata & trial di bawah (nilai sudah terverifikasi).
        const paymentCompleted = !!paidPayment;

        let userId: string | null = null;

        if (tokenUserId) {
            // Sesi Supabase = bukti identitas terkuat.
            if (requestedUserId && requestedUserId !== tokenUserId) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Session does not match the requested user' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
                );
            }
            userId = tokenUserId;
        } else if (paidPayment) {
            // Pembayaran yang sudah 'completed' membuktikan pemilik akun.
            if (requestedUserId && requestedUserId !== paidPayment.user_id) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Payment does not belong to the requested user' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
                );
            }
            userId = paidPayment.user_id;
        } else if (requestedUserId) {
            // Signup email: user auth dibuat oleh client beberapa detik lalu dan
            // belum punya sesi, jadi divalidasi lewat email + umur akun + belum
            // punya subscription.
            const canLink = await canLinkFreshSignup(supabase, requestedUserId, email);
            if (!canLink) {
                console.warn('Rejected unverified identity', { requestedUserId, email });
                return new Response(
                    JSON.stringify({ success: false, error: 'Unverified identity' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
                );
            }
            userId = requestedUserId;
        }

        // If userId is NOT resolved above, we need to create the auth user
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
            }
        } else {
            // OAuth Case: User already exists in Auth, just update metadata if needed
            console.log(`Syncing existing user ${userId} to public tables`);

            // Merge, jangan ganti seluruh user_metadata (defect #7): field dari
            // Google seperti full_name/avatar_url/picture harus tetap ada.
            const { data: currentAuthUser } = await supabase.auth.admin.getUserById(userId);
            await supabase.auth.admin.updateUserById(userId, {
                user_metadata: {
                    ...(currentAuthUser?.user?.user_metadata || {}),
                    name,
                    phone: phone || '',
                    role,
                    is_trial_user: !isPriceCardRegistration && !paymentCompleted,
                    payment_completed: paymentCompleted,
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
            // upsert + ignoreDuplicates: aman terhadap race dengan duitku-callback
            // yang bisa membuat baris yang sama secara paralel (defect #14).
            const { error: userError } = await supabase
                .from('users')
                .upsert({
                    id: userId,
                    name,
                    email: email.toLowerCase().trim(),
                    // If syncing OAuth, we can default role/status
                    role: role || 'owner',
                    tenant_id: userId, // Self-reference for owner
                    // status: isPriceCardRegistration ? 'inactive' : 'active'
                }, { onConflict: 'id', ignoreDuplicates: true });

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

        if (paidPayment) {
            // PAID: aktivasi hanya boleh berasal dari baris payments berstatus
            // 'completed' (defect #2). Durasi diturunkan dari payment, bukan body.
            const durationMonths = getDurationMonthsFromPayment(paidPayment) || 1;
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

        } else if (normalizedMerchantOrderId) {
            // Pembayaran tercatat tetapi belum 'completed': jangan sentuh
            // subscription sama sekali. Aktivasi dituntaskan duitku-callback.
            console.log('Payment pending, subscription activation deferred', {
                userId,
                merchantOrderId: normalizedMerchantOrderId
            });
        } else if (!isPaidFlow) {
            // FREE TRIAL (defect #1, #6, #8, #10, #14): durasi, idempotensi, dan
            // syarat verifikasi email seluruhnya ditentukan server.
            const trialResult = await ensureTrialSubscription(supabase, userId, {
                requireVerifiedEmail: true
            });
            console.log('Trial handling result:', { userId, trialResult });
        } else {
            console.log('Skipping trial subscription for price card registration (will be activated after payment)');
        }

        console.log('User synced/registered successfully:', {
            userId,
            email,
            isPriceCardRegistration,
            isPaidFlow,
            merchantOrderId: normalizedMerchantOrderId,
            paymentCompleted
        });

        // Pembayaran belum tuntas: klien (PaymentCallbackPage) melakukan polling
        // subscriptions-get-current-user, dan duitku-callback menuntaskan aktivasi.
        if (normalizedMerchantOrderId && !paidPayment) {
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Payment is being processed',
                    userId,
                    subscription: 'pending',
                    requiresEmailVerification: false
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 202,
                }
            );
        }

        // Nilainya sama dengan perilaku nyata hari ini (email konfirmasi dikirim
        // oleh client), tetapi tidak lagi lewat side-channel body (defect #13).
        const requiresEmailVerification = !isPaidFlow && !paymentCompleted;
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
