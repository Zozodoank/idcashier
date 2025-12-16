@echo off
echo Updating MCP configuration to fix timeout issue...

(
echo {
echo   "mcpServers": {
echo     "supabase": {
echo       "command": "npx",
echo       "args": [
echo         "-y",
echo         "mcp-remote",
echo         "https://mcp.supabase.com/mcp?project_ref=eypfeiqtvfxxiimhtycc"
echo       ],
echo       "env": {
echo         "SUPABASE_ACCESS_TOKEN": "sbp_ea7ee6e719e0f9dbd27542171ac64501f76eddb8"
echo       }
echo     }
echo   }
echo }
) > "C:\Users\SEMOGA-AWET\AppData\Roaming\Qoder\SharedClientCache\mcp.json"

echo MCP configuration updated to fix timeout issue!
echo Please restart Qoder IDE to apply the changes.
pause