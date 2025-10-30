# Advanced synchronization script with logging
# Repository: https://github.com/projectmandiri10-lang/idcashier.git
# Location: c:\xampp\htdocs\idcashier

# Create log directory if it doesn't exist
$logDir = "c:\xampp\htdocs\idcashier\logs"
if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir
}

# Log file with timestamp
$logFile = "$logDir\sync-log-$(Get-Date -Format 'yyyy-MM-dd').txt"

# Function to write log
function Write-Log {
    param([string]$message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] $message"
    Add-Content -Path $logFile -Value $logEntry
    Write-Host $logEntry
}

# Start logging
Write-Log "=== Starting GitHub synchronization ==="

try {
    # Navigate to project directory
    Set-Location "c:\xampp\htdocs\idcashier"
    Write-Log "Changed to project directory"

    # Pull latest changes first (to avoid conflicts)
    Write-Log "Pulling latest changes from remote repository"
    git pull origin master

    # Check current Git status
    Write-Log "Checking Git status"
    $statusOutput = git status --porcelain
    Write-Log "Status check completed"

    # Add all changes
    Write-Log "Adding all changes"
    git add .
    Write-Log "All changes added"

    # Check if there are changes to commit
    if ($statusOutput) {
        # Commit changes with timestamp
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $commitMessage = "Auto-sync: Updates on $timestamp"
        Write-Log "Committing changes with message: $commitMessage"
        git commit -m "$commitMessage"
        
        # Push to remote repository
        Write-Log "Pushing changes to GitHub"
        git push origin master
        
        Write-Log "Synchronization completed successfully with changes pushed!"
    } else {
        Write-Log "No changes detected. Repository is up to date."
    }
}
catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    Write-Error "Synchronization failed: $($_.Exception.Message)"
}

Write-Log "=== Synchronization process ended ==="