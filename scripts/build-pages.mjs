import { cp, mkdir, readdir, readFile, rm } from "node:fs/promises";

const outputDir = "pages-dist";
const publicFiles = ["index.html", "styles.css", "app.js"];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const file of publicFiles) {
  await cp(file, `${outputDir}/${file}`);
}

const publishedFiles = (await readdir(outputDir)).sort();
if (publishedFiles.join("\n") !== publicFiles.slice().sort().join("\n")) {
  throw new Error(`Unexpected GitHub Pages files: ${publishedFiles.join(", ")}`);
}

const html = await readFile(`${outputDir}/index.html`, "utf8");
if (!html.includes('src="app.js"') || !html.includes('href="styles.css"')) {
  throw new Error("The Pages artifact is missing an application asset reference");
}

console.log(`GitHub Pages artifact: ${publishedFiles.join(", ")}`);
