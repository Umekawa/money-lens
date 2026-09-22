import { readFile } from "node:fs/promises";
import vm from "node:vm";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = await readFile("app.js", "utf8");
const context = { File, Intl, Map, Math, Set, TextDecoder, Uint8Array };
vm.runInNewContext(
  `${source}\n;globalThis.testApi = { load, state, categorySums };`,
  context,
);

const transactionsCsv = await readFile("samples/transactions.csv", "utf8");
const assetsCsv = await readFile("samples/assets.csv", "utf8");
await context.testApi.load([
  new File([transactionsCsv], "transactions.csv"),
  new File([assetsCsv], "assets.csv"),
]);

const { state } = context.testApi;
assert(state.transactions.length === 4, "本体で明細サンプルの4行を取り込めること");
assert(state.assets.length === 2, "本体で資産サンプルの2行を取り込めること");
assert(state.assets.map((asset) => asset.total).join(",") === "1720000,1925000", "本体で資産合計を読み込めること");

const categoryTotals = context.testApi.categorySums(state.transactions);
assert(categoryTotals.get("住宅") === 82000 && categoryTotals.get("食費") === 24000, "本体のカテゴリ集計がサンプルを集計できること");
assert(state.transactions.reduce((sum, transaction) => sum + transaction.amount, 0) === 165000, "本体の明細金額集計が想定どおりであること");

await context.testApi.load([
  new File(["2026-02-01,対象外,食費,-999,0\n"], "calculation-target.csv"),
]);
assert(state.transactions.length === 4, "計算対象が0の明細を本体が集計対象外にできること");

await context.testApi.load([new File([transactionsCsv], "renamed-transactions.csv")]);
assert(state.transactions.length === 4, "本体が別名の同一明細を重複排除できること");

await context.testApi.load([
  new File(["日付,普通預金,投資信託,合計\n2026-02-28,600000,1400000,2000000\n"], "updated-assets.csv"),
]);
assert(state.assets.length === 2 && state.assets.find((asset) => asset.date === "2026-02-28").total === 2000000, "本体が同日資産を更新値へ置換できること");

console.log("Sample import and aggregation checks passed.");
