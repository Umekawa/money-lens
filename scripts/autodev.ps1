param(
  [ValidateRange(1, 10)]
  [int]$Cycles = 1,
  [string]$OpenCodeBin = $env:OPENCODE_BIN
)

$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$command = if ($OpenCodeBin) { $OpenCodeBin } else { (Get-Command opencode -ErrorAction SilentlyContinue).Source }
if (-not $command) {
  throw "OpenCode CLI was not found. Install the CLI or set OPENCODE_BIN to its executable path."
}

$ghCommand = (Get-Command gh -ErrorAction SilentlyContinue).Source
if (-not $ghCommand -and (Test-Path 'C:\Program Files\GitHub CLI\gh.exe')) {
  $ghCommand = 'C:\Program Files\GitHub CLI\gh.exe'
}
if (-not $ghCommand) {
  throw 'GitHub CLI was not found. Install gh and run gh auth login before using autodev.'
}

$promptBase = @(
  'Run one autonomous development cycle for this repository.',
  'Work only on the selected issue or one small, clearly useful self-discovered improvement.',
  'Never read or modify personal CSV files, the csvs directory, or secrets.',
  'Run npm run check locally and fix failures before finishing.',
  'Update CHANGELOG.md after the check passes.',
  'Do not commit, push, create PRs, merge, close Issues, or change repository visibility. The wrapper script handles Git operations.',
  'Report the work done, test result, and any concerns briefly.'
)

for ($i = 1; $i -le $Cycles; $i++) {
  Write-Host "=== Auto-dev cycle $i/$Cycles ===" -ForegroundColor Cyan

  if ((git status --porcelain).Length -gt 0) { throw 'Working tree is not clean. Review or commit existing changes first.' }
  git switch main
  if ($LASTEXITCODE -ne 0) { throw 'Could not switch to main.' }
  git pull --ff-only origin main
  if ($LASTEXITCODE -ne 0) { throw 'Could not fast-forward main.' }

  $issue = $null
  $issueJson = & $ghCommand issue list --repo Umekawa/money-lens --state open --limit 20 --json number,title
  if ($LASTEXITCODE -eq 0 -and $issueJson) { $issue = ($issueJson | ConvertFrom-Json | Select-Object -First 1) }
  $issueInstruction = if ($issue) {
    "Work on GitHub Issue #$($issue.number): $($issue.title)."
  } else {
    'There are no open Issues. Find one small improvement from the UI or code and implement it.'
  }

  $branch = "autodev/$((Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss'))"
  git switch -c $branch
  if ($LASTEXITCODE -ne 0) { throw "Could not create branch $branch." }

  $prompt = (@($promptBase) + $issueInstruction) -join [Environment]::NewLine
  & $command run $prompt
  if ($LASTEXITCODE -ne 0) { throw "OpenCode exited with code $LASTEXITCODE" }

  npm run check
  if ($LASTEXITCODE -ne 0) { throw 'Local check failed. The branch was left for investigation.' }

  if ((git status --porcelain).Length -gt 0) {
    git add -A
    git commit -m 'feat: improve money-lens'
    if ($LASTEXITCODE -ne 0) { throw 'Could not commit changes.' }
  }

  $ahead = [int](git rev-list --count "origin/main..HEAD")
  if ($ahead -eq 0) {
    Write-Host 'No changes were produced; skipping PR.' -ForegroundColor Yellow
    git switch main
    continue
  }

  git push -u origin $branch
  if ($LASTEXITCODE -ne 0) { throw 'Could not push the development branch.' }

  $bodyLines = @(
    '## Summary',
    'Implemented by the autonomous development cycle.'
  )
  if ($issue) { $bodyLines += "Closes #$($issue.number)" }
  $bodyLines += @(
    '',
    '## Verification',
    '- npm run check passed locally',
    '- No personal CSV or account data was committed'
  )
  $body = $bodyLines -join [Environment]::NewLine
  $prTitle = if ($issue) { "Fix: $($issue.title)" } else { 'Autonomous improvement' }
  $prUrl = & $ghCommand pr create --repo Umekawa/money-lens --base main --head $branch --title $prTitle --body $body
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the pull request.' }
  $prNumber = [regex]::Match(($prUrl -join "`n"), '/pull/(\d+)').Groups[1].Value
  if (-not $prNumber) { throw 'Could not determine the pull request number.' }

  & $ghCommand pr checks $prNumber --repo Umekawa/money-lens --watch --interval 5
  if ($LASTEXITCODE -ne 0) { throw "Pull request checks failed for #$prNumber." }
  & $ghCommand pr merge $prNumber --repo Umekawa/money-lens --squash --delete-branch --subject $prTitle --body 'Implemented by autonomous development. Local checks and GitHub Actions passed.'
  if ($LASTEXITCODE -ne 0) { throw "Could not merge pull request #$prNumber." }

  git switch main
  git pull --ff-only origin main
  Write-Host "Merged PR #$prNumber" -ForegroundColor Green
}
