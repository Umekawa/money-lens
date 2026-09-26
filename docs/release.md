# リリース手順

このリポジトリの公開版は、`package.json` と `package-lock.json` のバージョン、`CHANGELOG.md` の版見出し、Git タグ、GitHub Release を同じ内容で対応させる。

## 現在の対応

- 正式リリース済み: `v1.0.0`（2026-09-25、Git タグとGitHub Releaseあり）
- 次の候補: アプリのバージョン `1.0.1`、`CHANGELOG.md` の `1.0.1 - 2026-09-26`（既知の制限を含む）
- `v1.0.1` のタグとGitHub Release: 未作成

`1.0.1` は準備中の候補であり、Pagesで変更が見られることと正式リリースは別。準備PRが `main` にマージされ、Pages公開SHAと照合し、承認後に同じSHAでタグとReleaseを作成するまでは `v1.0.1` を公開済みと表記しない。Issue #269の対応規模とIssue #266のブラウザ最終確認は継続課題として明示する。

## 手順

1. `main` の作業ツリーが clean であることを確認し、リリース対象の Issue と変更内容を確認する。
2. `npm version <major|minor|patch> --no-git-tag-version` を実行して `package.json` と `package-lock.json` のバージョンを同時に更新する。既存の `v` 付きタグと衝突しないバージョンを選ぶ。
3. `CHANGELOG.md` の `Unreleased` の内容を新しい `## <version> - YYYY-MM-DD` に移し、次の `Unreleased` を空で先頭に残す。内容には対象 Issue 番号を含める。
4. `npm run check` を実行する。失敗した場合はリリースを中止し、原因を修正してから再実行する。
5. バージョン更新、変更履歴、チェック結果を確認する。個人 CSV、`csvs/`、秘密情報が差分に含まれていないことも確認する。
6. 変更を通常のレビュー経由で `main` に反映する。Pagesワークフローの成功を確認し、公開対象SHAを記録する。
7. リポジトリ管理者がリリース承認を得た後、以下の「タグとReleaseの実行経路」に従ってタグを作成・pushする。
8. 同じタグからGitHub Releaseを作成し、本文には対応するCHANGELOGの版の内容を転記する。

GitHub の Issue・PR・ブランチの push・merge は、管理者がローカル保管する `.local-dev/autodev.ps1` のレビュー・公開フロー経由で行う。`.local-dev/` はGit除外対象で、公開リポジトリには含まれない。タグ/Releaseは現行スクリプトの対象外であり、以下の手順に限り、承認済みリリースを担当するリポジトリ管理者がGitHub CLIで実施する。リリース対象の変更を公開する場合は、リリース作業だけであっても `-PublishCurrentChanges` などの既存変更公開モードでレビューを通す。

## タグとReleaseの実行経路

実行者はリポジトリ管理者とし、リリース承認を記録してから操作する。`main` にマージ済みでPagesの `Deploy GitHub Pages` が成功したコミットだけを対象にする。ローカルで `git fetch origin main --tags` を行い、`git rev-parse origin/main` と対象SHAが一致すること、`package.json` と `package-lock.json` が同じ `<version>` であること、CHANGELOGに対応版があることを確認する。タグがローカルまたはリモートに既にある場合は中止し、既存タグの指すSHAとReleaseを調査する（上書き・強制pushは禁止）。

```powershell
$version = "<version>"
$tag = "v$version"
$sha = "<mainの完全なSHA>"
$notesFile = "release-notes-$version.md" # 対応するCHANGELOGの版の本文を保存したファイル
git fetch origin main --tags
if ($LASTEXITCODE -ne 0) { throw "git fetch に失敗しました" }
$mainSha = (git rev-parse origin/main).Trim()
if ($LASTEXITCODE -ne 0) { throw "origin/main のSHAを取得できません" }
if ($mainSha -ne $sha) { throw "対象SHAがorigin/mainと一致しません" }
$localTag = git show-ref --verify --quiet "refs/tags/$tag"
if ($LASTEXITCODE -eq 0) { throw "ローカルにタグが既にあります。調査して中止してください" }
if ($LASTEXITCODE -ne 1) { throw "ローカルタグを確認できません" }
$remoteTag = git ls-remote --tags origin "refs/tags/$tag"
if ($LASTEXITCODE -ne 0) { throw "リモートタグを確認できません" }
if ($remoteTag) { throw "リモートにタグが既にあります。調査して中止してください" }
git tag $tag $sha
if ($LASTEXITCODE -ne 0) { throw "タグを作成できません" }
git push origin "refs/tags/$tag"
if ($LASTEXITCODE -ne 0) { throw "タグをpushできません。既存タグを上書きせず調査してください" }
gh release create $tag --verify-tag --title $tag --notes-file $notesFile
if ($LASTEXITCODE -ne 0) { throw "GitHub Releaseを作成できませんでした。タグは削除せず、同じタグ・SHAで再試行してください" }
```

タグが既に存在する場合はコマンドを続けず、`git show "${tag}^{commit}"` などで指すSHAとReleaseを調査する。Release作成に失敗した場合はタグを削除せず、同一タグ・同一SHAで管理者が `gh release create ... --verify-tag` を再試行する。

### Pages公開版との照合

Pagesワークフロー（`.github/workflows/pages.yml`）は、`main` へのpushと `workflow_dispatch` による手動実行で起動する。タグpushだけでは起動しない。手動実行では選択したrefが対象になるため、起動方法だけで公開内容を判断しない。

リリース版と現在のPages公開版は、次の手順で照合する。

1. タグが指すコミットの完全なSHAを確認する。
2. GitHubの `github-pages` 環境で現在の公開に対応する成功済みデプロイと、その `Deploy GitHub Pages` 実行を特定する。過去に成功した実行だけを根拠にしない。
3. その実行のイベント（push / workflow_dispatch）、対象ref、コミットSHA、実行URLを記録する。リリース確認のために手動実行する場合は `main` を選択する。
4. タグ対象SHAと現在の公開デプロイのSHAが一致するときに限り、リリース版とPages公開版を同一版とみなす。後続のpushや手動実行で公開版が更新された場合は再照合する。

いずれかが未確認なら候補/公開版との対応は未確認として扱い、Release本文や案内で公開済みと表記しない。

## 失敗時の扱い

- `npm run check` またはレビューが失敗した場合は、タグと GitHub Release を作成しない。
- タグ作成後に Release 作成だけ失敗した場合は、同じタグを再利用して Release を再作成する。別バージョンを追加しない。
- タグを誤って作成した場合は、公開前に原因と影響を確認し、削除・作り直しの可否を管理者が判断する。既に公開したタグを履歴書き換えで置き換えない。
