// Global API monitoring script for debugging authentication and API key issues
// This script will catch all fetch requests and log detailed information

// Store original fetch
const originalFetch = window.fetch;

// Override fetch to monitor all requests
window.fetch = async function(url, options = {}) {
  const timestamp = new Date().toISOString();
  const method = (options.method || 'GET').toUpperCase();
  
  // Skip monitoring for non-API calls (like fonts, images, etc.)
  const isApiCall = url.includes('supabase.co') || url.includes('/rest/v1/') || url.includes('/functions/');
  
  if (isApiCall) {
    console.log('🔍 API MONITOR - Request:', {
      timestamp,
      url,
      method,
      hasHeaders: !!options.headers,
      headers: options.headers,
      body: options.body ? JSON.parse(options.body) : null,
      apiKeyPresent: options.headers?.apikey ? 'YES' : 'NO',
      authHeaderPresent: options.headers?.Authorization ? 'YES' : 'NO',
      userAgent: navigator.userAgent
    });
  }

  try {
    // Make the actual request
    const response = await originalFetch(url, options);
    
    if (isApiCall) {
      console.log('🔍 API MONITOR - Response:', {
        timestamp,
        url,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        apiKeyUsed: options.headers?.apikey ? 'YES' : 'NO',
        authUsed: options.headers?.Authorization ? 'YES' : 'NO'
      });
      
      // If there's an error, log more details
      if (!response.ok) {
        try {
          const errorText = await response.text();
          console.error('🔍 API MONITOR - Error Response:', {
            status: response.status,
            statusText: response.statusText,
            errorBody: errorText,
            url,
            requestHeaders: options.headers,
            timestamp
          });
        } catch (e) {
          console.error('🔍 API MONITOR - Failed to read error response:', e);
        }
      }
    }
    
    return response;
  } catch (error) {
    if (isApiCall) {
      console.error('🔍 API MONITOR - Network Error:', {
        timestamp,
        url,
        method,
        error: error.message,
        stack: error.stack,
        requestHeaders: options.headers
      });
    }
    throw error;
  }
};

// Store original XMLHttpRequest for additional monitoring
const originalXMLHttpRequest = window.XMLHttpRequest;

window.XMLHttpRequest = function() {
  const xhr = new originalXMLHttpRequest();
  const originalOpen = xhr.open;
  const originalSend = xhr.send;
  
  let requestData = null;
  let requestUrl = null;
  let requestMethod = null;
  
  xhr.open = function(method, url, ...args) {
    requestMethod = method;
    requestUrl = url;
    requestData = null;
    
    // Only monitor Supabase calls
    if (url.includes('supabase.co') || url.includes('/rest/v1/')) {
      console.log('🔍 XHR MONITOR - Opening:', {
        method,
        url,
        timestamp: new Date().toISOString()
      });
    }
    
    return originalOpen.apply(this, [method, url, ...args]);
  };
  
  xhr.send = function(data) {
    requestData = data;
    
    // Monitor Supabase calls
    if (requestUrl && (requestUrl.includes('supabase.co') || requestUrl.includes('/rest/v1/'))) {
      console.log('🔍 XHR MONITOR - Sending:', {
        method: requestMethod,
        url: requestUrl,
        data: data,
        timestamp: new Date().toISOString()
      });
    }
    
    // Add event listeners for response tracking
    xhr.addEventListener('load', function() {
      if (requestUrl && (requestUrl.includes('supabase.co') || requestUrl.includes('/rest/v1/'))) {
        console.log('🔍 XHR MONITOR - Response:', {
          method: requestMethod,
          url: requestUrl,
          status: xhr.status,
          statusText: xhr.statusText,
          response: xhr.responseText,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    xhr.addEventListener('error', function() {
      if (requestUrl && (requestUrl.includes('supabase.co') || requestUrl.includes('/rest/v1/'))) {
        console.error('🔍 XHR MONITOR - Error:', {
          method: requestMethod,
          url: requestUrl,
          status: xhr.status,
          error: 'Network error',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    return originalSend.apply(this, arguments);
  };
  
  return xhr;
};

// Environment variables checker
window.checkEnvironmentVars = function() {
  const vars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'SET' : 'MISSING',
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
    VITE_NODE_ENV: import.meta.env.VITE_NODE_ENV || 'NOT SET'
  };
  
  console.log('🔍 ENVIRONMENT VARS CHECK:', vars);
  
  if (vars.VITE_SUPABASE_URL === 'MISSING') {
    console.error('❌ VITE_SUPABASE_URL is missing!');
  }
  
  if (vars.VITE_SUPABASE_ANON_KEY === 'MISSING') {
    console.error('❌ VITE_SUPABASE_ANON_KEY is missing!');
  }
  
  return vars;
};

// Clear console and add welcome message
console.clear();
console.log('🚀 API MONITOR INITIALIZED');
console.log('💡 Use checkEnvironmentVars() to check environment variables');
console.log('💡 All Supabase API calls will be monitored automatically');
console.log('💡 Check browser console for detailed API request/response logs');
console.log('---');

// Run environment check
setTimeout(() => {
  window.checkEnvironmentVars();
}, 1000);

// Export monitoring functions for manual use
window.apiMonitor = {
  checkEnvironmentVars: window.checkEnvironmentVars,
  logSupabaseError: (error, context = '') => {
    console.error('🔍 SUPABASE ERROR:', {
      context,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });
  }
};