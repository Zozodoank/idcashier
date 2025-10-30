// Test script untuk signature generation
import { createHash } from 'crypto'

// Test MD5 signature
function md5hex(s) {
  return createHash('md5').update(s).digest('hex')
}

// Test SHA256 signature
function sha256hex(s) {
  return createHash('sha256').update(s).digest('hex')
}

// Test data
const merchantCode = 'DS25746'
const orderId = 'TEST-123'
const amount = 10000
const merchantKey = '318ee30197037540d3e145562ccdf491' // Key yang benar dari Duitku

console.log('🔐 Testing Signature Generation')
console.log('='.repeat(50))
console.log('Merchant Code:', merchantCode)
console.log('Order ID:', orderId)
console.log('Amount:', amount)
console.log('Merchant Key:', merchantKey ? '***' : 'MISSING')
console.log('')

// Build signature string
const signatureString = merchantCode + orderId + amount + merchantKey
console.log('Signature String:', signatureString)
console.log('')

// Generate signatures
const md5Signature = md5hex(signatureString)
const sha256Signature = sha256hex(signatureString).toLowerCase()

console.log('MD5 Signature:', md5Signature)
console.log('SHA256 Signature:', sha256Signature)
console.log('')

// Test with sample key
console.log('🧪 Testing with sample key:')
const sampleKey = 'SAMPLE_KEY_123'
const sampleSignatureString = merchantCode + orderId + amount + sampleKey
const sampleMd5 = md5hex(sampleSignatureString)

console.log('Sample Key:', sampleKey)
console.log('Sample String:', sampleSignatureString)
console.log('Sample MD5:', sampleMd5)
console.log('')

console.log('⚠️  To fix the issue:')
console.log('1. Get the actual merchant key from Duitku dashboard')
console.log('2. Update DUITKU_MERCHANT_KEY secret in Supabase')
console.log('3. Test again with: node test-duitku-payment.js')
