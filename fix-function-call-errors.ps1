# PowerShell script to fix getUserIdFromToken call errors

$functionsDir = ".\supabase\functions"
$fixedCount = 0
$totalCount = 0

# Get all .ts files
$tsFiles = Get-ChildItem -Path $functionsDir -Filter "*.ts" -Recurse

Write-Host "Found $($tsFiles.Count) TypeScript files to check for getUserIdFromToken errors..." -ForegroundColor Cyan
Write-Host ""

foreach ($file in $tsFiles) {
    $totalCount++
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    
    # Fix getUserIdFromToken with extra supabase parameter
    # Pattern: getUserIdFromToken(token, supabase)
    if ($content -match 'getUserIdFromToken\(token, supabase\)') {
        $content = $content -replace 'getUserIdFromToken\(token, supabase\)', 'getUserIdFromToken(token)'
        $modified = $true
    }
    
    # Pattern: getUserEmailFromToken(token, supabase)
    if ($content -match 'getUserEmailFromToken\(token, supabase\)') {
        $content = $content -replace 'getUserEmailFromToken\(token, supabase\)', 'getUserEmailFromToken(token)'
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
