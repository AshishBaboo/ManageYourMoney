# =============================================================================
# MANAGE YOUR MONEY - DEPLOY NOW
#
# Run ON THE VPS in ELEVATED PowerShell:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\<user>\Desktop\Projects\manage-your-money\scripts\DEPLOY-NOW.ps1" `
#       -Domain money.example.com
#
# Assumes: git, Node.js (v20+), nginx, NSSM, win-acme all in C:\tools
# (exactly like Wolfson OS VPS pattern)
#
# Phases:
#   1  Preflight checks                4  Clone repository
#   2  Firewall (80/443)               5  .env.production
#   3  Ports check                     6  Build application
#                                      7  NSSM service
#                                      8  nginx config + proxy
#                                      9  Auto-deploy task
#
# Safe to re-run: idempotent, skips work already done.
# =============================================================================

param(
    [string] $Domain      = 'money.example.com',
    [string] $RepoUrl     = 'https://github.com/AshishBaboo/ManageYourMoney.git',
    [string] $InstallRoot = '',
    [int]    $AppPort     = 5173,
    [string] $GitHubPat   = ''
)

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  ✓ $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  ! $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "  ✗ $m" -ForegroundColor Red; exit 1 }

# Paths
if (-not $InstallRoot) {
    $desktop = [Environment]::GetFolderPath('Desktop')
    if (-not $desktop) { $desktop = Join-Path $env:USERPROFILE 'Desktop' }
    $InstallRoot = Join-Path $desktop 'Projects\manage-your-money'
}

$ToolsDir  = 'C:\tools'
$NginxDir  = Join-Path $ToolsDir 'nginx'
$NssmExe   = Join-Path $ToolsDir 'nssm\nssm.exe'
$WacsDir   = Join-Path $ToolsDir 'win-acme'
$PemDir    = Join-Path $ToolsDir 'certs'
$WebRoot   = Join-Path $NginxDir 'acme-webroot'
$Repo      = $InstallRoot
$LogDir    = Join-Path $Repo 'logs'
$SvcApp    = 'ManageYourMoney'
$NginxConf = Join-Path $NginxDir "conf\manage-your-money.conf"
$CertChain = Join-Path $PemDir "$Domain-chain.pem"
$CertKey   = Join-Path $PemDir "$Domain-key.pem"

Step "1  Preflight checks"

# Check admin
$me = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $me.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Fail 'must run ELEVATED (right-click PowerShell -> Run as Administrator)'
}
Ok 'running elevated'

# Ensure directories
foreach ($d in @($ToolsDir, $PemDir, $LogDir, $WebRoot)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
}
Ok "directories ready"

# Check tools exist
foreach ($tool in @(@('git', 'git.exe'), @('node', 'node.exe'), @('npm', 'npm.cmd'), @('NSSM', $NssmExe), @('nginx', (Join-Path $NginxDir 'nginx.exe')))) {
    $name = $tool[0]
    $path = $tool[1]

    if ($path -like '*\*') {
        $exists = Test-Path $path
    } else {
        $exists = Get-Command $path -ErrorAction SilentlyContinue
    }

    if (-not $exists) {
        Fail "$name not found at $path - install tools in C:\tools first"
    }
}
Ok "all tools present (git, node, npm, NSSM, nginx)"

Step "2  Firewall (ports 80, 443, $AppPort)"

foreach ($port in @(80, 443, $AppPort)) {
    $rule = "Manage Your Money TCP $port"
    $exists = Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue
    if (-not $exists) {
        New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Any | Out-Null
        Ok "opened port $port"
    } else {
        Ok "port $port already open"
    }
}

Step "3  Port availability check"

$inUse = Get-NetTCPConnection -LocalPort $AppPort -State Listen -ErrorAction SilentlyContinue
if ($inUse) {
    $owner = (Get-Process -Id $inUse.OwningProcess -ErrorAction SilentlyContinue).ProcessName
    if ($owner -ne $SvcApp) {
        Fail "port $AppPort is in use by '$owner' (not $SvcApp). Choose a different -AppPort"
    }
    Ok "port $AppPort held by our service (will restart)"
} else {
    Ok "port $AppPort available"
}

Step "4  Repository"

$env:GIT_TERMINAL_PROMPT = '0'

if (-not (Test-Path (Join-Path $Repo '.git'))) {
    if ($GitHubPat) {
        $pat = $GitHubPat.Trim()
    } else {
        $pat = (Read-Host "GitHub PAT (press Enter to skip)").Trim()
    }

    if ($pat) {
        $authUrl = $RepoUrl -replace '^https://', "https://$pat@"
    } else {
        $authUrl = $RepoUrl
    }

    Write-Host "       cloning $RepoUrl ..."
    & git.exe clone $authUrl $Repo 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "clone failed" }
    Ok "repository cloned"
} else {
    Write-Host "       pulling latest ..."
    & git.exe -C $Repo pull 2>&1 | Out-Null
    Ok "repository updated"
}

Step "5  Environment (.env.production)"

$EnvPath = Join-Path $Repo '.env.production'
if (-not (Test-Path $EnvPath)) {
    $envContent = @"
NODE_ENV=production
VITE_SUPABASE_URL=https://uctmoxfalxyczrttyqto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjdG1veGZhbHh5Y3pydHR5cXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTkwMDUsImV4cCI6MjEwMDgzNTAwNX0.TesC6oDwR4bndWvqD7aV9VyJzgq-4j_jbMRfT6moiOY
"@
    [System.IO.File]::WriteAllText($EnvPath, $envContent, (New-Object System.Text.UTF8Encoding($false)))
    Warn ".env.production created - UPDATE with your Supabase keys"
} else {
    Ok ".env.production exists"
}

Step "6  Build application"

Push-Location $Repo

Write-Host "       npm ci ..."
& npm ci --production 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Fail "npm install failed"
}
Ok "dependencies installed"

Write-Host "       npm run build ..."
& npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Fail "build failed"
}
Ok "application built"

Pop-Location

Step "7  NSSM Windows Service"

$svc = Get-Service $SvcApp -ErrorAction SilentlyContinue
if (-not $svc) {
    $NodeExe = 'C:\Program Files\nodejs\node.exe'
    if (-not (Test-Path $NodeExe)) {
        $NodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
    }

    Write-Host "       installing service..."
    # Use vite preview for production
    & $NssmExe install $SvcApp $NodeExe "$(Join-Path (Split-Path $NodeExe) npx.cmd) vite preview --host 0.0.0.0 --port $AppPort" 2>&1 | Out-Null
    & $NssmExe set $SvcApp AppDirectory $Repo
    & $NssmExe set $SvcApp AppStdout (Join-Path $LogDir 'app.out.log')
    & $NssmExe set $SvcApp AppStderr (Join-Path $LogDir 'app.err.log')
    & $NssmExe set $SvcApp AppRotateFiles 1
    & $NssmExe set $SvcApp Start SERVICE_AUTO_START 2>&1 | Out-Null
    Ok "service installed"
} else {
    Ok "service already exists"
}

Write-Host "       starting service..."
& $NssmExe restart $SvcApp | Out-Null
Start-Sleep -Seconds 3

try {
    $response = Invoke-WebRequest "http://127.0.0.1:$AppPort" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    Ok "app responding on port $AppPort"
} catch {
    Warn "app not responding yet - check $(Join-Path $LogDir 'app.err.log')"
}

Step "8  nginx reverse proxy"

if (-not (Test-Path $WebRoot)) {
    New-Item -ItemType Directory -Force -Path $WebRoot | Out-Null
}

$webRootFwd = $WebRoot.Replace('\', '/')
$nginxCfg = @"
# Manage Your Money (auto-generated by DEPLOY-NOW.ps1)
server {
    listen 80;
    server_name $Domain;

    location /.well-known/acme-challenge/ {
        root $webRootFwd;
    }

    location / {
        proxy_pass http://127.0.0.1:$AppPort;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
    }
}
"@

[System.IO.File]::WriteAllText($NginxConf, $nginxCfg, (New-Object System.Text.UTF8Encoding($false)))
Ok "nginx config written"

# Add include to main nginx.conf if not there
$NginxConfMain = Join-Path $NginxDir 'conf\nginx.conf'
$confText = [System.IO.File]::ReadAllText($NginxConfMain)
if ($confText -notmatch 'manage-your-money\.conf') {
    $idx = $confText.IndexOf('http {')
    if ($idx -ge 0) {
        $insertAt = $confText.IndexOf("`n", $idx)
        $confText = $confText.Insert($insertAt + 1, "`r`n    include manage-your-money.conf;`r`n")
        [System.IO.File]::WriteAllText($NginxConfMain, $confText, (New-Object System.Text.UTF8Encoding($false)))
    }
    Ok "nginx.conf updated with include"
}

# Test config
Push-Location $NginxDir
& .\nginx.exe -t 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Fail "nginx config is invalid"
}
Pop-Location
Ok "nginx config valid"

# Start/restart nginx service
$nginxSvc = Get-Service nginx -ErrorAction SilentlyContinue
if ($nginxSvc) {
    & $NssmExe restart nginx | Out-Null
    Ok "nginx restarted"
} else {
    & $NssmExe install nginx (Join-Path $NginxDir 'nginx.exe')
    & $NssmExe set nginx AppDirectory $NginxDir
    & $NssmExe set nginx Start SERVICE_AUTO_START 2>&1 | Out-Null
    & $NssmExe start nginx | Out-Null
    Ok "nginx installed and started"
}

Start-Sleep -Seconds 2

Step "9  Auto-deploy task"

$autoDeploy = Join-Path $Repo 'scripts\Deploy-AutoDeploy.ps1'
if (Test-Path $autoDeploy) {
    $tr = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$autoDeploy`" -Repo `"$Repo`""
    schtasks /Create /F /TN ManageYourMoney-AutoDeploy /SC MINUTE /MO 5 /RU SYSTEM /RL HIGHEST /TR $tr 2>&1 | Out-Null
    Ok "auto-deploy scheduled (every 5 minutes)"
} else {
    Warn "Deploy-AutoDeploy.ps1 not found - auto-deploy not scheduled"
}

# Final summary
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         MANAGE YOUR MONEY - DEPLOYMENT COMPLETE            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "  Access:        http://$Domain (change to https:// after cert)"
Write-Host "  Service:       $SvcApp"
Write-Host "  Repository:    $Repo"
Write-Host "  App logs:      $(Join-Path $LogDir 'app.*.log')"
Write-Host "  Deploy logs:   $(Join-Path $LogDir 'autodeploy.log')"
Write-Host "  nginx config:  $NginxConf"
Write-Host "  Certs dir:     $PemDir`n"

Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "    1. Update Supabase keys in .env.production"
Write-Host "    2. Push code to main branch"
Write-Host "    3. Auto-deploy will run every 5 minutes`n"

Write-Host "  To view deploy log:"
Write-Host "    Get-Content `"$(Join-Path $LogDir 'autodeploy.log')`" -Tail 40 -Wait`n" -ForegroundColor Gray

Write-Host "  Clear PowerShell history:" -ForegroundColor Yellow
Write-Host "    Remove-Item (Get-PSReadlineOption).HistorySavePath`n" -ForegroundColor Gray
