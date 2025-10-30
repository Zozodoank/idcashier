import { supabase } from '../lib/supabaseClient'

export async function createPayment({ amount, paymentMethod='VC', orderId }) {
  // Session optional: registration flow may be unauthenticated
  try { await supabase.auth.getSession() } catch {}

  const { data, error } = await supabase.functions.invoke('duitku-payment-request', {
    body: { amount, paymentMethod, orderId: orderId || `ORDER-${Date.now()}` },
  })

  if (error) {
    // Enhanced error logging for debugging
    console.group('❌ Payment Function Error')
    console.error('Error object:', error)
    console.error('Error message:', error.message)
    console.error('Error context:', error?.context)
    
    // Try to extract structured error from response
    try {
      const errorText = error.message || ''
      const jsonMatch = errorText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        console.error('Parsed error details:', parsed)
        if (parsed.details) {
          console.error('Provider response:', parsed.details.providerResponse)
          console.error('Payload preview:', parsed.details.payloadPreview)
        }
      }
    } catch (parseErr) {
      console.error('Could not parse error details:', parseErr)
    }
    console.groupEnd()

    // User-friendly error message
    const ctx = error?.context
    const msg = (ctx && ctx.message) || error.message || 'Payment request failed'
    const details = (ctx && (ctx.details || ctx.providerResponse || ctx.payloadPreview)) || undefined
    throw new Error(`${msg}${details ? ' | ' + JSON.stringify(details) : ''}`)
  }

  if (!data?.paymentUrl) {
    console.error('❌ No paymentUrl in response:', data)
    throw new Error('paymentUrl not returned')
  }
  
  console.log('✅ Payment created:', { orderId: data.merchantOrderId, url: data.paymentUrl })
  return data
}