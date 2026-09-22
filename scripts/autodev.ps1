param(
  [ValidateRange(1, 10)]
  [int]$Cycles = 1
)

$prompt = @(
  'Run one autonomous development cycle for this repository.',
  '1. Inspect open GitHub Issues and select exactly one small, valuable issue. If gh is unavailable, inspect the code and propose one improvement.',
  '2. Never read or modify personal CSV files, the csvs directory, or secrets.',
  '3. Keep the change limited to the selected issue.',
  '4. Run npm run check locally. Fix failures before continuing.',
  '5. Only after checks pass, update CHANGELOG.md and inspect git diff.',
  '6. Commit only safe, issue-related changes. Use a short commit message.',
  '7. Never push, close Issues, or change repository visibility automatically. Report those as suggestions only.',
  '8. Report the work done, test result, and next candidate briefly.'
) -join [Environment]::NewLine

for ($i = 1; $i -le $Cycles; $i++) {
  Write-Host "=== Auto-dev cycle $i/$Cycles ===" -ForegroundColor Cyan
  opencode run $prompt
  if ($LASTEXITCODE -ne 0) {
    throw "OpenCode exited with code $LASTEXITCODE"
  }
}
