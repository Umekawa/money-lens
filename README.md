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

## 開発方針

- GitHub Issuesを課題管理に使う
- 個人データ・CSVは公開しない
- 変更前後にローカルチェックを実行する
- GitHub Actionsは `.github/workflows/check.yml` の1本だけにする
