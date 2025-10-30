// Test dengan endpoint Duitku V2 yang benar
import { createHash } from 'crypto'

const DUITKU_BASE_URL = 'https://sandbox.duitku.com'
const DUITKU_MERCHANT_CODE = 'DS25746'
const DUITKU_MERCHANT_KEY = '318ee30197037540d3e145562ccdf491'

function md5hex(s) {
  return createHash('md5').update(s).digest('hex')
}

console.log('🚀 Testing Duitku V2 API (Correct Endpoint)')
console.log('='.repeat(60))

// Test data sesuai dokumentasi Duitku V2
const merchantOrderId = `TEST-${Date.now()}`
const paymentAmount = 40000 // Match documentation example
const paymentMethod = 'VC'

// Build signature sesuai docs: merchantCode + merchantOrderId + paymentAmount + apiKey
const signatureString = DUITKU_MERCHANT_CODE + merchantOrderId + paymentAmount + DUITKU_MERCHANT_KEY
const signature = md5hex(signatureString)

// Payload sesuai dokumentasi Duitku V2
const payload = {
  merchantCode: DUITKU_MERCHANT_CODE,
  paymentAmount: paymentAmount,
  paymentMethod: paymentMethod,
  merchantOrderId: merchantOrderId,
  productDetails: 'Tes pembayaran menggunakan Duitku',
  email: 'test@example.com',
  phoneNumber: '08123456789',
  additionalParam: '',
  merchantUserInfo: '',
  customerVaName: 'John Doe',
  callbackUrl: 'https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-callback',
  returnUrl: 'https://idcashier.my.id/payment/finish',
  signature: signature,
  expiryPeriod: 10
}

console.log('📤 Request Details:')
console.log('  URL:', `${DUITKU_BASE_URL}/webapi/api/merchant/v2/inquiry`)
console.log('  Method: POST')
console.log('  Signature String:', signatureString)
console.log('  Signature:', signature)
console.log('  Payload:', JSON.stringify(payload, null, 2))
console.log('')

// Test langsung ke Duitku V2 API
async function testDuitkuV2() {
  try {
    console.log('⏳ Calling Duitku V2 API...')
    const startTime = Date.now()
    
    const response = await fetch(`${DUITKU_BASE_URL}/webapi/api/merchant/v2/inquiry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    
    const duration = Date.now() - startTime
    const responseText = await response.text()
    
    console.log('📥 Response Details:')
    console.log('  Status:', response.status, response.statusText)
    console.log('  Duration:', duration, 'ms')
    console.log('  Response:', responseText)
    console.log('')
    
    if (response.ok) {
      console.log('✅ SUCCESS! Duitku V2 API accepted the request')
      try {
        const data = JSON.parse(responseText)
        console.log('🎯 Response Parsed:')
        console.log('  paymentUrl:', data.paymentUrl || 'N/A')
        console.log('  merchantCode:', data.merchantCode || 'N/A')
        console.log('  reference:', data.reference || 'N/A')
        console.log('  vaNumber:', data.vaNumber || 'N/A')
        console.log('  amount:', data.amount || 'N/A')
        console.log('  statusCode:', data.statusCode || 'N/A')
        console.log('  statusMessage:', data.statusMessage || 'N/A')
        
        if (data.paymentUrl) {
          console.log('')
          console.log('🎉 PAYMENT URL GENERATED SUCCESSFULLY!')
          console.log('   ', data.paymentUrl)
        }
      } catch (e) {
        console.log('Response is not valid JSON:', e.message)
      }
    } else {
      console.log('❌ FAILED! Duitku V2 API returned error')
      
      if (response.status === 400) {
        console.log('  - Status 400: Bad Request - check parameters')
      } else if (response.status === 401) {
        console.log('  - Status 401: Unauthorized - check credentials')
      } else if (response.status === 500) {
        console.log('  - Status 500: Server Error - still endpoint issue?')
      }
    }
    
  } catch (error) {
    console.error('❌ Network Error:', error.message)
  }
}

testDuitkuV2()
