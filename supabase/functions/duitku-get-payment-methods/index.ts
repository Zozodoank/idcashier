// Edge Function to get available Duitku payment methods
// NOTE: Duitku getpaymentmethod endpoint uses SHA256 signature:
// SHA256(merchantcode + amount + datetime + apiKey)
import { createHash } from "node:crypto";
import { corsHeaders } from '../_shared/cors.ts';

// @ts-ignore: Deno is available in Supabase Edge Functions runtime
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { amount = 10000 } = await req.json();

        // @ts-ignore: Deno is available at runtime
        const merchantCode = Deno.env.get("DUITKU_MERCHANT_CODE") || "";
        // @ts-ignore: Deno is available at runtime
        const apiKey = Deno.env.get("DUITKU_API_KEY")?.trim() || "";

        if (!merchantCode || !apiKey) {
            throw new Error('Merchant credentials not configured');
        }

        // Format datetime as required by Duitku: yyyy-MM-dd HH:mm:ss
        const now = new Date();
        const datetime = now.toISOString()
            .replace('T', ' ')
            .substring(0, 19);

        // Signature: SHA256(merchantCode + amount + datetime + apiKey)
        const signatureString = `${merchantCode}${amount}${datetime}${apiKey}`;
        const signature = createHash('sha256').update(signatureString).digest('hex');

        const payload = {
            merchantcode: merchantCode,
            amount: amount,
            datetime: datetime,
            signature: signature
        };

        console.log('Fetching payment methods from Duitku...');

        // Production-only runtime (no sandbox)
        // @ts-ignore: Deno is available at runtime
        const ENV = (Deno.env.get('DUITKU_ENVIRONMENT') || 'production').toLowerCase();
        // Use WebAPI base URL from env when provided (fallback to production)
        // Expected: https://passport.duitku.com/webapi
        // @ts-ignore: Deno is available at runtime
        const DUITKU_WEBAPI_BASE_URL = (Deno.env.get('DUITKU_WEBAPI_BASE_URL') || 'https://passport.duitku.com/webapi').replace(/\/$/, '');

        console.log(`Using Duitku Environment: ${ENV} (${DUITKU_WEBAPI_BASE_URL})`);

        const apiUrl = `${DUITKU_WEBAPI_BASE_URL}/api/merchant/paymentmethod/getpaymentmethod`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Duitku Error:', data);
            throw new Error(data.Message || 'Failed to get payment methods');
        }

        console.log('Available payment methods:', data.paymentFee?.length || 0);

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error('Error getting payment methods:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
