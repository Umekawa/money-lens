import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state; globalThis.classifyHeaders = classify;`, context);

if (context.classifyHeaders(["日付", "普通預金", "投資信託", "合計"]) !== "assets" ||
    context.classifyHeaders(["合計", "資産内訳", "日付"]) !== "assets" ||
    context.classifyHeaders(["日 付", "普通 預金", "投資信託", "資産 合計"]) !== "assets" ||
    context.classifyHeaders(["日付", "資産区分", "金額"]) !== "transactions") {
  throw new Error("ファイル名や列順を変えた資産CSVを判定できません");
}

const spacedHeaders = new File([
  "日 付,資産 内訳,普通 預金,資産 合計\n" +
  "2026-06-30,100,200,300\n",
], "空白付き.csv");
await context.loadFiles([spacedHeaders]);
if (context.importState.assets.length !== 1 || context.importState.assets[0].total !== 300) {
  throw new Error("空白を含む資産ヘッダーを読み込めません");
}

const reordered = new File([
  "日付,資産内訳,普通預金,資産合計\n" +
  "2026-06-30,100,200,300\n",
], "任意の名前.csv");
await context.loadFiles([reordered]);
if (context.importState.assets.length !== 1 || context.importState.assets[0].total !== 300 ||
    context.importState.assets[0].breakdown[0].value !== 100) {
  throw new Error("明確な資産合計列を選択できません");
}

const ambiguous = new File(["日付,普通預金,合計,合計\n2026-06-30,100,100,100\n"], "data.csv");
await context.loadFiles([ambiguous]);
if (!context.importState.importMessages.some((message) => message.includes("合計列が曖昧"))) {
  throw new Error("合計列が曖昧な資産CSVを案内できません");
}

for (const totalHeader of ["合計", "総額", "純資産", "総資産", "残高合計"]) {
  const isolated = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
  vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state; globalThis.classifyHeaders = classify;`, isolated);
  await isolated.loadFiles([new File([
    `日付,${totalHeader},${totalHeader}\n2026-06-30,100,100\n`,
  ], "ambiguous.csv")]);
  if (isolated.importState.assets.length !== 0 || isolated.importState.transactions.length !== 0 ||
      isolated.importState.importMessages.length !== 1 ||
      !isolated.importState.importMessages[0].includes("合計列が曖昧")) {
    throw new Error(`重複した${totalHeader}列だけのCSVを正しく拒否・案内できません`);
  }
  if (isolated.classifyHeaders(["日付", totalHeader, totalHeader, "金額"]) !== "transactions") {
    throw new Error("合計列が重複した明細CSVを資産CSVと誤判定しています");
  }
}

console.log("Asset schema checks passed.");
