# Rotates the Postgres password without ever printing it.
#
# The password is generated inside this script and never leaves it except
# into two places it must reach: the Postgres role itself, and server/.env
# (which is gitignored).
#
# What is NOT exposed:
#   - the chat transcript   — nothing here echoes the value
#   - git                   — .env is ignored, and .env.bak is removed at the end
#   - process arguments     — the SQL is piped over stdin, so the password does
#                             not appear in `psql`'s command line where another
#                             local process could read it from the process table
#
# Where it DOES go, and why that is the point:
#   - the Postgres role                — unavoidable, it is the credential
#   - server/.env                      — the app has to connect somehow; gitignored
#   - %APPDATA%\postgresql\pgpass.conf — Postgres' own credential store, so
#     psql and pg_dump connect with no prompt from now on and you never have to
#     paste the password into a shell again. Lives in your user profile, so it
#     is not part of the repository.
#
# For a second machine, put the fingerprint-matched value in a password manager
# rather than in chat. That is the one copy that should exist outside the two
# places above, and it is a manual step, not an automated one.
#
# What you see on completion is a 6-character fingerprint, which is enough to
# confirm which password is now in use but useless as a credential.

$ErrorActionPreference = "Stop"

$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$envFile = Join-Path $PSScriptRoot ".env"

# The CURRENT password is needed to connect and issue the ALTER. It is read
# from the environment rather than hardcoded, because the previous rotation
# means it is no longer the original value and nobody should type it here.
#
#   $env:OPMPS_CURRENT_DB_PASSWORD = $new   # in the shell that still holds it
#
# If it is already a password-manager entry, set it the same way. The value is
# never printed and never written to a file.
$current = $env:OPMPS_CURRENT_DB_PASSWORD

if ([string]::IsNullOrWhiteSpace($current)) {
    throw @"
OPMPS_CURRENT_DB_PASSWORD is not set.

Run this in the PowerShell window that still holds the current password:

  `$env:OPMPS_CURRENT_DB_PASSWORD = `$new
  .\prisma\rotateDbPassword.ps1

Remove-Item Env:\OPMPS_CURRENT_DB_PASSWORD afterwards.
"@
}

# --- 1. Generate ------------------------------------------------------------
# base64url alphabet only: [A-Za-z0-9_-]. No quotes, no backslash, no dollar
# sign, so it cannot break the SQL below or the connection string.
$new = node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"

if ($new -notmatch '^[A-Za-z0-9_-]{32}$') {
    throw "Generation failed - refusing to apply an unexpected value."
}

if ($new -eq $current) {
    throw "Generated value is identical to the current one - refusing."
}

# --- 2. Authenticate and apply ----------------------------------------------
# PGPASSWORD authenticates without putting either password on a command line.
$env:PGPASSWORD = $current

$applied = "ALTER USER postgres WITH PASSWORD '$new';" | & $psql -h localhost -U postgres -d performance_db -q 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "ALTER USER failed - is OPMPS_CURRENT_DB_PASSWORD correct?"
}

# --- 3. Prove it works BEFORE writing it to .env ---------------------------
# A connection test using the new password. If this passes, the value in
# .env is known-good; if it fails, nothing has been written yet.
$env:PGPASSWORD = $new
$verify = & $psql -h localhost -U postgres -d performance_db -tAc "SELECT 1;" 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "New password did not authenticate - .env left untouched: $verify"
}

# --- 4. Write to .env --------------------------------------------------------
if (-not (Test-Path $envFile)) { throw "No .env at $envFile" }

$line = "DATABASE_URL=`"postgresql://postgres:$new@localhost:5432/performance_db?schema=public`""
(Get-Content $envFile) -replace '^DATABASE_URL=.*', $line | Set-Content $envFile -Encoding utf8

# --- 5. Confirm the OLD password is now dead --------------------------------
$env:PGPASSWORD = $current
$old = & $psql -h localhost -U postgres -d performance_db -tAc "SELECT 1;" 2>&1
$oldRejected = ($LASTEXITCODE -ne 0)

# --- 6. Native credential store ---------------------------------------------
# Postgres reads this file by itself. Once written, `psql`, `pg_dump` and
# friends connect with no prompt and no PGPASSWORD, so the password does not
# have to be pasted into a shell again every time one is needed.
#
# Format: hostname:port:database:username:password  (* = any)
# Outside the repo, in the user profile, so it is never committed.
$pgpassDir = Join-Path $env:APPDATA "postgresql"
$pgpassFile = Join-Path $pgpassDir "pgpass.conf"
if (-not (Test-Path $pgpassDir)) { New-Item -ItemType Directory -Path $pgpassDir -Force | Out-Null }

# Colon and backslash are the field and escape characters in this format. The
# generated alphabet is [A-Za-z0-9_-], which contains neither, so no escaping
# is needed — but the substitution is kept so this stays correct if the
# alphabet ever changes.
$escaped = $new -replace '\\', '\\\\' -replace ':', '\:'
"localhost:5432:performance_db:postgres:$escaped" | Set-Content $pgpassFile -Encoding ascii

# Postgres refuses to read the file if it is readable by anyone else.
try {
    & icacls $pgpassFile /inheritance:r /grant:r "$env:USERNAME:(R,W)" 2>&1 | Out-Null
    $locked = $true
} catch {
    $locked = $false
}

# --- 7. Clear and report ----------------------------------------------------
$env:PGPASSWORD = $null
$env:OPMPS_CURRENT_DB_PASSWORD = $null
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:\OPMPS_CURRENT_DB_PASSWORD -ErrorAction SilentlyContinue
Remove-Item "$envFile.bak" -Force -ErrorAction SilentlyContinue

Write-Output "password rotated"
Write-Output ("fingerprint (first 6): " + $new.Substring(0, 6) + "...")
Write-Output ("old password rejected : " + $oldRejected)
Write-Output "server/.env updated"
Write-Output ("pgpass.conf written   : " + $pgpassFile)
Write-Output ("pgpass ACL locked    : " + $locked)
Write-Output ""
Write-Output "From now on psql and pg_dump connect with no prompt and no PGPASSWORD."
Write-Output "Restart the API (Ctrl+C, then npm run dev) to pick this up."
