// Test dengan working orderId yang sudah kita test
import { createHash } from 'crypto'

const DUITKU_MERCHANT_CODE = 'DS25746'
const DUITKU_MERCHANT_KEY = '318ee30197037540d3e145562ccdf491'

function md5hex(s) {
  return createHash('md5').update(s).digest('hex')
}

console.log('🎯 Testing with Working OrderId')
console.log('='.repeat(50))

// Gunakan orderId yang sama dengan working test
const merchantOrderId = 'TEST-1761860380034' // Working orderId
const paymentAmount = 10000
const paymentMethod = 'VC'

// Build signature (sama dengan yang berhasil)
const signatureString = DUITKU_MERCHANT_CODE + merchantOrderId + paymentAmount + DUITKU_MERCHANT_KEY
const signature = md5hex(signatureString)

console.log('🔐 Signature Details:')
console.log('  OrderId:', merchantOrderId)
console.log('  String:', signatureString)
console.log('  MD5:', signature)
console.log('')

// Payload
const payload = {
  merchantCode: DUITKU_MERCHANT_CODE,
  paymentAmount: paymentAmount,
  paymentMethod: paymentMethod,
  merchantOrderId: merchantOrderId,
  productDetails: 'Test Payment',
  email: 'test@example.com',
  phoneNumber: '081234567890',
  additionalParam: '',
  merchantUserInfo: '',
  customerVaName: 'test',
  callbackUrl: 'https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-callback',
  returnUrl: 'https://idcashier.my.id/payment/finish',
  signature: signature,
  expiryPeriod: 60
}

console.log('📤 Testing Edge Function with working orderId...')

async function testEdgeFunction() {
  try {
    const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-payment-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        amount: paymentAmount,
        paymentMethod: paymentMethod,
        orderId: merchantOrderId,
        productDetails: 'Test Payment',
        customerEmail: 'test@example.com',
        customerPhone: '081234567890'
      }),
    })
    
    const responseText = await response.text()
    
    console.log('📥 Edge Function Response:')
    console.log('  Status:', response.status, response.statusText)
    console.log('  Response:', responseText)
    console.log('')
    
    if (response.ok) {
      console.log('🎉 SUCCESS! Edge Function works with hardcoded signature')
    } else {
      console.log('❌ FAILED! Even hardcoded signature failed in Edge Function')
    }
    
  } catch (error) {
    console.error('❌ Network Error:', error.message)
  }
}

testEdgeFunction()
