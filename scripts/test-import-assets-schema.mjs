import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state; globalThis.classifyHeaders = classify;`, context);

if (context.classifyHeaders(["日付", "普通預金", "投資信託", "合計"]) !== "assets" ||
    context.classifyHeaders(["合計", "資産内訳", "日付"]) !== "assets" ||
    context.classifyHeaders(["日 付", "普通 預金", "投資信託", "資産 合計"]) !== "assets" ||
    context.classifyHeaders(["取引日付", "普通預金", "合計"]) !== "assets" ||
    context.classifyHeaders(["日付", "資産区分", "金額"]) !== "transactions" ||
    context.classifyHeaders(["日付", "資産区分", "支出金額"]) !== "transactions") {
  throw new Error("ファイル名や列順を変えた資産CSVを判定できません");
}

const spacedHeaders = new File([
  "日 付,資産 内訳,普通 預金,合 計\n" +
  "2026-06-30,100,200,300\n",
], "空白付き.csv");
await context.loadFiles([spacedHeaders]);
if (context.importState.assets.length !== 1 || context.importState.assets[0].total !== 300) {
  throw new Error("空白を含む資産ヘッダーを読み込めません");
}

const reordered = new File([
  "日付,資産内訳,普通預金,合計\n" +
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

for (const [headers, expectedTotal, expectedBreakdown] of [
  [["日付", "預金合計", "総資産"], 300, 100],
  [["日付", "総資産", "預金合計"], 300, 100],
  [["日付", "合計", "預金合計"], 300, 100],
  [["日付", "預金合計", "合計"], 300, 100],
  [["日付", "純資産", "総資産"], 300, 300],
  [["日付", "総資産", "純資産"], 300, 300],
]) {
  const isolated = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
  vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state;`, isolated);
  await isolated.loadFiles([new File([`${headers.join(",")}\n2026-06-30,${headers.slice(1).map(header => header === "預金合計" ? 100 : 300).join(",")}\n`], "total-priority.csv")]);
  const asset = isolated.importState.assets[0];
  if (!asset || asset.total !== expectedTotal || !asset.breakdown.some(item => item.value === expectedBreakdown)) {
    throw new Error(`総資産/小計の選択または列順入替に失敗: ${headers.join(",")}`);
  }
}

const subtotalOnly = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state;`, subtotalOnly);
await subtotalOnly.loadFiles([new File(["日付,預金合計\n2026-06-30,100\n"], "subtotal-only.csv")]);
if (subtotalOnly.importState.assets.length || !subtotalOnly.importState.importMessages.length) {
  throw new Error("小計列だけのCSVを総額と誤認、または案内できません");
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

for (const unit of ["（円）", "(円)"]) {
  const isolated = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
  vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state;`, isolated);
  const headers = ["日付", ...["合計", "預金・現金", "株式(現物)", "投資信託", "年金", "ポイント"].map(label => label + unit)];
  await isolated.loadFiles([new File([
    headers.map(label => `"${label}"`).join(",") + '\n"2026/6/30","1,500","100","200","300","400","500"\n',
  ], "unit-headers.csv")]);
  const asset = isolated.importState.assets[0];
  if (isolated.importState.assets.length !== 1 || asset.total !== 1500 ||
      asset.breakdown.map(item => item.value).join(",") !== "100,200,300,400,500" ||
      asset.breakdown[1].label !== `株式(現物)${unit}` || isolated.importState.importMessages.length !== 0) {
    throw new Error("単位付き合計列の認識、内訳の読み込み、元の表示名の保持に失敗しました");
  }
}

// 架空の「日付,合計（円）,預金・現金（円）」CSVをCP932で符号化したもの。
const shiftJisContext = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state;`, shiftJisContext);
await shiftJisContext.loadFiles([new File([
  Buffer.from("93fa95742c8d878c768169897e816a2c97618be081458cbb8be08169897e816a0a323032362f362f33302c3130302c3130300a", "hex"),
], "shift-jis.csv")]);
if (shiftJisContext.importState.assets.length !== 1 ||
    shiftJisContext.importState.assets[0].total !== 100 ||
    shiftJisContext.importState.assets[0].breakdown[0].label !== "預金・現金（円）" ||
    shiftJisContext.importState.importMessages.length !== 0) {
  throw new Error("Shift_JISの単位付き資産CSVを読み込めません");
}

console.log("Asset schema checks passed.");
