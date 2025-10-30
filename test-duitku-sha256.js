// Test SHA256 signature langsung ke Duitku API
import { createHash } from 'crypto'

const DUITKU_BASE_URL = 'https://sandbox.duitku.com'
const DUITKU_MERCHANT_CODE = 'DS25746'
const DUITKU_MERCHANT_KEY = '318ee30197037540d3e145562ccdf491'

// SHA256 implementation
function sha256hex(s) {
  return createHash('sha256').update(s).digest('hex')
}

// MD5 implementation
function md5hex(s) {
  return createHash('md5').update(s).digest('hex')
}

console.log('🔍 Testing Both MD5 and SHA256 Signatures')
console.log('='.repeat(60))

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

// Build signature string
const signatureString = DUITKU_MERCHANT_CODE + testPayload.merchantOrderId + testPayload.paymentAmount + DUITKU_MERCHANT_KEY

const md5Signature = md5hex(signatureString)
const sha256Signature = sha256hex(signatureString).toLowerCase()

console.log('🔐 Signature Details:')
console.log('  String:', signatureString)
console.log('  MD5:', md5Signature)
console.log('  SHA256:', sha256Signature)
console.log('')

// Test both signatures
async function testSignature(signature, algo) {
  const payloadWithSignature = {
    ...testPayload,
    signature,
    merchantOrderId: `TEST-${algo.toUpperCase()}-${Date.now()}`
  }
  
  try {
    console.log(`⏳ Testing ${algo.toUpperCase()} signature...`)
    
    const response = await fetch(`${DUITKU_BASE_URL}/webapi/api/merchant/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadWithSignature),
    })
    
    const responseText = await response.text()
    
    console.log(`📥 ${algo.toUpperCase()} Response:`)
    console.log(`  Status: ${response.status} ${response.statusText}`)
    console.log(`  Response: ${responseText}`)
    console.log('')
    
    if (response.ok) {
      console.log(`✅ ${algo.toUpperCase()} SUCCESS!`)
      return true
    } else {
      console.log(`❌ ${algo.toUpperCase()} FAILED`)
      return false
    }
    
  } catch (error) {
    console.error(`❌ ${algo.toUpperCase()} Network Error:`, error.message)
    return false
  }
}

// Test both
async function runTests() {
  const md5Result = await testSignature(md5Signature, 'md5')
  const sha256Result = await testSignature(sha256Signature, 'sha256')
  
  console.log('📊 Summary:')
  console.log(`  MD5: ${md5Result ? '✅ WORKS' : '❌ FAILED'}`)
  console.log(`  SHA256: ${sha256Result ? '✅ WORKS' : '❌ FAILED'}`)
  
  if (md5Result || sha256Result) {
    const workingAlgo = md5Result ? 'md5' : 'sha256'
    console.log(``)
    console.log(`🎯 Use ${workingAlgo.toUpperCase()} signature in Supabase secrets:`)
    console.log(`   npx supabase secrets set DUITKU_SIGNATURE_ALGO=${workingAlgo}`)
  } else {
    console.log(``)
    console.log(`🚨 Both signatures failed. Check:`)
    console.log(`   - Merchant code validity`)
    console.log(`   - Merchant key correctness`)
    console.log(`   - Sandbox account status`)
  }
}

runTests()
