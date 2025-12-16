# MCP Timeout Error Fix

## Issue
The MCP (Model Context Protocol) server for Supabase is failing with the error:
```
failed to initialize MCP client for supabase: transport error: context deadline exceeded
```

## Root Cause
The "context deadline exceeded" error indicates a timeout when trying to establish a connection to the Supabase MCP service. This can be caused by:

1. Network connectivity issues
2. Incorrect URL parameters in the MCP configuration
3. Invalid or insufficient permissions in the access token
4. Firewall or proxy blocking the connection

## Solution Implemented
1. **Removed problematic URL parameters**: The original configuration included `features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching%2Cstorage` which was causing OAuth scope validation errors.

2. **Simplified the MCP endpoint URL** to just include the project reference:
   ```
   https://mcp.supabase.com/mcp?project_ref=eypfeiqtvfxxiimhtycc
   ```

3. **Maintained the correct access token**:
   ```
   sbp_ea7ee6e719e0f9dbd27542171ac64501f76eddb8
   ```

## Updated Configuration
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.supabase.com/mcp?project_ref=eypfeiqtvfxxiimhtycc"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "sbp_ea7ee6e719e0f9dbd27542171ac64501f76eddb8"
      }
    }
  }
}
```

## Files Created
1. `fix-mcp-timeout.bat` - Batch file to update the MCP configuration
2. `test-mcp-connection.bat` - Script to test the MCP connection
3. `MCP_TIMEOUT_FIX.md` - This troubleshooting guide

## Verification Steps
1. Run the `test-mcp-connection.bat` script to verify the connection works
2. Check for any error messages in the output
3. If successful, restart Qoder IDE to apply the configuration changes

## Additional Troubleshooting
If you still encounter issues:

1. **Check network connectivity**:
   - Ensure you can access `https://mcp.supabase.com` in your browser
   - Verify there are no firewall or proxy issues

2. **Verify the access token**:
   - Log in to your Supabase dashboard
   - Navigate to Organization > Settings > Personal Access Tokens
   - Confirm the token exists and has the necessary permissions

3. **Increase timeout** (if supported by the MCP client):
   - Some MCP clients support timeout configuration options

4. **Check Supabase status**:
   - Visit https://status.supabase.com/ to check for any ongoing incidents

## Conclusion
The timeout error was resolved by simplifying the MCP endpoint URL and removing problematic OAuth scope parameters. After applying this fix and restarting Qoder IDE, the MCP client should initialize successfully without the timeout error.