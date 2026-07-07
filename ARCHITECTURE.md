# 📐 Architecture · 系统架构

> 这份文档解释 ICMYP Biology Study Hub 的整体设计思路、关键组件如何协作、以及为什么这样设计。

---

## 1. 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    浏览器（用户侧）                            │
│                                                              │
│   index.html  ←→  unit1.html / unit2.html / unitN.html      │
│        │              │                                      │
│        │              ├── 5 个 Part DOM 区块                  │
│        │              ├── CSS（嵌入式，~700 行）              │
│        │              ├── JS 引擎（嵌入式，~1400 行）         │
│        │              │     ├── TTS 多备份链                  │
│        │              │     ├── 内联术语扫描（walkAndEnhance） │
│        │              │     ├── 3 套 quiz 引擎               │
│        │              │     ├── 错题本（localStorage）       │
│        │              │     └── PDF 导出（iframe + print）   │
│        │              └── 数据层（VOCAB / POOL / CORNELL）   │
│        │                                                    │
│        ↓ HTTP                                               │
└────────┼────────────────────────────────────────────────────┘
         │
         ↓
┌────────────────────────────────────────────────────────────┐
│            本地服务（127.0.0.1）                              │
│                                                            │
│   :8765  静态站点服务（任意 server，node/python 都行）       │
│                                                            │
│   :8766  Edge-TTS 代理（Python aiohttp + edge-tts 库）     │
│          ├── GET /tts?text=...&voice=jenny → MP3           │
│          ├── GET /voices → 语音清单                         │
│          ├── GET /health → ok                              │
│          └── 缓存：~/.cache/icmyp_tts/<md5>.mp3             │
└────────────────────────────────────────────────────────────┘
         │
         ↓（Edge-TTS 库内部调用 WebSocket）
┌────────────────────────────────────────────────────────────┐
│   Microsoft Edge Speech Service（免费，无 Key）              │
│   同源 Azure Cognitive Services 神经网络声音                 │
└────────────────────────────────────────────────────────────┘
```

---

## 2. 5-Part Study System · 学习阶梯设计

| Part | 认知阶段 | 训练能力 | 数据来源 |
|------|---------|---------|---------|
| 1 Vocab | **学习** | 词形识别 + 发音 | `VOCAB[]` 数组 |
| 2 Matching | **识别** | 看释义认术语 | `MATCH_POOL = VOCAB.map(...)` 自动派生 |
| 3 CN→EN Recall | **回忆** | 中文→英文产出 | `CN_EN_POOL = VOCAB.map(...)` 自动派生 |
| 4 Cornell Notes | **理解** | 上下文阅读 + 概念框架 | `CORNELL_SECTIONS[]`（4 节，对应教材章节） |
| 5 Cloze + Short | **应用** | 句子填空 + 主观表达 | `CLOZE_POOL[] + SHORT_POOL[]` |

### 设计原则
- **阶梯递进**：词汇 → 识别 → 回忆 → 理解 → 应用，每一步都基于前一步的掌握
- **数据复用**：Part 2/3 直接从 VOCAB 派生，改一处即同步，无冗余
- **错题驱动**：所有错题统一进错题本，下次复习集中攻克

---

## 3. 错题本（Mistake Book）数据结构

```javascript
localStorage["unit2_mistakebook_v1"] = {
  items: {
    "osmosis": {              // key = term.toLowerCase()
      term: "osmosis",
      category: "transport",  // 5 类：structure/organisation/transport/effect/method
      cn: "渗透作用",
      count: 3,               // 错题次数（聚合）
      firstWrong: 1690000000, // 时间戳
      lastWrong: 1691000000,
      reasons: [              // 错因（双语，去重，最多保留）
        "Cloze fill-in wrong. Correct: \"osmosis\".",
        "Confused \"osmosis\" with \"diffusion\". Re-read the definition."
      ],
      prompts: [...],         // 原题（最多 3 个）
      userAnswers: [...],     // 用户写的（最多 3 个）
      keys_en: [...],         // 关键英文知识点
      keys_cn: [...]          // 关键中文释义
    }
  }
}
```

### 来源汇总
| 来源 | 触发条件 | 字段填充 |
|------|---------|---------|
| Part 1 词条 🚩 按钮 | 用户手动点击 | reason = "Manually flagged" |
| Part 2 Matching | 选错答案 | reason = "Confused X with Y" |
| Part 3 CN→EN | 写错术语 | reason = "Could not recall" |
| Part 4 Cornell | 选中文字 + Save highlight | note 作为 reason |
| Part 5 Cloze | 填错 | reason = "Cloze fill-in wrong" |
| Part 5 Short | 得分 < 80% | reason = "Missing keywords: X, Y" |

---

## 4. TTS 多备份链 · 决策流程

```
                    用户点击 🔊
                         │
                         ↓
                  stopAudio()  ←—— 先停掉所有正在播放的
                         │
                  navigator.onLine?
                         │
              ┌──────────┴──────────┐
              ↓ true                ↓ false
       TTS_PROXY_ONLINE?       speakWebSpeech()
              │                     （即时）
       ┌──────┴──────┐
       ↓ true        ↓ false
   speakEdgeTTS()  speakStreamElements()
       │                │
   1.5s 超时？           │
       ↓                ↓
   失败 → 降级 TTS_PROXY_ONLINE=false
       ↓
   speakStreamElements()
       ↓
   失败 → speakWebSpeech()
```

### 关键机制
- **`ttsLocked`** 锁：任何一个 provider 开始播放就上锁，防止多个 provider 重叠发声
- **`settled`** 标志：防止同一 provider 因 `canplaythrough` + `error` 同时触发而双重 resolve
- **`TTS_PROXY_ONLINE`** 探测：首次访问 `/health`，运行时失败就降级为 false 不再重试
- **缓存命中**：每个 (text, voice, rate, pitch) 组合 md5 哈希 → 缓存文件，二次访问 < 20ms

---

## 5. 内联术语扫描（walkAndEnhance）

```
                  Cornell 原文段落
                       │
        ┌──────────────┴──────────────┐
        │  TreeWalker 遍历所有文本节点  │
        └──────────────┬──────────────┘
                       ↓
        对每个文本节点跑 TERM_REGEX.test()
                       ↓
                 命中术语列表
                       ↓
        按 index 排序，长术语优先（避免 "red blood cell"
        被 "blood" 抢匹配）
                       ↓
        拆分文本节点：
          [前缀文本] [<span class="term-inline">
                       <span>术语</span>
                       <button class="speak-btn">🔊</button>
                     </span>] [后缀文本]
                       ↓
        下次点击 🔊 → speakWord(术语)
```

**Unit 2 实测**：Cornell 4 节原文里共扫到 86 个内联术语，每个都带 🔊。

---

## 6. PDF 背诵纸导出

```
点击 "📄 导出背诵纸 PDF"
       │
       ↓
  generateMistakeSheetHTML(items)
       │
       ↓
  构造完整 HTML 文档（A4 + 9.5pt + Cornell 双栏）
       │
       ↓
  创建隐藏 <iframe>，srcdoc = HTML
       │
       ↓
  iframe.contentWindow.print()  → 调起浏览器打印对话框
       │
       ↓
  用户选择 "Save as PDF" → 本地保存
```

### 节纸设计
- A4 纸边距：10mm × 8mm
- 字号：9.5pt（普通打印字号是 11-12pt，这里压缩约 20%）
- 双栏 Cornell：30% cue（术语+CN+次数徽章）/ 70% main（错因+关键知识）
- `break-inside: avoid` 防止一条错题跨页断开

---

## 7. IGCSE 0610 考纲对齐

每个 Unit 末尾的 "Syllabus Coverage Map" 表格：
- 列出该 topic 下所有 IGCSE 0610 spec points
- 每条标注：✅ Full Covered（已覆盖）/ ⊘ Not in Course（课程范围外）
- 显示：`X / X spec points addressed`

### 单元与考纲的映射（当前）
| Unit | 对齐 Topic | Spec Points |
|------|-----------|-------------|
| TS1 | Topic 1: Characteristics & Classification of Living Organisms | 13/13 in-scope |
| TS2 | Topic 2: Cells + Topic 3: Movement In/Out of Cells | 16/16 addressed |

---

## 8. 测试与质量保证

### 端到端测试（CDP 自动化）
脚本：`tests/debug_unit2.cjs`

12 项测试覆盖：
- 页面加载 + 数据池完整性
- 5 个 Part 的 DOM 渲染
- 错题本从 4 个来源的接收
- 语音切换、TTS 状态、PDF 导出按钮、重洗、内联术语扫描

最新结果：**12/12 通过，0 JS 异常**。

### 关键 bug 防御
- **querySelector scope 隔离**：Part 3 和 Part 5 都用 `.cloze-input`，必须加 `#cn-en-quiz` / `#cloze-quiz` scope 前缀
- **VOCAB 字段命名**：用 `cat`（不是 `category`），所有 renderer 同步
- **Cloze 字段命名**：用 `before/after/hint`（不是 `text_before/text_after/hint_en`）

---

## 9. 部署架构

```
本地 main 分支
   │
   ↓ git push
GitHub: kkfy088/biology-study-hub
   │
   ↓ 自动触发
GitHub Pages（基于 gh-pages 分支 + .nojekyll）
   │
   ↓
https://kkfy088.github.io/biology-study-hub/
```

### 为什么用 `.nojekyll`？
GitHub Pages 默认会用 Jekyll 处理 `_` 开头的文件/文件夹，加 `.nojekyll` 让所有文件按原始路径直接服务。

---

## 10. 扩展性

新增单元的成本：
1. 准备教材 PDF → OCR + 裁图（~30 分钟）
2. 按 SOP v1.5 填写 6 个数据池（VOCAB/POOL/CORNELL/CLOZE/SHORT/syllabus）（~1 小时）
3. 跑一次 `debug_unitN.cjs` 测试（~30 秒）
4. 改 `index.html` 卡片状态 → commit → push（~1 分钟）

**总成本：单个新单元从素材到上线 < 2 小时**。
