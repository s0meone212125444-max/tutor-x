-- ============================================================
-- TutorX — Supabase schema (Phase 2)
-- Paste this whole file into: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Embeddings are 384-dim (gte-small, run locally via transformers.js — no API key needed)
-- ============================================================

-- 1. Enable pgvector
create extension if not exists vector;

-- 2. COURSES — a subject the student is studying (e.g. "MTH101")
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  exam_style text,                       -- notes on how this course sets questions
  created_at timestamptz default now()
);

-- 3. DOCUMENTS — an uploaded file (PDF/notes/past-questions) under a course
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  kind text default 'material',          -- 'material' | 'past_questions'
  created_at timestamptz default now()
);

-- 4. CHUNKS — the RAG store: text chunks + their vector embeddings
create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  embedding vector(384),
  chunk_index int,
  created_at timestamptz default now()
);

-- Vector index for fast similarity search
create index if not exists chunks_embedding_idx
  on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists chunks_course_idx on chunks(course_id);

-- 5. EXAM RESULTS — a marked mock exam
create table if not exists exam_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade,
  score numeric,                         -- 0..100
  total_questions int,
  weak_topics text[],                    -- topics the student was weak in
  detail jsonb,                          -- full per-question breakdown
  created_at timestamptz default now()
);

-- 6. TOPIC MASTERY — running weak-point tracker per topic (Phase 3 adaptive loop uses this)
create table if not exists topic_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade,
  topic text not null,
  mastery numeric default 0.3,           -- 0..1
  times_seen int default 0,
  last_seen timestamptz default now(),
  unique (user_id, course_id, topic)
);

-- ============================================================
-- 7. MATCH FUNCTION — cosine similarity search over a course's chunks
-- ============================================================
create or replace function match_chunks (
  query_embedding vector(384),
  match_course_id uuid,
  match_count int default 8
)
returns table (id uuid, content text, similarity float)
language sql stable
as $$
  select c.id, c.content, 1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where c.course_id = match_course_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- 8. ROW LEVEL SECURITY — each user only sees their own data
-- ============================================================
alter table courses enable row level security;
alter table documents enable row level security;
alter table chunks enable row level security;
alter table exam_results enable row level security;
alter table topic_mastery enable row level security;

create policy "own courses"  on courses      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own documents" on documents    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own chunks"   on chunks        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own results"  on exam_results  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own mastery"  on topic_mastery for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
