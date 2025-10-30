// Debug signature generation - compare Edge Function vs local
import { createHash } from 'crypto'

const DUITKU_MERCHANT_CODE = 'DS25746'
const DUITKU_MERCHANT_KEY = '318ee30197037540d3e145562ccdf491'

function md5hex(s) {
  return createHash('md5').update(s).digest('hex')
}

console.log('🔍 Debugging Signature Generation')
console.log('='.repeat(50))

// Test data yang sama dengan Edge Function
const merchantOrderId = 'TEST-1761859108833'
const paymentAmount = 10000
const paymentMethod = 'VC'
const productDetails = 'Test Payment'
const customerEmail = 'test@example.com'
const customerPhone = '081234567890'

// Build signature string: merchantCode + merchantOrderId + paymentAmount + merchantKey
const signatureString = DUITKU_MERCHANT_CODE + merchantOrderId + paymentAmount + DUITKU_MERCHANT_KEY
const signature = md5hex(signatureString)

console.log('📋 Input Parameters:')
console.log('  merchantCode:', DUITKU_MERCHANT_CODE)
console.log('  merchantOrderId:', merchantOrderId)
console.log('  paymentAmount:', paymentAmount)
console.log('  merchantKey:', DUITKU_MERCHANT_KEY)
console.log('')

console.log('🔐 Signature Calculation:')
console.log('  Signature String:', signatureString)
console.log('  Expected MD5:', signature)
console.log('')

// Build complete payload (sesuai Edge Function)
const payload = {
  merchantCode: DUITKU_MERCHANT_CODE,
  paymentAmount: paymentAmount,
  paymentMethod: paymentMethod,
  merchantOrderId: merchantOrderId,
  productDetails: productDetails,
  email: customerEmail,
  phoneNumber: customerPhone,
  additionalParam: '',
  merchantUserInfo: '',
  customerVaName: customerEmail.split('@')[0] || 'Customer',
  callbackUrl: 'https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-callback',
  returnUrl: 'https://idcashier.my.id/payment/finish',
  signature: signature,
  expiryPeriod: 60
}

console.log('📤 Complete Payload:')
console.log(JSON.stringify(payload, null, 2))
console.log('')

// Test dengan payload ini
async function testWithDebugPayload() {
  try {
    console.log('⏳ Testing with debug payload...')
    
    const response = await fetch('https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    
    const responseText = await response.text()
    
    console.log('📥 Response:')
    console.log('  Status:', response.status, response.statusText)
    console.log('  Response:', responseText)
    console.log('')
    
    if (response.ok) {
      console.log('✅ SUCCESS! Signature is correct')
      try {
        const data = JSON.parse(responseText)
        console.log('🎉 Payment URL:', data.paymentUrl)
      } catch (e) {
        console.log('Response parsing failed:', e.message)
      }
    } else {
      console.log('❌ FAILED! Signature issue persists')
      
      if (response.status === 401) {
        console.log('')
        console.log('🔍 Possible Issues:')
        console.log('  1. MD5 implementation differs between Node.js and Deno')
        console.log('  2. Merchant key is incorrect')
        console.log('  3. Merchant code is incorrect')
        console.log('  4. Account suspended')
      }
    }
    
  } catch (error) {
    console.error('❌ Network Error:', error.message)
  }
}

testWithDebugPayload()
