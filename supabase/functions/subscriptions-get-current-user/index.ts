// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import { createResponse, createErrorResponse, handleOptions } from '../_shared/cors.ts'
import { createSupabaseClient, getUserIdFromToken } from '../_shared/auth.ts'
import {
  deriveSubscriptionWindowFromPayment,
  getDerivedSubscriptionStatus,
  getEffectiveSubscription,
  isSubscriptionActive,
  parseStoredDate,
  pickEffectiveSubscription,
  toDateOnly,
} from '../_shared/subscription.ts'

const getPaymentBackedSubscription = async (supabase: any, userId: string, existingSubscription: any = null) => {
  const { data: payments, error } = await supabase
    .from('payments')
    .select('id, user_id, amount, product_details, subscription_start_date, subscription_end_date, created_at, updated_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Failed to fetch completed payments: ${error.message}`);
  }

  const eligiblePayments = (payments || [])
    .map((payment: any) => {
      const window = deriveSubscriptionWindowFromPayment(payment);
      return window ? { payment, window } : null;
    })
    .filter(Boolean);

  if (eligiblePayments.length === 0) {
    return null;
  }

  const candidates = eligiblePayments.map((item: any) => {
    const currentEndDate = parseStoredDate(existingSubscription?.end_date);
    const effectiveEndDate =
      currentEndDate && currentEndDate > item.window.endDate ? currentEndDate : item.window.endDate;
    const effectiveStartDate =
      parseStoredDate(existingSubscription?.start_date) || item.window.startDate;
    const endDate = toDateOnly(effectiveEndDate);

    return {
      ...(existingSubscription || {}),
      id: existingSubscription?.id || item.payment.id,
      user_id: userId,
      payment_id: existingSubscription?.payment_id || item.payment.id,
      amount: item.payment.amount,
      plan_name: item.window.planName || existingSubscription?.plan_name,
      duration: item.window.durationMonths,
      start_date: toDateOnly(effectiveStartDate),
      end_date: endDate,
      status: getDerivedSubscriptionStatus(endDate),
      created_at: existingSubscription?.created_at || item.payment.created_at,
      updated_at: existingSubscription?.updated_at || item.payment.updated_at,
      source: existingSubscription ? 'subscription_with_payment_fallback' : 'payment_fallback',
    };
  });

  return pickEffectiveSubscription(candidates);
};

// @ts-ignore
Deno.serve(async (req: Request) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return handleOptions(req)
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse('Missing authorization header', 401);
    }

    // Extract token
    const token = authHeader.substring(7);

    // Create Supabase client with service role key to bypass RLS
    const supabase = createSupabaseClient();

    // Get user ID from token (now properly awaited)
    const originalUserId = await getUserIdFromToken(token);
    let userId = originalUserId;

    // Get user email to check for test account
    const { data: userWithEmail, error: emailError } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (emailError || !userWithEmail) {
      return createErrorResponse('User not found', 404);
    }

    // Special handling for test account - should always be treated as expired
    if (userWithEmail.email === 'testing@idcashier.com') {
      // Return expired subscription for test account
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 7); // 7 days ago
      return createResponse({
        user_id: userId,
        has_subscription: true,
        is_active: false,
        plan_name: '1_month',
        duration: 1,
        amount: 50000,
        start_date: expiredDate.toISOString().split('T')[0],
        end_date: expiredDate.toISOString().split('T')[0],
        status: 'expired',
        created_at: expiredDate.toISOString(),
        updated_at: expiredDate.toISOString()
      });
    } else if (userWithEmail.email === 'demo@idcashier.com' || userWithEmail.email === 'jho.j80@gmail.com') {
      // Always return active subscription for demo and dev accounts
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      return createResponse({
        user_id: userId,
        has_subscription: true,
        is_active: true,
        plan_name: 'developer',
        duration: 12,
        amount: 0,
        start_date: new Date().toISOString().split('T')[0],
        end_date: futureDate.toISOString().split('T')[0],
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // For cashiers, use the owner's subscription (tenantId)
    // First get user role and tenantId
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, tenant_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return createErrorResponse('User not found', 404);
    }

    // If user is a cashier, use the owner's ID for subscription
    if (userData.role === 'cashier' && userData.tenant_id) {
      userId = userData.tenant_id;
    }

    // Get subscription for the user (or owner if cashier)
    // Use service role to bypass RLS restrictions
    const { data: subscription, error } = await getEffectiveSubscription(
      supabase,
      userId,
      '*'
    );

    if (error) {
      console.error('Subscription query error:', error);
      // Return proper error instead of default subscription
      return createErrorResponse('Failed to fetch subscription data', 500);
    }

    let effectiveSubscription = subscription;
    const subscriptionIsActive = isSubscriptionActive(subscription?.end_date, new Date());

    if (!subscriptionIsActive) {
      const paymentCandidateIds = [...new Set([userId, originalUserId].filter(Boolean))];
      const paymentBackedSubscriptions = [];

      for (const candidateUserId of paymentCandidateIds) {
        const candidate = await getPaymentBackedSubscription(
          supabase,
          candidateUserId,
          candidateUserId === userId ? subscription : null
        );
        if (candidate) {
          paymentBackedSubscriptions.push(candidate);
        }
      }

      const paymentBackedSubscription = pickEffectiveSubscription(paymentBackedSubscriptions);
      if (paymentBackedSubscription && isSubscriptionActive(paymentBackedSubscription.end_date, new Date())) {
        effectiveSubscription = paymentBackedSubscription;
      }
    }

    if (!effectiveSubscription) {
      // If no subscription found, return null to indicate no subscription
      return createResponse({
        user_id: userId,
        has_subscription: false,
        message: 'No active subscription found'
      });
    }

    const isActive = isSubscriptionActive(effectiveSubscription.end_date, new Date());
    const normalizedStatus = getDerivedSubscriptionStatus(effectiveSubscription.end_date, new Date());

    return createResponse({
      ...effectiveSubscription,
      status: normalizedStatus,
      is_active: isActive,
      has_subscription: true
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    // Return proper error instead of default subscription
    return createErrorResponse('Internal server error', 500);
  }
});
