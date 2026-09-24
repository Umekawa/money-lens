# プロダクト追加調査（2026-09-24）

- 対象コミット: `7e3b5eab37acb23bb3b1e8e61bd2489624553135`。
- `autodev.ps1 -ListIssues` で既存Issueを確認。取得時点のopenは #167 の1件。
- README、変更履歴、過去調査、アプリ本体、取込テストを照合し、既存課題の対応後に残る具体的なケースを調査した。
- 個人CSVと `csvs/` は参照せず、メモリ上の合成CSV・HTTPモック・Node VMで本体を実行した。集計描画はDOMスタブで検証。カテゴリ棒幅は本体の集計結果と描画式で確認し、ブラウザでの見た目は未確認。
- 調査時の `npm run check` は成功したが、以下のケースは検出されなかった。
- 再現スクリプト・結果・登録JSONはgitignore対象の `artifacts/audit-2026-09-24.mjs`、`artifacts/audit-2026-09-24-results.json`、`artifacts/issues-2026-09-24.json` に保存。
- `autodev.ps1 -IssueBatchPath` で8件（P1: 4件、P2: 4件）を登録。各Issueに再現、根拠、完了条件、関連するclosed Issueを記載した。

| 優先度 | Issue | 再現結果 |
| --- | --- | --- |
| P1 | [#239 大文字ID列の認識](https://github.com/Umekawa/money-lens/issues/239) | `ID`・`明細ID`・`取引ID` は読み取られず、別IDの同内容明細が1件になる。小文字 `id` なら2件保持。 |
| P1 | [#240 ID明細の再取込](https://github.com/Umekawa/money-lens/issues/240) | 同IDのA=-100円→B=-200円→Aを取り込むと、キャッシュ判定で最後のAを無視し-200円が残る。 |
| P1 | [#241 計算対象外への訂正](https://github.com/Umekawa/money-lens/issues/241) | 同IDの計算対象を1→0へ変更しても、元の明細が集計に残る。 |
| P1 | [#242 相殺後の集計精度](https://github.com/Umekawa/money-lens/issues/242) | 安全整数の収入9007199254740991円・2円と支出9007199254740991円で、カードと月別表の収支が2円でなく1円になる。 |
| P2 | [#243 自動取込の部分失敗](https://github.com/Umekawa/money-lens/issues/243) | 正常CSV2件とHTTP 500の1件を取得すると、世代番号の変化により失敗が結果に記録されない。 |
| P2 | [#244 失敗CSVの成功誤判定](https://github.com/Umekawa/money-lens/issues/244) | 必須列のない同一CSVの再取込が、初回失敗から成功・重複1件へ変わる。 |
| P2 | [#245 明細更新件数](https://github.com/Umekawa/money-lens/issues/245) | 同IDの金額更新が反映されても、ログは新規0・重複1・置換0になる。 |
| P2 | [#246 その他の棒幅](https://github.com/Umekawa/money-lens/issues/246) | 20カテゴリ各100円でその他1200円を先頭カテゴリ100円で割り、棒幅1200%を生成する。 |

金額・件数の正確性に関わるP1を先行する。#239はCSV入口、#240はファイルキャッシュ、#241は対象外化、#245は更新結果の計数を対象としており、共通の取込経路を変更する際は各ケースを合わせて回帰確認する。

## 実画面の追加調査

ユーザーからチップの位置ずれ・重なりの指摘を受け、同じ対象コミットでChromiumの実レンダリングを確認した。

- 幅1280・820・390・320px、高さ900pxで匿名デモと合成資産CSVを表示。スクリーンショットを目視確認し、要素座標・疑似要素の描画位置も測定した。
- ホバー、クリック、キーボードフォーカス、スクロールを実行。390×844pxではモバイル・タッチエミュレーションでタップも確認した。実機Safari/Firefoxは未確認。
- HTML・JS・CSSだけをPlaywrightの仮想オリジンで配信し、個人CSV・ローカル自動探索へのアクセスを行わない構成を使用した。
- 再現スクリプト: `artifacts/visual-audit-2026-09-24.mjs`、`artifacts/visual-interactions-2026-09-24.mjs`。画像・測定JSON: `artifacts/visual-audit-2026-09-24/`。画像はローカル保存で、GitHubのIssueには再現手順と実測値を記載した。

| Issue（全件P2） | 実画面での確認 | 主な画像 |
| --- | --- | --- |
| [#247 チップの位置ずれ](https://github.com/Umekawa/money-lens/issues/247) | グラフ上端y=552なのにチップはページ右上y=8に表示されヘッダーを覆う。スクロールすると画面外へ消え、スマホのタップでも同様。絶対配置の基準がBODYになっている。 | `hover-1280.png`、`hover-390.png`、`touch-390-viewport.png` |
| [#248 履歴操作と説明の重なり](https://github.com/Umekawa/money-lens/issues/248) | 資産の履歴ボタンと表示期間が12px、月別の履歴ボタンと凡例が7px重複する。各幅のデモで再現。既存の負の上マージンが追加ボタンへ食い込む。 | `asset-card-overlap.png`、`hover-390.png` |
| [#249 負値の棒の位置](https://github.com/Umekawa/money-lens/issues/249) | -1200円の棒がゼロ線をまたぎ、-120円は下側に浮く。疑似要素の負値用CSSセレクターが現在のinline styleに一致しない。 | `negative-idle.png` |
| [#250 棒の見た目と操作範囲](https://github.com/Umekawa/money-lens/issues/250) | 可視の棒の上部を座標クリックしても内訳が開かず、下部なら開く。最大83.25pxの描画に対しヒット領域は44pxしかない。 | `bars-idle.png`、`interactions.json` |
| [#251 操作時のゼロ棒の変形](https://github.com/Umekawa/money-lens/issues/251) | 0円は通常2pxのマーカーだが、ホバー/フォーカスで44pxの操作領域全体が塗られ、値があるように見える。 | `negative-idle.png`、`zero-hover.png` |

12内訳・長い日本語ラベルの詳細欄は、今回の合成ケースではカード内で高さが伸び、従来の固定高グラフからのはみ出しは再現しなかった。問題は別途残るツールチップと履歴操作の重なりに切り分けた。横幅だけのチェックや棒中央のクリックだけでは今回の不具合を捉えられないため、各Issueの完了条件に位置関係・可視先端の操作・状態別描画の実ブラウザ検証を含めた。
