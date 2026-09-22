import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Math };
vm.runInNewContext(`${source}\n;globalThis.categorySums = categorySums;`, context);

const result = context.categorySums([
  { category: "__proto__", amount: -100 },
  { category: "constructor", amount: -200 },
  { category: "日本語", amount: -300 },
  { category: "", amount: -400 },
  { category: "__proto__", amount: -50 },
  { category: "収入", amount: 999 },
]);

const expected = new Map([
  ["__proto__", 150],
  ["constructor", 200],
  ["日本語", 300],
  ["未分類", 400],
]);
if (result.size !== expected.size || [...expected].some(([key, value]) => result.get(key) !== value)) {
  throw new Error("特殊なカテゴリ名の集計結果が想定と異なります");
}

console.log("Category aggregation checks passed.");
