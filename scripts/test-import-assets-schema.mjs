import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state; globalThis.classifyHeaders = classify;`, context);

if (context.classifyHeaders(["日付", "普通預金", "投資信託", "合計"]) !== "assets" ||
    context.classifyHeaders(["合計", "資産内訳", "日付"]) !== "assets") {
  throw new Error("ファイル名や列順を変えた資産CSVを判定できません");
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

console.log("Asset schema checks passed.");
