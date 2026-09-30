$ErrorActionPreference = "Continue"
$API = "http://localhost:4000/api"
# Bogus but well-formed UUID. Endpoints that take no body 404 on this,
# which proves the request got *past* the requireRole guard.
$BOGUS = "00000000-0000-0000-0000-0000000000ff"

$accounts = @(
  @{ role = "MAIN_ADMIN";    email = "main.admin@test.local" },
  @{ role = "OFFICE_ADMIN";  email = "office.admin@test.local" },
  @{ role = "IT_ADMIN";      email = "it.admin@test.local" },
  @{ role = "EMPLOYEE";      email = "employee@test.local" }
)

# Every mutating endpoint in the app, with the roles its route file allows.
# allowed = roles permitted by requireRole in server/src/routes/*.routes.ts
$endpoints = @(
  @{ area = "Offices";     method = "POST";   path = "/offices";                              allowed = @("MAIN_ADMIN") },
  @{ area = "Offices";     method = "PATCH";  path = "/offices/$BOGUS";                      allowed = @("MAIN_ADMIN") },
  @{ area = "Offices";     method = "POST";   path = "/offices/$BOGUS/archive";               allowed = @("MAIN_ADMIN") },
  @{ area = "Offices";     method = "POST";   path = "/offices/$BOGUS/unarchive";             allowed = @("MAIN_ADMIN") },

  @{ area = "Employees";   method = "POST";   path = "/employees";                            allowed = @("MAIN_ADMIN","IT_ADMIN") },
  @{ area = "Employees";   method = "PATCH";  path = "/employees/$BOGUS";                    allowed = @("MAIN_ADMIN","IT_ADMIN") },
  @{ area = "Employees";   method = "POST";   path = "/employees/$BOGUS/deactivate";          allowed = @("MAIN_ADMIN","IT_ADMIN") },
  @{ area = "Employees";   method = "POST";   path = "/employees/$BOGUS/reactivate";          allowed = @("MAIN_ADMIN","IT_ADMIN") },

  @{ area = "Plans";       method = "POST";   path = "/plans";                                allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ area = "Plans";       method = "PATCH";  path = "/plans/$BOGUS";                        allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ area = "Plans";       method = "POST";   path = "/plans/$BOGUS/archive";                 allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ area = "Plans";       method = "POST";   path = "/plans/$BOGUS/offices";                 allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ area = "Plans";       method = "DELETE"; path = "/plans/$BOGUS/offices/$BOGUS";          allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ area = "Plans";       method = "POST";   path = "/plans/$BOGUS/assignments";             allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ area = "Plans";       method = "PATCH";  path = "/plans/$BOGUS/assignments/$BOGUS";      allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ area = "Plans";       method = "DELETE"; path = "/plans/$BOGUS/assignments/$BOGUS";      allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },

  @{ area = "Metrics";     method = "POST";   path = "/metrics";                              allowed = @("MAIN_ADMIN") },
  @{ area = "Metrics";     method = "PATCH";  path = "/metrics/$BOGUS";                      allowed = @("MAIN_ADMIN") },
  @{ area = "Metrics";     method = "POST";   path = "/metrics/$BOGUS/archive";               allowed = @("MAIN_ADMIN") },
  @{ area = "Metrics";     method = "POST";   path = "/metrics/$BOGUS/unarchive";             allowed = @("MAIN_ADMIN") },

  @{ area = "Performance"; method = "POST";   path = "/performance-records";                  allowed = @("MAIN_ADMIN") },
  @{ area = "Performance"; method = "PATCH";  path = "/performance-records/$BOGUS";           allowed = @("MAIN_ADMIN") },

  @{ area = "Monthly";     method = "POST";   path = "/monthly-updates";                      allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ area = "Monthly";     method = "PATCH";  path = "/monthly-updates/$BOGUS";               allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },

  @{ area = "Notify";      method = "POST";   path = "/notifications";                        allowed = @("MAIN_ADMIN","OFFICE_ADMIN","IT_ADMIN") },

  @{ area = "Scorecards";  method = "POST";   path = "/scorecards/periods";                   allowed = @("MAIN_ADMIN") },
  @{ area = "Scorecards";  method = "POST";   path = "/scorecards/periods/$BOGUS/offices/$BOGUS"; allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ area = "Scorecards";  method = "PATCH";  path = "/scorecards/office-scorecards/$BOGUS";  allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ area = "Scorecards";  method = "POST";   path = "/scorecards/office-scorecards/$BOGUS/finalize"; allowed = @("MAIN_ADMIN") },
  @{ area = "Scorecards";  method = "POST";   path = "/scorecards/office-scorecards/$BOGUS/entries";   allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ area = "Scorecards";  method = "PATCH";  path = "/scorecards/entries/$BOGUS";            allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ area = "Scorecards";  method = "DELETE"; path = "/scorecards/entries/$BOGUS";            allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ area = "Scorecards";  method = "PUT";    path = "/scorecards/entries/$BOGUS/bands";      allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ area = "Scorecards";  method = "PUT";    path = "/scorecards/entries/$BOGUS/result";     allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ area = "Scorecards";  method = "PATCH";  path = "/scorecards/entries/$BOGUS/result/final-score"; allowed = @("MAIN_ADMIN") }
)

$sessions = @{}
foreach ($a in $accounts) {
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  try {
    Invoke-RestMethod -Uri "$API/auth/login" -Method Post -WebSession $s -ContentType "application/json" `
      -Body (@{ email = $a.email; password = "Test@1234" } | ConvertTo-Json) | Out-Null
    $sessions[$a.role] = $s
  } catch { "LOGIN FAILED for $($a.role)"; exit 1 }
}

# $results[$area][$method $path][$role] = status
$results = @{}
$mismatches = @()

# Read routes. A GET cannot be probed for "was this allowed?" the same way —
# every authenticated caller gets 200, because the list is *filtered* rather
# than refused. So the expected value here is the status a role should get,
# not merely "not 403".
$readEndpoints = @(
  @{ name = "GET /offices";                  path = "/offices";                  allowAll = $true },
  @{ name = "GET /offices/tree";             path = "/offices/tree";             allowAll = $true },
  @{ name = "GET /employees";                path = "/employees";                allowAll = $true },
  @{ name = "GET /plans";                    path = "/plans";                    allowAll = $true },
  @{ name = "GET /metrics";                  path = "/metrics";                  allowAll = $true },
  @{ name = "GET /performance-records";      path = "/performance-records";      allowAll = $true },
  @{ name = "GET /notifications";            path = "/notifications";            allowAll = $true },
  @{ name = "GET /scorecards/periods";       path = "/scorecards/periods";       allowAll = $true },
  @{ name = "GET /dashboard/stats";          path = "/dashboard/stats";          allowAll = $true },
  # Restricted reads: supervisory or role-specific.
  @{ name = "GET /monthly-updates";          path = "/monthly-updates";          allowed = @("MAIN_ADMIN","OFFICE_ADMIN") },
  @{ name = "GET /audit-log";                path = "/audit-log";                allowed = @("MAIN_ADMIN","IT_ADMIN") },
  @{ name = "GET /notifications/recipients"; path = "/notifications/recipients"; allowed = @("MAIN_ADMIN","OFFICE_ADMIN","IT_ADMIN") }
)

function Get-Status($method, $url, $session, $body) {
  try {
    if ($body) {
      Invoke-RestMethod -Uri $url -Method $method -WebSession $session -ContentType "application/json" -Body $body -ErrorAction Stop | Out-Null
    } else {
      Invoke-RestMethod -Uri $url -Method $method -WebSession $session -ErrorAction Stop | Out-Null
    }
    return 200
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if (-not $code) { return "ERR" }
    return $code
  }
}

foreach ($e in $endpoints) {
  $key = "$($e.method) $($e.path -replace $BOGUS, '{id}')"
  foreach ($a in $accounts) {
    $s = $sessions[$a.role]
    $url = "$API$($e.path -replace $BOGUS, $BOGUS)"
    $expectedAllowed = $e.allowed -contains $a.role
    # Empty JSON body: Zod rejects with 422 before any DB write, so an
    # allowed request is proven without creating data.
    $status = Get-Status $e.method $url $s "{}"
    $actualAllowed = ($status -ne 403)

    if ($actualAllowed -ne $expectedAllowed) {
      $mismatches += [pscustomobject]@{
        Endpoint = $key; Role = $a.role; Status = $status
        Expected = $(if ($expectedAllowed) { "allowed" } else { "403" })
        Actual   = $(if ($actualAllowed) { "allowed" } else { "403" })
      }
    }
  }
}

$readChecks = 0
foreach ($e in $readEndpoints) {
  foreach ($a in $accounts) {
    $s = $sessions[$a.role]
    $status = Get-Status "GET" "$API$($e.path)" $s $null
    $readChecks++

    if ($e.allowAll) {
      # Any authenticated role may call it; the response is what gets filtered.
      if ($status -ne 200) {
        $mismatches += [pscustomobject]@{
          Endpoint = $e.name; Role = $a.role; Status = $status
          Expected = "200"; Actual = $status
        }
      }
    } else {
      $expectedAllowed = $e.allowed -contains $a.role
      $actualAllowed = ($status -ne 403)
      if ($actualAllowed -ne $expectedAllowed) {
        $mismatches += [pscustomobject]@{
          Endpoint = $e.name; Role = $a.role; Status = $status
          Expected = $(if ($expectedAllowed) { "allowed" } else { "403" })
          Actual   = $(if ($actualAllowed) { "allowed" } else { "403" })
        }
      }
    }
  }
}

"=== Mutations: $($endpoints.Count) endpoints x 4 roles = $($endpoints.Count * 4) probes ==="
"=== Reads:     $($readEndpoints.Count) endpoints x 4 roles = $readChecks probes ==="
"=== Total:     $($endpoints.Count * 4 + $readChecks) probes ==="
""
if ($mismatches.Count -eq 0) {
  "RESULT: no mismatches. Every role is allowed or refused exactly as the route guards specify."
} else {
  "RESULT: $($mismatches.Count) MISMATCH(ES) between route guards and observed behaviour:"
  ""
  $mismatches | Format-Table -AutoSize | Out-String
}
