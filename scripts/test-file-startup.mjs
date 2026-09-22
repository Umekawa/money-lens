import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const elements = new Map();
const context = {
  File, Map, Math, Set, TextDecoder, Intl, URLSearchParams,
  location: { protocol: "file:", hostname: "", search: "" },
  document: {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, { hidden: true, addEventListener() {} });
      return elements.get(selector);
    },
  },
  fetch() { throw new Error("file:で自動取得してはいけません"); },
};
vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state;`, context);
assert.equal(elements.get("#localFileNotice").hidden, false, "直接開いた場合は手動選択を案内する");
assert.equal(context.importState.loadGeneration, 0, "自動取得を開始しない");
assert.equal(context.importState.importMessages.length, 0, "起動時の読み込みエラーを発生させない");

// 実データを使わず、手動選択後の読み込み経路も確認する。
delete context.document;
await context.loadFiles([new File([
  "日付,内容,大項目,金額\n2026-06-30,テスト,その他,-100\n",
], "manual.csv")]);
assert.equal(context.importState.transactions.length, 1);
assert.equal(context.importState.transactions[0].amount, -100);
console.log("File startup checks passed.");
