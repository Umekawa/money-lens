import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("app.js", "utf8");
const responses = new Map([
  ["csv-manifest.json", { ok: true, json: async () => ({ files: ["収支/2026.csv", "資産.csv"] }) }],
]);
const context = {
  File,
  Map,
  Math,
  Set,
  TextDecoder,
  Intl,
  URLSearchParams,
  fetch: async url => responses.get(url) ?? { ok: false },
};
vm.runInNewContext(`${source}\n;globalThis.readManifest = loadCsvManifest;`, context);

const files = await context.readManifest();
if (files.length !== 2 || decodeURIComponent(files[0].url) !== "csvs/収支/2026.csv" || files[1].name !== "資産.csv") {
  throw new Error("CSVマニフェストから相対パスを解決できません");
}

responses.set("csv-manifest.json", { ok: true, json: async () => ({ files: ["../秘密.csv"] }) });
await context.readManifest().then(
  () => { throw new Error("CSVディレクトリ外のパスを許可しています"); },
  error => {
    if (!error.message.includes("csvs/ 配下")) throw error;
  },
);

responses.set("csv-manifest.json", { ok: false });
await context.readManifest().then(
  () => { throw new Error("マニフェスト取得失敗を検出できません"); },
  error => {
    if (!error.message.includes("フォルダを選択")) throw error;
  },
);

console.log("Automatic CSV discovery checks passed.");
