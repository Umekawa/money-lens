import { readFile } from "node:fs/promises";

function parseCsv(source) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const transactions = parseCsv(await readFile("samples/transactions.csv", "utf8"));
assert(transactions.length === 5, "明細サンプルはヘッダーと4行であること");
assert(transactions[0].join(",") === "日付,内容,大項目,金額,計算対象", "明細ヘッダーが想定と異なること");
assert(transactions.slice(1).every((row) => row[4] === "1"), "明細の計算対象が読み込めること");
assert(transactions.slice(1).reduce((sum, row) => sum + Number(row[3]), 0) === 165000, "明細金額を集計できること");

const assets = parseCsv(await readFile("samples/assets.csv", "utf8"));
assert(assets.length === 3, "資産サンプルはヘッダーと2行であること");
assert(assets[0].join(",") === "日付,普通預金,投資信託,合計", "資産ヘッダーが想定と異なること");
assert(assets.slice(1).map((row) => Number(row[3])).join(",") === "1720000,1925000", "資産合計を読み込めること");

console.log("Sample CSV checks passed.");
