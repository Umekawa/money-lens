# リリース手順

このリポジトリの公開版は、`package.json` と `package-lock.json` のバージョン、`CHANGELOG.md` の版見出し、Git タグ、GitHub Release を同じ内容で対応させる。

## 現在の対応

- アプリのバージョン: `0.1.0`
- 変更履歴: `CHANGELOG.md` の `0.1.0 - 2026-09-23`
- Git タグ: 未作成
- GitHub Release: 未作成

したがって、`0.1.0` はこの変更時点のリリース候補であり、GitHub 上で公開済みの版ではない。タグと Release の作成が完了するまでは、公開版との対応を「未公開」と扱う。

## 手順

1. `main` の作業ツリーが clean であることを確認し、リリース対象の Issue と変更内容を確認する。
2. `npm version <major|minor|patch> --no-git` を実行して `package.json` と `package-lock.json` のバージョンを同時に更新する。既存の `v` なしタグと衝突しないバージョンを選ぶ。
3. `CHANGELOG.md` の `Unreleased` の内容を新しい `## <version> - YYYY-MM-DD` に移し、次の `Unreleased` を空で先頭に残す。内容には対象 Issue 番号を含める。
4. `npm run check` を実行する。失敗した場合はリリースを中止し、原因を修正してから再実行する。
5. バージョン更新、変更履歴、チェック結果を確認する。個人 CSV、`csvs/`、秘密情報が差分に含まれていないことも確認する。
6. 変更を通常のレビュー経由で `main` に反映した後、`git tag v<version>` を作成して push する。
7. GitHub Release をタグ `v<version>` から作成し、本文には対応する CHANGELOG の版の内容を転記する。

GitHub の Issue・タグ・Release の作成や push は手作業で行わず、`scripts/autodev.ps1` が提供するレビュー・公開フロー経由で行う。リリース作業だけを行う場合も、`-PublishCurrentChanges` などの既存変更公開モードでレビューを通し、GitHub 側の操作を自動開発サイクルに任せる。

## 失敗時の扱い

- `npm run check` またはレビューが失敗した場合は、タグと GitHub Release を作成しない。
- タグ作成後に Release 作成だけ失敗した場合は、同じタグを再利用して Release を再作成する。別バージョンを追加しない。
- タグを誤って作成した場合は、公開前に原因と影響を確認し、削除・作り直しの可否を管理者が判断する。既に公開したタグを履歴書き換えで置き換えない。
