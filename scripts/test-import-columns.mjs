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

for (const [header, label] of [["ID", "ID"], ["明細ID", "明細ID"], ["取引ID", "取引ID"]]) {
  const filesWithIds = [
    new File([`日付,内容,金額,${header}\n2026-02-01,店,-100,a`], `${label}-a.csv`),
    new File([`日付,内容,金額,${header}\n2026-02-01,店,-100,b`], `${label}-b.csv`),
    new File([`日付,内容,金額,${header}\n2026-02-01,更新,-150,a`], `${label}-update.csv`),
  ];
  await context.loadFiles(filesWithIds);
  const matching = context.importState.transactions.filter((transaction) => transaction.date === "2026-02-01");
  if (matching.length !== 2 || matching.find((transaction) => transaction.id === "a")?.amount !== -150 || !matching.some((transaction) => transaction.id === "b")) {
    throw new Error(`${label}列で別IDを保持し、同一IDの訂正版へ更新できません`);
  }
}

await context.loadFiles([new File(["日付,内容,金額,ID,id\n2026-03-01,重複,-100,a,b"], "大小文字重複.csv")]);
if (!context.importState.importMessages.some((message) => message.includes("大小文字重複.csv"))) {
  throw new Error("大小文字だけが異なる識別ヘッダーの重複を検出できません");
}

const idCsv = (content, category, amount) => new File(
  [`日付,内容,カテゴリ,金額,id\n2026-04-01,${content},${category},${amount},a`],
  `${content}.csv`,
);
const fileA = idCsv("店", "食費", -100);
const fileB = idCsv("更新店", "日用品", -200);
await context.loadFiles([fileA, idCsv("店B", "食費", -200), fileA]);
const corrected = context.importState.transactions.filter((transaction) => transaction.date === "2026-04-01");
if (corrected.length !== 1 || corrected[0].amount !== -100 || corrected[0].content !== "店" || corrected[0].category !== "食費") {
  throw new Error("A→B→Aの再取込で最後のID明細訂正が反映されません");
}
await context.loadFiles([fileA, fileA]);
if (context.importState.transactions.filter((transaction) => transaction.date === "2026-04-01").length !== 1) {
  throw new Error("A→Aの同ID明細再取込で重複しました");
}

await context.loadFiles([
  new File(["日付,内容,金額\n2026-05-01,重複,-300"], "期間A.csv"),
  new File(["日付,内容,金額\n2026-05-01,重複,-300"], "期間B.csv"),
]);
if (context.importState.transactions.filter((transaction) => transaction.date === "2026-05-01").length !== 1) {
  throw new Error("IDなし明細の期間重複排除が維持されません");
}

console.log("Import column checks passed.");
