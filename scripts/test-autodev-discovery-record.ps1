$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  (Join-Path $PSScriptRoot 'autodev.ps1'), [ref]$tokens, [ref]$errors
)
if ($errors.Count) { throw ($errors | Out-String) }

$source = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'autodev.ps1') -Raw -Encoding utf8
foreach ($required in @(
  '.autodev-discovery.json',
  '実装前の問題',
  '根拠',
  '完了条件',
  '検証結果',
  '関連Issue',
  'issue create --repo $repo --title $prTitle --body $discoveryBody'
)) {
  if (-not $source.Contains($required)) { throw "Discovery record requirement is missing: $required" }
}
if ($source.Contains("'自動検出した改善'")) { throw 'Generic discovery title must not be used.' }
Write-Host 'Passed: structured discovery Issue and PR record requirements'
