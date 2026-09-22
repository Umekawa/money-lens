import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Math, Set };
vm.runInNewContext(`${source}\n;globalThis.mergeTransactions = mergeTransactions; globalThis.mergeAssets = mergeAssets;`, context);

const first = { date: "2026-01-01", content: "店", category: "食費", amount: -100 };
const legitimateDuplicate = { ...first };
const added = { date: "2026-02-01", content: "店", category: "食費", amount: -200 };
const mergedTransactions = context.mergeTransactions([first, legitimateDuplicate], [first, added]);
if (mergedTransactions.length !== 3 || mergedTransactions[2] !== added) {
  throw new Error("明細の期間重複を除外しつつ正当な同日同額の重複を保持できません");
}

const oldAsset = { date: "2026-01-31", total: 100, breakdown: [] };
const updatedAsset = { date: "2026-01-31", total: 200, breakdown: [] };
const nextAsset = { date: "2026-02-28", total: 300, breakdown: [] };
const mergedAssets = context.mergeAssets([oldAsset], [updatedAsset, nextAsset]);
if (mergedAssets.length !== 2 || mergedAssets.find((asset) => asset.date === oldAsset.date).total !== 200) {
  throw new Error("同日資産の更新版を最新の取込値へ置換できません");
}

console.log("Import merge checks passed.");
