import { useState } from 'react'
import { createPayment } from '../api/payments'

export function PayButton(){
  const [loading,setLoading]=useState(false); 
  const [err,setErr]=useState(null)
  
  const onClick=async()=>{ 
    setLoading(true); 
    setErr(null)
    try { 
      const { paymentUrl } = await createPayment({ amount: 10000, paymentMethod: 'VC' }); 
      window.location.assign(paymentUrl) 
    }
    catch(e){
      setErr(e.message||'Error') 
    } finally{ 
      setLoading(false) 
    } 
  }
  
  return (
    <div>
      <button onClick={onClick} disabled={loading}>
        {loading?'Processing...':'Pay Now'}
      </button>
      {err&&<pre style={{color:'red'}}>{err}</pre>}
    </div>
  )
}