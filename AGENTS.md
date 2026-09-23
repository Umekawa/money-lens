# 開発ルール

- `csvs/`と個人CSVは読まない・変更しない・コミットしない。
- 変更後は必ず`npm run check`をローカルで実行する。
- 変更内容は`CHANGELOG.md`に短く記録する。
- GitHubへのpush、PR作成、マージ、Issue操作は`autodev.ps1`が行う。承認済みリリースに限り、タグpushとGitHub Release作成は`docs/release.md`の手順でリポジトリ管理者が行う。
- Issue・PR・コミット・ドキュメントは原則として日本語で書く。
- コードの識別子や外部APIの名前は、既存の慣習に合わせて英語を使う。
