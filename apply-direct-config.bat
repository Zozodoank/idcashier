@echo off
echo Applying direct MCP configuration with embedded credentials...

copy /Y "c:\Users\SEMOGA-AWET\Documents\POS\idcashier\mcp-direct-config.json" "C:\Users\SEMOGA-AWET\AppData\Roaming\Qoder\SharedClientCache\mcp.json"

echo Direct MCP configuration applied successfully!
echo The configuration now contains the actual values instead of environment variable placeholders.
pause