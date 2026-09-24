import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Math };
vm.runInNewContext(`${source}\n;globalThis.categorySums = categorySums; globalThis.categoryDisplayData = categoryDisplayData; globalThis.categoryBarWidth = categoryBarWidth;`, context);

const result = context.categorySums([
  { category: "__proto__", amount: -100 },
  { category: "constructor", amount: -200 },
  { category: "日本語", amount: -300 },
  { category: "", amount: -400 },
  { category: "__proto__", amount: -50 },
  { category: "収入", amount: 999 },
]);

const expected = new Map([
  ["__proto__", 150n],
  ["constructor", 200n],
  ["日本語", 300n],
  ["未分類", 400n],
]);
if (result.size !== expected.size || [...expected].some(([key, value]) => result.get(key) !== value)) {
  throw new Error("特殊なカテゴリ名の集計結果が想定と異なります");
}

console.log("Category aggregation checks passed.");

const makeTransactions = count => Array.from({ length: count }, (_, index) => ({
  category: `カテゴリ${index + 1}`,
  amount: -(count - index),
}));
for (const count of [0, 8, 9]) {
  const display = context.categoryDisplayData(makeTransactions(count));
  const displayedTotal = display.reduce((sum, [, value]) => sum + value, 0n);
  const expectedTotal = BigInt(count * (count + 1) / 2);
  if (displayedTotal !== expectedTotal || display.length !== (count === 9 ? 9 : count)) {
    throw new Error(`${count}カテゴリの表示合計が想定と異なります`);
  }
}
if (context.categoryDisplayData(makeTransactions(9)).at(-1)[0] !== "その他") {
  throw new Error("9カテゴリ以上の残額が「その他」に集約されていません");
}
console.log("Category display checks passed.");

const assertWidths = (data, expected) => {
  const widths = data.map(([category, amount]) => context.categoryBarWidth(amount, data));
  if (widths.some(width => width < 0 || width > 100) || widths.some((width, index) => Math.abs(width - expected[index]) > 1e-10)) {
    throw new Error(`カテゴリ棒の比率が想定と異なります: ${widths}`);
  }
};
assertWidths([["通常", 100n], ["その他", 1200n]], [100 / 12, 100]);
assertWidths([["通常", 100n], ["その他", 100n]], [100, 100]);
assertWidths([["通常", 100n], ["その他", 20n]], [100, 20]);
const existingOther = context.categoryDisplayData([
  ...Array.from({ length: 8 }, (_, index) => ({ category: `カテゴリ${index + 1}`, amount: -100 })),
  { category: "その他", amount: -100 },
  { category: "追加", amount: -100 },
]);
if (existingOther.find(([category]) => category === "その他")?.[1] !== 200n) {
  throw new Error("既存の「その他」へ集約額が加算されていません");
}
assertWidths(existingOther, existingOther.map(([, value]) => Number(value) / 2));
console.log("Category bar scale checks passed.");
