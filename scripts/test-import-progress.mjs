import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const rows = Array.from({ length: 2000 }, (_, index) => `2026-01-${String(index % 28 + 1).padStart(2, "0")},項目${index},食費,-${index + 1},1`).join("\n");
const files = [
  new File([`日付,内容,大項目,金額,計算対象\n${rows}`], "大量-1.csv", { type: "text/csv" }),
  new File([`日付,内容,大項目,金額,計算対象\n${rows.replaceAll("項目", "別項目")}`], "大量-2.csv", { type: "text/csv" })
];
const context = { File, TextDecoder, Intl, Set, Map, URLSearchParams, console };
vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state;`, context);

const started = performance.now();
const heapBefore = process.memoryUsage().heapUsed;
await context.loadFiles(files);
const elapsed = Math.round(performance.now() - started);
const heapDelta = Math.round((process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024);
assert.equal(context.importState.transactions.length, 4000, "合成した大量CSVをすべて取り込める");
assert.equal(context.importState.importResults.length, 2, "ファイル別の結果を保持する");
assert.equal(context.importState.importProgress.active, false, "完了後に進捗状態を終了する");
assert.equal(context.importState.importProgress.current, "", "完了後に処理中ファイルを消去する");
console.log(`Large import progress checks passed (${elapsed}ms, heap delta ${heapDelta}MiB).`);
