// Test to verify logo loading
async function testLogoLoading() {
  try {
    console.log('Testing logo loading...');
    
    // Test if logo exists
    const logoPath = '/logo.png';
    const response = await fetch(logoPath);
    
    if (response.ok) {
      console.log('Logo found at:', logoPath);
      console.log('Logo size:', response.headers.get('content-length'), 'bytes');
    } else {
      console.log('Logo not found at:', logoPath);
    }
    
    // Test localStorage settings
    const storeSettings = localStorage.getItem('idcashier_store_settings');
    if (storeSettings) {
      const settings = JSON.parse(storeSettings);
      console.log('Store settings found:', settings);
      if (settings.logo) {
        console.log('Logo path in settings:', settings.logo);
      }
    } else {
      console.log('No store settings found in localStorage');
    }
    
  } catch (error) {
    console.error('Error testing logo loading:', error);
  }
}

testLogoLoading();