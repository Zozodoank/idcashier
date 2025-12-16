@echo off
echo Starting MCP Server with Supabase configuration...

echo Setting environment variables...
set SUPABASE_PROJECT_REF=eypfeiqtvfxxiimhtycc
set SUPABASE_ACCESS_TOKEN=sbp_ea7ee6e719e0f9dbd27542171ac64501f76eddb8

echo Starting MCP server...
npx -y @modelcontextprotocol/server-http-transport@latest start --config "C:\Users\SEMOGA-AWET\AppData\Roaming\Qoder\SharedClientCache\mcp.json"

pause