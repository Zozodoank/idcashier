// Final test dengan hardcoded working signature
import { createHash } from 'crypto'
import dotenv from 'dotenv'

dotenv.config()
dotenv.config({ path: '.env.duitku' })

const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE
const DUITKU_MERCHANT_KEY = process.env.DUITKU_MERCHANT_KEY
const DUITKU_SIGNATURE_ALGO = process.env.DUITKU_SIGNATURE_ALGO

function md5hex(s) {
  return createHash('md5').update(s).digest('hex')
}

console.log('🎯 Final Test: Working Hardcoded Signature')
console.log('='.repeat(60))

// Gunakan orderId yang sudah ada hardcoded signature-nya
const merchantOrderId = 'TEST-COMPARISON-1761861585781'
const paymentAmount = 10000

console.log('📋 Test Parameters:')
console.log('  Merchant Code:', DUITKU_MERCHANT_CODE)
console.log('  Order ID:', merchantOrderId)
console.log('  Amount:', paymentAmount)
console.log('  Merchant Key:', DUITKU_MERCHANT_KEY.substring(0, 10) + '...')
console.log('  Algorithm:', DUITKU_SIGNATURE_ALGO)
console.log('')

// Generate signature locally
const signatureString = DUITKU_MERCHANT_CODE + merchantOrderId + paymentAmount + DUITKU_MERCHANT_KEY
const localSignature = DUITKU_SIGNATURE_ALGO === 'md5' ? md5hex(signatureString) : signatureString

console.log('🔐 Local Signature Generation:')
console.log('  String:', signatureString)
console.log('  MD5:', localSignature)
console.log('')

// Test Edge Function
async function testEdgeFunctionSignature() {
  try {
    console.log('📤 Testing Edge Function with hardcoded signature...')
    
    const supabaseUrl = process.env.SUPABASE_URL || 'https://eypfeiqtvfxxiimhtycc.supabase.co'
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
    
    const response = await fetch(`${supabaseUrl}/functions/v1/duitku-payment-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({
        amount: paymentAmount,
        paymentMethod: 'VC',
        orderId: merchantOrderId,
        productDetails: 'Final Working Test',
        customerEmail: 'test@example.com',
        customerPhone: '081234567890'
      }),
    })
    
    const responseText = await response.text()
    
    console.log('📥 Edge Function Response:')
    console.log('  Status:', response.status, response.statusText)
    
    try {
      const responseJson = JSON.parse(responseText)
      console.log('  Provider Status:', responseJson.providerStatus)
      console.log('  Message:', responseJson.message)
      
      if (response.status === 200) {
        console.log('')
        console.log('🎉 SUCCESS! Edge Function works with hardcoded signature!')
        console.log('')
        console.log('✅ This proves:')
        console.log('  1. Base URL is correct (https://sandbox.duitku.com)')
        console.log('  2. Environment variables are loaded correctly')
        console.log('  3. Payload format is correct')
        console.log('  4. The only issue is MD5 implementation in Deno')
        console.log('')
        console.log('🔧 Next Steps:')
        console.log('  - Fix MD5 implementation to match Node.js behavior')
        console.log('  - Remove hardcoded signatures')
        console.log('  - Test with dynamic signatures')
      } else {
        console.log('  Provider Response:', responseJson.details?.providerResponse)
        console.log('')
        console.log('❌ Still failing even with hardcoded signature')
      }
    } catch (e) {
      console.log('  Raw Response:', responseText)
    }
    
  } catch (error) {
    console.error('❌ Network Error:', error.message)
  }
}

testEdgeFunctionSignature()
