$ErrorActionPreference = 'Stop'
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  (Join-Path $PSScriptRoot 'autodev.ps1'), [ref]$tokens, [ref]$parseErrors
)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$definition = $ast.Find({ param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-SafeChanges'
}, $true)
if (-not $definition) { throw 'Assert-SafeChanges not found.' }
. ([scriptblock]::Create($definition.Extent.Text))

function git {
  $global:LASTEXITCODE = 0
  $script:status
}

$cases = @(
  @{ name = 'untracked manifest'; status = '?? csv-manifest.json'; rejected = $true },
  @{ name = 'modified manifest'; status = ' M csv-manifest.json'; rejected = $true },
  @{ name = 'staged manifest'; status = 'A  csv-manifest.json'; rejected = $true },
  @{ name = 'nested manifest'; status = 'A  private/csv-manifest.json'; rejected = $true },
  @{ name = 'anonymous template'; status = '?? csv-manifest.example.json'; rejected = $false },
  @{ name = 'ordinary change'; status = ' M README.md'; rejected = $false }
)
foreach ($case in $cases) {
  $script:status = $case.status
  $caught = $null
  try { Assert-SafeChanges } catch { $caught = $_.Exception.Message }
  if ($case.rejected -ne [bool]$caught) {
    throw "$($case.name): rejected=$([bool]$caught) error=$caught"
  }
  Write-Host "Passed: $($case.name)"
}
