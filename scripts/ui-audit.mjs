import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { chromium } from "playwright";

const createIssue = process.argv.includes("--create-issue");
const allowedFiles = new Map([["/", "index.html"], ["/index.html", "index.html"], ["/styles.css", "styles.css"], ["/app.js", "app.js"]]);
const serverToken = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let server;
let baseUrl;

const startServer = async () => {
  const files = new Map(await Promise.all([...new Set(allowedFiles.values())].map(async file => [file, await readFile(file)])));
  server = createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    if (pathname === "/__ui_audit_health") {
      response.writeHead(request.headers["x-ui-audit-token"] === serverToken ? 204 : 404, { "Cache-Control": "no-store" });
      response.end();
      return;
    }
    const file = allowedFiles.get(pathname);
    if (!file || !["GET", "HEAD"].includes(request.method)) {
      response.writeHead(404, { "Cache-Control": "no-store" });
      response.end();
      return;
    }
    const type = file.endsWith(".html") ? "text/html; charset=utf-8" : file.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8";
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(request.method === "HEAD" ? undefined : files.get(file));
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("ローカルサーバーの起動がタイムアウトしました")), 5000);
    server.once("error", error => { clearTimeout(timeout); reject(new Error(`ローカルサーバーを起動できませんでした: ${error.message}`)); });
    server.listen(0, "127.0.0.1", () => { clearTimeout(timeout); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("ローカルサーバーのポートを取得できませんでした");
  baseUrl = `http://127.0.0.1:${address.port}/?demo=1`;
};

const waitForServer = async () => {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    try {
      const response = await fetch(new URL("/__ui_audit_health", baseUrl), { headers: { "X-UI-Audit-Token": serverToken }, signal: AbortSignal.timeout(500) });
      if (response.status === 204) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("自分のローカルサーバーを確認できませんでした（タイムアウト）");
};

const runAudit = async () => {
  let browser;
  try {
    await startServer();
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
    await search.fill("82,000");
    if ((await page.locator("#transactions tr").count()) !== 1 || !(await page.locator("#transactions").textContent()).includes("家賃")) throw new Error("金額による明細検索が想定どおりに動作しません");
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
    for (const width of [1280, 820, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const bar = page.locator(".asset-bar").first();
      await bar.hover();
      const detail = page.locator("#assetDetail");
      const bounds = await detail.boundingBox();
      const plot = await page.locator(".asset-plot").boundingBox();
      if (!bounds || bounds.x < 0 || bounds.x + bounds.width > width || bounds.y < plot.y + plot.height - 1) throw new Error("資産内訳が" + width + "px幅でグラフ直下・画面内に配置されません");
      await bar.focus();
      if (!(await detail.isVisible())) throw new Error("フォーカスで資産内訳を開けません");
      await bar.press("Escape");
      if (await detail.isVisible()) throw new Error("Escapeで資産内訳が閉じません");
      await bar.click();
      await page.locator(".asset-detail-close").click();
      if (await detail.isVisible()) throw new Error("閉じる操作で資産内訳が閉じません");
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    page.once("dialog", dialog => dialog.accept());
    await page.locator("#clearData").click();
    if (!(await page.locator("#emptyState").isVisible())) throw new Error("データクリア後の空状態が表示されません");
    const clearedDom = await page.locator("#dashboard").evaluate(element => element.outerHTML) + await page.locator("#importProgress").evaluate(element => element.outerHTML);
    for (const oldValue of ["給与", "￥280,000", "デモ明細.csv", "普通預金", "data-value="]) {
      if (clearedDom.includes(oldValue)) throw new Error(`データクリア後のDOMに旧データが残っています: ${oldValue}`);
    }
    if (await page.locator("#emptyDemoData").evaluate(element => element !== document.activeElement)) throw new Error("データクリア後のフォーカスが空状態の操作へ移動していません");
    await page.locator("#emptyDemoData").click();
    await page.locator("#dashboard").waitFor({ state: "visible" });
    if (!(await page.locator("#demoBadge").isVisible())) throw new Error("デモデータの再取込に失敗しました");
    if (!(await page.locator("#transactions").textContent()).includes("給与")) throw new Error("クリア後の再取込で明細が復元されません");

    // Exercise the real file input using generated, non-personal CSV data.
    const rows = Array.from({ length: 301 }, (_, index) => `2026-03-${String(index % 28 + 1).padStart(2, "0")},監査明細${index + 1},食費,-100,1`);
    const syntheticCsv = `日付,内容,大項目,金額,計算対象\n${rows.join("\n")}`;
    await page.locator("#fileInput").setInputFiles({ name: "ui-audit-synthetic.csv", mimeType: "text/csv", buffer: Buffer.from(syntheticCsv, "utf8") });
    await page.waitForFunction(() => document.querySelector("#loadSummary")?.textContent.includes("明細 301件"));
    if ((await page.locator("#expense").textContent()) !== "￥30,100") throw new Error("合成CSVの集計結果が想定と異なります");
    if ((await page.locator("#transactions tr").count()) !== 300) throw new Error("1ページ目の明細件数が想定と異なります");
    await page.locator('#transactionPagination [data-page="next"]').click();
    const pageInput = page.locator('#transactionPagination .page-input');
    if ((await page.locator("#transactions tr").count()) !== 1 || (await pageInput.inputValue()) !== "2" || (await pageInput.getAttribute("max")) !== "2") throw new Error("明細のページ送りが想定どおりに動作しません");
    await pageInput.fill("1.5");
    await pageInput.press("Tab");
    if ((await pageInput.inputValue()) !== "1" || (await page.locator("#transactions tr").count()) !== 300) throw new Error("小数ページ番号が整数に補正されません");
    await pageInput.fill("2");
    await pageInput.press("Tab");
    if ((await pageInput.inputValue()) !== "2" || (await page.locator("#transactions tr").count()) !== 1) throw new Error("ページ番号の直接入力が反映されません");
    await page.locator("#search").fill("監査明細301");
    if ((await page.locator("#transactions tr").count()) !== 1) throw new Error("取込後の検索が想定どおりに動作しません");
    await page.locator("#search").fill("");
    await page.locator("#monthSelect").selectOption("2026-03");
    if ((await page.locator("#transactions tr").count()) !== 300) throw new Error("取込後の月指定が想定どおりに動作しません");
    await page.locator("#monthSelect").selectOption("all");
    await page.locator("#fileInput").setInputFiles({ name: "ui-audit-reload.csv", mimeType: "text/csv", buffer: Buffer.from("日付,内容,大項目,金額,計算対象\n2026-04-01,再取込,収入,500,1", "utf8") });
    await page.waitForFunction(() => document.querySelector("#loadSummary")?.textContent.includes("明細 302件"));
    const cancelledCsv = Buffer.from("日付,内容,大項目,金額,計算対象\n2026-05-01,中止対象,食費,-100,1", "utf8");
    await page.locator("#fileInput").setInputFiles(Array.from({ length: 20 }, (_, index) => ({
      name: `ui-audit-cancel-${index + 1}.csv`, mimeType: "text/csv", buffer: cancelledCsv,
    })));
    await page.locator("#cancelImport").waitFor({ state: "visible" });
    await page.locator("#cancelImport").click();
    await page.locator("#cancelImport").waitFor({ state: "hidden" });
    if ((await page.locator("#loadSummary").textContent()).includes("明細 322件")) throw new Error("読み込み中止後も後続ファイルが取り込まれました");
    page.once("dialog", dialog => dialog.accept());
    await page.locator("#clearData").click();
    if (!(await page.locator("#emptyState").isVisible())) throw new Error("実CSV導線のクリアに失敗しました");
    await page.screenshot({ path: "artifacts/ui-audit/desktop.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle" });
    await page.screenshot({ path: "artifacts/ui-audit/mobile.png", fullPage: true });
    await page.locator(".asset-bar").first().click();
    if (!(await page.locator("#assetDetail").textContent()).includes("普通預金")) throw new Error("モバイル幅で資産内訳が表示されません");
    const widths = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
    if (widths.body > widths.viewport + 1) throw new Error(`スマホ幅で横スクロールが発生しています (${widths.body}px > ${widths.viewport}px)`);
    await page.locator("#emptyFileInput").setInputFiles({ name: "ui-audit-mobile.csv", mimeType: "text/csv", buffer: Buffer.from("日付,内容,大項目,金額,計算対象\n2026-03-01,長い金額確認,食費,-999999999,1", "utf8") });
    await page.waitForFunction(() => document.querySelector("#loadSummary")?.textContent.includes("明細 1件"));
    const loadedWidths = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
    if ((await page.locator("#expense").textContent()) !== "￥999,999,999" || loadedWidths.body > loadedWidths.viewport + 1) throw new Error("モバイル幅で長い金額が正しく表示されません");

    console.log("UI audit passed. Screenshots: artifacts/ui-audit/");
  } finally {
    try {
      await browser?.close();
    } finally {
      if (server?.listening) await new Promise(resolve => server.close(resolve));
    }
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
      `- URL: ${baseUrl ?? "ローカルサーバー起動前"}`,
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
