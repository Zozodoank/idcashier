// @ts-ignore: Deno is available in Supabase Edge Functions runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';
import {
    deriveSubscriptionWindowFromPayment,
    getDerivedSubscriptionStatus,
    getEffectiveSubscription,
    parseStoredDate,
    toDateOnly,
} from '../_shared/subscription.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore
Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No authorization header' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            });
        }

        const supabase = createClient(
            // @ts-ignore
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            });
        }

        const { storeName, storeAddress, storePhone, storeDescription } = await req.json();

        if (!storeName) {
            return new Response(JSON.stringify({ error: 'Store name is required' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        // Update users table with store info using UPSERT
        // This creates the user profile if it doesn't exist yet
        const { error: upsertError } = await supabase
            .from('users')
            .upsert({
                id: user.id,
                name: storeName,
                email: user.email,
                role: 'owner', // Default role if creating new
                tenant_id: user.id, // Self-reference for owner
                // Add any other store-related fields
            }, { onConflict: 'id' });

        if (upsertError) {
            console.error('Error upserting user profile:', upsertError);
            return new Response(
                JSON.stringify({
                    error: 'Failed to setup store profile',
                    details: upsertError.message
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
        }

        // Update user metadata to mark setup as complete
        const supabaseAdmin = createClient(
            // @ts-ignore
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            {
                user_metadata: {
                    ...user.user_metadata,
                    store_name: storeName,
                    store_setup_completed: true,
                    payment_completed: true, // Ensure payment is marked complete here too
                    payment_pending: false,
                }
            }
        );

        if (metadataError) {
            console.error('Error updating metadata:', metadataError);
        }

        // Check if user has completed payments and activate subscription
        // Use service role to avoid RLS issues
        const { data: completedPayments, error: paymentsError } = await supabaseAdmin
            .from('payments')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .order('updated_at', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(10);

        const latestSubscriptionPayment = (completedPayments || []).find(payment =>
            deriveSubscriptionWindowFromPayment(payment)
        );

        if (!paymentsError && latestSubscriptionPayment) {
            // User has completed payment, ensure subscription is active
            const payment = latestSubscriptionPayment;
            const derivedWindow = deriveSubscriptionWindowFromPayment(payment);
            if (!derivedWindow) {
                throw new Error('Completed subscription payment could not be derived');
            }

            const { startDate, endDate, durationMonths, planName } = derivedWindow;
            
            // Check if user already has a subscription
            const { data: existingSub, error: existingSubError } = await getEffectiveSubscription(
                supabaseAdmin,
                user.id,
                '*'
            );
             
            if (existingSub) {
                const currentEndDate = parseStoredDate(existingSub.end_date);
                const effectiveEndDate =
                    currentEndDate && currentEndDate > endDate ? currentEndDate : endDate;
                const effectiveStartDate =
                    parseStoredDate(existingSub.start_date) || startDate;

                // Update existing subscription with payment info
                const { error: updateSubError } = await supabaseAdmin
                    .from('subscriptions')
                    .update({
                        start_date: toDateOnly(effectiveStartDate),
                        end_date: toDateOnly(effectiveEndDate),
                        status: getDerivedSubscriptionStatus(toDateOnly(effectiveEndDate)),
                        updated_at: new Date().toISOString(),
                        plan_name: planName || existingSub.plan_name,
                        duration: durationMonths
                    })
                    .eq('id', existingSub.id);
                
                if (updateSubError) {
                    console.error('Error updating subscription:', updateSubError);
                }
            } else {
                // Create new subscription
                const { error: insertSubError } = await supabaseAdmin
                    .from('subscriptions')
                    .insert({
                        id: crypto.randomUUID(),
                        user_id: user.id,
                        start_date: toDateOnly(startDate),
                        end_date: toDateOnly(endDate),
                        status: getDerivedSubscriptionStatus(toDateOnly(endDate)),
                        plan_name: planName,
                        duration: durationMonths
                    });
                
                if (insertSubError) {
                    console.error('Error creating subscription:', insertSubError);
                }
            }
        } else {
            // Check if there are any pending or paid payments that might become completed later
            const { data: pendingPaymentsCheck } = await supabaseAdmin
                .from('payments')
                .select('*')
                .eq('user_id', user.id)
                .in('status', ['pending', 'paid'])
                .order('created_at', { ascending: false })
                .limit(1);
            
            if (pendingPaymentsCheck && pendingPaymentsCheck.length > 0) {
                // User has pending/paid payments, they will be processed by the callback
                console.log('User has pending/paid payments, subscription will be activated by payment callback');
            } else {
                console.log('No completed payments found for user:', user.id);
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Store setup completed',
                storeName
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('Store setup error:', (error as Error).message);
        return new Response(
            JSON.stringify({
                error: (error as Error).message
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        );
    }
});
