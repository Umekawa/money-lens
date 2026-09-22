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
  $issueLines = & $ghCommand issue list --repo Umekawa/money-lens --state open --limit 20 --json number,title --jq '.[] | "\(.number)\t\(.title)"'
  if ($LASTEXITCODE -eq 0 -and $issueLines) {
    $issues = @($issueLines | ForEach-Object {
      $parts = $_ -split "`t", 2
      if ($parts.Count -eq 2) {
        [pscustomobject]@{ number = [int]$parts[0]; title = $parts[1] }
      }
    } | Sort-Object number)
    if ($issues.Count -gt 0) { $issue = $issues[0] }
  }
  $issueInstruction = if ($issue) {
    "You MUST work only on GitHub Issue #$($issue.number): $($issue.title). Do not select a different Issue."
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
    $commitMessage = if ($issue) { "対応: $($issue.title)" } else { '自動開発: 改善を実装' }
    git commit -m $commitMessage
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
    '## 概要',
    '自動開発サイクルで実装した変更です。'
  )
  if ($issue) { $bodyLines += "Closes #$($issue.number)" }
  $bodyLines += @(
    '',
    '## 確認内容',
    '- ローカルで npm run check が成功',
    '- 個人CSVや個人情報はコミットしていません'
  )
  $body = $bodyLines -join [Environment]::NewLine
  $prTitle = if ($issue) { "対応: $($issue.title)" } else { '自動検出した改善' }
  $prUrl = & $ghCommand pr create --repo Umekawa/money-lens --base main --head $branch --title $prTitle --body $body
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the pull request.' }
  $prNumber = [regex]::Match(($prUrl -join "`n"), '/pull/(\d+)').Groups[1].Value
  if (-not $prNumber) { throw 'Could not determine the pull request number.' }

  $checksReady = $false
  for ($attempt = 1; $attempt -le 12; $attempt++) {
    $checkJson = & $ghCommand pr view $prNumber --repo Umekawa/money-lens --json statusCheckRollup
    if ($LASTEXITCODE -eq 0 -and $checkJson) {
      $checkData = $checkJson | ConvertFrom-Json
      if (@($checkData.statusCheckRollup).Count -gt 0) { $checksReady = $true; break }
    }
    Write-Host 'GitHub Actionsのチェック登録を待っています...' -ForegroundColor Yellow
    Start-Sleep -Seconds 5
  }
  if (-not $checksReady) { throw "No checks were registered for pull request #$prNumber." }
  & $ghCommand pr checks $prNumber --repo Umekawa/money-lens --watch --interval 5
  if ($LASTEXITCODE -ne 0) { throw "Pull request checks failed for #$prNumber." }
  & $ghCommand pr merge $prNumber --repo Umekawa/money-lens --squash --delete-branch --subject $prTitle --body '自動開発サイクルで実装。ローカルチェックとGitHub Actionsを通過。'
  if ($LASTEXITCODE -ne 0) { throw "Could not merge pull request #$prNumber." }

  git switch main
  git pull --ff-only origin main
  Write-Host "Merged PR #$prNumber" -ForegroundColor Green
}
