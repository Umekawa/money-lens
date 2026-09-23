import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.cancelCurrentImport = cancelImport; globalThis.importState = state;`, context);

const failed = { name: "壊れた.csv", arrayBuffer: async () => { throw new Error("読み込み失敗"); } };
const malformed = new File([String.raw`日付,内容,大項目,金額,計算対象
2026-03-01,"未完了,収入,1000,1`], "構文エラー.csv");
const valid = new File([String.raw`日付,内容,大項目,金額,計算対象
2026-03-01,"引用
内""容",収入,1000,1`], "正常.csv");
await context.loadFiles([failed, malformed, valid]);

if (context.importState.transactions.length !== 1 || context.importState.transactions[0].content !== "引用\n内\"容") {
  throw new Error("失敗したファイルの後続ファイルを読み込めません");
}
if (!context.importState.importMessages.some((message) => message.includes("壊れた.csv") && message.includes("読み込みに失敗しました"))) {
  throw new Error("読み込み失敗を画面用メッセージに記録できません");
}
if (!context.importState.importMessages.some((message) => message.includes("構文エラー.csv") && message.includes("CSV構文エラー"))) {
  throw new Error("CSV構文エラーをファイル名付きで案内できません");
}

let rejectOldFile;
const oldFile = { name: "古い.csv", arrayBuffer: () => new Promise((_, reject) => { rejectOldFile = reject; }) };
const oldLoad = context.loadFiles([oldFile]);
await Promise.resolve();
await Promise.resolve();
context.cancelCurrentImport();
rejectOldFile(new Error("キャンセル後の失敗"));
await oldLoad;
if (context.importState.importMessages.some((message) => message.includes("古い.csv")) || context.importState.importResults.some((result) => result.name === "古い.csv")) {
  throw new Error("キャンセル済みの古いファイルの失敗が取込結果へ混入しました");
}

const staleSuccess = { name: "古い成功.csv", arrayBuffer: () => new Promise((resolve) => { resolveOldFile = resolve; }) };
let resolveOldFile;
const staleLoad = context.loadFiles([staleSuccess]);
await Promise.resolve();
await Promise.resolve();
context.cancelCurrentImport();
resolveOldFile(new Blob(["日付,内容,大項目,金額,計算対象\n2026-03-02,古い,収入,1000,1"]).arrayBuffer());
await staleLoad;
if (context.importState.transactions.some((transaction) => transaction.content === "古い") || context.importState.importResults.some((result) => result.name === "古い成功.csv")) {
  throw new Error("キャンセル済みの古いファイルの成功が取込結果へ混入しました");
}

console.log("Import resilience checks passed.");
