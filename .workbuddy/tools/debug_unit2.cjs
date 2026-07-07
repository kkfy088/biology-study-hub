#!/usr/bin/env node
/**
 * unit2.html 静态+动态 debug 脚本 (v2)
 * 改进：
 *  - 不调用任何 alert/prompt/confirm（避免 headless 阻塞）
 *  - 捕获 console.log/error/exception
 *  - 用 DOM 分析代替截图（截图后无法读取）
 *  - 每个测试都返回详细 JSON 而不是 true/false
 */
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const CDP_HTTP = 'http://127.0.0.1:9222';
const TARGET_URL = 'http://localhost:8765/unit2.html';
const REPORT_PATH = '/tmp/unit2_debug_report.json';

let nextId = 1;
function cdpCall(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const onMsg = (data) => {
      const msg = JSON.parse(data);
      if (msg.id === id) {
        ws.off('message', onMsg);
        if (msg.error) reject(new Error(method + ': ' + JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

async function main() {
  const report = { startedAt: new Date().toISOString(), tests: [] };
  function log(name, data) { report.tests.push({ name, ...data }); console.log(`${data.pass ? '✅' : '❌'} ${name}:`, data.detail || ''); }

  const tabs = await httpGet(CDP_HTTP + '/json');
  let pageTarget = JSON.parse(tabs.body).find(t => t.type === 'page' && t.url !== 'chrome://newtab/');
  if (!pageTarget) {
    await httpGet(CDP_HTTP + '/json/new?' + encodeURIComponent('about:blank'));
    const t2 = await httpGet(CDP_HTTP + '/json');
    pageTarget = JSON.parse(t2.body).find(t => t.type === 'page');
  }
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((r,j) => { ws.on('open', r); ws.on('error', j); });

  await cdpCall(ws, 'Page.enable');
  await cdpCall(ws, 'Runtime.enable');

  const errors = [];
  const logs = [];
  ws.on('message', (data) => {
    const m = JSON.parse(data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled') {
      const txt = m.params.args.map(a => a.value || a.description || '').join(' ');
      logs.push('[' + m.params.type + '] ' + txt);
      if (m.params.type === 'error') errors.push('console.error: ' + txt);
    }
  });

  // Override blocking APIs BEFORE navigation
  await cdpCall(ws, 'Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__prompts = [];
      window.alert = function(m){ window.__prompts.push(['alert', m]); };
      window.confirm = function(m){ window.__prompts.push(['confirm', m]); return true; };
      window.prompt = function(m, d){ window.__prompts.push(['prompt', m, d]); return d || ''; };
      window.print = function(){ window.__prompts.push(['print']); };
      window.open = function(u){ window.__prompts.push(['open', u]); return null; };
    `
  });

  // Navigate
  await cdpCall(ws, 'Page.navigate', { url: TARGET_URL });
  await new Promise(r => setTimeout(r, 3000));

  // TEST 1: Page load + data pools
  const t1 = await cdpCall(ws, 'Runtime.evaluate', {
    expression: `JSON.stringify({
      readyState: document.readyState,
      title: document.title,
      VOCAB: typeof VOCAB!=='undefined' ? VOCAB.length : 'undef',
      MATCH_POOL: typeof MATCH_POOL!=='undefined' ? MATCH_POOL.length : 'undef',
      CN_EN_POOL: typeof CN_EN_POOL!=='undefined' ? CN_EN_POOL.length : 'undef',
      CORNELL_SECTIONS: typeof CORNELL_SECTIONS!=='undefined' ? CORNELL_SECTIONS.length : 'undef',
      CLOZE_POOL: typeof CLOZE_POOL!=='undefined' ? CLOZE_POOL.length : 'undef',
      SHORT_POOL: typeof SHORT_POOL!=='undefined' ? SHORT_POOL.length : 'undef',
      TERM_LIST: typeof TERM_LIST!=='undefined' ? TERM_LIST.length : 'undef',
      PHONETICS: Object.keys(typeof PHONETICS!=='undefined' ? PHONETICS : {}).length,
      CN_DICT: Object.keys(typeof CN_DICT!=='undefined' ? CN_DICT : {}).length
    })`,
    returnByValue: true
  });
  const d1 = JSON.parse(t1.result.value);
  log('T1 Page load', {
    pass: d1.readyState === 'complete' && d1.VOCAB >= 40 && d1.CORNELL_SECTIONS === 4 && d1.CLOZE_POOL >= 20,
    detail: d1
  });

  // TEST 2: All 5 parts rendered
  const t2 = await cdpCall(ws, 'Runtime.evaluate', {
    expression: `JSON.stringify({
      vocabCards: document.querySelectorAll('#vocab-grid .vocab-card').length,
      matchingQ: document.querySelectorAll('#matching-quiz .matching-q').length,
      matchingQ_alt: document.querySelectorAll('#matching-quiz .quiz-q').length,
      matchingContainer_html: (document.getElementById('matching-quiz')||{}).innerHTML?.length || 0,
      cnEnQ: document.querySelectorAll('#cn-en-quiz .quiz-q').length,
      cornellBlocks: document.querySelectorAll('#cornell-container .cornell-block').length,
      clozeQ: document.querySelectorAll('#cloze-quiz .quiz-q').length,
      mistakeItems: document.querySelectorAll('#mistake-book-container .mistake-item, .mistake-item').length,
      syllabusRows: document.querySelectorAll('#syllabus-body tr').length,
      speakBtns: document.querySelectorAll('.speak-btn').length,
      inlineSpeak: document.querySelectorAll('.term-inline').length
    })`,
    returnByValue: true
  });
  const d2 = JSON.parse(t2.result.value);
  log('T2 Parts rendered', {
    pass: d2.vocabCards >= 40 && d2.matchingQ >= 10 && d2.cnEnQ >= 40 && d2.cornellBlocks === 4 && d2.clozeQ >= 25,
    detail: d2
  });

  // TEST 3: Submit wrong cloze (find a real cloze-type question, not short)
  const t3 = await cdpCall(ws, 'Runtime.evaluate', {
    expression: `(function(){
      // find first .quiz-q that contains a .cloze-input (not .cloze-textarea)
      var qs = document.querySelectorAll('#cloze-quiz .quiz-q');
      var target = null;
      for (var i=0;i<qs.length;i++){ if (qs[i].querySelector('.cloze-input:not(.cloze-textarea)')) { target = qs[i]; break; } }
      if (!target) return JSON.stringify({err:'no cloze-type q found', total:qs.length});
      var input = target.querySelector('.cloze-input');
      var qi = target.getAttribute('data-qi');
      var allQ = CLOZE_POOL.concat(SHORT_POOL);
      var qData = allQ[qi];
      input.value = 'WRONG_TEST';
      var err = null;
      try { submitCloze(qi); } catch(e) { err = 'submitCloze threw:'+e.message; }
      return JSON.stringify({
        ok:true, qi:qi,
        qType: qData ? qData.type : 'no qData',
        qAnswer: qData ? qData.answer : null,
        userVal: input.value,
        hasScore: !!target.querySelector('.fb-score'),
        scoreText: target.querySelector('.fb-score')?.textContent,
        hasAnswer: !!target.querySelector('.answer-block'),
        err: err
      });
    })()`,
    returnByValue: true
  });
  const d3 = JSON.parse(t3.result.value);
  await new Promise(r => setTimeout(r, 200));
  // Check mistake book count delta
  const t3b = await cdpCall(ws, 'Runtime.evaluate', {
    expression: `(function(){
      var mb = null;
      try { mb = JSON.parse(localStorage.getItem('unit2_mistakebook_v1')||'{}'); } catch(e){}
      var items = mb?.items||{};
      // sum total count
      var totalCount = Object.values(items).reduce((s,it)=>s+(it.count||0),0);
      return JSON.stringify({
        uniqueItems: Object.keys(items).length,
        totalCount: totalCount,
        renderedItems: document.querySelectorAll('.mistake-item').length,
        firstItemTerm: Object.keys(items)[0]
      });
    })()`,
    returnByValue: true
  });
  const d3b = JSON.parse(t3b.result.value);
  log('T3 Wrong cloze → mistake book', {
    pass: d3.ok && d3.hasScore,
    detail: { submitResult: d3, mistakeBook: d3b }
  });

  // TEST 4: Wrong matching → mistake book
  const t4 = await cdpCall(ws, 'Runtime.evaluate', {
    expression: `(function(){
      var q = document.querySelector('#matching-quiz .matching-q');
      if (!q) return JSON.stringify({err:'no matching-q'});
      var radio = q.querySelector('input[type=radio]');
      var correct = q.getAttribute('data-correct');
      // find a wrong option
      var wrongRadio = null;
      q.querySelectorAll('input[type=radio]').forEach(function(r){
        if (r.value !== correct && !wrongRadio) wrongRadio = r;
      });
      if (!wrongRadio) return JSON.stringify({err:'no wrong option'});
      wrongRadio.checked = true;
      wrongRadio.dispatchEvent(new Event('change', {bubbles:true}));
      try { submitMatching(); } catch(e) { return JSON.stringify({err:'submitMatching threw:'+e.message}); }
      return JSON.stringify({ok:true, picked:wrongRadio.value, correct:correct});
    })()`,
    returnByValue: true
  });
  const d4 = JSON.parse(t4.result.value);
  await new Promise(r => setTimeout(r, 200));
  const t4b = await cdpCall(ws, 'Runtime.evaluate', {
    expression: `JSON.stringify({
      lsItems: Object.keys((JSON.parse(localStorage.getItem('unit2_mistakebook_v1')||'{}')).items||{}).length,
      rendered: document.querySelectorAll('.mistake-item').length
    })`,
    returnByValue: true
  });
  const d4b = JSON.parse(t4b.result.value);
  log('T4 Wrong matching → mistake book', {
    pass: d4.ok && d4b.rendered >= 1,
    detail: { submit: d4, mb: d4b }
  });

  // TEST 5: CN→EN wrong → mistake book
  const t5 = await cdpCall(ws, 'Runtime.evaluate', {
    expression: `(function(){
      var q = document.querySelector('#cn-en-quiz .quiz-q');
      if (!q) return JSON.stringify({err:'no cn-en q'});
      var input = q.querySelector('.cloze-input');
      var qi = q.getAttribute('data-qi');
      if (!input) return JSON.stringify({err:'no input'});
      input.value = 'XXXXWRONG';
      try { submitCnEn(qi); } catch(e) { return JSON.stringify({err:'submitCnEn threw:'+e.message}); }
      return JSON.stringify({ok:true, hasScore:!!q.querySelector('.fb-score'), qi:qi});
    })()`,
    returnByValue: true
  });
  const d5 = JSON.parse(t5.result.value);
  log('T5 Wrong CN→EN → mistake book', { pass: d5.ok, detail: d5 });

  // TEST 6: Cornell highlight → mistake book
  const t6 = await cdpCall(ws, 'Runtime.evaluate', {
    expression: `(function(){
      var main = document.querySelector('.cornell-block[data-si="0"] .cornell-main');
      if (!main) return JSON.stringify({err:'no cornell-main'});
      var p = main.querySelector('p');
      if (!p) return JSON.stringify({err:'no p'});
      var range = document.createRange();
      range.selectNodeContents(p);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      try { addHighlight(0); } catch(e) { return JSON.stringify({err:'addHighlight threw:'+e.message}); }
      return JSON.stringify({
        marksInMain: main.querySelectorAll('mark.user-hl').length,
        prompts: window.__prompts.length
      });
    })()`,
    returnByValue: true
  });
  const d6 = JSON.parse(t6.result.value);
  log('T6 Cornell highlight', { pass: d6.marksInMain > 0, detail: d6 });

  // TEST 7: PDF export button presence + function callable
  const t7 = await cdpCall(ws, 'Runtime.evaluate', {
    expression: `(function(){
      var btn = document.getElementById('mb-export');
      var fnNames = ['exportMistakesPDF','exportMistakePDF','mbExportPDF','exportPDF','downloadPDF','mbPDF','generateMistakeSheetHTML'];
      var foundFn = fnNames.filter(function(n){ return typeof window[n] === 'function'; });
      // also check there's a click listener by simulating with 0 items (should alert)
      var clickWorks = false;
      var origAlert = window.alert;
      var alerted = null;
      window.alert = function(m){ alerted = m; };
      try { btn.click(); clickWorks = alerted !== null; } catch(e){}
      window.alert = origAlert;
      return JSON.stringify({
        btnFound: !!btn,
        hasClickListener: clickWorks,
        clickResponse: alerted,
        functionsFound: foundFn
      });
    })()`,
    returnByValue: true
  });
  const d7 = JSON.parse(t7.result.value);
  log('T7 PDF export', {
    pass: d7.btnFound && d7.functionsFound.length > 0,
    detail: d7
  });

  // TEST 8: Voice selector change → TTS_VOICE updates
  const t8 = await cdpCall(ws, 'Runtime.evaluate', {
    expression: `(function(){
      var sel = document.getElementById('voice-select');
      if (!sel) return JSON.stringify({err:'no voice-select'});
      var beforeVoice = TTS_VOICE;
      try { changeVoice('aria'); } catch(e) { return JSON.stringify({err:'changeVoice threw:'+e.message}); }
      return JSON.stringify({
        before: beforeVoice, after: TTS_VOICE,
        saved: localStorage.getItem('icmyp_tts_voice')
      });
    })()`,
    returnByValue: true
  });
  const d8 = JSON.parse(t8.result.value);
  log('T8 Voice selector', { pass: d8.after === 'aria', detail: d8 });

  // TEST 9: TTS proxy online flag
  const t9 = await cdpCall(ws, 'Runtime.evaluate', {
    expression: `JSON.stringify({
      TTS_PROXY_ONLINE: typeof TTS_PROXY_ONLINE !== 'undefined' ? TTS_PROXY_ONLINE : 'undef',
      TTS_PROXY: typeof TTS_PROXY !== 'undefined' ? TTS_PROXY : 'undef',
      TTS_VOICE: typeof TTS_VOICE !== 'undefined' ? TTS_VOICE : 'undef'
    })`,
    returnByValue: true
  });
  const d9 = JSON.parse(t9.result.value);
  log('T9 TTS state', { pass: d9.TTS_PROXY_ONLINE === true, detail: d9 });

  // TEST 10: Vocab flag button → mistake book count increments
  const t10 = await cdpCall(ws, 'Runtime.evaluate', {
    expression: `(function(){
      var mbBefore = JSON.parse(localStorage.getItem('unit2_mistakebook_v1')||'{}');
      var uniqueBefore = Object.keys(mbBefore.items||{}).length;
      var totalBefore = Object.values(mbBefore.items||{}).reduce((s,it)=>s+(it.count||0),0);
      var btn = document.querySelector('.vocab-flag-btn:not(.flagged)');
      if (!btn) return JSON.stringify({err:'no unflagged vocab btn'});
      btn.click();
      var mbAfter = JSON.parse(localStorage.getItem('unit2_mistakebook_v1')||'{}');
      var uniqueAfter = Object.keys(mbAfter.items||{}).length;
      var totalAfter = Object.values(mbAfter.items||{}).reduce((s,it)=>s+(it.count||0),0);
      return JSON.stringify({
        uniqueBefore:uniqueBefore, uniqueAfter:uniqueAfter, uniqueDelta:uniqueAfter-uniqueBefore,
        totalBefore:totalBefore, totalAfter:totalAfter, totalDelta:totalAfter-totalBefore,
        btnFlagged: btn.classList.contains('flagged')
      });
    })()`,
    returnByValue: true
  });
  const d10 = JSON.parse(t10.result.value);
  log('T10 Vocab flag → mistake book', { pass: d10.totalDelta >= 1 || d10.uniqueDelta >= 1, detail: d10 });

  // TEST 11: Reset (reshuffle) matching — should not crash
  const t11 = await cdpCall(ws, 'Runtime.evaluate', {
    expression: `(function(){
      var before = document.querySelectorAll('#matching-quiz .matching-q').length;
      try { renderMatching(); } catch(e) { return JSON.stringify({err:e.message}); }
      var after = document.querySelectorAll('#matching-quiz .matching-q').length;
      return JSON.stringify({before:before, after:after});
    })()`,
    returnByValue: true
  });
  const d11 = JSON.parse(t11.result.value);
  log('T11 Matching reshuffle', { pass: !d11.err && d11.after >= 10, detail: d11 });

  // TEST 12: Inline term scanning worked on Cornell passages
  const t12 = await cdpCall(ws, 'Runtime.evaluate', {
    expression: `JSON.stringify({
      termInlineCount: document.querySelectorAll('.cornell-main .term-inline').length,
      speakBtnsInCornell: document.querySelectorAll('.cornell-main .speak-btn').length,
      sampleTermHTML: (document.querySelector('.cornell-main .term-inline')||{}).outerHTML?.slice(0, 200) || 'none'
    })`,
    returnByValue: true
  });
  const d12 = JSON.parse(t12.result.value);
  log('T12 Inline term scanning', { pass: d12.termInlineCount > 5, detail: d12 });

  // FINAL: errors and summary
  report.errors = errors;
  report.consoleLogs = logs;
  report.completedAt = new Date().toISOString();
  report.summary = {
    passed: report.tests.filter(t => t.pass).length,
    failed: report.tests.filter(t => !t.pass).length,
    total: report.tests.length,
    jsErrors: errors.length
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log('\n═══════ SUMMARY ═══════');
  console.log('Passed:', report.summary.passed, '/', report.summary.total);
  console.log('Failed:', report.summary.failed);
  console.log('JS errors:', errors.length);
  errors.slice(0,8).forEach(e => console.log('  ❗', e.slice(0,250)));
  console.log('\nReport:', REPORT_PATH);

  ws.close();
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
