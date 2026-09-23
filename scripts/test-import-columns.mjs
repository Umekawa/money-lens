import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state;`, context);

const files = [
  new File(["日付,内容,金額\n2026-01-01,内容,100\n2026-01-02,不足"], "不足.csv"),
  new File(["日付,内容,金額\n2026-01-01,内容,100,余剰"], "余剰.csv"),
  new File(["日付,金額,金額\n2026-01-01,100,200"], "重複.csv"),
  new File(["日付,内容,金額\n2026-01-01,\"カンマ,と\n改行\",100"], "引用.csv"),
];
await context.loadFiles(files);

if (context.importState.transactions.length !== 1 || context.importState.transactions[0].content !== "カンマ,と\n改行") {
  throw new Error("列検証で正常な引用符内カンマ・改行を維持できません");
}
for (const name of ["不足.csv", "余剰.csv", "重複.csv"]) {
  if (!context.importState.importMessages.some((message) => message.includes(name))) {
    throw new Error(`${name}の列不一致または重複ヘッダーを案内できません`);
  }
}

console.log("Import column checks passed.");
