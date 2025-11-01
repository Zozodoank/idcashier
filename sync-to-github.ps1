# Script to automatically sync changes to GitHub repository
# Repository: https://github.com/Zozodoank/idcashier.git
# Location: c:\xampp\htdocs\idcashier

Write-Host "Starting synchronization with GitHub repository..." -ForegroundColor Green

# Navigate to project directory
Set-Location "c:\xampp\htdocs\idcashier"

# Check current Git status
Write-Host "Checking Git status..." -ForegroundColor Yellow
git status

# Add all changes
Write-Host "Adding all changes..." -ForegroundColor Yellow
git add .

# Check if there are changes to commit
$changes = git status --porcelain
if ($changes) {
    # Commit changes with timestamp
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $commitMessage = "Auto-sync: Updates on $timestamp"
    Write-Host "Committing changes..." -ForegroundColor Yellow
    git commit -m "$commitMessage"
    
    # Push to remote repository
    Write-Host "Pushing changes to GitHub..." -ForegroundColor Yellow
    git push origin master
    
    Write-Host "Synchronization completed successfully!" -ForegroundColor Green
} else {
    Write-Host "No changes detected. Repository is up to date." -ForegroundColor Blue
}

# Pause to see the output
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")