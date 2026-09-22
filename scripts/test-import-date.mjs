import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
vm.runInNewContext(`${source}\n;globalThis.parseDateValue = parseDate; globalThis.loadFiles = load; globalThis.importState = state;`, context);

const valid = context.parseDateValue("2026/2/3");
if (valid.date !== "2026-02-03") throw new Error("スラッシュ区切りの日付を正規化できません");
for (const value of ["2024-02-29", "2024/2/29"]) {
  if (context.parseDateValue(value).date !== "2024-02-29") throw new Error("閏日を取り込めません");
}
for (const value of ["2023-02-29", "2026-99-99", "2026/02-03", "not-a-date"]) {
  if (context.parseDateValue(value).date !== null) throw new Error(`不正な日付を受け入れました: ${value}`);
}

const file = new File([
  "日付,内容,大項目,金額,計算対象\n" +
  "2026/1/5,給与,収入,100,1\n" +
  "2026-99-99,不正,支出,-50,1\n" +
  "2026-01-06,家賃,住宅,-20,1",
], "日付.csv");
await context.loadFiles([file]);
if (context.importState.transactions.length !== 2) throw new Error("有効な日付だけを取り込めません");
if (!context.importState.transactions.some((row) => row.date === "2026-01-05")) throw new Error("取り込み日付を正規化できません");
if (!context.importState.importMessages.some((message) => message.includes("3行目") && message.includes("実在する暦日ではありません"))) {
  throw new Error("無効行の番号と理由を案内できません");
}

console.log("Import date checks passed.");
