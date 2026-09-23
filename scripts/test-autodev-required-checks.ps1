$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  (Join-Path $PSScriptRoot 'autodev.ps1'), [ref]$tokens, [ref]$errors
)
if ($errors.Count) { throw ($errors | Out-String) }
$definition = $ast.Find({ param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-RequiredCheckNames'
}, $true)
. ([scriptblock]::Create($definition.Extent.Text))
function Invoke-FakeGh {
  $global:LASTEXITCODE = $script:exitCode
  $script:response
}
$ghCommand = 'Invoke-FakeGh'
$repo = 'test/repo'
$cases = @(
  @{ name = '単一チェック'; json = '["check"]'; expected = 'check' },
  @{ name = '複数チェックと明示指定の結合'; json = '["check","lint"]'; explicit = @('check','audit'); expected = 'check,lint,audit' },
  @{ name = 'オブジェクト形式'; json = '{"contexts":["check"]}'; expected = 'check' },
  @{ name = 'API失敗時の明示指定'; code = 1; explicit = @('check'); expected = 'check' },
  @{ name = 'API失敗時に指定なし'; code = 1; error = '*取得できません*' },
  @{ name = 'API失敗時に空白指定'; code = 1; explicit = @(' '); error = '*取得できません*' },
  @{ name = '必須チェックなし'; json = '[]'; error = '*登録されていません*' },
  @{ name = '設定なしでも明示指定を検証'; json = '[]'; explicit = @('check'); expected = 'check' }
)
foreach ($case in $cases) {
  $script:exitCode = [int]$case.code
  $script:response = $case.json
  $RequiredChecks = @($case.explicit | Where-Object { $null -ne $_ })
  $caught = $null
  $actual = @()
  try { $actual = @(Get-RequiredCheckNames) } catch { $caught = $_.Exception.Message }
  if (($case.error -and $caught -notlike $case.error) -or
      (-not $case.error -and ($caught -or ($actual -join ',') -ne $case.expected))) {
    throw "$($case.name): actual=$($actual -join ',') error=$caught"
  }
  Write-Host "成功: $($case.name)"
}
