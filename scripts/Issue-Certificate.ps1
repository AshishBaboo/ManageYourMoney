param(
    [Parameter(Mandatory=$true)]
    [string] $CloudflareToken
)

$ErrorActionPreference = 'Continue'

# Paths
$WacsExe   = 'C:\tools\win-acme\wacs.exe'
$PemDir    = 'C:\tools\certs'
$NginxDir  = 'C:\tools\nginx'
$NssmExe   = 'C:\tools\nssm\nssm.exe'
$Domain    = 'manageyourmoney.ashishbaboo.com'
$Email     = 'ashishbaboo007@gmail.com'

$CertChain = "$PemDir\$Domain-chain.pem"
$CertKey   = "$PemDir\$Domain-key.pem"

Write-Host "`n=== Certificate Generation ===" -ForegroundColor Cyan

if (Test-Path $CertChain) {
    Write-Host "  [OK] Certificate already exists" -ForegroundColor Green
} else {
    Write-Host "  Issuing certificate..." -ForegroundColor Yellow

    Push-Location (Split-Path $WacsExe)

    $env:WACS_CLOUDFLARE_APITOKEN = $CloudflareToken

    & $WacsExe --source manual --host $Domain --validation dns-cloudflare --store pemfiles --pemfilespath $PemDir --accepttos --emailaddress $Email --quiet 2>&1 | Out-Null

    Pop-Location
    Start-Sleep -Seconds 3

    if (Test-Path $CertChain) {
        Write-Host "  [OK] Certificate issued" -ForegroundColor Green
    } else {
        Write-Host "  [X] Certificate failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host "  Configuring nginx..." -ForegroundColor Yellow

$NginxConf = "$NginxDir\conf\manage-your-money.conf"

@"
server {
    listen 80;
    server_name $Domain;
    return 301 https://`$server_name`$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $Domain;

    ssl_certificate $($CertChain.Replace('\', '/'));
    ssl_certificate_key $($CertKey.Replace('\', '/'));

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

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
"@ | Set-Content $NginxConf

Push-Location $NginxDir
& .\nginx.exe -t 2>&1 | Out-Null
Pop-Location

& $NssmExe restart nginx | Out-Null
Start-Sleep -Seconds 3

Write-Host "  [OK] nginx configured" -ForegroundColor Green

schtasks /Create /F /TN "ManageYourMoney-CertRenewal" /SC WEEKLY /D SUN /ST 04:30 /RU SYSTEM /RL HIGHEST /TR "`"$NssmExe`" restart nginx" 2>&1 | Out-Null

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "   HTTPS READY" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`n  Visit: https://$Domain`n" -ForegroundColor Green

$env:WACS_CLOUDFLARE_APITOKEN = ""
