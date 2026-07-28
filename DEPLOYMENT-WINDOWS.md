# Deploying Manage Your Money to Windows VPS

**Developed by Ashish Baboo** | [ashishbaboo.com](https://ashishbaboo.com)

Two scripts:

| Script | Runs where | What |
|---|---|---|
| [Deploy-VPS-Bootstrap.ps1](scripts/Deploy-VPS-Bootstrap.ps1) | The VPS, once | Installs whatever is missing, clones, configures, issues the cert, registers services |
| [Deploy-AutoDeploy.ps1](scripts/Deploy-AutoDeploy.ps1) | The VPS, every 5 min | Pulls `origin/main`, rebuilds and restarts only what changed |

Bootstrap is idempotent — re-run it after fixing anything and it skips what is already done.

---

## Where things land

```
<Desktop>\Projects\manage-your-money          the checkout
<Desktop>\Projects\manage-your-money\logs      service + deploy logs
C:\tools\nginx | nssm | win-acme              shared toolchain
C:\tools\certs                                pem files
```

---

## Before you run it

### 1. DNS A record

Let's Encrypt validates over HTTP, so this must resolve *before* the cert step:

```
money.example.com    A    <VPS public IP>
```

Phase 1 verifies it and refuses to continue if wrong.

### 2. Ports 80 and 443 open in the cloud provider's firewall

The script opens the *Windows* firewall; it cannot reach the provider's security group.

### 3. A GitHub PAT

The repo is public, but if using a private fork:

```powershell
# Fine-grained token, Contents: Read-only, scoped to your repo
$pat = 'github_pat_...'
```

---

## Running it

### On your workstation

No prep needed — run directly on the VPS.

### On the VPS (RDP)

Open an **elevated** PowerShell and run:

```powershell
$pat = 'your-github-pat'  # if using private repo
powershell -ExecutionPolicy Bypass -File "C:\Users\<user>\Desktop\Projects\manage-your-money\scripts\Deploy-VPS-Bootstrap.ps1" `
    -Domain money.example.com `
    -GitHubPat $pat
```

Or with defaults (repo already cloned):

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\<user>\Desktop\Projects\manage-your-money\scripts\Deploy-VPS-Bootstrap.ps1"
```

Roughly **5-10 minutes** on a fresh box. Much less if the toolchain (nginx, Node, NSSM) is already installed.

**Useful flags:**

- `-SkipCert` — set up over plain HTTP; re-run without it later to add HTTPS
- `-SkipDnsCheck` — bypass the phase-1 DNS gate
- `-Domain` — use a different domain (default: money.example.com)
- `-AppPort` — use a different port if 5173 is taken

---

## After it finishes

```
https://money.example.com
```

Every push to `main` is live within 5 minutes. Watch a deploy:

```powershell
Get-Content "C:\Users\<user>\Desktop\Projects\manage-your-money\logs\autodeploy.log" -Tail 40 -Wait
```

Force one immediately:

```powershell
powershell -File "C:\Users\<user>\Desktop\Projects\manage-your-money\scripts\Deploy-AutoDeploy.ps1" -Force `
    -Repo "C:\Users\<user>\Desktop\Projects\manage-your-money"
```

Then clear the pasted secrets from PowerShell history:

```powershell
Remove-Item (Get-PSReadlineOption).HistorySavePath
```

---

## Service control

```powershell
# Check status
Get-Service ManageYourMoney
Get-Service nginx

# Restart app
Restart-Service ManageYourMoney

# View logs
Get-Content "C:\Users\<user>\Desktop\Projects\manage-your-money\logs\app.err.log" -Tail 50

# Use NSSM to manage
C:\tools\nssm\nssm.exe restart ManageYourMoney
```

---

## Troubleshooting

### App won't start

```powershell
# Check service status
Get-Service ManageYourMoney

# View error logs
Get-Content "C:\Users\<user>\Desktop\Projects\manage-your-money\logs\app.err.log" -Tail 100
```

### nginx not proxying

```powershell
# Test nginx config
cd C:\tools\nginx
.\nginx.exe -t

# Check error log
Get-Content "C:\tools\nginx\logs\error.log" -Tail 50

# Restart nginx
C:\tools\nssm\nssm.exe restart nginx
```

### Certificate issues

```powershell
# Check certificate files
Get-ChildItem C:\tools\certs

# Run win-acme manually
C:\tools\win-acme\wacs.exe
```

### Ports in use

```powershell
# Check what's listening on port 5173
Get-NetTCPConnection -LocalPort 5173 -State Listen
```

---

## Rollback

The auto-deploy task pulls `main` forward within 5 minutes, so disable it first:

```powershell
schtasks /Change /TN ManageYourMoney-AutoDeploy /DISABLE
cd "C:\Users\<user>\Desktop\Projects\manage-your-money"
git reset --hard <last-good-sha>
powershell -File scripts\Deploy-AutoDeploy.ps1 -Force -Repo "C:\Users\<user>\Desktop\Projects\manage-your-money"
schtasks /Change /TN ManageYourMoney-AutoDeploy /ENABLE
```

For a durable rollback, revert on `main` and push instead.

---

## Operating notes

**Supabase credentials** live in `.env.production` on the VPS. Update them after bootstrap if they changed:

```powershell
# Edit the file
notepad "C:\Users\<user>\Desktop\Projects\manage-your-money\.env.production"

# Restart app to pick up the new values
Restart-Service ManageYourMoney
```

**A failed build does not restart the service.** The previous `dist` output stays on disk. Check logs for `BUILD FAILED`:

```powershell
Get-Content "C:\Users\<user>\Desktop\Projects\manage-your-money\logs\autodeploy.log" | Select-String "BUILD"
```

**Certificate renewal**: win-acme installs its own renewal task and rewrites the pem files. A weekly Sunday 04:30 nginx restart is scheduled to pick them up.

---

## Generated files after bootstrap

```
<Repo>\.env.production                  Supabase config
<Repo>\dist\                            Built app
<Repo>\logs\app.*.log                   Service logs
<Repo>\logs\autodeploy.log              Deploy log
C:\tools\nginx\conf\manage-your-money.conf
C:\tools\certs\money.example.com-*.pem
```

---

## Summary

Bootstrap is **one command**. It:
- Installs git, Node.js, nginx, NSSM, win-acme (if missing)
- Clones the repo
- Builds the app
- Sets up an NSSM Windows service
- Configures nginx as a reverse proxy
- Issues an SSL certificate
- Registers a 5-minute auto-deploy task

Every push to `main` is live within 5 minutes. Logs are in `<Repo>\logs\`.

---

**Developed by Ashish Baboo** | [ashishbaboo.com](https://ashishbaboo.com)
