import { execFileSync, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const port = 8765;
const baseUrl = `http://127.0.0.1:${port}/?demo=1`;
const createIssue = process.argv.includes("--create-issue");
const server = spawn("python", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { stdio: "ignore", windowsHide: true });
let serverExit;
server.once("exit", (code, signal) => { serverExit = `ローカルサーバーが終了しました (${code ?? signal})`; });

const waitForServer = async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (serverExit) throw new Error(serverExit);
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
    await page.waitForFunction(() => document.querySelector("#loadSummary")?.textContent === "読み込み 2ファイル・明細 7件");
    if (!(await page.locator("#demoBadge").isVisible())) throw new Error("デモバッジが表示されません");
    if (!(await page.locator("#demoNotice").isVisible())) throw new Error("デモ案内が表示されません");
    if ((await page.locator("#monthlyTrend .trend-month").count()) === 0) throw new Error("月別推移が表示されません");
    if ((await page.locator(".asset-bar").count()) === 0) throw new Error("資産グラフが表示されません");
    if ((await page.locator("#loadSummary").textContent()) !== "読み込み 2ファイル・明細 7件") throw new Error("デモデータの読み込み件数が想定と異なります");
    if ((await page.locator("#income").textContent()) !== "￥560,000") throw new Error("収入の集計結果が想定と異なります");
    if ((await page.locator("#expense").textContent()) !== "￥142,000") throw new Error("支出の集計結果が想定と異なります");
    if ((await page.locator("#balance").textContent()) !== "￥418,000") throw new Error("収支の集計結果が想定と異なります");

    const search = page.locator("#search");
    await search.fill("給与");
    if ((await page.locator("#transactions tr").count()) !== 2) throw new Error("明細検索結果の件数が想定と異なります");
    await search.fill("存在しない監査文字列");
    if (!(await page.getByText("該当する明細がありません").isVisible())) throw new Error("検索結果なしの表示がありません");

    const monthSelect = page.locator("#monthSelect");
    if ((await monthSelect.locator("option").count()) < 2) throw new Error("月選択の候補がありません");
    await search.fill("");
    await monthSelect.selectOption({ index: 1 });
    if ((await monthSelect.inputValue()) === "all") throw new Error("月選択が反映されません");
    if ((await page.locator("#income").textContent()) !== "￥280,000" || (await page.locator("#expense").textContent()) !== "￥27,000" || (await page.locator("#balance").textContent()) !== "￥253,000") {
      throw new Error("月選択後の集計結果が想定と異なります");
    }
    if ((await page.locator("#transactions tr").count()) !== 3) throw new Error("月選択後の明細件数が想定と異なります");

    const asset = page.locator(".asset-bar").first();
    await asset.click();
    await asset.focus();
    await asset.press("Enter");
    if (!(await page.locator("#assetDetail").textContent()).includes("普通預金")) throw new Error("資産内訳が表示されません");

    page.once("dialog", dialog => dialog.accept());
    await page.locator("#clearData").click();
    if (!(await page.locator("#emptyState").isVisible())) throw new Error("データクリア後の空状態が表示されません");
    await page.locator("#emptyDemoData").click();
    await page.locator("#dashboard").waitFor({ state: "visible" });
    if (!(await page.locator("#demoBadge").isVisible())) throw new Error("デモデータの再取込に失敗しました");
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
      const issueBatchPath = "artifacts/ui-audit/issue-batch.json";
      await writeFile(issueBatchPath, JSON.stringify([{ title: "UI監査で問題を検出", body }]), "utf8");
      const wrapper = process.platform === "win32" ? "pwsh.exe" : "pwsh";
      execFileSync(wrapper, ["-File", "scripts/autodev.ps1", "-IssueBatchPath", issueBatchPath], { stdio: "inherit" });
      console.log("autodev.ps1 経由でIssue登録を依頼しました");
    } catch (issueError) {
      console.error(`Issue作成に失敗しました: ${issueError.message}`);
    }
  }
  process.exitCode = 1;
}
