# money-lens

マネーフォワードのCSVをブラウザ内で分析する個人用ダッシュボードです。

## 開発

個人CSVは `csvs/` に置けますが、Gitには登録されません。

```powershell
python -m http.server 8765
```

ブラウザで <http://localhost:8765> を開きます。

ローカルチェック：

```powershell
npm run check
```

## 自動開発サイクル

`gh auth login` と OpenCode CLI の認証済み環境で、次のコマンドを実行すると、Issue選択（Issueがなければ発見した改善のIssue作成）、実装、PR作成、AIレビュー、チェック、マージを1サイクル実行できます。

```powershell
pwsh ./scripts/autodev.ps1
```

24時間連続で回す場合は次のコマンドを常駐プロセスとして実行します。停止は `Ctrl+C` です。

```powershell
pwsh ./scripts/autodev.ps1 -Continuous -IntervalMinutes 10
```

`-ReviewAttempts 2`（既定）回までAIレビューで修正を試みます。最後のレビューが合格でも修正を伴う場合は、ローカルチェックと公開後に変更禁止の確認レビューを1回追加します。解決できない指摘が残った場合や確認レビューでさらに変更された場合は、PRを開いたまま停止します。個人CSV、`csvs/`、秘密情報には触れません。GitHub側ではActionsの成功をマージ条件にし、必要に応じてブランチ保護や通知を設定してください。自動マージは強い権限を持つため、最初は単発実行で結果を確認してから連続運転してください。

停止したPRは、そのブランチ上で `pwsh ./scripts/autodev.ps1 -ResumePullRequest` を実行すると再開できます。ローカル変更をチェック・コミット・pushした後、既存PRのAIレビュー・CI確認・マージを行います。

## 開発方針

### 課題調査・一括登録

Issue一覧の取得と課題登録だけを行う場合は、次の専用モードを使います。

```powershell
pwsh ./scripts/autodev.ps1 -ListIssues
pwsh ./scripts/autodev.ps1 -IssueBatchPath ./artifacts/issues.json
```

一括登録ファイルは `[{"title":"課題名","body":"概要・根拠・完了条件"}]` 形式のUTF-8 JSONです。同名の既存Issue（closedを含む）はスキップし、途中失敗後も再実行できます。内容が重複する別タイトルのIssueは登録前に確認してください。このモードには認証済みGitHub CLIが必要です。

既存変更をPRにまとめてレビュー・チェック・マージする場合は、次の単発モードを使います。作業ツリーの変更全体が対象になるため、実行前に `git diff` と `git status` で公開内容を確認してください。既存Issueの自動選択やクローズは行いません。

```powershell
pwsh ./scripts/autodev.ps1 -PublishCurrentChanges -PublishTitle '調査結果と課題登録の整備' -PublishSummary '調査記録とIssue登録機能を追加します。'
```

調査記録: [2026-09-23のプロダクト課題](docs/product-audit-2026-09-23.md)。

`docs/` には公開可能な仕様・調査記録を保存してGitで管理します。個人情報や未公開メモは含めず、ローカルだけで残す調査素材はgitignore対象の `artifacts/` に保存してください。gitignoreは登録済みファイルや過去の履歴、公開済みIssueを非公開にはしません。

### 基本方針

- GitHub Issuesを課題管理に使う
- 個人データ・CSVは公開しない
- 変更前後にローカルチェックを実行する
- GitHub ActionsはチェックとGitHub Pagesデプロイの最小構成にする

## 公開デモ

GitHub Pages には `main` ブランチへの更新時に自動デプロイされます。公開先では個人CSVを読み込まず、匿名のデモデータを表示します。

リポジトリの **Settings → Pages** で Source を **GitHub Actions** に設定してください。公開後は次のURLでデモを確認できます（`<owner>` と `<repository>` は置き換えてください）。

<https://<owner>.github.io/<repository>/>
