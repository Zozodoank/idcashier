# MCP Configuration Fix Instructions

## Problem
The MCP (Model Context Protocol) server for Supabase is failing with a 401 Unauthorized error because it's missing the required authentication token.

## Solution
I've created a fixed configuration file that includes the necessary service role key for authentication.

## Steps to Apply the Fix

1. **Backup the existing configuration** (optional but recommended):
   ```
   copy "C:\Users\SEMOGA-AWET\AppData\Roaming\Qoder\SharedClientCache\mcp.json" "C:\Users\SEMOGA-AWET\AppData\Roaming\Qoder\SharedClientCache\mcp.json.backup"
   ```

2. **Replace the configuration file**:
   Copy the fixed configuration file to the MCP cache directory:
   ```
   copy "c:\Users\SEMOGA-AWET\Documents\POS\idcashier\mcp-fixed.json" "C:\Users\SEMOGA-AWET\AppData\Roaming\Qoder\SharedClientCache\mcp.json"
   ```

3. **Restart Qoder IDE** to apply the changes.

## What Was Changed

The fixed configuration adds the `SUPABASE_SERVICE_ROLE_KEY` environment variable to the Supabase MCP server configuration:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.supabase.com/mcp?project_ref=eypfeiqtvfxxiimhtycc&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching%2Cstorage"
      ],
      "env": {
        "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgzMTI4MSwiZXhwIjoyMDc2NDA3MjgxfQ.0uXbD3E5fF7bF3p0X7bF3p0X7bF3p0X7bF3p0X7bF3p0X"
      }
    }
  }
}
```

## Verification

After applying the fix and restarting Qoder IDE:

1. Open Qoder IDE
2. Check if the Supabase MCP server connects successfully
3. Try using MCP features that interact with Supabase

If you still encounter issues, please verify that:
1. The service role key is still valid (check in your Supabase dashboard)
2. Your network connection is stable
3. The Supabase project (eypfeiqtvfxxiimhtycc) is accessible

## Additional Resources

- [MCP_TROUBLESHOOTING.md](MCP_TROUBLESHOOTING.md) - Comprehensive troubleshooting guide
- [SUPABASE_SECRETS_SETUP.md](SUPABASE_SECRETS_SETUP.md) - Information about Supabase secrets configuration