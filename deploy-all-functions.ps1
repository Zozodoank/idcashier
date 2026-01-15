# Deploy All Edge Functions Script
# This script deploys all edge functions to Supabase

$ErrorActionPreference = "Continue"

# Color functions
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host $msg -ForegroundColor Red }

Write-Info "================================================================="
Write-Info "  Deploy All Edge Functions to Supabase"
Write-Info "================================================================="

# Get project root
$projectRoot = $PSScriptRoot
$functionsDir = Join-Path $projectRoot "supabase\functions"

# Check if functions directory exists
if (-not (Test-Path $functionsDir)) {
    Write-Err "Functions directory not found: $functionsDir"
    exit 1
}

# Get all function directories (exclude _shared and files)
$functionDirs = Get-ChildItem -Path $functionsDir -Directory | 
    Where-Object { $_.Name -ne "_shared" -and (Test-Path (Join-Path $_.FullName "index.ts")) }

Write-Info "Found $($functionDirs.Count) edge functions to deploy"
Write-Info ""

# Track deployment results
$successCount = 0
$failCount = 0
$failedFunctions = @()

# Deploy each function
foreach ($funcDir in $functionDirs) {
    $funcName = $funcDir.Name
    Write-Info "----------------------------------------------------------------"
    Write-Info "Deploying: $funcName"
    Write-Info "----------------------------------------------------------------"
    
    try {
        # Deploy using supabase CLI
        $output = npx supabase functions deploy $funcName --no-verify-jwt 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Successfully deployed: $funcName"
            $successCount++
        } else {
            Write-Err "Failed to deploy: $funcName"
            Write-Err "Output: $output"
            $failCount++
            $failedFunctions += $funcName
        }
    } catch {
        Write-Err "Exception deploying: $funcName"
        Write-Err "Error: $_"
        $failCount++
        $failedFunctions += $funcName
    }
    
    Write-Info ""
}

# Summary
Write-Info "================================================================="
Write-Info "  Deployment Summary"
Write-Info "================================================================="
Write-Success "Successfully deployed: $successCount functions"
if ($failCount -gt 0) {
    Write-Err "Failed to deploy: $failCount functions"
    Write-Err "Failed functions:"
    foreach ($func in $failedFunctions) {
        Write-Err "  - $func"
    }
} else {
    Write-Success "All functions deployed successfully!"
}
Write-Info "================================================================="
