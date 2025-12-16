// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Declare Deno for non-Deno environments (VS Code linter fix)
declare const Deno: any;

// Import Supabase client
import { corsHeaders, handleOptions, createResponse, createErrorResponse } from '../_shared/cors.ts';
import { createSupabaseClient, getUserIdFromToken } from '../_shared/auth.ts';

// Helper to generate MD5 signature (Pure JS implementation)
function generateSignature(data: string): string {
  const rotateLeft = (lValue: number, iShiftBits: number) => (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  const addUnsigned = (lX: number, lY: number) => {
    const lX4 = (lX & 0x40000000), lY4 = (lY & 0x40000000);
    const lX8 = (lX & 0x80000000), lY8 = (lY & 0x80000000);
    const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
    if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
      else return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
    } else return (lResult ^ lX8 ^ lY8);
  };
  const funcF = (x: number, y: number, z: number) => (x & y) | ((~x) & z);
  const funcG = (x: number, y: number, z: number) => (x & z) | (y & (~z));
  const funcH = (x: number, y: number, z: number) => x ^ y ^ z;
  const funcI = (x: number, y: number, z: number) => y ^ (x | (~z));
  const funcFF = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
    a = addUnsigned(a, addUnsigned(addUnsigned(funcF(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  };
  const funcGG = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
    a = addUnsigned(a, addUnsigned(addUnsigned(funcG(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  };
  const funcHH = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
    a = addUnsigned(a, addUnsigned(addUnsigned(funcH(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  };
  const funcII = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
    a = addUnsigned(a, addUnsigned(addUnsigned(funcI(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  };
  const convertToWordArray = (s: string) => {
    let lWordCount;
    const lMessageLength = s.length;
    const lNumberOfWords_temp1 = lMessageLength + 8;
    const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    const lWordArray = Array(lNumberOfWords - 1);
    let lBytePosition = 0;
    let lByteCount = 0;
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (s.charCodeAt(lByteCount) << lBytePosition));
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  };
  const wordToHex = (lValue: number) => {
    let wordToHexValue = "", wordToHexValue_temp = "", lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      wordToHexValue_temp = "0" + lByte.toString(16);
      wordToHexValue = wordToHexValue + wordToHexValue_temp.substr(wordToHexValue_temp.length - 2, 2);
    }
    return wordToHexValue;
  };
  
  let x = convertToWordArray(data);
  let k, AA, BB, CC, DD, a, b, c, d;
  let S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  let S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  let S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  let S41 = 6, S42 = 10, S43 = 15, S44 = 21;
  
  a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
  
  for (k = 0; k < x.length; k += 16) {
    AA = a; BB = b; CC = c; DD = d;
    a = funcFF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
    d = funcFF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
    c = funcFF(c, d, a, b, x[k + 2], S13, 0x242070DB);
    b = funcFF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
    a = funcFF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
    d = funcFF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
    c = funcFF(c, d, a, b, x[k + 6], S13, 0xA8304613);
    b = funcFF(b, c, d, a, x[k + 7], S14, 0xFD469501);
    a = funcFF(a, b, c, d, x[k + 8], S11, 0x698098D8);
    d = funcFF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
    c = funcFF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
    b = funcFF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
    a = funcFF(a, b, c, d, x[k + 12], S11, 0x6B901122);
    d = funcFF(d, a, b, c, x[k + 13], S12, 0xFD987193);
    c = funcFF(c, d, a, b, x[k + 14], S13, 0xA679438E);
    b = funcFF(b, c, d, a, x[k + 15], S14, 0x49B40821);
    a = funcGG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
    d = funcGG(d, a, b, c, x[k + 6], S22, 0xC040B340);
    c = funcGG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
    b = funcGG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
    a = funcGG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
    d = funcGG(d, a, b, c, x[k + 10], S22, 0x2441453);
    c = funcGG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
    b = funcGG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
    a = funcGG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
    d = funcGG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
    c = funcGG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
    b = funcGG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
    a = funcGG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
    d = funcGG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
    c = funcGG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
    b = funcGG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
    a = funcHH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
    d = funcHH(d, a, b, c, x[k + 8], S32, 0x8771F681);
    c = funcHH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
    b = funcHH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
    a = funcHH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
    d = funcHH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
    c = funcHH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
    b = funcHH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
    a = funcHH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
    d = funcHH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
    c = funcHH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
    b = funcHH(b, c, d, a, x[k + 6], S34, 0x4881D05);
    a = funcHH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
    d = funcHH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
    c = funcHH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
    b = funcHH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
    a = funcII(a, b, c, d, x[k + 0], S41, 0xF4292244);
    d = funcII(d, a, b, c, x[k + 7], S42, 0x432AFF97);
    c = funcII(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
    b = funcII(b, c, d, a, x[k + 5], S44, 0xFC93A039);
    a = funcII(a, b, c, d, x[k + 12], S41, 0x655B59C3);
    d = funcII(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
    c = funcII(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
    b = funcII(b, c, d, a, x[k + 1], S44, 0x85845DD1);
    a = funcII(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
    d = funcII(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
    c = funcII(c, d, a, b, x[k + 6], S43, 0xA3014314);
    b = funcII(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
    a = funcII(a, b, c, d, x[k + 4], S41, 0xF7537E82);
    d = funcII(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
    c = funcII(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
    b = funcII(b, c, d, a, x[k + 9], S44, 0xEB86D391);
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// Type definitions
interface PlanData {
  duration: number;
  amount: number;
  productDetails: string;
}

const logger = {
  info: (message: string, data?: any) =>
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data) : ''),
  error: (message: string, error?: any) =>
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error ? JSON.stringify(error) : ''),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data) : '')
};

// Plan mapping
const PLAN_MAPPING: Record<string, PlanData> = {
  '1_month':  { duration: 1,  amount: 50000,  productDetails: 'Perpanjangan Langganan 1 Bulan' },
  '3_months': { duration: 3,  amount: 150000, productDetails: 'Perpanjangan Langganan 3 Bulan' },
  '6_months': { duration: 6,  amount: 270000, productDetails: 'Perpanjangan Langganan 6 Bulan' },
  '12_months':{ duration: 12, amount: 500000, productDetails: 'Perpanjangan Langganan 12 Bulan' }
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { plan_id, email: rawEmail, paymentMethod, hppActivation } = body || {};

    // 1) Validasi input
    if (!plan_id || !PLAN_MAPPING[plan_id]) {
      return createErrorResponse('Invalid or missing plan_id', 400);
    }
    if (!paymentMethod || typeof paymentMethod !== 'string' || paymentMethod.trim() === '') {
      return createErrorResponse('paymentMethod is required', 400);
    }

    // 2) Auth: Bearer token atau email
    const supabase = createSupabaseClient();
    let userData: any;
    const authHeader = req.headers.get('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const userId = await getUserIdFromToken(token);
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, phone, role, tenant_id')
        .eq('id', userId)
        .single();
      if (error || !data) return createErrorResponse('User not found', 404);
      userData = data;
    } else if (rawEmail) {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, phone, role, tenant_id')
        .eq('email', String(rawEmail).trim().toLowerCase())
        .single();
      if (error || !data) return createErrorResponse('User not found for the provided email', 404);
      userData = data;
    } else {
      return createErrorResponse('Missing authorization header or email', 401);
    }

    // 3) Detail plan dan order id unik
    const planData = PLAN_MAPPING[plan_id];
    // Shorten Order ID to avoid length limits (max 50 chars usually).
    const shortUserId = userData.id.substring(0, 8);
    const merchantOrderId = `RENEWAL-${shortUserId}-${Date.now()}`;
    
    // Modify productDetails if this is HPP activation
    let productDetails = planData.productDetails;
    if (hppActivation) {
      productDetails = `Aktivasi HPP - ${planData.productDetails}`;
    }

    // 4) Konfigurasi Duitku dari ENV
    const ENV = (Deno.env.get('DUITKU_ENVIRONMENT') || 'sandbox').toLowerCase();
    const DUITKU_MERCHANT_CODE = Deno.env.get('DUITKU_MERCHANT_CODE')?.trim() || '';
    
    // Pakai DUITKU_API_KEY (fallback ke DUITKU_MERCHANT_KEY untuk kompatibilitas lama)
    const DUITKU_API_KEY =
      Deno.env.get('DUITKU_API_KEY')?.trim() ||
      Deno.env.get('DUITKU_MERCHANT_KEY')?.trim() ||
      '';

    if (!DUITKU_MERCHANT_CODE || !DUITKU_API_KEY) {
      logger.error('Server misconfigured: Missing Duitku credentials');
      return createErrorResponse('Server configuration error', 500);
    }

    // 5) Signature MD5 (PHP Lib Order: merchantCode + merchantOrderId + paymentAmount + apiKey)
    const signatureString = `${DUITKU_MERCHANT_CODE}${merchantOrderId}${planData.amount}${DUITKU_API_KEY}`;
    const signature = generateSignature(signatureString);

    // 6) Payload ke Duitku
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/duitku-callback`;
    // Use client-provided returnUrl if valid, otherwise fallback to env
    const clientReturnUrl = body?.returnUrl;
    const defaultReturnUrl = `${Deno.env.get('FRONTEND_URL')}/payment-callback?renewal=1`;
    
    // Validate client URL (basic protection)
    const returnUrl = (clientReturnUrl && (clientReturnUrl.startsWith('http://') || clientReturnUrl.startsWith('https://'))) 
      ? clientReturnUrl 
      : defaultReturnUrl;
      
    logger.info('Using Return URL:', { returnUrl, fromClient: !!clientReturnUrl });

    const itemDetails = [
      { name: productDetails, price: planData.amount, quantity: 1 }
    ];

    // Split name for first/last
    const fullName = (userData.name || 'Customer').trim();
    const nameParts = fullName.split(' ');
    let firstName = nameParts[0];
    let lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0]; // Use first name as last name if no last name

    const customerDetail = {
      firstName: firstName,
      lastName: lastName,
      email: userData.email,
      phoneNumber: userData.phone || '081234567890',
      billingAddress: {
        firstName: firstName,
        lastName: lastName,
        address: "Indonesia",
        city: "Jakarta",
        postalCode: "12345",
        phone: userData.phone || '081234567890',
        countryCode: "ID"
      },
      shippingAddress: {
        firstName: firstName,
        lastName: lastName,
        address: "Indonesia",
        city: "Jakarta",
        postalCode: "12345",
        phone: userData.phone || '081234567890',
        countryCode: "ID"
      }
    };

    const additionalParam = JSON.stringify({ userId: userData.id, email: userData.email });

    const duitkuPayload = {
      merchantCode: DUITKU_MERCHANT_CODE,
      paymentAmount: planData.amount,
      paymentMethod: paymentMethod.trim(),
      merchantOrderId,
      productDetails: productDetails,
      additionalParam,
      customerVaName: userData.name || 'Customer',
      email: userData.email,
      phoneNumber: userData.phone || '081234567890',
      itemDetails,
      customerDetail,
      callbackUrl,
      returnUrl,
      signature,
      expiryPeriod: 60
    };

    // 7) Endpoint Duitku
    const DUITKU_BASE_URL = ENV === 'production'
      ? 'https://passport.duitku.com'
      : 'https://sandbox.duitku.com';
    const DUITKU_URL = `${DUITKU_BASE_URL}/webapi/api/merchant/v2/inquiry`;

    logger.info('Calling Duitku inquiry', { url: DUITKU_URL });

    const duitkuResponse = await fetch(DUITKU_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(duitkuPayload),
    });

    const rawText = await duitkuResponse.text();
    let duitkuData: any = null;
    try { duitkuData = JSON.parse(rawText); } catch { /* non-JSON */ }

    const success =
      duitkuResponse.ok &&
      (duitkuData?.statusCode === '00' || duitkuData?.StatusCode === '00');

    if (!success) {
      const code = duitkuData?.statusCode ?? duitkuData?.StatusCode ?? duitkuResponse.status;
      const msg  = duitkuData?.statusMessage ?? duitkuData?.StatusMessage ?? duitkuResponse.statusText;
      logger.error('Duitku API Error', {
        httpStatus: duitkuResponse.status,
        statusText: duitkuResponse.statusText,
        code, msg,
        responseBody: rawText,
        payloadSent: duitkuPayload
      });
      return createErrorResponse(`Duitku API Error: [${code}] ${msg}`, 500);
    }

    // 8) Simpan record payment
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userData.id,
        amount: planData.amount,
        merchant_order_id: merchantOrderId,
        product_details: productDetails,
        customer_va_name: userData.name,
        customer_email: userData.email,
        customer_phone: userData.phone || '081234567890',
        status: 'pending',
        payment_url: duitkuData.paymentUrl,
        reference: duitkuData.reference
      });

    if (paymentError) {
      logger.error('Failed to create payment record', paymentError);
      return createErrorResponse(`Failed to save payment record: ${paymentError.message}`, 500);
    }

    return createResponse({
      success: true,
      paymentUrl: duitkuData.paymentUrl,
      reference: duitkuData.reference,
      merchantOrderId,
      message: 'Payment request created successfully'
    }, 201);

  } catch (error: any) {
    logger.error('Unhandled error in renew-subscription-payment function', { message: error?.message, stack: error?.stack });
    return createErrorResponse('Internal server error', 500);
  }
});
