# MEMORY · 项目持久化上下文

> **用途**: 新对话开头读此文件，快速恢复项目全貌。每次重要变更后更新。
> **最后更新**: 2026-07-10

---

## 1. 项目概况

| 项目 | 说明 |
|------|------|
| 名称 | Biology Study Hub (michelle-learn-biology) |
| 用户 | Michelle，初二，中文母语，学 IGCSE 0610 Biology |
| 仓库 | github.com/kkfy088/biology-study-hub |
| 分支 | MLIGB1 (= main，已同步) |
| 部署 | Vercel (https://biology-study-hub.vercel.app) |
| 最新 commit | `22040db` |

---

## 2. 技术架构

```
前端: unit2.html (纯 HTML/CSS/JS, 4098 行)
后端: Vercel Serverless Functions (Node.js, api/*.js)
数据库: Supabase (pgvector 向量存储)
```

### API 端点（全部已测试通过 ✅）

| 端点 | 功能 | 调用的模型 |
|------|------|-----------|
| /api/lookup | 划词查词 | DeepSeek (deepseek-chat) |
| /api/explain | 长句解释 | DeepSeek (deepseek-chat) |
| /api/grade | 主观题评分 | DeepSeek (deepseek-chat) |
| /api/vision | 图片理解 | GLM glm-4.6v-flash (免费) |
| /api/rag/query | RAG 问答 | Supabase 检索 + DeepSeek 生成 |
| /api/rag/upload | 知识库导入 | GLM embedding-3 (1024维) |
| /api/rag/parse | PDF/图片解析 | GLM glm-4.6v-flash 视觉 |

---

## 3. 环境变量（Vercel）

| 变量名 | 用途 | 说明 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | 文本对话 | DeepSeek 标准付费 API |
| `GLM_VISION_4_6V_FLASH_API_KEY` | 视觉 (glm-4.6v-flash) | 智谱标准 API，免费模型 |
| `ZHIPU_EMBEDDING_API_KEY` | Embedding (embedding-3) | 智谱标准 API，独立 key |
| `SUPABASE_URL` | Supabase 连接 | pgvector 向量库 |
| `SUPABASE_SERVICE_KEY` | Supabase 服务密钥 | 服务端写入用 |

**注意**: `ZHIPU_API_KEY` 已废弃，不再使用。Coding Plan key 只能给 Trae/Claude Code 等 agent 用，不能用于产品 API 调用。

---

## 4. 大模型分工

| 任务 | 模型 | 价格 | Key |
|------|------|------|-----|
| 文本对话/查词/解释/评分 | deepseek-chat | ¥1/百万token | DEEPSEEK_API_KEY |
| 视觉/看图 | glm-4.6v-flash | 免费 | GLM_VISION_4_6V_FLASH_API_KEY |
| Embedding | embedding-3 (1024维) | 付费资源包 | ZHIPU_EMBEDDING_API_KEY |

**限制**: pgvector HNSW 索引最多 2000 维，所以 embedding 用 1024 维（不能用 2048）。

---

## 5. PRD 需求状态

| 需求 | 名称 | 状态 | 备注 |
|------|------|------|------|
| R1 | 划词查词 + 朗读 | ✅ 前端+后端完成 | 已接入 /api/lookup |
| R2 | 长句解释 + 收藏 | ✅ 前端+后端完成 | 已接入 /api/explain + 笔记本 |
| R3 | 主观题 AI 评价 | ✅ 前端+后端完成 | 已接入 /api/grade |
| R4 | Cornell 中英笔记优化 | ✅ 完成 | 内联中文标注 + callout |
| R5 | 侧边导航 | ✅ 完成 | IntersectionObserver |
| R6 | 知识框架填空 | ✅ 完成 | 自动判分 + 模糊匹配 |
| R7 | 笔记本管理 | ✅ 完成 | 搜索/筛选/排序/打印/PDF |
| R8 | 前后端分离 + RAG | ✅ 完成 | Vercel + Supabase pgvector |
| R9 | 补充资料上传 | ⏳ 后端就绪 | /api/rag/upload + /api/rag/parse 已有 |
| R10 | PRD 文档化 | ✅ 完成 | docs/PRD-MLIGB1.md |
| R11 | 分支管理 | ✅ 完成 | MLIGB1 = main |
| R12 | MCP 工具链 | ✅ 完成 | Playwright + GLM-4V |
| R13 | Landing Page | ⏳ 排期最后 | P3 |
| R14 | 看图说话 | ✅ 完成 | Lightbox + GLM-4V + 填空 |
| R15 | Cornell 双语优化 | ⏳ 待确认 | 用户明确：双语需求，不是纯英文化 |
| R16 | Cornell 动态扩展 | ⏳ P2 研究项 | 数据结构 JSON 化 |
| R-TTS | 语音合成升级 | ✅ 完成 | Edge TTS Browser WebSocket |

---

## 6. 待清理的技术债

| 项目 | 说明 |
|------|------|
| settings-panel 遗留 | unit2.html 中有前端 API Key 输入面板，已不需要（后端代理） |
| AI_CONFIG / callGLM 死代码 | 前端直接调智谱 API 的旧逻辑，已被后端 API 替代 |
| formatLookupResult 死代码 | 旧格式化函数，无调用 |
| DEVELOPMENT.md 过时 | 还写着 Python TTS 代理内容，实际已用 Edge TTS Browser |
| ARCHITECTURE.md 过时 | 还画着本地服务架构，实际已 Vercel 部署 |

---

## 7. 关键决策记录

1. **放弃 Python/FastAPI** → Vercel Serverless (Node.js) 部署简单，一个语言栈
2. **放弃 ChromaDB** → Supabase pgvector 一个服务替代 DB + 向量库 + Auth
3. **放弃 Railway** → Vercel 免费 + 全球 CDN
4. **Coding Plan key 不能用于产品** → 只能给指定 agent (Trae/Claude Code)，产品 API 必须用标准 API key
5. **embedding 维度 1024** → pgvector HNSW 限制 2000 维，2048 不支持
6. **R15 是双语** → 不是纯英文化，PRD 标题有误导性，以用户说法为准

---

## 8. 新对话恢复指令

在新对话开头粘贴：
```
读取 docs/MEMORY.md 和 docs/PRD-MLIGB1.md，然后继续开发。
```
