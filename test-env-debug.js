// Test environment variables debugging
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load from both .env and .env.duitku
dotenv.config()
dotenv.config({ path: '.env.duitku' })

console.log('🔍 Environment Variables Debug')
console.log('='.repeat(50))

console.log('📋 Local Environment:')
console.log('  DUITKU_BASE_URL:', process.env.DUITKU_BASE_URL)
console.log('  DUITKU_MERCHANT_CODE:', process.env.DUITKU_MERCHANT_CODE)
console.log('  DUITKU_MERCHANT_KEY:', process.env.DUITKU_MERCHANT_KEY ? process.env.DUITKU_MERCHANT_KEY.substring(0, 10) + '...' : 'NOT SET')
console.log('  DUITKU_SIGNATURE_ALGO:', process.env.DUITKU_SIGNATURE_ALGO)
console.log('  SUPABASE_URL:', process.env.SUPABASE_URL)
console.log('  SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? process.env.SUPABASE_ANON_KEY.substring(0, 10) + '...' : 'NOT SET')
console.log('')

// Test Edge Function environment variables
async function testEdgeFunctionEnv() {
  try {
    console.log('📤 Testing Edge Function Environment...')
    
    const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-payment-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        amount: 10000,
        paymentMethod: 'VC',
        orderId: 'TEST-ENV-DEBUG-' + Date.now(),
        productDetails: 'Test Environment Debug',
        customerEmail: 'test@example.com',
        customerPhone: '081234567890'
      }),
    })
    
    const responseText = await response.text()
    
    console.log('📥 Edge Function Response:')
    console.log('  Status:', response.status, response.statusText)
    console.log('  Response:', responseText)
    
    // Try to extract environment info from response
    try {
      const responseJson = JSON.parse(responseText)
      if (responseJson.details) {
        console.log('')
        console.log('🔍 Edge Function Environment Info:')
        console.log('  Base URL:', responseJson.details.baseUrl)
        console.log('  Merchant Code:', responseJson.details.payloadPreview?.merchantCode)
        console.log('  Order ID:', responseJson.details.payloadPreview?.merchantOrderId)
        console.log('  Amount:', responseJson.details.payloadPreview?.paymentAmount)
      }
    } catch (e) {
      console.log('Could not parse response as JSON')
    }
    
  } catch (error) {
    console.error('❌ Network Error:', error.message)
  }
}

testEdgeFunctionEnv()
