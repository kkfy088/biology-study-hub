// jsdom 端到端渲染测试：加载 HTML → 模拟上传 → 校验 DOM 渲染
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('/Users/fy/.workbuddy/binaries/node/workspace/node_modules/jsdom');

const html = fs.readFileSync('/Users/fy/WorkBuddy/2026-06-28-17-44-53/dashboard-web/DashboardCat_看板.html', 'utf-8');
const xlsxData = fs.readFileSync('/Users/fy/WorkBuddy/2026-06-28-17-44-53/review-assistance/demo_data.xlsx');

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;

// 桩：canvas / raf
window.HTMLCanvasElement.prototype.getContext = function () { return null; };
window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
window.cancelAnimationFrame = (id) => clearTimeout(id);
// 桩：FileReader
window.FileReader = class {
  readAsArrayBuffer(file) {
    setTimeout(() => this.onload({ target: { result: xlsxData.buffer.slice(xlsxData.byteOffset, xlsxData.byteOffset + xlsxData.byteLength) } }), 0);
  }
};
window.URL.createObjectURL = () => 'blob:stub';
window.alert = (m) => console.log('[alert]', m);

// 提取 HTML 中内联脚本，按顺序执行，但跳过 Chart.js（用 stub 代替）
const scripts = dom.window.document.querySelectorAll('script');
console.log('HTML 中 script 数:', scripts.length);
const ctx = dom.getInternalVMContext();
let idx = 0;
for (const s of scripts) {
  const code = s.textContent;
  if (!code.trim()) continue;
  idx++;
  // Chart.js 脚本很大且依赖 canvas，跳过
  if (code.length > 150000 && code.includes('Chart')) {
    console.log('跳过 Chart.js（' + (code.length/1024).toFixed(0) + 'KB），注入 stub');
    continue;
  }
  try { vm.runInContext(code, ctx); }
  catch (e) { console.error('脚本' + idx + '错误:', e.message); }
}

// 注入 Chart stub（在应用逻辑已执行后，handleFile 调用前替换）
window.Chart = function(c, opts) {
  this.data = opts && opts.data || { datasets: [{ data: [] }, { data: [] }, { data: [] }] };
  this.update = function() {}; this.destroy = function() {}; this.resize = function() {};
  return this;
};
window.Chart.register = function() {};
window.Chart.defaults = { font: {}, color: '#000' };
console.log('Chart stub 已注入');

// 触发 DOMContentLoaded
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

// 模拟上传
console.log('\n--- 模拟上传 demo_data.xlsx ---');
try { window.handleFile({ name: 'demo_data.xlsx', size: xlsxData.length }); }
catch (e) { console.error('handleFile 错误:', e.message); }

// 等异步
setTimeout(() => {
  const doc = window.document;
  console.log('\n--- 渲染结果 ---');
  console.log('dashboard display:', doc.getElementById('dashboard').style.display);
  console.log('empty-state display:', doc.getElementById('empty-state').style.display);
  console.log('状态条:', doc.getElementById('status-chip').textContent);
  console.log('指标卡 HP数:', doc.getElementById('s-count').textContent);
  console.log('指标卡 总Rev:', doc.getElementById('s-total').textContent);
  console.log('指标卡 严重舆情月数:', doc.getElementById('s-sent1').textContent);
  console.log('明细表行数:', doc.querySelectorAll('#table-body tr').length);
  console.log('交叉表行数:', doc.querySelectorAll('#cross-table-body tr').length);
  console.log('主矩阵 cell 数:', doc.querySelectorAll('#mx-grid .mcell').length);
  console.log('对比矩阵A cell 数:', doc.querySelectorAll('#cmp-grid-0 .mcell').length);
  console.log('对比矩阵B cell 数:', doc.querySelectorAll('#cmp-grid-1 .mcell').length);

  const hp = parseInt(doc.getElementById('s-count').textContent, 10);
  const rows = doc.querySelectorAll('#table-body tr').length;
  const mxCells = doc.querySelectorAll('#mx-grid .mcell').length;
  const ok = hp === 408 && rows === 408 && mxCells === 12;
  console.log('\n=== ' + (ok ? '✅ 端到端渲染测试通过' : '❌ 测试失败') + ' ===');
  process.exit(ok ? 0 : 1);
}, 800);
