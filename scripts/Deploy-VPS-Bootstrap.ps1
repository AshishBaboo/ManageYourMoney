# =============================================================================
# MANAGE YOUR MONEY - VPS BOOTSTRAP (ONE-TIME, IDEMPOTENT)
#
# Run ON THE NEW VPS in an ELEVATED PowerShell:
#   powershell -ExecutionPolicy Bypass -File tools\deploy\Deploy-VPS-Bootstrap.ps1 `
#       -Domain money.example.com -GitHubPat <your-pat>
#
# Installs git, Node.js, nginx, NSSM, win-acme if missing.
# Sets up app, services, nginx reverse proxy, SSL certificate.
#
# Phases:
#   1  preflight + DNS verification        6  windows services (NSSM)
#   2  toolchain install (git, node, nssm) 7  nginx HTTP + ACME webroot
#   3  firewall (80/443)                   8  Let's Encrypt certificate
#   4  clone repo                          9  nginx HTTPS
#   5  .env + build                       10  auto-deploy scheduled task
#
# Safe to re-run: every phase skips work that is already done.
# =============================================================================

[CmdletBinding()]
param(
    [string] $Domain          = 'money.example.com',
    [string] $RepoUrl         = 'https://github.com/AshishBaboo/ManageYourMoney.git',
    [string] $InstallRoot     = '',
    [string] $AcmeEmail       = 'ashishbaboo007@gmail.com',
    [int]    $AppPort         = 5173,
    [string] $GitHubPat       = '',
    [string] $EnvFile         = '',
    [switch] $SkipCert,
    [switch] $SkipDnsCheck
)

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

# ---- Layout -----------------------------------------------------------------
if (-not $InstallRoot) {
    $desktop = [Environment]::GetFolderPath('Desktop')
    if (-not $desktop) { $desktop = Join-Path $env:USERPROFILE 'Desktop' }
    $InstallRoot = Join-Path $desktop 'Projects\manage-your-money'
}
$ToolsDir   = 'C:\tools'
$NginxDir   = Join-Path $ToolsDir 'nginx'
$NssmExe    = Join-Path $ToolsDir 'nssm\nssm.exe'
$WacsDir    = Join-Path $ToolsDir 'win-acme'
$PemDir     = Join-Path $ToolsDir 'certs'
$WebRoot    = Join-Path $NginxDir 'acme-webroot'
$Repo       = $InstallRoot
$LogDir     = Join-Path $Repo 'logs'
$SvcApp     = 'ManageYourMoney'
$TaskName   = 'ManageYourMoney-AutoDeploy'
$NginxConf  = Join-Path $NginxDir 'conf\manage-your-money.conf'
$CertChain  = Join-Path $PemDir ($Domain + '-chain.pem')
$CertKey    = Join-Path $PemDir ($Domain + '-key.pem')

# ---- Pinned versions --------------------------------------------------------
$NginxUrl   = 'http://nginx.org/download/nginx-1.26.2.zip'
$NssmUrl    = 'https://nssm.cc/release/nssm-2.24.zip'
$WacsUrl    = 'https://github.com/win-acme/win-acme/releases/download/v2.2.9.1701/win-acme.v2.2.9.1701.x64.trimmed.zip'
$NodeUrl    = 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi'
$GitUrl     = 'https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/Git-2.47.1-64-bit.exe'

function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  OK   $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  WARN $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "  FAIL $m" -ForegroundColor Red; exit 1 }

function Get-Installer([string]$Url, [string]$OutFile) {
    if (Test-Path $OutFile) { return $OutFile }
    Write-Host "       downloading $(Split-Path $Url -Leaf) ..."
    try { Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -TimeoutSec 600 }
    catch { Fail "download failed: $Url`n       $($_.Exception.Message)" }
    return $OutFile
}

# =============================================================================
Step '1  Preflight'
# =============================================================================
$me = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $me.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Fail 'must run in an ELEVATED PowerShell (right-click -> Run as Administrator)'
}
Ok 'running elevated'

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
foreach ($d in @($ToolsDir, $PemDir, (Join-Path $ToolsDir 'dl'))) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
}
$Dl = Join-Path $ToolsDir 'dl'
Ok "install root: $Repo"

# Check port availability
$inUse = Get-NetTCPConnection -LocalPort $AppPort -State Listen -ErrorAction SilentlyContinue
if ($inUse) {
    $svc = Get-Service $SvcApp -ErrorAction SilentlyContinue
    if (-not ($svc -and $svc.Status -eq 'Running')) {
        $owner = (Get-Process -Id ($inUse | Select-Object -First 1).OwningProcess -ErrorAction SilentlyContinue).ProcessName
        Fail "port $AppPort is in use by '$owner'. Re-run with -AppPort set to a free port."
    }
    Ok "port $AppPort in use by our own service - it will be restarted"
}

# DNS check
if (-not $SkipDnsCheck) {
    try {
        $myIp = (Invoke-RestMethod -Uri 'https://api.ipify.org' -TimeoutSec 20).Trim()
        Ok "this box is $myIp"
        try {
            $ip = (Resolve-DnsName $Domain -Type A -ErrorAction Stop | Where-Object { $_.IPAddress } | Select-Object -First 1).IPAddress
            if ($ip -eq $myIp) { Ok "$Domain -> $ip" }
            else { Warn "$Domain -> $ip but this box is $myIp"; if (-not $SkipCert) { Fail 'DNS does not point to this box' } }
        } catch { Warn "$Domain does not resolve yet" }
    } catch { Warn 'could not determine public IP - skipping DNS check' }
}

# =============================================================================
Step '2  Toolchain'
# =============================================================================
function Resolve-Exe([string]$Name, [string[]]$Candidates) {
    foreach ($p in $Candidates) { if ($p -and (Test-Path $p)) { return $p } }
    $c = Get-Command $Name -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    return $null
}

# --- Git ---
$GitExe = Resolve-Exe 'git.exe' @('C:\Program Files\Git\cmd\git.exe', 'C:\Program Files (x86)\Git\cmd\git.exe')
if (-not $GitExe) {
    $f = Get-Installer $GitUrl (Join-Path $Dl 'git-installer.exe')
    Start-Process -FilePath $f -ArgumentList '/VERYSILENT','/NORESTART','/NOCANCEL','/SP-' -Wait
    $GitExe = Resolve-Exe 'git.exe' @('C:\Program Files\Git\cmd\git.exe')
    if (-not $GitExe) { Fail 'git install failed' }
}
Ok "git: $GitExe"

# --- Node ---
$NodeExe = Resolve-Exe 'node.exe' @('C:\Program Files\nodejs\node.exe', 'C:\Program Files (x86)\nodejs\node.exe')
if (-not $NodeExe) {
    $f = Get-Installer $NodeUrl (Join-Path $Dl 'node.msi')
    Start-Process -FilePath 'msiexec.exe' -ArgumentList "/i `"$f`" /qn /norestart" -Wait
    $NodeExe = Resolve-Exe 'node.exe' @('C:\Program Files\nodejs\node.exe')
    if (-not $NodeExe) { Fail 'node install failed' }
}
$NodeDir = Split-Path $NodeExe
$NpmCmd  = Join-Path $NodeDir 'npm.cmd'
if (-not (Test-Path $NpmCmd)) { Fail "npm.cmd not found" }
Ok ("node: $NodeExe (" + (& $NodeExe --version 2>$null) + ")")

# --- nginx ---
$nginxProc = Get-Process nginx -ErrorAction SilentlyContinue | Select-Object -First 1
$NginxExe = $null
if ($nginxProc -and $nginxProc.Path) { $NginxExe = $nginxProc.Path }
if (-not $NginxExe) {
    $NginxExe = Resolve-Exe 'nginx.exe' @((Join-Path $NginxDir 'nginx.exe'), 'C:\nginx\nginx.exe')
}
if (-not $NginxExe) {
    $f = Get-Installer $NginxUrl (Join-Path $Dl 'nginx.zip')
    $tmp = Join-Path $Dl 'nginx-x'
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Expand-Archive -Path $f -DestinationPath $tmp -Force
    $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
    if (-not (Test-Path $NginxDir)) { New-Item -ItemType Directory -Force -Path $NginxDir | Out-Null }
    Copy-Item (Join-Path $inner.FullName '*') $NginxDir -Recurse -Force
    $NginxExe = Join-Path $NginxDir 'nginx.exe'
    if (-not (Test-Path $NginxExe)) { Fail 'nginx extract failed' }
}
$NginxDir = Split-Path $NginxExe
$WebRoot  = Join-Path $NginxDir 'acme-webroot'
Ok "nginx: $NginxExe"

# --- NSSM ---
$NssmExe = Resolve-Exe 'nssm.exe' @('C:\tools\nssm\nssm.exe', 'C:\nssm\nssm.exe')
if (-not $NssmExe) {
    $f = Get-Installer $NssmUrl (Join-Path $Dl 'nssm.zip')
    $tmp = Join-Path $Dl 'nssm-x'
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Expand-Archive -Path $f -DestinationPath $tmp -Force
    $src = Get-ChildItem $tmp -Recurse -Filter nssm.exe | Where-Object { $_.FullName -match 'win64' } | Select-Object -First 1
    if (-not $src) { Fail 'nssm.exe (win64) not found' }
    $NssmExe = 'C:\tools\nssm\nssm.exe'
    New-Item -ItemType Directory -Force -Path (Split-Path $NssmExe) | Out-Null
    Copy-Item $src.FullName $NssmExe -Force
}
Ok "nssm: $NssmExe"

# --- win-acme ---
$Wacs = $null
foreach ($d in @($WacsDir, 'C:\ProgramData\win-acme', 'C:\tools\wacs')) {
    if (Test-Path $d) {
        $hit = Get-ChildItem $d -Filter wacs.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($hit) { $Wacs = $hit; break }
    }
}
if (-not $Wacs -and -not $SkipCert) {
    $f = Get-Installer $WacsUrl (Join-Path $Dl 'win-acme.zip')
    if (-not (Test-Path $WacsDir)) { New-Item -ItemType Directory -Force -Path $WacsDir | Out-Null }
    Expand-Archive -Path $f -DestinationPath $WacsDir -Force
    $Wacs = Get-ChildItem $WacsDir -Filter wacs.exe -Recurse | Select-Object -First 1
}
if ($Wacs) { Ok "win-acme: $($Wacs.FullName)" } else { Warn 'win-acme not found (cert step will be skipped)' }

# =============================================================================
Step '3  Firewall'
# =============================================================================
foreach ($port in @(80, 443)) {
    $rule = "Manage Your Money HTTP $port"
    if (-not (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Any | Out-Null
    }
    Ok "inbound TCP $port allowed"
}

# =============================================================================
Step '4  Repository'
# =============================================================================
$env:GIT_TERMINAL_PROMPT = '0'

if (-not (Test-Path (Join-Path $Repo '.git'))) {
    if ($GitHubPat) {
        $pat = $GitHubPat.Trim()
        Ok 'using PAT supplied'
    } else {
        $pat = (Read-Host 'GitHub Personal Access Token').Trim()
    }
    if (-not $pat) { Fail 'a PAT is required' }
    $authUrl = $RepoUrl -replace '^https://', "https://$pat@"
    & $GitExe clone $authUrl $Repo
    if ($LASTEXITCODE -ne 0) { Fail 'git clone failed' }
    Ok "cloned to $Repo"
} else {
    & $GitExe -C $Repo pull
    Ok 'existing checkout pulled'
}
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }

# =============================================================================
Step '5  Environment & Build'
# =============================================================================
$EnvPath = Join-Path $Repo '.env.production'
if (-not (Test-Path $EnvPath)) {
    if ($EnvFile -and (Test-Path $EnvFile)) {
        Copy-Item $EnvFile $EnvPath
        Ok ".env copied from $EnvFile"
    } else {
        $content = @"
NODE_ENV=production
VITE_SUPABASE_URL=https://uctmoxfalxyczrttyqto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjdG1veGZhbHh5Y3pydHR5cXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTkwMDUsImV4cCI6MjEwMDgzNTAwNX0.TesC6oDwR4bndWvqD7aV9VyJzgq-4j_jbMRfT6moiOY
"@
        [System.IO.File]::WriteAllText($EnvPath, $content, (New-Object System.Text.UTF8Encoding($false)))
        Ok ".env.production created - update with your Supabase keys"
    }
}

Push-Location $Repo
& $NpmCmd ci --production
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'npm install failed' }
& $NpmCmd run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'npm build failed' }
Pop-Location
Ok 'dependencies installed and app built'

# =============================================================================
Step '6  Windows Service'
# =============================================================================
if (-not (Get-Service $SvcApp -ErrorAction SilentlyContinue)) {
    & $NssmExe install $SvcApp (Join-Path $NodeDir 'node.exe') "$(Join-Path $NodeDir 'npx.cmd') vite preview --host 0.0.0.0 --port $AppPort"
    & $NssmExe set $SvcApp AppDirectory $Repo
    & $NssmExe set $SvcApp AppStdout (Join-Path $LogDir 'app.out.log')
    & $NssmExe set $SvcApp AppStderr (Join-Path $LogDir 'app.err.log')
    & $NssmExe set $SvcApp AppRotateFiles 1
    & $NssmExe set $SvcApp Start SERVICE_AUTO_START
    Ok "$SvcApp installed"
} else { Ok "$SvcApp already installed" }
& $NssmExe restart $SvcApp | Out-Null

Start-Sleep -Seconds 5
try {
    Invoke-WebRequest "http://127.0.0.1:$AppPort" -UseBasicParsing -TimeoutSec 20 | Out-Null
    Ok "app answering on :$AppPort"
} catch { Warn "app not answering yet - see $LogDir\app.err.log" }

# =============================================================================
Step '7  nginx HTTP'
# =============================================================================
if (-not (Test-Path $WebRoot)) { New-Item -ItemType Directory -Force -Path $WebRoot | Out-Null }

$webRootFwd = $WebRoot.Replace('\', '/')
$ngConf = @(
    '# Manage Your Money (generated by bootstrap)',
    'server {',
    '    listen 80;',
    ('    server_name ' + $Domain + ';'),
    '    location /.well-known/acme-challenge/ {',
    ('        root ' + $webRootFwd + ';'),
    '    }',
    '    location / {',
    ('        proxy_pass http://127.0.0.1:' + $AppPort + ';'),
    '        proxy_http_version 1.1;',
    '        proxy_set_header Upgrade $http_upgrade;',
    '        proxy_set_header Connection "upgrade";',
    '        proxy_set_header Host $host;',
    '        proxy_set_header X-Real-IP $remote_addr;',
    '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '        proxy_set_header X-Forwarded-Proto $scheme;',
    '    }',
    '}'
)
[System.IO.File]::WriteAllText($NginxConf, (($ngConf -join "`r`n") + "`r`n"),
    (New-Object System.Text.UTF8Encoding($false)))

$NginxConfMain = Join-Path $NginxDir 'conf\nginx.conf'
$confText = [System.IO.File]::ReadAllText($NginxConfMain)
if ($confText -notmatch 'manage-your-money\.conf') {
    $idx = $confText.IndexOf('http {')
    if ($idx -lt 0) { Fail 'could not find http block in nginx.conf' }
    $insertAt = $confText.IndexOf("`n", $idx)
    $confText = $confText.Insert($insertAt + 1, "`r`n    include manage-your-money.conf;`r`n")
    [System.IO.File]::WriteAllText($NginxConfMain, $confText,
        (New-Object System.Text.UTF8Encoding($false)))
}

Push-Location $NginxDir
& .\nginx.exe -t 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'nginx -t failed' }
Pop-Location

if (Get-Service nginx -ErrorAction SilentlyContinue) {
    & $NssmExe restart nginx | Out-Null
} else {
    & $NssmExe install nginx $NginxExe
    & $NssmExe set nginx AppDirectory $NginxDir
    & $NssmExe set nginx Start SERVICE_AUTO_START
    & $NssmExe start nginx | Out-Null
}
Start-Sleep -Seconds 3
Ok 'nginx serving HTTP'

# =============================================================================
Step '8  Certificate'
# =============================================================================
if ($SkipCert) {
    Warn 'cert step skipped (-SkipCert)'
} elseif ((Test-Path $CertChain) -and (Test-Path $CertKey)) {
    Ok 'certificate already present'
} elseif ($Wacs) {
    & $Wacs.FullName --source manual --host $Domain --validation filesystem --webroot $WebRoot `
        --store pemfiles --pemfilespath $PemDir --accepttos --emailaddress $AcmeEmail
    if ((Test-Path $CertChain) -and (Test-Path $CertKey)) { Ok 'certificate issued' }
    else { Warn 'win-acme did not produce pem files' }
} else { Warn 'win-acme unavailable' }

# =============================================================================
Step '9  nginx HTTPS'
# =============================================================================
if ((Test-Path $CertChain) -and (Test-Path $CertKey)) {
    $pemFwd = $PemDir.Replace('\', '/')
    $ngConf = @(
        '# Manage Your Money HTTPS (generated by bootstrap)',
        'server {',
        '    listen 80;',
        ('    server_name ' + $Domain + ';'),
        '    return 301 https://$host$request_uri;',
        '}',
        '',
        'server {',
        '    listen 443 ssl http2;',
        ('    server_name ' + $Domain + ';'),
        ('    ssl_certificate     ' + $pemFwd + '/' + $Domain + '-chain.pem;'),
        ('    ssl_certificate_key ' + $pemFwd + '/' + $Domain + '-key.pem;'),
        '    ssl_protocols TLSv1.2 TLSv1.3;',
        '    ssl_ciphers HIGH:!aNULL:!MD5;',
        '    location / {',
        ('        proxy_pass http://127.0.0.1:' + $AppPort + ';'),
        '        proxy_http_version 1.1;',
        '        proxy_set_header Upgrade $http_upgrade;',
        '        proxy_set_header Connection "upgrade";',
        '        proxy_set_header Host $host;',
        '        proxy_set_header X-Real-IP $remote_addr;',
        '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
        '        proxy_set_header X-Forwarded-Proto $scheme;',
        '    }',
        '}'
    )
    [System.IO.File]::WriteAllText($NginxConf, (($ngConf -join "`r`n") + "`r`n"),
        (New-Object System.Text.UTF8Encoding($false)))

    Push-Location $NginxDir
    & .\nginx.exe -t 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        & $NssmExe restart nginx | Out-Null
        Ok 'nginx serving HTTPS'
    } else { Warn 'nginx HTTPS config failed' }
    Pop-Location

    schtasks /Create /F /TN 'ManageYourMoney-NginxCertReload' /SC WEEKLY /D SUN /ST 04:30 `
        /RU SYSTEM /RL HIGHEST /TR "`"$NssmExe`" restart nginx" | Out-Null
    Ok 'weekly nginx restart scheduled'
} else {
    Warn 'no certificate - staying on HTTP'
}

# =============================================================================
Step '10  Auto-deploy'
# =============================================================================
$autoDeploy = Join-Path $Repo 'scripts\Deploy-AutoDeploy.ps1'
if (Test-Path $autoDeploy) {
    $tr = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $autoDeploy + '" -Repo "' + $Repo + '"'
    schtasks /Create /F /TN $TaskName /SC MINUTE /MO 5 /RU SYSTEM /RL HIGHEST /TR $tr | Out-Null
    Ok "auto-deploy task registered (pulls every 5 min)"
} else { Warn "autodeploy script not found at $autoDeploy" }

# =============================================================================
Step 'Summary'
# =============================================================================
$scheme = if ((Test-Path $CertChain) -and -not $SkipCert) { 'https' } else { 'http' }
Write-Host ""
Write-Host "  App       : $scheme`://$Domain  (local :$AppPort)" -ForegroundColor Green
Write-Host "  Checkout  : $Repo" -ForegroundColor Green
Write-Host "  Service   : $SvcApp (NSSM)" -ForegroundColor Green
Write-Host "  Auto-deploy: every 5 min from origin/main" -ForegroundColor Green
Write-Host "  Logs      : $LogDir" -ForegroundColor Green
Write-Host ""

Ok 'BOOTSTRAP COMPLETE'
