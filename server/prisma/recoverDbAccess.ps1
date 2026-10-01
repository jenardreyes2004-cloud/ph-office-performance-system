# Recovers database access when server/.env and the Postgres role disagree.
#
# Symptom: /health/ready returns 503, and no current password is known.
# Method:  temporarily allow passwordless loopback auth, set a new password,
#          then put the original configuration back and verify the new password
#          under the real rules.
#
# MUST be run from an Administrator PowerShell — it restarts the PostgreSQL
# Windows service, which a non-elevated process cannot do.
#
#   Right-click Windows Terminal / PowerShell -> Run as administrator
#   cd D:\office-performance-system\server
#   powershell -ExecutionPolicy Bypass -File prisma\recoverDbAccess.ps1
#
# Safe to run more than once: leftover state from a previous attempt is cleaned
# up at the start, and the original auth configuration is restored in a finally
# block, so trust cannot survive a failure.

$ErrorActionPreference = "Stop"

$psql    = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$hba     = "C:\Program Files\PostgreSQL\18\data\pg_hba.conf"
$hbaBak  = "$hba.opmpsbak"

# .env is in server\, one level up from this script's folder in server\prisma\.
$envFile = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.env"))

function Fail($m) { Write-Output "FAILED: $m"; exit 1 }

if (-not (Test-Path $envFile)) { Fail "No .env at $envFile" }
if (-not (Test-Path $hba))     { Fail "No pg_hba.conf at $hba" }

$service = Get-Service -ErrorAction SilentlyContinue |
           Where-Object { $_.Name -like "postgresql*" } |
           Select-Object -First 1
if (-not $service) { Fail "No postgresql* service found" }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
             [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Fail "Must run as Administrator (it restarts the PostgreSQL service)."
}

function Restart-Postgres {
    Restart-Service -Name $service.Name -Force -ErrorAction Stop

    # Readiness is a TCP probe, deliberately NOT a psql call. After the auth
    # configuration is restored, psql would prompt for a password and hang the
    # script waiting for input nobody can type into.
    for ($i = 0; $i -lt 60; $i++) {
        $running = (Get-Service -Name $service.Name).Status -eq "Running"
        if ($running) {
            $open = Test-NetConnection -ComputerName localhost -Port 5432 `
                     -InformationLevel Quiet -WarningAction SilentlyContinue
            if ($open) { return }
        }
        Start-Sleep -Milliseconds 500
    }
    Fail "Postgres did not become ready after restart"
}

# --- 0. Clear leftovers from any earlier attempt ----------------------------
if (Test-Path $hbaBak) { Move-Item $hbaBak $hba -Force }

# --- 1. Generate ------------------------------------------------------------
$new = node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
if ($new -notmatch '^[A-Za-z0-9_-]{32}$') { Fail "Generation produced an unexpected value." }

# Every psql call in this script is non-interactive. With trust active no
# password is needed; with scram restored the password is supplied via this
# variable. Without -w, psql would prompt and hang the script.
$env:PGPASSWORD = $new
$PGARGS = @("-w", "-h", "localhost", "-U", "postgres")

Write-Output "step 1/6  password generated"

# --- 2. Swap in trust, set the password, always put the original back -------
Copy-Item $hba $hbaBak -Force

try {
    $rewritten = Get-Content $hba | ForEach-Object {
        if ($_ -match '^\s*(local|host)\s+all\s+all\s+(127\.0\.0\.1/32|::1/128)\s+scram-sha-256\s*$') {
            "# temporarily disabled by recoverDbAccess.ps1: $_"
        } else { $_ }
    }
    $trust = @"
# TEMPORARY trust rules added by recoverDbAccess.ps1 - removed before exit.
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
"@
    Set-Content -Path $hba -Value ($rewritten + "`n" + $trust) -Encoding ascii
    Restart-Postgres
    Write-Output "step 2/6  trust enabled, postgres restarted"

    $null = & $psql @PGARGS -d performance_db -q -c "ALTER USER postgres WITH PASSWORD '$new';"
    if ($LASTEXITCODE -ne 0) { Fail "ALTER USER failed" }
    Write-Output "step 3/6  password set"
}
finally {
    # Runs on the success path and on any exception, so passwordless loopback
    # auth cannot outlive this script.
    if (Test-Path $hbaBak) { Move-Item $hbaBak $hba -Force }
    Restart-Postgres
    Write-Output "step 4/6  original auth configuration restored"
}

# --- 3. Verify under the real rules, not while trust was bypassed -------------
# PGPASSWORD is already $new; the only difference now is that scram-sha-256 is
# genuinely enforced again.
$null = & $psql @PGARGS -d performance_db -tAc "SELECT 1;" 2>&1
if ($LASTEXITCODE -ne 0) {
    Fail "New password does not authenticate. server/.env has NOT been updated - restart and investigate."
}
Write-Output "step 5/6  password verified under scram-sha-256"

# --- 4. Write .env and pgpass ------------------------------------------------
$line = "DATABASE_URL=`"postgresql://postgres:$new@localhost:5432/performance_db?schema=public`""
(Get-Content $envFile) -replace '^DATABASE_URL=.*', $line | Set-Content $envFile -Encoding utf8

$pgpassDir  = Join-Path $env:APPDATA "postgresql"
$pgpassFile = Join-Path $pgpassDir "pgpass.conf"
if (-not (Test-Path $pgpassDir)) { New-Item -ItemType Directory -Path $pgpassDir -Force | Out-Null }
$escaped = $new -replace '\\', '\\\\' -replace ':', '\:'
"localhost:5432:performance_db:postgres:$escaped" | Set-Content $pgpassFile -Encoding ascii
try { & icacls $pgpassFile /inheritance:r /grant:r "$env:USERNAME:(R,W)" 2>&1 | Out-Null; $locked = $true } catch { $locked = $false }

$env:PGPASSWORD = $null
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

Write-Output "step 6/6  .env and pgpass.conf written"
Write-Output ""
Write-Output "RECOVERED"
Write-Output ("fingerprint (first 6) : " + $new.Substring(0, 6) + "...")
Write-Output ("pgpass.conf         : " + $pgpassFile)
Write-Output ("pgpass ACL locked   : " + $locked)
Write-Output "trust rules on disk  : " + ((Get-Content $hba | Select-String -Pattern '^\s*(local|host).*\btrust\s*$') -ne $null)
Write-Output ""
Write-Output "Restart the API: Ctrl+C, then npm run dev"
