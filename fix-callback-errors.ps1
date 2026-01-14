# PowerShell script to fix callback parameter type errors

$functionsDir = ".\supabase\functions"
$fixedCount = 0
$totalCount = 0

# Get all .ts files
$tsFiles = Get-ChildItem -Path $functionsDir -Filter "*.ts" -Recurse

Write-Host "Found $($tsFiles.Count) TypeScript files to check for callback parameter errors..." -ForegroundColor Cyan
Write-Host ""

foreach ($file in $tsFiles) {
    $totalCount++
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    
    # Fix common callback patterns without type annotations
    # Pattern: .find(u => ...)
    if ($content -match '\.find\(u =\u003e') {
        $content = $content -replace '\.find\(u =\u003e', '.find((u: any) =>'
        $modified = $true
    }
    
    # Pattern: .filter(u => ...)
    if ($content -match '\.filter\(u =\u003e') {
        $content = $content -replace '\.filter\(u =\u003e', '.filter((u: any) =>'
        $modified = $true
    }
    
    # Pattern: .map(u => ...)
    if ($content -match '\.map\(u =\u003e') {
        $content = $content -replace '\.map\(u =\u003e', '.map((u: any) =>'
        $modified = $true
    }
    
    # Pattern: .forEach(u => ...)
    if ($content -match '\.forEach\(u =\u003e') {
        $content = $content -replace '\.forEach\(u =\u003e', '.forEach((u: any) =>'
        $modified = $true
    }
    
    # Pattern: .find(item => ...)
    if ($content -match '\.find\(item =\u003e') {
        $content = $content -replace '\.find\(item =\u003e', '.find((item: any) =>'
        $modified = $true
    }
    
    # Pattern: .filter(item => ...)
    if ($content -match '\.filter\(item =\u003e') {
        $content = $content -replace '\.filter\(item =\u003e', '.filter((item: any) =>'
        $modified = $true
    }
    
    # Pattern: .map(item => ...)
    if ($content -match '\.map\(item =\u003e') {
        $content = $content -replace '\.map\(item =\u003e', '.map((item: any) =>'
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
