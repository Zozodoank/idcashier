import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// --- Configuration ---
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const requiredFunctions = ['auth-login', 'auth-register', 'auth-me'];

// --- ANSI Colors for Console Output ---
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

const log = (message, color = colors.reset) => console.log(`${color}${message}${colors.reset}`);
const logSuccess = (message) => log(`✅ ${message}`, colors.green);
const logError = (message) => log(`❌ ${message}`, colors.red);
const logWarning = (message) => log(`⚠️ ${message}`, colors.yellow);
const logInfo = (message) => log(`ℹ️ ${message}`, colors.cyan);

let checksPassed = 0;
let totalChecks = 0;

// --- Verification Checks ---

async function checkEnvVariables() {
  totalChecks++;
  logInfo('1. Verifying Environment Variables...');
  let allVarsPresent = true;
  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      logError(`Missing required environment variable: ${varName}`);
      allVarsPresent = false;
    }
  });

  if (allVarsPresent) {
    logSuccess('All required environment variables are present.');
    checksPassed++;
  } else {
    logError('Some environment variables are missing in your .env file or system environment.');
  }
}

async function checkSupabaseConnection() {
  totalChecks++;
  logInfo('2. Verifying Supabase Connection...');
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    logError('Supabase URL or Anon Key is not defined. Skipping connection test.');
    return;
  }

  try {
    createClient(supabaseUrl, supabaseAnonKey);
    logSuccess('Supabase client initialized successfully.');
    checksPassed++;
  } catch (error) {
    logError(`Failed to initialize Supabase client: ${error.message}`);
  }
}

async function checkEdgeFunctions() {
  totalChecks++;
  logInfo('3. Verifying Edge Functions Deployment...');
  
  // Use SUPABASE_PROJECT_REF if provided, otherwise parse from URL
  let projectRef = process.env.SUPABASE_PROJECT_REF;
  if (!projectRef && process.env.VITE_SUPABASE_URL) {
    projectRef = process.env.VITE_SUPABASE_URL.split('.')[0].replace('https://', '');
  }
  
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (!projectRef) {
    logError('Project reference is not defined. Cannot verify deployed functions.');
    return;
  }

  if (!accessToken) {
    logWarning('SUPABASE_ACCESS_TOKEN is not set. Cannot verify deployed functions via Management API. Please verify manually.');
    return;
  }

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/functions`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const deployedFunctions = await response.json();
    const deployedFunctionNames = deployedFunctions.map(fn => fn.slug);
    
    let allFunctionsDeployed = true;
    requiredFunctions.forEach(fnName => {
      if (!deployedFunctionNames.includes(fnName)) {
        logError(`Required Edge Function "${fnName}" is not deployed.`);
        allFunctionsDeployed = false;
      }
    });

    if (allFunctionsDeployed) {
      logSuccess('All required Edge Functions are deployed.');
      checksPassed++;
    }
  } catch (error) {
    logError(`Failed to verify Edge Functions: ${error.message}`);
    logWarning('Hint: Ensure SUPABASE_ACCESS_TOKEN is a valid personal access token from https://supabase.com/dashboard/account/tokens');
  }
}

async function testAuthLoginEndpoint() {
  totalChecks++;
  logInfo('4. Testing auth-login Endpoint...');
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/auth-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        email: 'test@example.com', // Use a non-existent user to test the function response
        password: 'password',
      }),
    });

    if (response.status === 401) {
      logSuccess('auth-login endpoint responded correctly (401 for invalid user). JWT verification is likely disabled as required.');
      checksPassed++;
    } else if (response.status === 403) {
      logError(`auth-login returned 403 Forbidden. This might mean JWT verification is still enabled. Deploy with --no-verify-jwt.`);
    } else {
      logWarning(`auth-login returned an unexpected status: ${response.status}. Please check the function logs.`);
    }
  } catch (error) {
    logError(`Failed to test auth-login endpoint: ${error.message}`);
  }
}


// --- Main Execution ---

async function runVerification() {
  log('--- Starting Deployment Verification ---', colors.cyan);

  await checkEnvVariables();
  await checkSupabaseConnection();
  await checkEdgeFunctions();
  await testAuthLoginEndpoint();

  log('\n--- Verification Summary ---', colors.cyan);
  if (checksPassed === totalChecks) {
    logSuccess(`All ${checksPassed}/${totalChecks} checks passed!`);
  } else {
    logError(`${checksPassed}/${totalChecks} checks passed.`);
    logWarning('Please review the errors above and consult the troubleshooting documentation.');
  }
  log('--------------------------', colors.cyan);
}

runVerification();