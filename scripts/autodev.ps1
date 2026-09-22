param(
  [ValidateRange(1, 10)]
  [int]$Cycles = 1
)

$prompt = @"
このリポジトリの自動開発を1サイクル実行してください。

ルール:
1. GitHub Issuesの未完了Issueを確認し、最も小さく価値のある1件だけ選ぶ。ghコマンドが使えなければ、既存コードを調査して改善候補を提案する。
2. 個人CSV、csvs/の内容、秘密情報を読んだり変更したりしない。
3. 変更範囲を選んだIssueに限定する。
4. npm run check をローカルで実行し、通らなければ修正してから先へ進む。
5. チェックが通った場合だけ、変更履歴をCHANGELOG.mdに追記し、git diffを確認する。
6. git commitは変更が安全で、Issueに対応できた場合だけ行う。コミットメッセージは短くする。
7. push、Issueのclose、公開設定の変更は自動で行わず、最後に提案として報告する。
8. 最後に実施内容、テスト結果、次の候補を短く報告する。
"@

for ($i = 1; $i -le $Cycles; $i++) {
  Write-Host "=== Auto-dev cycle $i/$Cycles ===" -ForegroundColor Cyan
  opencode run $prompt
  if ($LASTEXITCODE -ne 0) {
    throw "OpenCode exited with code $LASTEXITCODE"
  }
}
