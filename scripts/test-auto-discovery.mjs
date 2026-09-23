import { readFile } from "node:fs/promises";
import vm from "node:vm";
import assert from "node:assert/strict";

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
  URL,
  location: { href: "http://localhost:8765/" },
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

// 個人フォルダへアクセスせず、Python形式の一覧レスポンスを再現する。
const requests = [];
context.fetch = async url => {
  requests.push(url);
  if (!responses.has(url)) throw new Error(`想定外のアクセス: ${url}`);
  return responses.get(url);
};
responses.set("csv-manifest.json", { ok: false, status: 404 });
responses.set("http://localhost:8765/csvs/", { ok: true, text: async () => `
  <a href="../">親へ</a><a href="?sort=name">並べ替え</a>
  <a href="https://example.com/external.csv">外部</a>
  <a href="/other/">範囲外</a><a href="./">現在</a>
  <a href="broken%">不正な符号化</a>
  <a href="nested/">子フォルダ</a><a href="nested/">重複</a>
  <a href="notes.txt">CSV以外</a>
  <a href="%E8%B3%87%E7%94%A3%20%23%25&amp;test.csv">資産</a>
` });
responses.set("http://localhost:8765/csvs/nested/", { ok: true, text: async () => `
  <a href="../">親へ</a><a href='transactions.csv'>明細</a>
` });
const discovered = await context.readManifest();
assert.equal(discovered.length, 2);
assert.equal(discovered[0].url, "csvs/nested/transactions.csv");
assert.equal(discovered[1].name, "資産 #%&test.csv");
assert.equal(discovered[1].url, "csvs/%E8%B3%87%E7%94%A3%20%23%25%26test.csv");
assert.equal(requests.length, 3, "親・外部・重複ディレクトリを探索しない");

responses.set(discovered[0].url, { ok: true, blob: async () => new Blob([
  "日付,金額\n2026-06-30,-100\n",
]) });
responses.set(discovered[1].url, { ok: true, blob: async () => new Blob([
  "日付,合計（円）,預金（円）\n2026-06-30,500,500\n",
]) });
vm.runInNewContext("render=()=>{};globalThis.autoLoad=autoLoadCsvs;globalThis.importState=state;", context);
await context.autoLoad();
assert.equal(context.importState.transactions.length, 1);
assert.equal(context.importState.assets.length, 1);
assert.equal(context.importState.assets[0].total, 500);
assert.equal(context.importState.importMessages.length, 0);

requests.length = 0;
responses.set("csv-manifest.json", { ok: true, json: async () => ({ files: ["selected.csv"] }) });
assert.equal((await context.readManifest())[0].name, "selected.csv");
assert.deepEqual(requests, ["csv-manifest.json"], "指定済みマニフェストでは一覧を探索しない");
responses.set("csv-manifest.json", { ok: false, status: 500 });
await assert.rejects(context.readManifest(), /取得できません/);

responses.set("csv-manifest.json", { ok: false, status: 404 });
responses.set("http://localhost:8765/csvs/", { ok: true, text: async () => "<html>一覧なし</html>" });
await assert.rejects(context.readManifest(), /フォルダを選択/);
responses.set("http://localhost:8765/csvs/", { ok: false, status: 404 });
await assert.rejects(context.readManifest(), /フォルダを選択/);

console.log("Automatic CSV discovery checks passed.");
