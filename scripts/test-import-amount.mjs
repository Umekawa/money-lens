import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state; globalThis.formatYen = yen; globalThis.parseMoney = parseAmount;`, context);

const transactions = new File([
  "日付,内容,大項目,金額,計算対象\n" +
  "2026-04-01,空欄,その他,,1\n" +
  "2026-04-02,ゼロ,その他,0,1\n" +
  "2026-04-03,円表記,その他,\"¥1,000\",1\n" +
  "2026-04-04,不正,その他,abc,1\n" +
  "2026-04-05,桁区切り不正,その他,\"1,00,0\",1\n" +
  "2026-04-06,小数円,その他,1.5,1\n" +
  "2026-04-07,安全範囲内上限,その他,9007199254740991,1\n" +
  "2026-04-08,安全範囲外,その他,9007199254740992,1",
], "金額検証.csv");
const assets = new File([
  "日付,普通預金,投資信託,合計\n" +
  "2026-04-30,0,0,0\n" +
  "2026-05-31,100,不明,100",
], "資産検証.csv");

await context.loadFiles([transactions, assets]);

if (context.importState.transactions.length !== 3) {
  throw new Error("空欄・不正な明細金額を除外し、0と円表記を取り込めません");
}
if (!context.importState.transactions.some(({ amount }) => amount === 0) ||
    !context.importState.transactions.some(({ amount }) => amount === 1000)) {
  throw new Error("有効な0円または円表記の金額を正しく取り込めません");
}
if (context.importState.assets.length !== 1 || context.importState.assets[0].breakdown.some(({ value }) => value !== 0)) {
  throw new Error("不正な資産内訳を除外し、0円の内訳を保持できません");
}
if (context.importState.importMessages.length < 2) {
  throw new Error("不正な明細・資産行の除外を画面用メッセージに記録できません");
}

if (context.parseMoney("1.5") !== null || context.parseMoney("9007199254740992") !== null) {
  throw new Error("小数円または安全整数範囲外の金額を除外できません");
}
if (context.formatYen(Number.MAX_SAFE_INTEGER + 2) !== "集計範囲外") {
  throw new Error("安全整数範囲外の集計を警告なしで表示しています");
}

console.log("Import amount validation checks passed.");
