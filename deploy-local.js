// Script untuk deploy manual ke Supabase Dashboard
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('📦 Preparing Edge Function for manual deployment...')

// Read the function file
const functionPath = join(__dirname, 'supabase', 'functions', 'duitku-payment-request', 'index.ts')
const functionCode = readFileSync(functionPath, 'utf8')

// Read deno.json
const denoJsonPath = join(__dirname, 'supabase', 'functions', 'duitku-payment-request', 'deno.json')
const denoJson = readFileSync(denoJsonPath, 'utf8')

console.log('✅ Files read successfully')
console.log('')
console.log('📋 Manual Deployment Instructions:')
console.log('')
console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard')
console.log('2. Select your project: eypfeiqtvfxxiimhtycc')
console.log('3. Go to Edge Functions → duitku-payment-request')
console.log('4. Click "Edit" or "Deploy"')
console.log('5. Replace the content with the code below:')
console.log('')
console.log('=' .repeat(80))
console.log('📄 index.ts content:')
console.log('=' .repeat(80))
console.log(functionCode)
console.log('=' .repeat(80))
console.log('')
console.log('📄 deno.json content (if needed):')
console.log('=' .repeat(80))
console.log(denoJson)
console.log('=' .repeat(80))
console.log('')
console.log('⚠️  IMPORTANT: Make sure secrets are set in Dashboard:')
console.log('   - DUITKU_BASE_URL = https://sandbox.duitku.com')
console.log('   - DUITKU_MERCHANT_CODE = DS25746')
console.log('   - DUITKU_MERCHANT_KEY = <your_actual_key>')
console.log('   - DUITKU_SIGNATURE_ALGO = md5')
console.log('')
console.log('🚀 After deployment, test with:')
console.log('   node test-duitku-payment.js')
