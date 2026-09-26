// 個人CSVやHTTPサーバーを使わず、本体の大量データ時の挙動を測定する。
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { platform, release, cpus, totalmem } from 'node:os';
import { chromium } from 'playwright';

const publicFiles = Object.fromEntries(await Promise.all(
  ['index.html', 'app.js', 'styles.css'].map(async name => [name, await readFile(name, 'utf8')])
));
const output = 'artifacts/scale-audit';
const options = process.argv.slice(2);
const repeats = Number(options.find(x => x.startsWith('--repeat='))?.split('=')[1] || 1);
const tag = options.find(x => x.startsWith('--tag='))?.slice(6) || '';
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5 || !/^[a-z0-9-]*$/.test(tag)) {
  throw new Error('--repeatは1〜5、--tagは英小文字・数字・ハイフンで指定してください。');
}
const resultPath = `${output}/results${tag ? `-${tag}` : ''}.json`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = {
  environment: {
    node: process.version, browser: browser.version(), platform: platform(), release: release(),
    cpu: cpus()[0]?.model, logicalCpus: cpus().length, ramGiB: Math.round(totalmem() / 1024 ** 3),
    sourceSha256: createHash('sha256').update(publicFiles['app.js']).digest('hex'),
    generatedAt: new Date().toISOString(),
    note: '合成データ。生成時間を取込時間から除外。heapは操作後・強制GC後の保持量でありピークではない。探索的測定。',
    repeats
  },
  cases: []
};
const plans = [
  { name: 'transactions-10k', rows: 10000 },
  { name: 'transactions-100k', rows: 100000 },
  { name: 'transactions-300k', rows: 300000 },
  { name: 'transactions-100k-cpu4', rows: 100000, cpuRate: 4 },
  { name: 'files-1', rows: 30000, files: 1 },
  { name: 'files-30', rows: 30000, files: 30 },
  { name: 'files-300', rows: 30000, files: 300 },
  { name: 'duplicate-files-1', rows: 10000, files: 1, duplicates: true, contentLength: 300 },
  { name: 'duplicate-files-30', rows: 10000, files: 30, duplicates: true, contentLength: 300 },
  { name: 'invalid-10k', rows: 10000, invalid: true },
  { name: 'invalid-50k', rows: 50000, invalid: true },
  { name: 'invalid-150k-mixed', rows: 150000, invalid: true, mixed: true },
  { name: 'assets-150k', rows: 150000, assets: true },
  { name: 'cancel-single-300k', rows: 300000, cancel: true },
  { name: 'history-60-months', rows: 60, history: true }
];
const selected = options.filter(x => !x.startsWith('--'));

try {
  if (selected.some(name => !plans.some(p => p.name === name))) throw new Error('不明な測定条件です。');
  for (const plan of plans.filter(p => !selected.length || selected.includes(p.name))
    .flatMap(p => Array.from({ length: repeats }, (_, i) => ({ ...p, sample: i + 1 })))) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('https://scale.invalid/**', route => {
      const name = new URL(route.request().url()).pathname.slice(1) || 'index.html';
      return route.fulfill({ status: publicFiles[name] ? 200 : 404,
        contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html',
        body: publicFiles[name] || '' });
    });
    await page.goto('https://scale.invalid/?demo=1');
    await page.waitForFunction(() => state.transactions.length === 7 && state.assets.length === 2);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    if (plan.cpuRate) await cdp.send('Emulation.setCPUThrottlingRate', { rate: plan.cpuRate });
    const heap = async () => {
      await cdp.send('HeapProfiler.collectGarbage');
      const { metrics } = await cdp.send('Performance.getMetrics');
      return Math.round(metrics.find(m => m.name === 'JSHeapUsedSize').value / 1024 ** 2 * 10) / 10;
    };
    const baselineHeapMiB = await heap();
    const preparation = await page.evaluate(async plan => {
      const header = '日付,内容,大項目,金額,計算対象\n';
      const row = i => {
        const month = plan.history ? i : i % 60;
        const date = `${2021 + Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, '0')}-${String(i % 28 + 1).padStart(2, '0')}`;
        return `${plan.invalid ? '2026-99-99' : date},合成明細${i}${'x'.repeat(plan.contentLength || 0)},カテゴリ${i % 12},-${i % 1000 + 1},1`;
      };
      globalThis.auditFiles = [];
      const count = plan.files || 1;
      const size = plan.duplicates ? plan.rows : Math.ceil(plan.rows / count);
      for (let f = 0; f < count; f++) {
        const start = plan.duplicates ? 0 : f * size;
        const end = plan.duplicates ? plan.rows : Math.min(plan.rows, start + size);
        const lines = Array.from({ length: end - start }, (_, offset) => row(start + offset));
        const csv = plan.assets
          ? '日付,預金,合計\n' + Array.from({ length: plan.rows }, () => '2026-01-01,100,100').join('\n')
          : header + lines.join('\n');
        auditFiles.push(new File([csv], `synthetic-${f}.csv`));
      }
      if (plan.history) auditFiles.push(new File(['日付,合計\n' + Array.from({ length: 60 }, (_, i) => `${2021 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}-01,${100 + i}`).join('\n')], 'history-assets.csv'));
      if (plan.mixed) {
        await load([new File([header + '2026-01-01,seed,食費,-100,1'], 'seed.csv')]);
        const invalidText = await auditFiles[0].text();
        auditFiles[0] = new File([header + '2026-01-01,seed,食費,-100,1\n2026-01-02,new,食費,-200,1\n' + invalidText.slice(header.length)], 'mixed.csv');
      }
      return { fileCount: auditFiles.length, bytes: auditFiles.reduce((n, f) => n + f.size, 0) };
    }, plan);
    const measurement = await page.evaluate(async plan => {
      const duration = { render: 0, merge: 0, renderCalls: 0, mergeCalls: 0 };
      const realRender = render, realMerge = mergeTransactions;
      render = function(...args) { const t = performance.now(); try { return realRender(...args); } finally { duration.render += performance.now() - t; duration.renderCalls++; } };
      mergeTransactions = function(...args) { const t = performance.now(); try { return realMerge(...args); } finally { duration.merge += performance.now() - t; duration.mergeCalls++; } };
      const longTasks = [];
      const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(e => e.duration)));
      observer.observe({ type: 'longtask' });
      let previous = performance.now(), maxHeartbeatGapMs = 0;
      const beat = setInterval(() => { const now = performance.now(); maxHeartbeatGapMs = Math.max(maxHeartbeatGapMs, now - previous); previous = now; }, 16);
      let cancelExecutedMs = null, activeAtCancel = null;
      const t = performance.now();
      const work = load(auditFiles);
      if (plan.cancel) setTimeout(() => {
        cancelExecutedMs = performance.now() - t;
        activeAtCancel = state.importProgress.active;
        document.querySelector('#cancelImport').click();
      }, 50);
      await work;
      const importMs = performance.now() - t;
      await new Promise(resolve => setTimeout(resolve, 100));
      clearInterval(beat); observer.disconnect();
      const time = operation => { const start = performance.now(); operation(); document.body.offsetHeight; return Math.round((performance.now() - start) * 10) / 10; };
      const timeSearch = async operation => { const start = performance.now(); operation(); if (searchTimer) await new Promise(resolve => setTimeout(resolve, 140)); document.body.offsetHeight; return Math.round((performance.now() - start) * 10) / 10; };
      const search = document.querySelector('#search');
      const input = value => { search.value = value; search.dispatchEvent(new Event('input', { bubbles: true })); };
      const operations = {};
      if (!plan.invalid && !plan.assets && !plan.history) {
        operations.searchMatchingMs = await timeSearch(() => input('合成明細'));
        operations.searchNoMatchMs = await timeSearch(() => input('存在しない項目'));
        operations.searchClearMs = await timeSearch(() => input(''));
        operations.typeFiveCharactersMs = await timeSearch(() => { for (const text of ['合', '合成', '合成明', '合成明細', '合成明細9']) input(text); });
        input('');
        if (searchTimer) await new Promise(resolve => setTimeout(resolve, 140));
        operations.nextPageMs = time(() => document.querySelector('[data-page="next"]')?.click());
        operations.monthFilterMs = time(() => setMonthFilter('2025-01'));
        setMonthFilter('all');
      }
      if (plan.invalid) operations.errorsExpandMs = time(() => document.querySelector('#importStatus summary')?.click());
      const history = plan.history ? {
        storedAssets: state.assets.length, visibleAssets: document.querySelectorAll('.asset-bar').length,
        firstVisibleAsset: document.querySelector('.asset-bar')?.dataset.date,
        firstVisibleMonth: document.querySelector('.trend-label')?.textContent,
        monthOptions: document.querySelector('#monthSelect').options.length,
        beforeFilter: document.querySelector('#assetMeta').textContent
      } : null;
      if (plan.history) { setMonthFilter('2021-01'); history.afterFilter = document.querySelector('#assetMeta').textContent; history.visibleOldAsset = !!document.querySelector('[data-date="2021-01-01"]'); }
      const snapshot = {
        plan, importMs: Math.round(importMs), maxHeartbeatGapMs: Math.round(maxHeartbeatGapMs),
        longestTaskMs: Math.round(Math.max(0, ...longTasks)), longTaskCount: longTasks.length,
        timings: Object.fromEntries(Object.entries(duration).map(([k, v]) => [k, Math.round(v)])), operations,
        transactions: state.transactions.length, assets: state.assets.length, errorMessages: state.importMessages.length,
        expense: state.transactions.reduce((sum, x) => sum + (x.amount < 0 ? -x.amount : 0), 0),
        results: state.importResults.length < 4 ? state.importResults : { count: state.importResults.length, last: state.importResults.at(-1) },
        domNodes: document.querySelectorAll('*').length, resultNodes: document.querySelector('#importStatus').querySelectorAll('*').length,
        sourceCharactersRetained: [...state.loadedFiles].reduce((n, key) => n + key.length, 0),
        cancelExecutedMs: cancelExecutedMs === null ? null : Math.round(cancelExecutedMs), activeAtCancel,
        seedCopies: plan.mixed ? state.transactions.filter(x => x.content === 'seed').length : null, history
      };
      auditFiles = null;
      return snapshot;
    }, plan);
    measurement.baselineHeapMiB = baselineHeapMiB;
    measurement.retainedHeapMiB = await heap();
    measurement.domCounters = await cdp.send('Memory.getDOMCounters');
    measurement.preparation = preparation;
    measurement.pageErrors = pageErrors;
    if (plan.name === 'transactions-100k') {
      measurement.mobile = await page.evaluate(() => ({ pages: Math.ceil(state.transactions.length / 300) }));
      await page.setViewportSize({ width: 390, height: 844 });
      measurement.mobile = { ...measurement.mobile, ...await page.evaluate(() => ({
        paginationY: Math.round(document.querySelector('#transactionPagination').getBoundingClientRect().top + scrollY),
        pageHeight: document.body.scrollHeight
      })) };
    }
    await page.evaluate(() => { globalThis.confirm = () => true; clearData(); });
    measurement.afterClearHeapMiB = await heap();
    measurement.afterClearDomCounters = await cdp.send('Memory.getDOMCounters');
    measurement.afterClearResultNodes = await page.locator('#importStatus *').count();
    report.cases.push(measurement);
    await writeFile(resultPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(measurement));
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`測定結果: ${resultPath}`);
