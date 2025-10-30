// Test dengan format payload PHP library
import { createHash } from 'crypto'

const DUITKU_MERCHANT_CODE = 'DS25746'
const DUITKU_MERCHANT_KEY = '318ee30197037540d3e145562ccdf491'

function md5hex(s) {
  return createHash('md5').update(s).digest('hex')
}

console.log('🔍 Testing PHP Library Format')
console.log('='.repeat(50))

// Test data
const merchantOrderId = `TEST-${Date.now()}`
const paymentAmount = 10000
const paymentMethod = 'VC' // Credit Card

// Build signature
const signatureString = DUITKU_MERCHANT_CODE + merchantOrderId + paymentAmount + DUITKU_MERCHANT_KEY
const signature = md5hex(signatureString)

console.log('🔐 Signature Details:')
console.log('  String:', signatureString)
console.log('  MD5:', signature)
console.log('')

// Payload format 1: Dengan merchantCode (seperti dokumentasi API)
const payload1 = {
  merchantCode: DUITKU_MERCHANT_CODE,
  paymentAmount: paymentAmount,
  paymentMethod: paymentMethod,
  merchantOrderId: merchantOrderId,
  productDetails: 'Test Payment',
  email: 'test@example.com',
  phoneNumber: '081234567890',
  additionalParam: '',
  merchantUserInfo: '',
  customerVaName: 'John Doe',
  callbackUrl: 'https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-callback',
  returnUrl: 'https://idcashier.my.id/payment/finish',
  signature: signature,
  expiryPeriod: 60
}

// Payload format 2: Tanpa merchantCode (seperti PHP library)
const payload2 = {
  paymentAmount: paymentAmount,
  paymentMethod: paymentMethod,
  merchantOrderId: merchantOrderId,
  productDetails: 'Test Payment',
  email: 'test@example.com',
  phoneNumber: '081234567890',
  additionalParam: '',
  merchantUserInfo: '',
  customerVaName: 'John Doe',
  callbackUrl: 'https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-callback',
  returnUrl: 'https://idcashier.my.id/payment/finish',
  signature: signature,
  expiryPeriod: 60
}

async function testPayload(payload, format) {
  try {
    console.log(`📤 Testing ${format}...`)
    
    const response = await fetch('https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    
    const responseText = await response.text()
    
    console.log(`📥 ${format} Response:`)
    console.log(`  Status: ${response.status} ${response.statusText}`)
    console.log(`  Response: ${responseText.substring(0, 100)}...`)
    console.log('')
    
    if (response.ok) {
      console.log(`✅ ${format} SUCCESS!`)
      return true
    } else {
      console.log(`❌ ${format} FAILED`)
      return false
    }
    
  } catch (error) {
    console.error(`❌ ${format} Network Error:`, error.message)
    return false
  }
}

async function runTests() {
  const result1 = await testPayload(payload1, 'With merchantCode')
  const result2 = await testPayload(payload2, 'Without merchantCode')
  
  console.log('📊 Results:')
  console.log(`  With merchantCode: ${result1 ? '✅ WORKS' : '❌ FAILED'}`)
  console.log(`  Without merchantCode: ${result2 ? '✅ WORKS' : '❌ FAILED'}`)
  
  if (result1 || result2) {
    const workingFormat = result1 ? 'With merchantCode' : 'Without merchantCode'
    console.log('')
    console.log(`🎯 Use ${workingFormat} in Edge Function`)
  }
}

runTests()
