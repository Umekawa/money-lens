import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state;`, context);

const failed = { name: "壊れた.csv", arrayBuffer: async () => { throw new Error("読み込み失敗"); } };
const valid = new File(["日付,内容,大項目,金額,計算対象\n2026-03-01,給与,収入,1000,1"], "正常.csv");
await context.loadFiles([failed, valid]);

if (context.importState.transactions.length !== 1) {
  throw new Error("失敗したファイルの後続ファイルを読み込めません");
}
if (!context.importState.importMessages.some((message) => message.includes("壊れた.csv") && message.includes("読み込みに失敗しました"))) {
  throw new Error("読み込み失敗を画面用メッセージに記録できません");
}

console.log("Import resilience checks passed.");
