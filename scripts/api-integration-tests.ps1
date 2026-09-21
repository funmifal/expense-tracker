param(
  [string]$BaseUrl = 'http://localhost:3000',
  [switch]$RunBurst
)

$ErrorActionPreference = 'Stop'
$pass = 0
$fail = 0
$email = 'apitest.' + (Get-Date -Format 'yyyyMMddHHmmss') + '@example.com'

function Check($label, $condition, $extra = '') {
  if ($condition) { $script:pass++; Write-Output ("PASS  " + $label) }
  else { $script:fail++; Write-Output ("FAIL  " + $label + '  ' + $extra) }
}

function TryReq($method, $path, $body, $session, $contentType = 'application/json') {
  $params = @{ Uri = ($BaseUrl + $path); Method = $method; UseBasicParsing = $true; TimeoutSec = 15 }
  if ($body -ne $null) { $params.ContentType = $contentType; $params.Body = $body }
  if ($session -ne $null) { $params.WebSession = $session }
  try {
    $r = Invoke-WebRequest @params
    $json = $null
    try { $json = $r.Content | ConvertFrom-Json } catch {}
    return @{ status = $r.StatusCode; body = $r.Content; json = $json; response = $r; headers = $r.Headers }
  } catch {
    $status = $null; $content = $null
    if ($_.Exception.Response) {
      try { $status = [int]$_.Exception.Response.StatusCode } catch {}
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $content = $reader.ReadToEnd()
      } catch {}
    }
    $json = $null
    try { $json = $content | ConvertFrom-Json } catch {}
    $headers = $null
    try { $headers = $_.Exception.Response.Headers } catch {}
    return @{ status = $status; body = $content; json = $json; response = $null; headers = $headers }
  }
}

function New-SessionFrom($request) {
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $cookie = $request.response.Headers['Set-Cookie']
  if ($cookie -match 'next-auth.session-token=([^;]+)') {
    $s.Cookies.Add((New-Object System.Net.Cookie('next-auth.session-token', $Matches[1], '/', 'localhost')))
  }
  return $s
}

function Invoke-CleanupTestUsers {
  $js = @'
const{PrismaClient}=require("@prisma/client");
const p=new PrismaClient();
p.user.deleteMany({where:{email:{startsWith:"apitest."}}})
  .then((r) => { console.log("cleaned test users:", r.count); return p.$disconnect(); })
  .catch((e) => { console.error(e); process.exit(1); });
'@
  $file = Join-Path $PSScriptRoot '.cleanup-test-data.cjs'
  Set-Content -Path $file -Value $js -Encoding UTF8
  try { & node $file 2>$null } finally { Remove-Item $file -Force -ErrorAction SilentlyContinue }
}

try {
  Invoke-CleanupTestUsers

  if (-not $RunBurst) {
    Write-Output "== Step 3 regression =="

    $r = TryReq 'GET' '/api/v1/expenses' $null $null
  Check 'unauth GET /expenses -> 401' ($r.status -eq 401)
  Check 'error envelope has code+message' ($r.json.error.code -and $r.json.error.message)

  $regBody = @{ email = $email; password = 'Password123!'; currency = 'USD' } | ConvertTo-Json
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $r = TryReq 'POST' '/api/v1/users' $regBody $s
  $session = New-SessionFrom $r
  Check 'register -> 201' ($r.status -eq 201)
  Check 'register body is envelope' ($r.json.data.user.email -eq $email)

  $r = TryReq 'POST' '/api/v1/users' $regBody $session
  Check 'duplicate email -> 409 EMAIL_EXISTS' ($r.status -eq 409 -and $r.json.error.code -eq 'EMAIL_EXISTS')

  $r = TryReq 'POST' '/api/v1/auth/login' (@{ email = $email; password = 'wrongpassword' } | ConvertTo-Json) $session
  Check 'bad login -> 401 INVALID_CREDENTIALS' ($r.status -eq 401 -and $r.json.error.code -eq 'INVALID_CREDENTIALS')

  $s5 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $r = TryReq 'POST' '/api/v1/auth/login' (@{ email = $email; password = 'Password123!' } | ConvertTo-Json) $s5
  $session = New-SessionFrom $r
  Check 'login -> 200' ($r.status -eq 200 -and $r.json.data.user.email -eq $email)

  $r = TryReq 'GET' '/api/v1/users/me' $null $session
  Check 'GET /users/me -> 200, currency USD' ($r.status -eq 200 -and $r.json.data.user.currency -eq 'USD')
  Check 'rate-limit header present (X-RateLimit-Limit)' ($r.headers['X-RateLimit-Limit'] -match '^\d+$')
  Check 'rate-limit remaining present and within limit' ([int]$r.headers['X-RateLimit-Remaining'] -ge 0 -and [int]$r.headers['X-RateLimit-Remaining'] -le [int]$r.headers['X-RateLimit-Limit'])

  $r = TryReq 'GET' '/api/v1/categories?limit=100' $null $session
  Check 'categories total=9, hasMore=false' ($r.json.meta.total -eq 9 -and $r.json.data.Count -eq 9 -and $r.json.meta.hasMore -eq $false)
  $catId = $r.json.data[0].id
  $catName = $r.json.data[0].name

  $r = TryReq 'GET' '/api/v1/categories?limit=5&offset=3' $null $session
  Check 'categories offset paging -> 5 items, hasMore=true' ($r.json.data.Count -eq 5 -and $r.json.meta.total -eq 9 -and $r.json.meta.hasMore -eq $true)

  $r = TryReq 'GET' '/api/v1/categories?name=gro' $null $session
  Check 'categories name filter' ($r.json.meta.total -ge 1 -and ($r.json.data[0].name -match 'gro'))

  $r = TryReq 'GET' '/api/v1/payment-methods?limit=100' $null $session
  Check 'payment methods total=4' ($r.json.meta.total -eq 4 -and $r.json.data.Count -eq 4)
  $pmId = $r.json.data[0].id

  for ($i = 1; $i -le 25; $i++) {
    $amt = 500 + ($i * 997)
    $d = (Get-Date).AddDays(-($i % 30)).ToString('yyyy-MM-ddTHH:mm:ssZ')
    $eb = @{ amountMinorUnits = $amt; currency = 'USD'; date = $d; categoryId = $catId; paymentMethodId = $pmId; description = 'test expense ' + $i } | ConvertTo-Json
    $null = TryReq 'POST' '/api/v1/expenses' $eb $session
  }

  $r = TryReq 'GET' '/api/v1/expenses' $null $session
  Check 'expenses default limit=20, total=25, hasMore=true' ($r.json.meta.limit -eq 20 -and $r.json.meta.total -eq 25 -and $r.json.data.Count -eq 20 -and $r.json.meta.hasMore -eq $true)

  $r = TryReq 'GET' '/api/v1/expenses?limit=5' $null $session
  Check 'expenses limit=5' ($r.json.data.Count -eq 5 -and $r.json.meta.limit -eq 5)

  $r = TryReq 'GET' '/api/v1/expenses?minAmount=5000&maxAmount=12000' $null $session
  $ok14 = $true
  foreach ($e in $r.json.data) { if ($e.amountMinorUnits -lt 5000 -or $e.amountMinorUnits -gt 12000) { $ok14 = $false } }
  Check 'expenses amount range filter' ($r.status -eq 200 -and $ok14)

  $r = TryReq 'GET' '/api/v1/expenses?sort=amountMinorUnits&order=asc&limit=100' $null $session
  $asc = $true
  for ($i = 1; $i -lt $r.json.data.Count; $i++) { if ($r.json.data[$i].amountMinorUnits -lt $r.json.data[$i-1].amountMinorUnits) { $asc = $false } }
  Check 'expenses sort amount asc' ($r.status -eq 200 -and $asc)

  $r = TryReq 'GET' '/api/v1/expenses?limit=1' $null $session
  $eid = $r.json.data[0].id
  $r = TryReq 'GET' ('/api/v1/expenses/' + $eid) $null $session
  Check 'GET expense item -> 200' ($r.status -eq 200 -and $r.json.data.id -eq $eid)

  $r = TryReq 'PATCH' ('/api/v1/expenses/' + $eid) (@{ amountMinorUnits = 7777; description = 'updated' } | ConvertTo-Json) $session
  Check 'PATCH expense -> 200 updated amount' ($r.status -eq 200 -and $r.json.data.amountMinorUnits -eq 7777)

  $r = TryReq 'DELETE' ('/api/v1/expenses/' + $eid) $null $session
  Check 'DELETE expense -> 200 soft-delete' ($r.status -eq 200 -and $r.json.data.isDeleted -eq $true)

  $r = TryReq 'GET' ('/api/v1/expenses/' + $eid) $null $session
  Check 'GET soft-deleted expense -> 404' ($r.status -eq 404 -and $r.json.error.code -eq 'EXPENSE_NOT_FOUND')

  $r = TryReq 'GET' '/api/v1/expenses?limit=100' $null $session
  Check 'soft-deleted excluded from list (total=24)' ($r.json.meta.total -eq 24)

  $r = TryReq 'POST' '/api/v1/expenses' (@{ currency = 'USD'; date = '2026-01-01' } | ConvertTo-Json) $session
  Check 'POST expense missing fields -> 422 VALIDATION_ERROR' ($r.status -eq 422 -and $r.json.error.code -eq 'VALIDATION_ERROR')

  $r = TryReq 'POST' '/api/v1/expenses' (@{ amountMinorUnits = 1000; currency = 'USD'; date = '2026-01-01'; categoryId = 'doesnotexist123' } | ConvertTo-Json) $session
  Check 'POST expense unknown category -> 404' ($r.status -eq 404 -and $r.json.error.code -eq 'CATEGORY_NOT_FOUND')

  $r = TryReq 'POST' '/api/v1/categories' (@{ name = 'Travel' } | ConvertTo-Json) $session
  Check 'POST category -> 201' ($r.status -eq 201 -and $r.json.data.name -eq 'Travel')
  $newCatId = $r.json.data.id

  $r = TryReq 'POST' '/api/v1/categories' (@{ name = 'Travel' } | ConvertTo-Json) $session
  Check 'duplicate category -> 409 CATEGORY_EXISTS' ($r.status -eq 409 -and $r.json.error.code -eq 'CATEGORY_EXISTS')

  $r = TryReq 'PATCH' ('/api/v1/categories/' + $newCatId) (@{ name = 'Travel & Trips' } | ConvertTo-Json) $session
  Check 'PATCH category -> 200 renamed' ($r.status -eq 200 -and $r.json.data.name -eq 'Travel & Trips')

  $r = TryReq 'GET' ('/api/v1/categories/' + $newCatId) $null $session
  Check 'GET category item -> 200' ($r.status -eq 200 -and $r.json.data.id -eq $newCatId)

  $r = TryReq 'DELETE' ('/api/v1/categories/' + $newCatId) $null $session
  Check 'DELETE unused category -> 200' ($r.status -eq 200)

  $r = TryReq 'DELETE' ('/api/v1/categories/' + $catId) $null $session
  Check 'DELETE category in use -> 409 CATEGORY_IN_USE' ($r.status -eq 409 -and $r.json.error.code -eq 'CATEGORY_IN_USE')

  $r = TryReq 'POST' '/api/v1/payment-methods' (@{ name = 'Apple Pay' } | ConvertTo-Json) $session
  Check 'POST payment method -> 201' ($r.status -eq 201)
  $newPmId = $r.json.data.id

  $r = TryReq 'PATCH' ('/api/v1/payment-methods/' + $newPmId) (@{ name = 'Apple Pay Updated' } | ConvertTo-Json) $session
  Check 'PATCH payment method -> 200' ($r.status -eq 200 -and $r.json.data.name -eq 'Apple Pay Updated')

  $r = TryReq 'GET' ('/api/v1/payment-methods/' + $newPmId) $null $session
  Check 'GET payment method item -> 200' ($r.status -eq 200)

  $r = TryReq 'DELETE' ('/api/v1/payment-methods/' + $newPmId) $null $session
  Check 'DELETE payment method -> 200' ($r.status -eq 200)

  $r = TryReq 'POST' '/api/v1/budgets' (@{ amountMinorUnits = 250000; periodStart = '2026-08-01' } | ConvertTo-Json) $session
  Check 'POST overall budget -> 201' ($r.status -eq 201)

  $r = TryReq 'POST' '/api/v1/budgets' (@{ amountMinorUnits = 250000; periodStart = '2026-08-01' } | ConvertTo-Json) $session
  Check 'duplicate overall budget -> 409 BUDGET_EXISTS' ($r.status -eq 409 -and $r.json.error.code -eq 'BUDGET_EXISTS')

  $r = TryReq 'POST' '/api/v1/budgets' (@{ amountMinorUnits = 60000; periodStart = '2026-08-01'; categoryId = $catId } | ConvertTo-Json) $session
  Check 'POST category budget -> 201' ($r.status -eq 201)
  $budgetId = $r.json.data.id

  $r = TryReq 'GET' '/api/v1/budgets?periodStart=2026-08-01' $null $session
  Check 'budgets list filtered by period -> total>=2' ($r.status -eq 200 -and $r.json.meta.total -ge 2)

  $r = TryReq 'GET' ('/api/v1/budgets/' + $budgetId) $null $session
  Check 'GET budget item -> 200' ($r.status -eq 200 -and $r.json.data.id -eq $budgetId)

  $r = TryReq 'PATCH' ('/api/v1/budgets/' + $budgetId) (@{ amountMinorUnits = 75000 } | ConvertTo-Json) $session
  Check 'PATCH budget -> 200' ($r.status -eq 200 -and $r.json.data.amountMinorUnits -eq 75000)

  $r = TryReq 'PATCH' ('/api/v1/budgets/' + $budgetId) (@{} | ConvertTo-Json) $session
  Check 'PATCH budget empty -> 422' ($r.status -eq 422 -and $r.json.error.code -eq 'VALIDATION_ERROR')

  $r = TryReq 'GET' '/api/v1/budgets/nope-budget' $null $session
  Check 'GET malformed budget id -> 400 INVALID_ID' ($r.status -eq 400 -and $r.json.error.code -eq 'INVALID_ID')

  $r = TryReq 'POST' '/api/v1/categories' '{{{not json' $session
  Check 'invalid JSON body -> 400 INVALID_JSON' ($r.status -eq 400 -and $r.json.error.code -eq 'INVALID_JSON')

  $r = TryReq 'GET' '/api/v1/bogus' $null $session
  Check 'unknown path -> 404' ($r.status -eq 404)

  Write-Output "== Step 4 bad-input cases =="

  $r = TryReq 'GET' '/api/v1/expenses?limit=5000' $null $session
  Check 'limit=5000 is clamped -> 200, meta.limit=100' ($r.status -eq 200 -and $r.json.meta.limit -eq 100 -and $r.json.data.Count -le 100)

  $r = TryReq 'GET' '/api/v1/expenses?limit=101' $null $session
  Check 'limit=101 is clamped -> 200, meta.limit=100' ($r.status -eq 200 -and $r.json.meta.limit -eq 100)

  $r = TryReq 'GET' '/api/v1/expenses?limit=5000&offset=0&sort=amountMinorUnits&order=asc' $null $session
  $asc = $true
  for ($i = 1; $i -lt $r.json.data.Count; $i++) { if ($r.json.data[$i].amountMinorUnits -lt $r.json.data[$i-1].amountMinorUnits) { $asc = $false } }
  Check 'clamped limit still sorts correctly' ($r.status -eq 200 -and $r.json.meta.limit -eq 100 -and $asc)

  $r = TryReq 'GET' '/api/v1/expenses?offset=-5' $null $session
  Check 'offset=-5 -> 400 INVALID_QUERY, message names offset' ($r.status -eq 400 -and $r.json.error.code -eq 'INVALID_QUERY' -and $r.json.error.message -match 'offset')
  Check 'offset=-5 error has details' ($r.json.error.details -ne $null -and $r.json.error.details[0].field -eq 'offset')

  $r = TryReq 'GET' '/api/v1/expenses?offset=-1' $null $session
  Check 'offset=-1 -> 400 INVALID_QUERY' ($r.status -eq 400 -and $r.json.error.code -eq 'INVALID_QUERY')

  $r = TryReq 'GET' '/api/v1/expenses?offset=abc' $null $session
  Check 'offset=abc -> 400 INVALID_QUERY' ($r.status -eq 400 -and $r.json.error.code -eq 'INVALID_QUERY')

  $r = TryReq 'GET' '/api/v1/expenses?limit=0' $null $session
  Check 'limit=0 -> 400 INVALID_QUERY' ($r.status -eq 400 -and $r.json.error.code -eq 'INVALID_QUERY')

  $r = TryReq 'GET' '/api/v1/expenses?limit=-3' $null $session
  Check 'limit=-3 -> 400 INVALID_QUERY' ($r.status -eq 400 -and $r.json.error.code -eq 'INVALID_QUERY')

  $r = TryReq 'GET' '/api/v1/expenses?limit=abc' $null $session
  Check 'limit=abc -> 400 INVALID_QUERY' ($r.status -eq 400 -and $r.json.error.code -eq 'INVALID_QUERY')

  $r = TryReq 'GET' '/api/v1/expenses?sort=bogus' $null $session
  Check 'unknown sort -> 400 INVALID_QUERY, not ignored' ($r.status -eq 400 -and $r.json.error.code -eq 'INVALID_QUERY' -and $r.json.error.message -match 'sort')

  $r = TryReq 'GET' '/api/v1/categories?sort=amountMinorUnits' $null $session
  Check 'sort from another resource -> 400 INVALID_QUERY' ($r.status -eq 400 -and $r.json.error.code -eq 'INVALID_QUERY')

  $r = TryReq 'GET' '/api/v1/expenses?order=up' $null $session
  Check 'order=up -> 400 INVALID_QUERY' ($r.status -eq 400 -and $r.json.error.code -eq 'INVALID_QUERY')

  $r = TryReq 'GET' ('/api/v1/expenses/' + 'nope-nope-nope') $null $session
  Check 'malformed expense id -> 400 INVALID_ID' ($r.status -eq 400 -and $r.json.error.code -eq 'INVALID_ID')

  $r = TryReq 'GET' '/api/v1/expenses/seed_0000000000000000000000' $null $session
  Check 'well-formed but absent expense id -> 404 EXPENSE_NOT_FOUND' ($r.status -eq 404 -and $r.json.error.code -eq 'EXPENSE_NOT_FOUND')

  $r = TryReq 'GET' '/api/v1/expenses/doesnotexist123' $null $session
  Check 'well-formed but absent id -> 404 EXPENSE_NOT_FOUND' ($r.status -eq 404 -and $r.json.error.code -eq 'EXPENSE_NOT_FOUND')

  $response = TryReq 'POST' '/api/v1/expenses' (@{ currency = 'USD'; date = '2026-01-01' } | ConvertTo-Json) $session
  Check 'POST missing required field -> 422 + names the field' ($response.status -eq 422 -and $response.json.error.code -eq 'VALIDATION_ERROR' -and $response.json.error.details[0].field -eq 'amountMinorUnits')

  $response = TryReq 'POST' '/api/v1/expenses' (@{ amountMinorUnits = 'abc'; date = '2026-01-01'; categoryId = $catId } | ConvertTo-Json) $session
  Check 'POST wrong type -> 422 + names the field' ($response.status -eq 422 -and $response.json.error.details[0].field -eq 'amountMinorUnits')

  $response = TryReq 'POST' '/api/v1/categories' '{}' $session
  Check 'POST category missing name -> 422 + names the field' ($response.status -eq 422 -and $response.json.error.details[0].field -eq 'name')

  $response = TryReq 'PATCH' ('/api/v1/expenses/' + $eid) (@{ amountMinorUnits = -5 } | ConvertTo-Json) $session
  Check 'PATCH invalid value -> 422 + details' ($response.status -eq 422 -and $response.json.error.code -eq 'VALIDATION_ERROR')

  $r = TryReq 'GET' '/api/v1/expenses?startDate=not-a-date' $null $session
  Check 'bad startDate (query) -> 400 INVALID_QUERY' ($r.status -eq 400 -and $r.json.error.code -eq 'INVALID_QUERY')

  $r = TryReq 'GET' '/api/v1/expenses?minAmount=ninety' $null $session
  Check 'bad minAmount (query) -> 400 INVALID_QUERY' ($r.status -eq 400 -and $r.json.error.code -eq 'INVALID_QUERY' -and $r.json.error.message -match 'minAmount')

  $r = TryReq 'GET' '/api/v1/expenses?extra=unknown&limit=5' $null $session
  Check 'unknown extra query param tolerated' ($r.status -eq 200 -and $r.json.data.Count -eq 5)

  $r = TryReq 'GET' ('/api/v1/expenses/' + $eid) $null $session
  Check 'GET soft-deleted expense still -> 404' ($r.status -eq 404)
  }

  if ($RunBurst) {
    Write-Output "== Rate limiting burst =="
    $probe = TryReq 'GET' '/api/v1/expenses' $null $null
    $limitVal = 0
    if ($probe.headers['X-RateLimit-Limit']) { $limitVal = [int]$probe.headers['X-RateLimit-Limit'] }
    Check 'effective rate limit read from header' ($limitVal -ge 1)
    $saw429 = $false
    $retryAfter = ''
    $envelope = $false
    for ($i = 0; $i -le $limitVal; $i++) {
      $r = TryReq 'GET' '/api/v1/expenses' $null $null
      if ($r.status -eq 429) {
        $saw429 = $true
        $retryAfter = $r.headers['Retry-After']
        $envelope = ($r.json.error.code -eq 'RATE_LIMITED')
        break
      }
    }
    Check 'burst triggers 429 RATE_LIMITED' ($saw429 -and $envelope)
    Check '429 carries Retry-After >= 1 seconds' ($retryAfter -match '^\d+$' -and [int]$retryAfter -ge 1)
    Check '429 body is error envelope without data' ($r.json.data -eq $null -and $r.json.error.message -ne $null)
  }

} finally {
  Invoke-CleanupTestUsers
}

Write-Output ("=================================")
Write-Output ("TOTAL PASS=" + $pass + " FAIL=" + $fail)
if ($fail -gt 0) { exit 1 } else { exit 0 }