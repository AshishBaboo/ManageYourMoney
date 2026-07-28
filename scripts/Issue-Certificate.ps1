# =============================================================================
# MANAGE YOUR MONEY - AUTOMATED SSL CERTIFICATE (Cloudflare DNS + Let's Encrypt)
#
# Run ON THE VPS in ELEVATED PowerShell:
#   $token = "your-cloudflare-api-token"
#   powershell -ExecutionPolicy Bypass -File "scripts\Issue-Certificate.ps1" -CloudflareToken $token
#
# Or with all parameters:
#   powershell -ExecutionPolicy Bypass -File "scripts\Issue-Certificate.ps1" `
#     -CloudflareToken "your-token" `
#     -Domain "manageyourmoney.ashishbaboo.com" `
#     -Email "your-email@example.com"
# =============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string] $CloudflareToken,

    [string] $Domain      = 'manageyourmoney.ashishbaboo.com',
    [string] $Email       = 'ashishbaboo007@gmail.com'
)

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

function Ok($m)   { Write-Host "  [OK] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [!] $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "  [X] $m" -ForegroundColor Red; exit 1 }

# Paths
$ToolsDir  = 'C:\tools'
$WacsDir   = Join-Path $ToolsDir 'win-acme'
$WacsExe   = Join-Path $WacsDir 'wacs.exe'
$PemDir    = Join-Path $ToolsDir 'certs'
$NginxDir  = Join-Path $ToolsDir 'nginx'
$NssmExe   = Join-Path $ToolsDir 'nssm\nssm.exe'

$CertChain = Join-Path $PemDir "$Domain-chain.pem"
$CertKey   = Join-Path $PemDir "$Domain-key.pem"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   AUTOMATED CERTIFICATE GENERATION" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Verify tools
if (-not (Test-Path $WacsExe)) {
    Fail "win-acme not found at $WacsExe"
}
Ok "win-acme found"

# Ensure directories exist
foreach ($dir in @($PemDir)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}
Ok "directories ready"

# Check if cert already exists
if ((Test-Path $CertChain) -and (Test-Path $CertKey)) {
    Ok "certificate already exists"
    Write-Host "  Domain:  $Domain"
    Write-Host "  Chain:   $CertChain"
    Write-Host "  Key:     $CertKey`n"

    # Still update nginx if needed
    Write-Host "`nConfiguring nginx for HTTPS..." -ForegroundColor Cyan
    $NginxConf = Join-Path $NginxDir "conf\manage-your-money.conf"
    $certChainFwd = $CertChain.Replace('\', '/')
    $certKeyFwd = $CertKey.Replace('\', '/')

    $nginxCfg = @"
# Manage Your Money HTTPS
server {
    listen 80;
    server_name $Domain;
    return 301 https://`$server_name`$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $Domain;

    ssl_certificate $certChainFwd;
    ssl_certificate_key $certKeyFwd;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://127.0.0.1:5173;
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

    Push-Location $NginxDir
    & .\nginx.exe -t 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Pop-Location
        & $NssmExe restart nginx | Out-Null
        Start-Sleep -Seconds 3
        Ok "nginx configured and restarted"
    } else {
        Pop-Location
        Warn "nginx config invalid"
    }

    Write-Host "`n✓ Already configured for HTTPS" -ForegroundColor Green
    Write-Host "  Visit: https://$Domain`n" -ForegroundColor Green
    exit 0
}

# Verify domain resolves
Write-Host "Step 1: Verifying domain..."
try {
    $ip = [System.Net.Dns]::GetHostAddresses($Domain)[0].IPAddressToString
    Ok "domain resolves to $ip"
} catch {
    Fail "domain '$Domain' does not resolve - check DNS configuration"
}

# Issue certificate with Cloudflare DNS validation
Write-Host "`nStep 2: Issuing certificate via Let's Encrypt (Cloudflare DNS validation)..."
Write-Host "  This may take 90-120 seconds..."

Push-Location $WacsDir

# Set environment variable for Cloudflare token
$env:WACS_CLOUDFLARE_APITOKEN = $CloudflareToken

# Run win-acme with Cloudflare DNS validation
Write-Host ""
& .\wacs.exe `
    --source manual `
    --host $Domain `
    --validation dns-cloudflare `
    --store pemfiles `
    --pemfilespath $PemDir `
    --accepttos `
    --emailaddress $Email `
    --quiet 2>&1 | Out-Null

$certIssued = $?

Pop-Location

# Wait for cert files to be written
Start-Sleep -Seconds 3

# Verify certificate was created
if ((Test-Path $CertChain) -and (Test-Path $CertKey)) {
    Ok "certificate issued successfully!"
    Write-Host "  Domain:  $Domain"
    Write-Host "  Chain:   $CertChain"
    Write-Host "  Key:     $CertKey"
} else {
    # Check what files were created
    if (Test-Path $PemDir) {
        Write-Host "`nFiles in $PemDir`:" -ForegroundColor Yellow
        ls $PemDir | Select-Object Name, LastWriteTime | Format-Table
    }
    Fail "certificate not created - check win-acme configuration"
}

# Configure nginx for HTTPS
Write-Host "`nStep 3: Configuring nginx..."

$NginxConf = Join-Path $NginxDir "conf\manage-your-money.conf"
$certChainFwd = $CertChain.Replace('\', '/')
$certKeyFwd = $CertKey.Replace('\', '/')

$nginxCfg = @"
# Manage Your Money HTTPS
server {
    listen 80;
    server_name $Domain;
    return 301 https://`$server_name`$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $Domain;

    ssl_certificate $certChainFwd;
    ssl_certificate_key $certKeyFwd;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://127.0.0.1:5173;
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
Ok "nginx HTTPS config written"

# Test nginx config
Push-Location $NginxDir
& .\nginx.exe -t 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Pop-Location
    Ok "nginx config valid"

    # Restart nginx
    & $NssmExe restart nginx | Out-Null
    Start-Sleep -Seconds 3
    Ok "nginx restarted with HTTPS"
} else {
    Pop-Location
    Fail "nginx config is invalid"
}

# Schedule weekly renewal
Write-Host "`nStep 4: Scheduling certificate renewal..."
$taskName = "ManageYourMoney-CertRenewal"
schtasks /Create /F /TN $taskName /SC WEEKLY /D SUN /ST 04:30 `
    /RU SYSTEM /RL HIGHEST /TR "`"$NssmExe`" restart nginx" 2>&1 | Out-Null
Ok "weekly nginx restart scheduled (Sunday 04:30 AM)"

# Summary
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "   SETUP COMPLETE!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "  Domain:   $Domain" -ForegroundColor Green
Write-Host "  Protocol: HTTPS (TLS 1.2/1.3)" -ForegroundColor Green
Write-Host "  Renewal:  Automatic (weekly check)" -ForegroundColor Green
Write-Host "`n  Visit: https://$Domain`n" -ForegroundColor Green

# Clear Cloudflare token from environment
$env:WACS_CLOUDFLARE_APITOKEN = ""

Write-Host "Certificate tokens cleared from memory." -ForegroundColor Gray
