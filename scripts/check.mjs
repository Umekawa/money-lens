import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const required = ["index.html", "styles.css", "app.js"];
for (const file of required) await readFile(file, "utf8");

execFileSync(process.execPath, ["--check", "app.js"], { stdio: "inherit" });

const html = await readFile("index.html", "utf8");
if (!html.includes('src="app.js"')) throw new Error("index.html does not load app.js");
if (!html.includes('href="styles.css"')) throw new Error("index.html does not load styles.css");

const trackedCsv = execFileSync("git", ["ls-files", "*.csv"], { encoding: "utf8" })
  .trim()
  .split(/\r?\n/)
  .filter((file) => file && !file.replaceAll("\\", "/").startsWith("samples/"));
if (trackedCsv.length) throw new Error(`Personal CSV is tracked by git: ${trackedCsv.join(", ")}`);

execFileSync(process.execPath, ["scripts/test-samples.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-category.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-monthly-scale.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-import-merge.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-import-resilience.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-import-columns.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-import-large-invalid.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-import-amount.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-import-date.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-import-assets-schema.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-folder-file-filter.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-demo-mode.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-import-progress.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-auto-discovery.mjs"], { stdio: "inherit" });
for (const test of ["safe-changes", "review", "required-checks", "check-reruns", "selection", "discovery-record"]) {
  execFileSync("pwsh", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
    `$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); & './scripts/test-autodev-${test}.ps1'`,
  ], { stdio: "inherit" });
}

execFileSync(process.execPath, ["scripts/test-file-startup.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/build-pages.mjs"], { stdio: "inherit" });
const publicApp = await readFile("pages-dist/app.js", "utf8");
if (!publicApp.includes("const publicDemoEnabled=true;") || publicApp.includes("const publicDemoEnabled=false;")) {
  throw new Error("公開成果物で公開デモモードが有効になっていません");
}

execFileSync(process.execPath, ["scripts/test-print-transactions.mjs"], { stdio: "inherit" });

console.log("Local checks passed.");
