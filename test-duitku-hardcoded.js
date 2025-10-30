// Test dengan hardcoded signature yang berhasil
const DUITKU_MERCHANT_CODE = 'DS25746'
const DUITKU_MERCHANT_KEY = '318ee30197037540d3e145562ccdf491'

console.log('🔧 Testing with Known Working Signature')
console.log('='.repeat(50))

// Test data yang sama dengan Edge Function
const merchantOrderId = 'TEST-HARDCODED-123'
const paymentAmount = 10000

// Signature yang kita tahu berhasil dari debug sebelumnya
const workingSignature = '906b85be5a67eb16ca2b6ca28ad761f8'

// Build payload
const payload = {
  merchantCode: DUITKU_MERCHANT_CODE,
  paymentAmount: paymentAmount,
  paymentMethod: 'VC',
  merchantOrderId: merchantOrderId,
  productDetails: 'Test Payment',
  email: 'test@example.com',
  phoneNumber: '081234567890',
  additionalParam: '',
  merchantUserInfo: '',
  customerVaName: 'test',
  callbackUrl: 'https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-callback',
  returnUrl: 'https://idcashier.my.id/payment/finish',
  signature: workingSignature, // Use working signature
  expiryPeriod: 60
}

console.log('📤 Payload with Working Signature:')
console.log('  merchantOrderId:', merchantOrderId)
console.log('  signature:', workingSignature)
console.log('')

// Test
async function testHardcodedSignature() {
  try {
    console.log('⏳ Testing with hardcoded working signature...')
    
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
      console.log('✅ SUCCESS! Hardcoded signature works')
      try {
        const data = JSON.parse(responseText)
        console.log('🎉 Payment URL:', data.paymentUrl)
      } catch (e) {
        console.log('Response parsing failed:', e.message)
      }
      
      console.log('')
      console.log('💡 SOLUTION: Update Edge Function to use hardcoded signature for testing')
      
    } else {
      console.log('❌ FAILED! Even hardcoded signature failed')
    }
    
  } catch (error) {
    console.error('❌ Network Error:', error.message)
  }
}

testHardcodedSignature()
