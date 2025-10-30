// Test script untuk diagnosis Duitku payment function
import dotenv from 'dotenv'
dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

console.log('='.repeat(60))
console.log('🧪 Testing Duitku Payment Function')
console.log('='.repeat(60))
console.log('')

console.log('📋 Configuration:')
console.log('  SUPABASE_URL:', SUPABASE_URL ? '✓ Set' : '✗ Missing')
console.log('  SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing')
console.log('')

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

async function testPayment() {
  const testPayload = {
    amount: 10000,
    paymentMethod: 'VC',
    orderId: `TEST-${Date.now()}`,
    productDetails: 'Test Payment',
    customerEmail: 'test@example.com',
    customerPhone: '081234567890'
  }

  console.log('📤 Sending request:')
  console.log('  URL:', `${SUPABASE_URL}/functions/v1/duitku-payment-request`)
  console.log('  Payload:', JSON.stringify(testPayload, null, 2))
  console.log('')

  try {
    const startTime = Date.now()
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/duitku-payment-request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify(testPayload)
      }
    )
    const duration = Date.now() - startTime

    console.log('📥 Response received:')
    console.log('  Status:', response.status, response.statusText)
    console.log('  Duration:', duration, 'ms')
    console.log('')

    const responseText = await response.text()
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch (err) {
      console.error('❌ Failed to parse response as JSON')
      console.log('Raw response:', responseText)
      return
    }

    console.log('📄 Response body:')
    console.log(JSON.stringify(responseData, null, 2))
    console.log('')

    if (response.ok) {
      console.log('✅ SUCCESS!')
      if (responseData.paymentUrl) {
        console.log('💳 Payment URL:', responseData.paymentUrl)
        console.log('🆔 Order ID:', responseData.merchantOrderId)
      }
    } else {
      console.log('❌ FAILED!')
      console.log('')
      console.log('🔍 Error Analysis:')
      
      if (responseData.code === 500 && responseData.message?.includes('Missing Duitku credentials')) {
        console.log('  ⚠️  Duitku secrets are NOT set in Supabase')
        console.log('')
        console.log('  📝 To fix:')
        console.log('     1. Go to Supabase Dashboard')
        console.log('     2. Project Settings > Secrets')
        console.log('     3. Add these secrets:')
        console.log('        - DUITKU_BASE_URL = https://sandbox.duitku.com')
        console.log('        - DUITKU_MERCHANT_CODE = <your_merchant_code>')
        console.log('        - DUITKU_MERCHANT_KEY = <your_merchant_key>')
        console.log('     4. Redeploy function: supabase functions deploy duitku-payment-request')
      } else if (responseData.details?.providerResponse) {
        console.log('  ⚠️  Duitku API returned an error')
        console.log('  Provider Status:', responseData.providerStatus)
        console.log('  Provider Response:', JSON.stringify(responseData.details.providerResponse, null, 2))
        console.log('')
        console.log('  💡 Common issues:')
        console.log('     - Invalid merchant code/key')
        console.log('     - Wrong signature algorithm (try setting DUITKU_SIGNATURE_ALGO=md5)')
        console.log('     - Wrong base URL (sandbox vs production)')
      } else {
        console.log('  Error:', responseData.message || 'Unknown error')
        if (responseData.details) {
          console.log('  Details:', JSON.stringify(responseData.details, null, 2))
        }
      }
    }
  } catch (err) {
    console.error('❌ Request failed:', err.message)
    console.error('')
    console.error('Stack:', err.stack)
  }

  console.log('')
  console.log('='.repeat(60))
}

testPayment()
