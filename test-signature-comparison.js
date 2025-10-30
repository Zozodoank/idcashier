// Compare signature generation: Local vs Edge Function
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

console.log('🔍 Signature Comparison: Local vs Edge Function')
console.log('='.repeat(60))

// Test data
const merchantOrderId = 'TEST-COMPARISON-' + Date.now()
const paymentAmount = 10000

console.log('📋 Test Parameters:')
console.log('  Merchant Code:', DUITKU_MERCHANT_CODE)
console.log('  Order ID:', merchantOrderId)
console.log('  Amount:', paymentAmount)
console.log('  Merchant Key:', DUITKU_MERCHANT_KEY.substring(0, 10) + '...')
console.log('  Algorithm:', DUITKU_SIGNATURE_ALGO)
console.log('  SUPABASE_URL:', process.env.SUPABASE_URL)
console.log('  SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? process.env.SUPABASE_ANON_KEY.substring(0, 20) + '...' : 'NOT SET')
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
    console.log('📤 Testing Edge Function Signature...')
    
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
        productDetails: 'Signature Comparison Test',
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
      console.log('  Message:', responseJson.details?.providerResponse?.Message)
      
      if (responseJson.providerStatus === 401 && responseJson.details?.providerResponse?.Message === 'Wrong signature') {
        console.log('')
        console.log('❌ SIGNATURE MISMATCH DETECTED!')
        console.log('')
        console.log('🔍 Analysis:')
        console.log('  Local Signature:', localSignature)
        console.log('  Edge Function: ❌ Wrong signature')
        console.log('')
        console.log('💡 Possible Causes:')
        console.log('  1. MD5 implementation differs between Node.js and Deno')
        console.log('  2. Environment variables not loaded correctly in Edge Function')
        console.log('  3. Signature string format differs')
        console.log('  4. Character encoding issues')
      }
    } catch (e) {
      console.log('  Raw Response:', responseText.substring(0, 200) + '...')
    }
    
  } catch (error) {
    console.error('❌ Network Error:', error.message)
  }
}

testEdgeFunctionSignature()
