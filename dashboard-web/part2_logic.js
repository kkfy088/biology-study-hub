// ===== 全局状态 =====
let RAW = null;
let MONTHS = [];
let HOSPITALS = [];
let INTERP = null;
let filteredHospitals = [];
let sortKey = 'total_sales';
let sortDir = -1;
let chartSales, chartSent, chartCombo, chartHospDetail;

const REGION_MAP = {
  "北京":"华北","天津":"华北","河北":"华北","山西":"华北","内蒙古":"华北",
  "上海":"华东","江苏":"华东","浙江":"华东","安徽":"华东","福建":"华东","江西":"华东","山东":"华东",
  "广东":"华南","广西":"华南","海南":"华南",
  "河南":"华中","湖北":"华中","湖南":"华中",
  "重庆":"西南","四川":"西南","贵州":"西南","云南":"西南","西藏":"西南",
  "陕西":"西北","甘肃":"西北","宁夏":"西北","新疆":"西北",
  "辽宁":"东北","吉林":"东北","黑龙江":"东北"
};
const SENTIMENT_MAP = {'一刀切':1,'部分限制':2,'科学管控':3,'一刀切;暂停':1,'暂停':1};
const SENTIMENT_VALUES = new Set([1,2,3]);
const MONTH_RE = /^(\d{2})AP(\d+)$/;

// ===== Excel 读取 =====
function sheetToRows(wb, name) {
  if (!wb.Sheets[name]) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[name], {header:1, raw:true, defval:null, blankrows:false});
}

function isMonthCol(h) { return typeof h === 'string' && MONTH_RE.test(h.trim()); }

function normalizeSentiment(v) {
  if (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) return null;
  if (typeof v === 'number') { const x = Math.round(v); return SENTIMENT_VALUES.has(x) ? x : null; }
  const s = String(v).trim();
  if (s === '' || s === '0') return null;
  if (SENTIMENT_MAP[s] !== undefined) return SENTIMENT_MAP[s];
  const x = parseInt(s, 10);
  return SENTIMENT_VALUES.has(x) ? x : null;
}
function normalizeSales(v) {
  if (v === null || v === undefined) return null;
  const x = parseFloat(v);
  return (typeof x === 'number' && !isNaN(x)) ? x : null;
}

function findCol(hdr, keyword) {
  // 在列名数组中找包含 keyword（不区分大小写）的列索引
  for (let i = 0; i < hdr.length; i++) {
    if (hdr[i].toLowerCase().includes(keyword)) return i;
  }
  return -1;
}

function loadMainData(rows1, rows2) {
  // rows1: 舆情 sheet (IV-限控tracking), rows2: 销量 sheet (IV-THHtracking)
  const hdr1 = rows1[0].map(h => h === null ? '' : String(h).trim());
  const hdr2 = rows2[0].map(h => h === null ? '' : String(h).trim());
  // 月份列：两张表都存在
  const months1 = hdr1.filter(isMonthCol);
  const months2 = new Set(hdr2.filter(isMonthCol));
  const months = months1.filter(m => months2.has(m));

  // 自动识别 code/name/province 列（支持 Hospital Code / HP Code 等多种命名）
  const codeIdx1 = findCol(hdr1, 'code');
  const nameIdx1 = findCol(hdr1, 'name');
  const provIdx1 = findCol(hdr1, 'province');
  const codeIdx2 = findCol(hdr2, 'code');

  // hospital_info
  const meta = {};
  const dataRows1 = rows1.slice(1);
  dataRows1.forEach(r => {
    const code = codeIdx1 >= 0 ? (r[codeIdx1] === null ? '' : String(r[codeIdx1]).trim()) : '';
    if (!code) return;
    const name = nameIdx1 >= 0 ? (r[nameIdx1] === null ? '' : String(r[nameIdx1]).trim()) : '';
    const prov = provIdx1 >= 0 ? (r[provIdx1] === null ? '' : String(r[provIdx1]).trim()) : '';
    const region = prov ? (REGION_MAP[prov] || '其他') : '';
    meta[code] = { name, province: prov, region };
  });

  // 构建长表
  const colIdx1 = m => hdr1.indexOf(m);
  const colIdx2 = m => hdr2.indexOf(m);
  const longRecords = [];
  // 舆情
  dataRows1.forEach(r => {
    const code = codeIdx1 >= 0 ? (r[codeIdx1] === null ? '' : String(r[codeIdx1]).trim()) : '';
    if (!code) return;
    const info = meta[code] || { name:'', province:'', region:'' };
    months.forEach(m => {
      const s = normalizeSentiment(r[colIdx1(m)]);
      longRecords.push({ code, name: info.name, province: info.province, region: info.region, month: m, sentiment: s, sales: null });
    });
  });
  // 销量
  const dataRows2 = rows2.slice(1);
  const salesMap = {}; // code|month -> sales
  dataRows2.forEach(r => {
    const code = codeIdx2 >= 0 ? (r[codeIdx2] === null ? '' : String(r[codeIdx2]).trim()) : '';
    if (!code) return;
    months.forEach(m => {
      const v = normalizeSales(r[colIdx2(m)]);
      salesMap[code + '|' + m] = v;
    });
  });
  longRecords.forEach(rec => { rec.sales = salesMap[rec.code + '|' + rec.month] !== undefined ? salesMap[rec.code + '|' + rec.month] : null; });

  return { months, longData: longRecords, hospitalInfo: meta };
}

function loadVfData(wb) {
  if (!wb.Sheets['VF占比']) return {};
  const rows = sheetToRows(wb, 'VF占比');
  if (!rows || rows.length < 2) return {};
  const hdr = rows[0].map(h => h === null ? '' : String(h).trim());
  const ni = hdr.indexOf('ACCOUNT_NAME');
  const vi = hdr.indexOf('VF在分子式中的占比');
  if (ni < 0 || vi < 0) return {};
  const map = {};
  for (let i = 1; i < rows.length; i++) {
    const nm = rows[i][ni];
    if (nm === null || nm === undefined) continue;
    const vf = rows[i][vi];
    map[String(nm).trim()] = vf === null ? null : vf;
  }
  return map;
}

// ===== 清洗：活跃窗口检测（连续缺失 > 3 剔除）=====
function detectBadHospitals(longData, months, maxGap) {
  maxGap = maxGap || 3;
  const byCode = {};
  longData.forEach(r => { (byCode[r.code] = byCode[r.code] || []).push(r); });
  const bad = new Set();
  Object.keys(byCode).forEach(code => {
    const grp = byCode[code].slice().sort((a,b) => months.indexOf(a.month) - months.indexOf(b.month));
    let firstIdx = -1, lastIdx = -1;
    for (let i = 0; i < grp.length; i++) { if (grp[i].sentiment !== null) { if (firstIdx < 0) firstIdx = i; lastIdx = i; } }
    if (firstIdx < 0) { bad.add(code); return; }
    let gap = 0;
    for (let i = firstIdx; i <= lastIdx; i++) {
      if (grp[i].sentiment === null) { gap++; if (gap > maxGap) { bad.add(code); break; } }
      else gap = 0;
    }
  });
  return bad;
}

// ===== 舆情插值（活跃窗口前半 ffill / 后半 bfill / 窗口外锚点填充）=====
function interpolateSentiment(longData, months) {
  const data = longData.slice().sort((a,b) => {
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    return months.indexOf(a.month) - months.indexOf(b.month);
  });
  const byCode = {};
  data.forEach((r, i) => { (byCode[r.code] = byCode[r.code] || []).push(i); });
  let missingBefore = 0;
  data.forEach(r => { if (r.sentiment === null) missingBefore++; });

  const sentIdx = data.map(r => r.sentiment);
  Object.keys(byCode).forEach(code => {
    const idxs = byCode[code];
    const n = idxs.length;
    const vals = idxs.map(i => sentIdx[i]);
    const nonNullPos = [];
    for (let i = 0; i < n; i++) if (vals[i] !== null) nonNullPos.push(i);
    if (nonNullPos.length === 0) { idxs.forEach(i => sentIdx[i] = 3); return; }
    const firstRel = nonNullPos[0], lastRel = nonNullPos[nonNullPos.length-1];
    const winLen = lastRel - firstRel + 1;
    const half = Math.floor(winLen / 2);
    // 前半段 ffill
    let lastVal = vals[firstRel];
    for (let k = firstRel; k < firstRel + half; k++) {
      if (vals[k] !== null) lastVal = vals[k];
      else sentIdx[idxs[k]] = lastVal;
    }
    // 后半段 bfill
    let nextVal = vals[lastRel];
    for (let k = lastRel; k >= firstRel + half; k--) {
      if (vals[k] !== null) nextVal = vals[k];
      else sentIdx[idxs[k]] = nextVal;
    }
    // 窗口之前
    const anchorFirst = vals[firstRel];
    for (let k = 0; k < firstRel; k++) sentIdx[idxs[k]] = anchorFirst;
    // 窗口之后
    const anchorLast = vals[lastRel];
    for (let k = lastRel + 1; k < n; k++) sentIdx[idxs[k]] = anchorLast;
  });
  // 写回
  let afterMissing = 0;
  data.forEach((r, i) => { r.sentiment = sentIdx[i]; if (r.sentiment === null) afterMissing++; });
  const filled = missingBefore - afterMissing;
  return { data, info: { before_missing: missingBefore, filled, after_missing: afterMissing,
    method: '活跃窗口前半ffill+后半bfill/奇数中间归后值+窗口外全局填充' } };
}

// ===== 构建每家 HP 的结构 =====
function buildHospitalData(data, months) {
  const byCode = {};
  data.forEach(r => { (byCode[r.code] = byCode[r.code] || []).push(r); });
  const records = [];
  Object.keys(byCode).forEach(code => {
    const grp = byCode[code].slice().sort((a,b) => months.indexOf(a.month) - months.indexOf(b.month));
    const first = grp[0];
    const salesArr = grp.map(r => r.sales);
    const sentArr = grp.map(r => r.sentiment);
    let total = 0;
    salesArr.forEach(v => { if (v !== null && !isNaN(v) && v > 0) total += v; });
    records.push({
      code, name: first.name, province: first.province, region: first.region,
      total_sales: total, sales: salesArr, sentiment: sentArr
    });
  });
  return records;
}

// ===== 趋势分类 =====
function sumAp16(salesArr, months, yr) {
  let s = 0;
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    if (m.slice(0,2) === yr) {
      const ap = parseInt(m.slice(4), 10);
      if (ap >= 1 && ap <= 6) { const v = salesArr[i]; if (v !== null && !isNaN(v) && v > 0) s += v; }
    }
  }
  return s;
}
function classifySalesTrend(h, months) {
  const s25 = sumAp16(h.sales, months, '25');
  const s26 = sumAp16(h.sales, months, '26');
  h.sales_25 = Math.round(s25 * 100) / 100;
  h.sales_26 = Math.round(s26 * 100) / 100;
  if (s25 <= 0 && s26 <= 0) return '数据缺失';
  if (s25 > 0 && s26 <= 0) return '业务丢失';
  if (s25 <= 0 && s26 > 0) return '上升';
  const rate = (s26 - s25) / s25;
  if (rate > 0.05) return '上升';
  if (rate < -0.05) return '下降';
  return '平稳';
}
function classifySentimentTrend(h, months) {
  let s25=0,c25=0,s26=0,c26=0;
  for (let i = 0; i < months.length; i++) {
    const v = h.sentiment[i];
    if (v === null) continue;
    // 只统计有销量的月份（销量为空=未来月份，不参与趋势判断）
    if (h.sales[i] === null) continue;
    if (months[i].slice(0,2) === '25') { s25 += v; c25++; }
    else if (months[i].slice(0,2) === '26') { s26 += v; c26++; }
  }
  if (c25 === 0 || c26 === 0) return '数据不足';
  const diff = (s26/c26) - (s25/c25);
  // 舆情值：1=最严重, 2=部分限制, 3=正常 → 数值变大=转好
  if (diff > 0.1) return '改善';
  if (diff < -0.1) return '恶化';
  return '稳定';
}
function classifyAll(hospitals, months) {
  hospitals.forEach(h => {
    h.sales_trend = classifySalesTrend(h, months);
    h.sentiment_trend = classifySentimentTrend(h, months);
  });
  const valid = hospitals.filter(h => h.sales_trend !== '数据缺失');
  return { valid, dropped: hospitals.length - valid.length };
}

// ===== 面板固定效应回归 =====
function computeRegression(hospitals, months) {
  const regData = [];
  hospitals.forEach(h => {
    for (let i = 0; i < months.length; i++) {
      const v = h.sales[i], s = h.sentiment[i];
      if (v === null || isNaN(v) || v <= 0) continue;
      if (s === null || isNaN(s)) continue;
      regData.push({ code: h.code, ln: Math.log(v), s1: s === 1 ? 1 : 0, s2: s === 2 ? 1 : 0 });
    }
  });
  if (regData.length < 100) return { beta_type1: null, beta_type2: null, n_obs: regData.length };
  // 组内 demean
  const gSum = {};
  regData.forEach(r => {
    if (!gSum[r.code]) gSum[r.code] = { ln:0, s1:0, s2:0, n:0 };
    const g = gSum[r.code]; g.ln += r.ln; g.s1 += r.s1; g.s2 += r.s2; g.n++;
  });
  const dm = regData.map(r => {
    const g = gSum[r.code];
    return { ln: r.ln - g.ln/g.n, s1: r.s1 - g.s1/g.n, s2: r.s2 - g.s2/g.n };
  });
  // 正规方程 (X'X) beta = X'y
  let xtx11=0,xtx12=0,xtx22=0,xty1=0,xty2=0;
  dm.forEach(d => { xtx11 += d.s1*d.s1; xtx12 += d.s1*d.s2; xtx22 += d.s2*d.s2; xty1 += d.s1*d.ln; xty2 += d.s2*d.ln; });
  const det = xtx11*xtx22 - xtx12*xtx12;
  if (Math.abs(det) < 1e-12) return { beta_type1: null, beta_type2: null, n_obs: regData.length };
  const b1 = (xtx22*xty1 - xtx12*xty2) / det;
  const b2 = (xtx11*xty2 - xtx12*xty1) / det;
  const pct1 = 100 * (Math.exp(b1) - 1);
  const pct2 = 100 * (Math.exp(b2) - 1);
  return { beta_type1: Math.round(pct1*10)/10, beta_type2: Math.round(pct2*10)/10, beta_type3: 'baseline', n_obs: regData.length };
}

// ===== 主处理入口 =====
function processWorkbook(wb) {
  const sn = wb.SheetNames;
  if (!sn.includes('IV-限控tracking') || !sn.includes('IV-THHtracking')) {
    throw new Error('Excel 缺少必要分表（需含 IV-限控tracking 与 IV-THHtracking）');
  }
  const rows1 = sheetToRows(wb, 'IV-限控tracking');
  const rows2 = sheetToRows(wb, 'IV-THHtracking');
  const { months, longData, hospitalInfo } = loadMainData(rows1, rows2);
  if (months.length === 0) throw new Error('未识别到月份列（需 24AP1 ~ 26AP12 格式的列名）');

  const bad = detectBadHospitals(longData, months);
  const cleanData = longData.filter(r => !bad.has(r.code));
  const { data: interpData, info: interpInfo } = interpolateSentiment(cleanData, months);
  const hospitalsRaw = buildHospitalData(interpData, months);
  const { valid: hospitals, dropped } = classifyAll(hospitalsRaw, months);
  const vfmap = loadVfData(wb);
  hospitals.forEach(h => { h.vf = vfmap[String(h.name).trim()] !== undefined ? vfmap[String(h.name).trim()] : null; });
  const reg = computeRegression(hospitals, months);

  RAW = {
    months, n_hospitals: hospitals.length, hospitals, interpolation_info: interpInfo, regression: reg
  };
  MONTHS = RAW.months;
  HOSPITALS = RAW.hospitals;
  INTERP = RAW.interpolation_info;
  return RAW;
}

// ===== 文件上传处理 =====
function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const raw = processWorkbook(wb);
      document.getElementById('status-chip').textContent = '已加载 ' + raw.n_hospitals + ' 家HP · ' + raw.months.length + ' 个月';
      document.getElementById('status-chip').style.background = 'rgba(39,174,96,.5)';
      document.getElementById('empty-state').style.display = 'none';
      document.getElementById('dashboard').style.display = 'block';
      const reg = raw.regression;
      document.getElementById('interp-info').textContent =
        `插值：缺失${INTERP.before_missing}→填充${INTERP.filled}→剩余${INTERP.after_missing} · 剔除${(raw.hospitals.length? Object.keys(HOSPITALS).length:0)}活跃度不足 · ` +
        (reg.beta_type1 !== null ? `面板回归：类型1 vs 3 = ${reg.beta_type1>=0?'+':''}${reg.beta_type1}%，类型2 vs 3 = ${reg.beta_type2>=0?'+':''}${reg.beta_type2}%（n=${reg.n_obs}）` : '');
      document.getElementById('sub-info').textContent = `${raw.n_hospitals}家HP · ${raw.months.length}个月 · 舆情缺失已插值 · 全部本地运算`;
      bootstrapDashboard();
    } catch (err) {
      alert('读取失败：' + err.message);
      console.error(err);
      document.getElementById('status-chip').textContent = '加载失败';
      document.getElementById('status-chip').style.background = 'rgba(231,76,60,.6)';
    }
  };
  reader.readAsArrayBuffer(file);
}

function bootstrapDashboard() {
  // 销毁旧图表
  [chartSales, chartSent, chartCombo, chartHospDetail].forEach(c => { try { c && c.destroy(); } catch(e){} });
  chartHospDetail = null;
  document.getElementById('hosp-detail-empty').style.display = 'block';
  document.getElementById('hosp-detail-wrap').style.display = 'none';
  document.getElementById('hosp-code-input').value = '';
  document.getElementById('hosp-name-display').textContent = '';
  // 重置筛选
  document.querySelectorAll('.mbtn.active').forEach(b => b.classList.remove('active'));
  document.getElementById('f-region').value = '';
  document.getElementById('f-sales-mode').value = 'sum';
  document.getElementById('table-search').value = '';
  sortKey = 'total_sales'; sortDir = -1;
  initDropdowns();
  initCharts();
  initCompare();
  applyFilters();
}

document.addEventListener('DOMContentLoaded', () => {
  ['file-input','file-input-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', e => handleFile(e.target.files[0]));
  });
});

// ===== 模板下载 =====
function downloadTemplate() {
  const months = ['24AP1','24AP2','24AP3','24AP4','24AP5','24AP6','24AP7','24AP8','24AP9','24AP10','24AP11','24AP12',
    '25AP1','25AP2','25AP3','25AP4','25AP5','25AP6','25AP7','25AP8','25AP9','25AP10','25AP11','25AP12',
    '26AP1','26AP2','26AP3','26AP4','26AP5','26AP6','26AP7','26AP8','26AP9','26AP10','26AP11','26AP12'];
  const wb = XLSX.utils.book_new();
  const hdr = ['HP Code','HP Name','Province'].concat(months);
  const ws1Data = [hdr, ['HP00001','示例HP名称','广东'].concat(months.map(() => 3))];
  const ws2Data = [hdr, ['HP00001','示例HP名称','广东'].concat(months.map(() => 100000))];
  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  const ws3 = XLSX.utils.aoa_to_sheet([['ACCOUNT_NAME','VF在分子式中的占比'],['示例HP名称',0.5]]);
  XLSX.utils.book_append_sheet(wb, ws1, 'IV-限控tracking');
  XLSX.utils.book_append_sheet(wb, ws2, 'IV-THHtracking');
  XLSX.utils.book_append_sheet(wb, ws3, 'VF占比');
  XLSX.writeFile(wb, 'DashboardCat_数据模板.xlsx');
}

// ===== 以下为看板渲染（沿用原逻辑）=====
function initDropdowns() {
  const regions = [...new Set(HOSPITALS.map(h => h.region))].sort();
  const regSel = document.getElementById('f-region');
  regSel.innerHTML = '<option value="">全部区域</option>';
  regions.forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = r; regSel.appendChild(o); });
  updateProvinceDropdown();
}
function updateProvinceDropdown() {
  const region = document.getElementById('f-region').value;
  const provSel = document.getElementById('f-province');
  const savedVal = provSel.value;
  provSel.innerHTML = '<option value="">全部省份</option>';
  let provs;
  if (region) provs = [...new Set(HOSPITALS.filter(h => h.region === region).map(h => h.province))].sort();
  else provs = [...new Set(HOSPITALS.map(h => h.province))].sort();
  provs.forEach(p => { const o = document.createElement('option'); o.value = p; o.textContent = p; provSel.appendChild(o); });
  if (savedVal && provs.includes(savedVal)) provSel.value = savedVal;
}
function getMultiSelected(groupId) {
  return Array.from(document.querySelectorAll('#' + groupId + ' .mbtn.active')).map(b => b.dataset.val);
}
function toggleMulti(btn) { btn.classList.toggle('active'); applyFilters(); }
function applyFilters() {
  if (!HOSPITALS.length) return;
  updateProvinceDropdown();
  const region = document.getElementById('f-region').value;
  const province = document.getElementById('f-province').value;
  const salesTrends = getMultiSelected('f-sales-trend');
  const sentTrends = getMultiSelected('f-sent-trend');
  filteredHospitals = HOSPITALS.filter(h => {
    if (region && h.region !== region) return false;
    if (province && h.province !== province) return false;
    if (salesTrends.length > 0 && !salesTrends.includes(h.sales_trend)) return false;
    if (sentTrends.length > 0 && !sentTrends.includes(h.sentiment_trend)) return false;
    return true;
  });
  updateSummary(); updateCharts(); renderTable(); renderCrossTable();
  renderMatrix(); renderCompare(0); renderCompare(1);
}

const SALES_TREND_ORDER = ['上升','下降','平稳','业务丢失','数据缺失'];
function renderCrossTable() {
  const groups = {};
  SALES_TREND_ORDER.forEach(t => groups[t] = []);
  filteredHospitals.forEach(h => { (groups[h.sales_trend] = groups[h.sales_trend] || []).push(h); });
  const rows = SALES_TREND_ORDER.filter(t => groups[t] && groups[t].length > 0).map(t => {
    const list = groups[t];
    const sum25 = list.reduce((s,h)=>s+(h.sales_25||0),0);
    const sum26 = list.reduce((s,h)=>s+(h.sales_26||0),0);
    const pct = sum25 > 0 ? (sum26 - sum25) / sum25 : null;
    const sentCnt = {};
    list.forEach(h => sentCnt[h.sentiment_trend] = (sentCnt[h.sentiment_trend]||0)+1);
    const domSent = Object.entries(sentCnt).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}${v}`).slice(0,3).join(' / ');
    const top5 = [...list].sort((a,b)=>(b.sales_26||0)-(a.sales_26||0)).slice(0,5).map(h=>`${h.name}（${(h.sales_26/1e4).toFixed(1)}）`).join('；');
    let pctHtml = '—';
    if (pct !== null) { const cls = pct >= 0 ? 'pct-up' : 'pct-down'; pctHtml = `<span class="${cls}">${pct>=0?'+':''}${(pct*100).toFixed(1)}%</span>`; }
    const tagCls = t==='上升'?'tag-up':t==='下降'?'tag-down':t==='平稳'?'tag-flat':t==='业务丢失'?'tag-lost':'tag-missing';
    return `<tr><td><span class="tag ${tagCls}">${t}</span></td>
      <td style="text-align:right;">${(sum25/1e4).toFixed(1)}</td><td style="text-align:right;">${(sum26/1e4).toFixed(1)}</td>
      <td style="text-align:right;">${pctHtml}</td><td style="text-align:right;">${list.length}</td>
      <td>${domSent||'—'}</td><td class="top5">${top5||'—'}</td></tr>`;
  });
  const all = filteredHospitals;
  const t25 = all.reduce((s,h)=>s+(h.sales_25||0),0), t26 = all.reduce((s,h)=>s+(h.sales_26||0),0);
  const tpct = t25>0 ? (t26-t25)/t25 : null;
  let tpctHtml = '—';
  if (tpct !== null) { const cls = tpct>=0?'pct-up':'pct-down'; tpctHtml = `<span class="${cls}">${tpct>=0?'+':''}${(tpct*100).toFixed(1)}%</span>`; }
  rows.push(`<tr style="background:#f0f7f5; font-weight:600;"><td>合计</td>
    <td style="text-align:right;">${(t25/1e4).toFixed(1)}</td><td style="text-align:right;">${(t26/1e4).toFixed(1)}</td>
    <td style="text-align:right;">${tpctHtml}</td><td style="text-align:right;">${all.length}</td><td>—</td><td>—</td></tr>`);
  document.getElementById('cross-table-body').innerHTML = rows.join('');
}
function resetFilters() {
  document.getElementById('f-region').value = '';
  document.getElementById('f-province').value = '';
  document.querySelectorAll('.mbtn.active').forEach(b => b.classList.remove('active'));
  document.getElementById('f-sales-mode').value = 'sum';
  applyFilters();
}
function fmtNum(n) {
  if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(2) + '亿';
  if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(1) + '万';
  return Math.round(n).toLocaleString();
}
function updateSummary() {
  const n = filteredHospitals.length;
  document.getElementById('s-count').textContent = n;
  let totalSales = 0;
  const monthlySums = new Array(MONTHS.length).fill(0);
  const monthlyCounts = new Array(MONTHS.length).fill(0);
  let sent1Count = 0, sent3Count = 0;
  filteredHospitals.forEach(h => {
    h.sales.forEach((v, i) => { if (v !== null) { totalSales += v; monthlySums[i] += v; monthlyCounts[i]++; } });
    h.sentiment.forEach(v => { if (v === 1) sent1Count++; if (v === 3) sent3Count++; });
  });
  document.getElementById('s-total').innerHTML = fmtNum(totalSales);
  const activeMonths = monthlyCounts.filter(c => c > 0).length || 1;
  document.getElementById('s-monthly').innerHTML = fmtNum(totalSales / activeMonths);
  document.getElementById('s-sent1').textContent = sent1Count;
  document.getElementById('s-sent3').textContent = sent3Count;
}

function initCharts() {
  const ctx1 = document.getElementById('chart-sales').getContext('2d');
  chartSales = new Chart(ctx1, {
    type: 'line',
    data: { labels: MONTHS, datasets: [{ label: '月度Rev', data: [], borderColor: '#0f3460', backgroundColor: 'rgba(15,52,96,0.08)', fill: true, tension: 0.3, pointRadius: 3, pointHoverRadius: 6, borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => 'Rev: ' + fmtNum(ctx.parsed.y) + ' 元' } } }, scales: { y: { beginAtZero: true, ticks: { callback: (v) => fmtNum(v) } }, x: { ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 } } } } }
  });
  const ctx2 = document.getElementById('chart-sentiment').getContext('2d');
  chartSent = new Chart(ctx2, {
    type: 'bar',
    data: { labels: MONTHS, datasets: [
      { label: '类型1（最严重）', data: [], backgroundColor: '#e74c3c', stack: 's' },
      { label: '类型2（部分限制）', data: [], backgroundColor: '#f39c12', stack: 's' },
      { label: '类型3（正常）', data: [], backgroundColor: '#27ae60', stack: 's' }
    ]},
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { mode: 'index' } }, scales: { x: { stacked: true, ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 } } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'HP数' } } } }
  });
  const ctx3 = document.getElementById('chart-combo').getContext('2d');
  chartCombo = new Chart(ctx3, {
    type: 'bar',
    data: { labels: MONTHS, datasets: [
      { type: 'line', label: '月度总Rev', data: [], borderColor: '#0f3460', backgroundColor: 'rgba(15,52,96,0.1)', fill: true, tension: 0.3, yAxisID: 'y-sales', borderWidth: 2, pointRadius: 3 },
      { type: 'line', label: '月度平均舆情类型', data: [], borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)', fill: false, tension: 0.3, yAxisID: 'y-sent', borderWidth: 2, pointRadius: 3 }
    ]},
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { font: { size: 12 } } }, tooltip: { callbacks: { label: (ctx) => ctx.dataset.yAxisID === 'y-sales' ? 'Rev: ' + fmtNum(ctx.parsed.y) + ' 元' : '平均舆情类型: ' + ctx.parsed.y.toFixed(2) + ' (1=最严重, 3=正常)' } } }, scales: { x: { ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 } } }, 'y-sales': { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: 'Rev（元）' }, ticks: { callback: (v) => fmtNum(v) }, grid: { drawOnChartArea: true } }, 'y-sent': { type: 'linear', position: 'right', min: 0.8, max: 3.2, title: { display: true, text: '平均舆情类型' }, grid: { drawOnChartArea: false }, ticks: { stepSize: 0.5 } } } }
  });
}
function updateCharts() {
  const mode = document.getElementById('f-sales-mode').value;
  let monthlySales = new Array(MONTHS.length).fill(0);
  let monthlyCounts = new Array(MONTHS.length).fill(0);
  let monthlySent = [new Array(MONTHS.length).fill(0), new Array(MONTHS.length).fill(0), new Array(MONTHS.length).fill(0)];
  let monthlySentSum = new Array(MONTHS.length).fill(0);
  let monthlySentCount = new Array(MONTHS.length).fill(0);
  filteredHospitals.forEach(h => {
    h.sales.forEach((v, i) => { if (v !== null && v !== 0) { monthlySales[i] += v; monthlyCounts[i]++; } });
    h.sentiment.forEach((v, i) => { if (v !== null) { monthlySent[v-1][i]++; monthlySentSum[i] += v; monthlySentCount[i]++; } });
  });
  if (mode === 'avg') { for (let i=0;i<MONTHS.length;i++) monthlySales[i] = monthlyCounts[i]>0 ? monthlySales[i]/monthlyCounts[i] : 0; }
  else if (mode === 'median') {
    monthlySales = new Array(MONTHS.length).fill(0);
    for (let i=0;i<MONTHS.length;i++) {
      let vals = filteredHospitals.map(h => h.sales[i]).filter(v => v !== null && v !== 0);
      if (vals.length > 0) { vals.sort((a,b)=>a-b); monthlySales[i] = vals.length%2===0 ? (vals[vals.length/2-1]+vals[vals.length/2])/2 : vals[Math.floor(vals.length/2)]; }
    }
  }
  chartSales.data.datasets[0].data = monthlySales;
  chartSales.data.datasets[0].label = mode==='sum'?'月度Rev求和':(mode==='avg'?'月度Rev均值':'月度Rev中位数');
  chartSales.update();
  chartSent.data.datasets[0].data = monthlySent[0];
  chartSent.data.datasets[1].data = monthlySent[1];
  chartSent.data.datasets[2].data = monthlySent[2];
  chartSent.update();
  chartCombo.data.datasets[0].data = monthlySales;
  chartCombo.data.datasets[1].data = monthlySentSum.map((s,i)=>monthlySentCount[i]>0?s/monthlySentCount[i]:null);
  chartCombo.update();
}
function sparklineSales(arr) {
  const w=90,h=28,pad=3;
  const vals = arr.filter(v => v !== null && v !== undefined);
  if (vals.length < 2) return '<svg width="'+w+'" height="'+h+'"></svg>';
  let mn=Math.min(...vals), mx=Math.max(...vals);
  if (mn===mx){mn-=1;mx+=1;}
  const range=mx-mn, stepX=(w-pad*2)/(arr.length-1);
  let path='', fillPath='', started=false, lastX=0;
  for (let i=0;i<arr.length;i++){
    const v=arr[i]; if (v===null||v===undefined) continue;
    const x=pad+i*stepX, y=pad+(1-(v-mn)/range)*(h-pad*2);
    if (!started){path+='M'+x.toFixed(1)+','+y.toFixed(1);started=true;} else {path+=' L'+x.toFixed(1)+','+y.toFixed(1);}
    lastX=x;
  }
  fillPath=path+' L'+lastX.toFixed(1)+','+(h-pad)+' L'+pad+','+(h-pad)+' Z';
  return '<svg width="'+w+'" height="'+h+'" style="display:block"><path d="'+fillPath+'" fill="rgba(15,52,96,0.12)" stroke="none"/><path d="'+path+'" fill="none" stroke="#0f3460" stroke-width="1.5" stroke-linejoin="round"/></svg>';
}
function sparklineSent(arr) {
  const w=90,h=28,pad=3; const colors={1:'#e74c3c',2:'#f39c12',3:'#27ae60'};
  const barW=(w-pad*2)/arr.length; let bars='';
  for (let i=0;i<arr.length;i++){
    const v=arr[i]; if (v===null||v===undefined) continue;
    const x=pad+i*barW, barH=(v/3)*(h-pad*2), y=h-pad-barH;
    bars+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+(barW*0.8).toFixed(1)+'" height="'+barH.toFixed(1)+'" fill="'+colors[v]+'" rx="0.5"/>';
  }
  return '<svg width="'+w+'" height="'+h+'" style="display:block">'+bars+'</svg>';
}
function renderTable() {
  const search = document.getElementById('table-search').value.toLowerCase();
  let list = filteredHospitals.filter(h => !search || h.name.toLowerCase().includes(search) || h.code.toLowerCase().includes(search));
  list.sort((a,b) => {
    let va=a[sortKey], vb=b[sortKey];
    if (sortKey==='vf'){va=va==null?-1:va;vb=vb==null?-1:vb;}
    if (typeof va==='string') return sortDir*va.localeCompare(vb);
    return sortDir*(va-vb);
  });
  document.getElementById('table-body').innerHTML = list.map(h => {
    const st=h.sales_trend, sent=h.sentiment_trend;
    return `<tr><td>${h.code}</td><td>${h.name}</td>
      <td style="text-align:right;">${h.vf!=null?(h.vf*100).toFixed(0)+'%':'—'}</td>
      <td>${h.province}</td><td>${h.region}</td>
      <td><span class="tag ${st==='上升'?'tag-up':st==='下降'?'tag-down':st==='平稳'?'tag-flat':st==='业务丢失'?'tag-lost':'tag-missing'}">${st}</span></td>
      <td><span class="tag ${sent==='改善'?'tag-improve':sent==='恶化'?'tag-worsen':sent==='稳定'?'tag-stable':'tag-insufficient'}">${sent}</span></td>
      <td class="spark-cell">${sparklineSales(h.sales)}</td>
      <td class="spark-cell">${sparklineSent(h.sentiment)}</td>
      <td style="text-align:right;">${fmtNum(h.total_sales)}</td></tr>`;
  }).join('');
}
function sortTable(key) { if (sortKey===key) sortDir*=-1; else { sortKey=key; sortDir=1; } renderTable(); }

// ===== 矩阵 =====
const MX_SALES=['上升','平稳','下降','业务丢失'];
const MX_SENT=['改善','稳定','恶化'];
const MX_DIRMAP={'上升':'↑ 增长','平稳':'→ 平稳','下降':'↓ 下降','业务丢失':'✕ 丢失'};
function sumHalf(h, yr) {
  let s=0;
  for (let i=0;i<MONTHS.length;i++){ const m=MONTHS[i]; if (m.slice(0,2)===yr){ const ap=parseInt(m.slice(4),10); if (ap>=1&&ap<=6){ const v=h.sales[i]; if (v&&v>0) s+=v; } } }
  return s;
}
function qlabOf(m){ return m.slice(0,2)+'·Q'+Math.ceil(parseInt(m.slice(4),10)/3); }
function sumQuarter(h, qlab){
  let s=0;
  for (let i=0;i<MONTHS.length;i++){ if (qlabOf(MONTHS[i])===qlab){ const v=h.sales[i]; if (v&&v>0) s+=v; } }
  return s;
}
function prevYearQuarter(qlab){ const yr=parseInt(qlab.slice(0,2),10), q=qlab.slice(3); return String(yr-1).padStart(2,'0')+'·'+q; }
function buildCellsGeneric(pool, fnA, fnB) {
  const cells = {};
  MX_SALES.forEach(st => MX_SENT.forEach(se => cells[st+'|'+se] = []));
  pool.forEach(h => { if (h.sales_trend === '数据缺失') return; const key = h.sales_trend+'|'+h.sentiment_trend; if (cells[key]) cells[key].push(h); });
  const out = {}; let gmax = 0;
  MX_SALES.forEach(st => MX_SENT.forEach(se => {
    const g = cells[st+'|'+se];
    let sA=0, sB=0; g.forEach(h => { sA += fnA(h); sB += fnB(h); });
    const mag = Math.max(sA, sB); if (mag > gmax) gmax = mag;
    const growth = Math.max(sB - sA, 0), loss = Math.max(sA - sB, 0);
    const rate = sA>0 ? (sB-sA)/sA : (sB>0?1:0);
    const withChg = g.map(h => ({ h, chg: fnB(h)-fnA(h), a: fnA(h), b: fnB(h) }));
    withChg.sort((x,y) => (loss>growth) ? x.chg-y.chg : y.chg-x.chg);
    out[st+'|'+se] = { st, se, count:g.length, sA, sB, mag, growth, loss, rate, top10: withChg.slice(0,10) };
  }));
  out.__max = gmax || 1;
  return out;
}
function mxBaseFill(st, rate) {
  const t = Math.min(Math.abs(rate), 1);
  if (st==='上升') return 'rgba(22,163,74,'+(0.14+0.34*t).toFixed(3)+')';
  if (st==='下降') return 'rgba(220,38,38,'+(0.14+0.34*t).toFixed(3)+')';
  if (st==='业务丢失') return '#7f1d1d';
  return 'rgba(120,118,110,0.30)';
}
function renderMatrixGrid(gridId, cells, gmax, cacheKey) {
  const colTot = {};
  MX_SENT.forEach(se => colTot[se] = MX_SALES.reduce((s,st)=>s+cells[st+'|'+se].mag,0));
  const grid = document.getElementById(gridId);
  if (!grid) return;
  let html = '<div class="mx-corner"></div>';
  MX_SENT.forEach(se => { html += '<div class="mx-colhead"><b>舆情'+se+'</b>体量 '+Math.round(colTot[se]/1e4)+'万</div>'; });
  MX_SALES.forEach(st => {
    html += '<div class="mx-rowlabel"><div><b>Rev'+st.replace('业务丢失','丢失')+'</b></div></div>';
    MX_SENT.forEach(se => {
      const d = cells[st+'|'+se];
      const side = Math.min(Math.sqrt(d.mag/gmax), 1);
      const blockW = (side*100).toFixed(1), blockH = (side*100).toFixed(1);
      const baseColor = mxBaseFill(st, d.rate);
      let chFrac=0, chColor='';
      if (st==='上升'){ chFrac=d.mag>0?d.growth/d.mag:0; chColor='#15803d'; }
      else if (st==='下降'){ chFrac=d.mag>0?d.loss/d.mag:0; chColor='#b91c1c'; }
      let blockInner='';
      if (chFrac>0) blockInner='<div class="mchange" style="height:'+(chFrac*100).toFixed(1)+'%;background:'+chColor+';opacity:.92;"></div>';
      const amtTxt = st==='上升'?'+'+Math.round(d.growth/1e4)+'万':(st==='下降'?'−'+Math.round(d.loss/1e4)+'万':(st==='业务丢失'?'丢失'+Math.round(d.loss/1e4)+'万':Math.round(d.sB/1e4)+'万'));
      const textColor = st==='业务丢失'?'#fff':'#1c1c1a';
      const showText = side>0.30 && d.count>0;
      const block = d.count>0 ? '<div class="mblock" style="width:'+blockW+'%;height:'+blockH+'%;background:'+baseColor+';">'+blockInner+'</div>' : '';
      const textEl = showText ? '<div class="mtext" style="color:'+textColor+';"><div class="dir">'+MX_DIRMAP[st]+'</div><div class="amt">'+amtTxt+'</div></div>' : '';
      html += '<div class="mcell">'+block+textEl+'<div class="mbadge" data-cache="'+cacheKey+'" data-key="'+st+'|'+se+'">'+d.count+'家</div></div>';
    });
  });
  grid.innerHTML = html;
  window.__mxCache = window.__mxCache || {};
  window.__mxCache[cacheKey] = cells;
  grid.querySelectorAll('.mbadge').forEach(b => {
    b.addEventListener('mouseenter', mxShowTip);
    b.addEventListener('mousemove', mxMoveTip);
    b.addEventListener('mouseleave', mxHideTip);
  });
}
function renderMatrix() {
  const cells = buildCellsGeneric(filteredHospitals, h=>sumHalf(h,'25'), h=>sumHalf(h,'26'));
  window.__mainGmax = cells.__max;
  renderMatrixGrid('mx-grid', cells, cells.__max, 'main');
}
const mxTip = () => document.getElementById('mx-tip');
function mxShowTip(e) {
  const cells = (window.__mxCache||{})[e.target.dataset.cache]; if (!cells) return;
  const d = cells[e.target.dataset.key]; if (!d || d.count===0) return;
  const rows = d.top10.map(o => {
    const cls = o.chg>=0?'up':'dn', sign = o.chg>=0?'+':'−';
    return '<tr><td class="n">'+o.h.name+'<span style="color:#aaa"> · '+o.h.province+'</span></td><td class="v">'+Math.round(o.a/1e4)+'→'+Math.round(o.b/1e4)+'</td><td class="v '+cls+'">'+sign+Math.abs(Math.round(o.chg/1e4))+'</td></tr>';
  }).join('');
  const summ = d.st==='上升'?'净增 +'+Math.round(d.growth/1e4)+'万':(d.st==='下降'?'净流失 '+Math.round(d.loss/1e4)+'万':(d.st==='业务丢失'?'完全丢失 '+Math.round(d.loss/1e4)+'万':'平稳'));
  mxTip().innerHTML = '<h4>Rev'+d.st+' × 舆情'+d.se+' · '+d.count+'家</h4><div style="color:#5f5e5a;margin-bottom:6px;">'+summ+' · 当前体量'+Math.round(d.sB/1e4)+'万 · Top10（基线→当前·万元）</div><table>'+rows+'</table>';
  mxTip().style.display='block'; mxMoveTip(e);
}
function mxMoveTip(e) {
  const t=mxTip(), pad=14, w=t.offsetWidth, h=t.offsetHeight;
  let x=e.clientX+pad, y=e.clientY+pad;
  if (x+w>window.innerWidth) x=e.clientX-w-pad;
  if (y+h>window.innerHeight) y=window.innerHeight-h-8;
  t.style.left=x+'px'; t.style.top=Math.max(8,y)+'px';
}
function mxHideTip(){ mxTip().style.display='none'; }

// ===== 对比矩阵 =====
const CMP_STATE = [{dim:'region',val:null},{dim:'quarter',val:null}];
const QUARTERS = (() => { const set=[]; MONTHS.forEach(m=>{const lab=qlabOf(m); if(!set.includes(lab)) set.push(lab);}); return set; })();
function cmpSliceOptions(dim) {
  if (dim==='region') return [...new Set(HOSPITALS.map(h=>h.region))].sort();
  if (dim==='province') return [...new Set(HOSPITALS.map(h=>h.province))].sort();
  if (dim==='quarter') return QUARTERS;
  return [];
}
function buildSliceCells(dim, val) {
  if (dim==='quarter') {
    const prev = prevYearQuarter(val), hasPrev = QUARTERS.includes(prev);
    return buildCellsGeneric(filteredHospitals, h=>hasPrev?sumQuarter(h,prev):0, h=>sumQuarter(h,val));
  }
  const pool = filteredHospitals.filter(h => h[dim]===val);
  return buildCellsGeneric(pool, h=>sumHalf(h,'25'), h=>sumHalf(h,'26'));
}
function populateSliceDropdown(idx) {
  const dim = CMP_STATE[idx].dim, opts = cmpSliceOptions(dim);
  const sel = document.getElementById('cmp-slice-'+idx);
  sel.innerHTML = opts.map(o=>'<option value="'+o+'">'+o+'</option>').join('');
  if (dim==='quarter') CMP_STATE[idx].val = opts.includes('26·Q2')?'26·Q2':opts[opts.length-1];
  else CMP_STATE[idx].val = opts[0];
  sel.value = CMP_STATE[idx].val;
}
function onCmpDimChange(idx) { CMP_STATE[idx].dim = document.getElementById('cmp-dim-'+idx).value; populateSliceDropdown(idx); renderCompare(idx); }
function onCmpSliceChange(idx) { CMP_STATE[idx].val = document.getElementById('cmp-slice-'+idx).value; renderCompare(idx); }
function renderCompare(idx) {
  const dim=CMP_STATE[idx].dim, val=CMP_STATE[idx].val, gridId='cmp-grid-'+idx, meta=document.getElementById('cmp-meta-'+idx);
  if (!val){ const g=document.getElementById(gridId); if(g) g.innerHTML=''; return; }
  const cells = buildSliceCells(dim, val);
  const gmax = window.__mainGmax || cells.__max;
  renderMatrixGrid(gridId, cells, gmax, 'cmp'+idx);
  let n=0, sA=0, sB=0;
  MX_SALES.forEach(st=>MX_SENT.forEach(se=>{ const d=cells[st+'|'+se]; n+=d.count; sA+=d.sA; sB+=d.sB; }));
  let txt;
  if (dim==='quarter') {
    const prev=prevYearQuarter(val), base=QUARTERS.includes(prev)?(' vs '+prev):' (无同比基线)';
    const chg=sA>0?Math.round((sB-sA)/sA*100):(sB>0?100:0);
    txt=n+'家 · '+val+'体量'+Math.round(sB/1e4)+'万'+base+(sA>0?('，同比'+(chg>=0?'+':'')+chg+'%'):'');
  } else {
    const chg=sA>0?Math.round((sB-sA)/sA*100):(sB>0?100:0);
    txt=n+'家 · 26体量'+Math.round(sB/1e4)+'万 · 同比'+(chg>=0?'+':'')+chg+'%';
  }
  if (meta) meta.textContent = txt;
}
function initCompare() { populateSliceDropdown(0); populateSliceDropdown(1); }

function searchHospital() {
  if (!HOSPITALS.length) return;
  const code = document.getElementById('hosp-code-input').value.trim().toUpperCase();
  if (!code) return;
  let h = HOSPITALS.find(x => x.code.toUpperCase() === code);
  if (!h) {
    const matches = HOSPITALS.filter(x => x.code.toUpperCase().includes(code) || x.name.includes(code));
    if (matches.length===1) h = matches[0];
    else if (matches.length>1) { document.getElementById('hosp-name-display').textContent='匹配到'+matches.length+'家，请输入完整编码'; document.getElementById('hosp-name-display').style.color='#e74c3c'; return; }
    else { document.getElementById('hosp-name-display').textContent='未找到编码 '+code; document.getElementById('hosp-name-display').style.color='#e74c3c'; return; }
  }
  showHospitalDetail(h);
}
function showHospitalDetail(h) {
  document.getElementById('hosp-code-input').value = h.code;
  document.getElementById('hosp-name-display').textContent = h.name;
  document.getElementById('hosp-name-display').style.color = '#0f3460';
  document.getElementById('hosp-detail-empty').style.display='none';
  document.getElementById('hosp-detail-wrap').style.display='block';
  const salesVals = h.sales.filter(v=>v!==null), salesNonZero = salesVals.filter(v=>v>0);
  document.getElementById('hd-sales-range').textContent = '总'+fmtNum(h.total_sales)+' · 月均'+fmtNum(salesNonZero.length>0?h.total_sales/salesNonZero.length:0);
  const sentVals = h.sentiment.filter(v=>v!==null);
  const sent1=sentVals.filter(v=>v===1).length, sent2=sentVals.filter(v=>v===2).length, sent3=sentVals.filter(v=>v===3).length;
  document.getElementById('hd-sent-summary').textContent = '严重'+sent1+'月 / 限制'+sent2+'月 / 正常'+sent3+'月';
  document.getElementById('hd-region-prov').textContent = h.region+' · '+h.province;
  document.getElementById('hd-sales-trend').textContent = h.sales_trend;
  document.getElementById('hd-sent-trend').textContent = h.sentiment_trend;
  if (chartHospDetail) chartHospDetail.destroy();
  const ctx = document.getElementById('chart-hospital-detail').getContext('2d');
  chartHospDetail = new Chart(ctx, {
    type: 'line',
    data: { labels: MONTHS, datasets: [
      { type:'bar', label:'月度Rev', data:h.sales, backgroundColor:h.sales.map(v=>v===null?'rgba(200,200,200,0.15)':(v<0?'rgba(231,76,60,0.4)':'rgba(15,52,96,0.35)')), borderColor:h.sales.map(v=>v===null?'rgba(200,200,200,0.15)':(v<0?'rgba(231,76,60,0.6)':'rgba(15,52,96,0.5)')), borderWidth:1, yAxisID:'y-sales', order:2 },
      { type:'line', label:'舆情类型', data:h.sentiment, borderColor:'#e74c3c', backgroundColor:'transparent', stepped:'before', tension:0, yAxisID:'y-sent', borderWidth:2, pointRadius:4, pointBackgroundColor:h.sentiment.map(v=>v===1?'#e74c3c':v===2?'#f39c12':v===3?'#27ae60':'#ccc'), pointBorderColor:'#fff', pointBorderWidth:1.5, fill:false, order:1 }
    ]},
    options: { responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, plugins:{ legend:{position:'bottom',labels:{font:{size:12},usePointStyle:true}}, tooltip:{ callbacks:{ label:(ctx)=>{ if(ctx.dataset.yAxisID==='y-sales'){ const v=ctx.parsed.y; return v===null?'Rev: 无数据':'Rev: '+fmtNum(v)+' 元'; } const v=ctx.parsed.y; const labels={1:'最严重（一刀切）',2:'部分限制',3:'正常（科学管控）'}; return '舆情: '+(labels[v]||'无数据'); } } } }, scales:{ x:{ticks:{maxRotation:45,minRotation:45,font:{size:10}}}, 'y-sales':{type:'linear',position:'left',beginAtZero:true,title:{display:true,text:'Rev（元）'},ticks:{callback:(v)=>fmtNum(v)},grid:{drawOnChartArea:true}}, 'y-sent':{type:'linear',position:'right',min:0.5,max:3.5,title:{display:true,text:'舆情类型'},grid:{drawOnChartArea:false},ticks:{stepSize:1,callback:(v)=>{const m={1:'1·严重',2:'2·限制',3:'3·正常'};return m[v]||'';}}} } }
  });
}
