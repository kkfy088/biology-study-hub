-- Supabase pgvector schema for Biology Study Hub
-- Run this in Supabase SQL Editor

-- Enable pgvector extension
create extension if not exists vector;

-- Documents table (stores text chunks + embeddings)
create table if not exists documents (
  id bigint primary key generated always as identity,
  unit text not null,
  section text,
  page int,
  chunk_index int,
  content text not null,
  content_cn text,
  source text,
  embedding vector(1024),
  created_at timestamptz default now()
);

-- HNSW index for fast similarity search
create index if not exists documents_embedding_idx
  on documents using hnsw (embedding vector_cosine_ops);

-- Match function for RAG queries
create or replace function match_documents(
  query_embedding vector(2048),
  match_count int default 5,
  filter_unit text default null
)
returns table (
  id bigint,
  unit text,
  section text,
  page int,
  content text,
  content_cn text,
  source text,
  similarity float
)
language sql
as $$
  select
    d.id,
    d.unit,
    d.section,
    d.page,
    d.content,
    d.content_cn,
    d.source,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where filter_unit is null or d.unit = filter_unit
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- Chat history table
create table if not exists chat_history (
  id bigint primary key generated always as identity,
  user_id text default 'anonymous',
  unit text,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb,
  created_at timestamptz default now()
);

-- Enable RLS (Row Level Security)
alter table documents enable row level security;
alter table chat_history enable row level security;

-- Public read for documents (students can search)
create policy "Public read documents"
  on documents for select
  using (true);

-- Only authenticated can insert documents
create policy "Authenticated insert documents"
  on documents for insert
  to authenticated
  with check (true);

-- Users can read their own chat history
create policy "Users read own chat"
  on chat_history for select
  using (true);

-- Users can insert their own chat
create policy "Users insert own chat"
  on chat_history for insert
  with check (true);
