import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import vm from "node:vm";

const app = await readFile("app.js", "utf8");
assert.ok(app.includes("const height=Math.abs(Number(value))/max*50"), "棒高は金額に比例させる");
assert.ok(!app.includes("Math.max(4,Math.abs(Number(value))/max*50)"), "非ゼロ棒の最小高さを設けない");

const max = 1_000_000;
const height = (value) => Math.abs(value) / max * 50;
assert.equal(height(1) / height(max), 1 / 1_000_000, "1円と100万円の高さ比を保つ");
assert.equal(height(250_000), height(-250_000), "同額の正負は同じ絶対高");
assert.equal(height(250_000), 12.5, "同額は同じ高さ");
assert.equal(height(0), 0, "ゼロは棒を描かない");
assert.ok(app.includes("value<0n?'top:50%;bottom:auto;':'top:auto;bottom:50%;'"), "正負の棒をゼロ線の反対側に描く");
console.log("Monthly trend scale checks passed.");

const context=vm.createContext({console,File});
vm.runInContext(app,context);
const rows=[
  {date:'2024-12-31',amount:100},
  {date:'2025-01-01',amount:200},
  {date:'2025-03-31',amount:-50},
  {date:'2025-04-01',amount:300},
  {date:'2026-03-31',amount:-400},
  {date:'2026-04-01',amount:500},
];
context.rows=rows;
const aggregate=mode=>Array.from(vm.runInContext(`trendData(rows,'${mode}')`,context),([key,v])=>[key,v.income,v.expense,v.balance]);
assert.deepEqual(aggregate('year'),[
  ['2024年',100n,0n,100n],['2025年',500n,50n,450n],['2026年',500n,400n,100n],
], '暦年は1月1日で区切る');
assert.deepEqual(aggregate('fiscal'),[
  ['2024年度',300n,50n,250n],['2025年度',300n,400n,-100n],['2026年度',500n,0n,500n],
], '年度は4月1日で区切り、翌年3月31日まで含める');
assert.equal(aggregate('month').length,6,'月別も保持する');
context.rows=[];
assert.deepEqual(aggregate('fiscal'),[],'空のデータは年を生成しない');
context.rows=[{date:'2025-04-01',amount:Number.MAX_SAFE_INTEGER},{date:'2026-03-31',amount:2}];
assert.equal(aggregate('fiscal')[0][3],9007199254740993n,'年次集計も整数精度を保つ');
console.log('年間・年度集計の境界・空データ・整数精度チェックに成功');
