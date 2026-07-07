# 🛠 Development Guide · 开发指南

> 这份文档告诉新开发者（或 AI）：如何在这个项目里新增一个单元、修改发音、跑测试、调试。

---

## 0. 前置条件

- **Python 3.10+**（用于 TTS 服务和 OCR）
- **Node.js 18+**（用于静态站点和测试脚本）
- **Google Chrome**（用于 headless 测试）
- **Git + GitHub 账户**（部署）

---

## 1. 本地启动

### Step 1 · 安装 TTS 依赖

```bash
pip install edge-tts aiohttp
```

### Step 2 · 启动 TTS 服务

```bash
cd biology-study-hub
./start_tts.sh
```

输出：
```
✅ TTS server ready at http://127.0.0.1:8766
   Test: curl 'http://127.0.0.1:8766/tts?text=hello&voice=jenny' --output test.mp3
```

### Step 3 · 启动静态站点

```bash
# 用 Node（推荐）
node -e "require('http').createServer((req,res)=>{const fs=require('fs'),path=require('path');const types={'.html':'text/html;charset=utf-8','.png':'image/png'};let p=req.url.split('?')[0];if(p==='/')p='/index.html';fs.readFile(path.join('.',p),(e,d)=>{if(e){res.writeHead(404);res.end('404');return;}res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});res.end(d);});}).listen(8765,()=>console.log('http://localhost:8765'));"

# 或用 Python
python3 -m http.server 8765
```

### Step 4 · 打开浏览器

```
http://localhost:8765/
```

---

## 2. 新增一个单元（如 Unit TS3）

### 完整流程（参考 SOP v1.5）

#### Step 1 · 准备素材

把教材 PDF 放到 `/tmp/` 或 `~/Downloads/`。

#### Step 2 · OCR + 提取原文

```python
import fitz, easyocr, os, json
doc = fitz.open('/path/to/unit3.pdf')
os.makedirs('/tmp/unit3pdf', exist_ok=True)
for i in range(len(doc)):
    pix = doc[i].get_pixmap(dpi=200)
    pix.save(f'/tmp/unit3pdf/p{i+1:02d}.png')

reader = easyocr.Reader(['en'], gpu=False)
out = {}
for i in range(1, len(doc)+1):
    res = reader.readtext(f'/tmp/unit3pdf/p{i:02d}.png', detail=0, paragraph=True)
    out[i] = "\n".join(res)
json.dump(out, open('/tmp/unit3_ocr.json','w'), ensure_ascii=False, indent=2)
```

从 OCR 结果中提取：
- **Glossary** 词汇页（一般在最后几页）
- **Key words** 关键词页（每节末尾）
- **Reading passages** 课文段落（用于 Cornell）

#### Step 3 · 裁切课本原图

用 OCR 的 bbox gap analysis 找出大块"无文本"区域（即图片）：

```python
from PIL import Image
# 找到每页的纵向无文本 gap（≥100px）
# 那些就是图的位置
img = Image.open(f'/tmp/unit3pdf/p{pg:02d}.png')
crop = img.crop((x0, y0, x1, y1))  # 用 gap 给的坐标
crop.save(f'diagrams/u3_fig{NN:02d}_description.png')
```

目标：**8-15 张/单元**。

#### Step 4 · 复制 unit2.html 为 unit3.html

```bash
cp unit2.html unit3.html
```

#### Step 5 · 替换数据层

打开 `unit3.html`，找到 `// ═══ DATA LAYER ═══` 部分，**只改这 6 块**：

1. **`VOCAB`** — 40-55 个词条（IPA + CN + EN def + excerpt + fig + cat）
2. **`MATCH_POOL`** — 自动从 VOCAB 派生，无需改
3. **`CN_EN_POOL`** — 自动从 VOCAB 派生，无需改
4. **`CORNELL_SECTIONS`** — 4 节（对齐教材章节 3.1/3.2/3.3/3.4）
5. **`CLOZE_POOL`** — ~24 题，answer 必须是 VOCAB 里的术语
6. **`SHORT_POOL`** — ~6 题，含 keywords / model_en / model_cn / lang_notes

**注意字段命名约定**（违反会出 bug）：
- VOCAB 用 `cat`（不是 `category`）
- CLOZE 用 `before/after/hint`（不是 `text_before/text_after/hint_en`）

#### Step 6 · 改其他位置

- `<title>` 标签
- Header badge: `🔬 Unit TS3 · <Topic Name>`
- `<h1>` 主标题
- subtitle 描述
- `MB_KEY = 'unit3_mistakebook_v1'`（localStorage key，必须唯一）
- `renderSyllabus()` 里的 specs 数组（按 IGCSE 0610 改）

#### Step 7 · 更新首页

打开 `index.html`，把 Unit 3 的卡片从：
```html
<div class="unit-card" style="opacity:0.75;cursor:not-allowed;">
  ...
  <span class="unit-status status-soon">🔜 Coming Soon</span>
```
改成：
```html
<a class="unit-card" href="unit3.html">
  ...
  <span class="unit-status status-active">✓ Available</span>
```

#### Step 8 · 跑端到端测试

```bash
# 改一下 debug 脚本里的 URL（unit2 → unit3）和 localStorage key
sed -i '' 's/unit2/unit3/g' tests/debug_unit2.cjs
mv tests/debug_unit2.cjs tests/debug_unit3.cjs
bash tests/run_test.sh   # 但要改下脚本里引用的文件名
```

12 项测试必须全部通过。

#### Step 9 · Commit & Push

```bash
git add .
git commit -m "Add Unit TS3: <Topic Name>"
git push
```

GitHub Pages 会在 1-2 分钟内自动更新。

---

## 3. 修改发音

### 添加新语音

打开 `tts_server.py`，扩展 `VOICE_MAP`：

```python
VOICE_MAP = {
    ...
    "david": "en-US-DavidNeural",   # 新增男声
    "libby": "en-GB-LibbyNeural",   # 新增英国女声
}
```

打开 `unit2.html`，找到 `<select id="voice-select">`，加 `<option>`：

```html
<option value="david">🔊 David (US male)</option>
<option value="libby">🔊 Libby (UK)</option>
```

### 调整语速

`tts_server.py` 默认 `rate=-5%`（5% 慢，利于术语清晰）：

```python
rate = request.query.get("rate", "-5%")   # 改这里
```

更慢：`-10%`；正常：`+0%`；更快：`+10%`。

### 切换 TTS 提供商

如果 Edge-TTS 不可用（防火墙/海外网络问题），可以切换：

| 提供商 | 改 `unit2.html` 的 `speakEdgeTTS` 函数 | 优劣 |
|--------|---------------------------------------|------|
| **Edge-TTS**（默认） | 当前代码 | 免费、神经网络、最自然 |
| **StreamElements** | 把 `speakEdgeTTS` 替换为直连 `api.streamelements.com/...` | 免费、Polly 音质，但有 rate limit |
| **Web Speech API** | 删掉所有 cloud 函数，直接 `speakWebSpeech()` | 0 成本、0 延迟，但音质差 |
| **OpenAI TTS** | 申请 key，调 `api.openai.com/v1/audio/speech` | 最自然但付费（$15/百万字符） |
| **火山引擎** | 申请 AppID + Token，调火山 TTS API | 中文最佳，英文也不错 |

---

## 4. 跑测试

### 前置：启动服务

```bash
./start_tts.sh                          # TTS 代理
python3 -m http.server 8765 &           # 静态站点
```

### 跑全部 12 项端到端测试

```bash
cd michelle-learn-biology
node tests/debug_unit2.cjs
# 或
bash tests/run_test.sh
```

预期输出：
```
✅ T1 Page load
✅ T2 Parts rendered
✅ T3 Wrong cloze → mistake book
...
═══════ SUMMARY ═══════
Passed: 12 / 12
Failed: 0
JS errors: 0
```

### 测试原理
1. 启动 Chrome 147 headless（无界面）
2. 通过 DevTools Protocol (CDP) 远程控制
3. 用 Node `ws` 库发 WebSocket 命令
4. 在浏览器里跑 `Runtime.evaluate` 执行测试 JS
5. 捕获 `Runtime.exceptionThrown` 和 `console.error`
6. 输出 JSON 报告到 `/tmp/unit2_debug_report.json`

---

## 5. 调试技巧

### 5.1 查看 localStorage 里的错题本

打开浏览器 DevTools → Application → Local Storage → `unit2_mistakebook_v1`。

或在 Console 里：
```javascript
JSON.parse(localStorage.getItem('unit2_mistakebook_v1'))
```

### 5.2 检查 TTS 服务状态

```bash
curl http://127.0.0.1:8766/health      # 应返回 ok
curl http://127.0.0.1:8766/voices      # 查看所有语音
curl 'http://127.0.0.1:8766/tts?text=hello&voice=jenny' --output /tmp/test.mp3
```

### 5.3 排查"🔊 没声音"

| 症状 | 排查 |
|------|------|
| 点击 🔊 完全无反应 | 看 Console，`TTS_PROXY_ONLINE` 是否 true；服务是否启动 |
| 听见的是 Web Speech 机械音 | 说明 Edge 失败降级了；查 `/tmp/icmyp_tts.log` |
| 听见两次声音 | `ttsLocked` 失效；检查是否多个 🔊 互相抢锁 |
| 第一次慢、之后快 | 正常，缓存命中；首次 Edge-TTS ~1.5s 生成 MP3 |
| 海外网络访问不到 Edge | 改 `speakWord()` 直接走 StreamElements |

### 5.4 排查"错题本不收错题"

每个 Part 的 submit 函数都有 querySelector scope，**不能省略**：

```javascript
// ❌ 错的（会跨 Part 串扰）
var input = document.querySelector('.cloze-input[data-qi="0"]');

// ✅ 对的（限定 scope）
var input = document.querySelector('#cloze-quiz .cloze-input[data-qi="0"]');
```

---

## 6. 部署到 GitHub Pages

### 一次性配置（已完成）

仓库：`https://github.com/kkfy088/biology-study-hub`
- `main` 分支为源
- `gh-pages` 分支为部署
- `.nojekyll` 已加，跳过 Jekyll 处理

### 日常发布

```bash
git add .
git commit -m "Add Unit TS3 / Fix TTS / Update docs"
git push origin main
```

GitHub Pages 会自动构建，1-2 分钟后 https://kkfy088.github.io/biology-study-hub/ 更新。

### 查看部署状态

```bash
gh run list --repo kkfy088/biology-study-hub
gh run view <run-id> --repo kkfy088/biology-study-hub
```

---

## 7. 项目约定（必须遵守）

完整约定见 `docs/SOP.md`，关键摘录：

| 项 | 约定 |
|----|------|
| **Footer** | "⚡ Powered by Michelle Yang · 2026" |
| **英文为主** | 英文 primary，中文 supplementary |
| **IGCSE 0610 对齐** | 每个单元必须有 syllabus coverage 表 |
| **TTS 主备份链** | Edge-TTS → StreamElements → Web Speech |
| **错题本 key** | `unitN_mistakebook_v1`，每个 unit 唯一 |
| **VOCAB 字段** | 用 `cat`（不是 `category`） |
| **CLOZE 字段** | 用 `before/after/hint` |
| **querySelector scope** | 必须加 `#cn-en-quiz` / `#cloze-quiz` 等前缀 |
| **测试** | 新单元上线前必须 12/12 通过 |
| **commit 风格** | `Add Unit TS3: <topic>` / `Fix TTS scope bug` / `Update docs` |

---

## 8. 常见问题

**Q: 为什么浏览器打开是空白的？**
A: 检查 8765 端口是否被占用，或路径是否正确。

**Q: 为什么 🔊 不响？**
A: 先跑 `./start_tts.sh`，再 curl `/health` 测试。

**Q: 错题本点了 🚩 没反应？**
A: 看 Console 是否有 JS 报错；localStorage 是否被禁用。

**Q: 部署后线上版本没有 TTS？**
A: 是的，TTS 是本地服务，公网用户会自动降级到 StreamElements Polly。生产环境如有需要可部署到云函数。

**Q: 怎么加一个全新的功能（如闪卡模式）？**
A: 在 SOP v1.5 上加一节描述新 Part，实现 renderer，更新测试脚本，commit + push。
