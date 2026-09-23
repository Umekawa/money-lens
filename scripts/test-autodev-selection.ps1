$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  (Join-Path $PSScriptRoot 'autodev.ps1'), [ref]$tokens, [ref]$errors
)
if ($errors.Count) { throw ($errors | Out-String) }

$priorityDefinition = $ast.Find({ param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-IssuePriority'
}, $true)
$selectionDefinition = $ast.Find({ param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-SelectedIssue'
}, $true)
if (-not $priorityDefinition -or -not $selectionDefinition) { throw 'Issue selection functions were not found.' }
. ([scriptblock]::Create($priorityDefinition.Extent.Text))
. ([scriptblock]::Create($selectionDefinition.Extent.Text))

function Invoke-FakeGh {
  $global:LASTEXITCODE = 0
  if ($args -contains 'issue' -and $args -contains 'view') {
    if ($script:issueState -ne 'OPEN') { $global:LASTEXITCODE = 1 }
    $numberIndex = [array]::IndexOf($args, 'view') + 1
    return (@{ number = [int]$args[$numberIndex]; title = 'Synthetic issue'; body = 'Synthetic requirements'; state = $script:issueState; labels = @() } | ConvertTo-Json -Compress)
  }
  if ($args -contains 'api') { return $script:issuePages }
  throw "Unexpected mocked GitHub command: $args"
}

$script:ghCommand = 'Invoke-FakeGh'
$script:repo = 'synthetic/repository'
$script:issueState = 'OPEN'
$script:issuePages = @'
[{"number":9,"title":"[P2] later","labels":[]},{"number":8,"title":"[P1] priority","labels":[]},{"number":2,"title":"[P2] lower number","labels":[]},{"number":1,"title":"PR","pull_request":{}}]
'@
$issues = @(Get-SelectedIssue)
if ($issues.Count -ne 1 -or $issues[0].number -ne 8) { throw "Issue priority selection failed: count=$($issues.Count), numbers=$($issues.number -join ',')" }
$script:issuePages = '[{"number":9,"title":"[P2] later","labels":[]},{"number":2,"title":"[P2] lower number","labels":[]},{"number":1,"title":"PR","pull_request":{}}]'
$issues = @(Get-SelectedIssue)
if ($issues.Count -ne 1 -or $issues[0].number -ne 2) { throw 'Issue number tie-break or pull-request exclusion failed.' }
$selected = Get-SelectedIssue -Number 42
foreach ($json in @(
  '[[{"number":9,"title":"[P2] later","labels":[]},{"number":1,"title":"PR","pull_request":{"url":"synthetic"}}],[{"number":8,"title":"[P1] priority","labels":[]}]]',
  '[[{"number":8,"title":"[P1] priority","labels":[]},{"number":1,"title":"PR","pull_request":{"url":"synthetic"}}]]'
)) {
  $script:issuePages = $json
  $issues = @(Get-SelectedIssue)
  if ($issues.Count -ne 1 -or $issues[0].number -ne 8) { throw 'Paginated Issue selection failed: a page containing a PR must not hide Issues.' }
}
if ($selected.number -ne 42) { throw 'Explicit Issue selection failed.' }
$script:issueState = 'CLOSED'
$caught = $null
try { Get-SelectedIssue -Number 42 | Out-Null } catch { $caught = $_.Exception.Message }
if (-not $caught) { throw 'A closed explicitly selected Issue was accepted.' }

$safeTest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'test-autodev-safe-changes.ps1') -Raw
if (-not $safeTest.Contains("'?? pages-dist/app.js'")) {
  # The public build is an output directory, not a protected personal-data path;
  # verify the actual safe-change classifier accepts ordinary generated targets.
  $safeDefinition = $ast.Find({ param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-SafeChanges'
  }, $true)
  . ([scriptblock]::Create($safeDefinition.Extent.Text))
  function git { $global:LASTEXITCODE = 0; ' M pages-dist/app.js' }
  Assert-SafeChanges
}
Write-Host 'Passed: PowerShell syntax, Issue selection, and public target exclusion'
