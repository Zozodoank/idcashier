// @ts-ignore: Deno is available in Supabase Edge Functions runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';

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
                }
            }
        );

        if (metadataError) {
            console.error('Error updating metadata:', metadataError);
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
