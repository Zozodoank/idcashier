# Apply migrations/015_add_trial_granted_at.sql + deploy the Edge Functions touched by
# the free-trial remediation. Idempotent: safe to re-run.
# Prints only non-sensitive status; never echoes secret values.
param([ValidateSet('audit', 'all')][string]$Mode = 'all')

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$projectRef = 'eypfeiqtvfxxiimhtycc'
$apiBase = "https://api.supabase.com/v1/projects/$projectRef"

# --- credentials from workspace 'env' (names only are printed later) ---
$cfg = @{}
foreach ($line in Get-Content -LiteralPath (Join-Path $root 'env')) {
    $t = $line.Trim()
    if ($t -eq '' -or $t.StartsWith('#')) { continue }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { continue }
    $k = $t.Substring(0, $i).Trim()
    $v = $t.Substring($i + 1).Trim()
    if ($v.Length -ge 2 -and (($v[0] -eq '"' -and $v[$v.Length - 1] -eq '"') -or ($v[0] -eq "'" -and $v[$v.Length - 1] -eq "'"))) {
        $v = $v.Substring(1, $v.Length - 2)
    }
    $cfg[$k] = $v
}
$token = $cfg['SUPABASE_ACCESS_TOKEN']
if (-not $token) { Write-Error 'Missing SUPABASE_ACCESS_TOKEN in env'; exit 1 }
$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }

function Invoke-Sql([string]$sql) {
    $body = ConvertTo-Json -Depth 5 -Compress -InputObject @{ query = $sql }
    return Invoke-RestMethod -Uri "$apiBase/database/query" -Headers $headers -Method Post -Body $body -UseBasicParsing
}

Write-Host '=== 1. AUDIT (baseline) ===' -ForegroundColor Cyan
$auditSql = @'
select
  (select count(*) from public.users) as users_total,
  (select count(*) from public.users u where exists (select 1 from public.subscriptions s where s.user_id = u.id)) as users_with_subs,
  (select count(*) from (select user_id from public.subscriptions group by user_id having count(*) > 1) d) as dup_users,
  (select count(*) from public.subscriptions) as subs_total,
  (select count(*) from public.subscriptions where plan_name = 'trial') as trial_rows,
  (select count(*) from public.payments where status = 'completed') as paid_rows
'@
$audit = Invoke-Sql $auditSql
$audit | Format-List
if ($Mode -eq 'audit') { Write-Host 'Audit-only mode, stopping.' -ForegroundColor Yellow; exit 0 }

Write-Host '=== 2. APPLY migrations/015_add_trial_granted_at.sql ===' -ForegroundColor Cyan
$migrationPath = Join-Path $root 'migrations\015_add_trial_granted_at.sql'
$migrationSql = Get-Content -LiteralPath $migrationPath -Raw
Invoke-Sql $migrationSql | Out-Null
Write-Host 'Migration executed.'

Write-Host '=== 3. VERIFY MIGRATION ===' -ForegroundColor Cyan
$verifySql = @'
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'users' and column_name = 'trial_granted_at') as column_exists,
  (select count(*) from pg_indexes
     where schemaname = 'public' and indexname = 'idx_users_trial_granted_at') as index_exists,
  (select count(*) from public.users u
     where u.trial_granted_at is null
       and exists (select 1 from public.subscriptions s where s.user_id = u.id)) as backfill_remaining,
  (select count(*) from public.users where trial_granted_at is not null) as granted_rows
'@
Invoke-Sql $verifySql | Format-List

Write-Host '=== 4. CURRENT EDGE FUNCTION SETTINGS ===' -ForegroundColor Cyan
$functions = Invoke-RestMethod -Uri "$apiBase/functions" -Headers $headers -Method Get -UseBasicParsing
$targets = @('auth-register', 'auth-login-final', 'subscriptions-get-current-user')
$before = @{}
foreach ($slug in $targets) {
    $fn = $functions | Where-Object { $_.slug -eq $slug }
    if (-not $fn) { Write-Error "Function not found: $slug"; exit 1 }
    $before[$slug] = [pscustomobject]@{ version = $fn.version; verify_jwt = $fn.verify_jwt }
    Write-Host ("  {0,-32} v{1}  verify_jwt={2}" -f $slug, $fn.version, $fn.verify_jwt)
}

Write-Host '=== 5. DEPLOY EDGE FUNCTIONS ===' -ForegroundColor Cyan
$env:SUPABASE_ACCESS_TOKEN = $token
$cli = Join-Path $root 'node_modules\.bin\supabase.cmd'
$logPath = Join-Path $root '.tmp_fn_deploy.log'
$prevEap = $ErrorActionPreference
# CLI writes warnings to stderr; keep them from being treated as terminating errors.
$ErrorActionPreference = 'Continue'
foreach ($slug in $targets) {
    $args = @('functions', 'deploy', $slug, '--project-ref', $projectRef, '--use-api')
    if ($before[$slug].verify_jwt -eq $false) { $args += '--no-verify-jwt' }
    Write-Host ("`n--- deploying {0} ({1}) ---" -f $slug, ($args -join ' '))
    & $cli @args *> $logPath
    $code = $LASTEXITCODE
    Get-Content -LiteralPath $logPath | ForEach-Object { Write-Host "    $_" }
    if ($code -ne 0) { $ErrorActionPreference = $prevEap; Write-Error "Deploy failed for $slug (exit $code)"; exit 2 }
}
$ErrorActionPreference = $prevEap

Write-Host "`n=== 6. VERIFY DEPLOYMENT ===" -ForegroundColor Cyan
$after = Invoke-RestMethod -Uri "$apiBase/functions" -Headers $headers -Method Get -UseBasicParsing
foreach ($slug in $targets) {
    $fn = $after | Where-Object { $_.slug -eq $slug }
    Write-Host ("  {0,-32} v{1} -> v{2}  verify_jwt={3}  status={4}" -f $slug, $before[$slug].version, $fn.version, $fn.verify_jwt, $fn.status)
}
Write-Host 'Done.' -ForegroundColor Green
