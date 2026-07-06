// Node 测试：验证 JS 数据流水线与 Python 输出一致
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('/Users/fy/.workbuddy/binaries/node/workspace/node_modules/xlsx');

// 浏览器全局桩
const noopEl = new Proxy({}, { get: () => () => noopEl });
const documentStub = {
  addEventListener: () => {},
  getElementById: () => noopEl,
  querySelectorAll: () => []
};
function ChartStub(){ return { destroy(){}, update(){}, data:{datasets:[{data:[]}]} }; }

const ctx = {
  XLSX, document: documentStub, Chart: ChartStub,
  console, window: {}, Math, parseInt, parseFloat, isNaN, Set, Map, Array, Object, String, Number, Boolean, Date, RegExp, JSON, Math, Promise, Uint8Array, FileReader: function(){}
};
ctx.global = ctx;

const logic = fs.readFileSync('/Users/fy/WorkBuddy/2026-06-28-17-44-53/dashboard-web/part2_logic.js', 'utf-8');
vm.createContext(ctx);
vm.runInContext(logic, ctx);

// 读取 demo_data.xlsx
const data = fs.readFileSync('/Users/fy/WorkBuddy/2026-06-28-17-44-53/review-assistance/demo_data.xlsx');
const wb = XLSX.read(data, { type: 'buffer' });
console.log('Sheets:', wb.SheetNames);

const raw = ctx.processWorkbook(wb);
console.log('--- 流水线结果 ---');
console.log('HP 数:', raw.n_hospitals);
console.log('月份数:', raw.months.length, '首3:', raw.months.slice(0,3));
console.log('插值:', JSON.stringify(raw.interpolation_info));
console.log('回归:', JSON.stringify(raw.regression));

// 趋势分布
const dist = {};
raw.hospitals.forEach(h => { dist[h.sales_trend] = (dist[h.sales_trend]||0)+1; });
console.log('Rev趋势分布:', dist);
const sdist = {};
raw.hospitals.forEach(h => { sdist[h.sentiment_trend] = (sdist[h.sentiment_trend]||0)+1; });
console.log('舆情趋势分布:', sdist);

// province/region 非空率
const provNonEmpty = raw.hospitals.filter(h => h.province && h.province !== '').length;
const regNonEmpty = raw.hospitals.filter(h => h.region && h.region !== '').length;
console.log('province 非空:', provNonEmpty + '/' + raw.n_hospitals);
console.log('region 非空:', regNonEmpty + '/' + raw.n_hospitals);

// VF 匹配率
const vfMatched = raw.hospitals.filter(h => h.vf !== null && h.vf !== undefined).length;
console.log('VF 匹配:', vfMatched + '/' + raw.n_hospitals);

// 样本 HP
const h0 = raw.hospitals[0];
console.log('样本HP:', h0.code, '|', h0.name, '| prov=' + h0.province, '| reg=' + h0.region, '| trend=' + h0.sales_trend, '/', h0.sentiment_trend, '| sales_len=' + h0.sales.length, '| sent_len=' + h0.sentiment.length);

// 校验
const ok = raw.n_hospitals === 408 && raw.months.length === 35 && provNonEmpty === 408 && regNonEmpty === 408;
console.log('\n=== ' + (ok ? '✅ 核心校验通过' : '❌ 校验失败') + ' ===');
if (!ok) process.exit(1);
