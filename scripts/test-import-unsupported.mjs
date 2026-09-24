import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const context = { File, Map, Math, Set, TextDecoder, Intl, URLSearchParams };
vm.runInNewContext(`${source}\n;globalThis.loadFiles = load; globalThis.importState = state;`, context);

const bad = new File(["foo,bar\na,b"], "bad.csv");
await context.loadFiles([bad]);
await context.loadFiles([bad]);
if (context.importState.importResults.slice(-1)[0].status !== "失敗"
  || !context.importState.importResults.slice(-1)[0].reason.includes("対応していない")) {
  throw new Error("Unsupported CSV retry did not retain its failure reason");
}
if (context.importState.loadedFiles.size !== 0) throw new Error("Unsupported CSV was counted as loaded");

const corrected = new File(["日付,内容,金額\n2026-01-01,試験,100"], "bad.csv");
await context.loadFiles([corrected]);
if (context.importState.importResults.slice(-1)[0].status !== "成功"
  || context.importState.transactions.length !== 1) throw new Error("Corrected CSV could not be retried");
await context.loadFiles([corrected]);
if (context.importState.importResults.slice(-1)[0].duplicate !== 1) throw new Error("Valid duplicate was not distinguished");

const headerOnly = new File(["日付,内容,金額"], "empty.csv");
await context.loadFiles([headerOnly]);
if (context.importState.importResults.slice(-1)[0].status !== "成功"
  || !context.importState.importResults.slice(-1)[0].reason.includes("有効なデータがありません")) {
  throw new Error("Header-only CSV was not distinguished from an invalid format");
}

console.log("Unsupported import checks passed.");
