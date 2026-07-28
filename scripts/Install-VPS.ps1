#############################################################################
# Manage Your Money - Windows VPS Installation Script
# Developed by Ashish Baboo (ashishbaboo.com)
#
# This script sets up a production-ready React + Node.js environment
# on Windows Server with IIS, SSL, NSSM Service Manager
#############################################################################

param(
    [string]$Domain = "money.ashishbaboo.com",
    [string]$AppPort = 5173,
    [string]$AppPath = "C:\Apps\ManageYourMoney"
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
function Write-Status {
    param([string]$Message, [string]$Type = "Success")

    $colors = @{
        "Success" = "Green"
        "Error" = "Red"
        "Warning" = "Yellow"
        "Info" = "Cyan"
    }

    $symbol = @{
        "Success" = "✓"
        "Error" = "✗"
        "Warning" = "!"
        "Info" = "►"
    }

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $($symbol[$Type]) $Message" -ForegroundColor $colors[$Type]
}

function Write-Section {
    param([string]$Title)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

# Check if running as Administrator
function Check-Admin {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
    if (-not $isAdmin) {
        Write-Status "This script must be run as Administrator" "Error"
        exit 1
    }
}

# Install Chocolatey
function Install-Chocolatey {
    Write-Section "Installing Chocolatey Package Manager"

    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Status "Chocolatey already installed" "Warning"
        return
    }

    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

    Write-Status "Chocolatey installed successfully"
}

# Install Node.js
function Install-NodeJS {
    Write-Section "Installing Node.js and npm"

    if (Get-Command node -ErrorAction SilentlyContinue) {
        $version = node -v
        Write-Status "Node.js already installed: $version" "Warning"
        return
    }

    choco install nodejs -y

    # Verify installation
    $nodeVersion = node -v
    $npmVersion = npm -v

    Write-Status "Node.js $nodeVersion installed"
    Write-Status "npm $npmVersion installed"
}

# Install Git
function Install-Git {
    Write-Section "Installing Git"

    if (Get-Command git -ErrorAction SilentlyContinue) {
        $version = git --version
        Write-Status "Git already installed: $version" "Warning"
        return
    }

    choco install git -y
    Write-Status "Git installed successfully"
}

# Install NSSM (Non-Sucking Service Manager)
function Install-NSSM {
    Write-Section "Installing NSSM (Service Manager)"

    if (Get-Command nssm -ErrorAction SilentlyContinue) {
        Write-Status "NSSM already installed" "Warning"
        return
    }

    choco install nssm -y
    Write-Status "NSSM installed successfully"
}

# Clone Repository
function Clone-Repository {
    Write-Section "Cloning Repository"

    if (Test-Path $AppPath) {
        Write-Status "Repository already exists. Pulling latest changes..." "Warning"
        Push-Location $AppPath
        git pull origin main
        Pop-Location
    } else {
        New-Item -ItemType Directory -Path $AppPath -Force | Out-Null
        git clone https://github.com/AshishBaboo/ManageYourMoney.git $AppPath
        Write-Status "Repository cloned successfully"
    }
}

# Setup Environment
function Setup-Environment {
    Write-Section "Setting Up Environment Variables"

    $envFile = "$AppPath\.env.production"

    if (Test-Path $envFile) {
        Write-Status ".env.production already exists" "Warning"
        return
    }

    $envContent = @"
NODE_ENV=production
VITE_SUPABASE_URL=https://uctmoxfalxyczrttyqto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjdG1veGZhbHh5Y3pydHR5cXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTkwMDUsImV4cCI6MjEwMDgzNTAwNX0.TesC6oDwR4bndWvqD7aV9VyJzgq-4j_jbMRfT6moiOY
"@

    Set-Content -Path $envFile -Value $envContent
    Write-Status ".env.production created"
    Write-Status "Update .env.production with your Supabase credentials" "Warning"
}

# Install Dependencies
function Install-Dependencies {
    Write-Section "Installing Node Dependencies"

    Push-Location $AppPath
    npm ci --production
    Pop-Location

    Write-Status "Dependencies installed successfully"
}

# Build Application
function Build-Application {
    Write-Section "Building Application"

    Push-Location $AppPath
    npm run build
    Pop-Location

    Write-Status "Application built successfully"
}

# Setup Windows Service
function Setup-WindowsService {
    Write-Section "Setting Up Windows Service (NSSM)"

    $serviceName = "ManageYourMoney"

    # Check if service already exists
    if (Get-Service $serviceName -ErrorAction SilentlyContinue) {
        Write-Status "Service already exists. Stopping..." "Warning"
        Stop-Service $serviceName -Force
        nssm remove $serviceName confirm
    }

    # Create service
    $nodeExePath = "$(npm config get prefix)\node.exe"
    $appFile = "$AppPath\dist\index.html"

    nssm install $serviceName "$nodeExePath" "$AppPath\node_modules\.bin\vite preview --host 0.0.0.0 --port $AppPort"
    nssm set $serviceName AppDirectory $AppPath
    nssm set $serviceName AppEnvironmentExtra "NODE_ENV=production"
    nssm set $serviceName Type "interactive"
    nssm set $serviceName Start "SERVICE_AUTO_START"

    # Set log files
    $logPath = "$AppPath\logs"
    New-Item -ItemType Directory -Path $logPath -Force | Out-Null
    nssm set $serviceName AppStdout "$logPath\stdout.log"
    nssm set $serviceName AppStderr "$logPath\stderr.log"

    # Start service
    Start-Service $serviceName

    Write-Status "Windows Service '$serviceName' created and started"
}

# Configure Windows Firewall
function Configure-Firewall {
    Write-Section "Configuring Windows Firewall"

    $appPort = [int]$AppPort

    # Check if rule already exists
    $existingRule = Get-NetFirewallRule -DisplayName "Manage Your Money - Port $appPort" -ErrorAction SilentlyContinue

    if ($existingRule) {
        Write-Status "Firewall rule already exists" "Warning"
        return
    }

    # Create inbound rule for app port
    New-NetFirewallRule -DisplayName "Manage Your Money - Port $appPort" `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $appPort | Out-Null

    # Allow HTTP and HTTPS
    New-NetFirewallRule -DisplayName "Allow HTTP" `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort 80 -ErrorAction SilentlyContinue | Out-Null

    New-NetFirewallRule -DisplayName "Allow HTTPS" `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort 443 -ErrorAction SilentlyContinue | Out-Null

    Write-Status "Firewall configured (Ports: 80, 443, $appPort)"
}

# Setup IIS (Optional)
function Setup-IIS {
    Write-Section "Setting Up IIS Reverse Proxy (Optional)"

    # Enable IIS features
    $features = @(
        "IIS-WebServerRole",
        "IIS-WebServer",
        "IIS-ApplicationDevelopment",
        "IIS-Rewrite",
        "IIS-ASPNET45"
    )

    foreach ($feature in $features) {
        Write-Status "Enabling $feature..."
        Enable-WindowsOptionalFeature -Online -FeatureName $feature -NoRestart | Out-Null
    }

    Write-Status "IIS configured successfully"
    Write-Status "Install URL Rewrite Module from https://www.iis.net/downloads/microsoft/url-rewrite" "Warning"
}

# Setup Scheduled Task for Backup
function Setup-BackupTask {
    Write-Section "Setting Up Automated Backup"

    $backupScript = @"
`$source = "$AppPath"
`$destination = "C:\Backups\ManageYourMoney"
`$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
`$backupPath = "`$destination\backup_`$timestamp.zip"

if (-not (Test-Path `$destination)) {
    New-Item -ItemType Directory -Path `$destination -Force | Out-Null
}

Compress-Archive -Path `$source -DestinationPath `$backupPath -Force

# Keep only last 7 backups
`$backups = Get-ChildItem `$destination -Filter "backup_*.zip" | Sort-Object CreationTime -Descending
if (`$backups.Count -gt 7) {
    `$backups | Select-Object -Skip 7 | Remove-Item -Force
}

Write-Output "Backup completed: `$backupPath" | Out-File "C:\Logs\ManageYourMoney-Backup.log" -Append
"@

    $scriptPath = "$AppPath\scripts\Backup.ps1"
    Set-Content -Path $scriptPath -Value $backupScript -Force

    # Create scheduled task
    $taskName = "Manage Your Money - Daily Backup"

    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Write-Status "Backup task already exists" "Warning"
        return
    }

    $trigger = New-ScheduledTaskTrigger -Daily -At 2am
    $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File `"$scriptPath`""

    Register-ScheduledTask -TaskName $taskName -Trigger $trigger -Action $action -RunLevel Highest -Force | Out-Null

    Write-Status "Automated backup scheduled (Daily at 2:00 AM)"
}

# Health Check
function Health-Check {
    Write-Section "Performing Health Checks"

    # Check Node.js
    if (Get-Command node -ErrorAction SilentlyContinue) {
        Write-Status "Node.js: $(node -v)"
    } else {
        Write-Status "Node.js not found" "Error"
    }

    # Check npm
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        Write-Status "npm: $(npm -v)"
    } else {
        Write-Status "npm not found" "Error"
    }

    # Check service
    $service = Get-Service "ManageYourMoney" -ErrorAction SilentlyContinue
    if ($service) {
        $status = if ($service.Status -eq "Running") { "RUNNING" } else { "NOT RUNNING" }
        Write-Status "Service Status: $status" $(if ($service.Status -eq "Running") { "Success" } else { "Error" })
    }

    # Check app port
    $portCheck = Test-NetConnection -ComputerName localhost -Port $AppPort -WarningAction SilentlyContinue
    if ($portCheck.TcpTestSucceeded) {
        Write-Status "App listening on port $AppPort"
    } else {
        Write-Status "App not responding on port $AppPort" "Warning"
    }
}

# Print Summary
function Print-Summary {
    Write-Section "Installation Complete"

    Write-Host @"
╔═══════════════════════════════════════════════════════╗
║           Manage Your Money - Setup Summary           ║
╚═══════════════════════════════════════════════════════╝

App Directory:    $AppPath
App Port:         $AppPort
Service Name:     ManageYourMoney
Domain:           $Domain

IMPORTANT NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Update Supabase credentials:
   Edit: $AppPath\.env.production

2. Configure IIS (if using):
   a) Install URL Rewrite Module
   b) Create reverse proxy to localhost:$AppPort
   c) Bind domain: $Domain

3. Install SSL Certificate:
   - Use Let's Encrypt (certbot) or self-signed
   - Bind to IIS site (if using IIS)

4. Monitor Service:
   Get-Service ManageYourMoney
   Get-Content "$AppPath\logs\stdout.log" -Tail 20

USEFUL COMMANDS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# View service status
Get-Service ManageYourMoney

# Stop service
Stop-Service ManageYourMoney

# Start service
Start-Service ManageYourMoney

# Restart service
Restart-Service ManageYourMoney

# View logs
Get-Content "$AppPath\logs\stdout.log" -Tail 50 -Wait

# Deploy updates
& "$PSScriptRoot\Deploy.ps1"

# Monitor application
& "$PSScriptRoot\Monitor.ps1"

ACCESS YOUR APP:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Local:  http://localhost:$AppPort
Remote: https://$Domain

"@ -ForegroundColor Cyan
}

# Main execution
function Main {
    Write-Section "Manage Your Money - Windows VPS Setup"

    Check-Admin
    Install-Chocolatey
    Install-Git
    Install-NodeJS
    Install-NSSM
    Clone-Repository
    Setup-Environment
    Install-Dependencies
    Build-Application
    Configure-Firewall
    Setup-IIS
    Setup-WindowsService
    Setup-BackupTask
    Health-Check
    Print-Summary

    Write-Status "Setup completed successfully!" "Success"
}

# Execute main function
Main
