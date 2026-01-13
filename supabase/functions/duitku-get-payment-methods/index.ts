// Edge Function to get available Duitku payment methods
import { createHash } from "node:crypto";
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { amount = 10000 } = await req.json();

        const merchantCode = Deno.env.get("DUITKU_MERCHANT_CODE") || "";
        const apiKey = Deno.env.get("DUITKU_API_KEY")?.trim() || "";

        if (!merchantCode || !apiKey) {
            throw new Error('Merchant credentials not configured');
        }

        // Format datetime as required by Duitku: yyyy-MM-dd HH:mm:ss
        const now = new Date();
        const datetime = now.toISOString()
            .replace('T', ' ')
            .substring(0, 19);

        // Signature: SHA256(merchantcode + paymentAmount + datetime + apiKey)
        const signatureString = `${merchantCode}${amount}${datetime}${apiKey}`;
        const signature = createHash("sha256").update(signatureString).digest("hex");

        const payload = {
            merchantcode: merchantCode,
            amount: amount,
            datetime: datetime,
            signature: signature
        };

        console.log('Fetching payment methods from Duitku...');

        const apiUrl = 'https://passport.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod';

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
