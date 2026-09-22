param(
  [ValidateRange(1, 10)]
  [int]$Cycles = 1,
  [string]$OpenCodeBin = $env:OPENCODE_BIN
)

$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$command = if ($OpenCodeBin) { $OpenCodeBin } else { (Get-Command opencode -ErrorAction SilentlyContinue).Source }
if (-not $command) {
  throw "OpenCode CLI was not found. Install the CLI or set OPENCODE_BIN to its executable path. Example: `$env:OPENCODE_BIN = 'C:\path\to\opencode.exe'"
}

$ghInstruction = if (Get-Command gh -ErrorAction SilentlyContinue) {
  'GitHub CLI is available. You may use gh issue list to inspect Issues, but do not push, close Issues, or change visibility.'
} else {
  'GitHub CLI is unavailable. Do not run gh commands. Inspect the local code and choose one improvement instead.'
}

$prompt = @(
  'Run one autonomous development cycle for this repository.',
  "1. $ghInstruction If there are no open Issues, inspect the UI and code and choose one small, clearly useful self-discovered improvement instead of stopping.",
  '2. Never read or modify personal CSV files, the csvs directory, or secrets.',
  '3. Keep the change limited to the selected issue or self-discovered improvement.',
  '4. Run npm run check locally. Fix failures before continuing.',
  '5. Only after checks pass, update CHANGELOG.md and inspect git diff. Record self-discovered improvements there too.',
  '6. Commit only safe, issue-related or self-discovered improvement changes. Use a short commit message.',
  '7. Do not run gh commands other than gh issue list. Never push, close Issues, or change repository visibility automatically. Report those as suggestions only.',
  '8. Report the work done, test result, and next candidate briefly.'
) -join [Environment]::NewLine

for ($i = 1; $i -le $Cycles; $i++) {
  Write-Host "=== Auto-dev cycle $i/$Cycles ===" -ForegroundColor Cyan
  & $command run $prompt
  if ($LASTEXITCODE -ne 0) {
    throw "OpenCode exited with code $LASTEXITCODE"
  }
}
