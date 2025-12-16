// Verification script for idCashier Supabase RLS status and policies
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

console.log('Verifying idCashier Supabase RLS status and policies...\n');

// ANSI color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Display environment variables for debugging
console.log('Environment variables check:');
console.log('- VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? `${colors.green}✓ Set${colors.reset}` : `${colors.red}✗ Not set${colors.reset}`);
console.log('- VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? `${colors.green}✓ Set${colors.reset}` : `${colors.red}✗ Not set${colors.reset}`);
console.log('- SERVICE_ROLE_KEY:', process.env.SERVICE_ROLE_KEY ? `${colors.green}✓ Set${colors.reset}` : `${colors.red}✗ Not set${colors.reset}`);

// Check if required environment variables are set
if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY || !process.env.SERVICE_ROLE_KEY) {
  console.log(`\n${colors.red}❌ Missing required environment variables${colors.reset}`);
  console.log('Please ensure VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and SERVICE_ROLE_KEY are set in your .env file');
  process.exit(1);
}

// Create Supabase clients
const supabaseAnon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const supabaseService = createClient(process.env.VITE_SUPABASE_URL, process.env.SERVICE_ROLE_KEY);

// List of tables to check
const tables = ['users', 'customers', 'categories', 'suppliers', 'products', 'sales', 'sale_items', 'subscriptions'];

// Function to query RLS status for all tables
async function checkRLSStatus() {
  console.log(`\n${colors.blue}=== RLS Status Check ===${colors.reset}`);
  try {
    const { data, error } = await supabaseService.rpc('execute_sql', {
      sql: `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('${tables.join("','")}') AND relkind = 'r'`
    });

    if (error) {
      console.log(`${colors.red}❌ Error querying RLS status: ${error.message}${colors.reset}`);
      return {};
    }

    const rlsStatus = {};
    data.forEach(row => {
      rlsStatus[row.relname] = row.relrowsecurity;
    });

    console.table(data.map(row => ({
      Table: row.relname,
      'RLS Enabled': row.relrowsecurity ? `${colors.yellow}Yes${colors.reset}` : `${colors.green}No${colors.reset}`
    })));

    return rlsStatus;
  } catch (err) {
    console.log(`${colors.red}❌ Error checking RLS status: ${err.message}${colors.reset}`);
    return {};
  }
}

// Function to query existing policies
async function checkPolicies() {
  console.log(`\n${colors.blue}=== Existing Policies Check ===${colors.reset}`);
  try {
    const { data, error } = await supabaseService.rpc('execute_sql', {
      sql: "SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public'"
    });

    if (error) {
      console.log(`${colors.red}❌ Error querying policies: ${error.message}${colors.reset}`);
      return {};
    }

    const policiesByTable = {};
    tables.forEach(table => {
      policiesByTable[table] = data.filter(policy => policy.tablename === table);
    });

    tables.forEach(table => {
      const policies = policiesByTable[table];
      if (policies.length > 0) {
        console.log(`\n${colors.green}Policies for ${table}:${colors.reset}`);
        console.table(policies.map(policy => ({
          'Policy Name': policy.policyname,
          Command: policy.cmd,
          Qualifier: policy.qual || 'N/A',
          'With Check': policy.with_check || 'N/A'
        })));
      } else {
        console.log(`\n${colors.yellow}No policies found for ${table}${colors.reset}`);
      }
    });

    return policiesByTable;
  } catch (err) {
    console.log(`${colors.red}❌ Error checking policies: ${err.message}${colors.reset}`);
    return {};
  }
}

// Function to test user queries with and without RLS
async function testUserQueries() {
  console.log(`\n${colors.blue}=== User Query Test ===${colors.reset}`);
  try {
    // Test with anon key (RLS applied)
    console.log('Testing query with anon key (RLS applied)...');
    const { data: anonData, error: anonError } = await supabaseAnon
      .from('users')
      .select('id, email, name')
      .limit(5);

    if (anonError) {
      console.log(`${colors.red}❌ Anon query failed: ${anonError.message}${colors.reset}`);
      console.log(`   Code: ${anonError.code}, Details: ${anonError.details}`);
    } else {
      console.log(`${colors.green}✅ Anon query successful: Retrieved ${anonData.length} users${colors.reset}`);
    }

    // Test with service role key (RLS bypassed)
    console.log('Testing query with service role key (RLS bypassed)...');
    const { data: serviceData, error: serviceError } = await supabaseService
      .from('users')
      .select('id, email, name')
      .limit(5);

    if (serviceError) {
      console.log(`${colors.red}❌ Service query failed: ${serviceError.message}${colors.reset}`);
    } else {
      console.log(`${colors.green}✅ Service query successful: Retrieved ${serviceData.length} users${colors.reset}`);
    }

    // Compare results
    if (anonError && !serviceError) {
      console.log(`${colors.yellow}⚠️  Discrepancy detected: Anon query fails but service query succeeds. Possible RLS issue.${colors.reset}`);
    } else if (!anonError && !serviceError) {
      if (anonData.length === serviceData.length) {
        console.log(`${colors.green}✅ No discrepancies: Both queries return same number of results.${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠️  Discrepancy detected: Anon query returns ${anonData.length} users, service query returns ${serviceData.length} users.${colors.reset}`);
      }
    } else if (anonError && serviceError) {
      console.log(`${colors.red}❌ Both queries failed. Check database connection and table existence.${colors.reset}`);
    }

    return {
      anonSuccess: !anonError,
      serviceSuccess: !serviceError,
      anonCount: anonData ? anonData.length : 0,
      serviceCount: serviceData ? serviceData.length : 0
    };
  } catch (err) {
    console.log(`${colors.red}❌ Error testing queries: ${err.message}${colors.reset}`);
    return {};
  }
}

// Function to generate recommendations
function generateRecommendations(rlsStatus, policies, queryTest) {
  console.log(`\n${colors.blue}=== Recommendations ===${colors.reset}`);
  const recommendations = [];

  tables.forEach(table => {
    const rlsEnabled = rlsStatus[table];
    const tablePolicies = policies[table] || [];

    if (rlsEnabled && tablePolicies.length === 0) {
      recommendations.push(`${colors.yellow}⚠️  ${table}: RLS enabled but no policies found. Add policies or disable RLS.${colors.reset}`);
    } else if (!rlsEnabled) {
      recommendations.push(`${colors.blue}ℹ️  ${table}: RLS disabled. Consider enabling RLS for better security.${colors.reset}`);
    } else if (rlsEnabled && tablePolicies.length > 0) {
      if (!queryTest.anonSuccess && queryTest.serviceSuccess) {
        recommendations.push(`${colors.red}❌ ${table}: Policies exist but anon query fails. Check policy conditions.${colors.reset}`);
      } else {
        recommendations.push(`${colors.green}✅ ${table}: RLS properly configured with policies.${colors.reset}`);
      }
    }
  });

  recommendations.forEach(rec => console.log(rec));

  return recommendations;
}

// Main execution
async function main() {
  const rlsStatus = await checkRLSStatus();
  const policies = await checkPolicies();
  const queryTest = await testUserQueries();
  const recommendations = generateRecommendations(rlsStatus, policies, queryTest);

  // Summary
  console.log(`\n${colors.blue}=== Summary ===${colors.reset}`);
  console.log(`${colors.green}RLS Status Check: Completed${colors.reset}`);
  console.log(`${colors.green}Policies Check: Completed${colors.reset}`);
  console.log(`${colors.green}Query Test: Completed${colors.reset}`);

  const issues = recommendations.filter(rec => rec.includes('❌') || rec.includes('⚠️')).length;
  if (issues > 0) {
    console.log(`${colors.yellow}⚠️  ${issues} potential issues found. Review recommendations above.${colors.reset}`);
    console.log(`${colors.blue}Action Items:${colors.reset}`);
    console.log('1. Run "npm run fix:rls" to apply recommended RLS policies');
    console.log('2. Check SUPABASE_RLS_VERIFICATION.md for detailed troubleshooting');
    console.log('3. Test login functionality after fixes');
  } else {
    console.log(`${colors.green}✅ No issues detected. RLS configuration appears correct.${colors.reset}`);
  }

  // Export to JSON
  const exportData = {
    timestamp: new Date().toISOString(),
    rlsStatus,
    policies,
    queryTest,
    recommendations: recommendations.map(rec => rec.replace(/\x1b\[[0-9;]*m/g, '')), // Remove ANSI codes
    summary: {
      issuesFound: issues,
      tablesChecked: tables.length
    }
  };

  fs.writeFileSync(join(__dirname, '../rls-status.json'), JSON.stringify(exportData, null, 2));
  console.log(`\n${colors.green}✅ Results exported to rls-status.json${colors.reset}`);
}

main().catch(err => {
  console.error(`${colors.red}❌ Script failed: ${err.message}${colors.reset}`);
  process.exit(1);
});