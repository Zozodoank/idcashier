@echo off
echo Updating MCP configuration with provided Supabase access token...

(
echo {
echo   "mcpServers": {
echo     "supabase": {
echo       "command": "npx",
echo       "args": [
echo         "-y",
echo         "mcp-remote",
echo         "https://mcp.supabase.com/mcp?project_ref=eypfeiqtvfxxiimhtycc^&features=docs%%2Caccount%%2Cdatabase%%2Cdebugging%%2Cdevelopment%%2Cfunctions%%2Cbranching%%2Cstorage"
echo       ],
echo       "env": {
echo         "SUPABASE_ACCESS_TOKEN": "sbp_ea7ee6e719e0f9dbd27542171ac64501f76eddb8"
echo       }
echo     }
echo   }
echo }
) > "C:\Users\SEMOGA-AWET\AppData\Roaming\Qoder\SharedClientCache\mcp.json"

echo MCP configuration updated successfully with the provided token!
echo Please restart Qoder IDE to apply the changes.
pause