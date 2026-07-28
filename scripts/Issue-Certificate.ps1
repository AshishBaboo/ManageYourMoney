# =============================================================================
# MANAGE YOUR MONEY - ISSUE SSL CERTIFICATE (Let's Encrypt via win-acme)
#
# Run ON THE VPS in ELEVATED PowerShell:
#   powershell -ExecutionPolicy Bypass -File "scripts\Issue-Certificate.ps1"
#
# Based on Wolfson OS pattern - uses win-acme for automated cert generation
# =============================================================================

param(
    [string] $Domain      = 'manageyourmoney.ashishbaboo.com',
    [string] $AcmeEmail   = 'ashishbaboo007@gmail.com'
)

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  [OK] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [!] $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "  [X] $m" -ForegroundColor Red; exit 1 }

# Paths
$ToolsDir  = 'C:\tools'
$WacsDir   = Join-Path $ToolsDir 'win-acme'
$WacsExe   = Join-Path $WacsDir 'wacs.exe'
$PemDir    = Join-Path $ToolsDir 'certs'
$NginxDir  = Join-Path $ToolsDir 'nginx'
$WebRoot   = Join-Path $NginxDir 'acme-webroot'
$NssmExe   = Join-Path $ToolsDir 'nssm\nssm.exe'

$CertChain = Join-Path $PemDir "$Domain-chain.pem"
$CertKey   = Join-Path $PemDir "$Domain-key.pem"

Step "Certificate Generation for $Domain"

# Check prerequisites
if (-not (Test-Path $WacsExe)) {
    Fail "win-acme not found at $WacsExe"
}
Ok "win-acme found"

if (-not (Test-Path $PemDir)) {
    New-Item -ItemType Directory -Force -Path $PemDir | Out-Null
}
Ok "PEM directory ready"

if (-not (Test-Path $WebRoot)) {
    New-Item -ItemType Directory -Force -Path $WebRoot | Out-Null
}
Ok "ACME webroot ready"

# Check if cert already exists
if ((Test-Path $CertChain) -and (Test-Path $CertKey)) {
    Ok "certificate already exists"
    Write-Host "  Chain: $CertChain"
    Write-Host "  Key:   $CertKey"
    exit 0
}

# Verify domain resolves
Write-Host "`nVerifying domain DNS..."
try {
    $ip = [System.Net.Dns]::GetHostAddresses($Domain)[0].IPAddressToString
    Ok "domain resolves to $ip"
} catch {
    Warn "domain does not resolve - certificate generation may fail"
    Warn "ensure DNS A record points to your VPS public IP"
}

# Issue certificate using win-acme (Wolfson OS pattern)
Write-Host "`nIssuing certificate via win-acme..."
Write-Host "  This may take 30-60 seconds..."

Push-Location $WacsDir

& .\wacs.exe `
    --source manual `
    --host $Domain `
    --validation http `
    --baseuri "http://$Domain" `
    --store pemfiles `
    --pemfilespath $PemDir `
    --accepttos `
    --emailaddress $AcmeEmail 2>&1 | Out-Null

Pop-Location

# Verify certificate was created
Start-Sleep -Seconds 2

if ((Test-Path $CertChain) -and (Test-Path $CertKey)) {
    Ok "certificate issued successfully"
    Write-Host "  Chain: $CertChain"
    Write-Host "  Key:   $CertKey"

    # Display cert info
    Write-Host "`nCertificate details:"
    & openssl x509 -in $CertChain -noout -text 2>$null | findstr /R "Subject|Issuer|Not Before|Not After"
} else {
    Fail "certificate files not created - check win-acme output above"
}

# Update nginx config for HTTPS
Write-Host "`nUpdating nginx for HTTPS..."

$NginxConf = Join-Path $NginxDir "conf\manage-your-money.conf"
$certChainFwd = $CertChain.Replace('\', '/')
$certKeyFwd = $CertKey.Replace('\', '/')

$nginxCfgHttps = @"
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

[System.IO.File]::WriteAllText($NginxConf, $nginxCfgHttps, (New-Object System.Text.UTF8Encoding($false)))
Ok "nginx HTTPS config written"

# Test nginx config
Push-Location $NginxDir
& .\nginx.exe -t 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Pop-Location
    Ok "nginx config valid"

    # Reload nginx
    & $NssmExe restart nginx | Out-Null
    Start-Sleep -Seconds 3
    Ok "nginx restarted with HTTPS"
} else {
    Pop-Location
    Fail "nginx config is invalid"
}

# Schedule weekly cert renewal check
Write-Host "`nScheduling certificate renewal..."
$renewTask = "ManageYourMoney-CertRenewal"
schtasks /Create /F /TN $renewTask /SC WEEKLY /D SUN /ST 04:30 `
    /RU SYSTEM /RL HIGHEST /TR "`"$NssmExe`" restart nginx" 2>&1 | Out-Null
Ok "weekly nginx restart scheduled (for cert renewal)"

# Test HTTPS
Write-Host "`nTesting HTTPS..."
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest "https://$Domain" -UseBasicParsing -TimeoutSec 10 -SkipCertificateCheck
    Ok "HTTPS is working!"
} catch {
    Warn "HTTPS test failed: $($_.Exception.Message)"
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   CERTIFICATE INSTALLATION COMPLETE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "  Domain:     https://$Domain" -ForegroundColor Green
Write-Host "  Certificate: $CertChain"
Write-Host "  Key:         $CertKey"
Write-Host "  Renewal:     Weekly on Sunday 04:30 AM`n" -ForegroundColor Green

Write-Host "  Access your app:"
Write-Host "    https://$Domain`n" -ForegroundColor Yellow
