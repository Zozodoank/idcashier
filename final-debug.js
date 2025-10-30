// Final debugging script - compare exact values
import { createHash } from 'crypto'

const DUITKU_MERCHANT_CODE = 'DS25746'
const DUITKU_MERCHANT_KEY = '318ee30197037540d3e145562ccdf491'

function md5hex(s) {
  return createHash('md5').update(s).digest('hex')
}

console.log('🔍 FINAL DEBUG - Exact Signature Comparison')
console.log('='.repeat(60))

// Test data yang sama dengan Edge Function terakhir
const merchantOrderId = 'TEST-1761859293686' // Dari response terakhir
const paymentAmount = 10000

// Calculate signature
const signatureString = DUITKU_MERCHANT_CODE + merchantOrderId + paymentAmount + DUITKU_MERCHANT_KEY
const expectedSignature = md5hex(signatureString)

console.log('📋 Exact Parameters from Last Request:')
console.log('  merchantCode:', DUITKU_MERCHANT_CODE)
console.log('  merchantOrderId:', merchantOrderId)
console.log('  paymentAmount:', paymentAmount)
console.log('  merchantKey:', DUITKU_MERCHANT_KEY)
console.log('')

console.log('🔐 Signature Details:')
console.log('  Signature String:', signatureString)
console.log('  Expected MD5:', expectedSignature)
console.log('  String Length:', signatureString.length)
console.log('  Signature Length:', expectedSignature.length)
console.log('')

// Test dengan signature ini
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
  signature: expectedSignature,
  expiryPeriod: 60
}

console.log('📤 Testing with Exact Signature...')
console.log('')

async function testExactSignature() {
  try {
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
      console.log('🎉 SUCCESS! This signature works!')
      console.log('')
      console.log('💡 SOLUTION: The signature calculation is correct')
      console.log('   The issue might be in Edge Function MD5 implementation')
      console.log('   Expected signature:', expectedSignature)
    } else {
      console.log('❌ FAILED! Even exact signature failed')
      console.log('')
      console.log('🚨 This means:')
      console.log('   1. Merchant credentials are invalid')
      console.log('   2. Account is suspended')
      console.log('   3. API endpoint changed')
      console.log('   4. Request format is wrong')
    }
    
  } catch (error) {
    console.error('❌ Network Error:', error.message)
  }
}

testExactSignature()
