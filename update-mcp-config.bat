@echo off
echo Updating MCP configuration with Supabase authentication...

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
echo         "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgzMTI4MSwiZXhwIjoyMDc2NDA3MjgxfQ.0uXbD3E5fF7bF3p0X7bF3p0X7bF3p0X7bF3p0X7bF3p0X"
echo       }
echo     }
echo   }
echo }
) > "C:\Users\SEMOGA-AWET\AppData\Roaming\Qoder\SharedClientCache\mcp.json"

echo MCP configuration updated successfully!
echo Please restart Qoder IDE to apply the changes.
pause