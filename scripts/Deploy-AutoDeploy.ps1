# =============================================================================
# MANAGE YOUR MONEY - AUTO-DEPLOY
#
# Runs every 5 minutes as scheduled task 'ManageYourMoney-AutoDeploy'.
# Pulls origin/main and rebuilds/restarts only what actually changed.
#
# Log: <repo>\logs\autodeploy.log
# =============================================================================

param(
    [switch] $Force,
    [string] $Repo = ''
)

if (-not $Repo) {
    $desktop = [Environment]::GetFolderPath('Desktop')
    if (-not $desktop) { $desktop = Join-Path $env:USERPROFILE 'Desktop' }
    $Repo = Join-Path $desktop 'Projects\manage-your-money'
}

$Nssm    = 'C:\tools\nssm\nssm.exe'
$Npm     = 'C:\Program Files\nodejs\npm.cmd'
$SvcApp  = 'ManageYourMoney'

$env:GIT_TERMINAL_PROMPT = '0'

$LogDir = Join-Path $Repo 'logs'
$Log    = Join-Path $LogDir 'autodeploy.log'
$Lock   = Join-Path $LogDir 'autodeploy.lock'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }

function Log($m) {
    Add-Content -Path $Log -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $m)
}

function Invoke-Git { param([string[]]$GitArgs) & git.exe -C $Repo -c safe.directory=* @GitArgs 2>&1 }

# Single-instance lock
if (Test-Path $Lock) {
    if (((Get-Date) - (Get-Item $Lock).LastWriteTime).TotalMinutes -lt 45) { exit 0 }
    Remove-Item $Lock -Force
}
New-Item -ItemType File -Path $Lock -Force | Out-Null

try {
    if ((Test-Path $Log) -and ((Get-Item $Log).Length -gt 5MB)) { Move-Item $Log "$Log.1" -Force }

    Invoke-Git @('fetch', 'origin', 'main') | Out-Null
    $local  = (Invoke-Git @('rev-parse', 'HEAD')) | Select-Object -First 1
    $remote = (Invoke-Git @('rev-parse', 'origin/main')) | Select-Object -First 1
    if ("$local" -eq "$remote" -and -not $Force) { exit 0 }

    if ("$local" -eq "$remote") {
        Log "FORCED redeploy at $local"
        $changed = @('frontend/forced')
    } else {
        $changed = @(Invoke-Git @('diff', '--name-only', "$local", "$remote"))
        Log "deploying $local -> $remote ($($changed.Count) files changed)"
    }
    Invoke-Git @('reset', '--hard', 'origin/main') | Out-Null

    $frontendChanged = $changed | Where-Object { $_ -match '^(src|package|tsconfig|vite|tailwind)' }
    $depsChanged     = $changed | Where-Object { $_ -match '^package(-lock)?\.json$' }

    if ($depsChanged) {
        Log 'dependencies changed - npm install'
        Push-Location $Repo
        & $Npm ci --production >> $Log 2>&1
        Pop-Location
    }

    if ($frontendChanged) {
        Log 'frontend changed - npm run build'
        Push-Location $Repo
        & $Npm run build >> $Log 2>&1
        $buildOk = ($LASTEXITCODE -eq 0)
        Pop-Location
        if ($buildOk) {
            Log "build OK - restarting $SvcApp"
            & $Nssm restart $SvcApp | Out-Null
            Start-Sleep -Seconds 3
            try {
                Invoke-WebRequest "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 20 | Out-Null
                Log 'app healthy'
            } catch {
                Log "WARNING: app not answering after restart - see app.err.log"
            }
        } else {
            Log 'BUILD FAILED - app NOT restarted (previous build keeps serving)'
        }
    }

    Log 'deploy done'
} catch {
    Log ("ERROR: " + $_.Exception.Message)
} finally {
    Remove-Item $Lock -Force -ErrorAction SilentlyContinue
}
