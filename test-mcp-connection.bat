@echo off
echo Testing MCP connection with updated configuration...

echo Running MCP remote client test...
npx -y mcp-remote "https://mcp.supabase.com/mcp?project_ref=eypfeiqtvfxxiimhtycc" SUPABASE_ACCESS_TOKEN=sbp_ea7ee6e719e0f9dbd27542171ac64501f76eddb8

echo.
echo Test completed. Check the output above for any errors.
pause