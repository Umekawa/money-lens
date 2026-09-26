import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";

const outputDir = "pages-dist";
const publicFiles = ["index.html", "styles.css", "app.js", "favicon.svg"];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const file of publicFiles) {
  if (file === "app.js") {
    const app = await readFile(file, "utf8");
    const configured = app.replace("const publicDemoEnabled=false;", "const publicDemoEnabled=true;");
    if (configured === app) throw new Error("The public demo setting could not be enabled");
    await writeFile(`${outputDir}/${file}`, configured);
  } else {
    await cp(file, `${outputDir}/${file}`);
  }
}

const publishedFiles = (await readdir(outputDir)).sort();
if (publishedFiles.join("\n") !== publicFiles.slice().sort().join("\n")) {
  throw new Error(`Unexpected GitHub Pages files: ${publishedFiles.join(", ")}`);
}

const html = await readFile(`${outputDir}/index.html`, "utf8");
if (!html.includes('src="app.js"') || !html.includes('href="styles.css"') || !html.includes('href="favicon.svg"')) {
  throw new Error("The Pages artifact is missing an application asset reference");
}
const app = await readFile(`${outputDir}/app.js`, "utf8");
if (!app.includes("const publicDemoEnabled=true;") || app.includes("const publicDemoEnabled=false;")) {
  throw new Error("The Pages artifact must explicitly enable public demo mode");
}

console.log(`GitHub Pages artifact: ${publishedFiles.join(", ")}`);
