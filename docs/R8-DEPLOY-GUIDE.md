# R8 部署指南 — Vercel + Supabase

## 概览

```
部署顺序：
1. 创建 Supabase 项目 → 获取 URL + Service Key
2. 跑 SQL 建表 → 启用 pgvector
3. 创建 Vercel 项目 → 关联 GitHub 仓库
4. 配置环境变量 → 4 个 Key
5. 部署完成 → 前端自动可用
```

---

## Step 1: 创建 Supabase 项目

1. 访问 https://supabase.com → 注册（可用 GitHub 登录）
2. New Project → 名称填 `biology-study-hub`
3. 数据库密码记住（或用自动生成的）
4. 选择区域：Southeast Asia (Singapore) — 离中国最近
5. 等待 ~2 分钟初始化完成

### 获取连接信息

```
Project Settings → API
├── Project URL: https://xxxxx.supabase.co      ← 复制
└── service_role key: eyJhbGciOi...（很长的）     ← 复制
```

## Step 2: 运行 SQL 建表

1. Supabase Dashboard → SQL Editor → New Query
2. 粘贴 `api/supabase-schema.sql` 的全部内容
3. 点 Run

成功后会看到：
- `documents` 表（含 pgvector 扩展）
- `chat_history` 表
- `match_documents` 函数
- 4 条 RLS 策略

## Step 3: 创建 Vercel 项目

1. 访问 https://vercel.com → 用 GitHub 登录
2. Add New → Project → Import `biology-study-hub` 仓库
3. 配置：
   - Framework Preset: **Other**（纯静态）
   - Root Directory: `.`（默认）
   - Build Command: 留空（不需要构建）
   - Output Directory: 留空（根目录）

4. **先别点 Deploy**，先配置环境变量

## Step 4: 配置环境变量

在 Vercel 项目的 Settings → Environment Variables 中添加：

| Key | Value | 说明 |
|-----|-------|------|
| `DEEPSEEK_API_KEY` | `sk-你的key` | 从 https://platform.deepseek.com 获取 |
| `GLM_VISION_4_6V_FLASH_API_KEY` | `你的智谱视觉key` | glm-4.6v-flash，从 https://bigmodel.cn 控制台获取 |
| `ZHIPU_EMBEDDING_API_KEY` | `你的智谱embedding key` | embedding-3，从 https://bigmodel.cn 控制台获取 |
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | Step 1 获取 |
| `SUPABASE_SERVICE_KEY` | `eyJhbGciOi...` | Step 1 获取 |

> 每个 Key 选 Production + Preview + Development 三个环境

## Step 5: 部署

1. 回到 Vercel → Deployments → Redeploy
2. 等 ~30 秒构建完成
3. 访问 Vercel 分配的域名（如 `biology-study-hub.vercel.app`）

### 验证 API 是否正常

浏览器打开：
```
https://你的域名.vercel.app/api/lookup
```
应该返回 `{"error":"Method not allowed"}`（说明 API 在运行）

## Step 6: 更新前端 API 地址

部署成功后，修改 `unit2.html` 中的 Vercel URL：

```javascript
// 找到这行（约 line 3398）
var VERCEL_API_URL = 'https://biology-study-hub.vercel.app';
// 改成你的实际 Vercel 域名
var VERCEL_API_URL = 'https://你的项目名.vercel.app';
```

## Step 7: 导入课文数据（可选，启用 RAG）

RAG 需要课文数据在 Supabase 中。导入方式：

1. 在前端 RAG 聊天窗口正常使用
2. 或手动通过 API 上传课文 chunks：
```bash
curl -X POST https://你的域名/api/rag/upload \
  -H "Content-Type: application/json" \
  -d '{
    "unit": "unit2",
    "source": "textbook",
    "chunks": [
      {"text": "Cells are the basic building blocks of life...", "section": "2.1", "page": 1},
      {"text": "Diffusion is the net movement of particles...", "section": "2.3", "page": 5}
    ]
  }'
```

---

## 费用总览

| 服务 | 免费档 | 你的用量 | 够用？ |
|------|--------|---------|--------|
| Vercel | 100K API 调用/月 | ~2000/月 | ✅ |
| Supabase | 500MB 存储 + 2 项目 | ~10MB | ✅ |
| DeepSeek | 按量付费 | ~¥5/月 | ✅ |
| 智谱 | Coding Plan 4000 次 | ~500/月 | ✅ |
| **总计** | — | — | **~¥5/月** |

---

## 常见问题

### Q: CORS 报错？
A: API 已配置 `Access-Control-Allow-Origin: *`，应该没问题。如果还报错检查 vercel.json。

### Q: API 超时？
A: Vercel 免费档 10s 超时。DeepSeek 调用通常 2-5s。如果超时，考虑升级 Vercel Pro（$20/月，60s 超时）。

### Q: Supabase 连接失败？
A: 检查 Service Key 是否正确（不是 anon key，是 service_role key）。

### Q: pgvector 报错？
A: 确认 SQL Editor 里 `create extension vector` 成功执行。Supabase 新项目默认支持。
