# 🧬 ICMYP Biology Study Hub

> 一个为 IGCSE Biology 考生打造的**双语互动学习网站**，严格对齐 Cambridge IGCSE Biology 0610 考纲。
> ⚡ Powered by Michelle Yang · 2026

## 🌐 在线访问

**https://kkfy088.github.io/biology-study-hub/**

（部署在 GitHub Pages，免费、稳定、全球可访问）

## 📚 当前已上线单元

| Unit | Topic | 状态 | 架构 |
|------|-------|------|------|
| **TS1** | Classification of Living Organisms | ✅ 上线 | 原始架构 + v1.5 TTS |
| **TS2** | Cell Biology & Organisation | ✅ 上线 | **v1.5 5-Part Study System**（参考实现） |
| TS3–TS6 | 待开发 | 🔜 Coming Soon | — |

## 🎯 项目特色

### 双语教学
- **英文为主，中文为辅**：所有核心内容英文，关键术语配中文释义
- 适合中国 IGCSE 考生：母语辅助理解，不阻碍英文应试

### 神经网络发音系统
- **微软 Edge-TTS** 神经网络声音（与 Azure 同源），完全免费、无 API Key、无配额
- 4 种女声可选（Jenny / Aria / Emma / Ana），覆盖美式 + 英式 + 年轻声线
- 本地代理服务 + 缓存机制，二次播放近乎瞬时
- 多层备份链：Edge-TTS → StreamElements (Polly) → Web Speech API

### 5-Part Study System (v1.5)
每个单元按认知科学设计的 5 步学习阶梯：

1. **📖 Vocabulary Cards** — 词条卡（IPA + 中文 + 英文释义 + 课本摘录 + 配图 + 🔊）
2. **🎯 Matching Quiz** — 英文释义→选词（4 选 1，自动批改，错题进错题本）
3. **✍️ CN→EN Recall** — 看中文默写英文术语（精确/部分评分）
4. **📝 Cornell Notes** — 康奈尔笔记式原文朗读（cue 栏 + 主文 + 摘要，划线高亮直接进错题本）
5. **🧩 Cloze + Short Answer** — 50% 填空 + 50% 主观（关键词评分 + 范答 + 语言解析）

### 错题本（Mistake Book）
- 全部 5 个部分共享一个错题本，按术语聚合（同一术语多次错就累加计数）
- 每个错题记录：术语、错误次数、错因（双语）、用户答案（最多 3 次）、关键知识点（双语）
- **一键导出 PDF 背诵纸**：康奈尔版式、A4、9.5pt 省纸字号，浏览器直接打印

### IGCSE 0610 考纲对齐
- 每个单元末附**考纲覆盖表**，逐条对照 IGCSE 0610 spec points
- 标注 ✅ Covered / ⊘ Not in Course，确保零遗漏

## 📁 项目结构

```
biology-study-hub/
├── index.html              # 网站首页（6 个单元目录）
├── unit1.html              # Unit TS1: Classification (原始架构)
├── unit2.html              # Unit TS2: Cell Biology (v1.5 参考实现)
├── diagrams/               # 课本原图（24 张，fig*.png / u2_fig*.png）
│   ├── fig1-13.png         #   Unit 1 figures
│   └── u2_fig01-11.png     #   Unit 2 figures
├── tts_server.py           # Edge-TTS 本地代理服务（端口 8766）
├── start_tts.sh            # TTS 启动脚本
├── README.md               # ← 你正在看的这份
├── DEVELOPMENT.md          # 开发指南（如何新增一个单元）
├── ARCHITECTURE.md         # 系统架构详解
└── .workbuddy/
    ├── rules/SOP.md        # 内容生成 SOP v1.5（权威标准）
    ├── rules/archive/      # 历史版本 SOP（v1.0–v1.4）
    ├── memory/             # 项目工作日志（按天）
    └── tools/              # 自动化测试脚本
```

## 🚀 本地运行

### 1. 启动 TTS 服务（一次性，后台常驻）

```bash
cd biology-study-hub
./start_tts.sh
```

输出示例：
```
✅ TTS server ready at http://127.0.0.1:8766
   Test: curl 'http://127.0.0.1:8766/tts?text=hello&voice=jenny' --output test.mp3
```

### 2. 启动静态站点

```bash
# 任意静态服务器都行
python3 -m http.server 8765
# 或
npx serve -p 8765
```

### 3. 打开浏览器

```
http://localhost:8765/
```

## 🛠 技术栈

- **前端**：原生 HTML/CSS/JavaScript（无框架、无构建）
- **TTS**：Edge-TTS（Python `edge-tts` 库 + `aiohttp` 本地代理）
- **教材源**：扫描版 PDF → PyMuPDF 渲染 + easyocr OCR → 课文/术语/原图
- **部署**：GitHub Pages（gh-pages 分支 + `.nojekyll`）
- **测试**：Chrome 147 headless + DevTools Protocol + Node.js ws 库

## 📖 文档

| 文档 | 说明 |
|------|------|
| **[DEVELOPMENT.md](DEVELOPMENT.md)** | 开发流程：如何新增一个单元、如何修改 TTS、如何跑测试 |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | 系统架构：5-Part 系统设计、错题本数据结构、TTS 多备份链、考纲对齐 |
| **[.workbuddy/rules/SOP.md](.workbuddy/rules/SOP.md)** | 内容生成 SOP v1.5（最权威的标准，所有新单元必须遵守） |

## ✅ 质量保证

每个单元上线前必须通过 **12 项端到端自动化测试**（脚本：`.workbuddy/tools/debug_unit2.cjs`）：

1. 页面加载、数据池完整（VOCAB/POOL/CORNELL/CLOZE/SHORT 数量正确）
2. 5 个部分全部渲染
3. Part 2/3/5 错题自动进错题本
4. Cornell 高亮进错题本
5. PDF 导出按钮可用
6. 语音切换正常
7. TTS 代理在线检测
8. 词条 🚩 标记进错题本
9. Matching 重洗正常
10. 内联术语扫描生效（Cornell 原文里 86+ 个 🔊）

测试结果：**12/12 通过，0 JS 异常**。

## 📝 作者

**Michelle Yang** · 2026

IGCSE 考生家长独立完成。仅供学习使用。
