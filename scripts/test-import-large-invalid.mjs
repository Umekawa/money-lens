import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state;`, context);
const header = "日付,内容,大項目,金額,計算対象\n";
const file = (name, rows) => new File([header + rows.join("\n")], name);
const seed = "2026-01-01,seed,食費,-100,1";
const invalidRows = Array.from({ length: 150000 }, () => "2026-99-99,bad,食費,-10,1");

await context.loadFiles([file("seed.csv", [seed])]);
const mixed = file("mixed.csv", [seed, "2026-01-02,new,食費,-200,1", ...invalidRows]);
await context.loadFiles([mixed]);
assert.equal(context.importState.transactions.length, 2, "不正行大量時も正常明細は重複排除して反映する");
assert.equal(context.importState.transactions.reduce((sum, row) => sum - row.amount, 0), 300);
assert.deepEqual(JSON.parse(JSON.stringify(context.importState.importResults.at(-1))), {
  name: "mixed.csv", status: "成功", type: "transactions", accepted: 1, updated: 0, unchanged: 0, excluded: 150000, invalid: 150000, duplicate: 1, replaced: 0, reason: ""
});

const invalidOnly = file("invalid-only.csv", invalidRows);
await context.loadFiles([invalidOnly]);
assert.equal(context.importState.transactions.length, 2, "正常行のないファイルで既存明細を変更しない");
const messagesAfterFirstImport = context.importState.importMessages.length;
await context.loadFiles([invalidOnly]);
assert.equal(context.importState.importMessages.length, messagesAfterFirstImport, "再取込で同一ファイルを再処理しない");
await context.loadFiles([file("later.csv", ["2026-01-03,later,食費,-50,1"])]);
assert.equal(context.importState.transactions.length, 3, "後続正常ファイルを処理する");

console.log("Large invalid import checks passed.");
