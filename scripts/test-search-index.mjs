import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Set, WeakMap, Intl, TextDecoder, Uint8Array, setTimeout, clearTimeout };
vm.runInNewContext(`${source}\n;globalThis.importState=state;globalThis.rows=transactionRows;globalThis.fingerprint=fileFingerprint;globalThis.loadFiles=load;`, context);

let reads = 0;
const older = { date: "2025-12-01", get content() { reads++; return "家賃"; }, category: "住宅", amount: -100 };
const newer = { date: "2026-01-01", content: "給与", category: "収入", amount: 200 };
context.importState.transactions = [older, newer];
assert.deepEqual([...context.rows("all", "")], [newer, older], "日付降順で表示する");
assert.equal(context.rows("all", "家賃").length, 1, "検索対象の明細だけを返す");
assert.equal(context.rows("2026-01", "家賃").length, 0, "月と検索を両方適用する");
context.rows("all", "家賃");
assert.equal(reads, 1, "ページ移動や検索のたびに文字列を作り直さない");
context.importState.transactions = [{ ...newer, amount: 300 }, older];
assert.equal(context.rows("all", "300").length, 1, "取込更新後の配列で検索索引を更新する");

const raw = "日付,金額\n2026-01-01,-123\n";
assert.equal(context.fingerprint("a.csv", raw), context.fingerprint("a.csv", raw), "同じCSVの指紋を安定して算出する");
assert.notEqual(context.fingerprint("a.csv", raw), context.fingerprint("b.csv", raw), "ファイル名を区別する");
assert.notEqual(context.fingerprint("a.csv", raw), context.fingerprint("a.csv", raw.replace("-123", "-124")), "訂正した内容を区別する");
context.importState.transactions = [];
await context.loadFiles([new File([raw], "a.csv"), new File([raw], "b.csv"), new File([raw], "a.csv")]);
assert.equal(context.importState.loadedFiles.size, 2, "同じファイルは一件、別名CSVは別件として数える");
assert.equal(context.importState.transactions.length, 1, "別名・同内容でも明細を二重計上しない");
assert.ok([...context.importState.loadedFiles].every(key => !key.includes(raw)), "CSV本文を保持しない");

console.log("Search index and file fingerprint checks passed.");
