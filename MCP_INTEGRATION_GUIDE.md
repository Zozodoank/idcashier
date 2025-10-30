# MCP Integration Guide for idCashier

This guide explains how the idCashier application integrates with Supabase via the MCP (Model Context Protocol) server, enabling seamless development and deployment workflows directly from your IDE.

## Table of Contents

- [Introduction](#introduction)
- [What is MCP?](#what-is-mcp)
- [Setup MCP Connection](#setup-mcp-connection)
- [MCP Server Configuration](#mcp-server-configuration)
- [Testing MCP Integration](#testing-mcp-integration)
- [Common MCP Operations](#common-mcp-operations)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Introduction

The MCP (Model Context Protocol) server provides a standardized way for your IDE to communicate with Supabase services. This integration enables:

- Direct database access and schema management
- Edge Functions deployment and testing
- Real-time log monitoring
- Security and performance advisories

For idCashier, MCP is particularly useful for:
- Managing user authentication via Supabase Auth
- Deploying and testing auth Edge Functions
- Monitoring email sending via SMTP
- Debugging password reset flows
- Managing database schema changes

## What is MCP?

MCP (Model Context Protocol) is a protocol that allows AI-powered development tools to interact with external services and resources. For Supabase, this means:

- **Database Operations**: Execute SQL queries, create migrations, and manage schema
- **Edge Functions**: Deploy, test, and monitor serverless functions
- **Logs Access**: View real-time logs from various Supabase services
- **Advisory Checks**: Get security and performance recommendations
- **Resource Management**: Manage storage buckets, branches, and configurations

### Benefits for idCashier Development

1. **Faster Development**: Execute database queries and deploy functions directly from IDE
2. **Easier Debugging**: View logs for auth operations and email sending in real-time
3. **Better Security**: Get advisory notices about security vulnerabilities (e.g., missing RLS policies)
4. **Seamless Workflow**: No need to switch between IDE and Supabase Dashboard

## Setup MCP Connection

### Prerequisites

- Supabase account with active project
- Supabase credentials (Project URL, API Keys)
- IDE with MCP support (Cursor, VS Code with extensions, etc.)

### Verification Steps

1. **Check MCP Configuration in Your IDE:**
   - For Cursor: MCP is typically configured automatically
   - For VS Code: Install Supabase extension or MCP plugin
   - Check IDE settings for Supabase/MCP configuration

2. **Verify Supabase Credentials:**
   - Ensure `.env` file has correct Supabase credentials:
     ```env
     VITE_SUPABASE_URL=your_supabase_project_url
     VITE_SUPABASE_ANON_KEY=your_anon_key
     SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
     ```

3. **Test Connection:**
   - Try listing database tables via MCP tools
   - Check if you can access Supabase resources
   - Verify logs are accessible

## MCP Server Configuration

### Environment Variables for MCP

MCP uses the same environment variables as your application:

```env
# Supabase Configuration (required for MCP)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Email Configuration (used by Edge Functions)
EMAIL_PASSWORD=@Se06070786
SITE_URL=https://idcashier.my.id
```

### MCP Configuration for Supabase

If you need to manually configure MCP (depends on your IDE):

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ACCESS_TOKEN": "your_access_token"
      }
    }
  }
}
```

### Updating Configuration

If you change Supabase projects or credentials:

1. Update `.env` file with new credentials
2. Restart your IDE to reload MCP configuration
3. Verify connection with a simple query or operation
4. Clear any cached credentials if necessary

## Testing MCP Integration

### 1. Test Database Access

Try listing tables to verify database connection:

**Expected Output:**
- List of tables: users, customers, products, sales, etc.
- Table schemas and relationships
- No authentication errors

**If it fails:**
- Check Supabase credentials are correct
- Verify project URL is accessible
- Ensure service role key has proper permissions

### 2. Test Edge Functions Access

Try listing Edge Functions:

**Expected Functions:**
- auth-register
- auth-login
- auth-request-password-reset
- auth-reset-password
- products-get-all, products-create, etc.

**If functions are missing:**
- Deploy functions: `supabase functions deploy`
- Check function configuration in `supabase/config.toml`
- Verify functions directory structure

### 3. Test Log Access

Try accessing logs for a service (e.g., auth):

**Expected Logs:**
- Recent authentication attempts
- Email sending operations
- Password reset requests
- Function execution logs

**Note:** Logs only show entries from the last minute. If no recent activity, run a test operation first.

### 4. Test Advisory Checks

Run security and performance advisories:

**Expected Advisories:**
- Security notices (e.g., missing RLS policies, exposed tables)
- Performance recommendations (e.g., missing indexes)
- Configuration warnings

## Common MCP Operations

### 1. Database Operations

**List All Tables:**
- Use MCP tool to list tables in public schema
- Verify users, products, sales, etc. are present

**Execute SQL Queries:**
```sql
-- Check users table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users';

-- Verify no password column exists
SELECT * FROM users LIMIT 1;
```

**Apply Migrations:**
- Run migration to remove password column if it still exists
- Execute schema updates from `supabase-schema.sql`

### 2. Edge Functions Management

**List Edge Functions:**
- View all deployed Edge Functions
- Check function status and configuration

**Deploy Edge Functions:**
```bash
# Deploy a specific function
supabase functions deploy auth-register

# Deploy all functions
supabase functions deploy
```

**Get Function Code:**
- View source code of deployed functions
- Useful for verifying latest changes are deployed

### 3. Log Monitoring

**View Auth Logs:**
- Monitor authentication attempts
- Debug login failures
- Track password reset requests

**View API Logs:**
- Check Edge Function executions
- Monitor API response times
- Debug function errors

**View Postgres Logs:**
- Database query errors
- Connection issues
- Performance problems

### 4. Advisory Checks

**Security Advisories:**
- Check for tables without RLS policies
- Identify security vulnerabilities
- Get remediation recommendations

**Performance Advisories:**
- Find missing indexes
- Identify slow queries
- Optimize database performance

### 5. Storage Operations

**List Storage Buckets:**
- View configured storage buckets
- Check bucket permissions and settings

**Get Storage Configuration:**
- View file size limits
- Check enabled features (e.g., image transformation)

## Troubleshooting

### MCP Connection Timeout

**Symptoms:**
- MCP operations hang or timeout
- "Connection refused" errors
- Cannot access Supabase resources

**Solutions:**
1. Verify Supabase project is active and not paused
2. Check internet connection
3. Verify credentials are correct and not expired
4. Restart IDE to refresh MCP connection
5. Check Supabase service status (status.supabase.com)

### Authentication Errors

**Symptoms:**
- "Unauthorized" or "Forbidden" errors
- Cannot access certain resources
- Permission denied messages

**Solutions:**
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
2. Check API key permissions in Supabase Dashboard
3. Ensure you're using service role key, not anon key, for admin operations
4. Regenerate API keys if they may be compromised

### Edge Functions Not Callable via MCP

**Symptoms:**
- Functions not listed in MCP
- Cannot deploy or test functions
- Function code not accessible

**Solutions:**
1. Verify functions exist in `supabase/functions/` directory
2. Check function configuration in `supabase/config.toml`
3. Deploy functions manually: `supabase functions deploy`
4. Verify function names match between code and config
5. Check function logs for deployment errors

### Email Not Sending via MCP Tests

**Symptoms:**
- Password reset emails not received
- No logs showing email attempts
- SMTP errors in logs

**Solutions:**
1. Verify SMTP configuration in `supabase/config.toml`
2. Check `EMAIL_PASSWORD` is set in Supabase Secrets
3. Test SMTP credentials are valid
4. Check Supabase logs for SMTP errors
5. Verify port 465 is not blocked (try port 587 if needed)
6. For local dev, check Inbucket at http://localhost:54324

### Logs Not Showing Recent Activity

**Symptoms:**
- Empty log results
- "No logs found" message
- Missing expected log entries

**Important:** MCP `get_logs` only returns logs from the **last minute**. This is a limitation of the MCP server integration.

**Solutions:**
1. Run the operation you want to log (e.g., login, password reset)
2. **Immediately** after, fetch logs (within 60 seconds)
3. For historical logs, use Supabase Dashboard > Logs
4. For debugging, trigger the operation and quickly check logs

**Example Workflow:**
1. Request password reset via frontend
2. Within 60 seconds, use MCP to fetch auth logs
3. View email sending attempt and any errors

## Best Practices

### When to Use MCP vs Supabase Dashboard

**Use MCP when:**
- You want to stay in your IDE workflow
- Need quick access to logs during debugging
- Deploying or testing Edge Functions
- Running quick database queries
- Checking security advisories

**Use Supabase Dashboard when:**
- Need detailed log analysis (historical logs)
- Managing project settings and billing
- Creating new projects or branches
- Viewing detailed performance metrics
- Configuring auth providers and email templates

### Security Considerations

1. **Protect Your Service Role Key:**
   - Never commit to version control
   - Don't share in public channels
   - Rotate if potentially compromised

2. **Use Secrets for Sensitive Data:**
   - Store EMAIL_PASSWORD in Supabase Secrets, not in code
   - Use environment variables for all credentials
   - Never hardcode sensitive information

3. **Monitor Security Advisories:**
   - Regularly check for security notices via MCP
   - Act on RLS policy recommendations
   - Keep dependencies updated

### Performance Optimization

1. **Use MCP for Development, Not Production Monitoring:**
   - MCP is for dev/debugging workflows
   - Use Supabase Dashboard or monitoring tools for production
   - Set up proper logging and alerting for production

2. **Limit MCP Query Scope:**
   - Don't fetch all data via MCP queries
   - Use filters and limits in SQL queries
   - Optimize database access patterns

3. **Cache MCP Results When Appropriate:**
   - Don't repeatedly fetch static information
   - Cache schema information locally
   - Refresh only when schema changes

## Advanced Usage

### Using MCP in CI/CD Pipelines

MCP can be used in automated workflows:

```bash
# Example: Deploy Edge Functions via CI/CD
npx @supabase/mcp-server deploy-function auth-register

# Example: Run database migrations
npx @supabase/mcp-server apply-migration "add_new_column"
```

### Integrating with Development Workflow

1. **Pre-commit Checks:**
   - Run security advisories before committing
   - Verify RLS policies are in place
   - Check for missing indexes

2. **Deployment Verification:**
   - Deploy Edge Functions via MCP
   - Verify deployment with logs
   - Test functions immediately after deployment

3. **Debugging Workflow:**
   - Trigger operation in app
   - Immediately fetch logs via MCP
   - Analyze errors and fix
   - Redeploy and test

## Conclusion

MCP integration provides a powerful development experience for idCashier, enabling:
- Seamless database and Edge Function management
- Real-time debugging with logs
- Security and performance monitoring
- Faster development cycles

For more information:
- [Supabase MCP Documentation](https://supabase.com/docs)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [idCashier Setup Guide](SUPABASE_SETUP.md)
- [Deployment Checklist](DEPLOYMENT_CHECKLIST.md)

## Support

If you encounter issues with MCP integration:

1. Check this guide's troubleshooting section
2. Review Supabase documentation
3. Check Supabase status page
4. Verify your IDE's MCP plugin is up to date
5. Consult Supabase community forums

Remember: MCP is a development tool. For production monitoring and management, use Supabase Dashboard and proper monitoring solutions.

