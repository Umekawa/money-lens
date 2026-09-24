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

const idA = { ...first, id: "a" };
const idB = { ...first, id: "b" };
const correctedA = { ...idA, amount: -150, category: "日用品" };
const transactionCounts = { added: 0, updated: 0, unchanged: 0 };
const idMerged = context.mergeTransactions([idA], [idB, correctedA], transactionCounts);
if (idMerged.length !== 2 || idMerged[0].amount !== -150 || idMerged[0].category !== "日用品" || idMerged[1].id !== "b") {
  throw new Error("IDが異なる正当な同額明細を保持し、同一IDの訂正版へ置換できません");
}
if (transactionCounts.added !== 1 || transactionCounts.updated !== 1 || transactionCounts.unchanged !== 0) {
  throw new Error("新規明細と訂正版の件数を正しく計数できません");
}
const unchangedCounts = { added: 0, updated: 0, unchanged: 0 };
context.mergeTransactions([idA], [{ ...idA }], unchangedCounts);
if (unchangedCounts.added !== 0 || unchangedCounts.updated !== 0 || unchangedCounts.unchanged !== 1) {
  throw new Error("同一ID・同一内容を変更なしとして計数できません");
}

const excludedA = context.mergeTransactions([idA, idB], [{ id: "a", excluded: true }]);
if (excludedA.length !== 1 || excludedA[0].id !== "b") {
  throw new Error("安定IDの計算対象外への訂正で対象明細だけを除外できません");
}
const restoredA = context.mergeTransactions(excludedA, [{ ...idA, amount: -100 }]);
if (restoredA.length !== 2 || restoredA.find((transaction) => transaction.id === "a")?.amount !== -100) {
  throw new Error("計算対象外にしたIDを後続の対象行で復帰できません");
}
const repeatedExclusion = context.mergeTransactions([idA, idB], [{ id: "a", excluded: true }, { id: "a", excluded: true }]);
if (repeatedExclusion.length !== 1 || repeatedExclusion[0].id !== "b") {
  throw new Error("期間重複した対象外行で別IDを保持できません");
}
const excludedAfterIncluded = context.mergeTransactions([idA, idB], [idA, { id: "a", excluded: true }]);
if (excludedAfterIncluded.length !== 1 || excludedAfterIncluded[0].id !== "b") {
  throw new Error("同一取込内で後にある対象外訂正を反映できません");
}

const periodOverlap = context.mergeTransactions([first, idA], [first, idA, idB]);
if (periodOverlap.length !== 3 || periodOverlap[2].id !== "b") {
  throw new Error("別名CSV相当の期間重複で既存行を重複させず、別ID明細を保持できません");
}

const nulInContent = { date: "2026-03-01", content: "店\0支店A", category: "食費", amount: -300 };
const nulCollision = { date: "2026-03-01", content: "店", category: "支店A\0食費", amount: -300 };
if (context.mergeTransactions([nulInContent], [nulCollision]).length !== 2) {
  throw new Error("NUL文字を含む異なる明細を重複排除しません");
}

const oldAsset = { date: "2026-01-31", total: 100, breakdown: [] };
const updatedAsset = { date: "2026-01-31", total: 200, breakdown: [] };
const nextAsset = { date: "2026-02-28", total: 300, breakdown: [] };
const mergedAssets = context.mergeAssets([oldAsset], [updatedAsset, nextAsset]);
if (mergedAssets.length !== 2 || mergedAssets.find((asset) => asset.date === oldAsset.date).total !== 200) {
  throw new Error("同日資産の更新版を最新の取込値へ置換できません");
}

console.log("Import merge checks passed.");
