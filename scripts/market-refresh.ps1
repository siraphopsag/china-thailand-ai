# C.A.L.L. - weekly refresh of the Thai market figures (owner, 24 Nov 2026: "set it up").
# data.go.th turns away requests from cloud servers, so this runs on the owner's PC in Thailand once a week (Windows Task
# Scheduler, task "CALL market data weekly"). It reads the open sources again (scripts/market-snapshot.ts) and, only when the
# figures changed (not just the date checked), commits src/data/marketSnapshot.json alone and pushes it, so Vercel rebuilds.
# Log: %LOCALAPPDATA%\CALL-market\refresh.log. When the site moves to main, change -Branch in the task.
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

$msgFile = Join-Path $logDir 'commit-message.txt'
"Market data: new figures from the weekly refresh`n`nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" | Out-File -Encoding ascii $msgFile
if ((Invoke-Quiet "git -c user.name=siraphopsag -c user.email=siraphop.sag@spumail.net commit -F `"$msgFile`" -- src/data/marketSnapshot.json") -ne 0) { Write-Log 'commit failed'; exit 1 }
if ((Invoke-Quiet "git push origin $Branch") -ne 0) { Write-Log 'push failed (the commit stays on this PC; it goes up with the next push)'; exit 1 }
Write-Log 'new figures saved and pushed'
