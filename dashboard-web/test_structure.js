// HTML 结构 + 函数完整性测试（不依赖 jsdom/canvas）
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('/Users/fy/WorkBuddy/2026-06-28-17-44-53/dashboard-web/DashboardCat_看板.html', 'utf-8');

// 1. 结构检查
const checks = [];
function check(name, cond) { checks.push({ name, ok: !!cond }); }

check('含 <!DOCTYPE html>', html.includes('<!DOCTYPE html>'));
check('含 <html lang="zh-CN">', html.includes('<html lang="zh-CN">'));
check('含 Chart.js 库代码', html.includes('Chart.js') || html.includes('"Chart"'));
check('含 XLSX 库代码 (XLSX.read)', html.includes('XLSX.read') || html.includes('XLSX.utils'));
check('含上传入口 file-input', html.includes('id="file-input"'));
check('含上传入口 file-input-2', html.includes('id="file-input-2"'));
check('含空状态 empty-state', html.includes('id="empty-state"'));
check('含看板容器 dashboard', html.includes('id="dashboard"'));
check('含筛选器 f-region', html.includes('id="f-region"'));
check('含筛选器 f-province', html.includes('id="f-province"'));
check('含指标卡 s-count', html.includes('id="s-count"'));
check('含指标卡 s-total', html.includes('id="s-total"'));
check('含图表 canvas chart-sales', html.includes('id="chart-sales"'));
check('含图表 canvas chart-sentiment', html.includes('id="chart-sentiment"'));
check('含图表 canvas chart-combo', html.includes('id="chart-combo"'));
check('含图表 canvas chart-hospital-detail', html.includes('id="chart-hospital-detail"'));
check('含交叉表 cross-table-body', html.includes('id="cross-table-body"'));
check('含主矩阵 mx-grid', html.includes('id="mx-grid"'));
check('含对比矩阵A cmp-grid-0', html.includes('id="cmp-grid-0"'));
check('含对比矩阵B cmp-grid-1', html.includes('id="cmp-grid-1"'));
check('含 tooltip mx-tip', html.includes('id="mx-tip"'));
check('含明细表 table-body', html.includes('id="table-body"'));
check('含单HP查询 hosp-code-input', html.includes('id="hosp-code-input"'));
check('无 CDN 引用', !html.includes('cdn.jsdelivr.net') && !html.includes('unpkg.com'));
check('无外部 script src', !html.includes('<script src='));
check('无残留占位符 CHARTJS_LIB', !html.includes('CHARTJS_LIB'));
check('无残留占位符 XLSX_LIB', !html.includes('XLSX_LIB'));
check('无残留占位符 APP_LOGIC', !html.includes('APP_LOGIC'));

// 2. 函数完整性检查（提取应用逻辑脚本，在沙箱里检查函数定义）
const scriptMatches = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
console.log('script 标签数:', scriptMatches.length);
// 应用逻辑是最后一个 script
const appLogic = scriptMatches[scriptMatches.length - 1].replace(/^<script>|<\/script>$/g, '');
const requiredFns = [
  'processWorkbook', 'handleFile', 'downloadTemplate', 'bootstrapDashboard',
  'initDropdowns', 'updateProvinceDropdown', 'applyFilters', 'updateSummary',
  'initCharts', 'updateCharts', 'renderTable', 'sortTable', 'renderCrossTable',
  'renderMatrix', 'renderMatrixGrid', 'renderCompare', 'mxShowTip', 'mxHideTip',
  'searchHospital', 'showHospitalDetail', 'sparklineSales', 'sparklineSent',
  'loadMainData', 'loadVfData', 'detectBadHospitals', 'interpolateSentiment',
  'buildHospitalData', 'classifySalesTrend', 'classifySentimentTrend', 'classifyAll',
  'computeRegression', 'sumHalf', 'qlabOf', 'sumQuarter', 'buildCellsGeneric',
  'cmpSliceOptions', 'buildSliceCells', 'populateSliceDropdown', 'onCmpDimChange',
  'onCmpSliceChange', 'initCompare', 'fmtNum', 'toggleMulti', 'getMultiSelected',
  'resetFilters'
];
requiredFns.forEach(fn => {
  check('函数 ' + fn + ' 已定义', appLogic.includes('function ' + fn) || appLogic.includes(fn + ' =') || appLogic.includes(fn + '('));
});

// 3. DOMContentLoaded 事件绑定
check('DOMContentLoaded 事件绑定', appLogic.includes('DOMContentLoaded'));

// 输出报告
const passed = checks.filter(c => c.ok).length;
const failed = checks.filter(c => !c.ok);
console.log('\n=== 结构与函数完整性测试 ===');
console.log('通过: ' + passed + '/' + checks.length);
if (failed.length > 0) {
  console.log('\n失败项:');
  failed.forEach(c => console.log('  ❌ ' + c.name));
}
console.log('\n=== ' + (failed.length === 0 ? '✅ 全部通过' : '❌ 有 ' + failed.length + ' 项失败') + ' ===');
process.exit(failed.length === 0 ? 0 : 1);
