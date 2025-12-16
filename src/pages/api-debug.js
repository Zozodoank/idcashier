// Comprehensive API Key Debug Script
// This will help identify why requests are missing API keys

// Add request interceptor to track all API calls
if (typeof window !== 'undefined') {
  // Override fetch to log all requests
  const originalFetch = window.fetch;
  
  window.fetch = function(...args) {
    const [url, options = {}] = args;
    
    // Check if this is a Supabase request
    if (url.includes('eypfeiqtvfxxiimhtycc.supabase.co')) {
      const hasApiKey = options.headers && (
        options.headers.apikey || 
        options.headers['apikey'] ||
        (options.headers.Authorization && options.headers.Authorization.includes('Bearer'))
      );
      
      console.log('🔍 Supabase API Request:', {
        url,
        method: options.method || 'GET',
        hasApiKey: !!hasApiKey,
        headers: options.headers || {},
        hasAuthHeader: !!options.headers?.Authorization,
        authHeaderType: options.headers?.Authorization?.split(' ')[0] || 'NONE'
      });
      
      // Log stack trace for debugging
      if (!hasApiKey) {
        console.warn('❌ Missing API key in Supabase request!');
        console.trace('Request stack:');
      }
    }
    
    return originalFetch.apply(this, args);
  };
  
  // Monitor XHR requests as well
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    this._method = method;
    this._url = url;
    return originalXHROpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    if (this._url && this._url.includes('eypfeiqtvfxxiimhtycc.supabase.co')) {
      const hasApiKey = this.getRequestHeader && this.getRequestHeader('apikey');
      
      console.log('📡 XHR Supabase Request:', {
        url: this._url,
        method: this._method,
        hasApiKey: !!hasApiKey,
        body: body?.substring ? body.substring(0, 200) : body
      });
    }
    
    return originalXHRSend.apply(this, arguments);
  };
}

export default function setupApiDebugging() {
  console.log('🕵️ API Debugging Setup Complete');
  console.log('📝 All Supabase requests will be logged with API key status');
}