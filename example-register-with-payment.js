/**
 * Example script to demonstrate how to use the register-with-payment function
 */

// Example usage of the register-with-payment function
async function registerUserWithPayment() {
  const url = 'https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/register-with-payment';
  
  const requestData = {
    userData: {
      name: 'John Doe',
      email: 'johndoe@example.com',
      phone: '+6281234567890',
      password: 'securepassword123',
      role: 'owner'
    },
    paymentData: {
      paymentAmount: 50000, // IDR 50,000
      productDetails: 'IDCashier Registration Fee',
      merchantOrderId: 'REG-' + Date.now(),
      customerVaName: 'John Doe',
      customerEmail: 'johndoe@example.com',
      customerPhone: '+6281234567890',
      paymentMethod: 'VC' // Virtual Account
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Registration successful!');
      console.log('Payment URL:', result.paymentUrl);
      console.log('User ID:', result.userId);
      console.log('Payment ID:', result.paymentId);
      
      // In a real application, you would redirect the user to the payment URL
      // window.location.href = result.paymentUrl;
    } else {
      console.error('Registration failed:', result.error);
      if (result.details) {
        console.error('Validation errors:', result.details);
      }
    }
  } catch (error) {
    console.error('Error during registration:', error);
  }
}

// Call the function
registerUserWithPayment();