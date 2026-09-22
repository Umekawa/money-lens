import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Math, Set, Promise, Intl, TextDecoder, Uint8Array, Date, Number, String, JSON };
vm.runInNewContext(`${source}\n;globalThis.appState = state; globalThis.loadData = load; globalThis.loadDemoData = loadDemoData;`, context);

const userFile = new File([
  "日付,内容,大項目,金額,計算対象\n2026-03-01,テスト収入,収入,100,1\n",
], "user.csv", { type: "text/csv" });
await context.loadData([userFile]);
if (context.appState.demo || context.appState.transactions.length !== 1) {
  throw new Error("通常データを読み込めません");
}

await context.loadDemoData();
if (!context.appState.demo || context.appState.transactions.length !== 7 || context.appState.assets.length !== 2) {
  throw new Error("デモデータが通常データと混在しています");
}

await context.loadData([]);
if (!context.appState.demo || context.appState.transactions.length !== 7 || context.appState.assets.length !== 2) {
  throw new Error("空のファイル選択でデモデータが消えています");
}

await context.loadData([userFile]);
if (context.appState.demo || context.appState.transactions.length !== 1 || context.appState.assets.length !== 0) {
  throw new Error("通常データへの切り替えでデモデータが残っています");
}

console.log("Demo mode checks passed.");
