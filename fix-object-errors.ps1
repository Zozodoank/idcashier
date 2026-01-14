# PowerShell script to fix empty object type errors

$functionsDir = ".\supabase\functions"
$fixedCount = 0
$totalCount = 0

# Get all .ts files
$tsFiles = Get-ChildItem -Path $functionsDir -Filter "*.ts" -Recurse

Write-Host "Found $($tsFiles.Count) TypeScript files to check for empty object errors..." -ForegroundColor Cyan
Write-Host ""

foreach ($file in $tsFiles) {
    $totalCount++
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    
    # Fix: const filteredData = {}
    if ($content -match 'const filteredData = \{\}') {
        $content = $content -replace 'const filteredData = \{\}', 'const filteredData: Record<string, any> = {}'
        $modified = $true
    }
    
    # Fix: const productSales = {} (if not already fixed)
    if ($content -match 'const productSales = \{\}' -and $content -notmatch 'const productSales: Record') {
        $content = $content -replace 'const productSales = \{\}', 'const productSales: Record<string, number> = {}'
        $modified = $true
    }
    
    # Fix: const data = {}
    if ($content -match 'const data = \{\}' -and $content -notmatch 'const data: Record') {
        $content = $content -replace 'const data = \{\}', 'const data: Record<string, any> = {}'
        $modified = $true
    }
    
    # Fix: let data = {}
    if ($content -match 'let data = \{\}' -and $content -notmatch 'let data: Record') {
        $content = $content -replace 'let data = \{\}', 'let data: Record<string, any> = {}'
        $modified = $true
    }
    
    if ($modified) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "")
        Write-Host "Fixed: $relativePath" -ForegroundColor Green
        $fixedCount++
    }
}

Write-Host ""
Write-Host "Done! Fixed $fixedCount files out of $totalCount total TypeScript files" -ForegroundColor Green
