# Script untuk menjalankan npm run dev dengan bypass PowerShell Execution Policy
# Usage: .\run-dev.ps1

# Bypass execution policy untuk command ini saja
$ErrorActionPreference = "Stop"

try {
    # Cek apakah npm.cmd ada
    $npmPath = "$env:ProgramFiles\nodejs\npm.cmd"
    if (Test-Path $npmPath) {
        Write-Host "Running npm run dev from project directory..." -ForegroundColor Green
        & $npmPath run dev
    } else {
        # Coba cari npm di PATH
        $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
        if ($npmCmd) {
            Write-Host "Running npm run dev from project directory..." -ForegroundColor Green
            npm run dev
        } else {
            Write-Host "Error: npm not found. Please install Node.js." -ForegroundColor Red
            exit 1
        }
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

