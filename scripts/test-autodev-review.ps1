# 外部サービスや実リポジトリを変更せず、実際のレビューループを検証する。
$ErrorActionPreference = 'Stop'
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  (Join-Path $PSScriptRoot 'autodev.ps1'), [ref]$tokens, [ref]$parseErrors
)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$loop = $ast.Find({ param($node)
  $node -is [System.Management.Automation.Language.ForStatementAst] -and
  $node.Initializer.Extent.Text -eq '$reviewAttempt = 1'
}, $true)
if (-not $loop) { throw 'レビューループが見つかりません。' }
$reviewLoop = [scriptblock]::Create($loop.Extent.Text)

function git {
  $global:LASTEXITCODE = 0
  switch ($args[0]) {
    'rev-parse' { $script:head }
    'status' { if ($script:dirty) { ' M app.js' } }
    default { throw "想定外のgit操作: $args" }
  }
}
function npm {
  $script:checks++
  $global:LASTEXITCODE = $script:checkExitCode
}
function Publish-LocalChanges {
  param($Branch, $CommitMessage)
  $script:published++
  $script:dirty = $false
}
function Get-PullRequestHeadCommit {
  param($PullRequestNumber)
  $script:head
}
function Invoke-FakeReview {
  $step = $script:steps[$script:calls]
  if (-not $step) { throw 'レビュー回数が想定を超えました。' }
  if ($script:calls -ge $ReviewAttempts -and $args[1] -notlike '*Do not modify any files*') {
    throw '確認レビューに変更禁止の指示がありません。'
  }
  $script:calls++
  $script:dirty = [bool]$step.dirty
  if ($step.commit) { $script:head += 'x' }
  $global:LASTEXITCODE = if ($null -ne $step.exitCode) { [int]$step.exitCode } else { 0 }
  $step.result
}

$cases = @(
  @{ name = 'ANSI装飾付きで合格'; steps = @(@{ result = "$([char]27)[32mREVIEW_PASS$([char]27)[0m`n$([char]27)[0m" }); calls = 1; passed = $true; published = 1 },
  @{ name = 'ANSI装飾付きFAILも拒否'; steps = @(@{ result = "$([char]27)[31mREVIEW_FAIL$([char]27)[0m`nREVIEW_PASS" }, @{ result = 'REVIEW_FAIL' }); calls = 2; passed = $false; published = 1 },
  @{ name = '変更なしで合格'; steps = @(@{ result = 'REVIEW_PASS' }); calls = 1; passed = $true; published = 1 },
  @{ name = '途中PASSの後に最終FAIL'; steps = @(@{ result = "REVIEW_PASS`n指摘が残っています`nREVIEW_FAIL" }, @{ result = 'REVIEW_FAIL' }); calls = 2; passed = $false; published = 1 },
  @{ name = 'PASSの後に矛盾するFAIL'; steps = @(@{ result = "REVIEW_FAIL`nREVIEW_PASS" }, @{ result = 'REVIEW_FAIL' }); calls = 2; passed = $false; published = 1 },
  @{ name = 'マーカーなし'; steps = @(@{ result = '問題ありません。' }, @{ result = '問題ありません。' }); calls = 2; passed = $false; published = 1 },
  @{ name = '実行失敗'; steps = @(@{ result = 'REVIEW_PASS'; exitCode = 1 }, @{ result = 'REVIEW_PASS'; exitCode = 1 }); calls = 2; passed = $false; published = 1 },
  @{ name = '最終修正後の確認で合格'; steps = @(@{ result = 'REVIEW_PASS'; dirty = $true }, @{ result = 'REVIEW_PASS'; dirty = $true }, @{ result = 'REVIEW_PASS' }); calls = 3; passed = $true; published = 3 },
  @{ name = '確認レビューが不合格'; steps = @(@{ result = 'REVIEW_PASS'; dirty = $true }, @{ result = 'REVIEW_PASS'; dirty = $true }, @{ result = 'REVIEW_FAIL' }); calls = 3; passed = $false; published = 2 },
  @{ name = '確認レビューで再修正'; steps = @(@{ result = 'REVIEW_PASS'; dirty = $true }, @{ result = 'REVIEW_PASS'; dirty = $true }, @{ result = 'REVIEW_PASS'; dirty = $true }); calls = 3; passed = $false; published = 2; error = '最終確認レビューで変更*' },
  @{ name = 'レビュー中のコミットも再確認'; steps = @(@{ result = 'REVIEW_PASS'; commit = $true }, @{ result = 'REVIEW_PASS' }); calls = 2; passed = $true; published = 2 },
  @{ name = '修正チェック失敗では公開しない'; steps = @(@{ result = 'REVIEW_PASS'; dirty = $true }); calls = 1; passed = $false; published = 0; checkExitCode = 1; error = 'レビュー修正後のローカルチェック*' }
)
foreach ($case in $cases) {
  $script:steps = $case.steps
  $script:calls = $script:published = $script:checks = 0
  $script:checkExitCode = [int]$case.checkExitCode
  $script:dirty = $false
  $script:head = 'initial'
  $command = 'Invoke-FakeReview'
  $ReviewAttempts = $reviewLimit = 2
  $reviewPassed = $false
  $reviewPrompt = @('Fix any concrete problems.', 'Finish with REVIEW_PASS or REVIEW_FAIL.')
  $repo = 'test/repo'
  $prNumber = 1
  $branch = 'test'
  $caught = $null
  try { . $reviewLoop } catch { $caught = $_.Exception.Message }
  if (($case.error -and $caught -notlike $case.error) -or (-not $case.error -and $caught) -or
      $script:calls -ne $case.calls -or $reviewPassed -ne $case.passed -or $script:published -ne $case.published) {
    throw "$($case.name): calls=$script:calls passed=$reviewPassed published=$script:published error=$caught"
  }
  Write-Host "成功: $($case.name)"
}
