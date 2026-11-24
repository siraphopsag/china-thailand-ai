# C.A.L.L. - weekly refresh of the Thai market figures (owner, 24 Nov 2026: "set it up").
# Runs once a week on the owner PC (Windows Task Scheduler, task "CALL market data weekly"). It reads the open sources again
# (scripts/market-snapshot.ts) and leaves changed figures in src/data/marketSnapshot.json. It never commits or pushes.
# Log: %LOCALAPPDATA%\CALL-market\refresh.log.
param([string]$Repo = 'C:\Users\Boss Siraphop\call-poc-jobboard', [string]$Branch = 'poc/board')
$ErrorActionPreference = 'Continue'
$logDir = Join-Path $env:LOCALAPPDATA 'CALL-market'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir 'refresh.log'
function Write-Log($m) { "$(Get-Date -Format s)  $m" | Out-File -Append -Encoding utf8 $log }
function Invoke-Quiet($cmd) { cmd /c "$cmd >> `"$log`" 2>&1"; return $LASTEXITCODE }

Set-Location $Repo
$cur = (git rev-parse --abbrev-ref HEAD).Trim()
if ($cur -ne $Branch) { Write-Log "skipped: the folder is on branch $cur, not $Branch"; exit 0 }

if ((Invoke-Quiet 'npx.cmd tsx scripts/market-snapshot.ts') -ne 0) { Write-Log 'a source did not answer; nothing changed'; exit 0 }

$changed = git diff -U0 -- src/data/marketSnapshot.json | Where-Object { $_ -match '^[+-](?![+-])' -and $_ -notmatch 'checkedAt' }
if (-not $changed) { git checkout -- src/data/marketSnapshot.json; Write-Log 'checked: no new figures'; exit 0 }

# Never commits or pushes: the owner approved refreshing the figures only. The changed file waits for the next reviewed commit.
Write-Log "new figures saved in src/data/marketSnapshot.json; not committed or pushed"
