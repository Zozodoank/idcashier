// Test different base URLs untuk Duitku API
import { createHash } from 'crypto'

const DUITKU_MERCHANT_CODE = 'DS25746'
const DUITKU_MERCHANT_KEY = '318ee30197037540d3e145562ccdf491'

function md5hex(s) {
  return createHash('md5').update(s).digest('hex')
}

console.log('🔍 Testing Different Base URLs')
console.log('='.repeat(50))

// Test data
const merchantOrderId = `TEST-${Date.now()}`
const paymentAmount = 10000
const paymentMethod = 'VC'

// Build signature
const signatureString = DUITKU_MERCHANT_CODE + merchantOrderId + paymentAmount + DUITKU_MERCHANT_KEY
const signature = md5hex(signatureString)

console.log('🔐 Signature Details:')
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

// Different base URLs to test
const baseUrls = [
  'https://sandbox.duitku.com',
  'https://api-sandbox.duitku.com',
  'https://api.duitku.com',
  'https://passport.duitku.com'
]

async function testBaseUrl(baseUrl) {
  try {
    console.log(`📤 Testing ${baseUrl}...`)
    
    const response = await fetch(`${baseUrl}/webapi/api/merchant/v2/inquiry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    
    const responseText = await response.text()
    
    console.log(`📥 ${baseUrl} Response:`)
    console.log(`  Status: ${response.status} ${response.statusText}`)
    console.log(`  Response: ${responseText.substring(0, 100)}...`)
    console.log('')
    
    if (response.ok) {
      console.log(`✅ ${baseUrl} SUCCESS!`)
      return true
    } else {
      console.log(`❌ ${baseUrl} FAILED`)
      return false
    }
    
  } catch (error) {
    console.error(`❌ ${baseUrl} Network Error:`, error.message)
    return false
  }
}

async function runTests() {
  console.log('Testing base URLs...')
  console.log('')
  
  const results = []
  for (const baseUrl of baseUrls) {
    const result = await testBaseUrl(baseUrl)
    results.push({ baseUrl, result })
  }
  
  console.log('📊 Results:')
  results.forEach(({ baseUrl, result }) => {
    console.log(`  ${baseUrl}: ${result ? '✅ WORKS' : '❌ FAILED'}`)
  })
  
  const working = results.find(r => r.result)
  if (working) {
    console.log('')
    console.log(`🎯 Use ${working.baseUrl} in Edge Function`)
  } else {
    console.log('')
    console.log('❌ No base URL worked')
  }
}

runTests()
