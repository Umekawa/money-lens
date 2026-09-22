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

`-ReviewAttempts 2`（既定）回までAIレビューで修正を試み、解決できない指摘が残った場合はPRを開いたまま停止します。個人CSV、`csvs/`、秘密情報には触れません。GitHub側ではActionsの成功をマージ条件にし、必要に応じてブランチ保護や通知を設定してください。自動マージは強い権限を持つため、最初は単発実行で結果を確認してから連続運転してください。

## 開発方針

- GitHub Issuesを課題管理に使う
- 個人データ・CSVは公開しない
- 変更前後にローカルチェックを実行する
- GitHub ActionsはチェックとGitHub Pagesデプロイの最小構成にする

## 公開デモ

GitHub Pages には `main` ブランチへの更新時に自動デプロイされます。公開先では個人CSVを読み込まず、匿名のデモデータを表示します。

リポジトリの **Settings → Pages** で Source を **GitHub Actions** に設定してください。公開後は次のURLでデモを確認できます（`<owner>` と `<repository>` は置き換えてください）。

<https://<owner>.github.io/<repository>/>
