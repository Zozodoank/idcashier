// Simple test untuk melihat logs
import dotenv from 'dotenv'

dotenv.config()
dotenv.config({ path: '.env.duitku' })

console.log('🔍 Simple Debug Test')
console.log('='.repeat(40))

const merchantOrderId = 'TEST-DEBUG-' + Date.now()
const paymentAmount = 10000

console.log('📤 Testing Edge Function...')
console.log('  Order ID:', merchantOrderId)
console.log('  Amount:', paymentAmount)

async function testEdgeFunction() {
  try {
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
        productDetails: 'Simple Debug Test',
        customerEmail: 'test@example.com',
        customerPhone: '081234567890'
      }),
    })
    
    const responseText = await response.text()
    
    console.log('📥 Response:')
    console.log('  Status:', response.status, response.statusText)
    console.log('  Body:', responseText)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testEdgeFunction()
