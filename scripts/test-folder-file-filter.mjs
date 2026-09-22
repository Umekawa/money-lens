import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state;`, context);

const valid = new File(["日付,内容,大項目,金額\n2026-03-01,給与,収入,1000"], "取引.CSV");
const unsupported = new File(["これはCSVではありません"], "メモ.txt");
await context.loadFiles([unsupported, valid]);

if (context.importState.transactions.length !== 1) {
  throw new Error("フォルダ内のCSVを読み込めません");
}
const skipped = context.importState.importResults.find((result) => result.name === "メモ.txt");
if (!skipped || skipped.status !== "スキップ" || !skipped.reason.includes("CSV")) {
  throw new Error("CSV以外のファイルを明確にスキップできません");
}

console.log("Folder file filter checks passed.");
