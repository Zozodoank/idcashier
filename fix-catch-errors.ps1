# PowerShell script to fix catch block type errors

$functionsDir = ".\supabase\functions"
$fixedCount = 0
$totalCount = 0

# Get all index.ts files
$indexFiles = Get-ChildItem -Path $functionsDir -Filter "index.ts" -Recurse

Write-Host "Found $($indexFiles.Count) Edge Functions to check for catch block errors..." -ForegroundColor Cyan
Write-Host ""

foreach ($file in $indexFiles) {
    $totalCount++
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    
    # Fix catch (error) without type annotation
    # Pattern: } catch (error) {
    if ($content -match '\} catch \(error\) \{') {
        $content = $content -replace '\} catch \(error\) \{', '} catch (error: any) {'
        $modified = $true
    }
    
    # Pattern: } catch (fetchError) {
    if ($content -match '\} catch \(fetchError\) \{') {
        $content = $content -replace '\} catch \(fetchError\) \{', '} catch (fetchError: any) {'
        $modified = $true
    }
    
    # Pattern: } catch (err) {
    if ($content -match '\} catch \(err\) \{') {
        $content = $content -replace '\} catch \(err\) \{', '} catch (err: any) {'
        $modified = $true
    }
    
    # Pattern: } catch (e) {
    if ($content -match '\} catch \(e\) \{') {
        $content = $content -replace '\} catch \(e\) \{', '} catch (e: any) {'
        $modified = $true
    }
    
    # Pattern: } catch (parseError) {
    if ($content -match '\} catch \(parseError\) \{') {
        $content = $content -replace '\} catch \(parseError\) \{', '} catch (parseError: any) {'
        $modified = $true
    }
    
    # Pattern: } catch (operationError) {
    if ($content -match '\} catch \(operationError\) \{') {
        $content = $content -replace '\} catch \(operationError\) \{', '} catch (operationError: any) {'
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
Write-Host "Done! Fixed $fixedCount files out of $totalCount total Edge Functions" -ForegroundColor Green
