// Test berbagai payment methods
import { createHash } from 'crypto'

const DUITKU_BASE_URL = 'https://sandbox.duitku.com'
const DUITKU_MERCHANT_CODE = 'DS25746'
const DUITKU_MERCHANT_KEY = '318ee30197037540d3e145562ccdf491'

function md5hex(s) {
  return createHash('md5').update(s).digest('hex')
}

console.log('🎯 Testing Different Payment Methods')
console.log('='.repeat(50))

// Common payment methods in Duitku sandbox
const paymentMethods = [
  'VC',     // Virtual Account
  'VA',     // Virtual Account (alternative)
  'BCA',    // BCA VA
  'BNI',    // BNI VA
  'BRI',    // BRI VA
  'MANDIRI', // Mandiri VA
  'CREDIT_CARD', // Credit Card
  'OVO',    // E-Wallet
  'DANA',   // E-Wallet
  'GOPAY',  // E-Wallet
  'LINKAJA', // E-Wallet
  'SHOPEEPAY', // E-Wallet
  'QRIS',   // QR Code
  'INDOMARET', // Retail
  'ALFAMART',  // Retail
]

async function testPaymentMethod(method) {
  const testPayload = {
    merchantCode: DUITKU_MERCHANT_CODE,
    paymentAmount: 10000,
    paymentMethod: method,
    merchantOrderId: `TEST-${method}-${Date.now()}`,
    productDetails: `Test Payment ${method}`,
    email: 'test@example.com',
    phoneNumber: '081234567890',
    returnUrl: 'https://idcashier.my.id/payment/finish',
    callbackUrl: 'https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-callback',
  }

  const signatureString = DUITKU_MERCHANT_CODE + testPayload.merchantOrderId + testPayload.paymentAmount + DUITKU_MERCHANT_KEY
  const signature = md5hex(signatureString)

  const payloadWithSignature = { ...testPayload, signature }

  try {
    const response = await fetch(`${DUITKU_BASE_URL}/webapi/api/merchant/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadWithSignature),
    })

    const responseText = await response.text()
    
    console.log(`${method.padEnd(12)} | ${response.status.toString().padEnd(3)} | ${response.statusText.padEnd(20)} | ${responseText.substring(0, 50)}...`)
    
    return response.ok
  } catch (error) {
    console.log(`${method.padEnd(12)} | ERROR | ${error.message}`)
    return false
  }
}

async function testAllMethods() {
  console.log('Method       | Status | Message                 | Response Preview')
  console.log('-'.repeat(80))
  
  let workingMethods = []
  
  for (const method of paymentMethods) {
    const works = await testPaymentMethod(method)
    if (works) workingMethods.push(method)
    await new Promise(resolve => setTimeout(resolve, 500)) // Rate limiting
  }
  
  console.log('')
  console.log('📊 Results:')
  console.log(`  Working methods: ${workingMethods.length > 0 ? workingMethods.join(', ') : 'None found'}`)
  console.log(`  Failed methods: ${paymentMethods.length - workingMethods.length}`)
  
  if (workingMethods.length > 0) {
    console.log('')
    console.log('🎯 Update your code to use working payment method:')
    console.log(`   paymentMethod: '${workingMethods[0]}'`)
  } else {
    console.log('')
    console.log('🚨 No payment methods work. Issue is likely:')
    console.log('   - Invalid merchant credentials')
    console.log('   - Suspended sandbox account')
    console.log('   - Wrong API endpoint')
  }
}

testAllMethods()
