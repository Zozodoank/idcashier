# PowerShell script to add @ts-ignore comments to all Edge Functions

$functionsDir = ".\supabase\functions"
$fixedCount = 0
$totalCount = 0

# Get all index.ts files
$indexFiles = Get-ChildItem -Path $functionsDir -Filter "index.ts" -Recurse | Where-Object { $_.DirectoryName -notmatch '_shared' }

Write-Host "Found $($indexFiles.Count) Edge Functions to check..." -ForegroundColor Cyan
Write-Host ""

foreach ($file in $indexFiles) {
    $totalCount++
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    
    # Fix Deno.serve without @ts-ignore
    if ($content -match 'Deno\.serve\(async \(req\)' -and $content -notmatch '@ts-ignore: Deno is available in Supabase Edge Functions runtime') {
        $content = $content -replace '(Deno\.serve\(async \(req\))', "// @ts-ignore: Deno is available in Supabase Edge Functions runtime`r`n`$1"
        $modified = $true
    }
    
    # Fix Deno.env.get without @ts-ignore on previous line
    $lines = $content -split "`r?`n"
    $newLines = @()
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        $prevLine = if ($i -gt 0) { $lines[$i - 1] } else { "" }
        
        # Check if line contains Deno.env.get and previous line doesn't have @ts-ignore
        if ($line -match 'Deno\.env\.get' -and $prevLine -notmatch '@ts-ignore') {
            # Get indentation
            if ($line -match '^(\s*)') {
                $indent = $matches[1]
            } else {
                $indent = ""
            }
            
            # Add @ts-ignore comment before the line
            $newLines += "$indent// @ts-ignore: Deno is available at runtime"
            $newLines += $line
            $modified = $true
        } else {
            $newLines += $line
        }
    }
    
    if ($modified) {
        $newContent = $newLines -join "`r`n"
        Set-Content -Path $file.FullName -Value $newContent -NoNewline
        $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "")
        Write-Host "Fixed: $relativePath" -ForegroundColor Green
        $fixedCount++
    }
}

Write-Host ""
Write-Host "Done! Fixed $fixedCount files out of $totalCount total Edge Functions" -ForegroundColor Green
