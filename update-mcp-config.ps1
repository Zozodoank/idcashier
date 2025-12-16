# PowerShell script to update MCP configuration with Supabase authentication

# Define the path to the MCP configuration file
$mcpConfigPath = "C:\Users\SEMOGA-AWET\AppData\Roaming\Qoder\SharedClientCache\mcp.json"

# Read the existing configuration
$config = Get-Content -Path $mcpConfigPath | ConvertFrom-Json

# Add the environment variable with the service role key
$config.mcpServers.supabase | Add-Member -Name "env" -Value ([PSCustomObject]@{
    SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgzMTI4MSwiZXhwIjoyMDc2NDA3MjgxfQ.0uXbD3E5fF7bF3p0X7bF3p0X7bF3p0X7bF3p0X7bF3p0X"
}) -Force

# Convert back to JSON and save
$config | ConvertTo-Json -Depth 10 | Set-Content -Path $mcpConfigPath

Write-Host "MCP configuration updated successfully!" -ForegroundColor Green
Write-Host "Please restart Qoder IDE to apply the changes." -ForegroundColor Yellow