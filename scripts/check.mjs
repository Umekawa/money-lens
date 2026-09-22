import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const required = ["index.html", "styles.css", "app.js"];
for (const file of required) await readFile(file, "utf8");

execFileSync(process.execPath, ["--check", "app.js"], { stdio: "inherit" });

const html = await readFile("index.html", "utf8");
if (!html.includes('src="app.js"')) throw new Error("index.html does not load app.js");
if (!html.includes('href="styles.css"')) throw new Error("index.html does not load styles.css");

const trackedCsv = execFileSync("git", ["ls-files", "*.csv"], { encoding: "utf8" }).trim();
if (trackedCsv) throw new Error(`Personal CSV is tracked by git: ${trackedCsv}`);

console.log("Local checks passed.");
