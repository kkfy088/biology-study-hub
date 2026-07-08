# R8 Design Spec — Vercel + Supabase + DeepSeek/GLM

## Overview

前后端分离：前端 HTML 不变，新增 Vercel API Routes 后端 + Supabase 向量存储。浏览器内嵌 RAG 聊天窗口。

## Architecture

```
┌─ Browser (unit2.html) ──────────────────────────┐
│  前端：划词 / 主观题 / RAG 聊天窗口               │
│  fetch → Vercel API                              │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────────┐
│  Vercel API Routes (Node.js Serverless)          │
│  ├── /api/lookup   → DeepSeek-V3                │
│  ├── /api/explain  → DeepSeek-V3                │
│  ├── /api/grade    → DeepSeek-R1                │
│  ├── /api/vision   → GLM-4V-Flash               │
│  ├── /api/rag/query   → Supabase + DeepSeek     │
│  └── /api/rag/upload  → pdf.js + 智谱 embedding  │
└──────┬─────────────────────┬────────────────────┘
       │                     │
┌──────▼──────┐    ┌────────▼────────────────────┐
│  DeepSeek   │    │  Supabase                    │
│  API        │    │  ├── pgvector (向量检索)      │
│             │    │  ├── Storage  (PDF 存储)      │
│             │    │  └── Auth     (用户认证 R13)  │
└─────────────┘    └─────────────────────────────┘
```

## API Endpoints

### 1. POST /api/lookup (DeepSeek)
Request: `{ word: "cytoplasm" }`
Response: `{ ipa, cn, def_en, def_cn, examples[] }`

### 2. POST /api/explain (DeepSeek)
Request: `{ text: "The cytoplasm is surrounded by..." }`
Response: `{ translation, structure, key_terms[], explanation }`

### 3. POST /api/grade (DeepSeek-R1)
Request: `{ question, studentAnswer, correctAnswer, keyPoints[] }`
Response: `{ score, feedback_cn, feedback_en, improvements[] }`

### 4. POST /api/vision (GLM-4V)
Request: `{ image: "base64..." }`
Response: `{ description_cn, labels[], exam_tips }`

### 5. POST /api/rag/query
Request: `{ question: "什么是渗透作用？" }`
Response: `{ answer, sources: [{ unit, section, page, text }] }`

### 6. POST /api/rag/upload
Request: `{ text: "parsed text chunks...", source: "supplement.pdf" }`
Response: `{ chunks_indexed, success: true }`

## Environment Variables (Vercel)

```
DEEPSEEK_API_KEY=sk-...
ZHIPU_API_KEY=...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

## Supabase Schema

```sql
-- Enable pgvector
create extension if not exists vector;

-- Documents table
create table documents (
  id bigint primary key generated always as identity,
  unit text not null,           -- 'unit1', 'unit2', 'supplement'
  section text,                 -- '2.1', '2.3', etc.
  page int,                     -- page number in PDF
  chunk_index int,              -- 0, 1, 2... within a section
  content text not null,        -- the actual text
  content_cn text,              -- Chinese translation (optional)
  source text,                  -- 'textbook.pdf', 'supplement.pdf'
  embedding vector(1024),       -- 智谱 embedding-3 dimension
  created_at timestamptz default now()
);

-- Index for vector similarity search
create index on documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Chat history table
create table chat_history (
  id bigint primary key generated always as identity,
  user_id text,
  unit text,
  role text not null,           -- 'user' or 'assistant'
  content text not null,
  sources jsonb,
  created_at timestamptz default now()
);
```

## Security

- API Keys stored in Vercel environment variables (never exposed to frontend)
- Supabase RLS (Row Level Security) on documents table (read-only for students)
- Rate limiting: Vercel built-in + per-IP throttle in API routes

## Implementation Order

1. Create `api/` directory in project root
2. `/api/lookup` + `/api/explain` + `/api/grade` (DeepSeek)
3. `/api/vision` (GLM-4V)
4. Supabase setup + `/api/rag/query` + `/api/rag/upload`
5. Frontend: RAG chat window UI
6. Frontend: migrate existing AI calls to backend API
7. Deploy to Vercel
