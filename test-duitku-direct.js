// Test script langsung ke Duitku API (bypass Edge Function)
import { createHash } from 'crypto'

const DUITKU_BASE_URL = 'https://sandbox.duitku.com'
const DUITKU_MERCHANT_CODE = 'DS25746'
const DUITKU_MERCHANT_KEY = '318ee30197037540d3e145562ccdf491'
const DUITKU_SIGNATURE_ALGO = 'md5'

// MD5 implementation
function md5hex(s) {
  return createHash('md5').update(s).digest('hex')
}

// Build signature
function buildSignature(merchantCode, orderId, amount, key) {
  const base = merchantCode + orderId + amount + key
  return md5hex(base)
}

console.log('🚀 Testing Direct Duitku API')
console.log('='.repeat(50))

// Test data
const testPayload = {
  merchantCode: DUITKU_MERCHANT_CODE,
  paymentAmount: 10000,
  paymentMethod: 'VC',
  merchantOrderId: `TEST-${Date.now()}`,
  productDetails: 'Test Payment',
  email: 'test@example.com',
  phoneNumber: '081234567890',
  returnUrl: 'https://idcashier.my.id/payment/finish',
  callbackUrl: 'https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-callback',
}

// Generate signature
const signature = buildSignature(
  DUITKU_MERCHANT_CODE,
  testPayload.merchantOrderId,
  testPayload.paymentAmount,
  DUITKU_MERCHANT_KEY
)

const payloadWithSignature = {
  ...testPayload,
  signature
}

console.log('📤 Request Details:')
console.log('  URL:', `${DUITKU_BASE_URL}/webapi/api/merchant/payment`)
console.log('  Method: POST')
console.log('  Signature Algorithm:', DUITKU_SIGNATURE_ALGO)
console.log('  Signature:', signature)
console.log('  Payload:', JSON.stringify(payloadWithSignature, null, 2))
console.log('')

// Make request to Duitku API
async function testDuitkuAPI() {
  try {
    console.log('⏳ Calling Duitku API...')
    const startTime = Date.now()
    
    const response = await fetch(`${DUITKU_BASE_URL}/webapi/api/merchant/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadWithSignature),
    })
    
    const duration = Date.now() - startTime
    const responseText = await response.text()
    
    console.log('📥 Response Details:')
    console.log('  Status:', response.status, response.statusText)
    console.log('  Duration:', duration, 'ms')
    console.log('  Response:', responseText)
    console.log('')
    
    if (response.ok) {
      console.log('✅ SUCCESS! Duitku API accepted the request')
      try {
        const data = JSON.parse(responseText)
        if (data.paymentUrl) {
          console.log('💳 Payment URL:', data.paymentUrl)
        }
      } catch (e) {
        console.log('Response is not JSON')
      }
    } else {
      console.log('❌ FAILED! Duitku API returned error')
      console.log('🔍 Analysis:')
      
      if (response.status === 500) {
        console.log('  - Status 500: Likely signature mismatch')
        console.log('  - Check signature algorithm (MD5 vs SHA256)')
        console.log('  - Check merchant credentials')
      } else if (response.status === 400) {
        console.log('  - Status 400: Invalid request parameters')
      }
    }
    
  } catch (error) {
    console.error('❌ Network Error:', error.message)
  }
}

testDuitkuAPI()
