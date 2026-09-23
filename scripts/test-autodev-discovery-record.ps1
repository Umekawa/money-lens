$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  (Join-Path $PSScriptRoot 'autodev.ps1'), [ref]$tokens, [ref]$errors
)
if ($errors.Count) { throw ($errors | Out-String) }

$source = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'autodev.ps1') -Raw -Encoding utf8).Replace("`r`n", "`n")
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
$checkPosition = $source.IndexOf("npm run check`n  if (`$LASTEXITCODE -ne 0) { throw 'Local check failed. The branch was left for investigation.' }")
$removePosition = $source.IndexOf('if ($discoveryPath) { Remove-Item -LiteralPath $discoveryPath -Force }')
if ($checkPosition -lt 0 -or $removePosition -lt $checkPosition) {
  throw 'Discovery record must be preserved until the local check passes.'
}
Write-Host 'Passed: structured discovery Issue and PR record requirements'
