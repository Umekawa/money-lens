import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const events = new Map();
const context = { File, window: { addEventListener: (name, handler) => events.set(name, handler) } };
vm.runInNewContext(await readFile('app.js', 'utf8'), context);
const nodes = Object.fromEntries(['search', 'clearSearch', 'monthSelect', 'transactionSummary', 'transactions', 'transactionPagination'].map(id => [`#${id}`, { value: '', innerHTML: '' }]));
context.document = { querySelector: selector => nodes[selector] };
nodes['#monthSelect'].value = '2026-09';
nodes['#search'].value = '印刷対象';
vm.runInNewContext(`state.transactions = Array.from({length: 650}, (_, i) => ({date:'2026-09-01', content:'印刷対象'+i, category:'テスト', amount:-100}));
state.transactions.push({date:'2026-08-01',content:'印刷対象・別月',category:'テスト',amount:-100},{date:'2026-09-01',content:'除外する明細',category:'テスト',amount:-100});
state.transactionPage=2; renderTransactions();`, context);
const countRows = () => (nodes['#transactions'].innerHTML.match(/<tr>/g) || []).length;
assert.equal(countRows(), 300);
const original = nodes['#transactions'].innerHTML;
for (let i = 0; i < 2; i++) {
  events.get('beforeprint')();
  assert.equal(countRows(), 650);
  assert.equal(nodes['#transactionPagination'].innerHTML, '');
  assert.ok(!nodes['#transactions'].innerHTML.includes('別月'));
  assert.ok(!nodes['#transactions'].innerHTML.includes('除外する明細'));
  events.get('afterprint')();
  assert.equal(nodes['#transactions'].innerHTML, original);
  assert.equal(vm.runInNewContext('state.transactionPage', context), 2);
}
console.log('Print transaction pagination and filter checks passed.');
