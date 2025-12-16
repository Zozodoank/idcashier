@echo off
echo Updating MCP configuration with the provided format...

(
echo {
echo   "mcpServers": {
echo     "supabase": {
echo       "type": "http",
echo       "url": "https://mcp.supabase.com/mcp?project_ref=${SUPABASE_PROJECT_REF}",
echo       "headers": {
echo         "Authorization": "Bearer ${SUPABASE_ACCESS_TOKEN}"
echo       }
echo     }
echo   }
echo }
) > "C:\Users\SEMOGA-AWET\AppData\Roaming\Qoder\SharedClientCache\mcp.json"

echo MCP configuration updated with the provided format!
echo Please set the environment variables SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN
echo SUPABASE_PROJECT_REF should be set to: eypfeiqtvfxxiimhtycc
echo SUPABASE_ACCESS_TOKEN should be set to: sbp_ea7ee6e719e0f9dbd27542171ac64501f76eddb8
pause