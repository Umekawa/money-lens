import { execFileSync, spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const port = 8765;
const baseUrl = `http://127.0.0.1:${port}/?demo=1`;
const createIssue = process.argv.includes("--create-issue");
const gh = process.env.GH_BIN || (process.platform === "win32" ? "C:\\Program Files\\GitHub CLI\\gh.exe" : "gh");
const server = spawn("python", ["-m", "http.server", String(port)], { stdio: "ignore", windowsHide: true });

const waitForServer = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      if ((await fetch(baseUrl)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("ローカルサーバーを起動できませんでした");
};

const runAudit = async () => {
  let browser;
  try {
    await waitForServer();
    await mkdir("artifacts/ui-audit", { recursive: true });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#dashboard").waitFor({ state: "visible" });
    if (!(await page.locator("#demoBadge").isVisible())) throw new Error("デモバッジが表示されません");
    if (!(await page.locator("#demoNotice").isVisible())) throw new Error("デモ案内が表示されません");
    if ((await page.locator("#monthlyTrend .trend-month").count()) === 0) throw new Error("月別推移が表示されません");
    if ((await page.locator(".asset-bar").count()) === 0) throw new Error("資産グラフが表示されません");

    const search = page.locator("#search");
    await search.fill("給与");
    if ((await page.locator("#transactions tr").count()) === 0) throw new Error("明細検索結果が表示されません");
    await search.fill("存在しない監査文字列");
    if (!(await page.getByText("該当する明細がありません").isVisible())) throw new Error("検索結果なしの表示がありません");

    const monthSelect = page.locator("#monthSelect");
    if ((await monthSelect.locator("option").count()) < 2) throw new Error("月選択の候補がありません");
    await monthSelect.selectOption({ index: 1 });
    if ((await monthSelect.inputValue()) === "all") throw new Error("月選択が反映されません");

    const asset = page.locator(".asset-bar").first();
    await asset.click();
    await asset.focus();
    await asset.press("Enter");
    await page.screenshot({ path: "artifacts/ui-audit/desktop.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle" });
    await page.screenshot({ path: "artifacts/ui-audit/mobile.png", fullPage: true });
    const widths = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
    if (widths.body > widths.viewport + 1) throw new Error(`スマホ幅で横スクロールが発生しています (${widths.body}px > ${widths.viewport}px)`);

    console.log("UI audit passed. Screenshots: artifacts/ui-audit/");
  } finally {
    await browser?.close();
    server.kill();
  }
};

try {
  await runAudit();
} catch (error) {
  console.error(`UI監査失敗: ${error.message}`);
  if (createIssue) {
    const body = [
      "## 概要",
      "匿名デモをPlaywrightで操作するUI監査で問題を検出しました。",
      "",
      "## 実行結果",
      `- ${error.message}`,
      "- URL: http://127.0.0.1:8765/?demo=1",
      "- スクリーンショット: artifacts/ui-audit/",
      "",
      "## 注意",
      "個人CSV、金額、口座名などの個人情報は含めていません。",
    ].join("\n");
    try {
      const url = execFileSync(gh, ["issue", "create", "--repo", "Umekawa/money-lens", "--title", "UI監査で問題を検出", "--body", body], { encoding: "utf8" }).trim();
      console.log(`Issueを作成しました: ${url}`);
    } catch (issueError) {
      console.error(`Issue作成に失敗しました: ${issueError.message}`);
    }
  }
  process.exitCode = 1;
}
