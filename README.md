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

ブラウザUIの操作監査（匿名デモのみ）は [`docs/browser-ui-audit.md`](docs/browser-ui-audit.md) を参照してください。

## 開発方針

- GitHub Issuesを課題管理に使う
- 個人データ・CSVは公開しない
- 変更前後にローカルチェックを実行する
- GitHub ActionsはチェックとGitHub Pagesデプロイの最小構成にする

## 公開デモ

GitHub Pages には `main` ブランチへの更新時に自動デプロイされます。公開先では個人CSVを読み込まず、匿名のデモデータを表示します。

リポジトリの **Settings → Pages** で Source を **GitHub Actions** に設定してください。公開後は次のURLでデモを確認できます（`<owner>` と `<repository>` は置き換えてください）。

<https://<owner>.github.io/<repository>/>
