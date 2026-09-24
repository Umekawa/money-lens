import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

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
