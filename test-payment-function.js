// Test script to verify the Duitku payment function
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

// Create supabase client directly
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Environment check:');
console.log('- VITE_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Not set');
console.log('- VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Set' : '✗ Not set');

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

console.log('✅ Supabase client initialized successfully');

async function testPaymentFunction() {
  console.log('Testing Duitku payment function...');
  
  try {
    // First, let's check if we can get a session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log('Session error:', sessionError.message);
      return;
    }
    
    if (!session) {
      console.log('No active session. Please login first.');
      return;
    }
    
    console.log('Session found, calling payment function...');
    
    // Call the payment function
    const { data, error } = await supabase.functions.invoke('duitku-payment-request', {
      body: {
        amount: 10000, // Rp 10,000
        paymentMethod: 'VC', // Virtual Account
        productDetails: 'Test Payment',
        orderId: `TEST-${Date.now()}`
      }
    });
    
    if (error) {
      console.log('Function error:', error.message);
      return;
    }
    
    console.log('Function response:', data);
    
    if (data?.paymentUrl) {
      console.log('✅ Payment URL received:', data.paymentUrl);
    } else {
      console.log('❌ No payment URL in response');
    }
    
  } catch (err) {
    console.error('Test error:', err.message);
  }
}

testPaymentFunction();