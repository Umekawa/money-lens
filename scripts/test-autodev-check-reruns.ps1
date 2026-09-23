$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  (Join-Path $PSScriptRoot 'autodev.ps1'), [ref]$tokens, [ref]$errors
)
if ($errors.Count) { throw ($errors | Out-String) }
$definition = $ast.Find({ param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-RequiredChecksPassed'
}, $true)
. ([scriptblock]::Create($definition.Extent.Text))
function Get-RequiredCheckNames {
  $script:RequiredCheckProviders = @([pscustomobject]@{ Name = 'check'; AppId = 1 })
  'check'
}
function Get-PullRequestHeadCommit { 'head' }
function Start-Sleep { $script:waits++ }
function Invoke-FakeGh {
  $global:LASTEXITCODE = 0
  if ($args[0] -eq 'pr') {
    $global:LASTEXITCODE = 8
    '[{"name":"check","state":"FAILURE"}]'
  } else {
    $latest = if ($script:pending -and $script:waits -eq 0) { 'in_progress' } else { 'completed' }
    @{ check_runs = @(
      @{ id = 30; name = 'check'; app = @{ id = 2 }; status = 'completed'; conclusion = 'failure' },
      @{ id = 20; name = 'check'; app = @{ id = 1 }; status = $latest; conclusion = $script:conclusion },
      @{ id = 10; name = 'check'; app = @{ id = 1 }; status = 'completed'; conclusion = $script:oldConclusion }
    ) } | ConvertTo-Json -Depth 6 -Compress
  }
}
$ghCommand = 'Invoke-FakeGh'
$repo = 'test/repo'
foreach ($case in @(
  @{ name = '過去の失敗と別提供元の失敗を除外'; old = 'failure'; latest = 'success' },
  @{ name = '過去の成功で最新の失敗を隠さない'; old = 'success'; latest = 'failure'; fails = $true },
  @{ name = '再実行中は過去の失敗で停止せず待つ'; old = 'failure'; latest = 'success'; pending = $true }
)) {
  $script:oldConclusion = $case.old
  $script:conclusion = $case.latest
  $script:pending = $case.pending
  $script:waits = 0
  $caught = $null
  try { Assert-RequiredChecksPassed -PullRequestNumber 1 -ExpectedHead 'head' } catch { $caught = $_.Exception.Message }
  if (($case.fails -and $caught -notlike '必須チェックが成功していません*') -or
      (-not $case.fails -and $caught) -or ($case.pending -and $script:waits -ne 1)) {
    throw "$($case.name): error=$caught waits=$script:waits"
  }
  Write-Host "成功: $($case.name)"
}
