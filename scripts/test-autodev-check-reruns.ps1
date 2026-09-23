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
  $latest = if ($script:pending -and $script:waits -lt $script:successAfter) { 'in_progress' } else { 'completed' }
    @{ check_runs = @(
      @{ id = 30; name = 'check'; app = @{ id = 2 }; status = 'completed'; conclusion = 'failure' },
      @{ id = 20; name = 'check'; app = @{ id = 1 }; status = $(if ($script:queued -and $latest -eq 'in_progress') { 'queued' } else { $latest }); conclusion = $script:conclusion },
      @{ id = 10; name = 'check'; app = @{ id = 1 }; status = 'completed'; conclusion = $script:oldConclusion }
    ) } | ConvertTo-Json -Depth 6 -Compress
  }
}
$ghCommand = 'Invoke-FakeGh'
$repo = 'test/repo'
foreach ($case in @(
  @{ name = 'ignore-old-and-other-provider-failures'; old = 'failure'; latest = 'success' },
  @{ name = 'latest-failure-must-fail'; old = 'success'; latest = 'failure'; fails = $true },
  @{ name = 'wait-for-rerun'; old = 'failure'; latest = 'success'; pending = $true; successAfter = 1 },
  @{ name = 'wait-over-60-seconds'; old = 'failure'; latest = 'success'; pending = $true; successAfter = 13 },
  @{ name = 'wait-for-queue'; old = 'failure'; latest = 'success'; pending = $true; queued = $true; successAfter = 2 },
  @{ name = 'timeout-with-resume-guidance'; old = 'failure'; latest = 'success'; pending = $true; successAfter = 100; timeout = 1; fails = $true }
)) {
  $script:oldConclusion = $case.old
  $script:conclusion = $case.latest
  $script:pending = $case.pending
  $script:queued = $case.queued
  $script:successAfter = if ($null -ne $case.successAfter) { $case.successAfter } else { 0 }
  $script:waits = 0
  $caught = $null
  try { Assert-RequiredChecksPassed -PullRequestNumber 1 -ExpectedHead 'head' -CheckTimeoutMinutes $(if ($case.timeout) { $case.timeout } else { 30 }) } catch { $caught = $_.Exception.Message }
  if (($case.fails -and -not $caught) -or
      (-not $case.fails -and $caught) -or ($case.name -eq 'wait-for-rerun' -and $script:waits -ne 1) -or
      ($case.name -eq 'wait-over-60-seconds' -and $script:waits -ne 13) -or
      ($case.name -eq 'timeout-with-resume-guidance' -and ($script:waits -ne 11 -or $caught -notmatch 'ResumePullRequest'))) {
    throw "$($case.name): error=$caught waits=$script:waits"
  }
  Write-Host "成功: $($case.name)"
}
